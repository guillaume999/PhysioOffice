import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Loader2, Plus, Play, Trash2, Upload, Search, Share2, Copy, Pencil, X } from "lucide-react";
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
  category_pathology_tags: string[] | null;
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
  const [editingExercice, setEditingExercice] = useState<ExerciceItem | null>(null);
  const [playingExercice, setPlayingExercice] = useState<ExerciceItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_pathology: "",
    category_pathology_tags: [] as string[],
    file: null as File | null,
  });
  const [newTag, setNewTag] = useState("");

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
    if (!user) return;

    setUploading(true);
    try {
      let videoUrl: string | null = null;

      if (formData.file) {
        const fileExt = formData.file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("videos")
          .upload(fileName, formData.file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("videos")
          .getPublicUrl(fileName);

        videoUrl = urlData.publicUrl;
      }

      const { error: insertError } = await supabase.from("videos").insert({
        user_id: user.id,
        title: formData.title,
        description: formData.description || null,
        video_url: videoUrl || "",
        category_pathology: formData.category_pathology || null,
        category_pathology_tags: formData.category_pathology_tags.length > 0 ? formData.category_pathology_tags : null,
        is_shared: false,
      });

      if (insertError) throw insertError;

      toast.success("Exercice ajouté avec succès");
      setFormData({
        title: "",
        description: "",
        category_pathology: "",
        category_pathology_tags: [],
        file: null,
      });
      setNewTag("");
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

  const duplicateAndEdit = async (exercice: ExerciceItem) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.from("videos").insert({
        user_id: user.id,
        title: exercice.title + " (copie)",
        description: exercice.description,
        video_url: exercice.video_url,
        thumbnail_url: exercice.thumbnail_url,
        category: exercice.category,
        category_pathology: exercice.category_pathology,
        category_pathology_tags: exercice.category_pathology_tags,
        type_renfo: exercice.type_renfo,
        most_used_patho: exercice.most_used_patho,
        duration: exercice.duration,
        is_shared: false,
        is_copy: true,
        original_id: exercice.id,
      }).select().single();

      if (error) throw error;

      toast.success("Exercice dupliqué");
      await fetchExercices();
      
      // Open the duplicate for editing
      const duplicated = { ...exercice, ...data, id: data.id, title: data.title };
      setEditingExercice(duplicated);
    } catch (error) {
      console.error("Error duplicating exercice:", error);
      toast.error("Erreur lors de la duplication");
    }
  };

  const handleEditSave = async () => {
    if (!editingExercice || !user) return;

    try {
      const { error } = await supabase
        .from("videos")
        .update({
          title: editingExercice.title,
          description: editingExercice.description,
          category_pathology: editingExercice.category_pathology,
          category_pathology_tags: editingExercice.category_pathology_tags,
          video_url: editingExercice.video_url,
        })
        .eq("id", editingExercice.id);

      if (error) throw error;

      toast.success("Exercice modifié");
      setEditingExercice(null);
      fetchExercices();
    } catch (error) {
      console.error("Error updating exercice:", error);
      toast.error("Erreur lors de la modification");
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
        exercice.category_pathology_tags?.some(tag => tag.toLowerCase().includes(query))
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
                  <Label>Tags Pathologie</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.category_pathology_tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            category_pathology_tags: formData.category_pathology_tags.filter((_, i) => i !== idx)
                          })}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: Épaule, Genou, Dos..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newTag.trim() && !formData.category_pathology_tags.includes(newTag.trim())) {
                            setFormData({
                              ...formData,
                              category_pathology_tags: [...formData.category_pathology_tags, newTag.trim()]
                            });
                            setNewTag("");
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (newTag.trim() && !formData.category_pathology_tags.includes(newTag.trim())) {
                          setFormData({
                            ...formData,
                            category_pathology_tags: [...formData.category_pathology_tags, newTag.trim()]
                          });
                          setNewTag("");
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="file">Fichier vidéo (optionnel)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
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

          {/* Edit Dialog */}
          <Dialog open={!!editingExercice} onOpenChange={(open) => !open && setEditingExercice(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Modifier l'exercice</DialogTitle>
              </DialogHeader>
              {editingExercice && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-title">Titre *</Label>
                    <Input
                      id="edit-title"
                      value={editingExercice.title}
                      onChange={(e) => setEditingExercice({ ...editingExercice, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={editingExercice.description || ""}
                      onChange={(e) => setEditingExercice({ ...editingExercice, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Tags Pathologie</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(editingExercice.category_pathology_tags || []).map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => setEditingExercice({
                              ...editingExercice,
                              category_pathology_tags: (editingExercice.category_pathology_tags || []).filter((_, i) => i !== idx)
                            })}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ajouter un tag..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const input = e.currentTarget;
                            const value = input.value.trim();
                            if (value && !(editingExercice.category_pathology_tags || []).includes(value)) {
                              setEditingExercice({
                                ...editingExercice,
                                category_pathology_tags: [...(editingExercice.category_pathology_tags || []), value]
                              });
                              input.value = "";
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="pt-2">
                    <Label>Vidéo</Label>
                    {editingExercice.video_url ? (
                      <div className="space-y-2">
                        <video
                          src={editingExercice.video_url}
                          controls
                          className="w-full rounded-lg max-h-48"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-destructive"
                          onClick={() => setEditingExercice({ ...editingExercice, video_url: "" })}
                        >
                          <X className="w-4 h-4 mr-2" /> Retirer la vidéo
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucune vidéo associée</p>
                    )}
                  </div>
                  <Button onClick={handleEditSave} className="w-full">
                    Enregistrer
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

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
                      <TableHead>Tags Pathologie</TableHead>
                      <TableHead>Partagé</TableHead>
                      <TableHead className="w-32">Aperçu</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
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
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(exercice.category_pathology_tags || []).length > 0 ? (
                                exercice.category_pathology_tags?.map((tag, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))
                              ) : (
                                "-"
                              )}
                            </div>
                          </TableCell>
                          
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
                            {exercice.video_url ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <button
                                    className="relative group w-16 h-12 rounded overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all"
                                    onClick={() => setPlayingExercice(exercice)}
                                  >
                                    <video
                                      src={exercice.video_url}
                                      className="w-full h-full object-cover"
                                      muted
                                      preload="metadata"
                                    />
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                                      <Play className="w-5 h-5 text-white fill-white" />
                                    </div>
                                  </button>
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
                            ) : (
                              <span className="text-xs text-muted-foreground">Pas de vidéo</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {isOwner && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingExercice(exercice)}
                                  title="Modifier"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => duplicateAndEdit(exercice)}
                                title="Dupliquer et modifier"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              {isOwner && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(exercice.id, exercice.video_url)}
                                  className="text-destructive hover:text-destructive"
                                  title="Supprimer"
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
