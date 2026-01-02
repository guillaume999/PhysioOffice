import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, X, Trash2, Calendar, GripVertical, ChevronUp, ChevronDown, Search, ChevronRight, Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface SeanceExercice {
  id: string;
  name: string | null;
  description: string | null;
  series: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  exercices: {
    id: string;
    title: string;
    thumbnail_url: string | null;
  } | null;
}

interface SeanceOption {
  id: string;
  code: string;
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
  localId: string; // Unique identifier for each instance (allows duplicates)
}

interface ExerciceOption {
  id: string;
  code: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  pathologie_tags?: string[];
}

interface TraitementTest {
  id?: string;
  exercice_id: string;
  exercice?: ExerciceOption;
  ordre: number;
  localId: string; // Unique identifier for each instance (allows duplicates)
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
  isHiddenFromList?: boolean;
}

export function TraitementFormDialog({ open, onOpenChange, traitement, onSuccess, isHiddenFromList = false }: TraitementFormDialogProps) {
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
  
  // Search and expansion state
  const [exerciceSearch, setExerciceSearch] = useState("");
  const [seanceSearch, setSeanceSearch] = useState("");
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());
  const [seanceExercices, setSeanceExercices] = useState<Record<string, SeanceExercice[]>>({});
  const [loadingSeanceExercices, setLoadingSeanceExercices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && user) {
      fetchOptions();
      if (traitement) {
        setPathologie(traitement.pathologie || "");
        setDescription(traitement.description || "");
        setTests((traitement.tests || []).map(t => ({
          ...t,
          localId: t.localId || crypto.randomUUID()
        })));
        setSelectedSeances((traitement.seances || []).map(s => ({
          ...s,
          localId: s.localId || crypto.randomUUID()
        })));
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
      .select("id, code, pathologie, pathologies, objectif_principal, objectifs_principaux")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    setAvailableSeances(seancesData?.map(s => ({
      ...s,
      code: s.code || '',
      pathologies: s.pathologies || [],
      objectifs_principaux: s.objectifs_principaux || []
    })) || []);

    // Fetch exercices (user's own + platform exercices)
    const { data: exercicesData } = await supabase
      .from("exercices")
      .select("id, code, title, description, thumbnail_url, pathologie_tags")
      .or(`user_id.eq.${user.id},status.eq.shared`)
      .order("title", { ascending: true });
    
    setAvailableExercices(exercicesData?.map(e => ({
      ...e,
      code: e.code || ''
    })) || []);
  };

  const toggleSeanceExpansion = async (seanceId: string) => {
    const newExpanded = new Set(expandedSeances);
    
    if (newExpanded.has(seanceId)) {
      newExpanded.delete(seanceId);
    } else {
      newExpanded.add(seanceId);
      
      // Fetch exercices if not already loaded
      if (!seanceExercices[seanceId]) {
        setLoadingSeanceExercices(prev => new Set(prev).add(seanceId));
        
        const { data } = await supabase
          .from("seance_exercices")
          .select("id, name, description, series, repetitions, duration_seconds, exercices:exercice_id(id, title, thumbnail_url)")
          .eq("seance_type_id", seanceId)
          .order("ordre", { ascending: true });
        
        setSeanceExercices(prev => ({ ...prev, [seanceId]: data || [] }));
        setLoadingSeanceExercices(prev => {
          const next = new Set(prev);
          next.delete(seanceId);
          return next;
        });
      }
    }
    
    setExpandedSeances(newExpanded);
  };

  // Filter exercices by search
  const filteredExercices = availableExercices.filter(ex => {
    if (!exerciceSearch.trim()) return true;
    const searchLower = exerciceSearch.toLowerCase();
    const matchTitle = ex.title.toLowerCase().includes(searchLower);
    const matchTags = ex.pathologie_tags?.some(tag => tag.toLowerCase().includes(searchLower));
    return matchTitle || matchTags;
  });

  // Filter seances by search
  const filteredSeances = availableSeances.filter(seance => {
    if (!seanceSearch.trim()) return true;
    const searchLower = seanceSearch.toLowerCase();
    const matchPathologie = seance.pathologie.toLowerCase().includes(searchLower);
    const matchPathologies = seance.pathologies?.some(p => p.toLowerCase().includes(searchLower));
    const matchObjectif = seance.objectif_principal.toLowerCase().includes(searchLower);
    const matchObjectifs = seance.objectifs_principaux?.some(o => o.toLowerCase().includes(searchLower));
    return matchPathologie || matchPathologies || matchObjectif || matchObjectifs;
  });

  const resetForm = () => {
    setPathologie("");
    setNewPathologie("");
    setDescription("");
    setTests([]);
    setSelectedSeances([]);
    setExerciceSearch("");
    setSeanceSearch("");
    setExpandedSeances(new Set());
  };

  const addTest = (exercice: ExerciceOption) => {
    setTests([
      ...tests,
      {
        exercice_id: exercice.id,
        exercice,
        ordre: tests.length,
        localId: crypto.randomUUID()
      }
    ]);
  };

  const removeTest = (localId: string) => {
    const updated = tests.filter(t => t.localId !== localId);
    updated.forEach((t, i) => t.ordre = i);
    setTests(updated);
  };

  const addSeance = (seance: SeanceOption) => {
    setSelectedSeances([
      ...selectedSeances,
      {
        seance_type_id: seance.id,
        ordre: selectedSeances.length,
        seance,
        localId: crypto.randomUUID()
      }
    ]);
  };

  const removeSeance = (localId: string) => {
    const updated = selectedSeances.filter(s => s.localId !== localId);
    updated.forEach((s, i) => s.ordre = i);
    setSelectedSeances(updated);
  };

  const moveSeance = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= selectedSeances.length) return;
    const updated = [...selectedSeances];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
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
            exercice_id: test.exercice_id,
            description: test.exercice?.description || '',
            ordre: test.ordre
          });
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
            is_copy: false,
            is_hidden_from_list: isHiddenFromList
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert tests
        for (const test of tests) {
          await supabase.from("traitement_tests").insert({
            traitement_type_id: newTraitement.id,
            exercice_id: test.exercice_id,
            description: test.exercice?.description || '',
            ordre: test.ordre
          });
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
                  <Card key={item.localId} className="bg-secondary/30 border-secondary/50">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-bold">
                        {index + 1}
                      </div>
                      {item.exercice?.thumbnail_url ? (
                        <img 
                          src={item.exercice.thumbnail_url} 
                          alt={item.exercice.title} 
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <Play className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs uppercase text-muted-foreground">{item.exercice?.code || ''}</span>
                          <p className="font-medium truncate">{item.exercice?.title}</p>
                        </div>
                        {item.exercice?.description && (
                          <p className="text-sm text-muted-foreground truncate">{item.exercice.description}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeTest(item.localId)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Search exercices */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre ou tag..."
                value={exerciceSearch}
                onChange={(e) => setExerciceSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Available exercices */}
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
              {filteredExercices.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2 text-center">
                  {availableExercices.length === 0 
                    ? "Aucun exercice disponible. Créez d'abord des exercices." 
                    : "Aucun exercice trouvé pour cette recherche."}
                </p>
              ) : (
                filteredExercices.map((exercice) => {
                  const count = tests.filter(t => t.exercice_id === exercice.id).length;
                  return (
                    <div 
                      key={exercice.id} 
                      className={`flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer ${count > 0 ? 'bg-secondary/20' : ''}`}
                      onClick={() => addTest(exercice)}
                    >
                      <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      {exercice.thumbnail_url ? (
                        <img 
                          src={exercice.thumbnail_url} 
                          alt={exercice.title} 
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
                          <Play className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs uppercase text-muted-foreground">{exercice.code}</span>
                          <p className="text-sm font-medium truncate">{exercice.title}</p>
                        </div>
                        {exercice.description && (
                          <p className="text-xs text-muted-foreground truncate">{exercice.description}</p>
                        )}
                      </div>
                      {count > 0 && (
                        <Badge variant="secondary" className="text-xs">{count}</Badge>
                      )}
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
                  <Card key={item.localId} className="bg-primary/5 border-primary/20">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={() => moveSeance(index, index - 1)}
                          disabled={index === 0}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={() => moveSeance(index, index + 1)}
                          disabled={index === selectedSeances.length - 1}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-xs uppercase text-muted-foreground mr-1">{item.seance?.code || ''}</span>
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
                      <Button variant="ghost" size="icon" onClick={() => removeSeance(item.localId)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Search seances */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par pathologie ou objectif..."
                value={seanceSearch}
                onChange={(e) => setSeanceSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Available seances */}
            <div className="max-h-64 overflow-y-auto border rounded-lg p-2 space-y-1">
              {filteredSeances.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2 text-center">
                  {availableSeances.length === 0 
                    ? "Aucune séance disponible. Créez d'abord des séances types." 
                    : "Aucune séance trouvée pour cette recherche."}
                </p>
              ) : (
                filteredSeances.map((seance) => {
                  const count = selectedSeances.filter(s => s.seance_type_id === seance.id).length;
                  const isExpanded = expandedSeances.has(seance.id);
                  const isLoading = loadingSeanceExercices.has(seance.id);
                  const exercices = seanceExercices[seance.id] || [];
                  
                  return (
                    <Collapsible key={seance.id} open={isExpanded}>
                      <div className={`flex items-center gap-2 p-2 hover:bg-muted/50 rounded ${count > 0 ? 'bg-primary/10' : ''}`}>
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSeanceExpansion(seance.id);
                            }}
                          >
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <div 
                          className="flex-1 flex items-center gap-2 cursor-pointer"
                          onClick={() => addSeance(seance)}
                        >
                          <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                          <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-mono text-xs uppercase text-muted-foreground">{seance.code}</span>
                              {getDisplayPathologies(seance).map((p, i) => (
                                <span key={i} className="text-sm">{p}</span>
                              ))}
                              <span className="text-muted-foreground">-</span>
                              {getDisplayObjectifs(seance).map((o, i) => (
                                <span key={i} className="text-sm font-medium">{o}</span>
                              ))}
                            </div>
                          </div>
                          {count > 0 && (
                            <Badge variant="secondary" className="text-xs">{count}x</Badge>
                          )}
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="ml-8 pl-4 border-l-2 border-primary/20 py-2 space-y-2">
                          {exercices.length === 0 && !isLoading ? (
                            <p className="text-xs text-muted-foreground">Aucun exercice dans cette séance</p>
                          ) : (
                            exercices.map((ex) => (
                              <div key={ex.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                                {ex.exercices?.thumbnail_url ? (
                                  <img 
                                    src={ex.exercices.thumbnail_url} 
                                    alt={ex.name || ex.exercices.title} 
                                    className="w-10 h-10 object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
                                    <Play className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{ex.name || ex.exercices?.title}</p>
                                  <div className="flex gap-2 text-xs text-muted-foreground">
                                    {ex.series && ex.series > 1 && <span>{ex.series} séries</span>}
                                    {ex.repetitions && <span>{ex.repetitions} rép.</span>}
                                    {ex.duration_seconds && <span>{ex.duration_seconds}s</span>}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
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
