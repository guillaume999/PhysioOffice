import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Printer, Plus, Trash2, X, Copy, Share2, Pencil } from "lucide-react";
import { ShareResourceDialog } from "@/components/sharing/ShareResourceDialog";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, setHours, setMinutes, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { PagePopup } from "@/components/popup/PagePopup";

interface Patient {
  id: string;
  name: string;
  numero: string | null;
  status: string;
}

interface Appointment {
  id: string;
  patient_id: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  patient?: Patient;
}

type ViewMode = "week" | "day";

const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const hours = Math.floor(i / 4); // 00:00 → 23:45
  const minutes = (i % 4) * 15;
  return { hours, minutes, label: `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}` };
});

export default function Planning() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time: { hours: number; minutes: number } } | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<"day" | "week">("week");
  const [sourceDate, setSourceDate] = useState<Date | undefined>(new Date());
  const [targetDate, setTargetDate] = useState<Date | undefined>(addDays(new Date(), 7));
  const [isDuplicating, setIsDuplicating] = useState(false);

  // ===== Print options =====
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printStartHour, setPrintStartHour] = useState<number>(7);
  const [printEndHour, setPrintEndHour] = useState<number>(20);
  const [printFontSize, setPrintFontSize] = useState<"sm" | "md" | "lg">("md");
  // Indices 0..6 (Mon..Sun) of weekDays the user wants printed
  const [printDayIndices, setPrintDayIndices] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  // When true, the table is rendered with the print filters applied
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchPatients();
      fetchAppointments();
    }
  }, [user, currentDate, viewMode]);

  const fetchPatients = async () => {
    try {
      const data = await pb.collection("patients").getFullList({
        filter: `user = "${user!.id}" && status != "Inactif"`,
        sort: "name",
        fields: "id,name,numero,status",
      });
      setPatients(data as any[]);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const fetchAppointments = async () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

    const userId = pb.authStore.model?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const data = await pb.collection("appointments").getFullList({
        filter: `user = "${userId}" && start_time >= "${weekStart.toISOString()}" && start_time <= "${weekEnd.toISOString()}"`,
        sort: "start_time",
        expand: "patient",
      });
      const appointmentsWithPatients = data.map((apt: any) => ({
        ...apt,
        patient_id: apt.patient,
        patient: apt.expand?.patient || patients.find(p => p.id === apt.patient) || undefined,
      }));
      setAppointments(appointmentsWithPatients);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const handleSlotClick = (date: Date, time: { hours: number; minutes: number }) => {
    setSelectedSlot({ date, time });
    setSelectedPatientId("");
    setAppointmentNotes("");
    setDuration(30);
    setEditingAppointmentId(null);
    setIsDialogOpen(true);
  };

  const handleEditAppointment = (apt: Appointment) => {
    const start = parseISO(apt.start_time);
    const end = parseISO(apt.end_time);
    const durMin = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    setSelectedSlot({ date: start, time: { hours: start.getHours(), minutes: start.getMinutes() } });
    setSelectedPatientId(apt.patient_id);
    setAppointmentNotes(apt.notes || "");
    setDuration(durMin);
    setEditingAppointmentId(apt.id);
    setIsDialogOpen(true);
  };

  const handleCreateAppointment = async () => {
    if (!selectedSlot || !selectedPatientId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un patient", variant: "destructive" });
      return;
    }

    const startTime = setMinutes(setHours(selectedSlot.date, selectedSlot.time.hours), selectedSlot.time.minutes);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    if (editingAppointmentId) {
      try {
        await pb.collection("appointments").update(editingAppointmentId, {
          patient: selectedPatientId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          notes: appointmentNotes || null,
        });
        toast({ title: "Rendez-vous modifié" });
        setIsDialogOpen(false);
        setEditingAppointmentId(null);
        fetchAppointments();
      } catch (e: any) {
        toast({ title: "Erreur", description: e.message, variant: "destructive" });
      }
    } else {
      try {
        await pb.collection("appointments").create({
          user: user?.id,
          patient: selectedPatientId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          notes: appointmentNotes || null,
        });
        toast({ title: "Rendez-vous créé" });
        setIsDialogOpen(false);
        fetchAppointments();
      } catch (e: any) {
        toast({ title: "Erreur", description: e.message, variant: "destructive" });
      }
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!confirm("Supprimer ce rendez-vous ?")) return;
    
    try {
      await pb.collection("appointments").delete(appointmentId);
      toast({ title: "Rendez-vous supprimé" });
      fetchAppointments();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleAddToPatientTreatment = async (appointment: Appointment) => {
    if (!appointment.patient) return;
    navigate(`/patients/${appointment.patient_id}`);
  };

  const handlePrint = () => {
    setIsPrintDialogOpen(true);
  };

  const launchPrint = () => {
    setIsPrintDialogOpen(false);
    setPrintMode(true);
    // Wait long enough for Radix to fully unmount the dialog portal (exit anim)
    // and for React to commit the filtered table DOM before opening the print dialog.
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode(false), 400);
    }, 350);
  };

  const togglePrintDay = (idx: number) => {
    setPrintDayIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const handleDuplicate = async () => {
    if (!sourceDate || !targetDate) {
      toast({ title: "Erreur", description: "Veuillez sélectionner les dates source et cible", variant: "destructive" });
      return;
    }
    
    setIsDuplicating(true);
    try {
      if (duplicateMode === "week") {
        // Fetch appointments for the source week
        const sourceWeekStart = startOfWeek(sourceDate, { weekStartsOn: 1 });
        const sourceWeekEnd = endOfWeek(sourceDate, { weekStartsOn: 1 });
        const targetWeekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
        
        const sourceAppointments = await pb.collection("appointments").getFullList({
          filter: `user = "${user!.id}" && start_time >= "${sourceWeekStart.toISOString()}" && start_time <= "${sourceWeekEnd.toISOString()}"`,
        });
        
        const appointmentsToDuplicate = (sourceAppointments || []).map(apt => {
          const originalStart = parseISO(apt.start_time);
          const originalEnd = parseISO(apt.end_time);
          const dayOfWeek = originalStart.getDay() === 0 ? 6 : originalStart.getDay() - 1; // Monday = 0
          
          const newStartDate = addDays(targetWeekStart, dayOfWeek);
          const newStart = setMinutes(setHours(newStartDate, originalStart.getHours()), originalStart.getMinutes());
          const newEnd = setMinutes(setHours(newStartDate, originalEnd.getHours()), originalEnd.getMinutes());
          
          return {
            user: user?.id,
            patient: apt.patient,
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
            notes: apt.notes,
          };
        });
        
        if (appointmentsToDuplicate.length > 0) {
          for (const a of appointmentsToDuplicate) await pb.collection("appointments").create(a);
        }
        
        toast({ title: "Semaine dupliquée", description: `${appointmentsToDuplicate.length} rendez-vous copiés vers la semaine du ${format(targetWeekStart, "d MMMM", { locale: fr })}` });
      } else {
        // Fetch appointments for the source day
        const sourceDayStart = new Date(sourceDate);
        sourceDayStart.setHours(0, 0, 0, 0);
        const sourceDayEnd = new Date(sourceDate);
        sourceDayEnd.setHours(23, 59, 59, 999);
        
        const sourceAppointments = await pb.collection("appointments").getFullList({
          filter: `user = "${user!.id}" && start_time >= "${sourceDayStart.toISOString()}" && start_time <= "${sourceDayEnd.toISOString()}"`,
        });
        
        const appointmentsToDuplicate = (sourceAppointments || []).map(apt => {
          const originalStart = parseISO(apt.start_time);
          const originalEnd = parseISO(apt.end_time);
          
          const newStart = setMinutes(setHours(targetDate, originalStart.getHours()), originalStart.getMinutes());
          const newEnd = setMinutes(setHours(targetDate, originalEnd.getHours()), originalEnd.getMinutes());
          
          return {
            user: user?.id,
            patient: apt.patient,
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
            notes: apt.notes,
          };
        });
        
        if (appointmentsToDuplicate.length > 0) {
          for (const a of appointmentsToDuplicate) await pb.collection("appointments").create(a);
        }
        
        toast({ title: "Jour dupliqué", description: `${appointmentsToDuplicate.length} rendez-vous copiés vers le ${format(targetDate, "d MMMM", { locale: fr })}` });
      }
      
      setIsDuplicateDialogOpen(false);
      // Jump the view to the target date so the user immediately sees the duplicates
      setCurrentDate(targetDate);
      fetchAppointments();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsDuplicating(false);
    }
  };

  const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  const getAppointmentsForSlot = (date: Date, time: { hours: number; minutes: number }) => {
    return appointments.filter(apt => {
      const aptStart = parseISO(apt.start_time);
      return isSameDay(aptStart, date) && 
             aptStart.getHours() === time.hours && 
             aptStart.getMinutes() === time.minutes;
    });
  };

  const getPatientCountForDay = (date: Date) => {
    const dayAppointments = appointments.filter(apt => isSameDay(parseISO(apt.start_time), date));
    const uniquePatients = new Set(dayAppointments.map(apt => apt.patient_id));
    return uniquePatients.size;
  };

  const navigateDate = (direction: "prev" | "next") => {
    if (viewMode === "week") {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === "prev" ? addDays(currentDate, -1) : addDays(currentDate, 1));
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const weekDays = getWeekDays();
  const baseDisplayDays = viewMode === "week" ? weekDays : [currentDate];
  const displayDays =
    printMode && viewMode === "week"
      ? printDayIndices.map((i) => weekDays[i]).filter(Boolean)
      : baseDisplayDays;
  const visibleSlots = printMode
    ? TIME_SLOTS.filter(
        (s) => s.hours >= printStartHour && (s.hours < printEndHour || (s.hours === printEndHour && s.minutes === 0))
      )
    : TIME_SLOTS;

  // Pre-compute rowSpan so each appointment occupies the correct number of 15-min rows
  const slotDaySpanMap: { skip: boolean; rowSpan: number }[][] = visibleSlots.map(() =>
    displayDays.map(() => ({ skip: false, rowSpan: 1 }))
  );
  visibleSlots.forEach((slot, slotIdx) => {
    displayDays.forEach((day, dayIdx) => {
      if (slotDaySpanMap[slotIdx][dayIdx].skip) return;
      const starting = appointments.filter(apt => {
        const s = parseISO(apt.start_time);
        return isSameDay(s, day) && s.getHours() === slot.hours && s.getMinutes() === slot.minutes;
      });
      if (starting.length === 0) return;
      const durationMin = Math.max(15, Math.round(
        (parseISO(starting[0].end_time).getTime() - parseISO(starting[0].start_time).getTime()) / 60000
      ));
      const numSlots = Math.round(durationMin / 15);
      slotDaySpanMap[slotIdx][dayIdx].rowSpan = numSlots;
      for (let i = 1; i < numSlots; i++) {
        if (slotIdx + i < visibleSlots.length) {
          slotDaySpanMap[slotIdx + i][dayIdx].skip = true;
        }
      }
    });
  });

  return (
    <Layout>
      <PagePopup pageKey="planning" />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <CalendarIcon className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Planning</h1>
              <p className="text-muted-foreground">
                {viewMode === "week" 
                  ? `Semaine du ${format(weekDays[0], "d MMMM", { locale: fr })} au ${format(weekDays[6], "d MMMM yyyy", { locale: fr })}`
                  : format(currentDate, "EEEE d MMMM yyyy", { locale: fr })
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={viewMode} onValueChange={(v: ViewMode) => setViewMode(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semaine</SelectItem>
                <SelectItem value="day">Jour</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
              Aujourd'hui
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={handlePrint} className="print:hidden">
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
            <Button variant="outline" onClick={() => setIsDuplicateDialogOpen(true)} className="print:hidden">
              <Copy className="w-4 h-4 mr-2" />
              Dupliquer
            </Button>
            <ShareResourceDialog
              resourceType="planning"
              trigger={
                <Button variant="outline" className="print:hidden">
                  <Share2 className="w-4 h-4 mr-2" />
                  Partager
                </Button>
              }
            />
          </div>
        </div>

        {appointments.length === 0 && (
          <Alert className="mb-4 print:hidden">
            <AlertTitle>Aucun rendez-vous affiché</AlertTitle>
            <AlertDescription>
              Vous êtes connecté en tant que <span className="font-medium">{user?.email}</span>. Ce compte n'a aucun rendez-vous enregistré.
            </AlertDescription>
          </Alert>
        )}

        {/* Calendar Grid */}
        <Card
          className="print:shadow-none print:border-none"
          data-print-font={printFontSize}
        >
          <CardContent className="p-0" ref={printRef}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr>
                    <th className="border p-2 bg-muted/50 w-20 text-xs font-medium">Heure</th>
                    {displayDays.map((day, idx) => {
                      const patientCount = getPatientCountForDay(day);
                      return (
                        <th 
                          key={idx} 
                          className={`border p-2 bg-muted/50 text-xs font-medium ${
                            isSameDay(day, new Date()) ? "bg-primary/10 text-primary" : ""
                          }`}
                        >
                          <div>
                            {format(day, "EEE", { locale: fr })}
                            {patientCount > 0 && (
                              <span className="ml-1 text-muted-foreground">({patientCount})</span>
                            )}
                          </div>
                          <div className="text-lg font-bold">{format(day, "d")}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleSlots.map((slot, slotIdx) => (
                    <tr key={slotIdx} className={slot.minutes === 0 ? "border-t-2" : slot.minutes === 30 ? "border-t border-border/40" : "border-t border-border/20"}>
                      <td className="border-r border-b bg-muted/30 select-none w-16 p-0 pr-1 align-top">
                        <span className={slot.minutes === 0
                          ? "text-[11px] font-semibold text-foreground/80 block leading-none pt-px"
                          : "text-[9px] text-muted-foreground/50 block leading-none pt-px"
                        }>
                          {slot.label.replace(":", "h")}
                        </span>
                      </td>
                      {displayDays.map((day, dayIdx) => {
                        const spanInfo = slotDaySpanMap[slotIdx][dayIdx];
                        if (spanInfo.skip) return null;
                        const slotAppointments = getAppointmentsForSlot(day, slot);
                        const rowSpan = spanInfo.rowSpan;
                        return (
                          <td
                            key={dayIdx}
                            rowSpan={rowSpan > 1 ? rowSpan : undefined}
                            className={`border p-0.5 h-8 cursor-pointer hover:bg-primary/5 transition-colors relative ${
                              isSameDay(day, new Date()) ? "bg-primary/5" : ""
                            }`}
                            onClick={() => slotAppointments.length === 0 && handleSlotClick(day, slot)}
                          >
                            {slotAppointments.map((apt) => (
                              <div
                                key={apt.id}
                                className="absolute inset-0.5 bg-primary/20 border border-primary/30 rounded text-xs p-1 overflow-hidden flex flex-col"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-medium truncate flex-1">{apt.patient?.name || "Patient"}</span>
                                  <div className="flex gap-0.5 shrink-0 print:hidden">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5 p-0 bg-primary/20 hover:bg-primary/40"
                                      onClick={() => handleAddToPatientTreatment(apt)}
                                      title="Ajouter séance au traitement"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5 p-0 bg-primary/20 hover:bg-primary/40"
                                      onClick={() => handleEditAppointment(apt)}
                                      title="Modifier le rendez-vous"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5 p-0 bg-destructive/20 hover:bg-destructive/40 text-destructive"
                                      onClick={() => handleDeleteAppointment(apt.id)}
                                      title="Supprimer le rendez-vous"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                {rowSpan >= 2 && (
                                  <div className="text-[10px] text-primary/70 mt-0.5 print:hidden">
                                    {format(parseISO(apt.start_time), "HH:mm")} – {format(parseISO(apt.end_time), "HH:mm")}
                                  </div>
                                )}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-4 flex gap-4 text-sm text-muted-foreground print:hidden">
          <span>Cliquez sur un créneau pour ajouter un rendez-vous</span>
        </div>
      </div>

      {/* Create Appointment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAppointmentId ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">
                  {format(selectedSlot.date, "EEEE d MMMM yyyy", { locale: fr })}
                </p>
                <p className="text-sm text-muted-foreground">
                  à {selectedSlot.time.hours.toString().padStart(2, "0")}:{selectedSlot.time.minutes.toString().padStart(2, "0")}
                </p>
              </div>

              <div>
                <Label>Patient *</Label>
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un patient" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[60vh] overflow-y-auto">
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.numero && `(${p.numero})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Durée</Label>
                <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 heure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={appointmentNotes}
                  onChange={(e) => setAppointmentNotes(e.target.value)}
                  placeholder="Notes optionnelles..."
                  rows={3}
                />
              </div>

              <Button onClick={handleCreateAppointment} className="w-full gradient-primary text-primary-foreground">
                {editingAppointmentId ? "Enregistrer" : "Créer le rendez-vous"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dupliquer les rendez-vous</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mode de duplication</Label>
              <Select value={duplicateMode} onValueChange={(v: "day" | "week") => setDuplicateMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Dupliquer une semaine</SelectItem>
                  <SelectItem value="day">Dupliquer un jour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Source Date */}
              <div className="space-y-2">
                <Label>{duplicateMode === "week" ? "Semaine source" : "Jour source"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !sourceDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {sourceDate ? format(sourceDate, duplicateMode === "week" ? "'S.' w" : "dd/MM/yy", { locale: fr }) : <span>Source</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={sourceDate}
                      onSelect={setSourceDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
                {sourceDate && (
                  <p className="text-xs text-muted-foreground">
                    {duplicateMode === "week" 
                      ? `Semaine du ${format(startOfWeek(sourceDate, { weekStartsOn: 1 }), "d MMM", { locale: fr })}`
                      : format(sourceDate, "EEEE d MMM", { locale: fr })
                    }
                  </p>
                )}
              </div>

              {/* Target Date */}
              <div className="space-y-2">
                <Label>{duplicateMode === "week" ? "Semaine cible" : "Jour cible"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !targetDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {targetDate ? format(targetDate, duplicateMode === "week" ? "'S.' w" : "dd/MM/yy", { locale: fr }) : <span>Cible</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={targetDate}
                      onSelect={setTargetDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
                {targetDate && (
                  <p className="text-xs text-muted-foreground">
                    {duplicateMode === "week" 
                      ? `Semaine du ${format(startOfWeek(targetDate, { weekStartsOn: 1 }), "d MMM", { locale: fr })}`
                      : format(targetDate, "EEEE d MMM", { locale: fr })
                    }
                  </p>
                )}
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              {duplicateMode === "week" ? (
                <p>Tous les rendez-vous de la semaine source seront copiés vers la semaine cible en conservant leurs jours et horaires.</p>
              ) : (
                <p>Tous les rendez-vous du jour source seront copiés vers le jour cible en conservant leurs horaires.</p>
              )}
            </div>

            <Button 
              onClick={handleDuplicate} 
              className="w-full gradient-primary text-primary-foreground"
              disabled={isDuplicating || !sourceDate || !targetDate}
            >
              {isDuplicating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Duplication en cours...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Dupliquer
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 5mm !important;
          }
          
          * {
            box-sizing: border-box !important;
            -webkit-user-select: none !important;
            user-select: none !important;
            cursor: default !important;
            outline: none !important;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 10px !important;
          }
          
          nav, footer, header, .print\\:hidden, [class*="MobileBottomNav"], .mt-4, button {
            display: none !important;
          }

          /* Hide any Radix dialog/popover portals and toasts during print */
          [role="dialog"],
          [role="alertdialog"],
          [data-radix-popper-content-wrapper],
          [data-sonner-toaster],
          [data-radix-portal] {
            display: none !important;
          }
          
          #root {
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .container {
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .py-8 {
            padding: 0 !important;
          }
          
          .mb-8 {
            margin-bottom: 1mm !important;
          }
          
          .flex.items-center.gap-3 {
            gap: 2mm !important;
          }
          
          .p-3 {
            padding: 0 !important;
          }
          
          .rounded-xl {
            border-radius: 2px !important;
          }
          
          .w-6, .h-6 {
            width: 10px !important;
            height: 10px !important;
          }
          
          h1, .text-3xl {
            font-size: 14px !important;
            line-height: 1.2 !important;
            margin: 0 !important;
          }
          
          .text-muted-foreground {
            font-size: 9px !important;
          }
          
          .overflow-x-auto {
            overflow: visible !important;
          }
          
          table {
            font-size: 8px !important;
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }

          /* Repeat header row on every printed page */
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
          tr, td, th { page-break-inside: avoid !important; break-inside: avoid !important; }

          thead th {
            font-size: 9px !important;
            padding: 1mm !important;
            height: auto !important;
          }
          
          thead th .text-lg {
            font-size: 10px !important;
          }
          
          tbody tr {
            height: 3.5mm !important;
            max-height: 3.5mm !important;
          }
          
          th, td {
            padding: 0.5mm !important;
            height: 3.5mm !important;
            max-height: 3.5mm !important;
            overflow: hidden !important;
            line-height: 1.1 !important;
            border: 0.5px solid #ddd !important;
          }
          
          th:first-child, td:first-child {
            width: 28px !important;
            font-size: 6px !important;
          }
          
          .h-8 {
            height: 3.5mm !important;
          }
          
          .absolute.inset-0\\.5 {
            position: absolute !important;
            inset: 0.2mm !important;
            padding: 0.3mm !important;
            font-size: 9px !important;
            font-weight: 600 !important;
          }
          
          .bg-primary\\/20 {
            background-color: rgba(147, 51, 234, 0.4) !important;
          }
          
          .bg-primary\\/5 {
            background-color: rgba(147, 51, 234, 0.05) !important;
          }
          
          .bg-primary\\/10 {
            background-color: rgba(147, 51, 234, 0.15) !important;
          }
          
          .bg-muted\\/50 {
            background-color: rgba(200, 200, 200, 0.4) !important;
          }
          
          .bg-muted\\/30 {
            background-color: rgba(200, 200, 200, 0.2) !important;
          }
          
          .border-t-2 {
            border-top: 1px solid #999 !important;
          }

          /* Font-size variants chosen in the print dialog */
          [data-print-font="sm"] table { font-size: 7px !important; }
          [data-print-font="sm"] thead th { font-size: 7px !important; }
          [data-print-font="sm"] tbody tr,
          [data-print-font="sm"] th,
          [data-print-font="sm"] td { height: 3mm !important; max-height: 3mm !important; }
          [data-print-font="sm"] .absolute.inset-0\\.5 { font-size: 7px !important; }

          [data-print-font="lg"] table { font-size: 11px !important; }
          [data-print-font="lg"] thead th { font-size: 11px !important; }
          [data-print-font="lg"] tbody tr,
          [data-print-font="lg"] th,
          [data-print-font="lg"] td { height: 5mm !important; max-height: 5mm !important; }
          [data-print-font="lg"] .absolute.inset-0\\.5 { font-size: 11px !important; }
        }
      `}</style>

      {/* Print options dialog */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-lg print:hidden">
          <DialogHeader>
            <DialogTitle>Options d'impression</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Time range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Heure de début</Label>
                <Select
                  value={String(printStartHour)}
                  onValueChange={(v) => setPrintStartHour(Number(v))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i.toString().padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Heure de fin</Label>
                <Select
                  value={String(printEndHour)}
                  onValueChange={(v) => setPrintEndHour(Number(v))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h.toString().padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Days (only meaningful in week view) */}
            {viewMode === "week" && (
              <div>
                <Label className="mb-2 block">Jours à imprimer</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DAY_NAMES.map((name, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={printDayIndices.includes(idx)}
                        onCheckedChange={() => togglePrintDay(idx)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Font size */}
            <div>
              <Label className="mb-2 block">Taille des caractères</Label>
              <RadioGroup
                value={printFontSize}
                onValueChange={(v) => setPrintFontSize(v as "sm" | "md" | "lg")}
                className="flex gap-4"
              >
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="sm" /> Petite
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="md" /> Moyenne
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="lg" /> Grande
                </label>
              </RadioGroup>
            </div>

            <p className="text-xs text-muted-foreground">
              Astuce : dans la fenêtre d'aperçu de votre navigateur, vous pourrez
              choisir les pages à imprimer (champ « Pages »).
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsPrintDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={launchPrint}
              disabled={
                printEndHour <= printStartHour ||
                (viewMode === "week" && printDayIndices.length === 0)
              }
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
