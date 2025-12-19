import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, User, Shield, Copy, Trash2, Edit, Play, X, Check, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";

interface Exercice {
  id: string;
  title: string;
  description: string | null;
  pathologie_tags: string[];
  status: string;
  video_url: string | null;
  thumbnail_url: string | null;
  is_platform: boolean;
  is_copy: boolean;
  original_id: string | null;
  author_name: string | null;
  user_id: string;
  created_at: string;
}

type FilterType = "mine" | "platform" | "shared";

export default function Exercices() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [userPseudo, setUserPseudo] = useState<string | null>(null);
  const [userCanShare, setUserCanShare] = useState<boolean>(true);
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [filteredExercices, setFilteredExercices] = useState<Exercice[]>([]);
  const [featuredExerciceIds, setFeaturedExerciceIds] = useState<string[]>([]);
  const [pathologies, setPathologies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [selectedExercice, setSelectedExercice] = useState<Exercice | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [filter, setFilter] = useState<FilterType>("mine");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    pathologie_tags: [] as string[],
    newPathologie: "",
    videoFile: null as File | null,
    video_url: "",
    thumbnail_url: ""
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [exercices, filter, searchQuery, user, featuredExerciceIds]);

  const applyFilters = () => {
    let result = [...exercices];

    // Get IDs of originals that the user has copied
    const userCopiedOriginalIds = exercices
      .filter((e) => e.is_copy && e.user_id === user?.id && e.original_id)
      .map((e) => e.original_id);

    // Filter out originals that user has already copied (in shared view)
    if (filter === "shared") {
      result = result.filter((e) => !userCopiedOriginalIds.includes(e.id));
    }

    // Apply filter type
    if (filter === "mine") {
      result = result.filter((e) => e.user_id === user?.id);
    } else if (filter === "platform") {
      result = result.filter((e) => featuredExerciceIds.includes(e.id));
    } else if (filter === "shared") {
      result = result.filter((e) => 
        e.status === "shared" && 
        e.user_id !== user?.id && 
        !featuredExerciceIds.includes(e.id)
      );
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.description?.toLowerCase().includes(query) ||
          e.pathologie_tags.some(tag => tag.toLowerCase().includes(query)) ||
          e.author_name?.toLowerCase().includes(query)
      );
    }

    setFilteredExercices(result);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("pseudo, can_share")
        .eq("user_id", user!.id)
        .maybeSingle();
      
      setUserPseudo(profileData?.pseudo || null);
      setUserCanShare(profileData?.can_share !== false);

      // Fetch featured exercices
      const { data: featuredData } = await supabase
        .from("featured_exercices")
        .select("exercice_id");
      setFeaturedExerciceIds(featuredData?.map((f) => f.exercice_id) || []);

      // Fetch exercices
      const { data: exercicesData, error: exercicesError } = await supabase
        .from("exercices")
        .select("*")
        .order("created_at", { ascending: false });

      if (exercicesError) throw exercicesError;
      setExercices(exercicesData || []);

      // Fetch pathologies
      const { data: pathoData } = await supabase
        .from("pathologies")
        .select("name");
      setPathologies([...new Set(pathoData?.map((p) => p.name) || [])]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const uploadVideoAndThumbnail = async (videoFile: File): Promise<{ videoUrl: string; thumbnailUrl: string }> => {
    const fileExt = videoFile.name.split('.').pop();
    const fileName = `${user!.id}/${Date.now()}.${fileExt}`;
    
    // Upload video
    const { data: videoData, error: videoError } = await supabase.storage
      .from('videos')
      .upload(fileName, videoFile);
    
    if (videoError) throw videoError;
    
    const { data: { publicUrl: videoUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName);

    // Generate and upload thumbnail
    const thumbnailBlob = await generateThumbnailBlob(videoFile);
    const thumbnailFileName = `${user!.id}/${Date.now()}_thumb.jpg`;
    
    const { error: thumbError } = await supabase.storage
      .from('videos')
      .upload(thumbnailFileName, thumbnailBlob);
    
    if (thumbError) throw thumbError;
    
    const { data: { publicUrl: thumbnailUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(thumbnailFileName);

    return { videoUrl, thumbnailUrl };
  };

  const generateThumbnailBlob = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      
      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(video.src);
              if (blob) resolve(blob);
              else reject(new Error("Failed to generate thumbnail"));
            },
            'image/jpeg',
            0.8
          );
        } else {
          reject(new Error("Failed to get canvas context"));
        }
      };

      video.onerror = () => reject(new Error("Failed to load video"));
    });
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!formData.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    setIsUploading(true);
    try {
      const tags = [...formData.pathologie_tags];
      if (formData.newPathologie.trim() && !tags.includes(formData.newPathologie.trim())) {
        tags.push(formData.newPathologie.trim());
        await supabase.from("pathologies").insert({ 
          user_id: user.id, 
          name: formData.newPathologie.trim() 
        });
      }

      let videoUrl = formData.video_url;
      let thumbnailUrl = formData.thumbnail_url;

      // Upload video if file selected
      if (formData.videoFile) {
        const uploaded = await uploadVideoAndThumbnail(formData.videoFile);
        videoUrl = uploaded.videoUrl;
        thumbnailUrl = uploaded.thumbnailUrl;
      }

      const { error } = await supabase
        .from("exercices")
        .insert({
          user_id: user.id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          pathologie_tags: tags,
          video_url: videoUrl || null,
          thumbnail_url: thumbnailUrl || null,
          author_name: userPseudo,
          status: "draft"
        });

      if (error) throw error;

      toast.success("Exercice créé avec succès");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error creating exercice:", error);
      toast.error("Erreur lors de la création");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!user || !selectedExercice) return;

    if (!formData.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    setIsUploading(true);
    try {
      const tags = [...formData.pathologie_tags];
      if (formData.newPathologie.trim() && !tags.includes(formData.newPathologie.trim())) {
        tags.push(formData.newPathologie.trim());
        await supabase.from("pathologies").insert({ 
          user_id: user.id, 
          name: formData.newPathologie.trim() 
        });
      }

      let videoUrl = formData.video_url;
      let thumbnailUrl = formData.thumbnail_url;

      // Upload video if new file selected
      if (formData.videoFile) {
        const uploaded = await uploadVideoAndThumbnail(formData.videoFile);
        videoUrl = uploaded.videoUrl;
        thumbnailUrl = uploaded.thumbnailUrl;
      }

      const { error } = await supabase
        .from("exercices")
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          pathologie_tags: tags,
          video_url: videoUrl || null,
          thumbnail_url: thumbnailUrl || null
        })
        .eq("id", selectedExercice.id);

      if (error) throw error;

      toast.success("Exercice modifié avec succès");
      setEditDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error updating exercice:", error);
      toast.error("Erreur lors de la modification");
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      pathologie_tags: [],
      newPathologie: "",
      videoFile: null,
      video_url: "",
      thumbnail_url: ""
    });
    setSelectedExercice(null);
  };

  const openEditDialog = (exercice: Exercice) => {
    setSelectedExercice(exercice);
    setFormData({
      title: exercice.title,
      description: exercice.description || "",
      pathologie_tags: exercice.pathologie_tags || [],
      newPathologie: "",
      videoFile: null,
      video_url: exercice.video_url || "",
      thumbnail_url: exercice.thumbnail_url || ""
    });
    setEditDialogOpen(true);
  };

  const toggleShare = async (exercice: Exercice) => {
    if (exercice.is_copy) {
      toast.error("Les copies ne peuvent pas être partagées");
      return;
    }
    if (!userCanShare) {
      toast.error("Vous n'avez pas la permission de partager du contenu");
      return;
    }
    if (exercice.status === "shared") {
      toast.error("Un exercice partagé ne peut plus être modifié");
      return;
    }

    const newStatus = exercice.status === "draft" ? "pending" : "draft";
    
    try {
      await supabase
        .from("exercices")
        .update({ status: newStatus })
        .eq("id", exercice.id);
      
      toast.success(newStatus === "pending" ? "Exercice en attente de validation" : "Exercice retiré du partage");
      fetchData();
    } catch (error) {
      console.error("Error toggling share:", error);
      toast.error("Erreur lors du partage");
    }
  };

  const validateExercice = async (exercice: Exercice) => {
    try {
      await supabase
        .from("exercices")
        .update({ status: "shared" })
        .eq("id", exercice.id);
      
      toast.success("Exercice validé et partagé");
      fetchData();
    } catch (error) {
      console.error("Error validating exercice:", error);
      toast.error("Erreur lors de la validation");
    }
  };

  const addToPlatform = async (exercice: Exercice) => {
    if (!user) return;

    try {
      // Create a copy for platform
      const { data: newExercice, error: copyError } = await supabase
        .from("exercices")
        .insert({
          user_id: user.id,
          title: exercice.title,
          description: exercice.description,
          pathologie_tags: exercice.pathologie_tags,
          video_url: exercice.video_url,
          thumbnail_url: exercice.thumbnail_url,
          author_name: exercice.author_name,
          is_platform: true,
          is_copy: true,
          original_id: exercice.id,
          status: "shared"
        })
        .select()
        .single();

      if (copyError) throw copyError;

      // Add to featured
      await supabase
        .from("featured_exercices")
        .insert({
          exercice_id: newExercice.id,
          added_by: user.id
        });

      toast.success("Exercice ajouté à PhysioOfficeExercices");
      fetchData();
    } catch (error) {
      console.error("Error adding to platform:", error);
      toast.error("Erreur lors de l'ajout à la plateforme");
    }
  };

  const removeFromPlatform = async (exerciceId: string) => {
    try {
      await supabase
        .from("featured_exercices")
        .delete()
        .eq("exercice_id", exerciceId);

      toast.success("Exercice retiré de PhysioOfficeExercices");
      fetchData();
    } catch (error) {
      console.error("Error removing from platform:", error);
      toast.error("Erreur lors du retrait");
    }
  };

  const copyExercice = async (exercice: Exercice) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("exercices")
        .insert({
          user_id: user.id,
          title: exercice.title,
          description: exercice.description,
          pathologie_tags: exercice.pathologie_tags,
          video_url: exercice.video_url,
          thumbnail_url: exercice.thumbnail_url,
          author_name: exercice.author_name,
          is_copy: true,
          original_id: exercice.id,
          status: "draft"
        });

      if (error) throw error;

      toast.success("Exercice copié dans votre bibliothèque");
      fetchData();
    } catch (error) {
      console.error("Error copying exercice:", error);
      toast.error("Erreur lors de la copie");
    }
  };

  const deleteExercice = async (id: string) => {
    try {
      await supabase.from("exercices").delete().eq("id", id);
      toast.success("Exercice supprimé");
      fetchData();
    } catch (error) {
      console.error("Error deleting exercice:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const openVideoDialog = (exercice: Exercice) => {
    setSelectedExercice(exercice);
    setVideoDialogOpen(true);
  };

  const toggleTag = (tag: string) => {
    if (formData.pathologie_tags.includes(tag)) {
      setFormData({
        ...formData,
        pathologie_tags: formData.pathologie_tags.filter(t => t !== tag)
      });
    } else {
      setFormData({
        ...formData,
        pathologie_tags: [...formData.pathologie_tags, tag]
      });
    }
  };

  const getStatusBadge = (exercice: Exercice) => {
    if (featuredExerciceIds.includes(exercice.id)) {
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Plateforme</Badge>;
    }
    switch (exercice.status) {
      case "shared":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Partagé</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">En attente</Badge>;
      default:
        return <Badge variant="outline">Brouillon</Badge>;
    }
  };

  const canEdit = (exercice: Exercice) => {
    return exercice.user_id === user?.id && exercice.status === "draft";
  };

  const canDelete = (exercice: Exercice) => {
    return exercice.user_id === user?.id || isAdmin;
  };

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="glass">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Veuillez vous connecter pour accéder aux exercices.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold">Exercices</h1>
              <p className="text-muted-foreground">
                Gérez votre bibliothèque d'exercices
              </p>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvel exercice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Créer un exercice</DialogTitle>
                </DialogHeader>
                <ExerciceForm
                  formData={formData}
                  setFormData={setFormData}
                  pathologies={pathologies}
                  toggleTag={toggleTag}
                  onSubmit={handleSubmit}
                  submitLabel="Créer"
                  isUploading={isUploading}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2">
              <Button
                variant={filter === "mine" ? "default" : "outline"}
                onClick={() => setFilter("mine")}
                className="flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Mes exercices
              </Button>
              <Button
                variant={filter === "platform" ? "default" : "outline"}
                onClick={() => setFilter("platform")}
                className="flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                PhysioOffice
              </Button>
              <Button
                variant={filter === "shared" ? "default" : "outline"}
                onClick={() => setFilter("shared")}
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Partagés
              </Button>
            </div>

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Exercices Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="glass animate-pulse">
                  <div className="aspect-video bg-muted" />
                  <CardContent className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredExercices.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">
                  Aucun exercice trouvé
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExercices.map((exercice) => (
                <Card key={exercice.id} className="glass overflow-hidden group">
                  {/* Thumbnail */}
                  <div 
                    className="aspect-video bg-muted relative cursor-pointer"
                    onClick={() => exercice.video_url && openVideoDialog(exercice)}
                  >
                    {exercice.thumbnail_url ? (
                      <img
                        src={exercice.thumbnail_url}
                        alt={exercice.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <Play className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                    {exercice.video_url && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-12 h-12 text-white" />
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4 space-y-3">
                    {/* Title and Status */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold line-clamp-2">{exercice.title}</h3>
                      {getStatusBadge(exercice)}
                    </div>

                    {/* Author */}
                    {exercice.author_name && (
                      <p className="text-sm text-muted-foreground">
                        Par {exercice.author_name}
                      </p>
                    )}

                    {/* Tags */}
                    {exercice.pathologie_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {exercice.pathologie_tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Description */}
                    {exercice.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {exercice.description}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {/* Edit - only for owner and draft status */}
                      {canEdit(exercice) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(exercice)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Modifier
                        </Button>
                      )}

                      {/* Share toggle - only for owner and not shared */}
                      {exercice.user_id === user?.id && exercice.status !== "shared" && !exercice.is_copy && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleShare(exercice)}
                        >
                          {exercice.status === "pending" ? (
                            <>
                              <X className="w-4 h-4 mr-1" />
                              Annuler
                            </>
                          ) : (
                            <>
                              <Users className="w-4 h-4 mr-1" />
                              Partager
                            </>
                          )}
                        </Button>
                      )}

                      {/* Copy - for shared or platform exercices not owned by user */}
                      {exercice.user_id !== user?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyExercice(exercice)}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Dupliquer
                        </Button>
                      )}

                      {/* Admin actions */}
                      {isAdmin && (
                        <>
                          {exercice.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-500 border-green-500/30"
                              onClick={() => validateExercice(exercice)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Valider
                            </Button>
                          )}
                          {!featuredExerciceIds.includes(exercice.id) && exercice.status === "shared" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-purple-500 border-purple-500/30"
                              onClick={() => addToPlatform(exercice)}
                            >
                              <Shield className="w-4 h-4 mr-1" />
                              Plateforme
                            </Button>
                          )}
                          {featuredExerciceIds.includes(exercice.id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-500 border-red-500/30"
                              onClick={() => removeFromPlatform(exercice.id)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Retirer
                            </Button>
                          )}
                        </>
                      )}

                      {/* Delete */}
                      {canDelete(exercice) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30"
                          onClick={() => deleteExercice(exercice.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'exercice</DialogTitle>
          </DialogHeader>
          <ExerciceForm
            formData={formData}
            setFormData={setFormData}
            pathologies={pathologies}
            toggleTag={toggleTag}
            onSubmit={handleUpdate}
            submitLabel="Enregistrer"
            isUploading={isUploading}
          />
        </DialogContent>
      </Dialog>

      {/* Video Dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedExercice?.title}</DialogTitle>
          </DialogHeader>
          {selectedExercice?.video_url && (
            <div className="aspect-video">
              <video
                src={selectedExercice.video_url}
                controls
                autoPlay
                className="w-full h-full rounded-lg"
              />
            </div>
          )}
          {selectedExercice?.description && (
            <p className="text-muted-foreground">{selectedExercice.description}</p>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

interface ExerciceFormProps {
  formData: {
    title: string;
    description: string;
    pathologie_tags: string[];
    newPathologie: string;
    videoFile: File | null;
    video_url: string;
    thumbnail_url: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    title: string;
    description: string;
    pathologie_tags: string[];
    newPathologie: string;
    videoFile: File | null;
    video_url: string;
    thumbnail_url: string;
  }>>;
  pathologies: string[];
  toggleTag: (tag: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  isUploading?: boolean;
}

function ExerciceForm({ formData, setFormData, pathologies, toggleTag, onSubmit, submitLabel, isUploading }: ExerciceFormProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error("Veuillez sélectionner un fichier vidéo");
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("La vidéo ne doit pas dépasser 50 Mo");
      return;
    }

    setFormData({ ...formData, videoFile: file });
    
    // Create video preview
    const videoUrl = URL.createObjectURL(file);
    setVideoPreview(videoUrl);

    // Generate thumbnail from video
    generateThumbnail(file);
  };

  const generateThumbnail = (file: File) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    
    video.onloadeddata = () => {
      // Seek to 1 second or 10% of the video
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setThumbnailPreview(thumbnailDataUrl);
      }
      URL.revokeObjectURL(video.src);
    };
  };

  const removeVideo = () => {
    setFormData({ ...formData, videoFile: null, video_url: "", thumbnail_url: "" });
    setVideoPreview(null);
    setThumbnailPreview(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  // Show existing video if no new file selected
  const displayVideoUrl = videoPreview || formData.video_url;
  const displayThumbnailUrl = thumbnailPreview || formData.thumbnail_url;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Titre *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Nom de l'exercice"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Description de l'exercice"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Tags pathologie</Label>
        <p className="text-xs text-muted-foreground">Cliquez pour sélectionner plusieurs tags</p>
        <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30 min-h-[60px]">
          {pathologies.map((pathologie) => (
            <Badge
              key={pathologie}
              variant={formData.pathologie_tags.includes(pathologie) ? "default" : "outline"}
              className="cursor-pointer transition-all hover:scale-105"
              onClick={() => toggleTag(pathologie)}
            >
              {formData.pathologie_tags.includes(pathologie) && <Check className="w-3 h-3 mr-1" />}
              {pathologie}
            </Badge>
          ))}
          {pathologies.length === 0 && (
            <span className="text-sm text-muted-foreground">Aucun tag disponible</span>
          )}
        </div>
        {formData.pathologie_tags.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {formData.pathologie_tags.length} tag(s) sélectionné(s)
          </p>
        )}
        <Input
          value={formData.newPathologie}
          onChange={(e) => setFormData({ ...formData, newPathologie: e.target.value })}
          placeholder="Ajouter un nouveau tag pathologie..."
        />
      </div>

      <div className="space-y-2">
        <Label>Vidéo</Label>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          className="hidden"
        />
        
        {displayVideoUrl ? (
          <div className="space-y-2">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              {displayThumbnailUrl && (
                <img 
                  src={displayThumbnailUrl} 
                  alt="Vignette" 
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="w-12 h-12 text-white" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => videoInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Changer la vidéo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeVideo}
                className="text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => videoInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Cliquez pour télécharger une vidéo
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              MP4, WebM, MOV (max. 50 Mo)
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          La vignette sera générée automatiquement à partir de la vidéo
        </p>
      </div>

      <Button 
        onClick={onSubmit} 
        className="w-full gradient-primary text-primary-foreground"
        disabled={isUploading}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Téléchargement en cours...
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </div>
  );
}
