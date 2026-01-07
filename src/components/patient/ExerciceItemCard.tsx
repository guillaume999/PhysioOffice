import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Play, Edit, Check, X, Upload, Video, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface ExerciceItemCardProps {
  exercice: {
    id: string;
    name: string | null;
    description: string | null;
    repetitions: number | null;
    duration_seconds: number | null;
    series: number | null;
    ordre: number;
    exercice_id: string | null;
    exercice?: {
      id: string;
      title: string;
      description?: string | null;
      video_url: string | null;
      thumbnail_url: string | null;
      status?: string;
    } | null;
  };
  index: number;
  seanceTypeId: string;
  onUpdate?: () => void;
}

export function ExerciceItemCard({ 
  exercice, 
  index, 
  seanceTypeId,
  onUpdate 
}: ExerciceItemCardProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    series: exercice.series ?? null,
    repetitions: exercice.repetitions ?? null,
    duration_seconds: exercice.duration_seconds ?? null,
    name: exercice.exercice?.title || exercice.name || "",
    description: exercice.exercice?.description || exercice.description || "",
    video_url: exercice.exercice?.video_url || null,
  });
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Check if exercise is shared/platform (visible in exercise list)
  const isSharedOrPlatform = exercice.exercice?.status === "shared" || exercice.exercice?.status === "pending";
  const [isVisible, setIsVisible] = useState(isSharedOrPlatform);
  const [saving, setSaving] = useState(false);

  const thumbnailUrl = exercice.exercice?.thumbnail_url || null;
  const videoUrl = editValues.video_url || exercice.exercice?.video_url || null;
  const exerciceName = editValues.name || exercice.exercice?.title || exercice.name || `Exercice ${index + 1}`;
  const hasVideo = thumbnailUrl || videoUrl;

  // Original values for comparison
  const originalName = exercice.exercice?.title || exercice.name || "";
  const originalDescription = exercice.exercice?.description || exercice.description || "";
  const originalVideoUrl = exercice.exercice?.video_url || null;

  const handleVideoUpload = async (file: File) => {
    if (!user) return;

    setUploadingVideo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("videos").getPublicUrl(fileName);

      setEditValues({ ...editValues, video_url: publicUrl });
      toast.success("Vidéo uploadée avec succès");
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error("Erreur lors de l'upload de la vidéo");
    } finally {
      setUploadingVideo(false);
    }
  };

  const removeVideo = () => {
    setEditValues({ ...editValues, video_url: null });
  };

  const handleSaveMetrics = async () => {
    setSaving(true);
    try {
      // Check if name, description, or video were modified
      const nameChanged = editValues.name !== originalName;
      const descriptionChanged = editValues.description !== originalDescription;
      const videoChanged = editValues.video_url !== originalVideoUrl;
      const contentModified = nameChanged || descriptionChanged || videoChanged;

      // Update seance_exercices
      const { error } = await supabase
        .from("seance_exercices")
        .update({
          series: editValues.series,
          repetitions: editValues.repetitions,
          duration_seconds: editValues.duration_seconds,
          name: editValues.name,
          description: editValues.description,
        })
        .eq("id", exercice.id);

      if (error) throw error;

      // If there's a linked exercise and content was modified, update it
      if (exercice.exercice_id && contentModified) {
        const updateData: any = {
          title: editValues.name,
          description: editValues.description || null,
        };
        
        if (videoChanged) {
          updateData.video_url = editValues.video_url;
        }
        
        // Set status to draft to hide from exercise list
        updateData.status = "draft";
        
        const { error: exerciceError } = await supabase
          .from("exercices")
          .update(updateData)
          .eq("id", exercice.exercice_id);

        if (exerciceError) {
          console.error("Error updating exercise:", exerciceError);
        } else {
          // Update local visibility state
          setIsVisible(false);
        }
      }
      
      toast.success("Exercice mis à jour");
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating exercise:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditValues({
      series: exercice.series ?? null,
      repetitions: exercice.repetitions ?? null,
      duration_seconds: exercice.duration_seconds ?? null,
      name: exercice.exercice?.title || exercice.name || "",
      description: exercice.exercice?.description || exercice.description || "",
      video_url: exercice.exercice?.video_url || null,
    });
    setIsEditing(false);
  };

  const handleToggleVisibility = async () => {
    if (!exercice.exercice_id) {
      toast.error("Cet exercice n'est pas lié à un exercice de la bibliothèque");
      return;
    }

    setSaving(true);
    try {
      const newVisibility = !isVisible;
      // Toggle between "draft" (hidden) and "shared" (visible in list)
      const newStatus = newVisibility ? "shared" : "draft";
      
      const { error } = await supabase
        .from("exercices")
        .update({ status: newStatus })
        .eq("id", exercice.exercice_id);

      if (error) throw error;
      
      setIsVisible(newVisibility);
      toast.success(newVisibility ? "Exercice visible dans la liste" : "Exercice masqué de la liste");
    } catch (error) {
      console.error("Error toggling visibility:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Thumbnail with video - full width */}
      {hasVideo && !isEditing && (
        <div className="relative w-full aspect-video bg-muted">
          {thumbnailUrl ? (
            <img 
              src={thumbnailUrl} 
              alt={exerciceName}
              className="w-full h-full object-cover"
            />
          ) : videoUrl ? (
            <video 
              src={videoUrl}
              className="w-full h-full object-cover"
              muted
            />
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="w-6 h-6 text-primary fill-primary ml-0.5" />
            </div>
          </div>
          {/* Order badge */}
          <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-md">
            {index + 1}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Header with name */}
        {!isEditing && (
          <div className="flex items-start gap-2">
            {!hasVideo && (
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                {index + 1}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">{exerciceName}</p>
              {(editValues.description || exercice.description) && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {editValues.description || exercice.description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Metrics display or edit mode */}
        {isEditing ? (
          <div className="space-y-3 bg-muted/50 p-3 rounded-lg">
            {/* Title */}
            <div>
              <Label className="text-xs">Titre</Label>
              <Input
                value={editValues.name}
                onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                className="h-9 text-sm"
                placeholder="Nom de l'exercice"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={editValues.description}
                onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                className="h-9 text-sm"
                placeholder="Description optionnelle"
              />
            </div>

            {/* Video */}
            <div className="space-y-2">
              <Label className="text-xs">Vidéo</Label>
              {editValues.video_url ? (
                <div className="flex items-center gap-2 p-2 bg-background rounded-md border">
                  <Video className="w-4 h-4 text-primary" />
                  <span className="text-sm flex-1 truncate">Vidéo ajoutée</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-6 px-2"
                    disabled={uploadingVideo}
                  >
                    {uploadingVideo ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Pencil className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeVideo}
                    className="h-6 px-2"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingVideo}
                  className="gap-2 w-full"
                >
                  {uploadingVideo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Upload en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Ajouter une vidéo
                    </>
                  )}
                </Button>
              )}
              <input
                type="file"
                accept="video/*"
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleVideoUpload(file);
                }}
                className="hidden"
              />
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Séries</Label>
                <Input
                  type="number"
                  min={0}
                  value={editValues.series ?? ""}
                  onChange={(e) => setEditValues({ ...editValues, series: e.target.value ? parseInt(e.target.value) : null })}
                  className="h-9 text-sm"
                  placeholder="—"
                />
              </div>
              <div>
                <Label className="text-xs">Reps</Label>
                <Input
                  type="number"
                  min={0}
                  value={editValues.repetitions ?? ""}
                  onChange={(e) => setEditValues({ ...editValues, repetitions: e.target.value ? parseInt(e.target.value) : null })}
                  className="h-9 text-sm"
                  placeholder="—"
                />
              </div>
              <div>
                <Label className="text-xs">Durée (s)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editValues.duration_seconds ?? ""}
                  onChange={(e) => setEditValues({ ...editValues, duration_seconds: e.target.value ? parseInt(e.target.value) : null })}
                  className="h-9 text-sm"
                  placeholder="—"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="flex-1 h-9"
                onClick={handleSaveMetrics}
                disabled={saving || uploadingVideo}
              >
                <Check className="w-4 h-4 mr-1" />
                Valider
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={handleCancelEdit}
                disabled={saving || uploadingVideo}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {exercice.series != null && (
              <div className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                <span className="text-sm font-bold">{exercice.series}</span>
                <span className="text-xs">série{exercice.series > 1 ? "s" : ""}</span>
              </div>
            )}
            {exercice.repetitions && (
              <div className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                <span className="text-sm font-bold">{exercice.repetitions}</span>
                <span className="text-xs">reps</span>
              </div>
            )}
            {exercice.duration_seconds && (
              <div className="inline-flex items-center gap-1 bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                <span className="text-sm font-bold">{exercice.duration_seconds}</span>
                <span className="text-xs">sec</span>
              </div>
            )}
          </div>
        )}

        {/* Separator */}
        <Separator />

        {/* Visibility toggle */}
        {exercice.exercice_id && (
          <div className="flex items-center justify-between">
            <Label 
              htmlFor={`ex-visibility-${exercice.id}`} 
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Visible dans "Mes exercices"
            </Label>
            <Switch
              id={`ex-visibility-${exercice.id}`}
              checked={isVisible}
              onCheckedChange={handleToggleVisibility}
              disabled={saving}
            />
          </div>
        )}
      </div>
    </div>
  );
}
