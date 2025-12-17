import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Plus, Heart, MessageCircle, Trash2, Video, X, Search, Users, User, Shield, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface SeanceType {
  id: string;
  pathologie: string;
  objectif_principal: string;
  objectif_secondaire: string | null;
  author_name: string | null;
  is_shared: boolean;
  is_copy: boolean;
  is_validated: boolean;
  original_id: string | null;
  user_id: string;
  created_at: string;
  exercices?: SeanceExercice[];
  likes_count?: number;
  comments_count?: number;
  user_liked?: boolean;
}

interface SeanceExercice {
  id: string;
  video_id: string | null;
  ordre: number;
  description: string | null;
  video?: {
    id: string;
    title: string;
    thumbnail_url: string | null;
  };
}

interface VideoOption {
  id: string;
  title: string;
  thumbnail_url: string | null;
  description?: string | null;
  video_url?: string;
  duration?: number | null;
  category?: string | null;
}

interface VideoDetail {
  id: string;
  title: string;
  thumbnail_url: string | null;
  description: string | null;
  video_url: string;
  duration: number | null;
  category: string | null;
}

type FilterType = "all" | "mine" | "shared";

export default function SeanceType() {
  const { user } = useAuth();
  const [userPseudo, setUserPseudo] = useState<string | null>(null);
  const [userCanShare, setUserCanShare] = useState<boolean>(true);
  const [seances, setSeances] = useState<SeanceType[]>([]);
  const [filteredSeances, setFilteredSeances] = useState<SeanceType[]>([]);
  const [featuredSeanceIds, setFeaturedSeanceIds] = useState<string[]>([]);
  const [pathologies, setPathologies] = useState<string[]>([]);
  const [objectifs, setObjectifs] = useState<{ principal: string[]; secondaire: string[] }>({ principal: [], secondaire: [] });
  const [videos, setVideos] = useState<VideoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [videoDetailDialogOpen, setVideoDetailDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoDetail | null>(null);
  const [selectedSeance, setSelectedSeance] = useState<SeanceType | null>(null);
  const [comments, setComments] = useState<{ id: string; content: string; created_at: string }[]>([]);
  const [newComment, setNewComment] = useState("");
  
  // Filter and search state
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    pathologie: "",
    newPathologie: "",
    objectif_principal: "",
    newObjectifPrincipal: "",
    objectif_secondaire: "",
    newObjectifSecondaire: "",
    exercices: [] as { video_id: string; description: string }[]
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [seances, filter, searchQuery, user, featuredSeanceIds]);

  const applyFilters = () => {
    let result = [...seances];

    // Get IDs of originals that the user has copied
    const userCopiedOriginalIds = seances
      .filter((s) => s.is_copy && s.user_id === user?.id && s.original_id)
      .map((s) => s.original_id);

    // Filter out originals that user has already copied
    result = result.filter((s) => !userCopiedOriginalIds.includes(s.id));

    // Filter out copies from other users (except featured ones)
    result = result.filter((s) => {
      // Keep if not a copy
      if (!s.is_copy) return true;
      // Keep if it's the user's own copy
      if (s.user_id === user?.id) return true;
      // Keep if it's featured by admin
      if (featuredSeanceIds.includes(s.id)) return true;
      // Otherwise hide copies from other users
      return false;
    });

    // Apply filter type
    if (filter === "mine") {
      result = result.filter((s) => s.user_id === user?.id);
    } else if (filter === "shared") {
      result = result.filter((s) => s.is_shared && s.user_id !== user?.id);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.author_name?.toLowerCase().includes(query) ||
          s.pathologie.toLowerCase().includes(query) ||
          s.objectif_principal.toLowerCase().includes(query)
      );
    }

    setFilteredSeances(result);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user pseudo
      const { data: profileData } = await supabase
        .from("profiles")
        .select("pseudo, can_share")
        .eq("user_id", user!.id)
        .single();
      
      setUserPseudo(profileData?.pseudo || null);
      setUserCanShare(profileData?.can_share !== false);

      // Fetch featured seances
      const { data: featuredData } = await supabase
        .from("featured_seances")
        .select("seance_type_id");
      setFeaturedSeanceIds(featuredData?.map((f) => f.seance_type_id) || []);

      // Fetch seance types
      const { data: seancesData, error: seancesError } = await supabase
        .from("seance_types")
        .select("*")
        .order("created_at", { ascending: false });

      if (seancesError) throw seancesError;

      // Fetch exercices for each seance
      const seancesWithDetails = await Promise.all(
        (seancesData || []).map(async (seance) => {
          const { data: exercicesData } = await supabase
            .from("seance_exercices")
            .select("*, videos(id, title, thumbnail_url)")
            .eq("seance_type_id", seance.id)
            .order("ordre");

          const { count: likesCount } = await supabase
            .from("seance_likes")
            .select("*", { count: "exact", head: true })
            .eq("seance_type_id", seance.id);

          const { count: commentsCount } = await supabase
            .from("seance_comments")
            .select("*", { count: "exact", head: true })
            .eq("seance_type_id", seance.id);

          const { data: userLike } = await supabase
            .from("seance_likes")
            .select("id")
            .eq("seance_type_id", seance.id)
            .eq("user_id", user?.id)
            .maybeSingle();

          return {
            ...seance,
            exercices: exercicesData?.map((ex) => ({
              ...ex,
              video: ex.videos
            })) || [],
            likes_count: likesCount || 0,
            comments_count: commentsCount || 0,
            user_liked: !!userLike
          };
        })
      );

      setSeances(seancesWithDetails);

      // Fetch pathologies
      const { data: pathoData } = await supabase
        .from("pathologies")
        .select("name");
      setPathologies([...new Set(pathoData?.map((p) => p.name) || [])]);

      // Fetch objectifs
      const { data: objData } = await supabase
        .from("objectifs")
        .select("name, type");
      setObjectifs({
        principal: [...new Set(objData?.filter((o) => o.type === "principal").map((o) => o.name) || [])],
        secondaire: [...new Set(objData?.filter((o) => o.type === "secondaire").map((o) => o.name) || [])]
      });

      // Fetch videos
      const { data: videosData } = await supabase
        .from("videos")
        .select("id, title, thumbnail_url");
      setVideos(videosData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    const pathologie = formData.newPathologie || formData.pathologie;
    const objectif_principal = formData.newObjectifPrincipal || formData.objectif_principal;
    const objectif_secondaire = formData.newObjectifSecondaire || formData.objectif_secondaire;

    if (!pathologie || !objectif_principal) {
      toast.error("Pathologie et objectif principal requis");
      return;
    }

    try {
      // Create seance type
      const { data: seanceData, error: seanceError } = await supabase
        .from("seance_types")
        .insert({
          user_id: user.id,
          pathologie,
          objectif_principal,
          objectif_secondaire: objectif_secondaire || null,
          author_name: userPseudo,
          is_shared: false
        })
        .select()
        .single();

      if (seanceError) throw seanceError;

      // Save new pathologie if created
      if (formData.newPathologie) {
        await supabase.from("pathologies").insert({ user_id: user.id, name: formData.newPathologie });
      }

      // Save new objectifs if created
      if (formData.newObjectifPrincipal) {
        await supabase.from("objectifs").insert({ user_id: user.id, name: formData.newObjectifPrincipal, type: "principal" });
      }
      if (formData.newObjectifSecondaire) {
        await supabase.from("objectifs").insert({ user_id: user.id, name: formData.newObjectifSecondaire, type: "secondaire" });
      }

      // Create exercices
      for (let i = 0; i < formData.exercices.length; i++) {
        const ex = formData.exercices[i];
        await supabase.from("seance_exercices").insert({
          seance_type_id: seanceData.id,
          video_id: ex.video_id || null,
          description: ex.description || null,
          ordre: i
        });
      }

      toast.success("Séance type créée avec succès");
      setDialogOpen(false);
      setFormData({
        pathologie: "",
        newPathologie: "",
        objectif_principal: "",
        newObjectifPrincipal: "",
        objectif_secondaire: "",
        newObjectifSecondaire: "",
        exercices: []
      });
      fetchData();
    } catch (error) {
      console.error("Error creating seance:", error);
      toast.error("Erreur lors de la création");
    }
  };

  const toggleShare = async (seanceId: string, currentlyShared: boolean, isCopy: boolean, isValidated: boolean) => {
    if (isCopy) {
      toast.error("Les copies ne peuvent pas être partagées");
      return;
    }
    if (!userCanShare) {
      toast.error("Vous n'avez pas la permission de partager du contenu");
      return;
    }
    if (isValidated && currentlyShared) {
      toast.error("Cette séance a été validée et ne peut plus être modifiée");
      return;
    }
    try {
      await supabase
        .from("seance_types")
        .update({ is_shared: !currentlyShared, is_validated: false })
        .eq("id", seanceId);
      
      toast.success(currentlyShared ? "Séance non partagée" : "Séance partagée (en attente de validation)");
      fetchData();
    } catch (error) {
      console.error("Error toggling share:", error);
      toast.error("Erreur lors du partage");
    }
  };

  const handleLike = async (seanceId: string, currentlyLiked: boolean) => {
    if (!user) return;

    try {
      if (currentlyLiked) {
        await supabase
          .from("seance_likes")
          .delete()
          .eq("seance_type_id", seanceId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("seance_likes")
          .insert({ seance_type_id: seanceId, user_id: user.id });
      }
      fetchData();
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const openComments = async (seance: SeanceType) => {
    setSelectedSeance(seance);
    const { data } = await supabase
      .from("seance_comments")
      .select("id, content, created_at")
      .eq("seance_type_id", seance.id)
      .order("created_at", { ascending: false });
    setComments(data || []);
    setCommentsDialogOpen(true);
  };

  const addComment = async () => {
    if (!user || !selectedSeance || !newComment.trim()) return;

    try {
      await supabase.from("seance_comments").insert({
        seance_type_id: selectedSeance.id,
        user_id: user.id,
        content: newComment.trim()
      });
      setNewComment("");
      openComments(selectedSeance);
      fetchData();
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const deleteSeance = async (id: string) => {
    try {
      await supabase.from("seance_types").delete().eq("id", id);
      toast.success("Séance supprimée");
      fetchData();
    } catch (error) {
      console.error("Error deleting seance:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const openVideoDetail = async (videoId: string) => {
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, thumbnail_url, description, video_url, duration, category")
        .eq("id", videoId)
        .single();

      if (error) throw error;
      if (data) {
        setSelectedVideo(data);
        setVideoDetailDialogOpen(true);
      }
    } catch (error) {
      console.error("Error fetching video details:", error);
      toast.error("Erreur lors du chargement de l'exercice");
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const copySeance = async (seance: SeanceType) => {
    if (!user) return;

    try {
      // Create the seance copy
      const { data: newSeance, error: seanceError } = await supabase
        .from("seance_types")
        .insert({
          user_id: user.id,
          pathologie: seance.pathologie,
          objectif_principal: seance.objectif_principal,
          objectif_secondaire: seance.objectif_secondaire,
          author_name: seance.author_name,
          is_shared: false,
          is_copy: true,
          original_id: seance.id,
        })
        .select()
        .single();

      if (seanceError) throw seanceError;

      // Copy exercices
      if (seance.exercices && seance.exercices.length > 0) {
        for (const ex of seance.exercices) {
          await supabase.from("seance_exercices").insert({
            seance_type_id: newSeance.id,
            video_id: ex.video_id,
            description: ex.description,
            ordre: ex.ordre,
          });
        }
      }

      toast.success("Séance copiée dans votre bibliothèque");
      fetchData();
    } catch (error) {
      console.error("Error copying seance:", error);
      toast.error("Erreur lors de la copie");
    }
  };
  const addExercice = () => {
    setFormData({
      ...formData,
      exercices: [...formData.exercices, { video_id: "", description: "" }]
    });
  };

  const removeExercice = (index: number) => {
    setFormData({
      ...formData,
      exercices: formData.exercices.filter((_, i) => i !== index)
    });
  };

  const updateExercice = (index: number, field: string, value: string) => {
    const updated = [...formData.exercices];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, exercices: updated });
  };

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Connectez-vous pour accéder à cette page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10">
              <Calendar className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Séance Type</h1>
              <p className="text-muted-foreground">Gérez vos modèles de séances prédéfinies</p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nouvelle séance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer une séance type</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {userPseudo ? (
                  <p className="text-sm text-muted-foreground">Auteur: <span className="font-medium text-foreground">{userPseudo}</span></p>
                ) : (
                  <p className="text-sm text-amber-600">Définissez votre pseudo dans votre profil pour qu'il apparaisse comme auteur</p>
                )}

                {/* Pathologie */}
                <div className="space-y-2">
                  <Label>Pathologie</Label>
                  <Select value={formData.pathologie} onValueChange={(v) => setFormData({ ...formData, pathologie: v, newPathologie: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner ou créer" />
                    </SelectTrigger>
                    <SelectContent>
                      {pathologies.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Créer nouveau</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.pathologie === "__new__" && (
                    <Input
                      placeholder="Nouvelle pathologie"
                      value={formData.newPathologie}
                      onChange={(e) => setFormData({ ...formData, newPathologie: e.target.value })}
                    />
                  )}
                </div>

                {/* Objectif Principal */}
                <div className="space-y-2">
                  <Label>Objectif Principal</Label>
                  <Select value={formData.objectif_principal} onValueChange={(v) => setFormData({ ...formData, objectif_principal: v, newObjectifPrincipal: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner ou créer" />
                    </SelectTrigger>
                    <SelectContent>
                      {objectifs.principal.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Créer nouveau</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.objectif_principal === "__new__" && (
                    <Input
                      placeholder="Nouvel objectif principal"
                      value={formData.newObjectifPrincipal}
                      onChange={(e) => setFormData({ ...formData, newObjectifPrincipal: e.target.value })}
                    />
                  )}
                </div>

                {/* Objectif Secondaire */}
                <div className="space-y-2">
                  <Label>Objectif Secondaire (optionnel)</Label>
                  <Select value={formData.objectif_secondaire} onValueChange={(v) => setFormData({ ...formData, objectif_secondaire: v, newObjectifSecondaire: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner ou créer" />
                    </SelectTrigger>
                    <SelectContent>
                      {objectifs.secondaire.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Créer nouveau</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.objectif_secondaire === "__new__" && (
                    <Input
                      placeholder="Nouvel objectif secondaire"
                      value={formData.newObjectifSecondaire}
                      onChange={(e) => setFormData({ ...formData, newObjectifSecondaire: e.target.value })}
                    />
                  )}
                </div>

                {/* Exercices */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Exercices</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addExercice}>
                      <Plus className="w-4 h-4 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {formData.exercices.map((ex, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Exercice {index + 1}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeExercice(index)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <Select value={ex.video_id} onValueChange={(v) => updateExercice(index, "video_id", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un exercice" />
                        </SelectTrigger>
                        <SelectContent>
                          {videos.map((v) => (
                            <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        placeholder="Description / commentaires"
                        value={ex.description}
                        onChange={(e) => updateExercice(index, "description", e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <Button onClick={handleSubmit} className="w-full">Créer la séance</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Filter Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("all")}
                  className="gap-2"
                >
                  <Users className="w-4 h-4" />
                  Toutes
                </Button>
                <Button
                  variant={filter === "mine" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("mine")}
                  className="gap-2"
                >
                  <User className="w-4 h-4" />
                  Mes séances
                </Button>
                <Button
                  variant={filter === "shared" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("shared")}
                  className="gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Partagées
                </Button>
              </div>

              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par auteur, pathologie ou objectif..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modèles de séances ({filteredSeances.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Chargement...</p>
            ) : filteredSeances.length === 0 ? (
              <p className="text-muted-foreground">Aucune séance type trouvée.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Auteur</TableHead>
                      <TableHead>Partagée</TableHead>
                      <TableHead>Pathologie</TableHead>
                      <TableHead>Objectif Principal</TableHead>
                      <TableHead>Objectif Secondaire</TableHead>
                      <TableHead>Exercices</TableHead>
                      <TableHead>Interactions</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSeances.map((seance) => {
                      const isOwner = seance.user_id === user?.id;
                      const canShare = isOwner && !seance.is_copy;
                      return (
                      <TableRow key={seance.id}>
                        <TableCell>
                          <span className="font-medium">{seance.author_name || "Anonyme"}</span>
                          {seance.is_copy && (
                            <Badge variant="outline" className="ml-2 text-xs">Copie</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {canShare ? (
                            <>
                              <Checkbox
                                checked={seance.is_shared}
                                onCheckedChange={() => toggleShare(seance.id, seance.is_shared, seance.is_copy || false, seance.is_validated || false)}
                                disabled={seance.is_validated && seance.is_shared}
                              />
                              {seance.is_shared && seance.is_validated && (
                                <Badge className="ml-2 text-xs bg-green-500">Validé</Badge>
                              )}
                              {seance.is_shared && !seance.is_validated && (
                                <Badge variant="secondary" className="ml-2 text-xs bg-orange-500">En attente</Badge>
                              )}
                            </>
                          ) : isOwner && seance.is_copy ? (
                            <span className="text-xs text-muted-foreground">Non partageable</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Badge variant={seance.is_shared ? "default" : "outline"}>
                                {seance.is_shared ? "Oui" : "Non"}
                              </Badge>
                              {seance.is_shared && seance.is_validated && (
                                <Badge className="text-xs bg-green-500">Validé</Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{seance.pathologie}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{seance.objectif_principal}</Badge>
                        </TableCell>
                        <TableCell>
                          {seance.objectif_secondaire ? (
                            <Badge variant="outline">{seance.objectif_secondaire}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2 max-w-xs">
                            {seance.exercices?.map((ex, i) => (
                              <div
                                key={ex.id}
                                className={`flex items-start gap-2 text-sm ${ex.video_id ? "cursor-pointer hover:bg-muted/50 rounded p-1 -m-1 transition-colors" : ""}`}
                                onClick={() => ex.video_id && openVideoDetail(ex.video_id)}
                              >
                                {ex.video?.thumbnail_url ? (
                                  <img
                                    src={ex.video.thumbnail_url}
                                    alt={ex.video.title}
                                    className="w-12 h-8 object-cover rounded flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                                    <Video className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate hover:text-primary">{ex.video?.title || `Exercice ${i + 1}`}</p>
                                  {ex.description && (
                                    <p className="text-muted-foreground text-xs truncate">{ex.description}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {(!seance.exercices || seance.exercices.length === 0) && (
                              <span className="text-muted-foreground text-sm">Aucun exercice</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`gap-1 ${seance.user_liked ? "text-red-500" : ""}`}
                              onClick={() => handleLike(seance.id, seance.user_liked || false)}
                            >
                              <Heart className={`w-4 h-4 ${seance.user_liked ? "fill-current" : ""}`} />
                              {seance.likes_count}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => openComments(seance)}
                            >
                              <MessageCircle className="w-4 h-4" />
                              {seance.comments_count}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!isOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copySeance(seance)}
                                title="Copier dans ma bibliothèque"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            )}
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => deleteSeance(seance.id)}
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

        {/* Comments Dialog */}
        <Dialog open={commentsDialogOpen} onOpenChange={setCommentsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Commentaires</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Ajouter un commentaire..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment()}
                />
                <Button onClick={addComment}>Envoyer</Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Aucun commentaire</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="p-2 bg-muted rounded-lg">
                      <p className="text-sm">{c.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(c.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Exercice Detail Dialog */}
        <Dialog open={videoDetailDialogOpen} onOpenChange={setVideoDetailDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Détail de l'exercice
              </DialogTitle>
            </DialogHeader>
            {selectedVideo && (
              <div className="space-y-4">
                {/* Video Player or Thumbnail */}
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  {selectedVideo.video_url ? (
                    <video
                      src={selectedVideo.video_url}
                      controls
                      className="w-full h-full object-contain"
                      poster={selectedVideo.thumbnail_url || undefined}
                    >
                      Votre navigateur ne supporte pas la lecture de vidéos.
                    </video>
                  ) : selectedVideo.thumbnail_url ? (
                    <img
                      src={selectedVideo.thumbnail_url}
                      alt={selectedVideo.title}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Video Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {selectedVideo.category && (
                      <Badge variant="outline">{selectedVideo.category}</Badge>
                    )}
                    {selectedVideo.duration && (
                      <span>Durée: {formatDuration(selectedVideo.duration)}</span>
                    )}
                  </div>

                  {selectedVideo.description && (
                    <div>
                      <h4 className="font-medium mb-1">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedVideo.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
