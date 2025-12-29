import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Share2, Trash2, Users, Calendar, UserCheck, Clock, Edit, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { fr } from "date-fns/locale";

interface ResourceShare {
  id: string;
  shared_with_user_id: string;
  resource_type: string;
  resource_id: string | null;
  permission: string;
  expires_at: string | null;
  created_at: string;
  shared_user_email?: string;
  shared_user_pseudo?: string;
}

interface ShareResourceDialogProps {
  resourceType: "patient" | "planning";
  resourceId?: string;
  resourceName?: string;
  trigger?: React.ReactNode;
}

export function ShareResourceDialog({ 
  resourceType, 
  resourceId, 
  resourceName,
  trigger 
}: ShareResourceDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<ResourceShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationPreset, setExpirationPreset] = useState("1week");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchShares();
    }
  }, [open, user]);

  const fetchShares = async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from("resource_shares")
        .select("*")
        .eq("owner_user_id", user.id)
        .eq("resource_type", resourceType);

      if (resourceType === "patient" && resourceId) {
        query = query.eq("resource_id", resourceId);
      } else if (resourceType === "planning") {
        query = query.is("resource_id", null);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user info for each share
      const sharesWithUsers = await Promise.all(
        (data || []).map(async (share) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("email, pseudo")
            .eq("user_id", share.shared_with_user_id)
            .maybeSingle();

          return {
            ...share,
            shared_user_email: profileData?.email || "Utilisateur inconnu",
            shared_user_pseudo: profileData?.pseudo,
          };
        })
      );

      setShares(sharesWithUsers);
    } catch (error) {
      console.error("Error fetching shares:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les partages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
    if (!user || !email.trim()) return;

    setSubmitting(true);
    try {
      // Find user by email
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;

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

      const shareData = {
        owner_user_id: user.id,
        shared_with_user_id: profileData.user_id,
        resource_type: resourceType,
        resource_id: resourceType === "patient" ? resourceId : null,
        permission,
        expires_at: getExpirationDate(),
      };

      const { error } = await supabase
        .from("resource_shares")
        .upsert(shareData, {
          onConflict: "owner_user_id,shared_with_user_id,resource_type,resource_id",
        });

      if (error) throw error;

      toast({
        title: "Partage créé",
        description: `${resourceType === "patient" ? "Patient" : "Planning"} partagé avec succès`,
      });

      setEmail("");
      fetchShares();
    } catch (error: any) {
      console.error("Error creating share:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le partage",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from("resource_shares")
        .delete()
        .eq("id", shareId);

      if (error) throw error;

      toast({
        title: "Partage supprimé",
        description: "L'accès a été révoqué",
      });

      fetchShares();
    } catch (error) {
      console.error("Error removing share:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le partage",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePermission = async (shareId: string, newPermission: string) => {
    try {
      const { error } = await supabase
        .from("resource_shares")
        .update({ permission: newPermission })
        .eq("id", shareId);

      if (error) throw error;

      toast({
        title: "Permission mise à jour",
      });

      fetchShares();
    } catch (error) {
      console.error("Error updating permission:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la permission",
        variant: "destructive",
      });
    }
  };

  const getResourceTitle = () => {
    if (resourceType === "planning") {
      return "Partager mon planning";
    }
    return resourceName ? `Partager ${resourceName}` : "Partager ce patient";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Partager
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {resourceType === "planning" ? (
              <Calendar className="w-5 h-5 text-primary" />
            ) : (
              <Users className="w-5 h-5 text-primary" />
            )}
            {getResourceTitle()}
          </DialogTitle>
          <DialogDescription>
            Partagez avec un autre utilisateur PhysioOffice inscrit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add new share */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email de l'utilisateur</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

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
                      Lecture seule
                    </div>
                  </SelectItem>
                  <SelectItem value="write">
                    <div className="flex items-center gap-2">
                      <Edit className="w-4 h-4" />
                      Lecture et modification
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="expiration">Date d'expiration</Label>
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

            <Button
              onClick={handleShare}
              disabled={!email.trim() || submitting}
              className="w-full gradient-primary text-primary-foreground"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              {submitting ? "Partage en cours..." : "Partager"}
            </Button>
          </div>

          {/* Existing shares */}
          {shares.length > 0 && (
            <div className="space-y-3">
              <Label>Partages actifs</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {share.shared_user_pseudo || share.shared_user_email}
                      </p>
                      {share.shared_user_pseudo && (
                        <p className="text-xs text-muted-foreground truncate">
                          {share.shared_user_email}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={share.permission === "write" ? "default" : "secondary"} className="text-xs">
                          {share.permission === "write" ? (
                            <>
                              <Edit className="w-3 h-3 mr-1" />
                              Écriture
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3 mr-1" />
                              Lecture
                            </>
                          )}
                        </Badge>
                        {share.expires_at && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {format(new Date(share.expires_at), "dd MMM yyyy", { locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={share.permission}
                        onValueChange={(v) => handleUpdatePermission(share.id, v)}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read">Lecture</SelectItem>
                          <SelectItem value="write">Écriture</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveShare(share.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center text-muted-foreground text-sm">
              Chargement...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
