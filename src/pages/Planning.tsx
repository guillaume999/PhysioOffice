import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ChevronLeft, ChevronRight, Loader2, Printer, Plus, Trash2, X, Copy, Share2 } from "lucide-react";
import { ShareResourceDialog } from "@/components/sharing/ShareResourceDialog";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, setHours, setMinutes, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

const TIME_SLOTS = Array.from({ length: 52 }, (_, i) => {
  const hours = Math.floor(i / 4) + 7; // Start at 7:00
  const minutes = (i % 4) * 15;
  return { hours, minutes, label: `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}` };
}).filter(slot => slot.hours < 20); // End at 19:45 (last slot before 20:00)

export default function Planning() {
  const { user, loading: authLoading } = useAuth();
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
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<"day" | "week">("week");
  const [sourceDayIndex, setSourceDayIndex] = useState<number>(0);
  const [targetDayIndex, setTargetDayIndex] = useState<number>(1);
  const [targetWeekOffset, setTargetWeekOffset] = useState<number>(1);
  const [isDuplicating, setIsDuplicating] = useState(false);

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
    const { data, error } = await supabase
      .from("patients")
      .select("id, name, numero, status")
      .neq("status", "inactive")
      .order("name");
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else setPatients(data || []);
  };

  const fetchAppointments = async () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .gte("start_time", weekStart.toISOString())
      .lte("start_time", weekEnd.toISOString())
      .order("start_time");

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      // Fetch patient info for each appointment
      const appointmentsWithPatients = await Promise.all(
        (data || []).map(async (apt) => {
          const patient = patients.find(p => p.id === apt.patient_id) || 
            (await supabase.from("patients").select("id, name, numero, status").eq("id", apt.patient_id).single()).data;
          return { ...apt, patient: patient || undefined };
        })
      );
      setAppointments(appointmentsWithPatients);
    }
    setLoading(false);
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
    setIsDialogOpen(true);
  };

  const handleCreateAppointment = async () => {
    if (!selectedSlot || !selectedPatientId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un patient", variant: "destructive" });
      return;
    }

    const startTime = setMinutes(setHours(selectedSlot.date, selectedSlot.time.hours), selectedSlot.time.minutes);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const { error } = await supabase.from("appointments").insert({
      user_id: user?.id,
      patient_id: selectedPatientId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes: appointmentNotes || null,
    });

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rendez-vous créé" });
      setIsDialogOpen(false);
      fetchAppointments();
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!confirm("Supprimer ce rendez-vous ?")) return;
    
    const { error } = await supabase.from("appointments").delete().eq("id", appointmentId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rendez-vous supprimé" });
      fetchAppointments();
    }
  };

  const handleAddToPatientTreatment = async (appointment: Appointment) => {
    if (!appointment.patient) return;
    navigate(`/patients/${appointment.patient_id}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      if (duplicateMode === "week") {
        // Duplicate entire week to target week
        const targetWeekStart = addWeeks(startOfWeek(currentDate, { weekStartsOn: 1 }), targetWeekOffset);
        
        const appointmentsToDuplicate = appointments.map(apt => {
          const originalStart = parseISO(apt.start_time);
          const originalEnd = parseISO(apt.end_time);
          const dayOfWeek = originalStart.getDay() === 0 ? 6 : originalStart.getDay() - 1; // Monday = 0
          
          const newStartDate = addDays(targetWeekStart, dayOfWeek);
          const newStart = setMinutes(setHours(newStartDate, originalStart.getHours()), originalStart.getMinutes());
          const newEnd = setMinutes(setHours(newStartDate, originalEnd.getHours()), originalEnd.getMinutes());
          
          return {
            user_id: user?.id,
            patient_id: apt.patient_id,
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
            notes: apt.notes,
          };
        });
        
        if (appointmentsToDuplicate.length > 0) {
          const { error } = await supabase.from("appointments").insert(appointmentsToDuplicate);
          if (error) throw error;
        }
        
        toast({ title: "Semaine dupliquée", description: `${appointmentsToDuplicate.length} rendez-vous copiés` });
      } else {
        // Duplicate day to another day
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const sourceDay = addDays(weekStart, sourceDayIndex);
        const targetDay = addDays(weekStart, targetDayIndex);
        
        const dayAppointments = appointments.filter(apt => {
          const aptStart = parseISO(apt.start_time);
          return isSameDay(aptStart, sourceDay);
        });
        
        const appointmentsToDuplicate = dayAppointments.map(apt => {
          const originalStart = parseISO(apt.start_time);
          const originalEnd = parseISO(apt.end_time);
          
          const newStart = setMinutes(setHours(targetDay, originalStart.getHours()), originalStart.getMinutes());
          const newEnd = setMinutes(setHours(targetDay, originalEnd.getHours()), originalEnd.getMinutes());
          
          return {
            user_id: user?.id,
            patient_id: apt.patient_id,
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
            notes: apt.notes,
          };
        });
        
        if (appointmentsToDuplicate.length > 0) {
          const { error } = await supabase.from("appointments").insert(appointmentsToDuplicate);
          if (error) throw error;
        }
        
        toast({ title: "Jour dupliqué", description: `${appointmentsToDuplicate.length} rendez-vous copiés` });
      }
      
      setIsDuplicateDialogOpen(false);
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
  const displayDays = viewMode === "week" ? weekDays : [currentDate];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <Calendar className="w-6 h-6 text-purple-500" />
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

        {/* Calendar Grid */}
        <Card className="print:shadow-none print:border-none">
          <CardContent className="p-0" ref={printRef}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr>
                    <th className="border p-2 bg-muted/50 w-20 text-xs font-medium">Heure</th>
                    {displayDays.map((day, idx) => (
                      <th 
                        key={idx} 
                        className={`border p-2 bg-muted/50 text-xs font-medium ${
                          isSameDay(day, new Date()) ? "bg-primary/10 text-primary" : ""
                        }`}
                      >
                        <div>{format(day, "EEE", { locale: fr })}</div>
                        <div className="text-lg font-bold">{format(day, "d")}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map((slot, slotIdx) => (
                    <tr key={slotIdx} className={slot.minutes === 0 ? "border-t-2" : ""}>
                      <td className="border p-1 text-xs text-muted-foreground text-center bg-muted/30">
                        {slot.minutes === 0 ? slot.label : ""}
                      </td>
                      {displayDays.map((day, dayIdx) => {
                        const slotAppointments = getAppointmentsForSlot(day, slot);
                        return (
                          <td 
                            key={dayIdx} 
                            className={`border p-0.5 h-8 cursor-pointer hover:bg-primary/5 transition-colors relative ${
                              isSameDay(day, new Date()) ? "bg-primary/5" : ""
                            }`}
                            onClick={() => slotAppointments.length === 0 && handleSlotClick(day, slot)}
                          >
                            {slotAppointments.map((apt) => (
                              <div 
                                key={apt.id}
                                className="absolute inset-0.5 bg-primary/20 border border-primary/30 rounded text-xs p-1 overflow-hidden"
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
                                      className="h-5 w-5 p-0 bg-destructive/20 hover:bg-destructive/40 text-destructive"
                                      onClick={() => handleDeleteAppointment(apt.id)}
                                      title="Supprimer le rendez-vous"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
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
            <DialogTitle>Nouveau rendez-vous</DialogTitle>
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
                  <SelectContent>
                    {patients.map(p => (
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
                Créer le rendez-vous
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
        <DialogContent>
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
                  <SelectItem value="week">Dupliquer la semaine entière</SelectItem>
                  <SelectItem value="day">Dupliquer un jour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {duplicateMode === "week" ? (
              <div>
                <Label>Vers quelle semaine ?</Label>
                <Select value={targetWeekOffset.toString()} onValueChange={(v) => setTargetWeekOffset(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Semaine prochaine (+1)</SelectItem>
                    <SelectItem value="2">Dans 2 semaines (+2)</SelectItem>
                    <SelectItem value="3">Dans 3 semaines (+3)</SelectItem>
                    <SelectItem value="4">Dans 4 semaines (+4)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {appointments.length} rendez-vous seront dupliqués
                </p>
              </div>
            ) : (
              <>
                <div>
                  <Label>Jour source</Label>
                  <Select value={sourceDayIndex.toString()} onValueChange={(v) => setSourceDayIndex(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((name, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vers quel jour ?</Label>
                  <Select value={targetDayIndex.toString()} onValueChange={(v) => setTargetDayIndex(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((name, idx) => (
                        <SelectItem key={idx} value={idx.toString()} disabled={idx === sourceDayIndex}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  {appointments.filter(apt => {
                    const aptStart = parseISO(apt.start_time);
                    const sourceDay = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), sourceDayIndex);
                    return isSameDay(aptStart, sourceDay);
                  }).length} rendez-vous seront dupliqués
                </p>
              </>
            )}

            <Button 
              onClick={handleDuplicate} 
              disabled={isDuplicating}
              className="w-full gradient-primary text-primary-foreground"
            >
              {isDuplicating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Dupliquer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 3mm;
          }
          
          * {
            box-sizing: border-box !important;
          }
          
          html, body {
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 8px !important;
          }
          
          nav, footer, header, .print\\:hidden, [class*="MobileBottomNav"], .mt-4, button {
            display: none !important;
          }
          
          #root {
            height: auto !important;
            overflow: visible !important;
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
            padding: 2mm 0 0 0 !important;
          }
          
          .mb-8 {
            margin-bottom: 2mm !important;
          }
          
          .flex.items-center.gap-3 {
            gap: 2mm !important;
          }
          
          .p-3 {
            padding: 1mm !important;
          }
          
          .rounded-xl {
            border-radius: 2px !important;
          }
          
          .w-6, .h-6 {
            width: 10px !important;
            height: 10px !important;
          }
          
          h1, .text-3xl {
            font-size: 12px !important;
            line-height: 1.2 !important;
            margin: 0 !important;
          }
          
          .text-muted-foreground {
            font-size: 8px !important;
          }
          
          .overflow-x-auto {
            overflow: visible !important;
          }
          
          table {
            font-size: 6px !important;
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            page-break-inside: avoid !important;
          }
          
          thead th {
            font-size: 7px !important;
            padding: 1mm !important;
            height: auto !important;
          }
          
          thead th .text-lg {
            font-size: 9px !important;
          }
          
          tbody tr {
            height: 3.2mm !important;
            max-height: 3.2mm !important;
          }
          
          th, td {
            padding: 0.3mm !important;
            height: 3.2mm !important;
            max-height: 3.2mm !important;
            overflow: hidden !important;
            line-height: 1 !important;
            border: 0.5px solid #ddd !important;
          }
          
          th:first-child, td:first-child {
            width: 25px !important;
            font-size: 5px !important;
          }
          
          .h-8 {
            height: 3.2mm !important;
          }
          
          .absolute.inset-0\\.5 {
            position: absolute !important;
            inset: 0.2mm !important;
            padding: 0.2mm !important;
            font-size: 5px !important;
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
        }
      `}</style>
    </Layout>
  );
}
