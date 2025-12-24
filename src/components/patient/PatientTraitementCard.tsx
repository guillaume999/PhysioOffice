import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Plus, FileDown, Calendar, FileText, ChevronDown, ChevronUp, X, Edit, Share2, Play, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { TraitementFormDialog } from "@/components/traitement/TraitementFormDialog";
import { GenerateAccessCodeDialog } from "@/components/patient/GenerateAccessCodeDialog";
import { SeanceFormDialog } from "@/components/seance/SeanceFormDialog";

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTraitement, setEditingTraitement] = useState<any>(null);
  const [accessCodeDialogOpen, setAccessCodeDialogOpen] = useState(false);
  const [selectedSeanceForAccess, setSelectedSeanceForAccess] = useState<{id: string; name: string} | null>(null);
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());
  const [seanceFormDialogOpen, setSeanceFormDialogOpen] = useState(false);
  const [editingSeance, setEditingSeance] = useState<any>(null);
  const [editingSeanceIndex, setEditingSeanceIndex] = useState<number | null>(null);

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
          .select("id, position_after_seance, content")
          .eq("patient_id", patientId)
          .eq("traitement_id", activeTraitementId)
          .order("position_after_seance", { ascending: true });

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
    
    setEditingTraitement({
      // Don't pass id so it creates a new entry
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
    // Fetch the latest traitement created by this user to set as active
    if (!user) return;
    
    const oldTraitementId = activeTraitementId;
    
    const { data: latestTraitement } = await supabase
      .from("traitement_types")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestTraitement && onTraitementChanged) {
      // Transfer bilans from old treatment to new treatment
      if (oldTraitementId && oldTraitementId !== latestTraitement.id) {
        await supabase
          .from("patient_bilans")
          .update({ traitement_id: latestTraitement.id })
          .eq("patient_id", patientId)
          .eq("traitement_id", oldTraitementId);
      }
      
      onTraitementChanged(latestTraitement.id);
    }
    
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
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge variant="outline" className="text-sm flex-shrink-0">
                      {traitement.pathologie}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      par {traitement.author_name || "Anonyme"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      • {traitement.tests?.length || 0} tests • {traitement.seances?.length || 0} séances
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(!expanded)}
                      className="gap-1 flex-shrink-0"
                    >
                      {expanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Réduire
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Détails
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onRemoveTraitement}
                      className="text-destructive h-8 w-8"
                      title="Retirer le traitement"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Expandable content */}
                {expanded && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    {/* Description */}
                    {traitement.description && (
                      <p className="text-sm text-muted-foreground">{traitement.description}</p>
                    )}

                    {/* Tests */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Tests ({traitement.tests?.length || 0})</p>
                      {traitement.tests && traitement.tests.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {traitement.tests.map((test) => (
                            <Badge
                              key={test.id}
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" />
                              {test.exercices?.title || test.description?.substring(0, 25) || "Test"}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Aucun test</p>
                      )}
                    </div>

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
                                <div className="bg-muted/30 rounded-lg border border-border/50 overflow-hidden">
                                  {/* Seance header */}
                                  <div className="flex items-center justify-between gap-3 p-3">
                                    <div 
                                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                                      onClick={() => toggleSeanceExpand(seance.id)}
                                    >
                                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-xs font-bold text-primary">{i + 1}</span>
                                      </div>
                                      <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
                                        <div className="space-y-2">
                                          {exercices.map((ex, j) => (
                                            <div 
                                              key={ex.id}
                                              className="flex items-center gap-3 p-2 bg-background/50 rounded-md border border-border/30"
                                            >
                                              <span className="text-xs text-muted-foreground w-5">{j + 1}.</span>
                                              {ex.exercice?.thumbnail_url && (
                                                <img 
                                                  src={ex.exercice.thumbnail_url} 
                                                  alt="" 
                                                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                                                />
                                              )}
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                  {ex.exercice?.title || ex.name || "Exercice"}
                                                </p>
                                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                  {ex.series > 1 && <span>{ex.series} séries</span>}
                                                  {ex.repetitions && <span>× {ex.repetitions} reps</span>}
                                                  {ex.duration_seconds && <span>{ex.duration_seconds}s</span>}
                                                </div>
                                              </div>
                                              {ex.exercice?.video_url && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                                  <Play className="w-4 h-4" />
                                                </Button>
                                              )}
                                            </div>
                                          ))}
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
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                          <ClipboardCheck className="w-4 h-4" />
                                          Bilan après séance {i + 1}
                                        </div>
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
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {bilanAfterSeance.content || "Bilan vide"}
                                      </p>
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
    </>
  );
}
