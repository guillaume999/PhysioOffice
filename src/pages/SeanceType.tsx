import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { softDelete, withActive, needsWithdrawalRequest, requestWithdrawal } from "@/lib/corbeille";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Hourglass, Ban, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Heart, MessageCircle, Trash2, Search, Users, User, Shield, Copy, Plus, Edit, Video, Play, X, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { SeanceFormDialog } from "@/components/seance/SeanceFormDialog";
import { MultiSelectFilter, ActiveFilterBadges } from "@/components/filters/MultiSelectFilter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PagePopup } from "@/components/popup/PagePopup";
import { ExercicePreviewDialog, type ExercicePreview } from "@/components/exercice/ExercicePreviewDialog";
import { normalizeSearch } from "@/lib/utils";

interface SeanceExercice {
  id: string;
  ordre: number;
  name: string | null;
  description: string | null;
  repetitions: number | null;
  duration_seconds: number | null;
  series: number;
  force_1: number | null;
  duration_seconds_2: number | null;
  force_2: number | null;
  comment: string | null;
  exercice_id: string | null;
  exercice?: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    video_url: string | null;
  } | null;
}

interface SeanceType {
  id: string;
  code: string;
  pathologie: string;
  pathologies: string[];
  objectifs: string[];
  objectif_principal: string;
  objectifs_principaux: string[];
  objectif_secondaire: string | null;
  objectifs_secondaires: string[];
  author_name: string | null;
  is_shared: boolean;
  is_copy: boolean;
  is_validated: boolean;
  is_refused?: boolean;
  withdrawal_requested?: boolean;
  withdrawal_refused?: boolean;
  is_hidden_from_list: boolean;
  original_id: string | null;
  user_id: string;
  created_at: string;
  exercices?: SeanceExercice[];
  likes_count?: number;
  comments_count?: number;
  user_liked?: boolean;
}

type FilterType = "mine" | "platform" | "shared"; // vues

