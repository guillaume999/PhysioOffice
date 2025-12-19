import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  Trash2,
  Star,
  StarOff,
  ExternalLink,
  User,
  Calendar,
  FileText,
} from "lucide-react";

interface ExerciceType {
  id: string;
  title: string;
  description: string | null;
  author_name: string | null;
  status: string;
  is_copy: boolean | null;
  original_id: string | null;
  user_id: string;
  created_at: string;
  video_url?: string | null;
  thumbnail_url?: string | null;
  pathologie_tags?: string[] | null;
}

interface ExerciceDetailDialogProps {
  exercice: ExerciceType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  getUserDisplayName: (userId: string) => string;
  isFeatured: boolean;
  copyCount: number;
  isConsulted: boolean;
  onConsultedChange: (consulted: boolean) => void;
}

export function ExerciceDetailDialog({
  exercice,
  open,
  onOpenChange,
  onUpdate,
  getUserDisplayName,
  isFeatured,
  copyCount,
  isConsulted,
  onConsultedChange,
}: ExerciceDetailDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!exercice) return null;

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleValidate = async () => {
    setLoading(true);
    try {
      const newStatus = exercice.status === "shared" ? "pending" : "shared";
      const { error } = await supabase
        .from("exercices")
        .update({ status: newStatus })
        .eq("id", exercice.id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: `Exercice ${newStatus === "shared" ? "validé" : "invalidé"}.`,
      });
      onUpdate();
    } catch (error) {
      console.error("Error validating exercice:", error);
      toast({
        title: "Erreur",
        description: "Impossible de valider l'exercice.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet exercice ?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("exercices")
        .delete()
        .eq("id", exercice.id);

      if (error) throw error;

      toast({ title: "Exercice supprimé" });
      onOpenChange(false);
      onUpdate();
    } catch (error) {
      console.error("Error deleting exercice:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'exercice.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeatured = async () => {
    setLoading(true);
    try {
      if (isFeatured) {
        // Remove from featured
        const { error } = await supabase
          .from("featured_exercices")
          .delete()
          .eq("exercice_id", exercice.id);

        if (error) throw error;

        toast({ title: "Exercice retiré de la plateforme" });
      } else {
        // Add to featured
        const { error } = await supabase.from("featured_exercices").insert({
          exercice_id: exercice.id,
          added_by: user?.id || "",
        });

        if (error) throw error;

        toast({ title: "Exercice ajouté à la plateforme" });
      }
      onUpdate();
    } catch (error) {
      console.error("Error toggling featured:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut plateforme.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (exercice.status) {
      case "shared":
        return <Badge className="bg-green-500">Partagé</Badge>;
      case "pending":
        return <Badge className="bg-orange-500">En attente</Badge>;
      default:
        return <Badge variant="outline">Brouillon</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {exercice.title}
            {isFeatured && (
              <Badge className="bg-yellow-500 text-yellow-900">
                <Star className="w-3 h-3 mr-1" />
                Plateforme
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status & Metadata */}
          <div className="flex flex-wrap gap-2">
            {getStatusBadge()}
            {copyCount > 0 && (
              <Badge variant="secondary">{copyCount} copies</Badge>
            )}
          </div>

          {/* Video Preview */}
          {exercice.video_url && (
            <div className="rounded-lg overflow-hidden bg-muted aspect-video">
              <video
                src={exercice.video_url}
                controls
                className="w-full h-full object-cover"
                poster={exercice.thumbnail_url || undefined}
              />
            </div>
          )}

          {/* Description */}
          {exercice.description && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Description
              </h4>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {exercice.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {exercice.pathologie_tags && exercice.pathologie_tags.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Tags pathologies</h4>
              <div className="flex flex-wrap gap-1">
                {exercice.pathologie_tags.map((tag, i) => (
                  <Badge key={i} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Author & Date */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Auteur:</span>
              <span>{exercice.author_name || "Anonyme"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Créé le:</span>
              <span>{formatDateTime(exercice.created_at)}</span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <span>Créateur: </span>
            <span className="font-medium">{getUserDisplayName(exercice.user_id)}</span>
          </div>

          {/* Admin Review Checkbox */}
          <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="reviewed"
              checked={isConsulted}
              onCheckedChange={(checked) => onConsultedChange(checked === true)}
            />
            <Label
              htmlFor="reviewed"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              J'ai consulté cet exercice
            </Label>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            {exercice.status !== "draft" && (
              <Button
                variant={exercice.status === "shared" ? "outline" : "default"}
                onClick={handleValidate}
                disabled={loading}
                className="gap-1"
              >
                <CheckCircle className="w-4 h-4" />
                {exercice.status === "shared" ? "Invalider" : "Valider"}
              </Button>
            )}

            <Button
              variant={isFeatured ? "outline" : "secondary"}
              onClick={handleToggleFeatured}
              disabled={loading || exercice.status !== "shared"}
              className="gap-1"
            >
              {isFeatured ? (
                <>
                  <StarOff className="w-4 h-4" />
                  Retirer de la plateforme
                </>
              ) : (
                <>
                  <Star className="w-4 h-4" />
                  Ajouter à la plateforme
                </>
              )}
            </Button>

            {exercice.video_url && (
              <Button
                variant="outline"
                onClick={() => window.open(exercice.video_url!, "_blank")}
                className="gap-1"
              >
                <ExternalLink className="w-4 h-4" />
                Voir vidéo
              </Button>
            )}

            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="gap-1 ml-auto"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
