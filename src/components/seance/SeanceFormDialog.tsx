import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, X, GripVertical, Trash2, Upload, Video, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Exercice {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
}

interface SeanceExerciceItem {
  id?: string;
  exercice_id: string | null;
  name: string;
  description: string;
  repetitions: number | null;
  duration_seconds: number | null;
  series: number;
  ordre: number;
  video_url?: string | null;
  video_file?: File | null;
}

interface SeanceFormData {
  id?: string;
  pathologies: string[];
  objectifs_principaux: string[];
  objectifs_secondaires: string[];
  exercices: SeanceExerciceItem[];
  author_name: string | null;
}

interface SeanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seance?: SeanceFormData | null;
  onSuccess: () => void;
}

export function SeanceFormDialog({ open, onOpenChange, seance, onSuccess }: SeanceFormDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userPseudo, setUserPseudo] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState<number | null>(null);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  
  // Available options
  const [availablePathologies, setAvailablePathologies] = useState<string[]>([]);
  const [availableObjectifsPrincipaux, setAvailableObjectifsPrincipaux] = useState<string[]>([]);
  const [availableObjectifsSecondaires, setAvailableObjectifsSecondaires] = useState<string[]>([]);
  const [availableExercices, setAvailableExercices] = useState<Exercice[]>([]);
  
  // Form state
  const [pathologies, setPathologies] = useState<string[]>([]);
  const [objectifsPrincipaux, setObjectifsPrincipaux] = useState<string[]>([]);
  const [objectifsSecondaires, setObjectifsSecondaires] = useState<string[]>([]);
  const [exercices, setExercices] = useState<SeanceExerciceItem[]>([]);
  
  // New item inputs
  const [newPathologie, setNewPathologie] = useState("");
  const [newObjectifPrincipal, setNewObjectifPrincipal] = useState("");
  const [newObjectifSecondaire, setNewObjectifSecondaire] = useState("");

  useEffect(() => {
    if (open && user) {
      fetchOptions();
      if (seance) {
        setPathologies(seance.pathologies || []);
        setObjectifsPrincipaux(seance.objectifs_principaux || []);
        setObjectifsSecondaires(seance.objectifs_secondaires || []);
        setExercices(seance.exercices || []);
      } else {
        resetForm();
      }
    }
  }, [open, user, seance]);

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

    // Fetch objectifs
    const { data: objData } = await supabase
      .from("objectifs")
      .select("name, type")
      .eq("user_id", user.id);
    
    const principaux = objData?.filter(o => o.type === "principal").map(o => o.name) || [];
    const secondaires = objData?.filter(o => o.type === "secondaire").map(o => o.name) || [];
    setAvailableObjectifsPrincipaux([...new Set(principaux)]);
    setAvailableObjectifsSecondaires([...new Set(secondaires)]);

    // Fetch exercices (only user's own exercices)
    const { data: exData } = await supabase
      .from("exercices")
      .select("id, title, description, video_url, thumbnail_url")
      .eq("user_id", user.id)
      .order("title");
    setAvailableExercices(exData || []);
  };

  const resetForm = () => {
    setPathologies([]);
    setObjectifsPrincipaux([]);
    setObjectifsSecondaires([]);
    setExercices([]);
    setNewPathologie("");
    setNewObjectifPrincipal("");
    setNewObjectifSecondaire("");
  };

  const addPathologie = (value: string) => {
    if (value && !pathologies.includes(value)) {
      setPathologies([...pathologies, value]);
    }
    setNewPathologie("");
  };

  const addObjectifPrincipal = (value: string) => {
    if (value && !objectifsPrincipaux.includes(value)) {
      setObjectifsPrincipaux([...objectifsPrincipaux, value]);
    }
    setNewObjectifPrincipal("");
  };

  const addObjectifSecondaire = (value: string) => {
    if (value && !objectifsSecondaires.includes(value)) {
      setObjectifsSecondaires([...objectifsSecondaires, value]);
    }
    setNewObjectifSecondaire("");
  };

  const addExercice = () => {
    setExercices([
      ...exercices,
      {
        exercice_id: null,
        name: "",
        description: "",
        repetitions: null,
        duration_seconds: null,
        series: 1,
        ordre: exercices.length,
        video_url: null,
        video_file: null
      }
    ]);
  };

  const handleVideoUpload = async (index: number, file: File) => {
    if (!user) return;
    
    setUploadingVideo(index);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);
      
      const updated = [...exercices];
      updated[index] = { ...updated[index], video_url: publicUrl, video_file: null };
      setExercices(updated);
      
      toast.success("Vidéo uploadée avec succès");
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error("Erreur lors de l'upload de la vidéo");
    } finally {
      setUploadingVideo(null);
    }
  };

  const removeVideo = (index: number) => {
    const updated = [...exercices];
    updated[index] = { ...updated[index], video_url: null, video_file: null };
    setExercices(updated);
  };

  const updateExercice = (index: number, field: keyof SeanceExerciceItem, value: any) => {
    const updated = [...exercices];
    updated[index] = { ...updated[index], [field]: value };
    
    // If selecting an existing exercice, populate name, description and video_url
    if (field === "exercice_id" && value) {
      const selectedEx = availableExercices.find(e => e.id === value);
      if (selectedEx) {
        updated[index].name = selectedEx.title;
        updated[index].description = selectedEx.description || "";
        updated[index].video_url = selectedEx.video_url || null;
      }
    }
    
    // If switching to custom, clear the video_url from the linked exercise
    if (field === "exercice_id" && !value) {
      updated[index].video_url = null;
    }
    
    setExercices(updated);
  };

  const removeExercice = (index: number) => {
    const updated = exercices.filter((_, i) => i !== index);
    // Update ordre
    updated.forEach((ex, i) => ex.ordre = i);
    setExercices(updated);
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (pathologies.length === 0) {
      toast.error("Au moins une pathologie est requise");
      return;
    }

    if (objectifsPrincipaux.length === 0) {
      toast.error("Au moins un objectif principal est requis");
      return;
    }

    setLoading(true);
    try {
      // Save new pathologies
      for (const patho of pathologies) {
        if (!availablePathologies.includes(patho)) {
          await supabase.from("pathologies").insert({ user_id: user.id, name: patho });
        }
      }

      // Save new objectifs principaux
      for (const obj of objectifsPrincipaux) {
        if (!availableObjectifsPrincipaux.includes(obj)) {
          await supabase.from("objectifs").insert({ user_id: user.id, name: obj, type: "principal" });
        }
      }

      // Save new objectifs secondaires
      for (const obj of objectifsSecondaires) {
        if (!availableObjectifsSecondaires.includes(obj)) {
          await supabase.from("objectifs").insert({ user_id: user.id, name: obj, type: "secondaire" });
        }
      }

      if (seance?.id) {
        // Update existing seance
        const { error: updateError } = await supabase
          .from("seance_types")
          .update({
            pathologies,
            objectifs_principaux: objectifsPrincipaux,
            objectifs_secondaires: objectifsSecondaires,
            // Keep legacy fields for backward compatibility
            pathologie: pathologies[0] || "",
            objectif_principal: objectifsPrincipaux[0] || "",
            objectif_secondaire: objectifsSecondaires[0] || null
          })
          .eq("id", seance.id);

        if (updateError) throw updateError;

        // Delete old exercices
        await supabase.from("seance_exercices").delete().eq("seance_type_id", seance.id);

        // Insert new exercices - create new exercice in exercices table if custom
        for (const ex of exercices) {
          let exerciceId = ex.exercice_id;
          
          // If it's a custom exercice (no exercice_id) and has a name, create it in the exercices table
          if (!exerciceId && ex.name && ex.name.trim()) {
            const { data: newExercice, error: exerciceError } = await supabase
              .from("exercices")
              .insert({
                user_id: user.id,
                title: ex.name.trim(),
                description: ex.description?.trim() || null,
                status: "draft",
                pathologie_tags: [],
                video_url: ex.video_url || null,
                author_name: userPseudo
              })
              .select()
              .single();
            
            if (exerciceError) {
              console.error("Error creating exercice:", exerciceError);
            } else if (newExercice) {
              exerciceId = newExercice.id;
            }
          }
          
          await supabase.from("seance_exercices").insert({
            seance_type_id: seance.id,
            exercice_id: exerciceId,
            name: ex.name,
            description: ex.description,
            repetitions: ex.repetitions,
            duration_seconds: ex.duration_seconds,
            series: ex.series,
            ordre: ex.ordre
          });
        }

        toast.success("Séance modifiée avec succès");
      } else {
        // Create new seance
        const { data: newSeance, error: insertError } = await supabase
          .from("seance_types")
          .insert({
            user_id: user.id,
            pathologies,
            objectifs_principaux: objectifsPrincipaux,
            objectifs_secondaires: objectifsSecondaires,
            // Legacy fields
            pathologie: pathologies[0] || "",
            objectif_principal: objectifsPrincipaux[0] || "",
            objectif_secondaire: objectifsSecondaires[0] || null,
            author_name: userPseudo,
            is_shared: false,
            is_copy: false
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert exercices - create new exercice in exercices table if custom
        for (const ex of exercices) {
          let exerciceId = ex.exercice_id;
          
          // If it's a custom exercice (no exercice_id) and has a name, create it in the exercices table
          if (!exerciceId && ex.name && ex.name.trim()) {
            const { data: newExercice, error: exerciceError } = await supabase
              .from("exercices")
              .insert({
                user_id: user.id,
                title: ex.name.trim(),
                description: ex.description?.trim() || null,
                status: "draft",
                pathologie_tags: [],
                video_url: ex.video_url || null,
                author_name: userPseudo
              })
              .select()
              .single();
            
            if (exerciceError) {
              console.error("Error creating exercice:", exerciceError);
            } else if (newExercice) {
              exerciceId = newExercice.id;
            }
          }
          
          await supabase.from("seance_exercices").insert({
            seance_type_id: newSeance.id,
            exercice_id: exerciceId,
            name: ex.name,
            description: ex.description,
            repetitions: ex.repetitions,
            duration_seconds: ex.duration_seconds,
            series: ex.series,
            ordre: ex.ordre
          });
        }

        toast.success("Séance créée avec succès");
      }

      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error saving seance:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{seance?.id ? "Modifier la séance" : "Nouvelle séance"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Pathologies */}
          <div className="space-y-2">
            <Label>Pathologies *</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {pathologies.map((p, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {p}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setPathologies(pathologies.filter((_, idx) => idx !== i))} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Select onValueChange={addPathologie}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Sélectionner une pathologie" />
                </SelectTrigger>
                <SelectContent>
                  {availablePathologies.filter(p => !pathologies.includes(p)).map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Ou créer une nouvelle..."
                value={newPathologie}
                onChange={(e) => setNewPathologie(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPathologie(newPathologie)}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => addPathologie(newPathologie)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Objectifs Principaux */}
          <div className="space-y-2">
            <Label>Objectifs principaux *</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {objectifsPrincipaux.map((o, i) => (
                <Badge key={i} variant="default" className="gap-1">
                  {o}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setObjectifsPrincipaux(objectifsPrincipaux.filter((_, idx) => idx !== i))} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Select onValueChange={addObjectifPrincipal}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Sélectionner un objectif" />
                </SelectTrigger>
                <SelectContent>
                  {availableObjectifsPrincipaux.filter(o => !objectifsPrincipaux.includes(o)).map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Ou créer un nouveau..."
                value={newObjectifPrincipal}
                onChange={(e) => setNewObjectifPrincipal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addObjectifPrincipal(newObjectifPrincipal)}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => addObjectifPrincipal(newObjectifPrincipal)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Objectifs Secondaires */}
          <div className="space-y-2">
            <Label>Objectifs secondaires</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {objectifsSecondaires.map((o, i) => (
                <Badge key={i} variant="outline" className="gap-1">
                  {o}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setObjectifsSecondaires(objectifsSecondaires.filter((_, idx) => idx !== i))} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Select onValueChange={addObjectifSecondaire}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Sélectionner un objectif" />
                </SelectTrigger>
                <SelectContent>
                  {availableObjectifsSecondaires.filter(o => !objectifsSecondaires.includes(o)).map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Ou créer un nouveau..."
                value={newObjectifSecondaire}
                onChange={(e) => setNewObjectifSecondaire(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addObjectifSecondaire(newObjectifSecondaire)}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => addObjectifSecondaire(newObjectifSecondaire)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Exercices */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Exercices</Label>
              <Button type="button" variant="outline" size="sm" onClick={addExercice} className="gap-1">
                <Plus className="w-4 h-4" />
                Ajouter un exercice
              </Button>
            </div>

            <div className="space-y-3">
              {exercices.map((ex, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GripVertical className="w-4 h-4" />
                        <span className="text-sm font-medium">{index + 1}</span>
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Exercice existant</Label>
                            <Select
                              value={ex.exercice_id || "custom"}
                              onValueChange={(v) => updateExercice(index, "exercice_id", v === "custom" ? null : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner ou créer" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="custom">Personnalisé</SelectItem>
                                {availableExercices.map(e => (
                                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-xs">Nom</Label>
                            <Input
                              value={ex.name}
                              onChange={(e) => updateExercice(index, "name", e.target.value)}
                              placeholder="Nom de l'exercice"
                              disabled={!!ex.exercice_id}
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={ex.description}
                            onChange={(e) => updateExercice(index, "description", e.target.value)}
                            placeholder="Description optionnelle"
                          />
                        </div>

                        {/* Video section */}
                        <div className="space-y-2">
                          <Label className="text-xs">Vidéo</Label>
                          {ex.video_url ? (
                            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                              <Video className="w-4 h-4 text-primary" />
                              <span className="text-sm flex-1 truncate">Vidéo ajoutée</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => fileInputRefs.current[index]?.click()}
                                className="h-6 px-2"
                                disabled={uploadingVideo === index}
                              >
                                {uploadingVideo === index ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Pencil className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeVideo(index)}
                                className="h-6 px-2"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                              <input
                                type="file"
                                accept="video/*"
                                ref={(el) => { fileInputRefs.current[index] = el; }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleVideoUpload(index, file);
                                }}
                                className="hidden"
                              />
                            </div>
                          ) : (
                            <div>
                              <input
                                type="file"
                                accept="video/*"
                                ref={(el) => { fileInputRefs.current[index] = el; }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleVideoUpload(index, file);
                                }}
                                className="hidden"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRefs.current[index]?.click()}
                                disabled={uploadingVideo === index}
                                className="gap-2"
                              >
                                {uploadingVideo === index ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Upload en cours...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4" />
                                    Ajouter une vidéo
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Répétitions</Label>
                            <Input
                              type="number"
                              value={ex.repetitions || ""}
                              onChange={(e) => updateExercice(index, "repetitions", e.target.value ? parseInt(e.target.value) : null)}
                              placeholder="Ex: 10"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Durée (sec)</Label>
                            <Input
                              type="number"
                              value={ex.duration_seconds || ""}
                              onChange={(e) => updateExercice(index, "duration_seconds", e.target.value ? parseInt(e.target.value) : null)}
                              placeholder="Ex: 30"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Séries</Label>
                            <Input
                              type="number"
                              value={ex.series}
                              onChange={(e) => updateExercice(index, "series", parseInt(e.target.value) || 1)}
                              min={1}
                            />
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeExercice(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {exercices.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun exercice ajouté. Cliquez sur "Ajouter un exercice" pour commencer.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Enregistrement..." : seance?.id ? "Modifier" : "Créer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
