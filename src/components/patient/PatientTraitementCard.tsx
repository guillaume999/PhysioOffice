import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ClipboardList, Plus, FileDown, Calendar, FileText, ChevronDown, ChevronUp, X, Edit, Share2, Play, ClipboardCheck, AlertTriangle, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { TraitementFormDialog } from "@/components/traitement/TraitementFormDialog";
import { GenerateAccessCodeDialog } from "@/components/patient/GenerateAccessCodeDialog";
import { SeanceFormDialog } from "@/components/seance/SeanceFormDialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SeanceExercice {
  id: string;
  name: string | null;
  description: string | null;
  repetitions: number | null;
  duration_seconds: number | null;
  series: number;
  ordre: number;
  exercice_id: string | null;
  exercice?: {
    id: string;
    title: string;
    video_url: string | null;
    thumbnail_url: string | null;
  } | null;
}

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
    objectifs_secondaires?: string[];
    is_hidden_from_list?: boolean;
  } | null;
  exercices?: SeanceExercice[];
}

interface PatientBilan {
  id: string;
  position_after_seance: number;
  content: string | null;
  bilan_date: string | null;
}

interface SeanceDate {
  id: string;
  seance_ordre: number;
  seance_date: string | null;
}

interface TraitementDetails {
  id: string;
  pathologie: string;
  description: string | null;
  author_name: string | null;
  is_hidden_from_list: boolean;
  tests: TraitementTest[];
  seances: TraitementSeance[];
  bilans: PatientBilan[];
  seanceDates: SeanceDate[];
  traitement_start_date: string | null;
}

interface PatientTraitementCardProps {
  activeTraitementId: string | null;
  activeTraitementName: string | null;
  patientId: string;
  patientName: string;
  onSelectTraitement: () => void;
  onRemoveTraitement: () => void;
  onTraitementChanged?: (newTraitementId: string) => void;
}

