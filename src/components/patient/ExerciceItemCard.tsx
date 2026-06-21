import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Play, Edit, Check, X, Upload, Video, Loader2, Pencil, Trash2, MessageSquare, ChevronUp, ChevronDown, Library, Search } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { withActive } from "@/lib/corbeille";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { CommentDialog } from "./CommentDialog";
import { SearchableExerciceTitleInput, ExerciceOption } from "./SearchableExerciceTitleInput";
import { PathologySearchInput } from "./PathologySearchInput";
import { matchesSearch } from "@/lib/utils";

interface VideoLibraryItem {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
}

interface ExerciceItemCardProps {
  exercice: {
    id: string;
    name: string | null;
    description: string | null;
    repetitions: number | null;
    duration_seconds: number | null;
    series: number | null;
    force_1: number | null;
    duration_seconds_2: number | null;
    force_2: number | null;
    comment: string | null;
    ordre: number;
    exercice_id: string | null;
    exercice?: {
      id: string;
      title: string;
      description?: string | null;
      video_url: string | null;
      thumbnail_url: string | null;
      image_url?: string | null;
      media_type?: string | null;
      status?: string;
    } | null;
  };
  index: number;
  seanceTypeId: string;
  totalExercices: number;
  onUpdate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function ExerciceItemCard({ 
  exercice, 
  index, 
  seanceTypeId,
  totalExercices,
  onUpdate,
  onMoveUp,
  onMoveDown
}: ExerciceItemCardProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    series: exercice.series ?? null,
    repetitions: exercice.repetitions ?? null,
    duration_seconds: exercice.duration_seconds ?? null,
    force_1: exercice.force_1 ?? null,
    duration_seconds_2: exercice.duration_seconds_2 ?? null,
    force_2: exercice.force_2 ?? null,
    comment: exercice.comment ?? "",
    name: exercice.exercice?.title || exercice.name || "",
    description: exercice.exercice?.description || exercice.description || "",
    video_url: exercice.exercice?.video_url || null,
    thumbnail_url: exercice.exercice?.thumbnail_url || null,
  });
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Video library state
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [libraryVideos, setLibraryVideos] = useState<VideoLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");

  // Search state for existing exercises and pathologies
  const [availableExercices, setAvailableExercices] = useState<ExerciceOption[]>([]);
  const [availablePathologies, setAvailablePathologies] = useState<string[]>([]);
  const [pathologieTags, setPathologieTags] = useState<string[]>([]);

  useEffect(() => {
    if (!isEditing || !user) return;
    let cancelled = false;
    (async () => {
      const [exData, pathoData] = await Promise.all([
        pb.collection("exercices").getFullList({ filter: withActive(`user = "${user.id}"`), sort: "title", fields: "id,code,title,description,video_url,thumbnail_url,image_url,media_type,pathologie_tags" }),
        pb.collection("pathologies").getFullList({ filter: withActive(`user = "${user.id}"`), fields: "name" }),
      ]);
      if (cancelled) return;
      setAvailableExercices(exData as unknown as ExerciceOption[]);
      setAvailablePathologies([...new Set(pathoData.map((p: any) => p.name as string))]);
      // Pre-load existing pathology tags from the linked exercise
      if (exercice.exercice_id) {
        const linked = (exData as Array<{ id: string; pathologie_tags?: string[] | null }> | null)?.find(
          (e) => e.id === exercice.exercice_id
        );
        setPathologieTags(linked?.pathologie_tags || []);
      } else {
        setPathologieTags([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditing, user, exercice.exercice_id]);
  
  // Check if exercise is shared/platform (visible in exercise list)
  const isSharedOrPlatform = exercice.exercice?.status === "shared" || exercice.exercice?.status === "pending";
  const [isVisible, setIsVisible] = useState(isSharedOrPlatform);
  const [saving, setSaving] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Touch (sync forçage mount).
  const exerciceMediaType = exercice.exercice?.media_type;
  const exerciceImageUrl = exercice.exercice?.image_url || null;
  const isExerciceImage = exerciceMediaType === "image";
  const thumbnailUrl = isExerciceImage
    ? exerciceImageUrl
    : (editValues.thumbnail_url || exercice.exercice?.thumbnail_url || null);
  const videoUrl = editValues.video_url || exercice.exercice?.video_url || null;
  const exerciceName = editValues.name || exercice.exercice?.title || exercice.name || `Exercice ${index + 1}`;
  const hasVideo = thumbnailUrl || videoUrl || (isExerciceImage && exerciceImageUrl);

  // Original values for comparison
  const originalName = exercice.exercice?.title || exercice.name || "";
  const originalDescription = exercice.exercice?.description || exercice.description || "";
  const originalVideoUrl = exercice.exercice?.video_url || null;

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
      try { await pb.collection("videos").create({
          user: user.id,
          title: editValues.name || file.name,
          video_url: publicUrl,
          name: file.name,
          thumbnail_url: generatedThumbnailUrl,
        }); } catch(e) { console.error("Error adding to video library:", e); }

      setEditValues({ ...editValues, video_url: publicUrl, thumbnail_url: generatedThumbnailUrl });
      toast.success("Vidéo uploadée avec succès");
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error("Erreur lors de l'upload de la vidéo");
    } finally {
      setUploadingVideo(false);
    }
  };

  const removeVideo = () => {
    setEditValues({ ...editValues, video_url: null, thumbnail_url: null });
  };

  // Video library functions
  const fetchLibraryVideos = async () => {
    if (!user) return;
    setLibraryLoading(true);
    try {
      // Filtrer pour ne montrer que les vidéos dans ce contexte
      const data = await pb.collection("videos").getFullList({ filter: withActive(`user = "${user.id}" && (media_type = "video" || media_type = "" || media_type = null)`), sort: "-created", fields: "id,title,video_url,thumbnail_url" });
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
    setLibraryDialogOpen(true);
  };

  const selectLibraryVideo = (video: VideoLibraryItem) => {
    setEditValues({
      ...editValues,
      video_url: video.video_url,
      thumbnail_url: video.thumbnail_url,
    });
    setLibraryDialogOpen(false);
    toast.success(`Vidéo "${video.title}" sélectionnée`);
  };

  const filteredLibraryVideos = librarySearch.trim()
    ? libraryVideos.filter(v => matchesSearch(v.title, librarySearch))
    : libraryVideos;

  const handleSaveMetrics = async () => {
    setSaving(true);
    try {
      // Check if name, description, or video were modified
      const nameChanged = editValues.name !== originalName;
      const descriptionChanged = editValues.description !== originalDescription;
      const videoChanged = editValues.video_url !== originalVideoUrl;
      const contentModified = nameChanged || descriptionChanged || videoChanged;

      // Update seance_exercices
      await pb.collection("seance_exercices").update(exercice.id, {
          series: editValues.series,
          repetitions: editValues.repetitions,
          duration_seconds: editValues.duration_seconds,
          force_1: editValues.force_1,
          duration_seconds_2: editValues.duration_seconds_2,
          force_2: editValues.force_2,
          comment: editValues.comment || null,
          name: editValues.name,
          description: editValues.description,
        });

      // If there's a linked exercise and content was modified, update it
      if (exercice.exercice_id && (contentModified || pathologieTags.length >= 0)) {
        const updateData: any = {
          title: editValues.name,
          description: editValues.description || null,
          pathologie_tags: pathologieTags,
        };
        
        if (videoChanged) {
          updateData.video_url = editValues.video_url;
          updateData.thumbnail_url = editValues.thumbnail_url;
        }
        
        // Reset status to draft only when actual content changed (not just pathology tags)
        if (contentModified) {
          updateData.status = "draft";
        }
        
        try {
          await pb.collection("exercices").update(exercice.exercice_id!, updateData);
          if (contentModified) {
          setIsVisible(false);
          }
        } catch(e) { console.error("Error updating exercise:", e); }
      }

      // Persist any newly-typed pathologies to the user's library
      for (const patho of pathologieTags) {
        if (!availablePathologies.includes(patho)) {
          await pb.collection("pathologies").create({ user: user!.id, name: patho });
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
      force_1: exercice.force_1 ?? null,
      duration_seconds_2: exercice.duration_seconds_2 ?? null,
      force_2: exercice.force_2 ?? null,
      comment: exercice.comment ?? "",
      name: exercice.exercice?.title || exercice.name || "",
      description: exercice.exercice?.description || exercice.description || "",
      video_url: exercice.exercice?.video_url || null,
      thumbnail_url: exercice.exercice?.thumbnail_url || null,
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
      
      await pb.collection("exercices").update(exercice.exercice_id!, { status: newStatus });
      
      setIsVisible(newVisibility);
      toast.success(newVisibility ? "Exercice visible dans la liste" : "Exercice masqué de la liste");
    } catch (error) {
      console.error("Error toggling visibility:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await pb.collection("seance_exercices").delete(exercice.id);

      toast.success("Exercice supprimé");
      setDeleteDialogOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error deleting exercise:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveExerciceComment = async (newComment: string) => {
    setSaving(true);
    try {
      await pb.collection("seance_exercices").update(exercice.id, { comment: newComment || null });

      setEditValues({ ...editValues, comment: newComment });
      toast.success("Commentaire enregistré");
      setCommentDialogOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error saving comment:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Thumbnail with media (image or video) - full width */}
      {hasVideo && !isEditing && (
        <div className="relative w-full aspect-video bg-muted">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={exerciceName}
              className={`w-full h-full ${isExerciceImage ? "object-contain bg-black/5" : "object-cover"}`}
            />
          ) : videoUrl ? (
            <video
              src={videoUrl}
              className="w-full h-full object-cover"
              muted
            />
          ) : null}
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors cursor-pointer"
            onClick={() => (isExerciceImage ? exerciceImageUrl : videoUrl) && setVideoModalOpen(true)}
          >
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
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Reorder buttons */}
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-8 rounded-b-none"
                  onClick={onMoveUp}
                  disabled={index === 0}
                  title="Monter"
                >
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-8 rounded-t-none"
                  onClick={onMoveDown}
                  disabled={index === totalExercices - 1}
                  title="Descendre"
                >
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Metrics display or edit mode */}
        {isEditing ? (
          <div className="space-y-3 bg-muted/50 p-3 rounded-lg">
            {/* Title */}
            <div>
              <Label className="text-xs">Titre</Label>
              <SearchableExerciceTitleInput
                value={editValues.name}
                onChange={(v) => setEditValues({ ...editValues, name: v })}
                onSelectExercice={(ex) => {
                  setEditValues({
                    ...editValues,
                    name: ex.title,
                    description: ex.description || "",
                    video_url: ex.video_url || null,
                    thumbnail_url: ex.thumbnail_url || null,
                  });
                }}
                options={availableExercices}
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

            {/* Pathologies */}
            <div>
              <Label className="text-xs">Pathologies</Label>
              <PathologySearchInput
                selected={pathologieTags}
                onChange={setPathologieTags}
                options={availablePathologies}
              />
            </div>

            {/* Video */}
            <div className="space-y-2">
              <Label className="text-xs">Vidéo</Label>
              {editValues.video_url ? (
                <div className="space-y-2">
                  <div className="relative aspect-video rounded overflow-hidden bg-muted">
                    {editValues.thumbnail_url ? (
                      <img 
                        src={editValues.thumbnail_url} 
                        alt="Vignette" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={editValues.video_url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingVideo}
                      className="flex-1"
                    >
                      {uploadingVideo ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-3 h-3 mr-1" />
                          Importer
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openLibraryDialog}
                      className="flex-1"
                    >
                      <Library className="w-3 h-3 mr-1" />
                      Vidéothèque
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={removeVideo}
                      className="text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingVideo}
                    className="flex-1 gap-1"
                  >
                    {uploadingVideo ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Upload...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3" />
                        Importer
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openLibraryDialog}
                    className="flex-1 gap-1"
                  >
                    <Library className="w-3 h-3" />
                    Vidéothèque
                  </Button>
                </div>
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

            {/* Metrics - Row 1 */}
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
            {/* Metrics - Row 2 */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Force</Label>
                <Input
                  type="number"
                  min={0}
                  value={editValues.force_1 ?? ""}
                  onChange={(e) => setEditValues({ ...editValues, force_1: e.target.value ? parseInt(e.target.value) : null })}
                  className="h-9 text-sm"
                  placeholder="—"
                />
              </div>
              <div>
                <Label className="text-xs">Durée 2 (s)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editValues.duration_seconds_2 ?? ""}
                  onChange={(e) => setEditValues({ ...editValues, duration_seconds_2: e.target.value ? parseInt(e.target.value) : null })}
                  className="h-9 text-sm"
                  placeholder="—"
                />
              </div>
              <div>
                <Label className="text-xs">Force 2</Label>
                <Input
                  type="number"
                  min={0}
                  value={editValues.force_2 ?? ""}
                  onChange={(e) => setEditValues({ ...editValues, force_2: e.target.value ? parseInt(e.target.value) : null })}
                  className="h-9 text-sm"
                  placeholder="—"
                />
              </div>
            </div>
            {/* Comment field */}
            <div>
              <Label className="text-xs">Commentaire</Label>
              <Textarea
                value={editValues.comment}
                onChange={(e) => setEditValues({ ...editValues, comment: e.target.value })}
                className="min-h-[60px] text-sm"
                placeholder="Commentaire optionnel..."
              />
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
            {exercice.repetitions != null && (
              <div className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                <span className="text-sm font-bold">{exercice.repetitions}</span>
                <span className="text-xs">reps</span>
              </div>
            )}
            {exercice.duration_seconds != null && (
              <div className="inline-flex items-center gap-1 bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                <span className="text-sm font-bold">{exercice.duration_seconds}</span>
                <span className="text-xs">sec</span>
              </div>
            )}
            {exercice.force_1 != null && (
              <div className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full">
                <span className="text-sm font-bold">{exercice.force_1}</span>
                <span className="text-xs">force</span>
              </div>
            )}
            {exercice.duration_seconds_2 != null && (
              <div className="inline-flex items-center gap-1 bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                <span className="text-sm font-bold">{exercice.duration_seconds_2}</span>
                <span className="text-xs">sec</span>
              </div>
            )}
            {exercice.force_2 != null && (
              <div className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full">
                <span className="text-sm font-bold">{exercice.force_2}</span>
                <span className="text-xs">force</span>
              </div>
            )}
          </div>
        )}

        {/* Comment display - clickable to open modal */}
        {!isEditing && (
          <button
            type="button"
            className={`w-full text-left text-xs rounded px-2 py-1.5 transition-colors ${
              exercice.comment 
                ? "text-muted-foreground italic bg-muted/50 hover:bg-muted cursor-pointer" 
                : "text-muted-foreground/60 hover:bg-muted/50 border border-dashed border-border cursor-pointer"
            }`}
            onClick={() => setCommentDialogOpen(true)}
          >
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3 flex-shrink-0" />
              {exercice.comment ? (
                <span className="line-clamp-2">{exercice.comment}</span>
              ) : (
                <span>Ajouter un commentaire...</span>
              )}
            </div>
          </button>
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

      {/* Media Modal (image or video) */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
          {isExerciceImage && exerciceImageUrl ? (
            <div className="relative w-full flex items-center justify-center">
              <img
                src={exerciceImageUrl}
                alt={exerciceName}
                className="max-h-[80vh] w-auto object-contain"
              />
            </div>
          ) : (
            <div className="relative w-full aspect-video">
              {videoUrl && (
                <video
                  src={videoUrl}
                  className="w-full h-full"
                  controls
                  autoPlay
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet exercice ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'exercice "{exerciceName}" sera retiré de cette séance. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Comment Dialog */}
      <CommentDialog
        open={commentDialogOpen}
        onOpenChange={setCommentDialogOpen}
        title="Commentaire de l'exercice"
        subtitle={exerciceName}
        comment={exercice.comment || ""}
        onSave={handleSaveExerciceComment}
        saving={saving}
      />

      {/* Video Library Dialog */}
      <Dialog open={libraryDialogOpen} onOpenChange={setLibraryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Choisir depuis la vidéothèque</DialogTitle>
            <DialogDescription>
              Sélectionnez une vidéo de votre vidéothèque
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une vidéo..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-[400px]">
              {libraryLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLibraryVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Video className="w-8 h-8 mb-2" />
                  <p className="text-sm">
                    {librarySearch ? "Aucune vidéo trouvée" : "Aucune vidéo dans votre vidéothèque"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredLibraryVideos.map((video) => (
                    <button
                      key={video.id}
                      type="button"
                      onClick={() => selectLibraryVideo(video)}
                      className="flex flex-col gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors text-left group"
                    >
                      <div className="relative aspect-video rounded overflow-hidden bg-muted">
                        {video.thumbnail_url ? (
                          <img 
                            src={video.thumbnail_url} 
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Check className="w-8 h-8 text-primary" />
                        </div>
                      </div>
                      <p className="text-sm font-medium line-clamp-2">{video.title}</p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
