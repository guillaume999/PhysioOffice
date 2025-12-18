import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Loader2, Plus, Play, Maximize2, Trash2, Upload, Search, Share2, Copy } from "lucide-react";
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

interface ExerciceItem {
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

export default function Exercices() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [exercices, setExercices] = useState<ExerciceItem[]>([]);
  const [loadingExercices, setLoadingExercices] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [playingExercice, setPlayingExercice] = useState<ExerciceItem | null>(null);
  const [fullscreenExercice, setFullscreenExercice] = useState<ExerciceItem | null>(null);
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
    if (user) fetchExercices();
  }, [user]);

  const fetchExercices = async () => {
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExercices(data || []);
    } catch (error) {
      console.error("Error fetching exercices:", error);
      toast.error("Erreur lors du chargement des exercices");
    } finally {
      setLoadingExercices(false);
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

      toast.success("Exercice ajouté avec succès");
      setFormData({
        title: "",
        description: "",
        category_pathology: "",
        type_renfo: "",
        most_used_patho: "",
        file: null,
      });
      setIsAddDialogOpen(false);
      fetchExercices();
    } catch (error) {
      console.error("Error uploading exercice:", error);
      toast.error("Erreur lors de l'upload de l'exercice");
    } finally {
      setUploading(false);
    }
  };

  const toggleShare = async (exerciceId: string, currentShared: boolean) => {
    try {
      const { error } = await supabase
        .from("videos")
        .update({ is_shared: !currentShared })
        .eq("id", exerciceId);

      if (error) throw error;

      setExercices(exercices.map(e => 
        e.id === exerciceId ? { ...e, is_shared: !currentShared } : e
      ));
      toast.success(currentShared ? "Exercice dé-partagé" : "Exercice partagé");
    } catch (error) {
      console.error("Error toggling share:", error);
      toast.error("Erreur lors du partage");
    }
  };

  const copyExercice = async (exercice: ExerciceItem) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("videos").insert({
        user_id: user.id,
        title: exercice.title,
        description: exercice.description,
        video_url: exercice.video_url,
        thumbnail_url: exercice.thumbnail_url,
        category: exercice.category,
        category_pathology: exercice.category_pathology,
        type_renfo: exercice.type_renfo,
        most_used_patho: exercice.most_used_patho,
        duration: exercice.duration,
        is_shared: false,
        is_copy: true,
        original_id: exercice.id,
      });

      if (error) throw error;

      toast.success("Exercice copié dans votre bibliothèque");
      fetchExercices();
    } catch (error) {
      console.error("Error copying exercice:", error);
      toast.error("Erreur lors de la copie");
    }
  };

  const handleDelete = async (id: string, videoUrl: string) => {
    if (!confirm("Supprimer cet exercice ?")) return;

    try {
      const path = videoUrl.split("/videos/")[1];
      if (path) {
        await supabase.storage.from("videos").remove([path]);
      }

      const { error } = await supabase.from("videos").delete().eq("id", id);
      if (error) throw error;

      toast.success("Exercice supprimé");
      fetchExercices();
    } catch (error) {
      console.error("Error deleting exercice:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const filteredExercices = exercices.filter(exercice => {
    if (filter === "mine" && exercice.user_id !== user?.id) return false;
    if (filter === "shared" && !exercice.is_shared) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        exercice.title.toLowerCase().includes(query) ||
        exercice.category_pathology?.toLowerCase().includes(query) ||
        exercice.type_renfo?.toLowerCase().includes(query) ||
        exercice.most_used_patho?.toLowerCase().includes(query)
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
            <div className="p-3 rounded-xl bg-green-500/10">
              <Dumbbell className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Exercices</h1>
              <p className="text-muted-foreground">Gérez vos exercices de rééducation</p>
            </div>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Ajouter un exercice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouvel exercice</DialogTitle>
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
              Tous
            </Button>
            <Button
              variant={filter === "mine" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("mine")}
            >
              Mes exercices
            </Button>
            <Button
              variant={filter === "shared" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("shared")}
            >
              Partagés
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
            <CardTitle>Liste des exercices ({filteredExercices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingExercices ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredExercices.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">
                Aucun exercice. Cliquez sur "Ajouter un exercice" pour commencer.
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
                      <TableHead>Partagé</TableHead>
                      <TableHead className="w-32">Aperçu</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExercices.map((exercice, index) => {
                      const isOwner = exercice.user_id === user?.id;
                      const canShare = isOwner && !exercice.is_copy;
                      return (
                        <TableRow key={exercice.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">
                            {exercice.title}
                            {exercice.is_copy && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Copie
                              </Badge>
                            )}
                            {!isOwner && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Partagé
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{exercice.category_pathology || "-"}</TableCell>
                          <TableCell>{exercice.type_renfo || "-"}</TableCell>
                          <TableCell>{exercice.most_used_patho || "-"}</TableCell>
                          <TableCell>
                            {canShare ? (
                              <Checkbox
                                checked={exercice.is_shared}
                                onCheckedChange={() => toggleShare(exercice.id, exercice.is_shared)}
                              />
                            ) : isOwner && exercice.is_copy ? (
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
                                  onClick={() => setPlayingExercice(exercice)}
                                >
                                  <Play className="w-3 h-3" /> Mini
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-sm">
                                <DialogHeader>
                                  <DialogTitle>{exercice.title}</DialogTitle>
                                </DialogHeader>
                                <video
                                  src={exercice.video_url}
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
                                    onClick={() => setFullscreenExercice(exercice)}
                                  >
                                    <Maximize2 className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl">
                                  <DialogHeader>
                                    <DialogTitle>{exercice.title}</DialogTitle>
                                  </DialogHeader>
                                  <video
                                    src={exercice.video_url}
                                    controls
                                    className="w-full rounded-lg"
                                    autoPlay
                                  />
                                  {exercice.description && (
                                    <p className="text-muted-foreground mt-2">
                                      {exercice.description}
                                    </p>
                                  )}
                                </DialogContent>
                              </Dialog>
                              {!isOwner && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyExercice(exercice)}
                                  title="Copier dans ma bibliothèque"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              )}
                              {isOwner && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(exercice.id, exercice.video_url)}
                                  className="text-destructive hover:text-destructive"
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