export function PatientTraitementCard({
  activeTraitementId,
  activeTraitementName,
  patientId,
  patientName,
  onSelectTraitement,
  onRemoveTraitement,
  onTraitementChanged,
}: PatientTraitementCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [traitement, setTraitement] = useState<TraitementDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [testsExpanded, setTestsExpanded] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTraitement, setEditingTraitement] = useState<any>(null);
  const [accessCodeDialogOpen, setAccessCodeDialogOpen] = useState(false);
  const [selectedSeanceForAccess, setSelectedSeanceForAccess] = useState<{id: string; name: string} | null>(null);
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());
  const [seanceFormDialogOpen, setSeanceFormDialogOpen] = useState(false);
  const [editingSeance, setEditingSeance] = useState<any>(null);
  const [editingSeanceIndex, setEditingSeanceIndex] = useState<number | null>(null);
  const [editConfirmDialogOpen, setEditConfirmDialogOpen] = useState(false);
  const [canReplaceTraitement, setCanReplaceTraitement] = useState(true);
  const [removeConfirmDialogOpen, setRemoveConfirmDialogOpen] = useState(false);

  useEffect(() => {
    if (activeTraitementId) {
      fetchTraitementDetails();
    } else {
      setTraitement(null);
    }
  }, [activeTraitementId]);

  const fetchTraitementDetails = async () => {
    if (!activeTraitementId) return;
    setLoading(true);

    try {
      const { data: traitementData } = await supabase
        .from("traitement_types")
        .select("id, pathologie, description, author_name, is_hidden_from_list")
        .eq("id", activeTraitementId)
        .maybeSingle();

      if (traitementData) {
        const { data: testsData } = await supabase
          .from("traitement_tests")
          .select("*, exercices(id, title, description, thumbnail_url)")
          .eq("traitement_type_id", activeTraitementId)
          .order("ordre", { ascending: true });

        const { data: seancesData } = await supabase
          .from("traitement_seances")
          .select("*, seance_types(id, pathologie, objectif_principal, pathologies, objectifs_principaux, objectifs_secondaires, is_hidden_from_list)")
          .eq("traitement_type_id", activeTraitementId)
          .order("ordre", { ascending: true });

        // Fetch bilans for this patient and traitement
        const { data: bilansData } = await supabase
          .from("patient_bilans")
          .select("id, position_after_seance, content, bilan_date")
          .eq("patient_id", patientId)
          .eq("traitement_id", activeTraitementId)
          .order("position_after_seance", { ascending: true });

        // Fetch seance dates for this patient and traitement
        const { data: seanceDatesData } = await supabase
          .from("patient_traitement_seance_dates")
          .select("id, seance_ordre, seance_date")
          .eq("patient_id", patientId)
          .eq("traitement_id", activeTraitementId)
          .order("seance_ordre", { ascending: true });

        // Fetch traitement_start_date from patient_care_plans
        const { data: carePlanData } = await supabase
          .from("patient_care_plans")
          .select("traitement_start_date")
          .eq("patient_id", patientId)
          .maybeSingle();

        // Fetch exercices for each seance
        const seancesWithExercices = await Promise.all(
          (seancesData || []).map(async (seance) => {
            const { data: exercicesData } = await supabase
              .from("seance_exercices")
              .select("*, exercices:exercice_id(id, title, video_url, thumbnail_url)")
              .eq("seance_type_id", seance.seance_type_id)
              .order("ordre", { ascending: true });
            
            return {
              ...seance,
              exercices: (exercicesData || []).map(ex => ({
                ...ex,
                exercice: ex.exercices
              }))
            };
          })
        );

        setTraitement({
          ...traitementData,
          is_hidden_from_list: traitementData.is_hidden_from_list || false,
          tests: testsData || [],
          seances: seancesWithExercices,
          bilans: bilansData || [],
          seanceDates: seanceDatesData || [],
          traitement_start_date: carePlanData?.traitement_start_date || null,
        });
      }
    } catch (error) {
      console.error("Error fetching traitement details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSeanceDisplay = (seance: TraitementSeance) => {
    if (!seance.seance_types) return "Séance";
    const pathologies = seance.seance_types.pathologies?.length 
      ? seance.seance_types.pathologies 
      : [seance.seance_types.pathologie];
    const objectifs = seance.seance_types.objectifs_principaux?.length 
      ? seance.seance_types.objectifs_principaux 
      : [seance.seance_types.objectif_principal];
    return `${pathologies[0]} - ${objectifs[0]}`;
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

  const handleEditSeance = (seance: TraitementSeance, index: number) => {
    if (!seance.seance_types) return;
    
    setEditingSeance({
      // Don't pass id to create a new copy
      pathologies: seance.seance_types.pathologies?.length ? seance.seance_types.pathologies : [seance.seance_types.pathologie],
      objectifs_principaux: seance.seance_types.objectifs_principaux?.length ? seance.seance_types.objectifs_principaux : [seance.seance_types.objectif_principal],
      objectifs_secondaires: seance.seance_types.objectifs_secondaires || [],
      exercices: (seance.exercices || []).map(ex => ({
        id: ex.id,
        exercice_id: ex.exercice_id,
        name: ex.name || "",
        description: ex.description || "",
        repetitions: ex.repetitions,
        duration_seconds: ex.duration_seconds,
        series: ex.series || 1,
        ordre: ex.ordre,
        video_url: ex.exercice?.video_url || null
      })),
      author_name: null
    });
    setEditingSeanceIndex(index);
    setSeanceFormDialogOpen(true);
  };

  const handleEditSeanceOriginal = (seance: TraitementSeance) => {
    if (!seance.seance_types) return;
    
    setEditingSeance({
      id: seance.seance_type_id, // Pass id to edit original
      pathologies: seance.seance_types.pathologies?.length ? seance.seance_types.pathologies : [seance.seance_types.pathologie],
      objectifs_principaux: seance.seance_types.objectifs_principaux?.length ? seance.seance_types.objectifs_principaux : [seance.seance_types.objectif_principal],
      objectifs_secondaires: seance.seance_types.objectifs_secondaires || [],
      exercices: (seance.exercices || []).map(ex => ({
        id: ex.id,
        exercice_id: ex.exercice_id,
        name: ex.name || "",
        description: ex.description || "",
        repetitions: ex.repetitions,
        duration_seconds: ex.duration_seconds,
        series: ex.series || 1,
        ordre: ex.ordre,
        video_url: ex.exercice?.video_url || null
      })),
      author_name: null
    });
    setEditingSeanceIndex(null);
    setSeanceFormDialogOpen(true);
  };

  const handleSeanceFormSuccess = async () => {
    if (!user || !traitement) return;
    
    // If we created a new copy, we need to update the traitement_seances
    if (editingSeanceIndex !== null) {
      // Fetch the latest seance created by this user
      const { data: latestSeance } = await supabase
        .from("seance_types")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestSeance && traitement.seances[editingSeanceIndex]) {
        // Update the traitement_seances to point to the new seance
        await supabase
          .from("traitement_seances")
          .update({ seance_type_id: latestSeance.id })
          .eq("id", traitement.seances[editingSeanceIndex].id);
        
        // Mark the new seance as hidden from list
        await supabase
          .from("seance_types")
          .update({ is_hidden_from_list: true })
          .eq("id", latestSeance.id);
      }
    }
    
    setEditingSeanceIndex(null);
    fetchTraitementDetails();
  };

  const toggleSeanceVisibility = async (seanceTypeId: string, currentlyHidden: boolean) => {
    const { error } = await supabase
      .from("seance_types")
      .update({ is_hidden_from_list: !currentlyHidden })
      .eq("id", seanceTypeId);
    
    if (error) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }
    
    toast.success(!currentlyHidden ? "Séance masquée de la liste" : "Séance visible dans la liste");
    fetchTraitementDetails();
  };

  const handleEdit = () => {
    if (!traitement) return;
    
    // Always open the form dialog directly (create new version)
    setEditingTraitement({
      // Never pass id - always create a new treatment
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
    setEditDialogOpen(true);
  };

  const handleEditSuccess = async () => {
    if (!user || !traitement) return;
    
    // If the original treatment was visible, ask user what to do
    if (!traitement.is_hidden_from_list) {
      // Check if multiple patients use this treatment
      const { count } = await supabase
        .from("patient_care_plans")
        .select("id", { count: "exact", head: true })
        .eq("active_traitement_id", traitement.id);
      
      setCanReplaceTraitement((count || 0) <= 1);
      setEditConfirmDialogOpen(true);
      return;
    }
    
    // If original was already hidden, just activate the new one
    await finalizeEdit('new');
  };

  const finalizeEdit = async (mode: 'replace' | 'new') => {
    if (!user) return;
    
    const oldTraitementId = activeTraitementId;
    
    // Fetch the latest traitement created by this user
    const { data: latestTraitement } = await supabase
      .from("traitement_types")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!latestTraitement) return;
    
    if (mode === 'replace') {
      // Transfer bilans and dates from old to new treatment before deleting
      if (oldTraitementId && oldTraitementId !== latestTraitement.id) {
        // Transfer bilans to new treatment
        await supabase
          .from("patient_bilans")
          .update({ traitement_id: latestTraitement.id })
          .eq("patient_id", patientId)
          .eq("traitement_id", oldTraitementId);
        
        // Transfer seance dates to new treatment
        await supabase
          .from("patient_traitement_seance_dates")
          .update({ traitement_id: latestTraitement.id })
          .eq("patient_id", patientId)
          .eq("traitement_id", oldTraitementId);
        
        // Now delete the old treatment structure (tests, seances)
        await supabase.from("traitement_tests").delete().eq("traitement_type_id", oldTraitementId);
        await supabase.from("traitement_seances").delete().eq("traitement_type_id", oldTraitementId);
        // Delete the treatment itself
        await supabase.from("traitement_types").delete().eq("id", oldTraitementId);
      }
      
      // Make the new treatment visible
      await supabase
        .from("traitement_types")
        .update({ is_hidden_from_list: false })
        .eq("id", latestTraitement.id);
      
      toast.success("Traitement remplacé avec succès");
    } else {
      // Keep new as hidden, transfer bilans and dates
      if (oldTraitementId && oldTraitementId !== latestTraitement.id) {
        // Transfer bilans to new treatment
        await supabase
          .from("patient_bilans")
          .update({ traitement_id: latestTraitement.id })
          .eq("patient_id", patientId)
          .eq("traitement_id", oldTraitementId);
        
        // Transfer seance dates to new treatment
        await supabase
          .from("patient_traitement_seance_dates")
          .update({ traitement_id: latestTraitement.id })
          .eq("patient_id", patientId)
          .eq("traitement_id", oldTraitementId);
      }
      
      toast.success("Nouvelle version du traitement créée");
    }
    
    // Activate the new treatment
    if (onTraitementChanged) {
      onTraitementChanged(latestTraitement.id);
    }
    
    setEditConfirmDialogOpen(false);
    fetchTraitementDetails();
  };

  const toggleVisibility = async () => {
    if (!traitement) return;
    
    const newValue = !traitement.is_hidden_from_list;
    
    const { error } = await supabase
      .from("traitement_types")
      .update({ is_hidden_from_list: newValue })
      .eq("id", traitement.id);
    
    if (error) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }
    
    setTraitement({ ...traitement, is_hidden_from_list: newValue });
    toast.success(newValue ? "Traitement masqué de la liste" : "Traitement visible dans la liste");
  };

  const handleTraitementDateChange = async (date: string) => {
    if (!traitement) return;
    
    const { error } = await supabase
      .from("patient_care_plans")
      .update({ traitement_start_date: date || null })
      .eq("patient_id", patientId);
    
    if (error) {
      toast.error("Erreur lors de la mise à jour de la date");
      return;
    }
    
    setTraitement({ ...traitement, traitement_start_date: date || null });
  };

  const handleSeanceDateChange = async (seanceOrdre: number, date: string) => {
    if (!traitement || !user) return;
    
    const existingDate = traitement.seanceDates.find(sd => sd.seance_ordre === seanceOrdre);
    
    if (existingDate) {
      const { error } = await supabase
        .from("patient_traitement_seance_dates")
        .update({ seance_date: date || null })
        .eq("id", existingDate.id);
      
      if (error) {
        toast.error("Erreur lors de la mise à jour de la date");
        return;
      }
      
      setTraitement({
        ...traitement,
        seanceDates: traitement.seanceDates.map(sd =>
          sd.seance_ordre === seanceOrdre ? { ...sd, seance_date: date || null } : sd
        )
      });
    } else {
      const { data: newDate, error } = await supabase
        .from("patient_traitement_seance_dates")
        .insert({
          patient_id: patientId,
          traitement_id: traitement.id,
          seance_ordre: seanceOrdre,
          seance_date: date || null,
          user_id: user.id
        })
        .select()
        .single();
      
      if (error) {
        toast.error("Erreur lors de l'enregistrement de la date");
        return;
      }
      
      setTraitement({
        ...traitement,
        seanceDates: [...traitement.seanceDates, { id: newDate.id, seance_ordre: seanceOrdre, seance_date: date }]
      });
    }
  };

  const handleBilanDateChange = async (bilanId: string, date: string) => {
    if (!traitement) return;
    
    const { error } = await supabase
      .from("patient_bilans")
      .update({ bilan_date: date || null })
      .eq("id", bilanId);
    
    if (error) {
      toast.error("Erreur lors de la mise à jour de la date");
      return;
    }
    
    setTraitement({
      ...traitement,
      bilans: traitement.bilans.map(b =>
        b.id === bilanId ? { ...b, bilan_date: date || null } : b
      )
    });
  };

  const handlePrintBilan = (bilan: PatientBilan, seancePosition: number) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dateStr = bilan.bilan_date 
      ? new Date(bilan.bilan_date).toLocaleDateString("fr-FR", { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }) 
      : "Non définie";

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bilan Intermédiaire</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 40px 50px;
              max-width: 850px;
              margin: 0 auto;
              color: #1a1a1a;
              line-height: 1.5;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 25px;
              border-bottom: 3px solid #2563eb;
            }
            .header h1 {
              font-size: 28px;
              font-weight: 700;
              color: #1e3a5f;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .header .subtitle {
              font-size: 16px;
              color: #64748b;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 35px;
              background: #f8fafc;
              padding: 25px;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
            }
            .info-item {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .info-item .label {
              font-size: 12px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            .info-item .value {
              font-size: 15px;
              color: #1e293b;
              font-weight: 500;
            }
            .section-title {
              font-size: 14px;
              text-transform: uppercase;
              color: #2563eb;
              font-weight: 700;
              letter-spacing: 0.5px;
              margin-bottom: 15px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e2e8f0;
            }
            .content-box {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 25px 30px;
              margin-bottom: 40px;
              min-height: 200px;
            }
            .content-text {
              white-space: pre-wrap;
              line-height: 1.8;
              font-size: 14px;
              color: #334155;
            }
            .content-empty {
              color: #94a3b8;
              font-style: italic;
              text-align: center;
              padding: 40px 0;
            }
            .footer {
              margin-top: 50px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
            }
            .footer-section {
              padding: 20px;
              border: 1px dashed #cbd5e1;
              border-radius: 8px;
              min-height: 100px;
            }
            .footer-section .label {
              font-size: 12px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 600;
              letter-spacing: 0.5px;
              margin-bottom: 10px;
            }
            .print-info {
              margin-top: 40px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
            }
            @media print {
              body { 
                padding: 30px; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .info-grid {
                background: #f8fafc !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Bilan Intermédiaire</h1>
            <div class="subtitle">Évaluation après séance ${seancePosition}</div>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Patient</span>
              <span class="value">${patientName}</span>
            </div>
            <div class="info-item">
              <span class="label">Date du bilan</span>
              <span class="value">${dateStr}</span>
            </div>
            <div class="info-item">
              <span class="label">Traitement</span>
              <span class="value">${traitement?.pathologie || "Non défini"}</span>
            </div>
            <div class="info-item">
              <span class="label">Position</span>
              <span class="value">Après la séance n°${seancePosition}</span>
            </div>
          </div>

          <div class="section-title">Observations et évolution</div>
          <div class="content-box">
            ${bilan.content 
              ? `<div class="content-text">${bilan.content}</div>` 
              : `<div class="content-empty">Aucune observation enregistrée</div>`
            }
          </div>

          <div class="footer">
            <div class="footer-section">
              <div class="label">Date et signature du praticien</div>
            </div>
            <div class="footer-section">
              <div class="label">Cachet</div>
            </div>
          </div>

          <div class="print-info">
            Document généré le ${new Date().toLocaleDateString("fr-FR", { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const getSeanceDate = (seanceOrdre: number): string => {
    const date = traitement?.seanceDates.find(sd => sd.seance_ordre === seanceOrdre);
    return date?.seance_date || "";
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Plan de traitement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Traitement actif</Label>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onSelectTraitement}
              disabled={!!activeTraitementId}
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm">Chargement...</p>
          ) : traitement ? (
            <Card className="overflow-hidden border-primary/20">
              <CardContent className="p-4">
                {/* Header - Mobile optimized */}
                <div className="flex flex-col gap-3">
                  {/* Ligne 1: Badge + Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-sm">
                      {traitement.pathologie}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(!expanded)}
                        className="gap-1 h-8 px-2"
                      >
                        {expanded ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            <span className="hidden sm:inline">Réduire</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span className="hidden sm:inline">Détails</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRemoveConfirmDialogOpen(true)}
                        className="text-destructive h-8 w-8"
                        title="Retirer le traitement"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Ligne 2: Date + infos */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Input
                      type="date"
                      value={traitement.traitement_start_date || ""}
                      onChange={(e) => handleTraitementDateChange(e.target.value)}
                      className="w-32 h-7 text-xs"
                      title="Date de début du traitement"
                    />
                    <span className="truncate">par {traitement.author_name || "Anonyme"}</span>
                    <span>• {traitement.tests?.length || 0} tests • {traitement.seances?.length || 0} séances</span>
                  </div>
                </div>

                {/* Expandable content */}
                {expanded && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    {/* Description */}
                    {traitement.description && (
                      <p className="text-sm text-muted-foreground">{traitement.description}</p>
                    )}

                    {/* Tests - Collapsible */}
                    <Collapsible open={testsExpanded} onOpenChange={setTestsExpanded}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border cursor-pointer hover:bg-muted/70 transition-colors">
                          <div className="flex items-center gap-2">
                            <ClipboardCheck className="w-4 h-4 text-primary" />
                            <span className="text-sm font-semibold">Tests ({traitement.tests?.length || 0})</span>
                          </div>
                          {testsExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        {traitement.tests && traitement.tests.length > 0 ? (
                          <div className="space-y-3">
                            {traitement.tests.map((test, i) => {
                              const thumbnailUrl = test.exercices?.thumbnail_url || null;
                              const testName = test.exercices?.title || `Test ${i + 1}`;
                              const testDescription = test.description || test.exercices?.description || null;
                              
                              return (
                                <div 
                                  key={test.id} 
                                  className="flex items-start gap-4 p-3 bg-muted/50 rounded-xl border border-border"
                                >
                                  {/* Order number */}
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm font-bold text-primary">{i + 1}</span>
                                  </div>

                                  {/* Thumbnail */}
                                  <div className="w-20 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                    {thumbnailUrl ? (
                                      <img 
                                        src={thumbnailUrl} 
                                        alt={testName}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                        <FileText className="w-6 h-6" />
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Test info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-base truncate">{testName}</p>
                                    {testDescription && (
                                      <p className="text-sm text-muted-foreground line-clamp-2">{testDescription}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground p-3">Aucun test</p>
                        )}
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Séances with Bilans */}
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Séances ({traitement.seances?.length || 0})</p>
                      {traitement.seances && traitement.seances.length > 0 ? (
                        <div className="space-y-3">
                          {traitement.seances.map((seance, i) => {
                            const isExpanded = expandedSeances.has(seance.id);
                            const exercices = seance.exercices || [];
                            const bilanAfterSeance = traitement.bilans?.find(b => b.position_after_seance === i + 1);
                            
                            return (
                              <div key={seance.id}>
                                {/* Seance card */}
                                <div className="bg-muted/50 rounded-lg border border-border overflow-hidden">
                                  {/* Seance header */}
                                  <div className="flex items-center justify-between gap-3 p-3">
                                    <div 
                                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                                      onClick={() => toggleSeanceExpand(seance.id)}
                                    >
                                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-xs font-bold text-primary">{i + 1}</span>
                                      </div>
                                      <Input
                                        type="date"
                                        value={getSeanceDate(i + 1)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          handleSeanceDateChange(i + 1, e.target.value);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-32 h-7 text-xs"
                                        title="Date de la séance"
                                      />
                                      <span className="text-sm truncate">{getSeanceDisplay(seance)}</span>
                                      <Badge variant="secondary" className="text-xs">
                                        {exercices.length} exercice{exercices.length > 1 ? 's' : ''}
                                      </Badge>
                                      {isExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title="Modifier (crée une copie)"
                                        onClick={() => handleEditSeance(seance, i)}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title="Partager cette séance"
                                        onClick={() => {
                                          setSelectedSeanceForAccess({
                                            id: seance.seance_type_id,
                                            name: getSeanceDisplay(seance)
                                          });
                                          setAccessCodeDialogOpen(true);
                                        }}
                                      >
                                        <Share2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  
                                  {/* Expanded content */}
                                  {isExpanded && (
                                    <div className="px-3 pb-3 space-y-3">
                                      {/* Exercices list */}
                                      {exercices.length > 0 ? (
                                        <div className="space-y-3">
                                          {exercices.map((ex, j) => {
                                            const thumbnailUrl = ex.exercice?.thumbnail_url || null;
                                            const videoUrl = ex.exercice?.video_url || null;
                                            const exerciceName = ex.exercice?.title || ex.name || `Exercice ${j + 1}`;
                                            
                                            return (
                                              <div 
                                                key={ex.id}
                                                className="flex items-start gap-4 p-3 bg-card rounded-xl border border-border shadow-sm"
                                              >
                                                {/* Order number */}
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                  <span className="text-sm font-bold text-primary">{j + 1}</span>
                                                </div>

                                                {/* Thumbnail */}
                                                <div className="w-20 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
                                                  {thumbnailUrl ? (
                                                    <img 
                                                      src={thumbnailUrl} 
                                                      alt={exerciceName}
                                                      className="w-full h-full object-cover"
                                                    />
                                                  ) : videoUrl ? (
                                                    <video 
                                                      src={videoUrl}
                                                      className="w-full h-full object-cover"
                                                      muted
                                                    />
                                                  ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                      <Play className="w-6 h-6" />
                                                    </div>
                                                  )}
                                                  {videoUrl && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                      <Play className="w-5 h-5 text-white fill-white" />
                                                    </div>
                                                  )}
                                                </div>
                                                
                                                {/* Exercise info */}
                                                <div className="flex-1 min-w-0">
                                                  <p className="font-semibold text-base truncate mb-2">{exerciceName}</p>
                                                  
                                                  {/* Stats */}
                                                  <div className="flex items-center gap-3 flex-wrap">
                                                    <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-lg">
                                                      <span className="text-base font-bold text-primary">{ex.series || 1}</span>
                                                      <span className="text-xs text-muted-foreground">série{(ex.series || 1) > 1 ? "s" : ""}</span>
                                                    </div>
                                                    
                                                    {ex.repetitions && (
                                                      <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-lg">
                                                        <span className="text-base font-bold">{ex.repetitions}</span>
                                                        <span className="text-xs text-muted-foreground">reps</span>
                                                      </div>
                                                    )}
                                                    
                                                    {ex.duration_seconds && (
                                                      <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-lg">
                                                        <span className="text-base font-bold">{ex.duration_seconds}</span>
                                                        <span className="text-xs text-muted-foreground">sec</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">Aucun exercice</p>
                                      )}
                                      
                                      {/* Seance actions */}
                                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                                        <div className="flex items-center gap-2">
                                          <Switch
                                            id={`seance-visibility-${seance.id}`}
                                            checked={!seance.seance_types?.is_hidden_from_list}
                                            onCheckedChange={() => toggleSeanceVisibility(
                                              seance.seance_type_id, 
                                              seance.seance_types?.is_hidden_from_list || false
                                            )}
                                          />
                                          <Label 
                                            htmlFor={`seance-visibility-${seance.id}`} 
                                            className="text-xs cursor-pointer"
                                          >
                                            Visible dans Séances
                                          </Label>
                                        </div>
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="text-xs gap-1"
                                          onClick={() => handleEditSeanceOriginal(seance)}
                                        >
                                          <Edit className="w-3 h-3" />
                                          Modifier l'originale
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Bilan between sessions */}
                                <div className="ml-3 mt-2 mb-2 pl-3 border-l-2 border-dashed border-primary/30">
                                  {bilanAfterSeance ? (
                                    <div className="bg-primary/5 rounded-md p-3 space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                          <ClipboardCheck className="w-4 h-4" />
                                          <Input
                                            type="date"
                                            value={bilanAfterSeance.bilan_date || ""}
                                            onChange={(e) => handleBilanDateChange(bilanAfterSeance.id, e.target.value)}
                                            className="w-32 h-7 text-xs"
                                            title="Date du bilan"
                                          />
                                          <span>Bilan après séance {i + 1}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => handlePrintBilan(bilanAfterSeance, i + 1)}
                                            title="Imprimer le bilan"
                                          >
                                            <Printer className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => navigate(`/patients/${patientId}/bilan-intermediaire?traitement=${traitement.id}&position=${i + 1}&bilan=${bilanAfterSeance.id}`)}
                                          >
                                            <Edit className="w-3 h-3 mr-1" />
                                            Modifier
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs text-muted-foreground hover:text-primary h-8"
                                      onClick={() => navigate(`/patients/${patientId}/bilan-intermediaire?traitement=${traitement.id}&position=${i + 1}`)}
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Ajouter un bilan après cette séance
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Aucune séance</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch
                            id="visibility"
                            checked={!traitement.is_hidden_from_list}
                            onCheckedChange={toggleVisibility}
                          />
                          <Label htmlFor="visibility" className="text-sm cursor-pointer">
                            Visible dans la page Traitements
                          </Label>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleEdit} className="gap-2">
                          <Edit className="w-4 h-4" />
                          Modifier et sauvegarder
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aucun plan de traitement actif. Importez-en un ou créez-en un nouveau.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={editConfirmDialogOpen} onOpenChange={setEditConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Modifications enregistrées
            </AlertDialogTitle>
            <AlertDialogDescription>
              {canReplaceTraitement 
                ? "L'ancien traitement est visible dans votre liste de traitements. Comment souhaitez-vous procéder ?"
                : "Ce traitement est utilisé par plusieurs patients. Une nouvelle version sera créée pour éviter d'affecter les autres patients."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => finalizeEdit('new')}>
              {canReplaceTraitement ? "Garder les deux versions" : "Créer nouvelle version"}
            </AlertDialogCancel>
            {canReplaceTraitement && (
              <Button 
                variant="default" 
                onClick={() => finalizeEdit('replace')}
              >
                Remplacer l'ancien
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TraitementFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        traitement={editingTraitement}
        onSuccess={handleEditSuccess}
        isHiddenFromList={true}
      />

      {selectedSeanceForAccess && (
        <GenerateAccessCodeDialog
          open={accessCodeDialogOpen}
          onOpenChange={(open) => {
            setAccessCodeDialogOpen(open);
            if (!open) setSelectedSeanceForAccess(null);
          }}
          seanceTypeId={selectedSeanceForAccess.id}
          seanceName={selectedSeanceForAccess.name}
          patientId={patientId}
          patientName={patientName}
        />
      )}

      <SeanceFormDialog
        open={seanceFormDialogOpen}
        onOpenChange={setSeanceFormDialogOpen}
        seance={editingSeance}
        onSuccess={handleSeanceFormSuccess}
      />

      <AlertDialog open={removeConfirmDialogOpen} onOpenChange={setRemoveConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le traitement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir retirer ce traitement du patient ? Cette action ne supprimera pas le traitement de votre bibliothèque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRemoveTraitement();
                setRemoveConfirmDialogOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
