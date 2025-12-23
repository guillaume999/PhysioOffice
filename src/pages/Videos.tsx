import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Video, Search, Play, X, MoreVertical, Pencil, Trash2, FileVideo, Dumbbell, Calendar, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface ExerciceWithVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  author_name: string | null;
}

interface VideoSize {
  [key: string]: string;
}

type DeleteMode = 'video-only' | 'video-and-exercises' | 'video-and-seances';

export default function Videos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = useState<ExerciceWithVideo[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<ExerciceWithVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [videoToPlay, setVideoToPlay] = useState<string | null>(null);
  const [videoSizes, setVideoSizes] = useState<VideoSize>({});
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; video: ExerciceWithVideo | null; mode: DeleteMode }>({ open: false, video: null, mode: 'video-only' });
  const [deleting, setDeleting] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; video: ExerciceWithVideo | null }>({ open: false, video: null });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredVideos(videos);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredVideos(
        videos.filter(
          (v) =>
            v.title.toLowerCase().includes(query) ||
            v.description?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, videos]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("exercices")
        .select("id, title, description, video_url, thumbnail_url, author_name")
        .eq("user_id", user?.id)
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const videoData = (data || []) as ExerciceWithVideo[];
      setVideos(videoData);

      // Fetch video sizes
      videoData.forEach((video) => {
        fetchVideoSize(video.id, video.video_url);
      });
    } catch (error) {
      console.error("Erreur lors du chargement des vidéos:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVideoSize = async (videoId: string, url: string) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength, 10);
        const sizeFormatted = formatFileSize(sizeInBytes);
        setVideoSizes((prev) => ({ ...prev, [videoId]: sizeFormatted }));
      }
    } catch {
      // Silently fail for size fetch
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStoragePathFromUrl = (url: string): string | null => {
    try {
      const urlParts = url.split('/videos/');
      return urlParts[1] || null;
    } catch {
      return null;
    }
  };

  const handleDeleteVideo = async () => {
    if (!deleteDialog.video) return;

    setDeleting(true);
    try {
      const video = deleteDialog.video;
      const videoUrl = video.video_url;

      // Get all exercises using this video
      const { data: exercicesWithVideo } = await supabase
        .from("exercices")
        .select("id")
        .eq("user_id", user?.id)
        .eq("video_url", videoUrl);

      const exerciceIds = exercicesWithVideo?.map((e) => e.id) || [];

      if (deleteDialog.mode === 'video-and-seances') {
        // Delete seance_exercices linked to these exercices
        if (exerciceIds.length > 0) {
          const { error: seError } = await supabase
            .from("seance_exercices")
            .delete()
            .in("exercice_id", exerciceIds);

          if (seError) throw seError;
        }

        // Clear video_url from all exercises
        const { error: clearError } = await supabase
          .from("exercices")
          .update({ video_url: null, thumbnail_url: null })
          .eq("user_id", user?.id)
          .eq("video_url", videoUrl);

        if (clearError) throw clearError;
      } else if (deleteDialog.mode === 'video-and-exercises') {
        // Delete all exercises using this video
        const { error: exError } = await supabase
          .from("exercices")
          .delete()
          .eq("user_id", user?.id)
          .eq("video_url", videoUrl);

        if (exError) throw exError;
      } else {
        // video-only: just clear video_url from all exercises using it
        const { error: clearError } = await supabase
          .from("exercices")
          .update({ video_url: null, thumbnail_url: null })
          .eq("user_id", user?.id)
          .eq("video_url", videoUrl);

        if (clearError) throw clearError;
      }

      // Delete video from storage
      const storagePath = getStoragePathFromUrl(videoUrl);
      if (storagePath) {
        await supabase.storage.from('videos').remove([storagePath]);
      }

      toast({
        title: "Suppression réussie",
        description: deleteDialog.mode === 'video-only'
          ? "La vidéo a été supprimée et retirée des exercices"
          : deleteDialog.mode === 'video-and-exercises'
          ? "La vidéo et tous les exercices associés ont été supprimés"
          : "La vidéo, ses liens dans les séances et exercices ont été supprimés",
      });

      fetchVideos();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la suppression",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialog({ open: false, video: null, mode: 'video-only' });
    }
  };

  const handleReplaceVideo = async (file: File) => {
    if (!editDialog.video || !user) return;

    setUploading(true);
    try {
      const oldVideoUrl = editDialog.video.video_url;

      // Upload new video
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      const newVideoUrl = urlData.publicUrl;

      // Update all exercises using the old video URL
      const { error: updateError } = await supabase
        .from("exercices")
        .update({ video_url: newVideoUrl, thumbnail_url: null })
        .eq("user_id", user.id)
        .eq("video_url", oldVideoUrl);

      if (updateError) throw updateError;

      // Delete old video from storage
      const oldPath = getStoragePathFromUrl(oldVideoUrl);
      if (oldPath) {
        await supabase.storage.from('videos').remove([oldPath]);
      }

      toast({
        title: "Vidéo modifiée",
        description: "La nouvelle vidéo a été appliquée à tous les exercices concernés",
      });

      setEditDialog({ open: false, video: null });
      fetchVideos();
    } catch (error) {
      console.error("Erreur lors du remplacement:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors du remplacement de la vidéo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleReplaceVideo(file);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">
            Veuillez vous connecter pour accéder à vos vidéos.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10">
                  <Video className="w-6 h-6 text-purple-500" />
                </div>
                <CardTitle className="text-2xl font-display">
                  Ma Vidéothèque
                </CardTitle>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une vidéo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-video bg-muted rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="text-center py-12">
                <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Aucune vidéo ne correspond à votre recherche"
                    : "Aucune vidéo dans votre bibliothèque"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Ajoutez des vidéos à vos exercices pour les retrouver ici
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredVideos.map((video) => (
                  <div
                    key={video.id}
                    className="group relative aspect-video rounded-xl overflow-hidden bg-muted"
                  >
                    <div
                      className="w-full h-full cursor-pointer"
                      onClick={() => setVideoToPlay(video.video_url)}
                    >
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={video.video_url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      )}

                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-7 h-7 text-white fill-white" />
                        </div>
                      </div>
                    </div>

                    {/* Size badge */}
                    {videoSizes[video.id] && (
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-xs flex items-center gap-1">
                        <FileVideo className="w-3 h-3" />
                        {videoSizes[video.id]}
                      </div>
                    )}

                    {/* Actions dropdown */}
                    <div className="absolute top-2 right-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditDialog({ open: true, video })}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier la vidéo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, video, mode: 'video-only' })}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer la vidéo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, video, mode: 'video-and-exercises' })}
                          >
                            <Dumbbell className="w-4 h-4 mr-2" />
                            Supprimer vidéo + exercices
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, video, mode: 'video-and-seances' })}
                          >
                            <Calendar className="w-4 h-4 mr-2" />
                            Supprimer vidéo + séances
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Title overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="text-white font-medium text-sm truncate">
                        {video.title}
                      </p>
                      {video.author_name && (
                        <p className="text-white/70 text-xs truncate">
                          Par {video.author_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Video Player Dialog */}
        <Dialog open={!!videoToPlay} onOpenChange={(open) => !open && setVideoToPlay(null)}>
          <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-black border-none">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
              onClick={() => setVideoToPlay(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            {videoToPlay && (
              <video
                src={videoToPlay}
                controls
                autoPlay
                className="w-full h-auto max-h-[80vh]"
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Video Dialog */}
        <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, video: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier la vidéo</DialogTitle>
              <DialogDescription>
                Choisissez une nouvelle vidéo pour remplacer "{editDialog.video?.title}". 
                Tous les exercices utilisant cette vidéo seront mis à jour.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Choisir une nouvelle vidéo
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, video: null, mode: 'video-only' })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {deleteDialog.mode === 'video-only' && "Supprimer la vidéo"}
                {deleteDialog.mode === 'video-and-exercises' && "Supprimer vidéo + exercices"}
                {deleteDialog.mode === 'video-and-seances' && "Supprimer vidéo + séances"}
              </DialogTitle>
              <DialogDescription>
                {deleteDialog.mode === 'video-only' && "La vidéo sera supprimée du stockage et retirée de tous les exercices qui l'utilisent."}
                {deleteDialog.mode === 'video-and-exercises' && "La vidéo sera supprimée ainsi que tous les exercices qui l'utilisent. Cette action est irréversible."}
                {deleteDialog.mode === 'video-and-seances' && "La vidéo sera supprimée, retirée des exercices, et les références dans les séances seront supprimées."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog({ open: false, video: null, mode: 'video-only' })} disabled={deleting}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDeleteVideo} disabled={deleting}>
                {deleting ? "Suppression..." : "Confirmer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
