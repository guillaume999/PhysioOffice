import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ClipboardList, Plus, FileDown, Calendar, FileText, ChevronDown, ChevronUp, X, Edit, Share2, Play, ClipboardCheck, AlertTriangle, Printer, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

import { GenerateAccessCodeDialog } from "@/components/patient/GenerateAccessCodeDialog";
import { SeanceFormDialog } from "@/components/seance/SeanceFormDialog";
import { format } from "date-fns";
import { ExerciceItemCard } from "@/components/patient/ExerciceItemCard";
import { AddExerciceToSeanceDialog } from "@/components/patient/AddExerciceToSeanceDialog";
import { CommentDialog } from "@/components/patient/CommentDialog";
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
  series: number | null;
  force_1: number | null;
  duration_seconds_2: number | null;
  force_2: number | null;
  comment: string | null;
  ordre: number;
  exercice_id: string | null;
  exercice?: {
    id: string;
    title: string;
    video_url: string | null;
    thumbnail_url: string | null;
    status?: string;
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
    comment?: string | null;
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
  const [testsExpanded, setTestsExpanded] = useState(false);
  const [accessCodeDialogOpen, setAccessCodeDialogOpen] = useState(false);
  const [selectedSeanceForAccess, setSelectedSeanceForAccess] = useState<{id: string; name: string} | null>(null);
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());
  const [seanceFormDialogOpen, setSeanceFormDialogOpen] = useState(false);
  const [editingSeance, setEditingSeance] = useState<any>(null);
  const [editingSeanceIndex, setEditingSeanceIndex] = useState<number | null>(null);
  const [removeConfirmDialogOpen, setRemoveConfirmDialogOpen] = useState(false);
  const [addExerciceDialogOpen, setAddExerciceDialogOpen] = useState(false);
  const [selectedSeanceForAddExercice, setSelectedSeanceForAddExercice] = useState<{id: string; count: number} | null>(null);
  const [editingSeanceComment, setEditingSeanceComment] = useState<string | null>(null);
  const [seanceCommentDialogOpen, setSeanceCommentDialogOpen] = useState(false);
  const [selectedSeanceForComment, setSelectedSeanceForComment] = useState<{id: string; name: string; comment: string} | null>(null);
  const [savingSeanceComment, setSavingSeanceComment] = useState(false);

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
          .select("*, seance_types(id, pathologie, objectif_principal, pathologies, objectifs_principaux, objectifs_secondaires, is_hidden_from_list, comment)")
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
              .select("*, exercices:exercice_id(id, title, video_url, thumbnail_url, status)")
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

  const handleSeanceFormSuccess = async (seanceDate?: string) => {
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
    } else {
      // Adding a new seance to the treatment
      const { data: latestSeance } = await supabase
        .from("seance_types")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestSeance) {
        // Calculate the next ordre
        const nextOrdre = (traitement.seances?.length || 0) + 1;
        
        // Add the seance to the treatment
        await supabase
          .from("traitement_seances")
          .insert({
            traitement_type_id: traitement.id,
            seance_type_id: latestSeance.id,
            ordre: nextOrdre
          });
        
        // Mark the seance as hidden from list
        await supabase
          .from("seance_types")
          .update({ is_hidden_from_list: true })
          .eq("id", latestSeance.id);
        
        // Create the date entry for this seance
        if (seanceDate) {
          await supabase
            .from("patient_traitement_seance_dates")
            .insert({
              patient_id: patientId,
              traitement_id: traitement.id,
              seance_ordre: nextOrdre,
              seance_date: seanceDate,
              user_id: user.id
            });
        }
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

  const handleSaveSeanceComment = async (comment: string) => {
    if (!selectedSeanceForComment) return;
    
    setSavingSeanceComment(true);
    try {
      const { error } = await supabase
        .from("seance_types")
        .update({ comment: comment || null })
        .eq("id", selectedSeanceForComment.id);

      if (error) throw error;

      // Update local state
      if (traitement) {
        setTraitement({
          ...traitement,
          seances: traitement.seances.map(s =>
            s.seance_type_id === selectedSeanceForComment.id
              ? { ...s, seance_types: { ...s.seance_types!, comment: comment || null } }
              : s
          )
        });
      }
      setSeanceCommentDialogOpen(false);
      setSelectedSeanceForComment(null);
      toast.success("Commentaire enregistré");
    } catch (error) {
      console.error("Error saving seance comment:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSavingSeanceComment(false);
    }
  };

  const handlePrintBilan = (bilan: PatientBilan, seancePosition: number) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Parse bilan content if it's JSON
    let bilanData = {
      douleur_localisation: "",
      douleur_intensite: "",
      douleur_type: "",
      amplitude_articulaire: "",
      force_musculaire: "",
      tests_specifiques: "",
      observations: ""
    };

    if (bilan.content) {
      try {
        const parsed = JSON.parse(bilan.content);
        if (typeof parsed === "object") {
          bilanData = {
            douleur_localisation: parsed.douleur_localisation || "",
            douleur_intensite: parsed.douleur_intensite || "",
            douleur_type: parsed.douleur_type || "",
            amplitude_articulaire: parsed.amplitude_articulaire || "",
            force_musculaire: parsed.force_musculaire || "",
            tests_specifiques: parsed.tests_specifiques || "",
            observations: parsed.observations || ""
          };
        }
      } catch {
        bilanData.observations = bilan.content;
      }
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bilan Intermédiaire - ${patientName}</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              padding: 32px;
              max-width: 900px;
              margin: 0 auto;
              color: #0f172a;
              line-height: 1.5;
              background: #f8fafc;
            }
            .header {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 32px;
            }
            .header-icon {
              width: 48px;
              height: 48px;
              background: rgba(245, 158, 11, 0.1);
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .header-icon svg {
              width: 24px;
              height: 24px;
              color: #f59e0b;
            }
            .header-text h1 {
              font-size: 24px;
              font-weight: 700;
              color: #0f172a;
            }
            .header-text p {
              font-size: 14px;
              color: #64748b;
            }
            .card {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              margin-bottom: 24px;
              overflow: hidden;
            }
            .card-header {
              padding: 16px 20px;
              border-bottom: 1px solid #e2e8f0;
            }
            .card-title {
              font-size: 16px;
              font-weight: 600;
              color: #0f172a;
            }
            .card-content {
              padding: 20px;
            }
            .field-group {
              margin-bottom: 16px;
            }
            .field-group:last-child {
              margin-bottom: 0;
            }
            .field-label {
              font-size: 14px;
              font-weight: 500;
              color: #0f172a;
              margin-bottom: 8px;
            }
            .field-value {
              font-size: 14px;
              color: #334155;
              padding: 12px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              min-height: 44px;
              white-space: pre-wrap;
            }
            .field-value.empty {
              color: #94a3b8;
              font-style: italic;
            }
            .field-value.textarea {
              min-height: 100px;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
            }
            @media print {
              body {
                padding: 20px;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .card {
                break-inside: avoid;
              }
              @page {
                margin: 1cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
            </div>
            <div class="header-text">
              <h1>Bilan intermédiaire</h1>
              <p>${patientName} • Après séance ${seancePosition}</p>
            </div>
          </div>

          <!-- Évaluation de la douleur -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Évaluation de la douleur</div>
            </div>
            <div class="card-content">
              <div class="field-group">
                <div class="field-label">Localisation</div>
                <div class="field-value ${!bilanData.douleur_localisation ? 'empty' : ''}">${bilanData.douleur_localisation || 'Non renseigné'}</div>
              </div>
              <div class="grid-2">
                <div class="field-group">
                  <div class="field-label">Intensité (EVA 0-10)</div>
                  <div class="field-value ${!bilanData.douleur_intensite ? 'empty' : ''}">${bilanData.douleur_intensite || 'Non renseigné'}</div>
                </div>
                <div class="field-group">
                  <div class="field-label">Type de douleur</div>
                  <div class="field-value ${!bilanData.douleur_type ? 'empty' : ''}">${bilanData.douleur_type || 'Non renseigné'}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bilan articulaire et musculaire -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Bilan articulaire et musculaire</div>
            </div>
            <div class="card-content">
              <div class="field-group">
                <div class="field-label">Amplitudes articulaires</div>
                <div class="field-value textarea ${!bilanData.amplitude_articulaire ? 'empty' : ''}">${bilanData.amplitude_articulaire || 'Non renseigné'}</div>
              </div>
              <div class="field-group">
                <div class="field-label">Force musculaire</div>
                <div class="field-value textarea ${!bilanData.force_musculaire ? 'empty' : ''}">${bilanData.force_musculaire || 'Non renseigné'}</div>
              </div>
            </div>
          </div>

          <!-- Tests spécifiques -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Tests spécifiques</div>
            </div>
            <div class="card-content">
              <div class="field-value textarea ${!bilanData.tests_specifiques ? 'empty' : ''}">${bilanData.tests_specifiques || 'Non renseigné'}</div>
            </div>
          </div>

          <!-- Observations -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Observations complémentaires</div>
            </div>
            <div class="card-content">
              <div class="field-value textarea ${!bilanData.observations ? 'empty' : ''}">${bilanData.observations || 'Non renseigné'}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const getSeanceDate = (seanceOrdre: number): string => {
    const date = traitement?.seanceDates.find(sd => sd.seance_ordre === seanceOrdre);
    return date?.seance_date || "";
  };

  return (
    <>
      {!activeTraitementId && (
        <div className="flex items-center justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSelectTraitement}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement...</p>
      ) : traitement ? (
        <Card className="overflow-hidden border-primary/20">
          <CardContent className="p-2 sm:p-3">
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
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-muted-foreground">
                    <Input
                      type="date"
                      value={traitement.traitement_start_date || ""}
                      onChange={(e) => handleTraitementDateChange(e.target.value)}
                      className="w-full sm:w-32 h-9 sm:h-7 text-sm sm:text-xs"
                      title="Date de début du traitement"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate">par {traitement.author_name || "Anonyme"}</span>
                      <span>• {traitement.tests?.length || 0} tests • {traitement.seances?.length || 0} séances</span>
                    </div>
                  </div>
                </div>

                {/* Content always visible */}
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
                                {/* Seance card with Collapsible */}
                                <Collapsible 
                                  open={isExpanded} 
                                  onOpenChange={() => toggleSeanceExpand(seance.id)}
                                >
                                  <div className="bg-emerald-100 dark:bg-emerald-900/40 rounded-lg border border-emerald-300 dark:border-emerald-700/50 overflow-hidden">
                                    {/* Seance header - always visible */}
                                    <div className="p-3">
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                        {/* Seance info - clickable to expand */}
                                        <div 
                                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={() => toggleSeanceExpand(seance.id)}
                                        >
                                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-bold text-primary">{i + 1}</span>
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="font-medium text-sm">{getSeanceDisplay(seance)}</p>
                                            <Badge variant="secondary" className="text-xs mt-1">
                                              {exercices.length} exercice{exercices.length > 1 ? 's' : ''}
                                            </Badge>
                                          </div>
                                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform sm:hidden ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                        
                                        {/* Date and actions row */}
                                        <div className="flex items-center justify-between gap-2 pl-11 sm:pl-0">
                                          <Input
                                            type="date"
                                            value={getSeanceDate(i + 1)}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              handleSeanceDateChange(i + 1, e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full sm:w-32 h-9 sm:h-7 text-sm sm:text-xs"
                                            title="Date de la séance"
                                          />
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-9 w-9 sm:h-8 sm:w-8"
                                              title="Modifier (crée une copie)"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditSeance(seance, i);
                                              }}
                                            >
                                              <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-9 w-9 sm:h-8 sm:w-8"
                                              title="Partager cette séance"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedSeanceForAccess({
                                                  id: seance.seance_type_id,
                                                  name: getSeanceDisplay(seance)
                                                });
                                                setAccessCodeDialogOpen(true);
                                              }}
                                            >
                                              <Share2 className="w-4 h-4" />
                                            </Button>
                                            <CollapsibleTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 sm:h-8 sm:w-8"
                                              >
                                                {isExpanded ? (
                                                  <ChevronUp className="w-4 h-4" />
                                                ) : (
                                                  <ChevronDown className="w-4 h-4" />
                                                )}
                                              </Button>
                                            </CollapsibleTrigger>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Collapsed content - Exercises list */}
                                    <CollapsibleContent>
                                      <div className="px-2 pb-2 space-y-2 border-t border-border/50 pt-2">
                                        {/* Exercices list - grid for better space usage */}
                                        {exercices.length > 0 ? (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {exercices.map((ex, j) => (
                                              <ExerciceItemCard
                                                key={ex.id}
                                                exercice={ex}
                                                index={j}
                                                seanceTypeId={seance.seance_type_id}
                                                onUpdate={fetchTraitementDetails}
                                              />
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground text-center py-4">Aucun exercice dans cette séance</p>
                                        )}

                                        {/* Add exercise button */}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full h-9 text-xs gap-1 border-dashed"
                                          onClick={() => {
                                            setSelectedSeanceForAddExercice({
                                              id: seance.seance_type_id,
                                              count: exercices.length
                                            });
                                            setAddExerciceDialogOpen(true);
                                          }}
                                        >
                                          <Plus className="w-4 h-4" />
                                          Ajouter un exercice
                                        </Button>

                                        {/* Seance comment - clickable to open modal */}
                                        <button
                                          type="button"
                                          className={`w-full text-left text-sm rounded px-3 py-2 transition-colors ${
                                            seance.seance_types?.comment 
                                              ? "text-muted-foreground bg-background/50 hover:bg-background cursor-pointer border border-transparent hover:border-border" 
                                              : "text-muted-foreground/60 hover:bg-muted/50 border border-dashed border-border cursor-pointer"
                                          }`}
                                          onClick={() => {
                                            setSelectedSeanceForComment({
                                              id: seance.seance_type_id,
                                              name: getSeanceDisplay(seance),
                                              comment: seance.seance_types?.comment || ""
                                            });
                                            setSeanceCommentDialogOpen(true);
                                          }}
                                        >
                                          <div className="flex items-start gap-2">
                                            <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            {seance.seance_types?.comment ? (
                                              <span className="line-clamp-2">{seance.seance_types.comment}</span>
                                            ) : (
                                              <span className="italic">Ajouter un commentaire de séance...</span>
                                            )}
                                          </div>
                                        </button>
                                        
                                        {/* Seance actions */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/30">
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
                                            className="text-xs gap-1 h-8 w-full sm:w-auto"
                                            onClick={() => handleEditSeanceOriginal(seance)}
                                          >
                                            <Edit className="w-3 h-3" />
                                            Modifier l'originale
                                          </Button>
                                        </div>
                                      </div>
                                    </CollapsibleContent>
                                  </div>
                                </Collapsible>

                                {/* Bilan between sessions */}
                                <div className="ml-3 mt-2 mb-2 pl-3 border-l-2 border-dashed border-primary/30">
                                  {bilanAfterSeance ? (
                                    <div className="bg-primary/5 rounded-md p-3 space-y-2">
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                        <div className="flex items-center gap-2 text-sm font-medium text-primary flex-1 min-w-0">
                                          <ClipboardCheck className="w-4 h-4 flex-shrink-0" />
                                          <span className="truncate">Bilan après séance {i + 1}</span>
                                        </div>
                                        <div className="flex items-center gap-2 pl-6 sm:pl-0">
                                          <Input
                                            type="date"
                                            value={bilanAfterSeance.bilan_date || ""}
                                            onChange={(e) => handleBilanDateChange(bilanAfterSeance.id, e.target.value)}
                                            className="flex-1 sm:w-32 h-9 sm:h-7 text-sm sm:text-xs"
                                            title="Date du bilan"
                                          />
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 sm:h-7 w-9 sm:w-auto px-2"
                                            onClick={() => handlePrintBilan(bilanAfterSeance, i + 1)}
                                            title="Imprimer le bilan"
                                          >
                                            <Printer className="w-4 h-4 sm:w-3 sm:h-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 sm:h-7 px-2 text-sm sm:text-xs"
                                            onClick={() => navigate(`/patients/${patientId}/bilan-intermediaire?traitement=${traitement.id}&position=${i + 1}&bilan=${bilanAfterSeance.id}`)}
                                          >
                                            <Edit className="w-4 h-4 sm:w-3 sm:h-3 sm:mr-1" />
                                            <span className="hidden sm:inline">Modifier</span>
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs text-muted-foreground hover:text-primary h-9 sm:h-8"
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

                    {/* Add buttons section */}
                    <div className="pt-4 border-t space-y-3">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start gap-2 h-11 sm:h-10"
                        onClick={() => {
                          setEditingSeance(null);
                          setEditingSeanceIndex(null);
                          setSeanceFormDialogOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter une séance
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start gap-2 h-11 sm:h-10"
                        onClick={() => navigate(`/patients/${patientId}/bilan-intermediaire`)}
                      >
                        <FileText className="w-4 h-4" />
                        Ajouter un bilan intermédiaire
                      </Button>
                    </div>

                    {/* Visibility toggle */}
                    <div className="pt-4 border-t space-y-3">
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
                    </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aucun plan de traitement actif. Importez-en un ou créez-en un nouveau.
            </p>
          )}
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
        showDateField={editingSeanceIndex === null}
        initialPathologies={traitement?.pathologie ? [traitement.pathologie] : undefined}
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

      {selectedSeanceForAddExercice && (
        <AddExerciceToSeanceDialog
          open={addExerciceDialogOpen}
          onOpenChange={(open) => {
            setAddExerciceDialogOpen(open);
            if (!open) setSelectedSeanceForAddExercice(null);
          }}
          seanceTypeId={selectedSeanceForAddExercice.id}
          currentExercicesCount={selectedSeanceForAddExercice.count}
          onSuccess={fetchTraitementDetails}
        />
      )}

      {/* Seance Comment Dialog */}
      {selectedSeanceForComment && (
        <CommentDialog
          open={seanceCommentDialogOpen}
          onOpenChange={(open) => {
            setSeanceCommentDialogOpen(open);
            if (!open) setSelectedSeanceForComment(null);
          }}
          title="Commentaire de la séance"
          subtitle={selectedSeanceForComment.name}
          comment={selectedSeanceForComment.comment}
          onSave={handleSaveSeanceComment}
          saving={savingSeanceComment}
        />
      )}
    </>
  );
}
