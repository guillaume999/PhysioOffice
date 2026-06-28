import { useState, useEffect, Fragment } from "react";
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
import { Loader2, Hourglass, Ban, Check, XCircle, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardList, Trash2, Search, Users, User, Shield, Copy, Plus, Edit, Calendar, FileText, X, ChevronDown, ChevronUp, Play, Clock, RotateCcw, RefreshCw } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { TraitementFormDialog } from "@/components/traitement/TraitementFormDialog";
import { MultiSelectFilter, ActiveFilterBadges } from "@/components/filters/MultiSelectFilter";
import { PagePopup } from "@/components/popup/PagePopup";
import { ExercicePreviewDialog, type ExercicePreview } from "@/components/exercice/ExercicePreviewDialog";
import { normalizeSearch } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  force_1: number | null;
  duration_seconds_2: number | null;
  force_2: number | null;
  comment: string | null;
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
    objectifs?: string[];
    objectifs_principaux?: string[];
  } | null;
  exercices?: SeanceExercice[];
}

interface TraitementType {
  id: string;
  code: string;
  nom?: string | null;
  pathologie: string;
  objectifs?: string[];
  description: string | null;
  author_name: string | null;
  is_shared: boolean;
  is_copy: boolean;
  is_validated: boolean;
  is_refused?: boolean;
  withdrawal_requested?: boolean;
  withdrawal_refused?: boolean;
  modification_pending?: boolean;
  modification_note?: string | null;
  modification_refused?: boolean;
  shared_snapshot?: string | null;
  pending_draft?: string | null;
  original_id: string | null;
  user_id: string;
  created_at: string;
  tests?: TraitementTest[];
  seances?: TraitementSeance[];
  is_used_by_patient?: boolean;
}

type FilterType = "mine" | "platform" | "shared"; // vues

