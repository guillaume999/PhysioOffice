import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, ChevronsUpDown, Search, Check } from "lucide-react";
import { format } from "date-fns";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { ExercicePreview } from "@/components/exercice/ExercicePreviewDialog";

interface PatientLite {
  id: string;
  name: string;
}
interface TraitementLite {
  id: string;
  label: string;
  statut: string;
}
interface SeanceLite {
  id: string;
  label: string;
}

interface Props {
  exercice: ExercicePreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Copie un exercice (par référence `source`) dans une séance d'un traitement
// patient : nouvelle séance, ou séance existante (« en cours »).
export function CopyExerciceToSeanceDialog({ exercice, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [patientId, setPatientId] = useState<string>("");
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);

  const [traitements, setTraitements] = useState<TraitementLite[]>([]);
  const [traitementId, setTraitementId] = useState<string>("");

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [seanceName, setSeanceName] = useState("");
  const [seances, setSeances] = useState<SeanceLite[]>([]);
  const [seanceId, setSeanceId] = useState<string>("");

  const [saving, setSaving] = useState(false);

  const selectedPatient = useMemo(() => patients.find((p) => p.id === patientId), [patients, patientId]);

  // Réinitialise + charge les patients à l'ouverture.
  useEffect(() => {
    if (!open || !user) return;
    setPatientId("");
    setTraitements([]);
    setTraitementId("");
    setMode("new");
    setSeances([]);
    setSeanceId("");
    setSeanceName(`Séance du ${format(new Date(), "dd/MM/yyyy")}`);
    pb.collection("patients")
      .getFullList({ filter: `user = "${user.id}"`, sort: "name", fields: "id,name" })
      .then((rows) => setPatients((rows as any[]).map((r) => ({ id: r.id, name: r.name || "Sans nom" }))))
      .catch(() => setPatients([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  // Charge les traitements du patient sélectionné.
  useEffect(() => {
    if (!patientId) {
      setTraitements([]);
      setTraitementId("");
      return;
    }
    pb.collection("patient_traitements")
      .getFullList({ filter: `patient = "${patientId}"`, sort: "-created", fields: "id,nom,pathologie,statut" })
      .then((rows) => {
        const list: TraitementLite[] = (rows as any[]).map((r) => ({
          id: r.id,
          label: r.nom || r.pathologie || "Traitement",
          statut: r.statut || "",
        }));
        setTraitements(list);
        const actif = list.find((t) => t.statut === "actif");
        setTraitementId(actif?.id || list[0]?.id || "");
      })
      .catch(() => setTraitements([]));
  }, [patientId]);

  // Charge les séances existantes du traitement (pour le mode "existing").
  useEffect(() => {
    if (!traitementId) {
      setSeances([]);
      setSeanceId("");
      return;
    }
    pb.collection("patient_seances")
      .getFullList({ filter: `patient_traitement = "${traitementId}"`, sort: "-created", fields: "id,nom,statut,date_prevue" })
      .then((rows) => {
        const list: SeanceLite[] = (rows as any[]).map((r) => {
          const d = r.date_prevue ? ` — ${r.date_prevue}` : "";
          return { id: r.id, label: `${r.nom || "Séance"}${d}` };
        });
        setSeances(list);
        setSeanceId(list[0]?.id || "");
      })
      .catch(() => setSeances([]));
  }, [traitementId]);

  const canSubmit =
    !!exercice &&
    !!patientId &&
    !!traitementId &&
    (mode === "new" ? seanceName.trim().length > 0 : !!seanceId);

  const handleCopy = async () => {
    if (saving || !canSubmit || !exercice || !user) return;
    setSaving(true);
    try {
      let targetSeanceId = seanceId;
      if (mode === "new") {
        const ps = await pb.collection("patient_seances").create({
          patient_traitement: traitementId,
          patient: patientId,
          praticien: user.id,
          source: null,
          nom: seanceName.trim(),
          objectif: "",
          statut: "planifiée",
        });
        targetSeanceId = (ps as any).id;
      }

      // Ordre = nombre d'exercices déjà présents dans la séance.
      const existing = await pb.collection("patient_seance_exercices").getFullList({
        filter: `patient_seance = "${targetSeanceId}"`,
        fields: "id",
      });

      await pb.collection("patient_seance_exercices").create({
        patient_seance: targetSeanceId,
        source: exercice.id || null,
        nom: exercice.title || "",
        description: exercice.description || "",
        video_url: exercice.video_url || "",
        ordre: (existing as any[]).length,
        series: 3,
        repetitions: 10,
        realise: false,
      });

      toast.success("Exercice copié dans la séance", {
        action: {
          label: "Voir le patient",
          onClick: () => navigate(`/patients/${patientId}`),
        },
      });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la copie");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copier vers une séance patient</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {exercice && (
            <p className="text-sm text-muted-foreground">
              Exercice : <span className="font-medium text-foreground">{exercice.title}</span>
            </p>
          )}

          {/* Patient */}
          <div className="space-y-2">
            <Label>Patient</Label>
            <Popover open={patientPickerOpen} onOpenChange={setPatientPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="flex items-center gap-2 truncate">
                    <Search className="w-3 h-3 shrink-0" />
                    {selectedPatient ? selectedPatient.name : "Choisir un patient…"}
                  </span>
                  <ChevronsUpDown className="w-3 h-3 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Rechercher un patient…" />
                  <CommandList>
                    <CommandEmpty>Aucun patient.</CommandEmpty>
                    <CommandGroup>
                      {patients.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.name} ${p.id}`}
                          onSelect={() => {
                            setPatientId(p.id);
                            setPatientPickerOpen(false);
                          }}
                        >
                          <Check className={`w-3.5 h-3.5 mr-2 ${patientId === p.id ? "opacity-100" : "opacity-0"}`} />
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Traitement */}
          {patientId && (
            <div className="space-y-2">
              <Label>Traitement</Label>
              {traitements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ce patient n'a aucun traitement.</p>
              ) : (
                <Select value={traitementId} onValueChange={setTraitementId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un traitement…" />
                  </SelectTrigger>
                  <SelectContent>
                    {traitements.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                        {t.statut ? ` (${t.statut})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Séance */}
          {patientId && traitementId && (
            <div className="space-y-2">
              <Label>Séance</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as "new" | "existing")} className="gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="new" id="mode-new" />
                  <Label htmlFor="mode-new" className="font-normal">Nouvelle séance</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="existing" id="mode-existing" disabled={seances.length === 0} />
                  <Label htmlFor="mode-existing" className="font-normal">
                    Séance existante {seances.length === 0 && "(aucune)"}
                  </Label>
                </div>
              </RadioGroup>

              {mode === "new" ? (
                <Input
                  value={seanceName}
                  onChange={(e) => setSeanceName(e.target.value)}
                  placeholder="Nom de la séance"
                />
              ) : (
                <Select value={seanceId} onValueChange={setSeanceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une séance…" />
                  </SelectTrigger>
                  <SelectContent>
                    {seances.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleCopy} disabled={!canSubmit || saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Copier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
