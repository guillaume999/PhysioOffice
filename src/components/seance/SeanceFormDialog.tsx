import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCreatableSelect } from "./SearchableCreatableSelect";
import { TagReferenceSelect } from "@/components/tags/TagReferenceSelect";
import { Plus, X, GripVertical, Trash2, Upload, Video, Loader2, Pencil, Calendar } from "lucide-react";
import { MediaThumb } from "@/components/MediaThumb";
import { format } from "date-fns";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Exercice {
  id: string;
  code: string;
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
  series: number | null;
  ordre: number;
  video_url?: string | null;
  thumbnail_url?: string | null;
  video_file?: File | null;
}

interface SeanceFormData {
  id?: string;
  pathologies: string[];
  objectifs?: string[];
  objectifs_principaux: string[];
  objectifs_secondaires?: string[];
  exercices: SeanceExerciceItem[];
  author_name: string | null;
}

interface SeanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seance?: SeanceFormData | null;
  onSuccess: (seanceDate?: string, newSeanceId?: string) => void;
  initialDate?: string;
  showDateField?: boolean;
  initialPathologies?: string[];
  hiddenFromListByDefault?: boolean;
}

export function SeanceFormDialog({ open, onOpenChange, seance, onSuccess, initialDate, showDateField = false, initialPathologies, hiddenFromListByDefault = false }: SeanceFormDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userPseudo, setUserPseudo] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState<number | null>(null);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  
  // Available options
  const [availablePathologies, setAvailablePathologies] = useState<string[]>([]);
  const [availableObjectifs, setAvailableObjectifs] = useState<string[]>([]);
  const [availableExercices, setAvailableExercices] = useState<Exercice[]>([]);

  // Form state
  const [pathologies, setPathologies] = useState<string[]>([]);
  const [objectifs, setObjectifs] = useState<string[]>([]);
  const [exercices, setExercices] = useState<SeanceExerciceItem[]>([]);
  const [seanceDate, setSeanceDate] = useState<string>("");

  // New item inputs
  const [newPathologie, setNewPathologie] = useState("");
  const [newObjectif, setNewObjectif] = useState("");

  useEffect(() => {
    if (open && user) {
      fetchOptions();
      if (seance) {
        setPathologies(seance.pathologies || []);
        // Nouveau champ unifié `objectifs`, fallback sur principaux + secondaires (dédupliqués)
        const merged = seance.objectifs?.length
          ? seance.objectifs
          : [
              ...(seance.objectifs_principaux || []),
              ...(seance.objectifs_secondaires || []),
            ];
        setObjectifs([...new Set(merged.filter(Boolean))]);
        setExercices(seance.exercices || []);
      } else {
        resetForm();
        // Pre-fill pathologies from initialPathologies if provided
        if (initialPathologies && initialPathologies.length > 0) {
          setPathologies(initialPathologies);
        }
      }
      // Set date
      if (showDateField) {
        setSeanceDate(initialDate || format(new Date(), 'yyyy-MM-dd'));
      }
    }
  }, [open, user, seance, initialDate, showDateField, initialPathologies]);

  const fetchOptions = async () => {
    if (!user) return;

    // Fetch user pseudo
    setUserPseudo(pb.authStore.record?.pseudo || pb.authStore.record?.name || pb.authStore.record?.email || null);

    // Fetch pathologies
    const pathoData = await pb.collection("pathologies").getFullList({ filter: `user = "${user.id}"`, fields: "name" });
    setAvailablePathologies([...new Set(pathoData.map((p: any) => p.name as string))]);

    // Fetch objectifs (tous types confondus)
    const objData = await pb.collection("objectifs").getFullList({ filter: `user = "${user.id}"`, fields: "name" });
    const objNames = (objData as any[]).map((o: any) => o.name as string).filter(Boolean);
    setAvailableObjectifs([...new Set(objNames)]);

    // Fetch exercices (only user's own exercices)
    const exData = await pb.collection("exercices").getFullList({
      filter: `user = "${user.id}"`, sort: "title",
      fields: "id,code,title,description,video_url,thumbnail_url",
    });
    setAvailableExercices(exData as unknown as Exercice[]);
  };

  const resetForm = () => {
    setPathologies([]);
    setObjectifs([]);
    setExercices([]);
    setNewPathologie("");
    setNewObjectif("");
  };

  const addPathologie = (value: string) => {
    if (value && !pathologies.includes(value)) {
      setPathologies([...pathologies, value]);
    }
    setNewPathologie("");
  };

  const addObjectif = (value: string) => {
    if (value && !objectifs.includes(value)) {
      setObjectifs([...objectifs, value]);
    }
    setNewObjectif("");
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
        series: null,
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
      
      const vfd = new FormData();
      vfd.append("file", file);
      vfd.append("user", user.id);
      const vRec = await pb.collection("exercice_videos").create(vfd);
      const publicUrl = pb.files.getURL(vRec, vRec.file as string);
      
      const updated = [...exercices];
      updated[index] = { ...updated[index], video_url: publicUrl, thumbnail_url: null, video_file: null };
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
    updated[index] = { ...updated[index], video_url: null, thumbnail_url: null, video_file: null };
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
        updated[index].thumbnail_url = selectedEx.thumbnail_url || null;
      }
    }

    // If switching to custom, clear the video_url from the linked exercise
    if (field === "exercice_id" && !value) {
      updated[index].video_url = null;
      updated[index].thumbnail_url = null;
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

    setLoading(true);
    try {
      // Save new pathologies
      for (const patho of pathologies) {
        if (!availablePathologies.includes(patho)) {
          await pb.collection("pathologies").create({ user: user.id, name: patho });
        }
      }

      // Save new objectifs (unifiés, type = principal par défaut)
      for (const obj of objectifs) {
        if (!availableObjectifs.includes(obj)) {
          await pb.collection("objectifs").create({ user: user.id, name: obj, type: "principal" });
        }
      }

      if (seance?.id) {
        // Update existing seance
        await pb.collection("seance_types").update(seance.id, {
            nom: pathologies[0] || objectifs[0] || "Séance",
            pathologies,
            objectifs,
            objectifs_principaux: objectifs,
            objectifs_secondaires: [],
            pathologie: pathologies[0] || "",
            objectif_principal: objectifs[0] || "",
            objectif_secondaire: null,
          });

        // Delete old exercices
        const oldEx = await pb.collection("seance_exercices").getFullList({ filter: `seance_type = "${seance.id}"` });
        for (const e of oldEx) await pb.collection("seance_exercices").delete(e.id);

        // Insert new exercices - create new exercice in exercices table if custom
        for (const ex of exercices) {
          let exerciceId = ex.exercice_id;
          
          // If it's a custom exercice (no exercice_id) and has a name, create it in the exercices table
          if (!exerciceId && ex.name && ex.name.trim()) {
            try {
              const newExercice = await pb.collection("exercices").create({
                user: user.id,
                title: ex.name.trim(),
                description: ex.description?.trim() || null,
                status: "draft",
                pathologie_tags: [],
                video_url: ex.video_url || null,
                author_name: userPseudo,
              });
              exerciceId = newExercice.id;
            } catch(e) { console.error("Error creating exercice:", e); }
          }
          
          await pb.collection("seance_exercices").create({
            seance_type: seance.id,
            exercice: exerciceId,
            name: ex.name,
            description: ex.description,
            repetitions: ex.repetitions,
            duration_seconds: ex.duration_seconds,
            series: ex.series,
            ordre: ex.ordre,
          });
        }

        toast.success("Séance modifiée avec succès");
      } else {
        // Create new seance
        var newSeance: { id: string } | null = null;
        newSeance = await pb.collection("seance_types").create({
            user: user.id,
            nom: pathologies[0] || objectifs[0] || "Séance",
            pathologies,
            objectifs,
            objectifs_principaux: objectifs,
            objectifs_secondaires: [],
            pathologie: pathologies[0] || "",
            objectif_principal: objectifs[0] || "",
            objectif_secondaire: null,
            author_name: userPseudo,
            is_shared: false,
            is_copy: false,
            is_hidden_from_list: hiddenFromListByDefault,
          });

        // Insert exercices - create new exercice in exercices table if custom
        for (const ex of exercices) {
          let exerciceId = ex.exercice_id;
          
          // If it's a custom exercice (no exercice_id) and has a name, create it in the exercices table
          if (!exerciceId && ex.name && ex.name.trim()) {
            try {
              const newExercice = await pb.collection("exercices").create({
                user: user.id,
                title: ex.name.trim(),
                description: ex.description?.trim() || null,
                status: "draft",
                pathologie_tags: [],
                video_url: ex.video_url || null,
                author_name: userPseudo,
              });
              exerciceId = newExercice.id;
            } catch(e) { console.error("Error creating exercice:", e); }
          }
          
          await pb.collection("seance_exercices").create({
            seance_type: newSeance!.id,
            exercice: exerciceId,
            name: ex.name,
            description: ex.description,
            repetitions: ex.repetitions,
            duration_seconds: ex.duration_seconds,
            series: ex.series,
            ordre: ex.ordre,
          });
        }

        toast.success("Séance créée avec succès");
      }

      onOpenChange(false);
      resetForm();
      onSuccess(showDateField ? seanceDate : undefined, seance?.id ? undefined : (newSeance?.id as string | undefined));
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
          {/* Date field - only shown when showDateField is true */}
          {showDateField && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date de la séance
              </Label>
              <Input
                type="date"
                value={seanceDate}
                onChange={(e) => setSeanceDate(e.target.value)}
                className="w-48"
              />
            </div>
          )}

          {/* Pathologies */}
          <div className="space-y-2">
            <Label>Pathologies</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {pathologies.map((p, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {p}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setPathologies(pathologies.filter((_, idx) => idx !== i))} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <TagReferenceSelect
                type="pathologie"
                options={availablePathologies.filter((p) => !pathologies.includes(p))}
                userId={user?.id || ""}
                onSelect={addPathologie}
                onReferenceChanged={fetchOptions}
                placeholder="Rechercher une pathologie"
                className="flex-1"
              />
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

          {/* Objectifs */}
          <div className="space-y-2">
            <Label>Objectifs</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {objectifs.map((o, i) => (
                <Badge key={i} variant="default" className="gap-1">
                  {o}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setObjectifs(objectifs.filter((_, idx) => idx !== i))} />
                </Badge>
              ))}
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
                                  <SelectItem key={e.id} value={e.id}>
                                    <span className="flex items-center gap-2">
                                      {e.thumbnail_url ? (
                                        <img
                                          src={e.thumbnail_url}
                                          alt={e.title}
                                          className="w-10 h-7 object-cover rounded flex-shrink-0"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <span className="w-10 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                          <Video className="w-3.5 h-3.5 text-muted-foreground/60" />
                                        </span>
                                      )}
                                      <span className="font-mono text-xs uppercase text-muted-foreground">{e.code}</span>
                                      <span className="truncate">{e.title}</span>
                                    </span>
                                  </SelectItem>
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
                              <MediaThumb
                                source={{ video_url: ex.video_url, thumbnail_url: ex.thumbnail_url }}
                                alt={ex.name || "Vidéo de l'exercice"}
                                className="w-16 h-10"
                                showPlayIcon
                              />
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
                              value={ex.series ?? ""}
                              onChange={(e) => updateExercice(index, "series", e.target.value ? parseInt(e.target.value) : null)}
                              placeholder="—"
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
