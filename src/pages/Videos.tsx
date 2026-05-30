import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2, Edit, Play, Upload, Loader2, Video } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PagePopup } from "@/components/popup/PagePopup";

interface VideoItem {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function Videos() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const editVideoInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formVideoFile, setFormVideoFile] = useState<File | null>(null);

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [videos, searchQuery]);

  const applyFilters = () => {
    let result = [...videos];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((v) => v.title.toLowerCase().includes(query));
    }

    setFilteredVideos(result);
  };

  const fetchVideos = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setVideos(await pb.collection("videos").getFullList({ filter: `user = "${user.id}"`, sort: "-created" }) as any[]);
    } catch (error) {
      console.error("Error fetching videos:", error);
      toast.error("Erreur lors du chargement des vidéos");
    } finally {
      setLoading(false);
    }
  };

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

  const generateThumbnailFromUrl = (videoUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      
      const timeout = setTimeout(() => {
        resolve(null);
      }, 15000);

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
            resolve(null);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          clearTimeout(timeout);
          resolve(dataUrl);
        } catch {
          clearTimeout(timeout);
          resolve(null);
        }
      };

      video.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };

      video.src = videoUrl;
    });
  };

  const uploadThumbnailToStorage = async (thumbnailDataUrl: string): Promise<string | null> => {
    if (!user) return null;
    
    try {
      // Convert data URL to blob
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

  const uploadVideoToStorage = async (videoFile: File): Promise<string> => {
    if (!user) throw new Error("Not authenticated");

    let fileExt = videoFile.name.split(".").pop()?.toLowerCase();
    if (!fileExt || fileExt === videoFile.name.toLowerCase()) {
      const mimeMap: Record<string, string> = {
        "video/mp4": "mp4",
        "video/quicktime": "mov",
        "video/x-m4v": "m4v",
        "video/webm": "webm",
        "video/3gpp": "3gp",
        "video/avi": "avi",
      };
      fileExt = mimeMap[videoFile.type] || "mp4";
    }
    const objectName = `${user.id}/${Date.now()}.${fileExt}`;

    const fd = new FormData();
    fd.append("file", videoFile);
    fd.append("user", user.id);
    const rec = await pb.collection("exercice_videos").create(fd);
    return pb.files.getURL(rec, rec.file as string);
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!formTitle.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    if (!formVideoFile) {
      toast.error("Veuillez sélectionner une vidéo");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      // Generate thumbnail first
      setUploadProgress(10);
      const thumbnailDataUrl = await generateThumbnailFromFile(formVideoFile);
      let thumbnailUrl: string | null = null;
      
      if (thumbnailDataUrl) {
        setUploadProgress(20);
        thumbnailUrl = await uploadThumbnailToStorage(thumbnailDataUrl);
      }

      setUploadProgress(40);
      const videoUrl = await uploadVideoToStorage(formVideoFile);
      setUploadProgress(80);

      await pb.collection("videos").create({
          user: user.id, title: formTitle.trim(), video_url: videoUrl, thumbnail_url: thumbnailUrl,
          name: formVideoFile?.name || formTitle.trim(),
        });

      setUploadProgress(100);
      toast.success("Vidéo ajoutée avec succès");
      setDialogOpen(false);
      resetForm();
      fetchVideos();
    } catch (error) {
      console.error("Error creating video:", error);
      toast.error("Erreur lors de l'ajout de la vidéo");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUpdate = async () => {
    if (!user || !selectedVideo) return;

    if (!formTitle.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      let videoUrl = selectedVideo.video_url;
      let thumbnailUrl = selectedVideo.thumbnail_url;

      if (formVideoFile) {
        // Generate new thumbnail from new file
        setUploadProgress(10);
        const thumbnailDataUrl = await generateThumbnailFromFile(formVideoFile);
        
        if (thumbnailDataUrl) {
          setUploadProgress(20);
          thumbnailUrl = await uploadThumbnailToStorage(thumbnailDataUrl);
        }

        setUploadProgress(40);
        videoUrl = await uploadVideoToStorage(formVideoFile);
        setUploadProgress(80);
      } else if (!thumbnailUrl && videoUrl) {
        // Generate thumbnail from existing video URL if missing
        setUploadProgress(20);
        toast.info("Génération de la vignette...");
        const thumbnailDataUrl = await generateThumbnailFromUrl(videoUrl);
        
        if (thumbnailDataUrl) {
          setUploadProgress(50);
          thumbnailUrl = await uploadThumbnailToStorage(thumbnailDataUrl);
        }
        setUploadProgress(80);
      }

      await pb.collection("videos").update(selectedVideo.id, { title: formTitle.trim(), video_url: videoUrl, thumbnail_url: thumbnailUrl });

      setUploadProgress(100);
      toast.success(thumbnailUrl && !selectedVideo.thumbnail_url 
        ? "Vidéo modifiée et vignette générée" 
        : "Vidéo modifiée avec succès");
      setEditDialogOpen(false);
      resetForm();
      fetchVideos();
    } catch (error) {
      console.error("Error updating video:", error);
      toast.error("Erreur lors de la modification");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (video: VideoItem) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette vidéo ?")) return;

    try {
      // First, remove the video reference from all exercices using it
      const linkedEx = await pb.collection("exercices").getFullList({ filter: `video = "${video.id}"` });
      for (const ex of linkedEx) await pb.collection("exercices").update(ex.id, { video: null, video_url: null, thumbnail_url: null });

      // Delete the video record (PocketBase auto-deletes the linked file)
      await pb.collection("videos").delete(video.id);

      toast.success("Vidéo supprimée avec succès");
      fetchVideos();
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const resetForm = () => {
    setFormTitle("");
    setFormVideoFile(null);
    setSelectedVideo(null);
  };

  const openEditDialog = (video: VideoItem) => {
    setSelectedVideo(video);
    setFormTitle(video.title);
    setFormVideoFile(null);
    setEditDialogOpen(true);
  };

  const openVideoPlayer = (video: VideoItem) => {
    setSelectedVideo(video);
    setVideoDialogOpen(true);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error("Veuillez sélectionner un fichier vidéo");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("La vidéo ne doit pas dépasser 50 Mo");
      return;
    }

    setFormVideoFile(file);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PagePopup pageKey="videos" />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Bibliothèque Vidéos</h1>
            <p className="text-muted-foreground">
              Gérez votre bibliothèque de vidéos
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une vidéo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouvelle vidéo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="add-title">Titre *</Label>
                  <Input
                    id="add-title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Titre de la vidéo"
                  />
                </div>

                <div>
                  <Label>Vidéo *</Label>
                  <div className="mt-2">
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => videoInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {formVideoFile ? formVideoFile.name : "Sélectionner une vidéo"}
                    </Button>
                  </div>
                </div>

                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Upload en cours... {uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleSubmit} 
                  className="w-full"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Upload en cours...
                    </>
                  ) : (
                    "Ajouter"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Mes vidéos ({filteredVideos.length})
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredVideos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune vidéo trouvée</p>
                <p className="text-sm mt-2">
                  Ajoutez votre première vidéo pour commencer
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aperçu</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVideos.map((video) => (
                      <TableRow key={video.id}>
                        <TableCell>
                          <button 
                            type="button"
                            className="w-20 h-14 bg-muted rounded overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity relative group"
                            onClick={() => openVideoPlayer(video)}
                          >
                            {video.thumbnail_url ? (
                              <img 
                                src={video.thumbnail_url} 
                                alt={video.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Play className="h-6 w-6 text-muted-foreground" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="h-6 w-6 text-white" />
                            </div>
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{video.title}</TableCell>
                        <TableCell>
                          {new Date(video.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(video)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(video)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier la vidéo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Titre *</Label>
                <Input
                  id="edit-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Titre de la vidéo"
                />
              </div>

              <div>
                <Label>Vidéo</Label>
                <div className="mt-2">
                  <input
                    ref={editVideoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => editVideoInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {formVideoFile ? formVideoFile.name : "Changer la vidéo"}
                  </Button>
                </div>
                {selectedVideo && !formVideoFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Vidéo actuelle : conservée si aucune nouvelle vidéo n'est sélectionnée
                  </p>
                )}
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Upload en cours... {uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <Button 
                onClick={handleUpdate} 
                className="w-full"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Upload en cours...
                  </>
                ) : (
                  "Modifier"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Video Player Dialog */}
        <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedVideo?.title}</DialogTitle>
            </DialogHeader>
            {selectedVideo && (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={selectedVideo.video_url}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
