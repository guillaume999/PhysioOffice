import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, X, ClipboardCheck, Play, FileText, Plus, Trash2, Edit } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { toast } from "sonner";
import { DatePickerInline } from "@/components/patient/DatePickerInline";
import { AddFromLibraryDialog } from "@/components/patient/AddFromLibraryDialog";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

interface InstanceExercice {
  id: string;
  nom: string | null;
  description: string | null;
  ordre: number | null;
  series: number | null;
  repetitions: number | null;
  duree: number | null;
  realise: boolean;
  thumbnail_url?: string | null;
}

interface InstanceSeance {
  id: string;
  nom: string | null;
  objectif: string | null;
  statut: string | null;
  date_prevue: string | null;
  exercices: InstanceExercice[];
}

interface InstanceTest {
  id: string;
  nom: string | null;
  description: string | null;
  ordre: number | null;
  thumbnail_url?: string | null;
}

interface InstanceBilan {
  id: string;
  bilan_date: string | null;
}

interface InstanceDetails {
  id: string;
  nom: string | null;
  pathologie: string | null;
  description: string | null;
  statut: string | null;
  date_debut: string | null;
  tests: InstanceTest[];
  seances: InstanceSeance[];
  bilans: InstanceBilan[];
}

interface Props {
  traitementId: string | null;
  patientId: string;
  praticienId: string;
  onRemove: () => void;
}

const SEANCE_STATUTS = ["planifiée", "réalisée", "annulée"];
const TRAITEMENT_STATUTS = ["actif", "terminé", "suspendu"];

const toDateInput = (v: string | null) => (v ? v.slice(0, 10) : "");

/**
 * Editable display of a patient treatment *instance*. All edits write to the
 * patient_* instance tables and never touch the source templates.
 */
