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
import { Textarea } from "@/components/ui/textarea";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  Trash2,
  Star,
  StarOff,
  User,
  Calendar,
  FileText,
  XCircle,
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
  image_url?: string | null;
  media_type?: string | null;
  pathologie_tags?: string[] | null;
  rejection_reason?: string | null;
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
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

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
      await pb.collection("exercices").update(exercice.id, { status: newStatus, rejection_reason: null });

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

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un motif de refus.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await pb.collection("exercices").update(exercice.id, { status: "rejected", rejection_reason: rejectionReason.trim() });

      toast({
        title: "Exercice refusé",
        description: "L'exercice a été refusé avec le motif indiqué.",
      });
      setShowRejectForm(false);
      setRejectionReason("");
      onUpdate();
    } catch (error) {
      console.error("Error rejecting exercice:", error);
      toast({
        title: "Erreur",
        description: "Impossible de refuser l'exercice.",
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
      await pb.collection("exercices").delete(exercice.id);

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
        const feat = await pb.collection("featured_exercices").getFullList({ filter: `exercice = "${exercice.id}"` });
        for (const f of feat) await pb.collection("featured_exercices").delete(f.id);

        toast({ title: "Exercice retiré de la plateforme" });
      } else {
        // Add to featured
        await pb.collection("featured_exercices").create({
          exercice: exercice.id,
          added_by: user?.id || "",
        });

        toast({ title: "Exercice ajouté à la plateforme" });
      }
      onOpenChange(false);
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
      case "rejected":
        return <Badge className="bg-red-500">Refusé</Badge>;
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

          {/* Rejection Reason Display */}
          {exercice.status === "rejected" && exercice.rejection_reason && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <h4 className="font-semibold text-red-700 dark:text-red-300 mb-1 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Motif de refus
              </h4>
              <p className="text-red-600 dark:text-red-400 text-sm">
                {exercice.rejection_reason}
              </p>
            </div>
          )}

          {/* Media Preview (image or video) */}
          {exercice.media_type === "image" && exercice.image_url ? (
            <div className="rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              <img
                src={exercice.image_url}
                alt={exercice.title}
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>
          ) : exercice.video_url ? (
            <div className="rounded-lg overflow-hidden bg-muted aspect-video">
              <video
                src={exercice.video_url}
                controls
                className="w-full h-full object-cover"
                poster={exercice.thumbnail_url || undefined}
              />
            </div>
          ) : null}

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

          {/* Reject Form */}
          {showRejectForm && (
            <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950 space-y-3">
              <h4 className="font-semibold text-red-700 dark:text-red-300">
                Motif du refus
              </h4>
              <Textarea
                placeholder="Expliquez pourquoi cet exercice est refusé..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px] bg-background"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={loading || !rejectionReason.trim()}
                  size="sm"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Confirmer le refus
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason("");
                  }}
                  disabled={loading}
                  size="sm"
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            {exercice.status !== "draft" && (
              <>
                <Button
                  variant={exercice.status === "shared" ? "outline" : "default"}
                  onClick={handleValidate}
                  disabled={loading}
                  className="gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  {exercice.status === "shared" ? "Invalider" : "Valider"}
                </Button>

                {exercice.status === "pending" && !showRejectForm && (
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectForm(true)}
                    disabled={loading}
                    className="gap-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    <XCircle className="w-4 h-4" />
                    Refuser
                  </Button>
                )}
              </>
            )}

            <Button
              variant={isFeatured ? "outline" : "secondary"}
              onClick={handleToggleFeatured}
              disabled={loading}
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
