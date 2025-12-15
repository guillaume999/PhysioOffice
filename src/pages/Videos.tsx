import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Video, Loader2, Plus, Play, Maximize2, Trash2, Upload, Search, Share2, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface VideoItem {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  category_pathology: string | null;
  type_renfo: string | null;
  most_used_patho: string | null;
  duration: number | null;
  is_shared: boolean;
  is_copy: boolean;
  original_id: string | null;
  user_id: string;
  created_at: string;
}

type FilterType = "all" | "mine" | "shared";

export default function Videos() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);
  const [fullscreenVideo, setFullscreenVideo] = useState<VideoItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_pathology: "",
    type_renfo: "",
    most_used_patho: "",
    file: null as File | null,
  });

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchVideos();
  }, [user]);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error("Error fetching videos:", error);
      toast.error("Erreur lors du chargement des vidéos");
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, file });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file || !user) return;

    setUploading(true);
    try {
      const fileExt = formData.file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, formData.file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("videos")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("videos").insert({
        user_id: user.id,
        title: formData.title,
        description: formData.description || null,
        video_url: urlData.publicUrl,
        category_pathology: formData.category_pathology || null,
        type_renfo: formData.type_renfo || null,
        most_used_patho: formData.most_used_patho || null,
        is_shared: false,
      });

      if (insertError) throw insertError;

      toast.success("Vidéo ajoutée avec succès");
      setFormData({
        title: "",
        description: "",
        category_pathology: "",
        type_renfo: "",
        most_used_patho: "",
        file: null,
      });
      setIsAddDialogOpen(false);
      fetchVideos();
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error("Erreur lors de l'upload de la vidéo");
    } finally {
      setUploading(false);
    }
  };

  const toggleShare = async (videoId: string, currentShared: boolean) => {
    try {
      const { error } = await supabase
        .from("videos")
        .update({ is_shared: !currentShared })
        .eq("id", videoId);

      if (error) throw error;

      setVideos(videos.map(v => 
        v.id === videoId ? { ...v, is_shared: !currentShared } : v
      ));
      toast.success(currentShared ? "Vidéo dé-partagée" : "Vidéo partagée");
    } catch (error) {
      console.error("Error toggling share:", error);
      toast.error("Erreur lors du partage");
    }
  };

  const copyVideo = async (video: VideoItem) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("videos").insert({
        user_id: user.id,
        title: video.title,
        description: video.description,
        video_url: video.video_url,
        thumbnail_url: video.thumbnail_url,
        category: video.category,
        category_pathology: video.category_pathology,
        type_renfo: video.type_renfo,
        most_used_patho: video.most_used_patho,
        duration: video.duration,
        is_shared: false,
        is_copy: true,
        original_id: video.id,
      });

      if (error) throw error;

      toast.success("Vidéo copiée dans votre bibliothèque");
      fetchVideos();
    } catch (error) {
      console.error("Error copying video:", error);
      toast.error("Erreur lors de la copie");
    }
  };

  const handleDelete = async (id: string, videoUrl: string) => {
    if (!confirm("Supprimer cette vidéo ?")) return;

    try {
      const path = videoUrl.split("/videos/")[1];
      if (path) {
        await supabase.storage.from("videos").remove([path]);
      }

      const { error } = await supabase.from("videos").delete().eq("id", id);
      if (error) throw error;

      toast.success("Vidéo supprimée");
      fetchVideos();
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const filteredVideos = videos.filter(video => {
    // Filter by type
    if (filter === "mine" && video.user_id !== user?.id) return false;
    if (filter === "shared" && !video.is_shared) return false;
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        video.title.toLowerCase().includes(query) ||
        video.category_pathology?.toLowerCase().includes(query) ||
        video.type_renfo?.toLowerCase().includes(query) ||
        video.most_used_patho?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <Video className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Vidéothèque</h1>
              <p className="text-muted-foreground">Gérez vos vidéos de rééducation</p>
            </div>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Ajouter une vidéo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouvelle vidéo</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Titre *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="category_pathology">Catégorie Pathologie</Label>
                  <Input
                    id="category_pathology"
                    value={formData.category_pathology}
                    onChange={(e) => setFormData({ ...formData, category_pathology: e.target.value })}
                    placeholder="Ex: Épaule, Genou, Dos..."
                  />
                </div>
                <div>
                  <Label htmlFor="type_renfo">Type de Renfo</Label>
                  <Input
                    id="type_renfo"
                    value={formData.type_renfo}
                    onChange={(e) => setFormData({ ...formData, type_renfo: e.target.value })}
                    placeholder="Ex: Isométrique, Concentrique..."
                  />
                </div>
                <div>
                  <Label htmlFor="most_used_patho">Patho qui l'utilisent le plus</Label>
                  <Input
                    id="most_used_patho"
                    value={formData.most_used_patho}
                    onChange={(e) => setFormData({ ...formData, most_used_patho: e.target.value })}
                    placeholder="Ex: Tendinite, Entorse..."
                  />
                </div>
                <div>
                  <Label htmlFor="file">Fichier vidéo *</Label>
                  <Input
                    id="file"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Upload en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" /> Ajouter
                    </>
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Toutes
            </Button>
            <Button
              variant={filter === "mine" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("mine")}
            >
              Mes vidéos
            </Button>
            <Button
              variant={filter === "shared" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("shared")}
            >
              Partagées
            </Button>
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Rechercher par titre, pathologie, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des vidéos ({filteredVideos.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingVideos ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredVideos.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">
                Aucune vidéo. Cliquez sur "Ajouter une vidéo" pour commencer.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Cat. Pathologie</TableHead>
                      <TableHead>Type Renfo</TableHead>
                      <TableHead>Patho fréquente</TableHead>
                      <TableHead>Partagée</TableHead>
                      <TableHead className="w-32">Aperçu</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVideos.map((video, index) => {
                      const isOwner = video.user_id === user?.id;
                      const canShare = isOwner && !video.is_copy;
                      return (
                        <TableRow key={video.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">
                            {video.title}
                            {video.is_copy && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Copie
                              </Badge>
                            )}
                            {!isOwner && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Partagée
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{video.category_pathology || "-"}</TableCell>
                          <TableCell>{video.type_renfo || "-"}</TableCell>
                          <TableCell>{video.most_used_patho || "-"}</TableCell>
                          <TableCell>
                            {canShare ? (
                              <Checkbox
                                checked={video.is_shared}
                                onCheckedChange={() => toggleShare(video.id, video.is_shared)}
                              />
                            ) : isOwner && video.is_copy ? (
                              <span className="text-xs text-muted-foreground">Non partageable</span>
                            ) : (
                              <Share2 className="w-4 h-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => setPlayingVideo(video)}
                                >
                                  <Play className="w-3 h-3" /> Mini
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-sm">
                                <DialogHeader>
                                  <DialogTitle>{video.title}</DialogTitle>
                                </DialogHeader>
                                <video
                                  src={video.video_url}
                                  controls
                                  className="w-full rounded-lg"
                                  autoPlay
                                />
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setFullscreenVideo(video)}
                                  >
                                    <Maximize2 className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl">
                                  <DialogHeader>
                                    <DialogTitle>{video.title}</DialogTitle>
                                  </DialogHeader>
                                  <video
                                    src={video.video_url}
                                    controls
                                    className="w-full rounded-lg"
                                    autoPlay
                                  />
                                  {video.description && (
                                    <p className="text-muted-foreground text-sm mt-2">
                                      {video.description}
                                    </p>
                                  )}
                                </DialogContent>
                              </Dialog>
                              {!isOwner && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyVideo(video)}
                                  title="Copier dans ma bibliothèque"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              )}
                              {isOwner && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(video.id, video.video_url)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
