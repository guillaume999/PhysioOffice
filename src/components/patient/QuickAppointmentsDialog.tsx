import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName?: string;
  traitementId: string | null;
  onCreated?: () => void;
}

const WEEKDAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];

export function QuickAppointmentsDialog({ open, onOpenChange, patientId, patientName, traitementId, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"dates" | "repeat">("dates");
  const [saving, setSaving] = useState(false);

  // Mode 1: multi-dates
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  // Mode 2: repeat weekly
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [days, setDays] = useState<number[]>([1, 3, 5]);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!traitementId) {
      toast({ title: "Aucun traitement actif", variant: "destructive" });
      return;
    }

    // Collect target dates
    let dates: Date[] = [];

    if (mode === "dates") {
      if (selectedDates.length === 0) {
        toast({ title: "Sélectionnez au moins une date", variant: "destructive" });
        return;
      }
      dates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    } else {
      if (!startDate || !endDate) {
        toast({ title: "Choisissez une date de début et de fin", variant: "destructive" });
        return;
      }
      if (endDate < startDate) {
        toast({ title: "La date de fin doit être après la date de début", variant: "destructive" });
        return;
      }
      if (days.length === 0) {
        toast({ title: "Sélectionnez au moins un jour de la semaine", variant: "destructive" });
        return;
      }
      const cur = new Date(startDate);
      cur.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      while (cur <= end) {
        if (days.includes(cur.getDay())) {
          dates.push(new Date(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
      if (dates.length === 0) {
        toast({ title: "Aucun rendez-vous généré", variant: "destructive" });
        return;
      }
    }

    setSaving(true);

    // traitementId is a patient_traitements (instance) id. Use the last patient_seances
    // of this instance as the template, and clone an independent copy per date.
    const existing = await pb.collection("patient_seances").getFullList({
      filter: `patient_traitement = "${traitementId}"`,
      sort: "-created",
    });

    const template = existing && existing.length > 0 ? existing[0] : null;

    if (!template) {
      setSaving(false);
      toast({
        title: "Ajoutez d'abord une séance",
        description: "Créez au moins une séance dans ce traitement pour pouvoir en dupliquer rapidement.",
        variant: "destructive",
      });
      return;
    }

    const templateExercices = await pb.collection("patient_seance_exercices").getFullList({
      filter: `patient_seance = "${template.id}"`,
      sort: "ordre",
      fields: "source,nom,description,video_url,ordre,series,repetitions,duree,repos,notes",
    });

    // For each date, create an independent patient_seances clone (date on date_prevue)
    try {
      for (let i = 0; i < dates.length; i++) {
        const ps = await pb.collection("patient_seances").create({
          patient_traitement: traitementId,
          patient: patientId,
          praticien: user.id,
          source: (template as any).source || null,
          nom: (template as any).nom || "",
          objectif: (template as any).objectif || "",
          statut: "planifiée",
          date_prevue: format(dates[i], "yyyy-MM-dd"),
        });
        for (const ex of templateExercices as any[]) {
          await pb.collection("patient_seance_exercices").create({
            patient_seance: ps.id, source: ex.source || null, nom: ex.nom, description: ex.description,
            video_url: ex.video_url, ordre: ex.ordre, series: ex.series, repetitions: ex.repetitions,
            duree: ex.duree, repos: ex.repos, realise: false, notes: ex.notes,
          });
        }
      }
    } catch (e: any) {
      setSaving(false);
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
      return;
    }

    setSaving(false);

    toast({ title: `${dates.length} séance${dates.length > 1 ? "s" : ""} ajoutée${dates.length > 1 ? "s" : ""}` });
    setSelectedDates([]);
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5" /> Ajout rapide de séances
          </DialogTitle>
          <DialogDescription>
            Crée des séances datées dans le traitement actif{patientName ? ` de ${patientName}` : ""}. La dernière séance du traitement est utilisée comme modèle.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "dates" | "repeat")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="dates">Sélection de dates</TabsTrigger>
            <TabsTrigger value="repeat">Répéter une semaine</TabsTrigger>
          </TabsList>

          <TabsContent value="dates" className="space-y-4">
            <div className="flex justify-center">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(d) => setSelectedDates(d || [])}
                locale={fr}
                className={cn("p-3 pointer-events-auto rounded-md border")}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedDates.length} date{selectedDates.length > 1 ? "s" : ""} sélectionnée{selectedDates.length > 1 ? "s" : ""}
            </p>
          </TabsContent>

          <TabsContent value="repeat" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date de début</Label>
                <Input
                  type="date"
                  value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                />
              </div>
              <div>
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Jours de la semaine</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <label
                    key={d.value}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm",
                      days.includes(d.value) ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                    )}
                  >
                    <Checkbox
                      checked={days.includes(d.value)}
                      onCheckedChange={() => toggleDay(d.value)}
                      className="hidden"
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Ajouter les séances
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}