import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Video, Search, Play, X, MoreVertical, Pencil, Trash2, FileVideo, Upload, Loader2, HardDrive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import * as tus from "tus-js-client";


const MAX_VIDEO_SIZE_MB = 150;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

interface VideoItem {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
}

interface VideoSizeBytes {
  [key: string]: number;
}

export default function Videos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [videoToPlay, setVideoToPlay] = useState<string | null>(null);
  const [videoSizesBytes, setVideoSizesBytes] = useState<VideoSizeBytes>({});
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; video: VideoItem | null }>({ open: false, video: null });
  const [deleting, setDeleting] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; video: VideoItem | null }>({ open: false, video: null });
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importTitle, setImportTitle] = useState("");
  const [replaceVideoDialog, setReplaceVideoDialog] = useState<{ open: boolean; video: VideoItem | null }>({ open: false, video: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

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
        .from("videos")
        .select("id, title, description, video_url, thumbnail_url")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const videoData = (data || []) as VideoItem[];
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
        setVideoSizesBytes((prev) => ({ ...prev, [videoId]: sizeInBytes }));
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

  // Calculate total storage used
  const totalStorageBytes = Object.values(videoSizesBytes).reduce((acc, size) => acc + size, 0);

  const getStoragePathFromUrl = (url: string): string | null => {
    try {
      const urlParts = url.split('/videos/');
      return urlParts[1] || null;
    } catch {
      return null;
    }
  };

  const handleDeleteVideo = async () => {
    if (!deleteDialog.video || !user) return;

    setDeleting(true);
    try {
      const video = deleteDialog.video;

      // Clear video_id from all exercises using this video
      await supabase
        .from("exercices")
        .update({ video_id: null })
        .eq("video_id", video.id);

      // Delete the video record
      const { error: deleteError } = await supabase
        .from("videos")
        .delete()
        .eq("id", video.id);

      if (deleteError) throw deleteError;

      // Delete video from storage
      const storagePath = getStoragePathFromUrl(video.video_url);
      if (storagePath) {
        await supabase.storage.from('videos').remove([storagePath]);
      }

      toast({
        title: "Suppression réussie",
        description: "La vidéo a été supprimée de votre bibliothèque",
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
      setDeleteDialog({ open: false, video: null });
    }
  };

  const handleOpenEditDialog = (video: VideoItem) => {
    setEditTitle(video.title);
    setEditDescription(video.description || "");
    setEditDialog({ open: true, video });
  };

  const handleSaveEdit = async () => {
    if (!editDialog.video || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("videos")
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
        })
        .eq("id", editDialog.video.id);

      if (error) throw error;

      toast({
        title: "Vidéo modifiée",
        description: "Les informations ont été mises à jour",
      });

      setEditDialog({ open: false, video: null });
      fetchVideos();
    } catch (error) {
      console.error("Erreur lors de la modification:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la modification",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadVideoToStorage = async (
    file: File
  ): Promise<{ publicUrl: string; objectName: string }> => {
    if (!user) throw new Error("Not authenticated");

    // Normalize extension: take from file name or fallback to mime type
    let fileExt = file.name.split(".").pop()?.toLowerCase();
    if (!fileExt || fileExt === file.name.toLowerCase()) {
      // No extension in name, derive from mime type
      const mimeMap: Record<string, string> = {
        "video/mp4": "mp4",
        "video/quicktime": "mov",
        "video/x-m4v": "m4v",
        "video/webm": "webm",
        "video/3gpp": "3gp",
        "video/avi": "avi",
      };
      fileExt = mimeMap[file.type] || "mp4";
    }
    const objectName = `${user.id}/${Date.now()}.${fileExt}`;

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Not authenticated");

    const tusEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`;

    setUploadProgress(0);

    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: 2 * 1024 * 1024,
        removeFingerprintOnSuccess: true,
        uploadDataDuringCreation: false,
        overridePatchMethod: true,
        headers: {
          authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        metadata: {
          bucketName: "videos",
          objectName,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        onError: (err) => reject(err),
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = bytesTotal ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
          setUploadProgress(pct);
        },
        onSuccess: () => resolve(),
      });

      upload.start();
    });

    const { data } = supabase.storage.from("videos").getPublicUrl(objectName);
    return { publicUrl: data.publicUrl, objectName };
  };

  const handleReplaceVideo = async (file: File) => {
    if (!replaceVideoDialog.video || !user) return;

    // Check file size for non-admins
    if (!isAdmin && file.size > MAX_VIDEO_SIZE_BYTES) {
      toast({
        title: "Fichier trop volumineux",
        description: `La taille maximale autorisée est de ${MAX_VIDEO_SIZE_MB} Mo. Votre fichier fait ${formatFileSize(file.size)}.`,
        variant: "destructive",
      });
      return;
    }

    setUploadProgress(0);
    setUploading(true);
    try {
      const oldVideoUrl = replaceVideoDialog.video.video_url;

      // Upload new video
      const uploaded = await uploadVideoToStorage(file);
      const newVideoUrl = uploaded.publicUrl;

      // Update the video record
      const { error: updateError } = await supabase
        .from("videos")
        .update({ video_url: newVideoUrl, thumbnail_url: null })
        .eq("id", replaceVideoDialog.video.id);

      if (updateError) throw updateError;

      // Delete old video from storage
      const oldPath = getStoragePathFromUrl(oldVideoUrl);
      if (oldPath) {
        await supabase.storage.from('videos').remove([oldPath]);
      }

      toast({
        title: "Vidéo remplacée",
        description: "Le fichier vidéo a été mis à jour",
      });

      setReplaceVideoDialog({ open: false, video: null });
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
      setUploadProgress(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleReplaceVideo(file);
    }
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size for non-admins
      if (!isAdmin && file.size > MAX_VIDEO_SIZE_BYTES) {
        toast({
          title: "Fichier trop volumineux",
          description: `La taille maximale autorisée est de ${MAX_VIDEO_SIZE_MB} Mo. Votre fichier fait ${formatFileSize(file.size)}.`,
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      setSelectedImportFile(file);
      // Pre-fill title with filename (without extension)
      setImportTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleImportVideo = async () => {
    if (!selectedImportFile || !user || !importTitle.trim()) return;

    setUploadProgress(0);
    setUploading(true);
    try {
      // Upload
      const uploaded = await uploadVideoToStorage(selectedImportFile);
      const videoUrl = uploaded.publicUrl;

      const title = importTitle.trim();

      // Create video in videos table
      const { error: insertError } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          title: title,
          video_url: videoUrl,
        });

      if (insertError) throw insertError;

      toast({
        title: "Vidéo importée",
        description: "La vidéo a été ajoutée à votre bibliothèque",
      });

      setImportDialogOpen(false);
      setSelectedImportFile(null);
      setImportTitle("");
      fetchVideos();
    } catch (error) {
      console.error("Erreur lors de l'import:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'import de la vidéo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10">
                    <Video className="w-6 h-6 text-purple-500" />
                  </div>
                  <CardTitle className="text-2xl font-display">
                    Ma Vidéothèque
                  </CardTitle>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher une vidéo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={() => setImportDialogOpen(true)} className="shrink-0">
                    <Upload className="w-4 h-4 mr-2" />
                    Importer une vidéo
                  </Button>
                </div>
              </div>

              {/* Stats summary */}
              {!loading && (
                <div className="flex flex-wrap gap-4 pt-2 border-t">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                    <FileVideo className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium">{videos.length} vidéo{videos.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                    <HardDrive className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">{formatFileSize(totalStorageBytes)}</span>
                  </div>
                </div>
              )}
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
                  Importez des vidéos pour les retrouver ici
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
                    {videoSizesBytes[video.id] && (
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-xs flex items-center gap-1">
                        <FileVideo className="w-3 h-3" />
                        {formatFileSize(videoSizesBytes[video.id])}
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
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(video)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier les infos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setReplaceVideoDialog({ open: true, video })}>
                            <Upload className="w-4 h-4 mr-2" />
                            Remplacer le fichier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, video })}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Title overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="text-white font-medium text-sm truncate">
                        {video.title}
                      </p>
                      {video.description && (
                        <p className="text-white/70 text-xs truncate">
                          {video.description}
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

        {/* Edit Video Info Dialog */}
        <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, video: null })}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier la vidéo</DialogTitle>
              <DialogDescription>
                Modifiez le titre et la description de la vidéo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Titre</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Titre de la vidéo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (optionnel)</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description de la vidéo..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => setEditDialog({ open: false, video: null })} 
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleSaveEdit} 
                disabled={saving || !editTitle.trim()}
                className="w-full sm:w-auto"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Replace Video File Dialog */}
        <Dialog open={replaceVideoDialog.open} onOpenChange={(open) => !open && setReplaceVideoDialog({ open: false, video: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remplacer le fichier vidéo</DialogTitle>
              <DialogDescription>
                Choisissez un nouveau fichier pour remplacer "{replaceVideoDialog.video?.title}".
                {!isAdmin && ` Taille max: ${MAX_VIDEO_SIZE_MB} Mo.`}
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
                    Upload en cours{uploadProgress > 0 ? ` (${uploadProgress}%)` : ""}...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Choisir un nouveau fichier
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Video Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setImportDialogOpen(false);
            setSelectedImportFile(null);
          }
        }}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Importer une vidéo
              </DialogTitle>
              <DialogDescription>
                Ajoutez une nouvelle vidéo à votre bibliothèque.
                {!isAdmin && ` Taille max: ${MAX_VIDEO_SIZE_MB} Mo.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <input
                ref={importFileInputRef}
                type="file"
                accept="video/*"
                onChange={handleImportFileSelect}
                className="hidden"
              />
              
              <div
                onClick={() => importFileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                {selectedImportFile ? (
                  <div className="space-y-2">
                    <FileVideo className="w-10 h-10 mx-auto text-primary" />
                    <p className="text-sm font-medium truncate">{selectedImportFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedImportFile.size)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Cliquez pour sélectionner une vidéo
                    </p>
                  </div>
                )}
              </div>

              {selectedImportFile && (
                <div className="space-y-2">
                  <Label htmlFor="import-title">Titre</Label>
                  <Input
                    id="import-title"
                    value={importTitle}
                    onChange={(e) => setImportTitle(e.target.value)}
                    placeholder="Titre de la vidéo"
                  />
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => { setImportDialogOpen(false); setSelectedImportFile(null); setImportTitle(""); }} 
                disabled={uploading}
                className="w-full sm:w-auto"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleImportVideo} 
                disabled={uploading || !selectedImportFile || !importTitle.trim()}
                className="w-full sm:w-auto"
              >
                 {uploading ? (
                   <>
                     <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                     Import en cours{uploadProgress > 0 ? ` (${uploadProgress}%)` : ""}...
                   </>
                 ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importer
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, video: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer la vidéo</DialogTitle>
              <DialogDescription>
                La vidéo "{deleteDialog.video?.title}" sera supprimée de votre bibliothèque. 
                Les exercices utilisant cette vidéo ne seront pas supprimés mais n'auront plus de vidéo associée.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog({ open: false, video: null })} disabled={deleting}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDeleteVideo} disabled={deleting}>
                {deleting ? "Suppression..." : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