export function PatientTraitementInstanceCard({ traitementId, patientId, praticienId, onRemove }: Props) {
  const navigate = useNavigate();
  const [traitement, setTraitement] = useState<InstanceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [testsExpanded, setTestsExpanded] = useState(false);
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"seance" | "exercice">("seance");
  const [pickerSeanceId, setPickerSeanceId] = useState<string | null>(null);

  useEffect(() => {
    if (traitementId) fetchDetails();
    else setTraitement(null);
  }, [traitementId]);

  const fetchDetails = async () => {
    if (!traitementId) return;
    setLoading(true);
    try {
      const pt: any = await pb.collection("patient_traitements").getOne(traitementId);

      const tests = await pb.collection("patient_traitement_tests").getFullList({
        filter: `patient_traitement = "${traitementId}"`, sort: "ordre", expand: "source",
      }).then((d) => d.map((r: any) => ({
        id: r.id, nom: r.nom, description: r.description, ordre: r.ordre,
        thumbnail_url: r.expand?.source?.thumbnail_url || null,
      })));

      const seancesRaw = await pb.collection("patient_seances").getFullList({
        filter: `patient_traitement = "${traitementId}"`, sort: "created",
      });

      const seances: InstanceSeance[] = await Promise.all(
        seancesRaw.map(async (s: any) => {
          const exs = await pb.collection("patient_seance_exercices").getFullList({
            filter: `patient_seance = "${s.id}"`, sort: "ordre", expand: "source",
          });
          return {
            id: s.id, nom: s.nom, objectif: s.objectif, statut: s.statut, date_prevue: s.date_prevue,
            exercices: exs.map((e: any) => ({
              id: e.id, nom: e.nom, description: e.description, ordre: e.ordre,
              series: e.series, repetitions: e.repetitions, duree: e.duree,
              realise: !!e.realise, thumbnail_url: e.expand?.source?.thumbnail_url || null,
            })),
          };
        })
      );

      const bilans = await pb.collection("patient_bilans").getFullList({
        filter: `patient_traitement = "${traitementId}"`, sort: "bilan_date",
        fields: "id,bilan_date",
      }).then((d) => d.map((b: any) => ({ id: b.id, bilan_date: b.bilan_date })));

      setTraitement({
        id: pt.id, nom: pt.nom, pathologie: pt.pathologie, description: pt.description,
        statut: pt.statut, date_debut: pt.date_debut, tests, seances, bilans,
      });
    } catch (e) {
      console.error("Error fetching patient_traitement instance:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeance = (id: string) => {
    setExpandedSeances((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── mutations ──────────────────────────────────────────────────────────────
  const updateTraitement = async (patch: Record<string, any>) => {
    if (!traitement) return;
    setTraitement({ ...traitement, ...patch });
    try { await pb.collection("patient_traitements").update(traitement.id, patch); }
    catch { toast.error("Erreur lors de la mise à jour"); fetchDetails(); }
  };

  const updateSeance = async (seanceId: string, patch: Record<string, any>) => {
    if (!traitement) return;
    setTraitement({ ...traitement, seances: traitement.seances.map((s) => s.id === seanceId ? { ...s, ...patch } : s) });
    try { await pb.collection("patient_seances").update(seanceId, patch); }
    catch { toast.error("Erreur lors de la mise à jour"); fetchDetails(); }
  };

  // Add a séance, blank (sourceId null) or copied from a seance_types model
  const addSeanceFromLibrary = async (sourceId: string | null) => {
    if (!traitement) return;
    try {
      let nom = "Nouvelle séance";
      let objectif = "";
      if (sourceId) {
        const st: any = await pb.collection("seance_types").getOne(sourceId, { fields: "id,nom,pathologie,objectif_principal,objectif" });
        nom = st.objectif_principal || st.pathologie || st.nom || "Séance";
        objectif = st.objectif_principal || st.objectif || "";
      }
      const ps = await pb.collection("patient_seances").create({
        patient_traitement: traitement.id, patient: patientId, praticien: praticienId,
        source: sourceId, nom, objectif, statut: "planifiée",
      });
      if (sourceId) {
        const exs = await pb.collection("seance_exercices").getFullList({
          filter: `seance_type = "${sourceId}"`, sort: "ordre", expand: "exercice",
        });
        for (const ex of exs as any[]) {
          await pb.collection("patient_seance_exercices").create({
            patient_seance: ps.id, source: ex.exercice || null,
            nom: ex.name || ex.expand?.exercice?.title || "",
            description: ex.description || "", video_url: ex.expand?.exercice?.video_url || "",
            ordre: ex.ordre, series: ex.series, repetitions: ex.repetitions, duree: ex.duration_seconds, realise: false,
          });
        }
      }
      toast.success("Séance ajoutée");
      fetchDetails();
    } catch { toast.error("Erreur lors de l'ajout"); }
  };

  // Add an exercise to a séance, blank or copied from an exercices library record
  const addExerciceFromLibrary = async (seanceId: string, ordre: number, sourceId: string | null) => {
    try {
      let nom = "Nouvel exercice";
      let description = "";
      let video_url = "";
      if (sourceId) {
        const ex: any = await pb.collection("exercices").getOne(sourceId, { fields: "id,title,description,video_url" });
        nom = ex.title || "Exercice";
        description = ex.description || "";
        video_url = ex.video_url || "";
      }
      await pb.collection("patient_seance_exercices").create({
        patient_seance: seanceId, source: sourceId, nom, description, video_url,
        ordre, series: 3, repetitions: 10, realise: false,
      });
      fetchDetails();
    } catch { toast.error("Erreur lors de l'ajout"); }
  };

  const openSeancePicker = () => { setPickerMode("seance"); setPickerSeanceId(null); setPickerOpen(true); };
  const openExercicePicker = (seanceId: string) => { setPickerMode("exercice"); setPickerSeanceId(seanceId); setPickerOpen(true); };

  const handlePick = (sourceId: string | null) => {
    if (pickerMode === "seance") {
      addSeanceFromLibrary(sourceId);
    } else if (pickerSeanceId) {
      const seance = traitement?.seances.find((s) => s.id === pickerSeanceId);
      addExerciceFromLibrary(pickerSeanceId, seance?.exercices.length || 0, sourceId);
    }
  };

  const deleteSeance = async (seanceId: string) => {
    try { await pb.collection("patient_seances").delete(seanceId); toast.success("Séance supprimée"); fetchDetails(); }
    catch { toast.error("Erreur lors de la suppression"); }
  };

  const updateExercice = async (seanceId: string, exId: string, patch: Record<string, any>) => {
    if (!traitement) return;
    setTraitement({
      ...traitement,
      seances: traitement.seances.map((s) => s.id !== seanceId ? s : {
        ...s, exercices: s.exercices.map((e) => e.id === exId ? { ...e, ...patch } : e),
      }),
    });
    try { await pb.collection("patient_seance_exercices").update(exId, patch); }
    catch { toast.error("Erreur lors de la mise à jour"); fetchDetails(); }
  };

  const deleteExercice = async (exId: string) => {
    try { await pb.collection("patient_seance_exercices").delete(exId); fetchDetails(); }
    catch { toast.error("Erreur lors de la suppression"); }
  };

  const deleteTest = async (testId: string) => {
    try { await pb.collection("patient_traitement_tests").delete(testId); fetchDetails(); }
    catch { toast.error("Erreur lors de la suppression"); }
  };

  const addTest = async () => {
    if (!traitement) return;
    try {
      await pb.collection("patient_traitement_tests").create({
        patient_traitement: traitement.id, source: null, nom: "Nouveau test", description: "",
        ordre: traitement.tests.length,
      });
      fetchDetails();
    } catch { toast.error("Erreur lors de l'ajout"); }
  };

  // ── render ───────────────────────────────────────────────────────────────
  if (loading) return <p className="text-muted-foreground text-sm">Chargement...</p>;
  if (!traitement) {
    return <p className="text-muted-foreground text-sm">Aucun traitement actif. Importez-en un ou créez-en un nouveau.</p>;
  }

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="p-2 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge va