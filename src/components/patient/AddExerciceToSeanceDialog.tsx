import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Upload, Video, Loader2, X, Pencil, Library, Search } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { SearchableExerciceTitleInput } from "./SearchableExerciceTitleInput";
import { PathologySearchInput } from "./PathologySearchInput";

interface VideoLibraryItem {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
}

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
  patientName?: string;
}

export function AddExerciceToSeanceDialog({
  open,
  onOpenChange,
  seanceTypeId,
  currentExercicesCount,
  onSuccess,
  patientName,
}: AddExerciceToSeanceDialogProps) {
  const { user } = useAuth();
  const [availableExercices, setAvailableExercices] = useState<Exercice[]>([]);
  const [availablePathologies, setAvailablePathologies] = useState<string[]>([]);
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
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [series, setSeries] = useState<number | null>(3);
  const [repetitions, setRepetitions] = useState<number | null>(10);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [force1, setForce1] = useState<number | null>(null);
  const [durationSeconds2, setDurationSeconds2] = useState<number | null>(null);
  const [force2, setForce2] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [pathologieTags, setPathologieTags] = useState<string[]>([]);

  // Video library state
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [libraryVideos, setLibraryVideos] = useState<VideoLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");

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
    setUserPseudo(pb.authStore.record?.pseudo || pb.authStore.record?.name || pb.authStore.record?.email || null);

    // Fetch exercices (user's own exercices)
    const exData = await pb.collection("exercices").getFullList({ filter: `user = "${user.id}"`, sort: "title", fields: "id,code,title,description,video_url,thumbnail_url" });
    setAvailableExercices(exData as unknown as Exercice[]);

    // Fetch pathologies for search
    const pathoData = await pb.collection("pathologies").getFullList({ filter: `user = "${user.id}"`, fields: "name" });
    setAvailablePathologies([...new Set(pathoData.map((p: any) => p.name as string))]);

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
    setPathologieTags([]);
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

  // Generate thumbnail from video file
  const generateThumbnailFromFile = (videoFile: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      const cleanup = () => {
        URL.revokeObjectURL(video.src);
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 10000);

      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 180;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            clearTimeout(timeout);
            cleanup();
            resolve(null);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          clearTimeout(timeout);
          cleanup();
          resolve(dataUrl);
        } catch {
          clearTimeout(timeout);
          cleanup();
          resolve(null);
        }
      };

      video.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        resolve(null);
      };

      video.src = URL.createObjectURL(videoFile);
    });
  };

  // Upload thumbnail to storage
  const uploadThumbnailToStorage = async (thumbnailDataUrl: string): Promise<string | null> => {
    if (!user) return null;
    
    try {
      const response = await fetch(thumbnailDataUrl);
      const blob = await response.blob();
      
      const objectName = `${user.id}/thumbnails/${Date.now()}.jpg`;
      
      const fd = new FormData();
      fd.append("file", blob, "thumbnail.jpg");
      fd.append("user", user.id);
      const rec = await pb.collection("video_thumbnails").create(fd);
      return pb.files.getURL(rec, rec.file as string);
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      return null;
    }
  };

  const handleVideoUpload = async (file: File) => {
    if (!user) return;

    setUploadingVideo(true);
    try {
      // Generate thumbnail first
      const thumbnailDataUrl = await generateThumbnailFromFile(file);
      let generatedThumbnailUrl: string | null = null;
      
      if (thumbnailDataUrl) {
        generatedThumbnailUrl = await uploadThumbnailToStorage(thumbnailDataUrl);
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const vfd = new FormData();
      vfd.append("file", file);
      vfd.append("user", user.id);
      const vRec = await pb.collection("exercice_videos").create(vfd);
      const publicUrl = pb.files.getURL(vRec, vRec.file as string);

      // Also add to video library for sync
      try {
        await pb.collection("videos").create({
          user: user.id,
          title: name.trim() || file.name.replace(/\.[^/.]+$/, ""),
          video_url: publicUrl,
          name: file.name,
          thumbnail_url: generatedThumbnailUrl,
        });
      } catch(e) { console.error("Video library error:", e); }


      setVideoUrl(publicUrl);
      setThumbnailUrl(generatedThumbnailUrl);
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
    setThumbnailUrl(null);
  };

  // Video library functions
  const fetchLibraryVideos = async () => {
    if (!user) return;
    setLibraryLoading(true);
    try {
      const data = await pb.collection("videos").getFullList({ filter: `user = "${user.id}"`, sort: "-created", fields: "id,title,video_url,thumbnail_url" });
      setLibraryVideos(data as unknown as VideoLibraryItem[]);
    } catch (error) {
      console.error("Error fetching library videos:", error);
      toast.error("Erreur lors du chargement de la vidéothèque");
    } finally {
      setLibraryLoading(false);
    }
  };

  const openLibraryDialog = () => {
    fetchLibraryVideos();
    setLibrarySearch("");
    setLibraryDialogOpen(true);
  };

  const selectLibraryVideo = (video: VideoLibraryItem) => {
    setVideoUrl(video.video_url);
    setThumbnailUrl(video.thumbnail_url);
    setLibraryDialogOpen(false);
    toast.success(`Vidéo "${video.title}" sélectionnée`);
  };

  const filteredLibraryVideos = librarySearch.trim()
    ? libraryVideos.filter(v => v.title.toLowerCase().includes(librarySearch.toLowerCase()))
    : libraryVideos;

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
        // Persist any new pathologies to the user's library
        for (const patho of pathologieTags) {
          if (!availablePathologies.includes(patho)) {
            await pb.collection("pathologies").create({ user: user.id, name: patho });
          }
        }

        const newExercice = await pb.collection("exercices").create({
            user: user.id, title: name.trim(), description: description.trim() || null,
            status: "draft", pathologie_tags: pathologieTags,
            video_url: videoUrl || null, thumbnail_url: thumbnailUrl || null, author_name: userPseudo,
          });
        finalExerciceId = newExercice.id;
      }

      // Add to seance_exercices
      await pb.collection("seance_exercices").create({
        seance_type: seanceTypeId,
        exercice: finalExerciceId,
        name: name.trim(),
        description: description.trim() || null,
        series,
        repetitions,
        duration_seconds: durationSeconds,
        force_1: force1,
        duration_seconds_2: durationSeconds2,
        force_2: force2,
        comment: comment.trim() || null,
        ordre: currentExercicesCount + 1,
      });

      // Log activity
      try { await pb.collection("user_activity_logs").create({
        user: user.id,
        section: "seances",
        action_type: "edit",
        title: `Exercice "${name.trim()}" ajouté${patientName ? ` pour ${patientName}` : ""}`,
        details: patientName ? `Ajout de l'exercice à la séance du patient ${patientName}` : `Ajout de l'exercice à la séance`,
        resource_id: seanceTypeId,
        resource_type: "seance_type",
      }); } catch(e) {}

      toast.success("Exercice ajouté");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error adding exercise:", error);
      const message = (error as { message?: string })?.message || "";
      const code = (error as { code?: string })?.code || "";
      if (code === "42501" || message.includes("row-level security")) {
        toast.error("Limite d'exercices atteinte pour votre abonnement. Sélectionnez un exercice existant ou supprimez-en un.");
      } else {
        toast.error("Erreur lors de l'ajout");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
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
            {/* Name with searchable existing exercises */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Nom</Label>
                {exerciceId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      setExerciceId(null);
                      setName("");
                      setDescription("");
                      setVideoUrl(null);
                      setThumbnailUrl(null);
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Délier
                  </Button>
                )}
              </div>
              <SearchableExerciceTitleInput
                value={name}
                onChange={(v) => {
                  setName(v);
                  if (exerciceId) setExerciceId(null);
                }}
                onSelectExercice={(ex) => {
                  setExerciceId(ex.id);
                  setName(ex.title);
                  setDescription(ex.description || "");
                  setVideoUrl(ex.video_url || null);
                  setThumbnailUrl(ex.thumbnail_url || null);
                }}
                options={availableExercices}
                disabled={!!exerciceId}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Tapez librement ou utilisez la loupe pour rechercher dans vos exercices.
              </p>
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

            {/* Pathologies */}
            {!exerciceId && (
              <div>
                <Label className="text-xs">Pathologies</Label>
                <PathologySearchInput
                  selected={pathologieTags}
                  onChange={setPathologieTags}
                  options={availablePathologies}
                />
              </div>
            )}

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
                <div className="flex gap-2">
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
                        Upload...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Uploader
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openLibraryDialog}
                    disabled={uploadingVideo || !!exerciceId}
                    className="gap-2"
                  >
                    <Library className="w-4 h-4" />
                    Vidéothèque
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

      {/* Video Library Dialog */}
      <Dialog open={libraryDialogOpen} onOpenChange={setLibraryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sélectionner depuis la vidéothèque</DialogTitle>
            <DialogDescription>
              Choisissez une vidéo de votre bibliothèque
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px]">
            {libraryLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredLibraryVideos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {librarySearch.trim() ? "Aucune vidéo trouvée" : "Aucune vidéo dans votre bibliothèque"}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 p-1">
                {filteredLibraryVideos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => selectLibraryVideo(video)}
                    className="group relative aspect-video rounded-md overflow-hidden border hover:border-primary transition-colors"
                  >
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-medium px-2 text-center line-clamp-2">
                        {video.title}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
