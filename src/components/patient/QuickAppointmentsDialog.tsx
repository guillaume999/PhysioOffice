import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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

export function QuickAppointmentsDialog({ open, onOpenChange, patientId, patientName, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"dates" | "repeat">("dates");
  const [saving, setSaving] = useState(false);

  // Mode 1: multi-dates
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [timeDates, setTimeDates] = useState("09:00");
  const [durationDates, setDurationDates] = useState(30);

  // Mode 2: repeat weekly
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [timeRepeat, setTimeRepeat] = useState("09:00");
  const [durationRepeat, setDurationRepeat] = useState(30);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const buildAppointment = (date: Date, time: string, duration: number) => {
    const [h, m] = time.split(":").map(Number);
    const start = new Date(date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + duration * 60000);
    return {
      user_id: user?.id,
      patient_id: patientId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    };
  };

  const handleSave = async () => {
    if (!user) return;
    let rows: any[] = [];

    if (mode === "dates") {
      if (selectedDates.length === 0) {
        toast({ title: "Sélectionnez au moins une date", variant: "destructive" });
        return;
      }
      rows = selectedDates.map((d) => buildAppointment(d, timeDates, durationDates));
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
          rows.push(buildAppointment(new Date(cur), timeRepeat, durationRepeat));
        }
        cur.setDate(cur.getDate() + 1);
      }
      if (rows.length === 0) {
        toast({ title: "Aucun rendez-vous généré", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase.from("appointments").insert(rows);
    setSaving(false);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${rows.length} rendez-vous créé${rows.length > 1 ? "s" : ""}` });
    setSelectedDates([]);
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5" /> Ajout rapide de rendez-vous
          </DialogTitle>
          <DialogDescription>
            {patientName ? `Pour ${patientName}` : "Créer plusieurs rendez-vous en quelques clics"}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Heure</Label>
                <Input type="time" value={timeDates} onChange={(e) => setTimeDates(e.target.value)} />
              </div>
              <div>
                <Label>Durée (min)</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={durationDates}
                  onChange={(e) => setDurationDates(Number(e.target.value))}
                />
              </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Heure</Label>
                <Input type="time" value={timeRepeat} onChange={(e) => setTimeRepeat(e.target.value)} />
              </div>
              <div>
                <Label>Durée (min)</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={durationRepeat}
                  onChange={(e) => setDurationRepeat(Number(e.target.value))}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Créer les rendez-vous
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}