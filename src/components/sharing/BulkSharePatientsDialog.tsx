import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Share2, Search, Users, UserCheck, Clock, Edit, Eye } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { addDays, addWeeks, addMonths } from "date-fns";

interface Patient {
  id: string;
  name: string;
  numero: string | null;
  status: string;
}

interface BulkSharePatientsDialogProps {
  patients: Patient[];
  trigger?: React.ReactNode;
}

export function BulkSharePatientsDialog({ patients, trigger }: BulkSharePatientsDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationPreset, setExpirationPreset] = useState("1week");
  const [submitting, setSubmitting] = useState(false);

  // Filter patients based on search and inactive toggle
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                           (p.numero && p.numero.includes(search));
      const matchesStatus = includeInactive || p.status !== "inactive";
      return matchesSearch && matchesStatus;
    });
  }, [patients, search, includeInactive]);

  // Count active (non-inactive) patients
  const activePatientCount = useMemo(() => {
    return patients.filter(p => p.status !== "inactive").length;
  }, [patients]);

  const handleSelectAll = () => {
    if (selectedPatients.size === filteredPatients.length) {
      setSelectedPatients(new Set());
    } else {
      setSelectedPatients(new Set(filteredPatients.map(p => p.id)));
    }
  };

  const handleTogglePatient = (patientId: string) => {
    const newSelected = new Set(selectedPatients);
    if (newSelected.has(patientId)) {
      newSelected.delete(patientId);
    } else {
      newSelected.add(patientId);
    }
    setSelectedPatients(newSelected);
  };

  const getExpirationDate = (): string | null => {
    if (!hasExpiration) return null;

    const now = new Date();
    switch (expirationPreset) {
      case "1day":
        return addDays(now, 1).toISOString();
      case "1week":
        return addWeeks(now, 1).toISOString();
      case "2weeks":
        return addWeeks(now, 2).toISOString();
      case "1month":
        return addMonths(now, 1).toISOString();
      case "3months":
        return addMonths(now, 3).toISOString();
      default:
        return addWeeks(now, 1).toISOString();
    }
  };

  const handleShare = async () => {
    if (!user || !email.trim() || selectedPatients.size === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner au moins un patient et entrer un email",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Find user by email
      const profileRes = await pb.collection("users").getList(1, 1, { filter: `email = "${email.trim().toLowerCase()}"`, fields: "id" });
      const profileData = profileRes.items[0] ? { user_id: profileRes.items[0].id } : null;

      if (!profileData) {
        toast({
          title: "Utilisateur non trouvé",
          description: "Aucun utilisateur avec cet email n'est inscrit sur PhysioOffice",
          variant: "destructive",
        });
        return;
      }

      if (profileData.user_id === user.id) {
        toast({
          title: "Erreur",
          description: "Vous ne pouvez pas partager avec vous-même",
          variant: "destructive",
        });
        return;
      }

      const expiresAt = getExpirationDate();

      // Create shares for all selected patients
      const shares = Array.from(selectedPatients).map(patientId => ({
        owner_user_id: user.id,
        shared_with_user_id: profileData.user_id,
        resource_type: "patient",
        resource_id: patientId,
        permission,
        expires_at: expiresAt,
      }));

      for (const share of shares) {
        try {
          await pb.collection("resource_shares").create({
            owner_user: share.owner_user_id,
            shared_with_user: share.shared_with_user_id,
            resource_type: share.resource_type,
            resource_id: share.resource_id,
            permission: share.permission,
            expires_at: share.expires_at,
          });
        } catch(e: any) {
          // ignore duplicate
          if (!e?.data?.message?.includes("unique")) throw e;
        }
      }

      toast({
        title: "Partage créé",
        description: `${selectedPatients.size} patient(s) partagé(s) avec succès`,
      });

      setOpen(false);
      setSelectedPatients(new Set());
      setEmail("");
    } catch (error: any) {
      console.error("Error creating shares:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer les partages",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPatients(new Set());
      setSearch("");
      setEmail("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Share2 className="w-4 h-4 mr-2" />
            Partager
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Partager plusieurs patients
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les patients à partager avec un autre utilisateur
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search and filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un patient..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeInactive"
                  checked={includeInactive}
                  onCheckedChange={(checked) => setIncludeInactive(checked as boolean)}
                />
                <Label htmlFor="includeInactive" className="text-sm">
                  Inclure les inactifs
                </Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs"
              >
                {selectedPatients.size === filteredPatients.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </div>
          </div>

          {/* Patient list */}
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-48 border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedPatients.has(patient.id) 
                        ? "bg-primary/10 border border-primary/30" 
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => handleTogglePatient(patient.id)}
                  >
                    <Checkbox
                      checked={selectedPatients.has(patient.id)}
                      onCheckedChange={() => handleTogglePatient(patient.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{patient.name}</p>
                      <p className="text-xs text-muted-foreground">
                        #{patient.numero || "-"} • {patient.status === "inactive" ? "Inactif" : "Actif"}
                      </p>
                    </div>
                  </div>
                ))}
                {filteredPatients.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Aucun patient trouvé
                  </p>
                )}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedPatients.size} patient(s) sélectionné(s) sur {filteredPatients.length}
            </p>
          </div>

          {/* Share settings */}
          <div className="space-y-4 pt-2 border-t">
            <div className="space-y-2">
              <Label htmlFor="email">Email du destinataire</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Permission</Label>
                <Select value={permission} onValueChange={(v) => setPermission(v as "read" | "write")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Lecture
                      </div>
                    </SelectItem>
                    <SelectItem value="write">
                      <div className="flex items-center gap-2">
                        <Edit className="w-4 h-4" />
                        Écriture
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="expiration">Expiration</Label>
                  <Switch
                    id="expiration"
                    checked={hasExpiration}
                    onCheckedChange={setHasExpiration}
                  />
                </div>
                {hasExpiration && (
                  <Select value={expirationPreset} onValueChange={setExpirationPreset}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1day">1 jour</SelectItem>
                      <SelectItem value="1week">1 semaine</SelectItem>
                      <SelectItem value="2weeks">2 semaines</SelectItem>
                      <SelectItem value="1month">1 mois</SelectItem>
                      <SelectItem value="3months">3 mois</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <Button
              onClick={handleShare}
              disabled={!email.trim() || selectedPatients.size === 0 || submitting}
              className="w-full gradient-primary text-primary-foreground"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              {submitting 
                ? "Partage en cours..." 
                : `Partager ${selectedPatients.size} patient(s)`
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
