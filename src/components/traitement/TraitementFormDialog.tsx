import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, X, Trash2, Calendar, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface SeanceOption {
  id: string;
  pathologie: string;
  pathologies: string[];
  objectif_principal: string;
  objectifs_principaux: string[];
}

interface TraitementSeanceItem {
  id?: string;
  seance_type_id: string;
  ordre: number;
  seance?: SeanceOption;
}

interface ExerciceOption {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
}

interface TraitementTest {
  id?: string;
  exercice_id: string;
  exercice?: ExerciceOption;
  ordre: number;
}

interface TraitementFormData {
  id?: string;
  pathologie: string;
  description: string | null;
  tests: TraitementTest[];
  seances: TraitementSeanceItem[];
  author_name: string | null;
}

interface TraitementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traitement?: TraitementFormData | null;
  onSuccess: () => void;
}

export function TraitementFormDialog({ open, onOpenChange, traitement, onSuccess }: TraitementFormDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userPseudo, setUserPseudo] = useState<string | null>(null);
  
  // Available options
  const [availablePathologies, setAvailablePathologies] = useState<string[]>([]);
  const [availableSeances, setAvailableSeances] = useState<SeanceOption[]>([]);
  const [availableExercices, setAvailableExercices] = useState<ExerciceOption[]>([]);
  
  // Form state
  const [pathologie, setPathologie] = useState("");
  const [newPathologie, setNewPathologie] = useState("");
  const [description, setDescription] = useState("");
  const [tests, setTests] = useState<TraitementTest[]>([]);
  const [selectedSeances, setSelectedSeances] = useState<TraitementSeanceItem[]>([]);

  useEffect(() => {
    if (open && user) {
      fetchOptions();
      if (traitement) {
        setPathologie(traitement.pathologie || "");
        setDescription(traitement.description || "");
        setTests(traitement.tests || []);
        setSelectedSeances(traitement.seances || []);
      } else {
        resetForm();
      }
    }
  }, [open, user, traitement]);

  const fetchOptions = async () => {
    if (!user) return;

    // Fetch user pseudo
    const { data: profileData } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("user_id", user.id)
      .maybeSingle();
    setUserPseudo(profileData?.pseudo || null);

    // Fetch pathologies
    const { data: pathoData } = await supabase
      .from("pathologies")
      .select("name")
      .eq("user_id", user.id);
    setAvailablePathologies([...new Set(pathoData?.map(p => p.name) || [])]);

    // Fetch seances (user's own seances)
    const { data: seancesData } = await supabase
      .from("seance_types")
      .select("id, pathologie, pathologies, objectif_principal, objectifs_principaux")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    setAvailableSeances(seancesData?.map(s => ({
      ...s,
      pathologies: s.pathologies || [],
      objectifs_principaux: s.objectifs_principaux || []
    })) || []);

    // Fetch exercices (user's own + platform exercices)
    const { data: exercicesData } = await supabase
      .from("exercices")
      .select("id, title, description, thumbnail_url")
      .or(`user_id.eq.${user.id},status.eq.shared`)
      .order("title", { ascending: true });
    
    setAvailableExercices(exercicesData || []);
  };

  const resetForm = () => {
    setPathologie("");
    setNewPathologie("");
    setDescription("");
    setTests([]);
    setSelectedSeances([]);
  };

  const toggleExercice = (exercice: ExerciceOption) => {
    const exists = tests.find(t => t.exercice_id === exercice.id);
    if (exists) {
      const updated = tests.filter(t => t.exercice_id !== exercice.id);
      updated.forEach((t, i) => t.ordre = i);
      setTests(updated);
    } else {
      setTests([
        ...tests,
        {
          exercice_id: exercice.id,
          exercice,
          ordre: tests.length
        }
      ]);
    }
  };

  const removeTest = (exerciceId: string) => {
    const updated = tests.filter(t => t.exercice_id !== exerciceId);
    updated.forEach((t, i) => t.ordre = i);
    setTests(updated);
  };

  const toggleSeance = (seance: SeanceOption) => {
    const exists = selectedSeances.find(s => s.seance_type_id === seance.id);
    if (exists) {
      setSelectedSeances(selectedSeances.filter(s => s.seance_type_id !== seance.id));
    } else {
      setSelectedSeances([
        ...selectedSeances,
        {
          seance_type_id: seance.id,
          ordre: selectedSeances.length,
          seance
        }
      ]);
    }
  };

  const removeSeance = (seanceId: string) => {
    const updated = selectedSeances.filter(s => s.seance_type_id !== seanceId);
    updated.forEach((s, i) => s.ordre = i);
    setSelectedSeances(updated);
  };

  const getDisplayPathologies = (seance: SeanceOption) => {
    return seance.pathologies?.length > 0 ? seance.pathologies : [seance.pathologie];
  };

  const getDisplayObjectifs = (seance: SeanceOption) => {
    return seance.objectifs_principaux?.length > 0 ? seance.objectifs_principaux : [seance.objectif_principal];
  };

  const handleSubmit = async () => {
    if (!user) return;

    const finalPathologie = newPathologie || pathologie;

    if (!finalPathologie) {
      toast.error("La pathologie est requise");
      return;
    }

    setLoading(true);
    try {
      // Save new pathologie if needed
      if (newPathologie && !availablePathologies.includes(newPathologie)) {
        await supabase.from("pathologies").insert({ user_id: user.id, name: newPathologie });
      }

      if (traitement?.id) {
        // Update existing traitement
        const { error: updateError } = await supabase
          .from("traitement_types")
          .update({
            pathologie: finalPathologie,
            description
          })
          .eq("id", traitement.id);

        if (updateError) throw updateError;

        // Delete old tests
        await supabase.from("traitement_tests").delete().eq("traitement_type_id", traitement.id);

        // Insert new tests
        for (const test of tests) {
          await supabase.from("traitement_tests").insert({
            traitement_type_id: traitement.id,
            description: test.exercice?.title || '',
            ordre: test.ordre
          } as any);
        }

        // Delete old seances
        await supabase.from("traitement_seances").delete().eq("traitement_type_id", traitement.id);

        // Insert new seances
        for (const seance of selectedSeances) {
          await supabase.from("traitement_seances").insert({
            traitement_type_id: traitement.id,
            seance_type_id: seance.seance_type_id,
            ordre: seance.ordre
          });
        }

        toast.success("Traitement modifié avec succès");
      } else {
        // Create new traitement
        const { data: newTraitement, error: insertError } = await supabase
          .from("traitement_types")
          .insert({
            user_id: user.id,
            pathologie: finalPathologie,
            description,
            author_name: userPseudo,
            is_shared: false,
            is_copy: false
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert tests
        for (const test of tests) {
          await supabase.from("traitement_tests").insert({
            traitement_type_id: newTraitement.id,
            description: test.exercice?.title || '',
            ordre: test.ordre
          } as any);
        }

        // Insert seances
        for (const seance of selectedSeances) {
          await supabase.from("traitement_seances").insert({
            traitement_type_id: newTraitement.id,
            seance_type_id: seance.seance_type_id,
            ordre: seance.ordre
          });
        }

        toast.success("Traitement créé avec succès");
      }

      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error saving traitement:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{traitement?.id ? "Modifier le traitement" : "Nouveau traitement"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {userPseudo ? (
            <p className="text-sm text-muted-foreground">Auteur: <span className="font-medium text-foreground">{userPseudo}</span></p>
          ) : (
            <p className="text-sm text-amber-600">Définissez votre pseudo dans votre profil pour qu'il apparaisse comme auteur</p>
          )}

          {/* Pathologie */}
          <div className="space-y-2">
            <Label>Pathologie *</Label>
            <div className="flex gap-2">
              <Select value={pathologie} onValueChange={(v) => { setPathologie(v); setNewPathologie(""); }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Sélectionner une pathologie" />
                </SelectTrigger>
                <SelectContent>
                  {availablePathologies.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Ou créer une nouvelle..."
                value={newPathologie}
                onChange={(e) => { setNewPathologie(e.target.value); setPathologie(""); }}
                className="flex-1"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description du traitement</Label>
            <Textarea
              placeholder="Décrivez le protocole de traitement..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Tests (Exercices) */}
          <div className="space-y-2">
            <Label>Tests à effectuer (exercices)</Label>
            
            {/* Selected tests */}
            {tests.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium text-muted-foreground">Exercices sélectionnés ({tests.length})</p>
                {tests.map((item, index) => (
                  <Card key={item.exercice_id} className="bg-secondary/30 border-secondary/50">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-bold">
                        {index + 1}
                      </div>
                      {item.exercice?.thumbnail_url && (
                        <img 
                          src={item.exercice.thumbnail_url} 
                          alt={item.exercice.title} 
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.exercice?.title}</p>
                        {item.exercice?.description && (
                          <p className="text-sm text-muted-foreground truncate">{item.exercice.description}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeTest(item.exercice_id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Available exercices */}
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
              {availableExercices.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2 text-center">Aucun exercice disponible. Créez d'abord des exercices.</p>
              ) : (
                availableExercices.map((exercice) => {
                  const isSelected = tests.some(t => t.exercice_id === exercice.id);
                  return (
                    <div 
                      key={exercice.id} 
                      className={`flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer ${isSelected ? 'bg-secondary/20' : ''}`}
                      onClick={() => toggleExercice(exercice)}
                    >
                      <Checkbox checked={isSelected} />
                      {exercice.thumbnail_url && (
                        <img 
                          src={exercice.thumbnail_url} 
                          alt={exercice.title} 
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{exercice.title}</p>
                        {exercice.description && (
                          <p className="text-xs text-muted-foreground truncate">{exercice.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Séances */}
          <div className="space-y-2">
            <Label>Séances du traitement</Label>
            
            {/* Selected seances */}
            {selectedSeances.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium text-muted-foreground">Séances sélectionnées ({selectedSeances.length})</p>
                {selectedSeances.map((item, index) => (
                  <Card key={item.seance_type_id} className="bg-primary/5 border-primary/20">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1">
                          {getDisplayPathologies(item.seance!).map((p, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {getDisplayObjectifs(item.seance!).map((o, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{o}</Badge>
                          ))}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeSeance(item.seance_type_id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Available seances */}
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
              {availableSeances.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2 text-center">Aucune séance disponible. Créez d'abord des séances types.</p>
              ) : (
                availableSeances.map((seance) => {
                  const isSelected = selectedSeances.some(s => s.seance_type_id === seance.id);
                  return (
                    <div 
                      key={seance.id} 
                      className={`flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer ${isSelected ? 'bg-primary/10' : ''}`}
                      onClick={() => toggleSeance(seance)}
                    >
                      <Checkbox checked={isSelected} />
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1">
                          {getDisplayPathologies(seance).map((p, i) => (
                            <span key={i} className="text-sm">{p}</span>
                          ))}
                          <span className="text-muted-foreground">-</span>
                          {getDisplayObjectifs(seance).map((o, i) => (
                            <span key={i} className="text-sm font-medium">{o}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Enregistrement..." : (traitement?.id ? "Modifier le traitement" : "Créer le traitement")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
