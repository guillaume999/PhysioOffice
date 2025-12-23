import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, X, GripVertical, Trash2, Calendar, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface SeanceOption {
  id: string;
  pathologie: string;
  objectif_principal: string;
  pathologies?: string[];
  objectifs_principaux?: string[];
}

interface TraitementTest {
  id?: string;
  description: string;
  ordre: number;
}

interface TraitementSeance {
  id?: string;
  seance_type_id: string;
  ordre: number;
  seance?: SeanceOption;
}

interface TraitementFormData {
  id?: string;
  pathologie: string;
  description: string;
  tests: TraitementTest[];
  seances: TraitementSeance[];
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
  const [seanceSearchQuery, setSeanceSearchQuery] = useState("");
  
  // Form state
  const [pathologie, setPathologie] = useState("");
  const [newPathologie, setNewPathologie] = useState("");
  const [description, setDescription] = useState("");
  const [tests, setTests] = useState<TraitementTest[]>([]);
  const [selectedSeances, setSelectedSeances] = useState<TraitementSeance[]>([]);

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
      .select("id, pathologie, objectif_principal, pathologies, objectifs_principaux")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setAvailableSeances(seancesData || []);
  };

  const resetForm = () => {
    setPathologie("");
    setNewPathologie("");
    setDescription("");
    setTests([]);
    setSelectedSeances([]);
    setSeanceSearchQuery("");
  };

  const addTest = () => {
    setTests([
      ...tests,
      {
        description: "",
        ordre: tests.length
      }
    ]);
  };

  const updateTest = (index: number, value: string) => {
    const updated = [...tests];
    updated[index] = { ...updated[index], description: value };
    setTests(updated);
  };

  const removeTest = (index: number) => {
    const updated = tests.filter((_, i) => i !== index);
    updated.forEach((t, i) => t.ordre = i);
    setTests(updated);
  };

  const toggleSeance = (seance: SeanceOption) => {
    const existingIndex = selectedSeances.findIndex(s => s.seance_type_id === seance.id);
    if (existingIndex >= 0) {
      const updated = selectedSeances.filter((_, i) => i !== existingIndex);
      updated.forEach((s, i) => s.ordre = i);
      setSelectedSeances(updated);
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

  const removeSeance = (index: number) => {
    const updated = selectedSeances.filter((_, i) => i !== index);
    updated.forEach((s, i) => s.ordre = i);
    setSelectedSeances(updated);
  };

  const getSeanceDisplay = (seance: SeanceOption) => {
    const pathos = seance.pathologies?.length ? seance.pathologies : [seance.pathologie];
    const objectifs = seance.objectifs_principaux?.length ? seance.objectifs_principaux : [seance.objectif_principal];
    return `${pathos.join(", ")} - ${objectifs.join(", ")}`;
  };

  const filteredSeances = availableSeances.filter(seance => {
    if (!seanceSearchQuery.trim()) return true;
    const query = seanceSearchQuery.toLowerCase();
    const pathos = seance.pathologies?.length ? seance.pathologies : [seance.pathologie];
    const objectifs = seance.objectifs_principaux?.length ? seance.objectifs_principaux : [seance.objectif_principal];
    return pathos.some(p => p.toLowerCase().includes(query)) ||
           objectifs.some(o => o.toLowerCase().includes(query));
  });

  const handleSubmit = async () => {
    if (!user) return;

    const finalPathologie = newPathologie || pathologie;
    if (!finalPathologie) {
      toast.error("La pathologie est requise");
      return;
    }

    setLoading(true);
    try {
      // Save new pathologie if created
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

        // Delete old tests and seances
        await supabase.from("traitement_tests").delete().eq("traitement_type_id", traitement.id);
        await supabase.from("traitement_seances").delete().eq("traitement_type_id", traitement.id);

        // Insert new tests
        for (const test of tests) {
          if (test.description.trim()) {
            await supabase.from("traitement_tests").insert({
              traitement_type_id: traitement.id,
              description: test.description,
              ordre: test.ordre
            });
          }
        }

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
          if (test.description.trim()) {
            await supabase.from("traitement_tests").insert({
              traitement_type_id: newTraitement.id,
              description: test.description,
              ordre: test.ordre
            });
          }
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
          {/* Author info */}
          {userPseudo ? (
            <p className="text-sm text-muted-foreground">Auteur: <span className="font-medium text-foreground">{userPseudo}</span></p>
          ) : (
            <p className="text-sm text-amber-600">Définissez votre pseudo dans votre profil pour qu'il apparaisse comme auteur</p>
          )}

          {/* Pathologie */}
          <div className="space-y-2">
            <Label>Pathologie *</Label>
            <Select value={pathologie} onValueChange={(v) => { setPathologie(v); setNewPathologie(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une pathologie" />
              </SelectTrigger>
              <SelectContent>
                {availablePathologies.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
                <SelectItem value="__new__">+ Créer nouvelle</SelectItem>
              </SelectContent>
            </Select>
            {pathologie === "__new__" && (
              <Input
                placeholder="Nouvelle pathologie"
                value={newPathologie}
                onChange={(e) => setNewPathologie(e.target.value)}
              />
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description du traitement</Label>
            <Textarea
              placeholder="Décrivez le traitement, ses objectifs, les indications..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Tests */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tests à réaliser</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTest} className="gap-1">
                <Plus className="w-4 h-4" /> Ajouter un test
              </Button>
            </div>
            {tests.length > 0 && (
              <div className="space-y-2">
                {tests.map((test, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{index + 1}</span>
                    </div>
                    <Textarea
                      placeholder="Description du test"
                      value={test.description}
                      onChange={(e) => updateTest(index, e.target.value)}
                      rows={2}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeTest(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {tests.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun test ajouté</p>
            )}
          </div>

          {/* Séances */}
          <div className="space-y-2">
            <Label>Séances associées</Label>
            
            {/* Selected seances */}
            {selectedSeances.length > 0 && (
              <div className="space-y-2 mb-4">
                {selectedSeances.map((seance, index) => (
                  <Card key={index} className="bg-muted/30">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 flex-shrink-0">
                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {seance.seance ? getSeanceDisplay(seance.seance) : "Séance inconnue"}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeSeance(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Seance selection */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une séance..."
                  value={seanceSearchQuery}
                  onChange={(e) => setSeanceSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredSeances.length > 0 ? (
                  filteredSeances.map((seance) => {
                    const isSelected = selectedSeances.some(s => s.seance_type_id === seance.id);
                    return (
                      <div 
                        key={seance.id} 
                        className={`flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer ${isSelected ? 'bg-primary/10' : ''}`}
                        onClick={() => toggleSeance(seance)}
                      >
                        <Checkbox checked={isSelected} />
                        <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{getSeanceDisplay(seance)}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {availableSeances.length === 0 
                      ? "Aucune séance disponible. Créez d'abord des séances types." 
                      : "Aucune séance trouvée"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Submit button */}
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Enregistrement..." : (traitement?.id ? "Modifier le traitement" : "Créer le traitement")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
