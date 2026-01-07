import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Upload, Video, Loader2, X, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Exercice {
  id: string;
  code: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
}

interface AddExerciceToSeanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seanceTypeId: string;
  currentExercicesCount: number;
  onSuccess: () => void;
}

export function AddExerciceToSeanceDialog({
  open,
  onOpenChange,
  seanceTypeId,
  currentExercicesCount,
  onSuccess,
}: AddExerciceToSeanceDialogProps) {
  const { user } = useAuth();
  const [availableExercices, setAvailableExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [userPseudo, setUserPseudo] = useState<string | null>(null);

  // Form state
  const [exerciceId, setExerciceId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [series, setSeries] = useState<number | null>(3);
  const [repetitions, setRepetitions] = useState<number | null>(10);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [force1, setForce1] = useState<number | null>(null);
  const [durationSeconds2, setDurationSeconds2] = useState<number | null>(null);
  const [force2, setForce2] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open && user) {
      fetchData();
      resetForm();
    }
  }, [open, user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch user pseudo
    const { data: profileData } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("user_id", user.id)
      .maybeSingle();
    setUserPseudo(profileData?.pseudo || null);

    // Fetch exercices (user's own exercices)
    const { data: exData } = await supabase
      .from("exercices")
      .select("id, code, title, description, video_url, thumbnail_url")
      .eq("user_id", user.id)
      .order("title");
    setAvailableExercices(exData || []);

    setLoading(false);
  };

  const resetForm = () => {
    setExerciceId(null);
    setName("");
    setDescription("");
    setVideoUrl(null);
    setSeries(null);
    setRepetitions(10);
    setDurationSeconds(null);
    setForce1(null);
    setDurationSeconds2(null);
    setForce2(null);
    setComment("");
  };

  const handleExerciceSelect = (value: string) => {
    if (value === "custom") {
      setExerciceId(null);
      setName("");
      setDescription("");
      setVideoUrl(null);
    } else {
      const selectedEx = availableExercices.find((e) => e.id === value);
      if (selectedEx) {
        setExerciceId(selectedEx.id);
        setName(selectedEx.title);
        setDescription(selectedEx.description || "");
        setVideoUrl(selectedEx.video_url);
      }
    }
  };

  const handleVideoUpload = async (file: File) => {
    if (!user) return;

    setUploadingVideo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("exercice-videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("exercice-videos").getPublicUrl(fileName);

      // Also add to video library for sync
      const { error: videoError } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          title: name.trim() || file.name.replace(/\.[^/.]+$/, ""),
          video_url: publicUrl,
          name: file.name,
          thumbnail_url: null
        });

      if (videoError) {
        console.error("Error adding to video library:", videoError);
      }

      setVideoUrl(publicUrl);
      toast.success("Vidéo uploadée avec succès");
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error("Erreur lors de l'upload de la vidéo");
    } finally {
      setUploadingVideo(false);
    }
  };

  const removeVideo = () => {
    setVideoUrl(null);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Le nom de l'exercice est requis");
      return;
    }

    setSaving(true);
    try {
      let finalExerciceId = exerciceId;

      // If it's a custom exercice (no exercice_id), create it in the exercices table
      if (!finalExerciceId && name.trim()) {
        const { data: newExercice, error: exerciceError } = await supabase
          .from("exercices")
          .insert({
            user_id: user.id,
            title: name.trim(),
            description: description.trim() || null,
            status: "draft",
            pathologie_tags: [],
            video_url: videoUrl || null,
            author_name: userPseudo,
          })
          .select()
          .single();

        if (exerciceError) {
          console.error("Error creating exercice:", exerciceError);
          throw exerciceError;
        }
        finalExerciceId = newExercice.id;
      }

      // Add to seance_exercices
      const { error } = await supabase.from("seance_exercices").insert({
        seance_type_id: seanceTypeId,
        exercice_id: finalExerciceId,
        name: name.trim(),
        description: description.trim() || null,
        series: series,
        repetitions: repetitions,
        duration_seconds: durationSeconds,
        force_1: force1,
        duration_seconds_2: durationSeconds2,
        force_2: force2,
        comment: comment.trim() || null,
        ordre: currentExercicesCount + 1,
      });

      if (error) throw error;

      toast.success("Exercice ajouté");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error adding exercise:", error);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un exercice</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Select existing or custom */}
            <div>
              <Label className="text-xs">Exercice existant</Label>
              <Select
                value={exerciceId || "custom"}
                onValueChange={handleExerciceSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner ou créer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Personnalisé</SelectItem>
                  {availableExercices.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="font-mono text-xs uppercase text-muted-foreground mr-2">
                        {e.code}
                      </span>
                      {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div>
              <Label className="text-xs">Nom</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom de l'exercice"
                disabled={!!exerciceId}
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description optionnelle"
              />
            </div>

            {/* Video section */}
            <div className="space-y-2">
              <Label className="text-xs">Vidéo</Label>
              {videoUrl ? (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Video className="w-4 h-4 text-primary" />
                  <span className="text-sm flex-1 truncate">Vidéo ajoutée</span>
                  {!exerciceId && (
                    <>
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
                    </>
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
              ) : (
                <div>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingVideo || !!exerciceId}
                    className="gap-2"
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
                </div>
              )}
            </div>

            {/* Metrics - Row 1 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Séries</Label>
                <Input
                  type="number"
                  min={0}
                  value={series ?? ""}
                  onChange={(e) =>
                    setSeries(e.target.value ? parseInt(e.target.value) : null)
                  }
                  className="h-10"
                  placeholder="—"
                />
              </div>
              <div>
                <Label className="text-xs">Répétitions</Label>
                <Input
                  type="number"
                  min={0}
                  value={repetitions || ""}
                  onChange={(e) =>
                    setRepetitions(e.target.value ? parseInt(e.target.value) : null)
                  }
                  className="h-10"
                  placeholder="—"
                />
              </div>
              <div>
                <Label className="text-xs">Durée (sec)</Label>
                <Input
                  type="number"
                  min={0}
                  value={durationSeconds || ""}
                  onChange={(e) =>
                    setDurationSeconds(
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  className="h-10"
                  placeholder="—"
                />
              </div>
            </div>

            {/* Metrics - Row 2 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Force</Label>
                <Input
                  type="number"
                  min={0}
                  value={force1 ?? ""}
                  onChange={(e) =>
                    setForce1(e.target.value ? parseInt(e.target.value) : null)
                  }
                  className="h-10"
                  placeholder="—"
                />
              </div>
              <div>
                <Label className="text-xs">Durée 2 (sec)</Label>
                <Input
                  type="number"
                  min={0}
                  value={durationSeconds2 ?? ""}
                  onChange={(e) =>
                    setDurationSeconds2(e.target.value ? parseInt(e.target.value) : null)
                  }
                  className="h-10"
                  placeholder="—"
                />
              </div>
              <div>
                <Label className="text-xs">Force 2</Label>
                <Input
                  type="number"
                  min={0}
                  value={force2 ?? ""}
                  onChange={(e) =>
                    setForce2(e.target.value ? parseInt(e.target.value) : null)
                  }
                  className="h-10"
                  placeholder="—"
                />
              </div>
            </div>

            {/* Comment */}
            <div>
              <Label className="text-xs">Commentaire</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[60px]"
                placeholder="Commentaire optionnel..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={saving || !name.trim()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
