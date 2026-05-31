import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ClipboardList, Trash2, Search, Users, User, Shield, Copy, Plus, Edit, Calendar, FileText, X, ChevronDown, ChevronUp, Play, Clock, RotateCcw } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { TraitementFormDialog } from "@/components/traitement/TraitementFormDialog";
import { PagePopup } from "@/components/popup/PagePopup";

interface TraitementTest {
  id: string;
  description: string;
  ordre: number;
  exercice_id?: string;
  exercices?: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    video_url: string | null;
  } | null;
}

interface SeanceExercice {
  id: string;
  name: string | null;
  description: string | null;
  ordre: number;
  repetitions: number | null;
  duration_seconds: number | null;
  series: number | null;
  exercice_id: string | null;
  exercices?: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    video_url: string | null;
  } | null;
}

interface TraitementSeance {
  id: string;
  seance_type_id: string;
  ordre: number;
  seance_types?: {
    id: string;
    pathologie: string;
    objectif_principal: string;
    pathologies?: string[];
    objectifs_principaux?: string[];
  } | null;
  exercices?: SeanceExercice[];
}

interface TraitementType {
  id: string;
  code: string;
  nom?: string | null;
  pathologie: string;
  description: string | null;
  author_name: string | null;
  is_shared: boolean;
  is_copy: boolean;
  is_validated: boolean;
  original_id: string | null;
  user_id: string;
  created_at: string;
  tests?: TraitementTest[];
  seances?: TraitementSeance[];
  is_used_by_patient?: boolean;
}

type FilterType = "mine" | "platform" | "shared";

