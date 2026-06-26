import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { softDelete, withActive } from "@/lib/corbeille";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { fr } from "date-fns/locale";
import type { DayContentProps } from "react-day-picker";
import {
  ChevronUp, ChevronDown, ClipboardCheck, FileText, Plus, Trash2, Edit, List, Calendar, ArrowUpDown, GripVertical,
} from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { toast } from "sonner";
import { DatePickerInline } from "@/components/patient/DatePickerInline";
import { AddFromLibraryDialog } from "@/components/patient/AddFromLibraryDialog";
import { MediaThumb } from "@/components/MediaThumb";
import { ExercicePreviewDialog, type ExercicePreview } from "@/components/exercice/ExercicePreviewDialog";
import { setExDragImage } from "@/components/patient/PatientTraitementInstanceCard";
import { useConfirm } from "@/hooks/useConfirm";

interface InstanceExercice {
  id: string;
  nom: string | null;
  description: string | null;
  ordre: number | null;
  series: number | null;
  repetitions: number | null;
  duree: number | null;
  minutes: number | null;
  commentaires: string | null;
  realise: boolean;
  thumbnail_url?: string | null;
  video_url?: string | null;
  image_url?: string | null;
  media_type?: string | null;
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
  video_url?: string | null;
  image_url?: string | null;
  media_type?: string | null;
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
const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "—";

type Selection =
  | { kind: "tests" }
  | { kind: "seance"; id: string };

/**
 * Variante master-détail (tiroir) de l'affichage du traitement actif.
 * La liste des séances sert de navigation ; le détail d'une seule séance
 * occupe la zone principale. Écrit dans les tables patient_* (jamais les modèles).
 */
export function PatientTraitementInstanceCardV2({ traitementId, patientId, praticienId, onRemove }: Props) {
  const navigate = useNavigate();
  const [traitement, setTraitement] = useState<InstanceDetails | null>(null);
  const [bilanInitialDate, setBilanInitialDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: "tests" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"seance" | "exercice" | "test">("seance");
  const [pickerSeanceId, setPickerSeanceId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [previewExercice, setPreviewExercice] = useState<ExercicePreview | null>(null);
  const [dragExId, setDragExId] = useState<string | null>(null);
  const [dragOverExId, setDragOverExId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => {
    try { return (localStorage.getItem("traitementActifSort") as "asc" | "desc") || "desc"; } catch { return "desc"; }
  });

  const toggleSort = () => setSortDir((d) => {
    const next = d === "asc" ? "desc" : "asc";
    try { localStorage.setItem("traitementActifSort", next); } catch { /* ignore */ }
    return next;
  });

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
        video_url: r.expand?.source?.video_url || null,
        image_url: r.expand?.source?.image_url || null,
        media_type: r.expand?.source?.media_type || null,
      })));

      const seancesRaw = await pb.collection("patient_seances").getFullList({
        filter: withActive(`patient_traitement = "${traitementId}"`), sort: "created",
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
              minutes: e.minutes ?? null, commentaires: e.commentaires ?? null,
              realise: !!e.realise, thumbnail_url: e.expand?.source?.thumbnail_url || null,
              video_url: e.expand?.source?.video_url || null,
              image_url: e.expand?.source?.image_url || null,
              media_type: e.expand?.source?.media_type || null,
            })),
          };
        })
      );

      const bilans = await pb.collection("patient_bilans").getFullList({
        filter: withActive(`patient_traitement = "${traitementId}"`), sort: "bilan_date",
        fields: "id,bilan_date",
      }).then((d) => d.map((b: any) => ({ id: b.id, bilan_date: b.bilan_date })));

      // Date du bilan initial (niveau patient, partagée via patient_care_plans)
      const cp: any = await pb.collection("patient_care_plans")
        .getFirstListItem(`patient = "${patientId}"`, { fields: "id,bilan_initial_date" })
        .catch(() => null);
      setBilanInitialDate(cp?.bilan_initial_date || null);

      const details: InstanceDetails = {
        id: pt.id, nom: pt.nom, pathologie: pt.pathologie, description: pt.description,
        statut: pt.statut, date_debut: pt.date_debut, tests, seances, bilans,
      };
      setTraitement(details);

      // Sélection par défaut : 1re séance planifiée à venir, sinon dernière séance, sinon tests.
      setSelection((prev) => {
        if (prev.kind === "seance" && details.seances.some((s) => s.id === prev.id)) return prev;
        const today = new Date().toISOString().slice(0, 10);
        const upcoming = details.seances
          .filter((s) => s.statut === "planifiée" && (s.date_prevue ? s.date_prevue.slice(0, 10) >= today : true))
          .sort((a, b) => (a.date_prevue || "").localeCompare(b.date_prevue || ""))[0];
        const target = upcoming || details.seances[details.seances.length - 1];
        return target ? { kind: "seance", id: target.id } : { kind: "tests" };
      });
    } catch (e) {
      console.error("Error fetching patient_traitement instance:", e);
    } finally {
      setLoading(false);
    }
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

  const addSeanceFromLibrary = async (sourceId: string | null) => {
    if (!traitement) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
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
      setSelection({ kind: "seance", id: ps.id });
      fetchDetails();
    } catch { toast.error("Erreur lors de l'ajout"); }
    finally { setIsSubmitting(false); }
  };

  const addExerciceFromLibrary = async (seanceId: string, ordre: number, sourceId: string | null) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
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
    finally { setIsSubmitting(false); }
  };

  const openSeancePicker = () => { setPickerMode("seance"); setPickerSeanceId(null); setPickerOpen(true); };
  const openExercicePicker = (seanceId: string) => { setPickerMode("exercice"); setPickerSeanceId(seanceId); setPickerOpen(true); };
  const openTestPicker = () => { setPickerMode("test"); setPickerSeanceId(null); setPickerOpen(true); };

  const handlePick = (sourceId: string | null) => {
    if (pickerMode === "seance") {
      addSeanceFromLibrary(sourceId);
    } else if (pickerMode === "test") {
      addTestFromLibrary(sourceId);
    } else if (pickerSeanceId) {
      const seance = traitement?.seances.find((s) => s.id === pickerSeanceId);
      addExerciceFromLibrary(pickerSeanceId, seance?.exercices.length || 0, sourceId);
    }
  };

  const deleteSeance = async (seanceId: string) => {
    if (!(await confirm({ title: "Supprimer cette séance ?", description: "La séance sera déplacée vers la corbeille (récupérable)." }))) return;
    try {
      await softDelete("patient_seances", seanceId);
      toast.success("Séance déplacée vers la corbeille");
      setSelection((prev) => (prev.kind === "seance" && prev.id === seanceId ? { kind: "tests" } : prev));
      fetchDetails();
    } catch { toast.error("Erreur lors de la suppression"); }
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
    if (!(await confirm({ title: "Supprimer cet exercice ?", description: "Cette action est irréversible." }))) return;
    try { await pb.collection("patient_seance_exercices").delete(exId); fetchDetails(); }
    catch { toast.error("Erreur lors de la suppression"); }
  };

  const moveExercice = async (seanceId: string, exId: string, dir: "up" | "down") => {
    if (!traitement) return;
    const seance = traitement.seances.find((s) => s.id === seanceId);
    if (!seance) return;
    const idx = seance.exercices.findIndex((e) => e.id === exId);
    if (idx === -1) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= seance.exercices.length) return;

    const reordered = [...seance.exercices];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const withOrdre = reordered.map((e, i) => ({ ...e, ordre: i }));

    setTraitement({
      ...traitement,
      seances: traitement.seances.map((s) => s.id !== seanceId ? s : { ...s, exercices: withOrdre }),
    });

    try {
      await Promise.all([
        pb.collection("patient_seance_exercices").update(withOrdre[idx].id, { ordre: idx }),
        pb.collection("patient_seance_exercices").update(withOrdre[swapIdx].id, { ordre: swapIdx }),
      ]);
    } catch {
      toast.error("Erreur lors du réordonnancement");
      fetchDetails();
    }
  };

  // Réordonne un exercice par glisser-déposer (de fromIdx vers toIdx) et persiste les ordres impactés.
  const reorderExercice = async (seanceId: string, fromIdx: number, toIdx: number) => {
    if (!traitement || fromIdx === toIdx) return;
    const seance = traitement.seances.find((s) => s.id === seanceId);
    if (!seance) return;
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= seance.exercices.length || toIdx >= seance.exercices.length) return;

    const reordered = [...seance.exercices];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const withOrdre = reordered.map((e, i) => ({ ...e, ordre: i }));

    setTraitement({
      ...traitement,
      seances: traitement.seances.map((s) => s.id !== seanceId ? s : { ...s, exercices: withOrdre }),
    });

    try {
      await Promise.all(
        withOrdre
          .map((e, i) => seance.exercices.findIndex((x) => x.id === e.id) === i
            ? null
            : pb.collection("patient_seance_exercices").update(e.id, { ordre: i }))
          .filter(Boolean) as Promise<unknown>[]
      );
    } catch {
      toast.error("Erreur lors du réordonnancement");
      fetchDetails();
    }
  };

  const deleteTest = async (testId: string) => {
    if (!(await confirm({ title: "Supprimer ce test ?", description: "Cette action est irréversible." }))) return;
    try { await pb.collection("patient_traitement_tests").delete(testId); fetchDetails(); }
    catch { toast.error("Erreur lors de la suppression"); }
  };

  // Ajoute un test vierge ou copié depuis un exercice de la bibliothèque.
  const addTestFromLibrary = async (sourceId: string | null) => {
    if (!traitement) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      let nom = "Nouveau test";
      let description = "";
      if (sourceId) {
        const ex: any = await pb.collection("exercices").getOne(sourceId, { fields: "id,title,description" });
        nom = ex.title || "Test";
        description = ex.description || "";
      }
      await pb.collection("patient_traitement_tests").create({
        patient_traitement: traitement.id, source: sourceId, nom, description,
        ordre: traitement.tests.length,
      });
      fetchDetails();
    } catch { toast.error("Erreur lors de l'ajout"); }
    finally { setIsSubmitting(false); }
  };

  const updateBilan = async (bilanId: string, patch: Record<string, any>) => {
    if (!traitement) return;
    setTraitement({ ...traitement, bilans: traitement.bilans.map((b) => b.id === bilanId ? { ...b, ...patch } : b) });
    try { await pb.collection("patient_bilans").update(bilanId, patch); }
    catch { toast.error("Erreur lors de la mise à jour"); fetchDetails(); }
  };

  const deleteBilan = async (bilanId: string) => {
    if (!(await confirm({ title: "Supprimer ce bilan intermédiaire ?", description: "Le bilan sera déplacé vers la corbeille." }))) return;
    try { await softDelete("patient_bilans", bilanId); toast.success("Bilan déplacé vers la corbeille"); fetchDetails(); }
    catch { toast.error("Erreur lors de la suppression"); }
  };

  const seanceNumber = useMemo(() => {
    const map = new Map<string, number>();
    traitement?.seances.forEach((s, i) => map.set(s.id, i + 1));
    return map;
  }, [traitement]);

  // ── render ───────────────────────────────────────────────────────────────
  if (loading) return <p className="text-muted-foreground text-sm">Chargement...</p>;
  if (!traitement) {
    return <p className="text-muted-foreground text-sm">Aucun traitement actif. Importez-en un ou créez-en un nouveau.</p>;
  }

  const selectedSeance =
    selection.kind === "seance" ? traitement.seances.find((s) => s.id === selection.id) ?? null : null;

  const handleSelect = (sel: Selection) => { setSelection(sel); setMobileNavOpen(false); };

  // ── timeline : séances + bilans entremêlés, triés par date selon sortDir ────
  type Row =
    | { kind: "seance"; date: string; seance: InstanceSeance }
    | { kind: "bilan"; date: string; bilan: InstanceBilan };
  const rows: Row[] = [
    ...traitement.seances.map((s) => ({ kind: "seance" as const, date: s.date_prevue ? s.date_prevue.slice(0, 10) : "", seance: s })),
    ...traitement.bilans.map((b) => ({ kind: "bilan" as const, date: b.bilan_date ? b.bilan_date.slice(0, 10) : "", bilan: b })),
  ].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;   // sans date → toujours en fin de liste
    if (!b.date) return -1;
    const c = a.date.localeCompare(b.date);
    return sortDir === "asc" ? c : -c;
  });

  // ── onglet "Liste" ──────────────────────────────────────────────────────────
  const listTab = (
    <div className="space-y-1 p-1">
      <button
        onClick={() => handleSelect({ kind: "tests" })}
        className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
          selection.kind === "tests" ? "bg-primary/15 text-primary font-medium" : "hover:bg-accent/60"
        }`}
      >
        <ClipboardCheck className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 truncate">Tests</span>
        <Badge variant="secondary" className="text-xs">{traitement.tests.length}</Badge>
      </button>

      <div className="flex items-center justify-between px-2 pt-3 pb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Séances &amp; bilans
        </span>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={toggleSort} title="Inverser l'ordre">
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortDir === "asc" ? "Chrono" : "Antichrono"}
        </Button>
      </div>

      {rows.length === 0 && (
        <p className="px-3 py-2 text-xs text-muted-foreground">Aucune séance.</p>
      )}

      {rows.map((row) => {
        if (row.kind === "seance") {
          const s = row.seance;
          const active = selection.kind === "seance" && selection.id === s.id;
          const done = s.statut === "réalisée";
          const cancelled = s.statut === "annulée";
          return (
            <button
              key={s.id}
              onClick={() => handleSelect({ kind: "seance", id: s.id })}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                active ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-medium" : "hover:bg-accent/60"
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                done ? "bg-emerald-500 text-white" : cancelled ? "bg-muted text-muted-foreground line-through" : "bg-primary/10 text-primary"
              }`}>
                {seanceNumber.get(s.id)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate">{s.nom || s.objectif || "Séance"}</span>
                <span className="block text-xs text-muted-foreground">
                  {fmtDate(s.date_prevue)} • {s.exercices.length} ex.
                </span>
              </span>
            </button>
          );
        }
        const b = row.bilan;
        return (
          <div key={`bilan-${b.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
            <ClipboardCheck className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-amber-700 dark:text-amber-400 truncate">Bilan intermédiaire</span>
              <div onClick={(e) => e.stopPropagation()} className="mt-0.5">
                <DatePickerInline
                  value={toDateInput(b.bilan_date)}
                  onChange={(v) => updateBilan(b.id, { bilan_date: v || null })}
                  className="h-7 text-xs"
                  title="Date du bilan"
                />
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 dark:text-amber-400"
              onClick={() => navigate(`/patients/${patientId}/bilan-intermediaire?pt=${traitement.id}&bilan=${b.id}`)}
              title="Ouvrir le bilan">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteBilan(b.id)} title="Supprimer">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      })}

      <button
        onClick={() => { setMobileNavOpen(false); navigate(`/patients/${patientId}/bilan-initial`); }}
        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left bg-sky-50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-800/40 hover:bg-sky-100/70 dark:hover:bg-sky-900/30 transition-colors"
      >
        <ClipboardCheck className="w-4 h-4 flex-shrink-0 text-sky-600 dark:text-sky-400" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-sky-700 dark:text-sky-400 truncate">Bilan initial</span>
          <span className="block text-xs text-muted-foreground">{fmtDate(bilanInitialDate)}</span>
        </span>
        <Edit className="w-4 h-4 flex-shrink-0 text-sky-600 dark:text-sky-400" />
      </button>
    </div>
  );

  // ── onglet "Calendrier" : séance (vert), bilan (ambre), jour mixte = 2 triangles
  const seanceKeys = new Set(traitement.seances.filter((s) => s.date_prevue).map((s) => s.date_prevue!.slice(0, 10)));
  const bilanKeys = new Set(traitement.bilans.filter((b) => b.bilan_date).map((b) => b.bilan_date!.slice(0, 10)));
  const bothKeys = new Set([...seanceKeys].filter((k) => bilanKeys.has(k)));
  const keyToDate = (k: string) => new Date(k + "T00:00:00");
  const seanceDays = [...seanceKeys].filter((k) => !bothKeys.has(k)).map(keyToDate);
  const bilanDays = [...bilanKeys].filter((k) => !bothKeys.has(k)).map(keyToDate);
  const bothDays = [...bothKeys].map(keyToDate);

  const handleDayClick = (day: Date) => {
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const s = traitement.seances.find((x) => x.date_prevue && x.date_prevue.slice(0, 10) === key);
    if (s) { handleSelect({ kind: "seance", id: s.id }); return; }
    const b = traitement.bilans.find((x) => x.bilan_date && x.bilan_date.slice(0, 10) === key);
    if (b) { setMobileNavOpen(false); navigate(`/patients/${patientId}/bilan-intermediaire?pt=${traitement.id}&bilan=${b.id}`); }
  };

  const calendarTab = (
    <div className="p-1">
      <CalendarPicker
        mode="single"
        locale={fr}
        onDayClick={handleDayClick}
        modifiers={{ seance: seanceDays, bilan: bilanDays, both: bothDays }}
        components={{ DayContent: CalendarDayContent }}
        className="rounded-md border mx-auto"
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-2 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/60 inline-block" /> Séances</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400/70 inline-block" /> Bilans</span>
        <span className="flex items-center gap-1.5">
          <span className="relative w-3.5 h-3.5 inline-block">
            <span className="absolute left-0 top-0 h-0 w-0 border-t-[7px] border-r-[7px] border-t-emerald-500 border-r-transparent" />
            <span className="absolute bottom-0 right-0 h-0 w-0 border-b-[7px] border-l-[7px] border-b-amber-400 border-l-transparent" />
          </span>
          Séance + bilan
        </span>
      </div>
    </div>
  );

  // ── cadre gauche : onglets Liste / Calendrier ───────────────────────────────
  const leftPanel = (
    <Tabs defaultValue="liste" className="w-full">
      <div className="flex items-center gap-1">
        <TabsList className="grid flex-1 grid-cols-2">
          <TabsTrigger value="liste" className="gap-1.5"><List className="w-4 h-4" /> Liste</TabsTrigger>
          <TabsTrigger value="calendrier" className="gap-1.5"><Calendar className="w-4 h-4" /> Calendrier</TabsTrigger>
        </TabsList>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-dashed" onClick={openSeancePicker} disabled={isSubmitting} title="Ajouter une séance">
          <Plus className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-dashed"
          onClick={() => navigate(`/patients/${patientId}/bilan-intermediaire?pt=${traitement.id}`)}
          title="Ajouter un bilan intermédiaire">
          <FileText className="w-4 h-4" />
        </Button>
      </div>
      <TabsContent value="liste" className="mt-2">
        <div className="max-h-[55vh] md:max-h-[65vh] overflow-y-auto pr-1">{listTab}</div>
      </TabsContent>
      <TabsContent value="calendrier" className="mt-2">{calendarTab}</TabsContent>
    </Tabs>
  );

  // ── panneau détail ──────────────────────────────────────────────────────────
  const detailPanel = selection.kind === "tests" ? (
    <div className="space-y-2">
      <p className="text-sm font-semibold flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-primary" /> Tests ({traitement.tests.length})</p>
      {traitement.tests.map((t, i) => (
        <div key={t.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary">{i + 1}</span>
          </div>
          <div className="w-16 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {t.thumbnail_url ? <img src={t.thumbnail_url} alt={t.nom || ""} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><FileText className="w-5 h-5" /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{t.nom || `Test ${i + 1}`}</p>
            {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTest(t.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1 border-dashed" onClick={openTestPicker} disabled={isSubmitting}>
        <Plus className="w-4 h-4" /> Ajouter un test
      </Button>
    </div>
  ) : selectedSeance ? (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editingTitleId === selectedSeance.id ? (
            <Input
              autoFocus
              defaultValue={selectedSeance.nom || ""}
              onBlur={(e) => {
                if (e.target.value !== (selectedSeance.nom || "")) updateSeance(selectedSeance.id, { nom: e.target.value });
                setEditingTitleId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingTitleId(null);
              }}
              className="h-8 text-base font-semibold"
            />
          ) : (
            <h3 className="text-base font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                {seanceNumber.get(selectedSeance.id)}
              </span>
              {selectedSeance.nom || selectedSeance.objectif || "Séance"}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTitleId(selectedSeance.id)} title="Modifier le titre">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteSeance(selectedSeance.id)} title="Supprimer la séance">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DatePickerInline
          value={toDateInput(selectedSeance.date_prevue)}
          onChange={(v) => updateSeance(selectedSeance.id, { date_prevue: v || null })}
          className="h-8 text-xs"
          title="Date prévue"
        />
        <Select value={selectedSeance.statut || "planifiée"} onValueChange={(v) => updateSeance(selectedSeance.id, { statut: v })}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SEANCE_STATUTS.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">
          {selectedSeance.exercices.length} exercice{selectedSeance.exercices.length > 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="space-y-2 pt-2 border-t">
        {selectedSeance.exercices.map((ex, exIdx) => (
          <div
            key={ex.id}
            data-ex-row
            className={`flex items-start gap-2 p-2 bg-background/60 rounded border transition-all ${
              dragOverExId === ex.id && dragExId && dragExId !== ex.id ? "ring-2 ring-primary border-primary" : ""
            } ${dragExId === ex.id ? "opacity-40" : ""}`}
            onDragOver={(e) => { if (dragExId) { e.preventDefault(); if (dragOverExId !== ex.id) setDragOverExId(ex.id); } }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragExId && dragExId !== ex.id) {
                reorderExercice(selectedSeance.id, selectedSeance.exercices.findIndex((x) => x.id === dragExId), exIdx);
              }
              setDragExId(null); setDragOverExId(null);
            }}
          >
            <div className="flex flex-col items-center mt-0.5">
              <span
                draggable
                onDragStart={(e) => { setDragExId(ex.id); e.dataTransfer.effectAllowed = "move"; setExDragImage(e); }}
                onDragEnd={() => { setDragExId(null); setDragOverExId(null); }}
                className="flex items-center justify-center h-5 w-5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                title="Glisser pour réordonner"
              >
                <GripVertical className="w-4 h-4" />
              </span>
              <Button variant="ghost" size="icon" className="h-5 w-5" title="Monter"
                disabled={exIdx === 0}
                onClick={() => moveExercice(selectedSeance.id, ex.id, "up")}>
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" title="Descendre"
                disabled={exIdx === selectedSeance.exercices.length - 1}
                onClick={() => moveExercice(selectedSeance.id, ex.id, "down")}>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
            <MediaThumb
              source={ex}
              alt={ex.nom || ""}
              showPlayIcon
              className="w-24 h-20 mt-1"
              onClick={() => setPreviewExercice({
                title: ex.nom || "",
                description: ex.description,
                video_url: ex.video_url,
                thumbnail_url: ex.thumbnail_url,
                image_url: ex.image_url,
                media_type: ex.media_type,
              })}
            />
            <div className="flex-1 min-w-0 space-y-1">
              <Input
                defaultValue={ex.nom || ""}
                onBlur={(e) => { if (e.target.value !== (ex.nom || "")) updateExercice(selectedSeance.id, ex.id, { nom: e.target.value }); }}
                className="h-7 text-sm font-medium"
              />
              <div className="flex flex-wrap gap-1">
                <NumberField label="rép." value={ex.repetitions} onSave={(n) => updateExercice(selectedSeance.id, ex.id, { repetitions: n })} />
                <NumberField label="séries" value={ex.series} onSave={(n) => updateExercice(selectedSeance.id, ex.id, { series: n })} />
                <NumberField label="min" value={ex.minutes} onSave={(n) => updateExercice(selectedSeance.id, ex.id, { minutes: n })} />
                <NumberField label="sec" value={ex.duree} onSave={(n) => updateExercice(selectedSeance.id, ex.id, { duree: n })} />
              </div>
              <Textarea
                defaultValue={ex.description || ""}
                onBlur={(e) => { if (e.target.value !== (ex.description || "")) updateExercice(selectedSeance.id, ex.id, { description: e.target.value }); }}
                placeholder="Description"
                rows={2}
                className="text-xs min-h-0"
              />
              <Textarea
                defaultValue={ex.commentaires || ""}
                onBlur={(e) => { if (e.target.value !== (ex.commentaires || "")) updateExercice(selectedSeance.id, ex.id, { commentaires: e.target.value }); }}
                placeholder="Commentaires"
                rows={2}
                className="text-xs min-h-0"
              />
            </div>
            <div className="flex flex-col items-center gap-2 mt-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteExercice(ex.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <label className="flex flex-col items-center gap-0.5 cursor-pointer">
                <Checkbox checked={ex.realise} onCheckedChange={(c) => updateExercice(selectedSeance.id, ex.id, { realise: !!c })} title="Réalisé" />
                <span className={`text-[9px] leading-none whitespace-nowrap ${ex.realise ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
                  {ex.realise ? "Réalisé" : "Non réalisé"}
                </span>
              </label>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1 border-dashed" onClick={() => openExercicePicker(selectedSeance.id)} disabled={isSubmitting}>
          <Plus className="w-4 h-4" /> Ajouter un exercice
        </Button>
      </div>
    </div>
  ) : (
    <p className="text-sm text-muted-foreground text-center py-8">Sélectionnez une séance dans la liste.</p>
  );

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="p-2 sm:p-3">
        {/* En-tête traitement */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-sm">{traitement.pathologie || traitement.nom}</Badge>
            <Select value={traitement.statut || "actif"} onValueChange={(v) => updateTraitement({ statut: v })}>
              <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRAITEMENT_STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive h-8 w-8"
            title="Retirer le traitement"
            onClick={async () => {
              if (!(await confirm({
                title: "Retirer ce traitement ?",
                description: "Le traitement et tout son contenu (séances, exercices, tests, bilans) seront définitivement supprimés. Cette action est irréversible.",
                confirmLabel: "Retirer",
              }))) return;
              onRemove();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          {traitement.date_debut && <span>Début {new Date(traitement.date_debut).toLocaleDateString("fr-FR")} • </span>}
          {traitement.tests.length} tests • {traitement.seances.length} séances • {traitement.bilans.length} bilans
        </div>
        {traitement.description && <p className="mt-2 text-sm text-muted-foreground">{traitement.description}</p>}

        {/* Barre mobile : ouvrir la liste en tiroir */}
        <div className="md:hidden mt-3">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="w-full justify-between gap-2">
                <span className="flex items-center gap-2"><List className="w-4 h-4" /> Liste des séances</span>
                <Badge variant="secondary" className="text-xs">{traitement.seances.length}</Badge>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85%] sm:w-80 p-0">
              <SheetHeader className="p-4 pb-2">
                <SheetTitle className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Navigation</SheetTitle>
              </SheetHeader>
              <div className="px-2 pb-4">{leftPanel}</div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Master-détail (desktop ≥ md) */}
        <div className="mt-4 pt-4 border-t flex gap-4">
          <aside className="hidden md:block w-80 flex-shrink-0 border-r pr-2">
            {leftPanel}
          </aside>
          <div className="flex-1 min-w-0">{detailPanel}</div>
        </div>
      </CardContent>

      <AddFromLibraryDialog open={pickerOpen} onOpenChange={setPickerOpen} mode={pickerMode} onPick={handlePick} />
      <ExercicePreviewDialog exercice={previewExercice} open={!!previewExercice} onOpenChange={(o) => { if (!o) setPreviewExercice(null); }} />
      {confirmDialog}
    </Card>
  );
}

// Cellule de calendrier : numéro du jour + 2 triangles (vert séance / ambre bilan)
// uniquement quand une séance ET un bilan tombent le même jour.
function CalendarDayContent(props: DayContentProps) {
  const m = props.activeModifiers as Record<string, boolean>;
  const seanceOnly = m.seance && !m.both;
  const bilanOnly = m.bilan && !m.both;
  return (
    <span className="relative flex h-full w-full items-center justify-center">
      {/* Marqueur ~moitié de la cellule, derrière le numéro */}
      {seanceOnly && <span className="pointer-events-none absolute h-5 w-5 rounded-sm bg-emerald-500/70" />}
      {bilanOnly && <span className="pointer-events-none absolute h-5 w-5 rounded-sm bg-amber-400/80" />}
      {m.both && (
        <span className="pointer-events-none absolute h-5 w-5 overflow-hidden rounded-sm">
          <span className="absolute left-0 top-0 h-0 w-0 border-t-[20px] border-r-[20px] border-t-emerald-500 border-r-transparent" />
          <span className="absolute bottom-0 right-0 h-0 w-0 border-b-[20px] border-l-[20px] border-b-amber-400 border-l-transparent" />
        </span>
      )}
      <span className="relative z-10">{props.date.getDate()}</span>
    </span>
  );
}

function NumberField({ label, value, onSave }: { label: string; value: number | null; onSave: (n: number | null) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Input
        type="number"
        defaultValue={value ?? ""}
        onBlur={(e) => {
          const raw = e.target.value;
          const n = raw === "" ? null : Number(raw);
          if (n !== value) onSave(n);
        }}
        className="h-6 w-12 text-xs px-1"
      />
    </div>
  );
}