export default function TraitementType() {
  const { user } = useAuth();
  const [userPseudo, setUserPseudo] = useState<string | null>(null);
  const [userCanShare, setUserCanShare] = useState<boolean>(true);
  const [traitements, setTraitements] = useState<TraitementType[]>([]);
  const [traitementToDelete, setTraitementToDelete] = useState<TraitementType | null>(null);
  const [deletingTraitement, setDeletingTraitement] = useState(false);
  const [filteredTraitements, setFilteredTraitements] = useState<TraitementType[]>([]);
  const [featuredTraitementIds, setFeaturedTraitementIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter and search state
  const [filter, setFilter] = useState<FilterType>("mine");
  const [searchQuery, setSearchQuery] = useState("");
  const [pathoFilter, setPathoFilter] = useState<string[]>([]);
  const [objectifFilter, setObjectifFilter] = useState<string[]>([]);

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingTraitement, setEditingTraitement] = useState<any>(null);
  const [editingTraitementIsValidated, setEditingTraitementIsValidated] = useState(false);
  const [editingTraitementIsRefused, setEditingTraitementIsRefused] = useState(false);
  const [editingTraitementDraftMode, setEditingTraitementDraftMode] = useState(false);
  const [modifiedSharedTraitementIds, setModifiedSharedTraitementIds] = useState<Set<string>>(new Set());
  const [expandedVersionHistoryIds, setExpandedVersionHistoryIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedTraitements, setExpandedTraitements] = useState<Set<string>>(new Set());
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());
  const [previewExercice, setPreviewExercice] = useState<ExercicePreview | null>(null);
  const [modifRequestDialogTraitement, setModifRequestDialogTraitement] = useState<TraitementType | null>(null);
  const [modifRequestNote, setModifRequestNote] = useState("");
  const [sharedVersionTraitement, setSharedVersionTraitement] = useState<Record<string, any> | null>(null);
  const [traitementModifRefusalToDismiss, setTraitementModifRefusalToDismiss] = useState<TraitementType | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [traitements, filter, searchQuery, pathoFilter, objectifFilter, user, featuredTraitementIds]);

  // Objectifs d'un traitement = ses propres objectifs + union des objectifs de ses séances
  const getTraitementObjectifs = (t: TraitementType): string[] => {
    const fromSeances = (t.seances || []).flatMap((s) => {
      const st = s.seance_types;
      if (!st) return [];
      if (st.objectifs?.length) return st.objectifs;
      return st.objectifs_principaux?.length ? st.objectifs_principaux : (st.objectif_principal ? [st.objectif_principal] : []);
    });
    return [...new Set([...(t.objectifs || []), ...fromSeances].filter(Boolean))];
  };

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

    // Recherche texte : nom / code / description / auteur
    if (searchQuery.trim()) {
      const query = normalizeSearch(searchQuery);
      result = result.filter(
        (t) =>
          normalizeSearch(t.code).includes(query) ||
          normalizeSearch(t.nom).includes(query) ||
          normalizeSearch(t.author_name).includes(query) ||
          normalizeSearch(t.description).includes(query)
      );
    }

    // Filtre pathologies (OR entre les pathos sélectionnées, AND avec les autres filtres)
    if (pathoFilter.length > 0) {
      result = result.filter((t) => pathoFilter.includes(t.pathologie));
    }

    // Filtre objectifs : objectifs des séances du traitement (OR entre sélectionnés)
    if (objectifFilter.length > 0) {
      result = result.filter((t) =>
        getTraitementObjectifs(t).some((o) => objectifFilter.includes(o))
      );
    }

    setFilteredTraitements(result);
  };

  // Options de filtre dérivées des traitements chargés
  const pathoOptions = [...new Set(traitements.map((t) => t.pathologie))].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
  const objectifOptions = [...new Set(traitements.flatMap((t) => getTraitementObjectifs(t)))].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));

  const hasActiveFilters = searchQuery.trim() !== "" || pathoFilter.length > 0 || objectifFilter.length > 0;

  const clearAllFilters = () => {
    setSearchQuery("");
    setPathoFilter([]);
    setObjectifFilter([]);
  };

  const toggleTagFilter = (tag: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag]);
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
        pb.collection("traitement_types").getFullList({ filter: withActive(), sort: "-created" }),
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
            ...traitement, user_id: traitement.user, original_id: traitement.original ?? null,
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
    setEditingTraitementIsRefused(false);
    setFormDialogOpen(true);
  };

  const openEditDialog = (traitement: TraitementType) => {
    setEditingTraitementIsValidated(traitement.is_validated || false);
    setEditingTraitementIsRefused(traitement.is_refused || false);
    setEditingTraitement({
      id: traitement.id,
      pathologie: traitement.pathologie,
      objectifs: traitement.objectifs || [],
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
      author_name: traitement.author_name,
      shared_snapshot: traitement.shared_snapshot || null,
    });
    setFormDialogOpen(true);
  };

  const openDraftEditTraitementDialog = (traitement: TraitementType) => {
    // Pre-fill from the refused version stored in shared_snapshot.refused
    let draft: any = {};
    if (traitement.shared_snapshot) {
      const s = parseSnapshot(traitement.shared_snapshot);
      draft = s?.refused || {};
    }
    setEditingTraitementDraftMode(true);
    setEditingTraitementIsValidated(traitement.is_validated || false);
    setEditingTraitementIsRefused(false);
    // Use refused snapshot tests/seances if available, otherwise fall back to current DB values (legacy)
    const draftTests = Array.isArray(draft.tests) ? draft.tests : null;
    const draftSeances = Array.isArray(draft.seances) ? draft.seances : null;
    setEditingTraitement({
      id: traitement.id,
      pathologie: draft.pathologie || traitement.pathologie,
      objectifs: draft.objectifs || traitement.objectifs || [],
      description: draft.description !== undefined ? draft.description : traitement.description,
      tests: draftTests
        ? draftTests.map((t: any, i: number) => ({
            exercice_id: t.exercice_id || '',
            exercice: t.exercice_id ? { id: t.exercice_id, title: t.title || '', description: null, thumbnail_url: null } : null,
            ordre: t.ordre ?? i,
          }))
        : (traitement.tests || []).map(t => ({
            id: t.id,
            exercice_id: t.exercice_id || t.exercices?.id || '',
            exercice: t.exercices ? { id: t.exercices.id, title: t.exercices.title, description: t.exercices.description, thumbnail_url: t.exercices.thumbnail_url } : null,
            ordre: t.ordre,
          })),
      seances: draftSeances
        ? draftSeances.map((s: any, i: number) => ({
            seance_type_id: s.seance_type_id,
            ordre: s.ordre ?? i,
            seance: s.seance_type_id ? { id: s.seance_type_id, pathologie: s.pathologie || '', pathologies: s.pathologie ? [s.pathologie] : [], objectif_principal: s.objectif || '', objectifs_principaux: s.objectif ? [s.objectif] : [] } : null,
          }))
        : (traitement.seances || []).map(s => ({
            id: s.id,
            seance_type_id: s.seance_type_id,
            ordre: s.ordre,
            seance: s.seance_types ? { id: s.seance_types.id, pathologie: s.seance_types.pathologie, pathologies: s.seance_types.pathologies || [], objectif_principal: s.seance_types.objectif_principal, objectifs_principaux: s.seance_types.objectifs_principaux || [] } : null,
          })),
      author_name: traitement.author_name,
      shared_snapshot: traitement.shared_snapshot || null,
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
      await pb.collection("traitement_types").update(traitementId, { is_shared: !currentlyShared, is_validated: false, is_refused: false });

      toast.success(currentlyShared ? "Traitement non partagé" : "Traitement partagé (en attente de validation)");
      fetchData();
    } catch (error) {
      console.error("Error toggling share:", error);
      toast.error("Erreur lors du partage");
    }
  };

  const handleRequestTraitementRevision = async () => {
    if (!modifRequestDialogTraitement) return;
    try {
      await pb.collection("traitement_types").update(modifRequestDialogTraitement.id, {
        modification_pending: true,
        modification_note: modifRequestNote.trim() || null,
        modification_refused: false,
      });
      setModifiedSharedTraitementIds(prev => { const s = new Set(prev); s.delete(modifRequestDialogTraitement.id); return s; });
      toast.success("Demande de révision envoyée à l'administrateur");
      setModifRequestDialogTraitement(null);
      setModifRequestNote("");
      fetchData();
    } catch (error) {
      console.error("Error requesting revision:", error);
      toast.error("Erreur lors de la demande de révision");
    }
  };

  const handleCancelTraitementRevision = async (traitement: TraitementType) => {
    try {
      await pb.collection("traitement_types").update(traitement.id, {
        modification_pending: false,
        modification_note: null,
      });
      setModifiedSharedTraitementIds(prev => new Set([...prev, traitement.id]));
      toast.success("Demande de révision annulée");
      fetchData();
    } catch (error) {
      console.error("Error cancelling revision:", error);
      toast.error("Erreur lors de l'annulation");
    }
  };

  const handleDismissTraitementModifRefusal = async (traitement: TraitementType) => {
    try {
      await pb.collection("traitement_types").update(traitement.id, { modification_refused: false, shared_snapshot: null });
      setModifiedSharedTraitementIds(prev => { const s = new Set(prev); s.delete(traitement.id); return s; });
      setExpandedVersionHistoryIds(prev => { const s = new Set(prev); s.delete(traitement.id); return s; });
      fetchData();
    } catch (error) {
      console.error("Error dismissing refusal:", error);
    }
  };

  const deleteTraitement = async (id: string, isUsedByPatient: boolean) => {
    if (isUsedByPatient) {
      toast.error("Ce traitement est utilisé par un patient et ne peut pas être supprimé");
      return;
    }
    
    try {
      // Soft delete : le traitement part à la corbeille. On laisse ses tests et
      // séances rattachés pour que la restauration le retrouve intact.
      await softDelete("traitement_types", id);
      toast.success("Traitement déplacé vers la corbeille");
      fetchData();
    } catch (error) {
      console.error("Error deleting traitement:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleConfirmDeleteTraitement = async () => {
    if (!traitementToDelete) return;
    setDeletingTraitement(true);
    try {
      // Preserve refused modification draft as a new independent non-shared record
      if (traitementToDelete.modification_refused && traitementToDelete.shared_snapshot) {
        try {
          const s = parseSnapshot(traitementToDelete.shared_snapshot);
          const draft = s?.refused;
          if (draft) {
            const newTraitement = await pb.collection("traitement_types").create({
              user: traitementToDelete.user_id,
              nom: draft.pathologie || traitementToDelete.pathologie,
              pathologie: draft.pathologie || traitementToDelete.pathologie,
              objectifs: draft.objectifs || [],
              description: draft.description ?? null,
              author_name: traitementToDelete.author_name,
              is_shared: false,
              is_refused: true,
              is_copy: false,
            });
            if (Array.isArray(draft.tests)) {
              for (const test of draft.tests) {
                await pb.collection("traitement_tests").create({
                  traitement_type: newTraitement.id,
                  exercice: test.exercice_id || null,
                  ordre: test.ordre ?? 0,
                  description: "",
                });
              }
            }
            if (Array.isArray(draft.seances)) {
              for (const seance of draft.seances) {
                await pb.collection("traitement_seances").create({
                  traitement_type: newTraitement.id,
                  seance_type: seance.seance_type_id || null,
                  ordre: seance.ordre ?? 0,
                });
              }
            }
          }
        } catch (e) {
          console.error("Error preserving refused draft:", e);
        }
      }
      await deleteTraitement(traitementToDelete.id, false);
      setTraitementToDelete(null);
    } finally {
      setDeletingTraitement(false);
    }
  };

  const handleWithdrawTraitement = async () => {
    if (!traitementToDelete) return;
    setDeletingTraitement(true);
    try {
      await requestWithdrawal("traitement_types", traitementToDelete.id);
      toast.success("Demande de retrait envoyée à l'administrateur");
      setTraitementToDelete(null);
      fetchData();
    } catch (error) {
      console.error("Error requesting withdrawal:", error);
      toast.error("Erreur lors de la demande de retrait");
    } finally {
      setDeletingTraitement(false);
    }
  };

  const duplicateTraitement = async (traitement: TraitementType) => {
    if (!user) return;
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Create the traitement copy
      const newTraitement = await pb.collection("traitement_types").create({
          user: user.id,
          nom: traitement.nom || traitement.pathologie,
          pathologie: traitement.pathologie,
          objectifs: traitement.objectifs || [],
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeanceDisplay = (seance: TraitementSeance) => {
    if (!seance.seance_types) return "Séance";
    const pathologies = seance.seance_types.pathologies?.length ? seance.seance_types.pathologies : [seance.seance_types.pathologie];
    const st = seance.seance_types;
    const objectifs = st.objectifs?.length ? st.objectifs : (st.objectifs_principaux?.length ? st.objectifs_principaux : [st.objectif_principal]);
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

  const parseSnapshot = (raw: string | null | undefined): Record<string, any> | null => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw as Record<string, any>;
    try { return JSON.parse(raw); } catch { return null; }
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
      <div className="container mx-auto px-2 sm:px-4 py-4 md:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-500/10">
              <ClipboardList className="w-8 h-8 text-rose-500" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold">Traitement Type</h1>
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

              {/* Search + multi-filtres */}
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom, code, auteur..."
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

                  // When a shared validated traitement has a pending modification, display those values
                  const snapshot = parseSnapshot(traitement.shared_snapshot);
                  const pendingMod = (traitement.is_shared && traitement.is_validated && snapshot?.modification && !traitement.modification_refused)
                    ? snapshot.modification : null;
                  const displayPathologie = pendingMod?.pathologie ?? traitement.pathologie;
                  const displayObjectifs: string[] = pendingMod?.objectifs ?? (traitement.objectifs || []);
                  const displayDescription: string | null = pendingMod?.description ?? traitement.description ?? null;

                  return (
                    <Fragment key={traitement.id}>
                    <Card className="overflow-hidden">
                      <CardContent className="p-4">
                        {/* Header - Always visible */}
                        <div
                          className="flex items-center justify-between gap-4 cursor-pointer"
                          onClick={() => toggleExpand(traitement.id)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Badge variant="outline" className="font-mono text-xs uppercase px-1.5 py-0.5 bg-muted/50 flex-shrink-0">
                              {traitement.code}
                            </Badge>
                            <Badge variant="outline" className="text-sm flex-shrink-0">{displayPathologie}</Badge>
                            {displayObjectifs.map((o, i) => (
                              <Badge key={i} variant="secondary" className="text-xs flex-shrink-0">{o}</Badge>
                            ))}
                            {traitement.is_copy && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">Copie</Badge>
                            )}
                            <span className="text-xs text-muted-foreground truncate">
                              par {traitement.user_id === user?.id ? "Moi" : (traitement.author_name || "Anonyme")}
                            </span>
                            {canShare && traitement.is_shared && !traitement.is_validated && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">En attente de validation de partage</Badge>
                            )}
                            {canShare && traitement.is_refused && (
                              <Badge className="text-xs bg-red-500 flex-shrink-0">Partage refusé</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              • {traitement.tests?.length || 0} tests • {traitement.seances?.length || 0} séances
                            </span>
                          </div>
                          <div className="flex-shrink-0 text-muted-foreground">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>

                        {/* Expandable content */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t space-y-4">
                            <div className="flex flex-col lg:flex-row gap-4">
                              {/* Main content */}
                              <div className="flex-1 space-y-3">
                                {/* Description */}
                                {displayDescription && (
                                  <p className="text-sm text-muted-foreground">{displayDescription}</p>
                                )}

                                {/* Tests (Exercices) - Table format like Exercices page */}
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold">Tests ({traitement.tests?.length || 0})</p>
                                  {traitement.tests && traitement.tests.length > 0 ? (
                                    <div className="border rounded-lg overflow-hidden">
                                      <div className="overflow-x-auto -mx-2 sm:mx-0">
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
                                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                                              onClick={() => setPreviewExercice({
                                                id: test.exercices?.id,
                                                title: test.exercices?.title || `Test ${j + 1}`,
                                                description: test.exercices?.description || test.description,
                                                video_url: test.exercices?.video_url,
                                                thumbnail_url: test.exercices?.thumbnail_url,
                                              })}
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
                                                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50"
                                                    onClick={() => setPreviewExercice({
                                                      id: exercice.exercices?.id,
                                                      title: exercice.name || exercice.exercices?.title || `Exercice ${j + 1}`,
                                                      description: exercice.exercices?.description || exercice.description,
                                                      video_url: exercice.exercices?.video_url,
                                                      thumbnail_url: exercice.exercices?.thumbnail_url,
                                                      series: exercice.series,
                                                      repetitions: exercice.repetitions,
                                                      duration_seconds: exercice.duration_seconds,
                                                      force_1: exercice.force_1,
                                                      duration_seconds_2: exercice.duration_seconds_2,
                                                      force_2: exercice.force_2,
                                                      comment: exercice.comment,
                                                    })}
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
                                  <div className="flex flex-col gap-1">
                                    <div
                                      className={`flex items-center gap-2${!traitement.is_refused && !(traitement.is_shared && traitement.is_validated) ? " cursor-pointer select-none" : ""}`}
                                      onClick={!traitement.is_refused && !(traitement.is_shared && traitement.is_validated) ? () => toggleShare(traitement.id, traitement.is_shared, traitement.is_copy || false, traitement.is_validated || false) : undefined}
                                    >
                                      {traitement.is_refused ? (
                                        <div className="w-4 h-4 rounded-sm border-2 border-red-500 flex items-center justify-center bg-red-50">
                                          <X className="w-3 h-3 text-red-500" strokeWidth={3} />
                                        </div>
                                      ) : traitement.is_shared && traitement.is_validated ? null : (
                                        <Checkbox
                                          checked={traitement.is_shared}
                                          onCheckedChange={() => toggleShare(traitement.id, traitement.is_shared, traitement.is_copy || false, traitement.is_validated || false)}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      )}
                                      <span className="text-xs flex items-center gap-1">
                                        {traitement.is_shared && traitement.is_validated
                                          ? (traitement.withdrawal_requested
                                            ? <span className="flex items-center gap-1 text-orange-500"><Hourglass className="w-3 h-3" />En attente du retrait par l'admin</span>
                                            : traitement.withdrawal_refused
                                            ? <span className="flex items-center gap-1 text-red-500"><Ban className="w-3 h-3" />Retrait refusé par l'admin</span>
                                            : traitement.modification_pending
                                            ? <span className="flex items-center gap-1 text-orange-500"><Clock className="w-3 h-3" />En attente de validation</span>
                                            : <span className="flex items-center gap-1 text-green-600">
                                                <Check className="w-3 h-3" />Déjà partagé
                                                {traitement.shared_snapshot && !traitement.modification_refused && (
                                                  <button
                                                    title="Voir la version partagée (sans les modifications en attente)"
                                                    className="ml-1 text-green-600 hover:text-green-800"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const s = parseSnapshot(traitement.shared_snapshot);
                                                      if (s?.original) setSharedVersionTraitement(s.original);
                                                    }}
                                                  >
                                                    <Eye className="w-3 h-3" />
                                                  </button>
                                                )}
                                              </span>)
                                          : traitement.is_refused
                                          ? "Partage refusé"
                                          : traitement.is_shared && !traitement.is_validated
                                          ? <><Clock className="w-3 h-3 text-orange-500" />En attente de validation</>
                                          : "Partager"}
                                      </span>
                                    </div>
                                    {/* Modification request for already-validated traitements */}
                                    {traitement.is_shared && traitement.is_validated && !traitement.withdrawal_requested && (
                                      traitement.modification_pending ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 px-1 text-xs text-muted-foreground"
                                          onClick={() => handleCancelTraitementRevision(traitement)}
                                        >
                                          Annuler la modification soumise
                                        </Button>
                                      ) : (modifiedSharedTraitementIds.has(traitement.id) || !!traitement.shared_snapshot) && !traitement.modification_refused ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 px-1 text-xs text-muted-foreground hover:text-primary justify-start"
                                          onClick={() => { setModifRequestDialogTraitement(traitement); setModifRequestNote(""); }}
                                        >
                                          <RefreshCw className="w-3 h-3 mr-1" />
                                          Demander la révision
                                        </Button>
                                      ) : null
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
                                    disabled={isSubmitting}
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
                                      onClick={() => setTraitementToDelete(traitement)}
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
                    {traitement.modification_refused && traitement.is_shared && (traitement.is_validated || traitement.withdrawal_requested) && (() => {
                      // Read refused version from shared_snapshot.refused
                      let draft: any = null;
                      if (traitement.shared_snapshot) {
                        const s = parseSnapshot(traitement.shared_snapshot);
                        draft = s?.refused || null;
                      }
                      const draftPathologie: string = draft?.pathologie || traitement.pathologie;
                      const draftObjectifs: string[] = draft?.objectifs || traitement.objectifs || [];
                      const draftDescription: string | null = draft?.description ?? traitement.description ?? null;
                      const isHistoryExpanded = expandedVersionHistoryIds.has(traitement.id);
                      return (
                        <>
                          {/* Expand/collapse button for version history */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 ml-4 h-7 text-xs gap-1.5 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-950/60 hover:text-red-800 dark:hover:text-red-300"
                            onClick={() => setExpandedVersionHistoryIds(prev => {
                              const s = new Set(prev);
                              if (s.has(traitement.id)) s.delete(traitement.id); else s.add(traitement.id);
                              return s;
                            })}
                          >
                            {isHistoryExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            1 version refusée par l'admin
                          </Button>

                          {/* Full version card — only when expanded */}
                          {isHistoryExpanded && (
                            <div className="mt-1 ml-4">
                              {/* Child card — mirrors main card structure */}
                              <div className="mb-1">
                                <Card className="overflow-hidden border-red-200 dark:border-red-800 border-l-4 border-l-red-300 dark:border-l-red-700 bg-red-50 dark:bg-red-950/40 cursor-pointer" onClick={() => openDraftEditTraitementDialog(traitement)}>
                                  <CardContent className="p-4">
                                    {/* Header row — same layout as main card */}
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                                        <Badge variant="outline" className="text-sm flex-shrink-0">{draftPathologie}</Badge>
                                        {draftObjectifs.map((o, i) => (
                                          <Badge key={i} variant="secondary" className="text-xs flex-shrink-0">{o}</Badge>
                                        ))}
                                        <Badge className="text-xs bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/40 dark:text-red-400 flex-shrink-0">Non partagée</Badge>
                                        <span className="text-xs text-muted-foreground">
                                          • {draft?.tests?.length ?? 0} tests • {draft?.seances?.length ?? 0} séances
                                        </span>
                                      </div>
                                      <div className="flex gap-1.5 shrink-0 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={() => openDraftEditTraitementDialog(traitement)}
                                        >
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={(e) => { e.stopPropagation(); setTraitementModifRefusalToDismiss(traitement); }}
                                          title="Supprimer cette version refusée"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Content — always visible when history panel is open */}
                                    <div className="mt-4 pt-4 border-t space-y-4">
                                      {(
                                        <div className="flex flex-col lg:flex-row gap-4">
                                          <div className="flex-1 space-y-3">
                                            {draftDescription && (
                                              <p className="text-sm text-muted-foreground">{draftDescription}</p>
                                            )}
                                            {/* Tests */}
                                            {(() => {
                                              const draftTests: any[] = draft?.tests || [];
                                              return (
                                                <div className="space-y-2">
                                                  <p className="text-sm font-semibold">Tests ({draftTests.length})</p>
                                                  {draftTests.length > 0 ? (
                                                    <div className="border rounded-lg overflow-hidden">
                                                      <table className="w-full">
                                                        <thead className="bg-muted/50">
                                                          <tr className="text-left text-xs text-muted-foreground">
                                                            <th className="p-2">Titre</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border">
                                                          {draftTests.map((test: any, j: number) => (
                                                            <tr key={j}>
                                                              <td className="p-2"><p className="font-medium text-sm">{test.title || `Test ${j + 1}`}</p></td>
                                                            </tr>
                                                          ))}
                                                        </tbody>
                                                      </table>
                                                    </div>
                                                  ) : (
                                                    <p className="text-xs text-muted-foreground">Aucun test</p>
                                                  )}
                                                </div>
                                              );
                                            })()}
                                            {/* Séances */}
                                            {(() => {
                                              const draftSeances: any[] = draft?.seances || [];
                                              return (
                                                <div className="space-y-2">
                                                  <p className="text-sm font-semibold">Séances ({draftSeances.length})</p>
                                                  {draftSeances.length > 0 ? (
                                                    <div className="space-y-1">
                                                      {draftSeances.map((seance: any, i: number) => (
                                                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/20">
                                                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-xs font-bold text-primary">{i + 1}</span>
                                                          </div>
                                                          <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                                          <span className="text-sm flex-1">
                                                            {seance.pathologie && seance.objectif
                                                              ? `${seance.pathologie} - ${seance.objectif}`
                                                              : seance.pathologie || seance.objectif || "Séance"}
                                                          </span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <p className="text-xs text-muted-foreground">Aucune séance</p>
                                                  )}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    </Fragment>
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
          isValidated={editingTraitementIsValidated}
          isRefused={editingTraitementIsRefused}
          onSuccess={(saved) => {
            const traitementId = editingTraitement?.id;
            const wasDraftMode = editingTraitementDraftMode;
            const currentSnapshot = editingTraitement?.shared_snapshot;
            setEditingTraitementDraftMode(false);
            setEditingTraitementIsRefused(false);
            if (editingTraitementIsValidated && traitementId) {
              setModifiedSharedTraitementIds(prev => new Set([...prev, traitementId]));
              if (wasDraftMode) {
                // Form already stored the new {original, modification} snapshot; just clear the refused flag
                pb.collection("traitement_types").update(traitementId, {
                  modification_refused: false,
                }).finally(() => fetchData());
                return;
              }
            }
            if (editingTraitementIsRefused && !editingTraitementIsValidated && traitementId) {
              pb.collection("traitement_types").update(traitementId, { is_refused: false }).finally(() => fetchData());
              return;
            }
            // Optimistic update + background refresh
            if (saved && traitementId) {
              setTraitements(prev => prev.map(t =>
                t.id === traitementId
                  ? { ...t, description: saved.description, pathologie: saved.pathologie, objectifs: saved.objectifs, is_refused: false, is_shared: false }
                  : t
              ));
            }
            fetchData();
          }}
          isHiddenFromList={false}
        />

        {/* Exercise / Test Preview Dialog */}
        <ExercicePreviewDialog
          exercice={previewExercice}
          open={!!previewExercice}
          onOpenChange={(open) => !open && setPreviewExercice(null)}
        />

        {/* Dismiss refused modification confirmation */}
        <AlertDialog open={!!traitementModifRefusalToDismiss} onOpenChange={(open) => !open && setTraitementModifRefusalToDismiss(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la version refusée ?</AlertDialogTitle>
              <AlertDialogDescription>
                La version refusée de ce traitement sera supprimée définitivement. Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => { if (traitementModifRefusalToDismiss) { await handleDismissTraitementModifRefusal(traitementModifRefusalToDismiss); setTraitementModifRefusalToDismiss(null); } }}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Shared version preview dialog */}
        <Dialog open={!!sharedVersionTraitement} onOpenChange={(open) => { if (!open) setSharedVersionTraitement(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-green-600" />
                Version partagée (sans les modifications en attente)
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded px-3 py-2">
              Cette version est actuellement partagée et visible par les autres utilisateurs. Les modifications en attente ne sont pas incluses.
            </p>
            {sharedVersionTraitement && (
              <div className="space-y-3 py-2">
                {sharedVersionTraitement.pathologie && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Pathologie</p>
                    <Badge variant="outline" className="text-xs">{sharedVersionTraitement.pathologie}</Badge>
                  </div>
                )}
                {sharedVersionTraitement.objectifs?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Objectifs</p>
                    <div className="flex flex-wrap gap-1">
                      {sharedVersionTraitement.objectifs.map((o: string) => (
                        <Badge key={o} variant="secondary" className="text-xs">{o}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {sharedVersionTraitement.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{sharedVersionTraitement.description}</p>
                  </div>
                )}
                {sharedVersionTraitement.seances?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Séances ({sharedVersionTraitement.seances.length})</p>
                    <div className="space-y-1">
                      {sharedVersionTraitement.seances.map((s: any, i: number) => (
                        <div key={i} className="text-sm p-2 rounded border border-border/50 bg-muted/20">
                          {s.pathologie && <span className="font-medium">{s.pathologie}</span>}
                          {s.objectif && <span className="text-muted-foreground ml-2">— {s.objectif}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {sharedVersionTraitement.tests?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tests ({sharedVersionTraitement.tests.length})</p>
                    <div className="space-y-1">
                      {sharedVersionTraitement.tests.map((t: any, i: number) => (
                        <div key={i} className="text-sm p-2 rounded border border-border/50 bg-muted/20">
                          {t.title || `Test ${i + 1}`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modification revision request dialog */}
        <Dialog open={!!modifRequestDialogTraitement} onOpenChange={(open) => { if (!open) { setModifRequestDialogTraitement(null); setModifRequestNote(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary" />
                Demander la révision du traitement modifié
              </DialogTitle>
              <DialogDescription>
                Ce traitement est déjà partagé. L'administrateur sera notifié pour réviser vos modifications avant de les valider.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="modifNoteTraitement">Décrivez vos modifications (optionnel)</Label>
              <Textarea
                id="modifNoteTraitement"
                value={modifRequestNote}
                onChange={(e) => setModifRequestNote(e.target.value)}
                placeholder="Ex : J'ai modifié la description et ajouté une séance..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setModifRequestDialogTraitement(null); setModifRequestNote(""); }}>
                Annuler
              </Button>
              <Button onClick={handleRequestTraitementRevision} className="gradient-primary text-primary-foreground">
                <RefreshCw className="w-4 h-4 mr-2" />
                Soumettre à l'admin
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!traitementToDelete} onOpenChange={(open) => !open && !deletingTraitement && setTraitementToDelete(null)}>
          <AlertDialogContent>
            {traitementToDelete && needsWithdrawalRequest(traitementToDelete) ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Demander le retrait du traitement ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ce traitement est partagé sur la plateforme. Pour le retirer, une demande doit
                    être validée par l'administrateur. Il reste visible jusque-là.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletingTraitement}>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleWithdrawTraitement(); }}
                    disabled={deletingTraitement}
                  >
                    {deletingTraitement && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Demander le retrait à l'admin
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer le traitement ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ce traitement sera déplacé vers la corbeille. Vous pourrez le restaurer depuis
                    la page Corbeille.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletingTraitement}>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleConfirmDeleteTraitement(); }}
                    disabled={deletingTraitement}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingTraitement && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
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