export default function TraitementType() {
  const { user } = useAuth();
  const [userPseudo, setUserPseudo] = useState<string | null>(null);
  const [userCanShare, setUserCanShare] = useState<boolean>(true);
  const [traitements, setTraitements] = useState<TraitementType[]>([]);
  const [filteredTraitements, setFilteredTraitements] = useState<TraitementType[]>([]);
  const [featuredTraitementIds, setFeaturedTraitementIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter and search state
  const [filter, setFilter] = useState<FilterType>("mine");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingTraitement, setEditingTraitement] = useState<any>(null);
  const [testDetailDialog, setTestDetailDialog] = useState<TraitementTest | null>(null);
  const [expandedTraitements, setExpandedTraitements] = useState<Set<string>>(new Set());
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string>("");

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [traitements, filter, searchQuery, user, featuredTraitementIds]);

  const applyFilters = () => {
    let result = [...traitements];

    // Get IDs of originals that the user has copied
    const userCopiedOriginalIds = traitements
      .filter((t) => t.is_copy && t.user_id === user?.id && t.original_id)
      .map((t) => t.original_id);

    // Filter out originals that user has already copied (in shared view)
    if (filter === "shared") {
      result = result.filter((t) => !userCopiedOriginalIds.includes(t.id));
    }

    // Apply filter type
    if (filter === "mine") {
      result = result.filter((t) => t.user_id === user?.id && !(t as any).is_hidden_from_list);
    } else if (filter === "platform") {
      result = result.filter((t) => featuredTraitementIds.includes(t.id));
    } else if (filter === "shared") {
      result = result.filter((t) => 
        t.is_shared && 
        t.is_validated &&
        t.user_id !== user?.id &&
        !featuredTraitementIds.includes(t.id)
      );
    }

    // Apply search (including code)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.code?.toLowerCase().includes(query) ||
          t.author_name?.toLowerCase().includes(query) ||
          t.pathologie.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    setFilteredTraitements(result);
  };

  const getFilterCounts = () => {
    const userCopiedOriginalIds = traitements
      .filter((t) => t.is_copy && t.user_id === user?.id && t.original_id)
      .map((t) => t.original_id);

    const mine = traitements.filter((t) => t.user_id === user?.id && !(t as any).is_hidden_from_list).length;
    const platform = traitements.filter((t) => featuredTraitementIds.includes(t.id)).length;
    const shared = traitements.filter((t) => 
      t.is_shared && 
      t.is_validated &&
      t.user_id !== user?.id &&
      !userCopiedOriginalIds.includes(t.id) &&
      !featuredTraitementIds.includes(t.id)
    ).length;

    return { mine, platform, shared };
  };

  const filterCounts = getFilterCounts();

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user profile
      const rec = pb.authStore.record;
      setUserPseudo(rec?.pseudo || null);
      setUserCanShare(rec?.can_share !== false);

      const [featuredData, traitementsData, usedTraitements] = await Promise.all([
        pb.collection("featured_traitements").getFullList({ fields: "traitement_type" }),
        pb.collection("traitement_types").getFullList({ sort: "-created" }),
        pb.collection("patient_care_plans").getFullList({ filter: "active_traitement != null", fields: "active_traitement" }),
      ]);
      setFeaturedTraitementIds(featuredData.map((f: any) => f.traitement_type));

      const usedTraitementIds = new Set(usedTraitements.map((p: any) => p.active_traitement));

      const traitementsWithDetails = await Promise.all(
        traitementsData.map(async (traitement: any) => {
          const [testsData, seancesData] = await Promise.all([
            pb.collection("traitement_tests").getFullList({ filter: `traitement_type = "${traitement.id}"`, sort: "ordre", expand: "exercice" }),
            pb.collection("traitement_seances").getFullList({ filter: `traitement_type = "${traitement.id}"`, sort: "ordre", expand: "seance_type" }),
          ]);

          const seancesWithExercices = await Promise.all(
            seancesData.map(async (seance: any) => {
              const exercicesData = await pb.collection("seance_exercices").getFullList({
                filter: `seance_type = "${seance.seance_type}"`, sort: "ordre", expand: "exercice",
              });
              return {
                ...seance, seance_type_id: seance.seance_type, seance_types: seance.expand?.seance_type,
                exercices: exercicesData.map((e: any) => ({ ...e, exercices: e.expand?.exercice })),
              };
            })
          );

          return {
            ...traitement, user_id: traitement.user,
            tests: testsData.map((t: any) => ({ ...t, exercices: t.expand?.exercice })),
            seances: seancesWithExercices,
            is_used_by_patient: usedTraitementIds.has(traitement.id),
          };
        })
      );

      setTraitements(traitementsWithDetails);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTraitement(null);
    setFormDialogOpen(true);
  };

  const openEditDialog = (traitement: TraitementType) => {
    setEditingTraitement({
      id: traitement.id,
      pathologie: traitement.pathologie,
      description: traitement.description,
      tests: (traitement.tests || []).map(t => ({
        id: t.id,
        exercice_id: t.exercice_id || t.exercices?.id || '',
        exercice: t.exercices ? {
          id: t.exercices.id,
          title: t.exercices.title,
          description: t.exercices.description,
          thumbnail_url: t.exercices.thumbnail_url
        } : null,
        ordre: t.ordre
      })),
      seances: (traitement.seances || []).map(s => ({
        id: s.id,
        seance_type_id: s.seance_type_id,
        ordre: s.ordre,
        seance: s.seance_types ? {
          id: s.seance_types.id,
          pathologie: s.seance_types.pathologie,
          pathologies: s.seance_types.pathologies || [],
          objectif_principal: s.seance_types.objectif_principal,
          objectifs_principaux: s.seance_types.objectifs_principaux || []
        } : null
      })),
      author_name: traitement.author_name
    });
    setFormDialogOpen(true);
  };

  const toggleShare = async (traitementId: string, currentlyShared: boolean, isCopy: boolean, isValidated: boolean) => {
    if (isCopy) {
      toast.error("Les copies ne peuvent pas être partagées");
      return;
    }
    if (!userCanShare) {
      toast.error("Vous n'avez pas la permission de partager du contenu");
      return;
    }
    if (isValidated && currentlyShared) {
      toast.error("Ce traitement a été validé et ne peut plus être modifié");
      return;
    }
    try {
      await pb.collection("traitement_types").update(traitementId, { is_shared: !currentlyShared, is_validated: false });

      toast.success(currentlyShared ? "Traitement non partagé" : "Traitement partagé (en attente de validation)");
      fetchData();
    } catch (error) {
      console.error("Error toggling share:", error);
      toast.error("Erreur lors du partage");
    }
  };

  const deleteTraitement = async (id: string, isUsedByPatient: boolean) => {
    if (isUsedByPatient) {
      toast.error("Ce traitement est utilisé par un patient et ne peut pas être supprimé");
      return;
    }
    
    try {
      // Delete tests first
      const tests = await pb.collection("traitement_tests").getFullList({ filter: `traitement_type = "${id}"` });
      for (const t of tests) await pb.collection("traitement_tests").delete(t.id);
      const seances = await pb.collection("traitement_seances").getFullList({ filter: `traitement_type = "${id}"` });
      for (const s of seances) await pb.collection("traitement_seances").delete(s.id);
      await pb.collection("traitement_types").delete(id);
      toast.success("Traitement supprimé");
      fetchData();
    } catch (error) {
      console.error("Error deleting traitement:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const duplicateTraitement = async (traitement: TraitementType) => {
    if (!user) return;

    try {
      // Create the traitement copy
      const newTraitement = await pb.collection("traitement_types").create({
          user: user.id,
          nom: traitement.nom || traitement.pathologie,
          pathologie: traitement.pathologie,
          description: traitement.description,
          author_name: userPseudo || traitement.author_name,
          is_shared: false,
          is_copy: traitement.user_id !== user.id,
          original: traitement.user_id !== user.id ? traitement.id : null,
        });

      // Copy tests
      if (traitement.tests && traitement.tests.length > 0) {
        for (const test of traitement.tests) {
          await pb.collection("traitement_tests").create({
            traitement_type: newTraitement.id,
            description: test.description,
            ordre: test.ordre,
          });
        }
      }

      // Copy seances
      if (traitement.seances && traitement.seances.length > 0) {
        for (const seance of traitement.seances) {
          await pb.collection("traitement_seances").create({
            traitement_type: newTraitement.id,
            seance_type: seance.seance_type_id,
            ordre: seance.ordre,
          });
        }
      }

      toast.success(traitement.user_id !== user.id ? "Traitement copié dans votre bibliothèque" : "Traitement dupliqué");
      fetchData();
    } catch (error) {
      console.error("Error duplicating traitement:", error);
      toast.error("Erreur lors de la duplication");
    }
  };

  const getSeanceDisplay = (seance: TraitementSeance) => {
    if (!seance.seance_types) return "Séance";
    const pathologies = seance.seance_types.pathologies?.length ? seance.seance_types.pathologies : [seance.seance_types.pathologie];
    const objectifs = seance.seance_types.objectifs_principaux?.length ? seance.seance_types.objectifs_principaux : [seance.seance_types.objectif_principal];
    return `${pathologies[0]} - ${objectifs[0]}`;
  };

  const toggleExpand = (id: string) => {
    setExpandedTraitements(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSeanceExpand = (seanceId: string) => {
    setExpandedSeances(prev => {
      const next = new Set(prev);
      if (next.has(seanceId)) {
        next.delete(seanceId);
      } else {
        next.add(seanceId);
      }
      return next;
    });
  };

  const openVideoDialog = (videoUrl: string, title: string) => {
    setSelectedVideoUrl(videoUrl);
    setSelectedVideoTitle(title);
    setVideoDialogOpen(true);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}min ${secs}s` : `${secs}s`;
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
      <PagePopup pageKey="traitements" />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-500/10">
              <ClipboardList className="w-8 h-8 text-rose-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Traitement Type</h1>
              <p className="text-muted-foreground">Gérez vos modèles de traitements standardisés</p>
            </div>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            Nouveau traitement
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
                  Mes traitements ({filterCounts.mine})
                </Button>
                <Button
                  variant={filter === "platform" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("platform")}
                  className="gap-2"
                >
                  <Shield className="w-4 h-4" />
                  PhysioOffice ({filterCounts.platform})
                </Button>
                <Button
                  variant={filter === "shared" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("shared")}
                  className="gap-2"
                >
                  <Users className="w-4 h-4" />
                  Partagés ({filterCounts.shared})
                </Button>
              </div>

              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par pathologie, description ou auteur..."
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
            <CardTitle>Modèles de traitements ({filteredTraitements.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Chargement...</p>
            ) : filteredTraitements.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Aucun traitement type trouvé.</p>
                {filter === "mine" && (
                  <Button onClick={openCreateDialog} variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Créer votre premier traitement
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredTraitements.map((traitement) => {
                  const isOwner = traitement.user_id === user?.id;
                  const canShare = isOwner && !traitement.is_copy;
                  const isExpanded = expandedTraitements.has(traitement.id);

                  return (
                    <Card key={traitement.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        {/* Header - Always visible */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Badge variant="outline" className="font-mono text-xs uppercase px-1.5 py-0.5 bg-muted/50 flex-shrink-0">
                              {traitement.code}
                            </Badge>
                            <Badge variant="outline" className="text-sm flex-shrink-0">{traitement.pathologie}</Badge>
                            {traitement.is_copy && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">Copie</Badge>
                            )}
                            <span className="text-xs text-muted-foreground truncate">
                              par {traitement.author_name || "Anonyme"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              • {traitement.tests?.length || 0} tests • {traitement.seances?.length || 0} séances
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(traitement.id)}
                            className="gap-1 flex-shrink-0"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Réduire
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Détails
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Expandable content */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t space-y-4">
                            <div className="flex flex-col lg:flex-row gap-4">
                              {/* Main content */}
                              <div className="flex-1 space-y-3">
                                {/* Description */}
                                {traitement.description && (
                                  <p className="text-sm text-muted-foreground">{traitement.description}</p>
                                )}

                                {/* Tests (Exercices) - Table format like Exercices page */}
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold">Tests ({traitement.tests?.length || 0})</p>
                                  {traitement.tests && traitement.tests.length > 0 ? (
                                    <div className="border rounded-lg overflow-hidden">
                                      <table className="w-full">
                                        <thead className="bg-muted/50">
                                          <tr className="text-left text-xs text-muted-foreground">
                                            <th className="p-2 w-20">Vidéo</th>
                                            <th className="p-2">Titre</th>
                                            <th className="p-2 hidden md:table-cell">Description</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                          {traitement.tests.map((test, j) => (
                                            <tr
                                              key={test.id}
                                              className={`${
                                                test.exercices?.video_url ? 'cursor-pointer hover:bg-muted/50' : ''
                                              } transition-colors`}
                                              onClick={() => {
                                                if (test.exercices?.video_url) {
                                                  openVideoDialog(
                                                    test.exercices.video_url,
                                                    test.exercices.title || `Test ${j + 1}`
                                                  );
                                                }
                                              }}
                                            >
                                              <td className="p-2">
                                                {test.exercices?.thumbnail_url ? (
                                                  <div className="relative w-16 h-12 rounded overflow-hidden">
                                                    <img
                                                      src={test.exercices.thumbnail_url}
                                                      alt={test.exercices.title}
                                                      className="w-full h-full object-cover"
                                                    />
                                                    {test.exercices.video_url && (
                                                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                        <Play className="w-4 h-4 text-white" />
                                                      </div>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <div className="w-16 h-12 rounded bg-muted flex items-center justify-center">
                                                    <FileText className="w-5 h-5 text-muted-foreground" />
                                                  </div>
                                                )}
                                              </td>
                                              <td className="p-2">
                                                <p className="font-medium text-sm">
                                                  {test.exercices?.title || `Test ${j + 1}`}
                                                </p>
                                              </td>
                                              <td className="p-2 hidden md:table-cell">
                                                <p className="text-sm text-muted-foreground line-clamp-2">
                                                  {test.exercices?.description || test.description || "-"}
                                                </p>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">Aucun test</p>
                                  )}
                                </div>

                                {/* Séances */}
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold">Séances ({traitement.seances?.length || 0})</p>
                                  {traitement.seances && traitement.seances.length > 0 ? (
                                    <div className="space-y-2">
                                      {traitement.seances.map((seance, i) => {
                                        const isSeanceExpanded = expandedSeances.has(seance.id);
                                        return (
                                          <div key={seance.id} className="rounded-lg border border-border/50 overflow-hidden">
                                            <div
                                              className="flex items-center gap-3 p-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                                              onClick={() => toggleSeanceExpand(seance.id)}
                                            >
                                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <span className="text-xs font-bold text-primary">{i + 1}</span>
                                              </div>
                                              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                              <span className="text-sm flex-1">{getSeanceDisplay(seance)}</span>
                                              <span className="text-xs text-muted-foreground">
                                                {seance.exercices?.length || 0} exercice(s)
                                              </span>
                                              {isSeanceExpanded ? (
                                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                              ) : (
                                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                              )}
                                            </div>
                                            {isSeanceExpanded && seance.exercices && seance.exercices.length > 0 && (
                                              <div className="p-2 bg-background space-y-2 border-t border-border/50">
                                                {seance.exercices.map((exercice, j) => (
                                                  <div
                                                    key={exercice.id}
                                                    className={`flex items-center gap-3 p-2 rounded-lg ${
                                                      exercice.exercices?.video_url ? 'cursor-pointer hover:bg-muted/50' : 'bg-muted/20'
                                                    }`}
                                                    onClick={() => {
                                                      if (exercice.exercices?.video_url) {
                                                        openVideoDialog(
                                                          exercice.exercices.video_url,
                                                          exercice.name || exercice.exercices.title || `Exercice ${j + 1}`
                                                        );
                                                      }
                                                    }}
                                                  >
                                                    {exercice.exercices?.thumbnail_url ? (
                                                      <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
                                                        <img
                                                          src={exercice.exercices.thumbnail_url}
                                                          alt={exercice.name || exercice.exercices.title}
                                                          className="w-full h-full object-cover"
                                                        />
                                                        {exercice.exercices.video_url && (
                                                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                            <Play className="w-3 h-3 text-white" />
                                                          </div>
                                                        )}
                                                      </div>
                                                    ) : (
                                                      <div className="w-10 h-10 rounded bg-secondary/50 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-xs font-bold text-muted-foreground">{j + 1}</span>
                                                      </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-sm font-medium truncate">
                                                        {exercice.name || exercice.exercices?.title || `Exercice ${j + 1}`}
                                                      </p>
                                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        {exercice.series && exercice.series > 1 && (
                                                          <span>{exercice.series} séries</span>
                                                        )}
                                                        {exercice.repetitions && (
                                                          <span className="flex items-center gap-1">
                                                            <RotateCcw className="w-3 h-3" />
                                                            {exercice.repetitions} rép.
                                                          </span>
                                                        )}
                                                        {exercice.duration_seconds && (
                                                          <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {formatDuration(exercice.duration_seconds)}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                    {exercice.exercices?.video_url && (
                                                      <Play className="w-4 h-4 text-primary flex-shrink-0" />
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            {isSeanceExpanded && (!seance.exercices || seance.exercices.length === 0) && (
                                              <div className="p-3 bg-background text-xs text-muted-foreground text-center border-t border-border/50">
                                                Aucun exercice dans cette séance
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">Aucune séance</p>
                                  )}
                                </div>
                              </div>

                              {/* Side panel - Interactions & Actions */}
                              <div className="flex flex-col gap-3 lg:w-48">
                                {/* Share status */}
                                {canShare && (
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={traitement.is_shared}
                                      onCheckedChange={() => toggleShare(traitement.id, traitement.is_shared, traitement.is_copy || false, traitement.is_validated || false)}
                                      disabled={traitement.is_validated && traitement.is_shared}
                                    />
                                    <span className="text-xs">Partager</span>
                                    {traitement.is_shared && traitement.is_validated && (
                                      <Badge className="text-xs bg-green-500">Validé</Badge>
                                    )}
                                    {traitement.is_shared && !traitement.is_validated && (
                                      <Badge variant="secondary" className="text-xs">En attente</Badge>
                                    )}
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-1 flex-wrap items-center">
                                  {traitement.is_used_by_patient && (
                                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                                      Utilisé par un patient
                                    </Badge>
                                  )}
                                  {isOwner && !traitement.is_used_by_patient && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditDialog(traitement)}
                                      className="gap-1"
                                    >
                                      <Edit className="w-3 h-3" />
                                      Modifier
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => duplicateTraitement(traitement)}
                                    className="gap-1"
                                  >
                                    <Copy className="w-3 h-3" />
                                    {isOwner ? "Dupliquer" : "Copier"}
                                  </Button>
                                  {isOwner && !traitement.is_used_by_patient && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={() => deleteTraitement(traitement.id, traitement.is_used_by_patient || false)}
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

        {/* Form Dialog */}
        <TraitementFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          traitement={editingTraitement}
          onSuccess={fetchData}
          isHiddenFromList={true}
        />

        {/* Test Detail Dialog */}
        <Dialog open={!!testDetailDialog} onOpenChange={() => setTestDetailDialog(null)}>
          <DialogContent className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Détail du test</h3>
            </div>
            {testDetailDialog && (
              <div className="space-y-4">
                {testDetailDialog.exercices ? (
                  <>
                    {testDetailDialog.exercices.video_url ? (
                      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                        <video
                          src={testDetailDialog.exercices.video_url}
                          controls
                          className="w-full h-full object-contain"
                          poster={testDetailDialog.exercices.thumbnail_url || undefined}
                        />
                      </div>
                    ) : testDetailDialog.exercices.thumbnail_url ? (
                      <img 
                        src={testDetailDialog.exercices.thumbnail_url} 
                        alt={testDetailDialog.exercices.title}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    ) : null}
                    <div>
                      <h4 className="font-medium text-lg">{testDetailDialog.exercices.title}</h4>
                      {testDetailDialog.exercices.description && (
                        <p className="text-sm text-muted-foreground mt-2">{testDetailDialog.exercices.description}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm">{testDetailDialog.description}</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Video Dialog */}
        <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
          <DialogContent className="max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{selectedVideoTitle}</h3>
            </div>
            {selectedVideoUrl && (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={selectedVideoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
    </Layout>
  );
}
