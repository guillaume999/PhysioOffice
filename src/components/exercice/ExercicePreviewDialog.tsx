import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Image as ImageIcon, CopyPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";

export interface ExercicePreview {
  id?: string;
  code?: string;
  title: string;
  description?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  image_url?: string | null;
  media_type?: string | null;
  pathologie_tags?: string[];
  objectif_tags?: string[];
  author_name?: string | null;
  user_id?: string | null;
  // Séance metrics
  series?: number | null;
  repetitions?: number | null;
  duration_seconds?: number | null;
  force_1?: number | null;
  duration_seconds_2?: number | null;
  force_2?: number | null;
  comment?: string | null;
}

interface ExercicePreviewDialogProps {
  exercice: ExercicePreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Si fourni, affiche un bouton « Copier vers une séance » qui appelle ce callback.
  onCopyToSeance?: (exercice: ExercicePreview) => void;
}

export function ExercicePreviewDialog({ exercice, open, onOpenChange, onCopyToSeance }: ExercicePreviewDialogProps) {
  const { user } = useAuth();

  if (!exercice) return null;

  const isImage = exercice.media_type === "image";
  const hasMedia = isImage ? !!exercice.image_url : !!exercice.video_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {exercice.code && (
              <Badge variant="outline" className="font-mono text-xs uppercase px-1.5 py-0.5 bg-muted/50">
                {exercice.code}
              </Badge>
            )}
            {exercice.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Media */}
          {hasMedia && (
            isImage && exercice.image_url ? (
              <div className="rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <img
                  src={exercice.image_url}
                  alt={exercice.title}
                  className="max-h-[55vh] w-auto object-contain"
                />
              </div>
            ) : exercice.video_url ? (
              <div className="rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  src={exercice.video_url}
                  controls
                  className="w-full h-full"
                  poster={exercice.thumbnail_url || undefined}
                />
              </div>
            ) : null
          )}

          {/* No media placeholder */}
          {!hasMedia && (
            <div className="rounded-lg bg-muted/40 border border-dashed border-border flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              {isImage ? <ImageIcon className="w-8 h-8" /> : <Play className="w-8 h-8" />}
              <span className="text-sm">Aucun média</span>
            </div>
          )}

          {/* Séance metrics */}
          {(exercice.series != null || exercice.repetitions != null || exercice.duration_seconds != null || exercice.force_1 != null || exercice.duration_seconds_2 != null || exercice.force_2 != null) && (
            <div className="flex flex-wrap gap-2">
              {exercice.series != null && (
                <div className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-full">
                  <span className="text-base font-bold">{exercice.series}</span>
                  <span className="text-sm">série{exercice.series > 1 ? "s" : ""}</span>
                </div>
              )}
              {exercice.repetitions != null && (
                <div className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full">
                  <span className="text-base font-bold">{exercice.repetitions}</span>
                  <span className="text-sm">répétitions</span>
                </div>
              )}
              {exercice.duration_seconds != null && (
                <div className="inline-flex items-center gap-1 bg-accent text-accent-foreground px-3 py-1.5 rounded-full">
                  <span className="text-base font-bold">{exercice.duration_seconds}</span>
                  <span className="text-sm">secondes</span>
                </div>
              )}
              {exercice.force_1 != null && (
                <div className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-3 py-1.5 rounded-full">
                  <span className="text-base font-bold">{exercice.force_1}</span>
                  <span className="text-sm">force</span>
                </div>
              )}
              {exercice.duration_seconds_2 != null && (
                <div className="inline-flex items-center gap-1 bg-accent text-accent-foreground px-3 py-1.5 rounded-full">
                  <span className="text-base font-bold">{exercice.duration_seconds_2}</span>
                  <span className="text-sm">sec (2)</span>
                </div>
              )}
              {exercice.force_2 != null && (
                <div className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-3 py-1.5 rounded-full">
                  <span className="text-base font-bold">{exercice.force_2}</span>
                  <span className="text-sm">force 2</span>
                </div>
              )}
            </div>
          )}

          {/* Comment */}
          {exercice.comment && (
            <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground italic">
              {exercice.comment}
            </div>
          )}

          {/* Description */}
          {exercice.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{exercice.description}</p>
          )}

          {/* Tags */}
          {exercice.pathologie_tags && exercice.pathologie_tags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pathologies</p>
              <div className="flex flex-wrap gap-1.5">
                {exercice.pathologie_tags.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {exercice.objectif_tags && exercice.objectif_tags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Objectifs</p>
              <div className="flex flex-wrap gap-1.5">
                {exercice.objectif_tags.map((tag) => (
                  <Badge key={tag} variant="default">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Author */}
          {(exercice.author_name || exercice.user_id) && (
            <p className="text-xs text-muted-foreground">
              Par {exercice.user_id && exercice.user_id === user?.id ? "moi" : (exercice.author_name || "")}
            </p>
          )}
        </div>

        {onCopyToSeance && (
          <DialogFooter>
            <Button onClick={() => onCopyToSeance(exercice)} className="gap-2">
              <CopyPlus className="w-4 h-4" />
              Copier vers une séance
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
