import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, X, ClipboardCheck, Play, FileText, Plus, Trash2, Edit } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { toast } from "sonner";
import { DatePickerInline } from "@/components/patient/DatePickerInline";
import { AddFromLibraryDialog } from "@/components/patient/AddFromLibraryDialog";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
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
// timeline: séances + bilans triés par date (sans date à la fin)

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
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

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
              minutes: e.minutes ?? null, commentaires: e.commentaires ?? null,
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

  const updateBilan = async (bilanId: string, patch: Record<string, any>) => {
    if (!traitement) return;
    setTraitement({ ...traitement, bilans: traitement.bilans.map((b) => b.id === bilanId ? { ...b, ...patch } : b) });
    try { await pb.collection("patient_bilans").update(bilanId, patch); }
    catch { toast.error("Erreur lors de la mise à jour"); fetchDetails(); }
  };

  const deleteBilan = async (bilanId: string) => {
    if (!window.confirm("Supprimer ce bilan intermédiaire ? Cette action est irréversible.")) return;
    try { await pb.collection("patient_bilans").delete(bilanId); toast.success("Bilan supprimé"); fetchDetails(); }
    catch { toast.error("Erreur lors de la suppression"); }
  };

  // Add a séance, blank (sourceId null) or copied from a seance_types model
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
      fetchDetails();
    } catch { toast.error("Erreur lors de l'ajout"); }
    finally { setIsSubmitting(false); }
  };

  // Add an exercise to a séance, blank or copied from an exercices library record
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

  // Déplace un exercice vers le haut/bas dans sa séance et persiste le champ ordre.
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

  const deleteTest = async (testId: string) => {
    try { await pb.collection("patient_traitement_tests").delete(testId); fetchDetails(); }
    catch { toast.error("Erreur lors de la suppression"); }
  };

  const addTest = async () => {
    if (!traitement) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await pb.collection("patient_traitement_tests").create({
        patient_traitement: traitement.id, source: null, nom: "Nouveau test", description: "",
        ordre: traitement.tests.length,
      });
      fetchDetails();
    } catch { toast.error("Erreur lors de l'ajout"); }
    finally { setIsSubmitting(false); }
  };

  // ── render ───────────────────────────────────────────────────────────────
  if (loading) return <p className="text-muted-foreground text-sm">Chargement...</p>;
  if (!traitement) {
    return <p className="text-muted-foreground text-sm">Aucun traitement actif. Importez-en un ou créez-en un nouveau.</p>;
  }

  // Flux chronologique : séances + bilans triés par date, éléments sans date à la fin.
  type TimelineItem =
    | { kind: "seance"; date: string | null; seance: InstanceSeance }
    | { kind: "bilan"; date: string | null; bilan: InstanceBilan }
    | { kind: "pending-bilan" };

  const sortedItems = [
    ...traitement.seances.map((s) => ({ kind: "seance" as const, date: s.date_prevue, seance: s })),
    ...traitement.bilans.map((b) => ({ kind: "bilan" as const, date: b.bilan_date, bilan: b })),
  ].sort((a, b) => {
    const da = a.date ? a.date.slice(0, 10) : "";
    const db = b.date ? b.date.slice(0, 10) : "";
    if (da && db) {
      const cmp = da.localeCompare(db);
      if (cmp !== 0) return cmp;
      // à date égale, le bilan intermédiaire passe avant la séance
      if (a.kind !== b.kind) return a.kind === "bilan" ? -1 : 1;
      return 0;
    }
    if (da) return -1; // les éléments datés passent avant les non datés
    if (db) return 1;
    return 0;
  });

  // Insert the pending bilan just before the last séance
  const timeline: TimelineItem[] = [];
  if (traitement.seances.length > 0) {
    const lastSeanceIdx = sortedItems.reduce((last, item, i) => item.kind === "seance" ? i : last, -1);
    for (let i = 0; i < sortedItems.length; i++) {
      if (i === lastSeanceIdx) timeline.push({ kind: "pending-bilan" });
      timeline.push(sortedItems[i]);
    }
  } else {
    timeline.push(...sortedItems);
  }

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="p-2 sm:p-3">
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
          <Button variant="ghost" size="icon" onClick={() => setConfirmRemoveOpen(true)} className="text-destructive h-8 w-8" title="Retirer le traitement">
            <X className="w-4 h-4" />
          </Button>
          <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Retirer ce traitement ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Le traitement et tout son contenu (séances, exercices, tests, bilans) seront définitivement supprimés. Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onRemove}
                >
                  Retirer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          {traitement.date_debut && <span>Début {new Date(traitement.date_debut).toLocaleDateString("fr-FR")} • </span>}
          {traitement.tests.length} tests • {traitement.seances.length} séances
        </div>

        <div className="mt-4 pt-4 border-t space-y-4">
          {traitement.description && <p className="text-sm text-muted-foreground">{traitement.description}</p>}

          {/* Tests */}
          <Collapsible open={testsExpanded} onOpenChange={setTestsExpanded}>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted/70"
              onClick={() => setTestsExpanded((v) => !v)}>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Tests ({traitement.tests.length})</span>
              </div>
              {testsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            <CollapsibleContent className="mt-2 space-y-2">
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
              <Button variant="outline" size="sm" className="w-full gap-1 border-dashed" onClick={addTest} disabled={isSubmitting}>
                <Plus className="w-4 h-4" /> Ajouter un test
              </Button>
            </CollapsibleContent>
          </Collapsible>

          {/* Flux chronologique : séances & bilans intermédiaires */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">
              Séances & bilans ({traitement.seances.length} séance{traitement.seances.length > 1 ? "s" : ""}, {traitement.bilans.length} bilan{traitement.bilans.length > 1 ? "s" : ""})
            </p>
            {timeline.map((item) => {
              if (item.kind === "pending-bilan") {
                return (
                  <div
                    key="pending-bilan"
                    className="flex flex-wrap items-center justify-between gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-dashed border-amber-400 dark:border-amber-600 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                    onClick={() => navigate(`/patients/${patientId}/bilan-intermediaire?pt=${traitement.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center flex-shrink-0">
                        <ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-amber-700 dark:text-amber-400">Bilan intermédiaire</p>
                        <p className="text-xs text-amber-600/70 dark:text-amber-500">À compléter si nécessaire</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-amber-500 font-mono px-2 py-1 rounded border border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/50">---</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-800/50"
                        onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patientId}/bilan-intermediaire?pt=${traitement.id}`); }}
                        title="Compléter le bilan">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              }
              if (item.kind === "bilan") {
                const b = item.bilan;
                return (
                  <div
                    key={`bilan-${b.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => navigate(`/patients/${patientId}/bilan-intermediaire?pt=${traitement.id}&bilan=${b.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <ClipboardCheck className="w-4 h-4 text-primary" />
                      </div>
                      <p className="font-medium text-sm text-primary">Bilan intermédiaire</p>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <DatePickerInline
                        value={toDateInput(b.bilan_date)}
                        onChange={(v) => updateBilan(b.id, { bilan_date: v || null })}
                        className="h-8 text-xs"
                        title="Date du bilan"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => navigate(`/patients/${patientId}/bilan-intermediaire?pt=${traitement.id}&bilan=${b.id}`)}
                        title="Modifier le bilan">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteBilan(b.id)}
                        title="Supprimer le bilan">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              }
              const s = item.seance;
              const isExpanded = expandedSeances.has(s.id);
              return (
                <Collapsible key={s.id} open={isExpanded} onOpenChange={() => toggleSeance(s.id)}>
                  <div className="bg-emerald-100 dark:bg-emerald-900/40 rounded-lg border border-emerald-300 dark:border-emerald-700/50 overflow-hidden">
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {editingTitleId === s.id ? (
                            <Input
                              autoFocus
                              defaultValue={s.nom || ""}
                              onBlur={(e) => {
                                if (e.target.value !== (s.nom || "")) updateSeance(s.id, { nom: e.target.value });
                                setEditingTitleId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") setEditingTitleId(null);
                              }}
                              className="h-7 text-sm font-medium"
                            />
                          ) : (
                            <p className="font-medium text-sm cursor-pointer" onClick={() => toggleSeance(s.id)}>{s.nom || s.objectif || "Séance"}</p>
                          )}
                          <Badge variant="secondary" className="text-xs mt-1">
                            {s.exercices.length} exercice{s.exercices.length > 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTitleId(s.id)} title="Modifier le titre">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteSeance(s.id)} title="Supprimer la séance">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSeance(s.id)}>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <DatePickerInline
                          value={toDateInput(s.date_prevue)}
                          onChange={(v) => updateSeance(s.id, { date_prevue: v || null })}
                          className="h-8 text-xs"
                          title="Date prévue"
                        />
                        <Select value={s.statut || "planifiée"} onValueChange={(v) => updateSeance(s.id, { statut: v })}>
                          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SEANCE_STATUTS.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <CollapsibleContent>
                      <div className="px-2 pb-2 space-y-2 border-t border-border/50 pt-2">
                        {s.exercices.map((ex, exIdx) => (
                          <div key={ex.id} className="flex items-start gap-2 p-2 bg-background/60 rounded border">
                            <div className="flex flex-col mt-0.5">
                              <Button variant="ghost" size="icon" className="h-5 w-5" title="Monter"
                                disabled={exIdx === 0}
                                onClick={() => moveExercice(s.id, ex.id, "up")}>
                                <ChevronUp className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5" title="Descendre"
                                disabled={exIdx === s.exercices.length - 1}
                                onClick={() => moveExercice(s.id, ex.id, "down")}>
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                            </div>
                            <Checkbox checked={ex.realise} onCheckedChange={(c) => updateExercice(s.id, ex.id, { realise: !!c })} title="Réalisé" className="mt-1" />
                            <div className="w-12 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                              {ex.thumbnail_url ? <img src={ex.thumbnail_url} alt={ex.nom || ""} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Play className="w-4 h-4" /></div>}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <Input
                                defaultValue={ex.nom || ""}
                                onBlur={(e) => { if (e.target.value !== (ex.nom || "")) updateExercice(s.id, ex.id, { nom: e.target.value }); }}
                                className="h-7 text-sm font-medium"
                              />
                              <div className="flex flex-wrap gap-1">
                                <NumberField label="séries" value={ex.series} onSave={(n) => updateExercice(s.id, ex.id, { series: n })} />
                                <NumberField label="rép." value={ex.repetitions} onSave={(n) => updateExercice(s.id, ex.id, { repetitions: n })} />
                                <NumberField label="s" value={ex.duree} onSave={(n) => updateExercice(s.id, ex.id, { duree: n })} />
                                <NumberField label="min" value={ex.minutes} onSave={(n) => updateExercice(s.id, ex.id, { minutes: n })} />
                              </div>
                              <Textarea
                                defaultValue={ex.description || ""}
                                onBlur={(e) => { if (e.target.value !== (ex.description || "")) updateExercice(s.id, ex.id, { description: e.target.value }); }}
                                placeholder="Description"
                                rows={2}
                                className="text-xs min-h-0"
                              />
                              <Textarea
                                defaultValue={ex.commentaires || ""}
                                onBlur={(e) => { if (e.target.value !== (ex.commentaires || "")) updateExercice(s.id, ex.id, { commentaires: e.target.value }); }}
                                placeholder="Commentaires"
                                rows={2}
                                className="text-xs min-h-0"
                              />
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive mt-1" onClick={() => deleteExercice(ex.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full gap-1 border-dashed" onClick={() => openExercicePicker(s.id)} disabled={isSubmitting}>
                          <Plus className="w-4 h-4" /> Ajouter un exercice
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="flex-1 justify-start gap-2" onClick={openSeancePicker} disabled={isSubmitting}>
                <Plus className="w-4 h-4" /> Ajouter une séance
              </Button>
              <Button variant="outline" className="flex-1 justify-start gap-2"
                onClick={() => navigate(`/patients/${patientId}/bilan-intermediaire?pt=${traitement.id}`)}>
                <FileText className="w-4 h-4" /> Ajouter un bilan intermédiaire
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <AddFromLibraryDialog open={pickerOpen} onOpenChange={setPickerOpen} mode={pickerMode} onPick={handlePick} />
    </Card>
  );
}

function NumberField({ label, value, onSave }: { label: string; value: number | null; onSave: (n: number | null) => void }) {
  return (
    <div className="flex items-center gap-0.5">
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
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
