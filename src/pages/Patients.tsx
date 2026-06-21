import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Users, Loader2, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Share2 } from "lucide-react";
import { BulkSharePatientsDialog } from "@/components/sharing/BulkSharePatientsDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PagePopup } from "@/components/popup/PagePopup";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { matchesSearch as matchesSearch_ } from "@/lib/utils";

interface Patient {
  id: string;
  name: string;
  numero: string | null;
  status: string;
  has_mutual: boolean;
  remaining_sessions: number | null;
  prescription: string | null;
}

const prescriptionLabels: Record<string, string> = {
  oui: "Oui",
  none: "Non",
  non: "Non",
  renouv_kine: "Renouv. kiné",
};

type StatusFilter = "all" | "active" | "in_treatment" | "waiting" | "inactive";

const statusLabels: Record<string, string> = {
  active: "Actif",
  in_treatment: "En traitement",
  waiting: "En attente",
  inactive: "Inactif",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600",
  in_treatment: "bg-blue-500/10 text-blue-600",
  waiting: "bg-yellow-500/10 text-yellow-600",
  inactive: "bg-muted text-muted-foreground",
};

export default function Patients() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("in_treatment");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortColumn, setSortColumn] = useState<keyof Patient | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [formData, setFormData] = useState({ 
    name: "", 
    status: "active",
    has_mutual: false,
    remaining_sessions: 0,
    prescription: "none"
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchPatients();
  }, [user]);

  const fetchPatients = async () => {
    try {
      const data = await pb.collection("patients").getFullList({
        filter: `user = "${user!.id}"`,
        sort: "-id",
        fields: "id,name,numero,status,mutuelle,seances_restantes,ordonnance",
      });
      setPatients(data.map((r: any) => ({
        id: r.id,
        name: r.name,
        numero: r.numero,
        status: r.status,
        has_mutual: r.mutuelle === true || r.mutuelle === "true" || r.mutuelle === "oui" || r.mutuelle === "1",
        remaining_sessions: r.seances_restantes,
        prescription: r.ordonnance === "non" ? "none" : (r.ordonnance ?? null),
      })));
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updatePatientStatus = async (patientId: string, newStatus: string) => {
    try {
      await pb.collection("patients").update(patientId, { status: newStatus });
      setPatients(patients.map(p => p.id === patientId ? { ...p, status: newStatus } : p));
      toast({ title: "Statut mis à jour" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Prochain numéro = max + 1 (jamais réutilisé, padding 4 chiffres, cap 9999, propre à chaque praticien)
      const existing = await pb.collection("patients").getFullList({
        filter: `user = "${user!.id}"`,
        fields: "numero",
      });
      let maxNumero = 0;
      for (const p of existing as any[]) {
        const n = parseInt((p.numero ?? "").toString().replace(/\D/g, ""), 10);
        if (Number.isFinite(n) && n > maxNumero) maxNumero = n;
      }
      const next = maxNumero + 1;
      if (next > 9999) {
        toast({ title: "Erreur", description: "Numéros patients épuisés (>9999)", variant: "destructive" });
        return;
      }
      const nextNumero = String(next).padStart(4, "0");

      await pb.collection("patients").create({
        name: formData.name,
        numero: nextNumero,
        status: formData.status,
        mutuelle: formData.has_mutual ? "true" : "false",
        seances_restantes: formData.remaining_sessions,
        ordonnance: formData.prescription === "none" ? "non" : formData.prescription,
        user: user?.id,
        praticien: user?.id,
        prenom: formData.name,
        nom: formData.name,
      });
      toast({ title: `Patient ajouté (n°${nextNumero})` });
      setIsDialogOpen(false);
      setFormData({ name: "", status: "active", has_mutual: false, remaining_sessions: 0, prescription: "none" });
      fetchPatients();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSort = (column: keyof Patient) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: keyof Patient) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="w-3 h-3 ml-1" /> 
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const filtered = patients
    .filter(p => {
      const matchesSearch = matchesSearch_(p.name, search);
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      let comparison = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal, "fr");
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        comparison = aVal === bVal ? 0 : aVal ? -1 : 1;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });

  if (authLoading || loading) return <Layout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout>
      <PagePopup pageKey="patients" />
      <div className="container mx-auto px-2 sm:px-4 py-4 md:py-8">
        <ScrollReveal variant="up">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10"><Users className="w-6 h-6 text-blue-500" /></div>
            <div><h1 className="text-2xl md:text-3xl font-display font-bold">Patients</h1><p className="text-muted-foreground">{patients.length} patient(s) enregistré(s)</p></div>
          </div>
          <div className="flex gap-2 md:gap-4 w-full md:w-auto flex-wrap">
            <Button variant="outline" onClick={() => navigate("/planning")}>
              <Calendar className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Planning</span>
            </Button>
            <BulkSharePatientsDialog
              patients={patients}
              trigger={
                <Button variant="outline">
                  <Share2 className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Partager</span>
                </Button>
              }
            />
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Ajouter</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouveau patient</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Nom *</Label>
                    <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Statut</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Actif</SelectItem>
                          <SelectItem value="in_treatment">En traitement</SelectItem>
                          <SelectItem value="waiting">En attente</SelectItem>
                          <SelectItem value="inactive">Inactif</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Mutuelle</Label>
                      <div className="flex items-center gap-3 h-10">
                        <Switch
                          checked={formData.has_mutual}
                          onCheckedChange={(checked) => setFormData({...formData, has_mutual: checked})}
                        />
                        <span className="text-sm text-muted-foreground">
                          {formData.has_mutual ? "Oui" : "Non"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Séances restantes</Label>
                      <Input type="number" min="0" value={formData.remaining_sessions} onChange={e => setFormData({...formData, remaining_sessions: parseInt(e.target.value) || 0})} />
                    </div>
                    <div>
                      <Label>Prescription</Label>
                      <Select value={formData.prescription} onValueChange={(value) => setFormData({...formData, prescription: value})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="oui">Oui</SelectItem>
                          <SelectItem value="none">Non</SelectItem>
                          <SelectItem value="renouv_kine">Renouv. kiné</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" disabled={isSubmitting} className="w-full gradient-primary text-primary-foreground">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</> : "Enregistrer"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        </ScrollReveal>

        {/* Status filter buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            Tous ({patients.length})
          </Button>
          <Button
            variant={statusFilter === "in_treatment" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("in_treatment")}
            className={statusFilter === "in_treatment" ? "" : "border-blue-500/50 text-blue-600 hover:bg-blue-500/10"}
          >
            En traitement ({patients.filter(p => p.status === "in_treatment").length})
          </Button>
          <Button
            variant={statusFilter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("active")}
            className={statusFilter === "active" ? "" : "border-green-500/50 text-green-600 hover:bg-green-500/10"}
          >
            Actif ({patients.filter(p => p.status === "active").length})
          </Button>
          <Button
            variant={statusFilter === "waiting" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("waiting")}
            className={statusFilter === "waiting" ? "" : "border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"}
          >
            En attente ({patients.filter(p => p.status === "waiting").length})
          </Button>
          <Button
            variant={statusFilter === "inactive" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("inactive")}
            className={statusFilter === "inactive" ? "" : "border-muted-foreground/50 text-muted-foreground hover:bg-muted"}
          >
            Inactif ({patients.filter(p => p.status === "inactive").length})
          </Button>
        </div>

        <ScrollReveal variant="up" delay={100}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="min-w-[150px] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("name")}
                    >
                      <span className="flex items-center">Nom{getSortIcon("name")}</span>
                    </TableHead>
                    <TableHead 
                      className="min-w-[100px] hidden sm:table-cell cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("numero")}
                    >
                      <span className="flex items-center">Numéro{getSortIcon("numero")}</span>
                    </TableHead>
                    <TableHead 
                      className="min-w-[130px] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("status")}
                    >
                      <span className="flex items-center">Statut{getSortIcon("status")}</span>
                    </TableHead>
                    <TableHead 
                      className="min-w-[80px] hidden md:table-cell cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("has_mutual")}
                    >
                      <span className="flex items-center">Mutuelle{getSortIcon("has_mutual")}</span>
                    </TableHead>
                    <TableHead 
                      className="min-w-[100px] hidden lg:table-cell cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("remaining_sessions")}
                    >
                      <span className="flex items-center">Séances{getSortIcon("remaining_sessions")}</span>
                    </TableHead>
                    <TableHead 
                      className="min-w-[100px] hidden lg:table-cell cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("prescription")}
                    >
                      <span className="flex items-center">Prescription{getSortIcon("prescription")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow 
                      key={p.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <span>{p.name}</span>
                          <span className="sm:hidden text-xs text-muted-foreground block">{p.numero || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{p.numero || "-"}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Select value={p.status} onValueChange={(value) => updatePatientStatus(p.id, value)}>
                          <SelectTrigger className={`w-full sm:w-32 h-8 text-xs ${statusColors[p.status] || ""}`}>
                            <SelectValue>{statusLabels[p.status] || p.status}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Actif</SelectItem>
                            <SelectItem value="in_treatment">En traitement</SelectItem>
                            <SelectItem value="waiting">En attente</SelectItem>
                            <SelectItem value="inactive">Inactif</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          p.has_mutual ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                        }`}>
                          {p.has_mutual ? "Oui" : "Non"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{p.remaining_sessions ?? 0}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          p.prescription === "oui" ? "bg-green-500/10 text-green-600" :
                          p.prescription === "renouv_kine" ? "bg-orange-500/10 text-orange-600" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {prescriptionLabels[p.prescription || "none"] || "Non"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucun patient trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </ScrollReveal>
      </div>
    </Layout>
  );
}
