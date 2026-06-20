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
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { TagReferenceSelect } from "@/components/tags/TagReferenceSelect";

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
  objectifs?: string[];
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
  objectifs?: string[];
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
  /**
   * When provided, the dialog creates a *patient instance* (patient_traitements
   * + patient_seances + patient_seance_exercices + patient_traitement_tests),
   * fully independent from the template, instead of a traitement_types model.
   */
  patientId?: string;
}

export function TraitementFormDialog({ open, onOpenChange, traitement, onSuccess, isHiddenFromList = false, patientId }: TraitementFormDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userPseudo, setUserPseudo] = useState<string | null>(null);
  
  // Available options
  const [availablePathologies, setAvailablePathologies] = useState<string[]>([]);
  const [availableObjectifs, setAvailableObjectifs] = useState<string[]>([]);
  const [availableSeances, setAvailableSeances] = useState<SeanceOption[]>([]);
  const [availableExercices, setAvailableExercices] = useState<ExerciceOption[]>([]);

  // Form state
  const [pathologie, setPathologie] = useState("");
  const [newPathologie, setNewPathologie] = useState("");
  const [objectifs, setObjectifs] = useState<string[]>([]);
  const [newObjectif, setNewObjectif] = useState("");
  const [description, setDescription] = useState("");
  const [tests, setTests] = useState<TraitementTest[]>([]);
  const [selectedSeances, setSelectedSeances] = useState<TraitementSeanceItem[]>([]);
  
  // Search and expansion state
  const [exerciceSearch, setExerciceSearch] = useState("");
  const [seanceSearch, setSeanceSearch] = useState("");
  const [seancePathoFilter, setSeancePathoFilter] = useState<string>("all");
  const [seanceObjectifFilter, setSeanceObjectifFilter] = useState<string>("all");
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());
  const [seanceExercices, setSeanceExercices] = useState<Record<string, SeanceExercice[]>>({});
  const [loadingSeanceExercices, setLoadingSeanceExercices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && user) {
      fetchOptions();
      if (traitement) {
        setPathologie(traitement.pathologie || "");
        setObjectifs(traitement.objectifs || []);
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
    setUserPseudo(pb.authStore.record?.pseudo || pb.authStore.record?.name || pb.authStore.record?.email || null);

    // Fetch pathologies
    const pathoData = await pb.collection("pathologies").getFullList({ filter: `user = "${user.id}"`, fields: "name" });
    setAvailablePathologies([...new Set(pathoData.map((p: any) => p.name as string))]);

    // Fetch objectifs (référentiel partagé avec les exercices et les séances)
    const objData = await pb.collection("objectifs").getFullList({ filter: `user = "${user.id}"`, fields: "name" });
    setAvailableObjectifs([...new Set((objData as any[]).map((o: any) => o.name as string).filter(Boolean))]);

    // Fetch seances (user's own seances)
    const seancesData = await pb.collection("seance_types").getFullList({
      filter: `user = "${user.id}"`, sort: "-created",
      fields: "id,code,pathologie,pathologies,objectifs,objectif_principal,objectifs_principaux",
    });
    setAvailableSeances(seancesData.map((s: any) => ({ ...s, code: s.code || '', pathologies: s.pathologies || [], objectifs: s.objectifs || [], objectifs_principaux: s.objectifs_principaux || [] })));

    // Fetch exercices (user's own + platform exercices)
    const exercicesData = await pb.collection("exercices").getFullList({
      filter: `(user = "${user.id}" || status = "shared")`,
      sort: "title", fields: "id,code,title,description,thumbnail_url,pathologie_tags",
    });
    setAvailableExercices(exercicesData.map((e: any) => ({ ...e, code: e.code || '' })));
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
        
        const data = await pb.collection("seance_exercices").getFullList({
          filter: `seance_type = "${seanceId}"`, sort: "ordre",
          expand: "exercice", fields: "id,name,description,series,repetitions,duration_seconds,expand",
        });
        setSeanceExercices(prev => ({ ...prev, [seanceId]: data.map((r: any) => ({ ...r, exercices: r.expand?.exercice })) }));
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

  // Tags d'une séance (champs unifiés avec fallback legacy)
  const getSeancePathoTags = (s: SeanceOption): string[] =>
    (s.pathologies?.length ? s.pathologies : [s.pathologie]).filter(Boolean);
  const getSeanceObjectifTags = (s: SeanceOption): string[] =>
    (s.objectifs?.length ? s.objectifs : (s.objectifs_principaux?.length ? s.objectifs_principaux : [s.objectif_principal])).filter(Boolean);

  // Filter seances by search + filtres pathologie/objectif
  const filteredSeances = availableSeances.filter(seance => {
    const sPathos = getSeancePathoTags(seance);
    const sObjs = getSeanceObjectifTags(seance);
    if (seancePathoFilter !== "all" && !sPathos.includes(seancePathoFilter)) return false;
    if (seanceObjectifFilter !== "all" && !sObjs.includes(seanceObjectifFilter)) return false;
    if (!seanceSearch.trim()) return true;
    const searchLower = seanceSearch.toLowerCase();
    return (
      sPathos.some(p => p.toLowerCase().includes(searchLower)) ||
      sObjs.some(o => o.toLowerCase().includes(searchLower))
    );
  });

  // Options des filtres dérivées des séances disponibles
  const seancePathoOptions = [...new Set(availableSeances.flatMap(getSeancePathoTags))].sort((a, b) => a.localeCompare(b, "fr"));
  const seanceObjectifOptions = [...new Set(availableSeances.flatMap(getSeanceObjectifTags))].sort((a, b) => a.localeCompare(b, "fr"));

  const resetForm = () => {
    setPathologie("");
    setNewPathologie("");
    setObjectifs([]);
    setNewObjectif("");
    setDescription("");
    setTests([]);
    setSelectedSeances([]);
    setExerciceSearch("");
    setSeanceSearch("");
    setSeancePathoFilter("all");
    setSeanceObjectifFilter("all");
    setExpandedSeances(new Set());
  };

  const addObjectif = (value: string) => {
    const v = value.trim();
    if (v && !objectifs.includes(v)) {
      setObjectifs([...objectifs, v]);
    }
    setNewObjectif("");
  };

  const removeObjectif = (tag: string) => {
    setObjectifs(objectifs.filter((o) => o !== tag));
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
    if (seance.objectifs?.length) return seance.objectifs;
    return seance.objectifs_principaux?.length > 0 ? seance.objectifs_principaux : [seance.objectif_principal];
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (loading) return;

    const finalPathologie = newPathologie || pathologie;

    if (!finalPathologie) {
      toast.error("La pathologie est requise");
      return;
    }

    setLoading(true);
    try {
      // Save new pathologie if needed
      if (newPathologie && !availablePathologies.includes(newPathologie)) {
        await pb.collection("pathologies").create({ user: user.id, name: newPathologie });
      }

      // Save new objectifs in the shared reference collection
      for (const obj of objectifs) {
        if (!availableObjectifs.includes(obj)) {
          await pb.collection("objectifs").create({ user: user.id, name: obj, type: "principal" });
        }
      }

      if (patientId) {
        // ── Patient instance mode ───────────────────────────────────────────
        // Create a patient_traitements record fully independent from any model,
        // copying chosen tests and séances (+ their exercises) into the
        // patient_* instance tables. `source` is optional provenance only.
        const pt = await pb.collection("patient_traitements").create({
          patient: patientId,
          praticien: user.id,
          nom: finalPathologie,
          pathologie: finalPathologie,
          objectifs,
          description,
          statut: "actif",
          date_debut: new Date().toISOString(),
        });

        // Copy tests -> patient_traitement_tests
        for (const test of tests) {
          await pb.collection("patient_traitement_tests").create({
            patient_traitement: pt.id,
            source: test.exercice_id || null,
            nom: test.exercice?.title || "",
            description: test.exercice?.description || "",
            video_url: "",
            ordre: test.ordre,
          });
        }

        // Copy séances -> patient_seances (+ their exercises -> patient_seance_exercices)
        for (const seance of selectedSeances) {
          const ps = await pb.collection("patient_seances").create({
            patient_traitement: pt.id,
            patient: patientId,
            praticien: user.id,
            source: seance.seance_type_id || null,
            nom: seance.seance?.objectif_principal || seance.seance?.pathologie || "",
            objectif: seance.seance?.objectif_principal || "",
            statut: "planifiée",
          });

          // Pull the model séance's exercises and copy each one
          const modelExs = await pb.collection("seance_exercices").getFullList({
            filter: `seance_type = "${seance.seance_type_id}"`, sort: "ordre", expand: "exercice",
          });
          for (const ex of modelExs as any[]) {
            await pb.collection("patient_seance_exercices").create({
              patient_seance: ps.id,
              source: ex.exercice || null,
              nom: ex.name || ex.expand?.exercice?.title || "",
              description: ex.description || "",
              video_url: ex.expand?.exercice?.video_url || "",
              ordre: ex.ordre,
              series: ex.series,
              repetitions: ex.repetitions,
              duree: ex.duration_seconds,
              realise: false,
            });
          }
        }

        toast.success("Traitement créé pour le patient");
      } else if (traitement?.id) {
        // Update existing traitement
        await pb.collection("traitement_types").update(traitement.id, { nom: finalPathologie, pathologie: finalPathologie, objectifs, description });

        // Delete old tests
        const oldTests = await pb.collection("traitement_tests").getFullList({ filter: `traitement_type = "${traitement.id}"` });
        for (const t of oldTests) await pb.collection("traitement_tests").delete(t.id);

        // Insert new tests
        for (const test of tests) {
          await pb.collection("traitement_tests").create({
            traitement_type: traitement.id,
            exercice: test.exercice_id,
            description: test.exercice?.description || '',
            ordre: test.ordre,
          });
        }

        // Delete old seances
        const oldSeances = await pb.collection("traitement_seances").getFullList({ filter: `traitement_type = "${traitement.id}"` });
        for (const s of oldSeances) await pb.collection("traitement_seances").delete(s.id);

        // Insert new seances
        for (const seance of selectedSeances) {
          await pb.collection("traitement_seances").create({
            traitement_type: traitement.id,
            seance_type: seance.seance_type_id,
            ordre: seance.ordre,
          });
        }

        toast.success("Traitement modifié avec succès");
      } else {
        // Create new traitement
        const newTraitement = await pb.collection("traitement_types").create({
            user: user.id,
            nom: finalPathologie,
            pathologie: finalPathologie,
            objectifs,
            description,
            author_name: userPseudo,
            is_shared: false,
            is_copy: false,
            is_hidden_from_list: isHiddenFromList,
          });

        // Insert tests
        for (const test of tests) {
          await pb.collection("traitement_tests").create({
            traitement_type: newTraitement.id,
            exercice: test.exercice_id,
            description: test.exercice?.description || '',
            ordre: test.ordre,
          });
        }

        // Insert seances
        for (const seance of selectedSeances) {
          await pb.collection("traitement_seances").create({
            traitement_type: newTraitement.id,
            seance_type: seance.seance_type_id,
            ordre: seance.ordre,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{traitement?.id ? "Modifier le traitement" : "Nouveau traitement"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 min-w-0">
          {userPseudo ? (
            <p className="text-sm text-muted-foreground">Auteur: <span className="font-medium text-foreground">{userPseudo}</span></p>
          ) : (
            <p className="text-sm text-amber-600">Définissez votre pseudo dans votre profil pour qu'il apparaisse comme auteur</p>
          )}

          {/* Pathologie */}
          <div className="space-y-2">
            <Label>Pathologie *</Label>
            {(pathologie || newPathologie) && (
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="secondary" className="gap-1">
                  {pathologie || newPathologie}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => { setPathologie(""); setNewPathologie(""); }}
                  />
                </Badge>
              </div>
            )}
            <TagReferenceSelect
              type="pathologie"
              options={availablePathologies}
              userId={user?.id || ""}
              onSelect={(v) => {
                if (availablePathologies.includes(v)) {
                  setPathologie(v);
                  setNewPathologie("");
                } else {
                  setPathologie("");
                  setNewPathologie(v);
                }
              }}
              onReferenceChanged={fetchOptions}
              placeholder="Rechercher ou créer une pathologie"
              className="w-full"
            />
          </div>

          {/* Objectifs (référentiel partagé avec les exercices et les séances) */}
          <div className="space-y-2">
            <Label>Objectifs</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {objectifs.map((o, i) => (
                <Badge key={i} variant="default" className="gap-1">
                  {o}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => removeObjectif(o)} />
                </Badge>
              ))}
              {objectifs.length === 0 && (
                <span className="text-xs text-muted-foreground">Aucun objectif sélectionné</span>
              )}
            </div>
            <div className="flex gap-2">
              <TagReferenceSelect
                type="objectif"
                options={availableObjectifs.filter((o) => !objectifs.includes(o))}
                userId={user?.id || ""}
                onSelect={addObjectif}
                onReferenceChanged={fetchOptions}
                placeholder="Rechercher un objectif"
                className="flex-1"
              />
              <Input
                placeholder="Ou créer un nouveau..."
                value={newObjectif}
                onChange={(e) => setNewObjectif(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addObjectif(newObjectif)}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => addObjectif(newObjectif)}>
                <Plus className="w-4 h-4" />
              </Button>
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
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-mono text-xs uppercase text-muted-foreground flex-shrink-0">{item.exercice?.code || ''}</span>
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
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-mono text-xs uppercase text-muted-foreground flex-shrink-0">{exercice.code}</span>
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

            {/* Filtres pathologie / objectif */}
            {(seanceObjectifOptions.length > 0 || seancePathoOptions.length > 0) && (
              <div className="grid grid-cols-2 gap-2">
                <Select value={seanceObjectifFilter} onValueChange={setSeanceObjectifFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Objectif" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les objectifs</SelectItem>
                    {seanceObjectifOptions.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={seancePathoFilter} onValueChange={setSeancePathoFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Pathologie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les pathologies</SelectItem>
                    {seancePathoOptions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
