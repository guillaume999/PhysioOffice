import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Users, User, Shield, Copy, Trash2, Edit, Play, X, Check, Upload, Loader2, Video, Library } from "lucide-react";
import { pb, getFileUrl } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { PagePopup } from "@/components/popup/PagePopup";
import { SearchableCreatableSelect } from "@/components/seance/SearchableCreatableSelect";
import { TagReferenceSelect } from "@/components/tags/TagReferenceSelect";

interface VideoLibraryItem {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
}

interface Exercice {
  id: string;
  code: string;
  title: string;
  description: string | null;
  commentaire: string | null;
  pathologie_tags: string[];
  objectif_tags: string[];
  status: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_id: string | null;
  is_platform: boolean;
  is_copy: boolean;
  original_id: string | null;
  author_name: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
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
  const [objectifs, setObjectifs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [selectedExercice, setSelectedExercice] = useState<Exercice | null>(null);
  const [exerciceToDelete, setExerciceToDelete] = useState<Exercice | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [filter, setFilter] = useState<FilterType>("mine");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    commentaire: "",
    pathologie_tags: [] as string[],
    objectif_tags: [] as string[],
    videoFile: null as File | null,
    video_url: "",
    thumbnail_url: "",
    video_id: null as string | null,
    video_title: ""
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

    // Get IDs of originals that the user has copied (for hiding in shared view)
    const userCopiedOriginalIds = exercices
      .filter((e) => e.is_copy && e.user_id === user?.id && e.original_id)
      .map((e) => e.original_id);

    // Filter out originals that user has already copied (in shared view)
    if (filter === "shared") {
      result = result.filter((e) => !userCopiedOriginalIds.includes(e.id));
    }

    // Apply filter type
    if (filter === "mine") {
      result = result.filter((e) => {
        // Only show user's exercises
        if (e.user_id !== user?.id) return false;
        // Hide legacy "share copies" (created by old system): original_id set but not a user copy
        if (e.original_id && !e.is_copy) return false;
        // Hide exercises that user has deleted from their library (soft delete)
        if ((e as any).deleted_by_author) return false;
        return true;
      });
    } else if (filter === "platform") {
      result = result.filter((e) => featuredExerciceIds.includes(e.id));
    } else if (filter === "shared") {
      result = result.filter((e) => 
        e.status === "shared" && 
        !featuredExerciceIds.includes(e.id) &&
        !(e as any).deleted_by_author
      );
    }

    // Apply search (including code)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.code?.toLowerCase().includes(query) ||
          e.title.toLowerCase().includes(query) ||
          e.description?.toLowerCase().includes(query) ||
          e.pathologie_tags.some(tag => tag.toLowerCase().includes(query)) ||
          e.author_name?.toLowerCase().includes(query)
      );
    }

    setFilteredExercices(result);
  };

  const getFilterCounts = () => {
    const userCopiedOriginalIds = exercices
      .filter((e) => e.is_copy && e.user_id === user?.id && e.original_id)
      .map((e) => e.original_id);

    const mine = exercices.filter((e) => {
      if (e.user_id !== user?.id) return false;
      if (e.original_id && !e.is_copy) return false;
      if ((e as any).deleted_by_author) return false;
      return true;
    }).length;

    const platform = exercices.filter((e) => featuredExerciceIds.includes(e.id)).length;

    const shared = exercices.filter((e) => 
      e.status === "shared" && 
      !featuredExerciceIds.includes(e.id) &&
      !(e as any).deleted_by_author &&
      !userCopiedOriginalIds.includes(e.id)
    ).length;

    return { mine, platform, shared };
  };

  const filterCounts = getFilterCounts();

  // Check if an exercise is on the platform
  const isOnPlatform = (exerciceId: string) => {
    return featuredExerciceIds.includes(exerciceId);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user profile
      const rec = pb.authStore.record;
      setUserPseudo(rec?.pseudo || rec?.name || rec?.email || null);
      setUserCanShare(rec?.can_share !== false);

      const userFilter = user ? `user = "${user.id}"` : undefined;
      const [featuredData, exercicesData, pathoData, objectifData] = await Promise.all([
        pb.collection("featured_exercices").getFullList({ fields: "exercice" }),
        pb.collection("exercices").getFullList({ sort: "-created" }),
        pb.collection("pathologies").getFullList({ fields: "name", filter: userFilter }),
        pb.collection("objectifs").getFullList({ fields: "name", filter: userFilter }),
      ]);
      setFeaturedExerciceIds(featuredData.map((f: any) => f.exercice));
      // PocketBase renvoie les champs relation/système bruts (user, original, video, created).
      // On les mappe vers les noms attendus par le composant (user_id, original_id, video_id, created_at)
      // sinon le filtre "Mes exercices" (e.user_id !== user.id) écarte tous les exercices de l'utilisateur.
      const mappedExercices = (exercicesData as any[]).map((r: any) => ({
        ...r,
        user_id: r.user,
        original_id: r.original ?? null,
        video_id: r.video ?? null,
        created_at: r.created,
        updated_at: r.updated,
      }));
      setExercices(mappedExercices as any[]);
      setPathologies([...new Set(pathoData.map((p: any) => p.name as string))]);
      setObjectifs([...new Set((objectifData as any[]).map((o: any) => o.name as string).filter(Boolean))]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const uploadVideoToStorage = async (videoFile: File): Promise<{ publicUrl: string; objectName: string }> => {
    if (!user) throw new Error("Not authenticated");

    // Normalize extension: take from file name or fallback to mime type
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

    // Upload via PocketBase videos collection
    const formData = new FormData();
    formData.append("file", videoFile);
    formData.append("user", user.id);
    formData.append("name", objectName);
    const videoRecord = await pb.collection("exercice_videos").create(formData);
    const publicUrl = pb.files.getURL(videoRecord, videoRecord.file as string);
    return { publicUrl, objectName: videoRecord.id };
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!formData.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    setIsUploading(true);
    try {
      // Persister les nouveaux items dans les tables de référence
      for (const p of formData.pathologie_tags) {
        if (!pathologies.includes(p)) {
          await pb.collection("pathologies").create({ user: user.id, name: p });
        }
      }
      for (const o of formData.objectif_tags) {
        if (!objectifs.includes(o)) {
          await pb.collection("objectifs").create({ user: user.id, name: o, type: "principal" });
        }
      }

      let videoUrl = formData.video_url;
      let thumbnailUrl = formData.thumbnail_url;
      let videoId = formData.video_id;

      // Upload video if file selected (from phone) and add to video library
      if (formData.videoFile) {
        const uploaded = await uploadVideoToStorage(formData.videoFile);
        videoUrl = uploaded.publicUrl;
        thumbnailUrl = "";

        // Also add to video library
        try {
          const videoData = await pb.collection("videos").create({
            user: user.id, title: formData.title.trim() || formData.videoFile.name,
            video_url: uploaded.publicUrl, name: formData.videoFile.name, thumbnail_url: null,
          });
          videoId = videoData.id;
        } catch(e) { console.error("Error adding to video library:", e); }
      }

      await pb.collection("exercices").create({
          user: user.id, title: formData.title.trim(),
          description: formData.description.trim() || null,
          commentaire: formData.commentaire.trim() || null,
          pathologie_tags: formData.pathologie_tags,
          objectif_tags: formData.objectif_tags,
          video: videoId,
          video_url: videoUrl || null, thumbnail_url: thumbnailUrl || null,
          author_name: userPseudo, status: "draft",
        });

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
      for (const p of formData.pathologie_tags) {
        if (!pathologies.includes(p)) {
          await pb.collection("pathologies").create({ user: user.id, name: p });
        }
      }
      for (const o of formData.objectif_tags) {
        if (!objectifs.includes(o)) {
          await pb.collection("objectifs").create({ user: user.id, name: o, type: "principal" });
        }
      }

      let videoUrl = formData.video_url;
      let thumbnailUrl = formData.thumbnail_url;
      let videoId = formData.video_id;

      // Upload video if new file selected (from phone) and add to video library
      if (formData.videoFile) {
        const uploaded = await uploadVideoToStorage(formData.videoFile);
        videoUrl = uploaded.publicUrl;
        thumbnailUrl = "";

        // Also add to video library
        try {
          const videoData = await pb.collection("videos").create({
            user: user.id, title: formData.title.trim() || formData.videoFile.name,
            video_url: uploaded.publicUrl, name: formData.videoFile.name, thumbnail_url: null,
          });
          videoId = videoData.id;
        } catch(e) { console.error("Error adding to video library:", e); }
      }

      await pb.collection("exercices").update(selectedExercice.id, {
          title: formData.title.trim(), description: formData.description.trim() || null,
          commentaire: formData.commentaire.trim() || null,
          pathologie_tags: formData.pathologie_tags,
          objectif_tags: formData.objectif_tags,
          video: videoId, video_url: videoUrl || null, thumbnail_url: thumbnailUrl || null,
        });

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
      commentaire: "",
      pathologie_tags: [],
      objectif_tags: [],
      videoFile: null,
      video_url: "",
      thumbnail_url: "",
      video_id: null,
      video_title: ""
    });
    setSelectedExercice(null);
  };

  const openEditDialog = (exercice: Exercice) => {
    setSelectedExercice(exercice);
    setFormData({
      title: exercice.title,
      description: exercice.description || "",
      commentaire: exercice.commentaire || "",
      pathologie_tags: exercice.pathologie_tags || [],
      objectif_tags: exercice.objectif_tags || [],
      videoFile: null,
      video_url: exercice.video_url || "",
      thumbnail_url: exercice.thumbnail_url || "",
      video_id: exercice.video_id || null,
      video_title: ""
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

    try {
      // Toggle between draft and pending status
      if (exercice.status === "pending") {
        // Cancel the pending share - revert to draft
        await pb.collection("exercices").update(exercice.id, { status: "draft" });
        toast.success("Demande de partage annulée");
      } else if (exercice.status === "draft") {
        // Submit for sharing - change to pending
        await pb.collection("exercices").update(exercice.id, { status: "pending" })
;
        toast.success("Exercice soumis pour validation");
      } else if (exercice.status === "shared") {
        // Already shared - revert to draft (unshare)
        await pb.collection("exercices").update(exercice.id, { status: "draft" });
        toast.success("Exercice retiré du partage");
      }
      
      fetchData();
    } catch (error) {
      console.error("Error sharing exercice:", error);
      toast.error("Erreur lors du partage");
    }
  };

  const validateExercice = async (exercice: Exercice) => {
    try {
      await pb.collection("exercices").update(exercice.id, { status: "shared" });
      
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
      const newExercice = await pb.collection("exercices").create({
          user: user.id, title: exercice.title, description: exercice.description,
          pathologie_tags: exercice.pathologie_tags, video_url: exercice.video_url,
          thumbnail_url: exercice.thumbnail_url, author_name: exercice.author_name,
          is_platform: true, is_copy: true, original: exercice.id, status: "shared",
        });
      await pb.collection("featured_exercices").create({ exercice: newExercice.id, added_by: user.id });

      toast.success("Exercice ajouté à PhysioOfficeExercices");
      fetchData();
    } catch (error) {
      console.error("Error adding to platform:", error);
      toast.error("Erreur lors de l'ajout à la plateforme");
    }
  };

  const removeFromPlatform = async (exerciceId: string) => {
    try {
      const feats = await pb.collection("featured_exercices").getFullList({ filter: `exercice = "${exerciceId}"` });
      for (const f of feats) await pb.collection("featured_exercices").delete(f.id);

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
      await pb.collection("exercices").create({
          user: user.id, title: exercice.title, description: exercice.description,
          pathologie_tags: exercice.pathologie_tags, video_url: exercice.video_url,
          thumbnail_url: exercice.thumbnail_url, author_name: exercice.author_name,
          is_copy: true, original: exercice.id, status: "draft",
        });

      toast.success("Exercice copié dans votre bibliothèque");
      fetchData();
    } catch (error) {
      console.error("Error copying exercice:", error);
      toast.error("Erreur lors de la copie");
    }
  };

  const deleteExercice = async (exercice: Exercice) => {
    try {
      // Check if exercise is shared or on platform - use soft delete
      const isOnPlatform = featuredExerciceIds.includes(exercice.id);
      const isSharedOrPending = exercice.status === "shared" || exercice.status === "pending";
      
      if (isOnPlatform || isSharedOrPending) {
        // Soft delete - mark as deleted by author
        await pb.collection("exercices").update(exercice.id, { deleted_by_author: true });
        toast.success("Exercice retiré de votre bibliothèque");
      } else {
        // Hard delete for draft exercises
        await pb.collection("exercices").delete(exercice.id);
        toast.success("Exercice supprimé");
      }
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

  const addPathologie = (value: string) => {
    const v = value.trim();
    if (!v || formData.pathologie_tags.includes(v)) return;
    setFormData({ ...formData, pathologie_tags: [...formData.pathologie_tags, v] });
  };

  const removePathologie = (tag: string) => {
    setFormData({ ...formData, pathologie_tags: formData.pathologie_tags.filter(t => t !== tag) });
  };

  const addObjectif = (value: string) => {
    const v = value.trim();
    if (!v || formData.objectif_tags.includes(v)) return;
    setFormData({ ...formData, objectif_tags: [...formData.objectif_tags, v] });
  };

  const removeObjectif = (tag: string) => {
    setFormData({ ...formData, objectif_tags: formData.objectif_tags.filter(t => t !== tag) });
  };

  const getStatusBadge = (exercice: Exercice) => {
    // Check if on platform first
    if (featuredExerciceIds.includes(exercice.id)) {
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Plateforme</Badge>;
    }
    
    // For user's own exercises in "mine" filter
    if (filter === "mine" && exercice.user_id === user?.id) {
      if (exercice.status === "pending") {
        // Show cancel button for pending exercises
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleShare(exercice);
            }}
            className="h-7 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
          >
            <X className="w-3 h-3 mr-1" />
            Annuler partage
          </Button>
        );
      }
      
      if (exercice.status === "shared") {
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Partagé</Badge>;
      }
      
      // Draft status - show share button if allowed
      if (exercice.status === "draft" && !exercice.is_copy && userCanShare) {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleShare(exercice);
            }}
            className="h-7 text-xs"
          >
            <Users className="w-3 h-3 mr-1" />
            Partager
          </Button>
        );
      }
      
      return null;
    }
    
    // For other views (shared, platform)
    switch (exercice.status) {
      case "shared":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Partagé</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">En attente</Badge>;
      default:
        return null;
    }
  };

  const canEdit = (exercice: Exercice) => {
    const isExerciceOnPlatform = featuredExerciceIds.includes(exercice.id);
    // Admins can edit platform exercises
    if (isAdmin && isExerciceOnPlatform) return true;
    // Users can edit their own exercises (draft or pending) but not shared ones
    // Cannot edit copies or platform exercises
    return exercice.user_id === user?.id && 
           (exercice.status === "draft" || exercice.status === "pending") && 
           !isExerciceOnPlatform && 
           !exercice.is_copy;
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
      <PagePopup pageKey="exercices" />
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
                  objectifs={objectifs}
                  addPathologie={addPathologie}
                  removePathologie={removePathologie}
                  addObjectif={addObjectif}
                  removeObjectif={removeObjectif}
                  onTagsChanged={fetchData}
                  onSubmit={handleSubmit}
                  submitLabel="Créer"
                  isUploading={isUploading}
                  userId={user.id}
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
                Mes exercices ({filterCounts.mine})
              </Button>
              <Button
                variant={filter === "platform" ? "default" : "outline"}
                onClick={() => setFilter("platform")}
                className="flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                PhysioOffice ({filterCounts.platform})
              </Button>
              <Button
                variant={filter === "shared" ? "default" : "outline"}
                onClick={() => setFilter("shared")}
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Partagés ({filterCounts.shared})
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

          {/* Exercices Table */}
          {loading ? (
            <Card className="glass">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 animate-pulse">
                      <div className="w-24 h-16 bg-muted rounded" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : filteredExercices.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">
                  Aucun exercice trouvé
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Vidéo</TableHead>
                    <TableHead>
                      <div className="flex flex-col leading-tight">
                        <span>Titre</span>
                        <span className="text-xs font-normal text-muted-foreground">Pathologie</span>
                      </div>
                    </TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Commentaires</TableHead>
                    <TableHead>Auteur / Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExercices.map((exercice) => (
                    <TableRow key={exercice.id}>
                      {/* Thumbnail */}
                      <TableCell>
                        <ExerciceThumbnail
                          exercice={exercice}
                          onOpen={() => openVideoDialog(exercice)}
                        />
                      </TableCell>

                      {/* Title & Tags */}
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs uppercase px-1.5 py-0.5 bg-muted/50">
                              {exercice.code}
                            </Badge>
                            <p className="font-medium">{exercice.title}</p>
                          </div>
                          {exercice.pathologie_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {exercice.pathologie_tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Description */}
                      <TableCell>
                        {exercice.description ? (
                          <p className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
                            {exercice.description}
                          </p>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* Commentaires */}
                      <TableCell>
                        {exercice.commentaire ? (
                          <p className="text-sm text-muted-foreground italic line-clamp-2 max-w-xs">
                            {exercice.commentaire}
                          </p>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* Author / Status */}
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          {getStatusBadge(exercice)}
                          <span className="text-xs text-muted-foreground">
                            {exercice.author_name || "-"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* Edit */}
                          {canEdit(exercice) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(exercice)}
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}

                          {/* Copy - show for non-owners, and for admins on platform exercises */}
                          {(exercice.user_id !== user?.id || (isAdmin && featuredExerciceIds.includes(exercice.id))) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyExercice(exercice)}
                              title="Dupliquer"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          )}

                          {/* Admin actions */}
                          {isAdmin && (
                            <>
                              {exercice.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-green-500"
                                  onClick={() => validateExercice(exercice)}
                                  title="Valider"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                              {!featuredExerciceIds.includes(exercice.id) && exercice.status === "shared" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-purple-500"
                                  onClick={() => addToPlatform(exercice)}
                                  title="Ajouter à la plateforme"
                                >
                                  <Shield className="w-4 h-4" />
                                </Button>
                              )}
                              {featuredExerciceIds.includes(exercice.id) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500"
                                  onClick={() => removeFromPlatform(exercice.id)}
                                  title="Retirer de la plateforme"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </>
                          )}

                          {/* Delete */}
                          {canDelete(exercice) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => setExerciceToDelete(exercice)}
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!exerciceToDelete} onOpenChange={(open) => !open && setExerciceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'exercice ?</AlertDialogTitle>
            <AlertDialogDescription>
              {exerciceToDelete && (featuredExerciceIds.includes(exerciceToDelete.id) || exerciceToDelete.status === "shared" || exerciceToDelete.status === "pending")
                ? `« ${exerciceToDelete.title} » sera retiré de votre bibliothèque. La copie publique restera visible pour les autres utilisateurs.`
                : `« ${exerciceToDelete?.title ?? ""} » sera supprimé définitivement. Cette action est irréversible.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (exerciceToDelete) {
                  await deleteExercice(exerciceToDelete);
                  setExerciceToDelete(null);
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            objectifs={objectifs}
            addPathologie={addPathologie}
            removePathologie={removePathologie}
            addObjectif={addObjectif}
            removeObjectif={removeObjectif}
            onTagsChanged={fetchData}
            onSubmit={handleUpdate}
            submitLabel="Enregistrer"
            isUploading={isUploading}
            userId={user.id}
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

function createVideoThumbnailDataUrl(videoUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 6000);

    video.onloadeddata = () => {
      const t = Math.min(1.5, Math.max(0.1, video.duration * 0.1));
      video.currentTime = t;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          window.clearTimeout(timeout);
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        window.clearTimeout(timeout);
        cleanup();
        resolve(dataUrl);
      } catch {
        window.clearTimeout(timeout);
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      window.clearTimeout(timeout);
      cleanup();
      resolve(null);
    };
  });
}

function ExerciceThumbnail({
  exercice,
  onOpen,
}: {
  exercice: Exercice;
  onOpen: () => void;
}) {
  const [generatedThumb, setGeneratedThumb] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setThumbError(false);
    setGeneratedThumb(null);

    if (!exercice.video_url) return;
    if (exercice.thumbnail_url) return;

    createVideoThumbnailDataUrl(exercice.video_url).then((url) => {
      if (!cancelled) setGeneratedThumb(url);
    });

    return () => {
      cancelled = true;
    };
  }, [exercice.video_url, exercice.thumbnail_url]);

  const hasVideo = Boolean(exercice.video_url);
  const src = !thumbError ? (exercice.thumbnail_url ?? generatedThumb) : generatedThumb;

  return (
    <button
      type="button"
      disabled={!hasVideo}
      onClick={() => hasVideo && onOpen()}
      className={`w-24 h-16 bg-muted rounded overflow-hidden relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        hasVideo ? "cursor-pointer" : "cursor-default opacity-70"
      }`}
      aria-label={
        hasVideo ? `Lire la vidéo : ${exercice.title}` : `Aucune vidéo : ${exercice.title}`
      }
    >
      {hasVideo && src ? (
        <img
          src={src}
          alt={`Vignette vidéo - ${exercice.title}`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setThumbError(true)}
        />
      ) : hasVideo ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
          <Play className="w-6 h-6 text-muted-foreground" />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 text-center p-1">
          <span className="text-[10px] text-muted-foreground leading-tight">Aucune vidéo</span>
        </div>
      )}

      {hasVideo && (
        <div className="absolute inset-0 bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="w-6 h-6 text-background" />
        </div>
      )}
    </button>
  );
}


interface ExerciceFormProps {
  formData: {
    title: string;
    description: string;
    commentaire: string;
    pathologie_tags: string[];
    objectif_tags: string[];
    videoFile: File | null;
    video_url: string;
    thumbnail_url: string;
    video_id: string | null;
    video_title: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    title: string;
    description: string;
    commentaire: string;
    pathologie_tags: string[];
    objectif_tags: string[];
    videoFile: File | null;
    video_url: string;
    thumbnail_url: string;
    video_id: string | null;
    video_title: string;
  }>>;
  pathologies: string[];
  objectifs: string[];
  addPathologie: (value: string) => void;
  removePathologie: (tag: string) => void;
  addObjectif: (value: string) => void;
  removeObjectif: (tag: string) => void;
  onTagsChanged: () => void;
  onSubmit: () => void;
  submitLabel: string;
  isUploading?: boolean;
  userId: string;
}

function ExerciceForm({ formData, setFormData, pathologies, objectifs, addPathologie, removePathologie, addObjectif, removeObjectif, onTagsChanged, onSubmit, submitLabel, isUploading, userId }: ExerciceFormProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [libraryVideos, setLibraryVideos] = useState<VideoLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");

  const fetchLibraryVideos = async () => {
    setLibraryLoading(true);
    try {
      setLibraryVideos(await pb.collection("videos").getFullList({ filter: `user = "${userId}"`, sort: "-created", fields: "id,title,video_url,thumbnail_url" }) as any[]);
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
    setFormData({
      ...formData,
      videoFile: null,
      video_url: video.video_url,
      thumbnail_url: video.thumbnail_url || "",
      video_id: video.id,
      video_title: video.title
    });
    setVideoPreview(null);
    setThumbnailPreview(null);
    setLibraryDialogOpen(false);
    toast.success(`Vidéo "${video.title}" sélectionnée`);
  };

  const filteredLibraryVideos = librarySearch.trim()
    ? libraryVideos.filter(v => v.title.toLowerCase().includes(librarySearch.toLowerCase()))
    : libraryVideos;

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

    setFormData({ 
      ...formData,
      videoFile: file,
      video_id: null,
      video_url: "",
      thumbnail_url: "",
      video_title: file.name.replace(/\.[^/.]+$/, "")
    });
    
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
    setFormData({ ...formData, videoFile: null, video_url: "", thumbnail_url: "", video_id: null, video_title: "" });
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
        <Label htmlFor="commentaire">Commentaire</Label>
        <Textarea
          id="commentaire"
          value={formData.commentaire}
          onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
          placeholder="Commentaire (notes internes, précisions...)"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Pathologies</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.pathologie_tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <X className="w-3 h-3 cursor-pointer" onClick={() => removePathologie(tag)} />
            </Badge>
          ))}
          {formData.pathologie_tags.length === 0 && (
            <span className="text-xs text-muted-foreground">Aucune pathologie sélectionnée</span>
          )}
        </div>
        <TagReferenceSelect
          type="pathologie"
          options={pathologies.filter((p) => !formData.pathologie_tags.includes(p))}
          userId={userId}
          onSelect={addPathologie}
          onReferenceChanged={onTagsChanged}
          placeholder="Rechercher ou créer une pathologie"
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Objectifs</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.objectif_tags.map((tag) => (
            <Badge key={tag} variant="default" className="gap-1">
              {tag}
              <X className="w-3 h-3 cursor-pointer" onClick={() => removeObjectif(tag)} />
            </Badge>
          ))}
          {formData.objectif_tags.length === 0 && (
            <span className="text-xs text-muted-foreground">Aucun objectif sélectionné</span>
          )}
        </div>
        <TagReferenceSelect
          type="objectif"
          options={objectifs.filter((o) => !formData.objectif_tags.includes(o))}
          userId={userId}
          onSelect={addObjectif}
          onReferenceChanged={onTagsChanged}
          placeholder="Rechercher ou créer un objectif"
          className="w-full"
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
              {displayThumbnailUrl ? (
                <img 
                  src={displayThumbnailUrl} 
                  alt="Vignette" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={displayVideoUrl}
                  className="w-full h-full object-cover"
                  muted
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
                Importer
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openLibraryDialog}
                className="flex-1"
              >
                <Library className="w-4 h-4 mr-2" />
                Vidéothèque
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
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => videoInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importer une vidéo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={openLibraryDialog}
                className="flex-1"
              >
                <Library className="w-4 h-4 mr-2" />
                Vidéothèque
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              MP4, WebM, MOV (max. 50 Mo) ou sélectionnez depuis votre vidéothèque
            </p>
          </div>
        )}
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
