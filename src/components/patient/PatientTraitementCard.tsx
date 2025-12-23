import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ClipboardList, Plus, FileDown, Calendar, FileText, ChevronDown, ChevronUp, X, Edit, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { TraitementFormDialog } from "@/components/traitement/TraitementFormDialog";
import { GenerateAccessCodeDialog } from "@/components/patient/GenerateAccessCodeDialog";

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
  } | null;
}

interface TraitementDetails {
  id: string;
  pathologie: string;
  description: string | null;
  author_name: string | null;
  is_hidden_from_list: boolean;
  tests: TraitementTest[];
  seances: TraitementSeance[];
}

interface PatientTraitementCardProps {
  activeTraitementId: string | null;
  activeTraitementName: string | null;
  patientId: string;
  patientName: string;
  onImportTraitement: () => void;
  onCreateTraitement: () => void;
  onRemoveTraitement: () => void;
  onTraitementChanged?: (newTraitementId: string) => void;
}

export function PatientTraitementCard({
  activeTraitementId,
  activeTraitementName,
  patientId,
  patientName,
  onImportTraitement,
  onCreateTraitement,
  onRemoveTraitement,
  onTraitementChanged,
}: PatientTraitementCardProps) {
  const { user } = useAuth();
  const [traitement, setTraitement] = useState<TraitementDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTraitement, setEditingTraitement] = useState<any>(null);
  const [accessCodeDialogOpen, setAccessCodeDialogOpen] = useState(false);

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
          .select("*, seance_types(id, pathologie, objectif_principal, pathologies, objectifs_principaux)")
          .eq("traitement_type_id", activeTraitementId)
          .order("ordre", { ascending: true });

        setTraitement({
          ...traitementData,
          is_hidden_from_list: traitementData.is_hidden_from_list || false,
          tests: testsData || [],
          seances: seancesData || [],
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
    
    const { data: latestTraitement } = await supabase
      .from("traitement_types")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestTraitement && onTraitementChanged) {
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onImportTraitement}>
                <FileDown className="w-4 h-4 mr-2" />
                Importer
              </Button>
              <Button variant="outline" size="sm" onClick={onCreateTraitement}>
                <Plus className="w-4 h-4 mr-2" />
                Créer
              </Button>
            </div>
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

                    {/* Séances */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Séances ({traitement.seances?.length || 0})</p>
                      {traitement.seances && traitement.seances.length > 0 ? (
                        <div className="space-y-2">
                          {traitement.seances.map((seance, i) => (
                            <div 
                              key={seance.id} 
                              className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg border border-border/50"
                            >
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-primary">{i + 1}</span>
                              </div>
                              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm">{getSeanceDisplay(seance)}</span>
                            </div>
                          ))}
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
                      
                      {/* Share with patient button */}
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => setAccessCodeDialogOpen(true)}
                        className="w-full gap-2"
                      >
                        <Share2 className="w-4 h-4" />
                        Générer un accès temporaire pour le patient
                      </Button>
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
      />

      {traitement && (
        <GenerateAccessCodeDialog
          open={accessCodeDialogOpen}
          onOpenChange={setAccessCodeDialogOpen}
          traitementId={traitement.id}
          patientId={patientId}
          patientName={patientName}
        />
      )}
    </>
  );
}
