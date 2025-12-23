import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Video, Search, Play, X, MoreVertical, Pencil, Trash2, FileVideo, Dumbbell, Calendar } from "lucide-react";
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

export default function Videos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = useState<ExerciceWithVideo[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<ExerciceWithVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [videoToPlay, setVideoToPlay] = useState<string | null>(null);
  const [videoSizes, setVideoSizes] = useState<VideoSize>({});
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; video: ExerciceWithVideo | null; mode: 'video' | 'exercises' | 'seances' | 'all' }>({ open: false, video: null, mode: 'video' });
  const [deleting, setDeleting] = useState(false);

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

  const handleDeleteVideo = async () => {
    if (!deleteDialog.video) return;

    setDeleting(true);
    try {
      const video = deleteDialog.video;

      if (deleteDialog.mode === 'exercises' || deleteDialog.mode === 'all') {
        // Delete all exercises with this video_url
        const { error: exError } = await supabase
          .from("exercices")
          .delete()
          .eq("user_id", user?.id)
          .eq("video_url", video.video_url);

        if (exError) throw exError;
      }

      if (deleteDialog.mode === 'seances' || deleteDialog.mode === 'all') {
        // Get all exercice_ids with this video
        const { data: exercicesData } = await supabase
          .from("exercices")
          .select("id")
          .eq("user_id", user?.id)
          .eq("video_url", video.video_url);

        if (exercicesData && exercicesData.length > 0) {
          const exerciceIds = exercicesData.map((e) => e.id);

          // Delete seance_exercices linked to these exercices
          const { error: seError } = await supabase
            .from("seance_exercices")
            .delete()
            .in("exercice_id", exerciceIds);

          if (seError) throw seError;
        }
      }

      if (deleteDialog.mode === 'video') {
        // Just remove video_url from this exercice
        const { error: updateError } = await supabase
          .from("exercices")
          .update({ video_url: null, thumbnail_url: null })
          .eq("id", video.id);

        if (updateError) throw updateError;
      }

      // Delete from storage if needed
      if (deleteDialog.mode === 'exercises' || deleteDialog.mode === 'all') {
        try {
          const urlParts = video.video_url.split('/videos/');
          if (urlParts[1]) {
            await supabase.storage.from('videos').remove([urlParts[1]]);
          }
        } catch {
          // Storage deletion failed, continue anyway
        }
      }

      toast({
        title: "Suppression réussie",
        description: deleteDialog.mode === 'video' 
          ? "La vidéo a été retirée de l'exercice"
          : deleteDialog.mode === 'exercises'
          ? "Tous les exercices avec cette vidéo ont été supprimés"
          : deleteDialog.mode === 'seances'
          ? "La vidéo a été retirée de toutes les séances"
          : "Les exercices et séances associés ont été supprimés",
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
      setDeleteDialog({ open: false, video: null, mode: 'video' });
    }
  };

  const handleEditExercice = (videoId: string) => {
    window.location.href = `/exercices?edit=${videoId}`;
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
                          <DropdownMenuItem onClick={() => handleEditExercice(video.id)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier l'exercice
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, video, mode: 'video' })}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Retirer la vidéo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, video, mode: 'exercises' })}
                          >
                            <Dumbbell className="w-4 h-4 mr-2" />
                            Supprimer les exercices liés
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, video, mode: 'seances' })}
                          >
                            <Calendar className="w-4 h-4 mr-2" />
                            Retirer des séances
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, video, mode: 'all' })}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Tout supprimer
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, video: null, mode: 'video' })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {deleteDialog.mode === 'video' && "Retirer la vidéo"}
                {deleteDialog.mode === 'exercises' && "Supprimer les exercices liés"}
                {deleteDialog.mode === 'seances' && "Retirer des séances"}
                {deleteDialog.mode === 'all' && "Tout supprimer"}
              </DialogTitle>
              <DialogDescription>
                {deleteDialog.mode === 'video' && "La vidéo sera retirée de cet exercice mais l'exercice sera conservé."}
                {deleteDialog.mode === 'exercises' && "Tous les exercices utilisant cette vidéo seront supprimés définitivement."}
                {deleteDialog.mode === 'seances' && "Cette vidéo sera retirée de toutes les séances qui l'utilisent."}
                {deleteDialog.mode === 'all' && "Tous les exercices et références dans les séances seront supprimés. Cette action est irréversible."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog({ open: false, video: null, mode: 'video' })} disabled={deleting}>
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