export default function SeanceType() {
  const { user } = useAuth();
  const [userCanShare, setUserCanShare] = useState<boolean>(true);
  const [seances, setSeances] = useState<SeanceType[]>([]);
  const [seanceToDelete, setSeanceToDelete] = useState<SeanceType | null>(null);
  const [deletingSeance, setDeletingSeance] = useState(false);
  const [filteredSeances, setFilteredSeances] = useState<SeanceType[]>([]);
  const [featuredSeanceIds, setFeaturedSeanceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter and search state
  const [filter, setFilter] = useState<FilterType>("mine");
  const [searchQuery, setSearchQuery] = useState("");
  const [pathoFilter, setPathoFilter] = useState<string[]>([]);
  const [objectifFilter, setObjectifFilter] = useState<string[]>([]);

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingSeance, setEditingSeance] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoToPlay, setVideoToPlay] = useState<string | null>(null);
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());
  const [previewExercice, setPreviewExercice] = useState<ExercicePreview | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [seances, filter, searchQuery, pathoFilter, objectifFilter, user, featuredSeanceIds]);

  const applyFilters = () => {
    let result = [...seances];

    // Get IDs of originals that the user has copied (for hiding in shared view)
    const userCopiedOriginalIds = seances
      .filter((s) => s.is_copy && s.user_id === user?.id && s.original_id)
      .map((s) => s.original_id);

    // Filter out originals that user has already copied (in shared view)
    if (filter === "shared") {
      result = result.filter((s) => !userCopiedOriginalIds.includes(s.id));
    }

    // Apply filter type
    if (filter === "mine") {
      // Filter out hidden seances for "mine" view
      result = result.filter((s) => s.user_id === user?.id && !s.is_hidden_from_list);
    } else if (filter === "platform") {
      result = result.filter((s) => featuredSeanceIds.includes(s.id));
    } else if (filter === "shared") {
      result = result.filter((s) => 
        s.is_shared && 
        s.is_validated &&
        s.user_id !== user?.id && 
        !featuredSeanceIds.includes(s.id)
      );
    }

    // Recherche texte : code / auteur
    if (searchQuery.trim()) {
      const query = normalizeSearch(searchQuery);
      result = result.filter((s) =>
        normalizeSearch(s.code).includes(query) ||
        normalizeSearch(s.author_name).includes(query)
      );
    }

    // Filtre pathologies (OR entre les pathos sélectionnées, AND avec les autres filtres)
    if (pathoFilter.length > 0) {
      result = result.filter((s) =>
        getDisplayPathologies(s).some((tag) => pathoFilter.includes(tag))
      );
    }

    // Filtre objectifs (OR entre les objectifs sélectionnés, AND avec les autres filtres)
    if (objectifFilter.length > 0) {
      result = result.filter((s) =>
        getDisplayObjectifs(s).some((tag) => objectifFilter.includes(tag))
      );
    }

    setFilteredSeances(result);
  };

  const hasActiveFilters = searchQuery.trim() !== "" || pathoFilter.length > 0 || objectifFilter.length > 0;

  const clearAllFilters = () => {
    setSearchQuery("");
    setPathoFilter([]);
    setObjectifFilter([]);
  };

  const toggleTagFilter = (tag: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  };

  const getFilterCounts = () => {
    const userCopiedOriginalIds = seances
      .filter((s) => s.is_copy && s.user_id === user?.id && s.original_id)
      .map((s) => s.original_id);

    // Count only non-hidden seances for "mine"
    const mine = seances.filter((s) => s.user_id === user?.id && !s.is_hidden_from_list).length;
    const platform = seances.filter((s) => featuredSeanceIds.includes(s.id)).length;
    const shared = seances.filter((s) => 
      s.is_shared && 
      s.is_validated &&
      s.user_id !== user?.id && 
      !featuredSeanceIds.includes(s.id) &&
      !userCopiedOriginalIds.includes(s.id)
    ).length;

    return { mine, platform, shared };
  };

  const filterCounts = getFilterCounts();

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user profile
      setUserCanShare(pb.authStore.record?.can_share !== false);

      const [featuredData, seancesData] = await Promise.all([
        pb.collection("featured_seances").getFullList({ fields: "seance_type" }),
        pb.collection("seance_types").getFullList({ filter: withActive(), sort: "-created" }),
      ]);
      setFeaturedSeanceIds(featuredData.map((f: any) => f.seance_type));

      const seancesWithDetails = await Promise.all(
        seancesData.map(async (seance: any) => {
          const exercicesData = await pb.collection("seance_exercices").getFullList({
            filter: `seance_type = "${seance.id}"`, sort: "ordre", expand: "exercice",
          });
          const exercicesWithDetails = exercicesData.map((ex: any) => ({
            ...ex, exercice_id: ex.exercice, exercice: ex.expand?.exercice ?? null,
          }));

          const [likesRes, commentsRes, userLikeRes] = await Promise.all([
            pb.collection("seance_likes").getList(1, 1, { filter: `seance_type = "${seance.id}"` }),
            pb.collection("seance_comments").getList(1, 1, { filter: `seance_type = "${seance.id}"` }),
            pb.collection("seance_likes").getList(1, 1, { filter: `seance_type = "${seance.id}" && user = "${user?.id}"` }),
          ]);
          const likesCount = likesRes.totalItems;
          const commentsCount = commentsRes.totalItems;
          const userLike = userLikeRes.items[0] ?? null;

          return {
            ...seance,
            // PocketBase exposes the relation fields as `user`/`original` (not the
            // legacy Supabase column names `user_id`/`original_id`). Normalize them
            // so the ownership filters and duplication logic below work correctly.
            user_id: seance.user,
            original_id: seance.original ?? null,
            created_at: seance.created,
            pathologies: seance.pathologies || [],
            objectifs: seance.objectifs || [],
            objectifs_principaux: seance.objectifs_principaux || [],
            objectifs_secondaires: seance.objectifs_secondaires || [],
            exercices: exercicesWithDetails,
            likes_count: likesCount || 0,
            comments_count: commentsCount || 0,
            user_liked: !!userLike
          };
        })
      );

      setSeances(seancesWithDetails);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingSeance(null);
    setFormDialogOpen(true);
  };

  const openEditDialog = (seance: SeanceType) => {
    const principaux = seance.objectifs_principaux?.length > 0 ? seance.objectifs_principaux : (seance.objectif_principal ? [seance.objectif_principal] : []);
    const secondaires = seance.objectifs_secondaires?.length > 0 ? seance.objectifs_secondaires : (seance.objectif_secondaire ? [seance.objectif_secondaire] : []);
    setEditingSeance({
      id: seance.id,
      pathologies: seance.pathologies?.length > 0 ? seance.pathologies : [seance.pathologie],
      objectifs: getDisplayObjectifs(seance),
      objectifs_principaux: [...new Set([...principaux, ...secondaires].filter(Boolean))],
      objectifs_secondaires: [],
      exercices: (seance.exercices || []).map(ex => ({
        id: ex.id,
        exercice_id: ex.exercice_id,
        name: ex.name || "",
        description: ex.description || "",
        repetitions: ex.repetitions,
        duration_seconds: ex.duration_seconds,
        series: ex.series || 1,
        ordre: ex.ordre,
        video_url: ex.exercice?.video_url || null
      })),
      author_name: seance.author_name
    });
    setFormDialogOpen(true);
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
      await pb.collection("seance_types").update(seanceId, { is_shared: !currentlyShared, is_validated: false, is_refused: false });
      
      toast.success(currentlyShared ? "Séance non partagée" : "Séance partagée (en attente de validation)");
      fetchData();
    } catch (error) {
      console.error("Error toggling share:", error);
      toast.error("Erreur lors du partage");
    }
  };

  const handleLike = async (seanceId: string, currentlyLiked: boolean) => {
    if (!user) return;
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (currentlyLiked) {
        const likes = await pb.collection("seance_likes").getFullList({ filter: `seance_type = "${seanceId}" && user = "${user.id}"` });
        for (const l of likes) await pb.collection("seance_likes").delete(l.id);
      } else {
        await pb.collection("seance_likes").create({ seance_type: seanceId, user: user.id });
      }
      fetchData();
    } catch (error) {
      console.error("Error toggling like:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSeance = async (id: string) => {
    try {
      // Soft delete : la séance part à la corbeille. On laisse ses exercices
      // rattachés pour que la restauration la retrouve intacte.
      await softDelete("seance_types", id);
      toast.success("Séance déplacée vers la corbeille");
      fetchData();
    } catch (error) {
      console.error("Error deleting seance:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleConfirmDeleteSeance = async () => {
    if (!seanceToDelete) return;
    setDeletingSeance(true);
    try {
      await deleteSeance(seanceToDelete.id);
      setSeanceToDelete(null);
    } finally {
      setDeletingSeance(false);
    }
  };

  const handleWithdrawSeance = async () => {
    if (!seanceToDelete) return;
    setDeletingSeance(true);
    try {
      await requestWithdrawal("seance_types", seanceToDelete.id);
      toast.success("Demande de retrait envoyée à l'administrateur");
      setSeanceToDelete(null);
    } catch (error) {
      console.error("Error requesting withdrawal:", error);
      toast.error("Erreur lors de la demande de retrait");
    } finally {
      setDeletingSeance(false);
    }
  };

  const duplicateSeance = async (seance: SeanceType) => {
    if (!user) return;
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const profileData = pb.authStore.record;

      // Create the seance copy
      const newSeance = await pb.collection("seance_types").create({
          user: user.id,
          nom: seance.pathologie || seance.objectif_principal || "Séance",
          pathologie: seance.pathologie,
          pathologies: seance.pathologies || [],
          objectifs: getDisplayObjectifs(seance),
          objectif_principal: seance.objectif_principal,
          // Fusionne principaux + secondaires (distinction supprimée)
          objectifs_principaux: getDisplayObjectifs(seance),
          objectif_secondaire: null,
          objectifs_secondaires: [],
          author_name: profileData?.pseudo || seance.author_name,
          is_shared: false,
          is_copy: seance.user_id !== user.id,
          original: seance.user_id !== user.id ? seance.id : null,
        });

      // Copy exercices
      if (seance.exercices && seance.exercices.length > 0) {
        for (const ex of seance.exercices) {
          await pb.collection("seance_exercices").create({
            seance_type: newSeance.id,
            exercice: ex.exercice_id,
            name: ex.name,
            description: ex.description,
            repetitions: ex.repetitions,
            duration_seconds: ex.duration_seconds,
            series: ex.series || 1,
            ordre: ex.ordre,
          });
        }
      }

      toast.success(seance.user_id !== user.id ? "Séance copiée dans votre bibliothèque" : "Séance dupliquée");
      fetchData();
    } catch (error) {
      console.error("Error duplicating seance:", error);
      toast.error("Erreur lors de la duplication");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDisplayPathologies = (seance: SeanceType) => {
    return seance.pathologies?.length > 0 ? seance.pathologies : [seance.pathologie];
  };

  const getDisplayObjectifs = (seance: SeanceType) => {
    // Nouveau champ unifié `objectifs`, fallback sur les champs legacy
    if (seance.objectifs?.length > 0) return seance.objectifs.filter(Boolean);
    const principaux = seance.objectifs_principaux?.length > 0 ? seance.objectifs_principaux : (seance.objectif_principal ? [seance.objectif_principal] : []);
    const secondaires = seance.objectifs_secondaires?.length > 0 ? seance.objectifs_secondaires : (seance.objectif_secondaire ? [seance.objectif_secondaire] : []);
    return [...new Set([...principaux, ...secondaires].filter(Boolean))];
  };

  // Options de filtre dérivées des séances chargées
  const pathoOptions = [...new Set(seances.flatMap((s) => getDisplayPathologies(s)))].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
  const objectifOptions = [...new Set(seances.flatMap((s) => getDisplayObjectifs(s)))].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));

  const toggleExpand = (id: string) => {
    setExpandedSeances(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
      <PagePopup pageKey="seances" />
      <div className="container mx-auto px-2 sm:px-4 py-4 md:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10">
              <Calendar className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold">Séance Type</h1>
              <p className="text-muted-foreground">Gérez vos modèles de séances prédéfinies</p>
            </div>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle séance
          </Button>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Filter Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filter === "mine" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("mine")}
                  className="gap-2"
                >
                  <User className="w-4 h-4" />
                  Mes séances ({filterCounts.mine})
                </Button>
                <Button
                  variant={filter === "platform" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("platform")}
                  className="gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Plateforme ({filterCounts.platform})
                </Button>
                <Button
                  variant={filter === "shared" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("shared")}
                  className="gap-2"
                >
                  <Users className="w-4 h-4" />
                  Partagées ({filterCounts.shared})
                </Button>
              </div>

              {/* Search + multi-filtres */}
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par code, auteur..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <MultiSelectFilter
                  label="Pathologies"
                  options={pathoOptions}
                  selected={pathoFilter}
                  onToggle={(tag) => toggleTagFilter(tag, pathoFilter, setPathoFilter)}
                  onClear={() => setPathoFilter([])}
                />

                <MultiSelectFilter
                  label="Objectifs"
                  options={objectifOptions}
                  selected={objectifFilter}
                  onToggle={(tag) => toggleTagFilter(tag, objectifFilter, setObjectifFilter)}
                  onClear={() => setObjectifFilter([])}
                />

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-muted-foreground"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Réinitialiser
                  </Button>
                )}
              </div>
            </div>

            {/* Badges des filtres actifs */}
            <div className="mt-3 empty:hidden">
              <ActiveFilterBadges
                pathoFilter={pathoFilter}
                objectifFilter={objectifFilter}
                onTogglePatho={(tag) => toggleTagFilter(tag, pathoFilter, setPathoFilter)}
                onToggleObjectif={(tag) => toggleTagFilter(tag, objectifFilter, setObjectifFilter)}
              />
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
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Aucune séance type trouvée.</p>
                {filter === "mine" && (
                  <Button onClick={openCreateDialog} variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Créer votre première séance
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredSeances.map((seance) => {
                  const isOwner = seance.user_id === user?.id;
                  const canShare = isOwner && !seance.is_copy;
                  const pathologies = getDisplayPathologies(seance);
                  const objectifs = getDisplayObjectifs(seance);

                  return (
                    <Card key={seance.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        {/* Header - Always visible */}
                        <div className="flex items-center justify-between gap-4 cursor-pointer" onClick={() => toggleExpand(seance.id)}>
                          <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs uppercase px-1.5 py-0.5 bg-muted/50 flex-shrink-0">
                              {seance.code}
                            </Badge>
                            {pathologies.map((p, i) => (
                              <Badge key={i} variant="outline" className="text-base font-semibold px-3 py-1 flex-shrink-0">{p}</Badge>
                            ))}
                            {objectifs.length > 0 && <span className="text-muted-foreground">-</span>}
                            {objectifs.map((o, i) => (
                              <Badge key={i} variant="default" className="text-base font-semibold px-3 py-1 flex-shrink-0">{o}</Badge>
                            ))}
                            {seance.is_copy && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">Copie</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              par {seance.user_id === user?.id ? "Moi" : (seance.author_name || "Anonyme")}
                            </span>
                            {canShare && seance.is_shared && !seance.is_validated && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">En attente de validation de partage</Badge>
                            )}
                            {canShare && seance.is_refused && (
                              <Badge className="text-xs bg-red-500 flex-shrink-0">Refusé</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              • {seance.exercices?.length || 0} exercices
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(seance.id); }}
                            className="gap-1 flex-shrink-0"
                          >
                            {expandedSeances.has(seance.id) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </div>

                        {/* Expandable content */}
                        {expandedSeances.has(seance.id) && (
                          <div className="mt-4 pt-4 border-t space-y-4">
                            <div className="flex flex-col lg:flex-row gap-4">
                              {/* Main content */}
                              <div className="flex-1 space-y-3">
                                {/* Exercices */}
                                <div className="space-y-3">
                                  <p className="text-sm font-semibold">
                                    Exercices ({seance.exercices?.length || 0})
                                  </p>
                                  {seance.exercices && seance.exercices.length > 0 ? (
                                    <div className="space-y-3">
                                      {seance.exercices.map((ex, i) => {
                                        const thumbnailUrl = ex.exercice?.thumbnail_url || null;
                                        const videoUrl = ex.exercice?.video_url || null;
                                        const exerciceName = ex.exercice?.title || ex.name || `Exercice ${i + 1}`;
                                        
                                        return (
                                          <div
                                            key={ex.id}
                                            className="flex items-start gap-4 p-3 bg-muted/30 rounded-xl border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => setPreviewExercice({
                                              id: ex.exercice?.id,
                                              title: exerciceName,
                                              description: ex.description,
                                              video_url: videoUrl,
                                              thumbnail_url: thumbnailUrl,
                                              series: ex.series,
                                              repetitions: ex.repetitions,
                                              duration_seconds: ex.duration_seconds,
                                              force_1: ex.force_1,
                                              duration_seconds_2: ex.duration_seconds_2,
                                              force_2: ex.force_2,
                                              comment: ex.comment,
                                            })}
                                          >
                                            {/* Order number */}
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                              <span className="text-sm font-bold text-primary">{i + 1}</span>
                                            </div>

                                            {/* Thumbnail or Video - Clickable */}
                                            <div
                                              className={`w-20 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative ${videoUrl ? 'cursor-pointer hover:ring-2 hover:ring-primary transition-all' : ''}`}
                                              onClick={(e) => { if (videoUrl) { e.stopPropagation(); setVideoToPlay(videoUrl); } }}
                                            >
                                              {thumbnailUrl ? (
                                                <img
                                                  src={thumbnailUrl}
                                                  alt={exerciceName}
                                                  className="w-full h-full object-cover"
                                                />
                                              ) : videoUrl ? (
                                                <video
                                                  src={videoUrl}
                                                  className="w-full h-full object-cover"
                                                  muted
                                                />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                  <Calendar className="w-6 h-6" />
                                                </div>
                                              )}
                                              {videoUrl && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors">
                                                  <Play className="w-5 h-5 text-white fill-white" />
                                                </div>
                                              )}
                                            </div>

                                            {/* Exercise info */}
                                            <div className="flex-1 min-w-0">
                                              <p className="font-semibold text-base truncate mb-2">{exerciceName}</p>
                                              
                                              {/* Stats - larger display */}
                                              <div className="flex items-center gap-4 flex-wrap">
                                                <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-lg">
                                                  <span className="text-lg font-bold text-primary">{ex.series || 1}</span>
                                                  <span className="text-sm text-muted-foreground">série{(ex.series || 1) > 1 ? "s" : ""}</span>
                                                </div>
                                                
                                                {ex.repetitions && (
                                                  <div className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-lg">
                                                    <span className="text-lg font-bold">{ex.repetitions}</span>
                                                    <span className="text-sm text-muted-foreground">répétitions</span>
                                                  </div>
                                                )}
                                                
                                                {ex.duration_seconds && (
                                                  <div className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-lg">
                                                    <span className="text-lg font-bold">{ex.duration_seconds}</span>
                                                    <span className="text-sm text-muted-foreground">secondes</span>
                                                  </div>
                                                )}
                                              </div>

                                              {ex.description && (
                                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                                  {ex.description}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground py-4 text-center">Aucun exercice</p>
                                  )}
                                </div>
                              </div>

                              {/* Side panel - Interactions & Actions */}
                              <div className="flex flex-col gap-3 lg:w-48">
                                {/* Interactions */}
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
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <MessageCircle className="w-4 h-4" />
                                    {seance.comments_count}
                                  </div>
                                </div>

                                {/* Share status */}
                                {canShare && (
                                  <div className="flex items-center gap-2">
                                    {seance.is_refused ? (
                                      <div className="w-4 h-4 rounded-sm border-2 border-red-500 flex items-center justify-center bg-red-50">
                                        <X className="w-3 h-3 text-red-500" strokeWidth={3} />
                                      </div>
                                    ) : seance.is_shared && seance.is_validated ? null : (
                                      <Checkbox
                                        checked={seance.is_shared}
                                        onCheckedChange={() => toggleShare(seance.id, seance.is_shared, seance.is_copy || false, seance.is_validated || false)}
                                      />
                                    )}
                                    <span className="text-xs flex items-center gap-1">
                                      {seance.is_shared && seance.is_validated
                                        ? (seance.withdrawal_requested
                                          ? <span className="flex items-center gap-1 text-orange-500"><Hourglass className="w-3 h-3" />En attente du retrait par l'admin</span>
                                          : seance.withdrawal_refused
                                          ? <span className="flex items-center gap-1 text-red-500"><Ban className="w-3 h-3" />Retrait refusé par l'admin</span>
                                          : <span className="flex items-center gap-1 text-green-600"><Check className="w-3 h-3" />Déjà partagé</span>)
                                        : seance.is_refused
                                        ? "Partage refusé"
                                        : seance.is_shared && !seance.is_validated
                                        ? <><Clock className="w-3 h-3 text-orange-500" />En attente de validation</>
                                        : "Partager"}
                                    </span>
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-1 flex-wrap">
                                  {isOwner && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditDialog(seance)}
                                      className="gap-1"
                                    >
                                      <Edit className="w-3 h-3" />
                                      Modifier
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => duplicateSeance(seance)}
                                    disabled={isSubmitting}
                                    className="gap-1"
                                  >
                                    <Copy className="w-3 h-3" />
                                    {isOwner ? "Dupliquer" : "Copier"}
                                  </Button>
                                  {isOwner && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={() => setSeanceToDelete(seance)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exercise Preview Dialog */}
        <ExercicePreviewDialog
          exercice={previewExercice}
          open={!!previewExercice}
          onOpenChange={(open) => !open && setPreviewExercice(null)}
        />

        {/* Form Dialog */}
        <SeanceFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          seance={editingSeance}
          onSuccess={fetchData}
        />

        {/* Video Player Dialog */}
        <Dialog open={!!videoToPlay} onOpenChange={(open) => !open && setVideoToPlay(null)}>
          <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-black border-none">
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

        <AlertDialog open={!!seanceToDelete} onOpenChange={(open) => !open && !deletingSeance && setSeanceToDelete(null)}>
          <AlertDialogContent>
            {seanceToDelete && needsWithdrawalRequest(seanceToDelete) ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Demander le retrait de la séance ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette séance est partagée sur la plateforme. Pour la retirer, une demande doit
                    être validée par l'administrateur. Elle reste visible jusque-là.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletingSeance}>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleWithdrawSeance(); }}
                    disabled={deletingSeance}
                  >
                    {deletingSeance && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Demander le retrait à l'admin
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer la séance ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette séance sera déplacée vers la corbeille. Vous pourrez la restaurer depuis
                    la page Corbeille.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletingSeance}>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleConfirmDeleteSeance(); }}
                    disabled={deletingSeance}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingSeance && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
