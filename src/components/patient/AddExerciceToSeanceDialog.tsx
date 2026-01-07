import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Exercice {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  pathologie_tags: string[] | null;
}

interface AddExerciceToSeanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seanceTypeId: string;
  currentExercicesCount: number;
  onSuccess: () => void;
}

export function AddExerciceToSeanceDialog({
  open,
  onOpenChange,
  seanceTypeId,
  currentExercicesCount,
  onSuccess,
}: AddExerciceToSeanceDialogProps) {
  const { user } = useAuth();
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExercice, setSelectedExercice] = useState<Exercice | null>(null);
  const [series, setSeries] = useState(3);
  const [repetitions, setRepetitions] = useState<number | null>(10);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchExercices();
    }
  }, [open, user]);

  const fetchExercices = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("exercices")
      .select("id, title, description, thumbnail_url, video_url, pathologie_tags")
      .or(`user_id.eq.${user.id},status.eq.shared`)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setExercices(data);
    }
    setLoading(false);
  };

  const filteredExercices = exercices.filter((ex) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ex.title.toLowerCase().includes(query) ||
      ex.pathologie_tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const handleAddExercice = async () => {
    if (!selectedExercice || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("seance_exercices").insert({
        seance_type_id: seanceTypeId,
        exercice_id: selectedExercice.id,
        name: selectedExercice.title,
        series: series,
        repetitions: repetitions,
        duration_seconds: durationSeconds,
        ordre: currentExercicesCount + 1,
      });

      if (error) throw error;

      toast.success("Exercice ajouté");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error adding exercise:", error);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedExercice(null);
    setSeries(3);
    setRepetitions(10);
    setDurationSeconds(null);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Ajouter un exercice</DialogTitle>
        </DialogHeader>

        {!selectedExercice ? (
          <>
            {/* Search */}
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un exercice..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Exercices list */}
            <ScrollArea className="flex-1 px-4">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Chargement...
                </p>
              ) : filteredExercices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun exercice trouvé
                </p>
              ) : (
                <div className="space-y-2 pb-4">
                  {filteredExercices.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedExercice(ex)}
                    >
                      {/* Thumbnail */}
                      <div className="w-16 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                        {ex.thumbnail_url ? (
                          <img
                            src={ex.thumbnail_url}
                            alt={ex.title}
                            className="w-full h-full object-cover"
                          />
                        ) : ex.video_url ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-5 h-5 text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="w-full h-full bg-muted" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{ex.title}</p>
                        {ex.pathologie_tags && ex.pathologie_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ex.pathologie_tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <Plus className="w-5 h-5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          /* Configuration form */
          <div className="p-4 space-y-4">
            {/* Selected exercise preview */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-20 h-14 rounded overflow-hidden bg-muted flex-shrink-0">
                {selectedExercice.thumbnail_url ? (
                  <img
                    src={selectedExercice.thumbnail_url}
                    alt={selectedExercice.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{selectedExercice.title}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2 mt-1"
                  onClick={() => setSelectedExercice(null)}
                >
                  Changer
                </Button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Séries</Label>
                <Input
                  type="number"
                  min={1}
                  value={series}
                  onChange={(e) => setSeries(parseInt(e.target.value) || 1)}
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-xs">Répétitions</Label>
                <Input
                  type="number"
                  min={0}
                  value={repetitions || ""}
                  onChange={(e) =>
                    setRepetitions(e.target.value ? parseInt(e.target.value) : null)
                  }
                  className="h-10"
                  placeholder="—"
                />
              </div>
              <div>
                <Label className="text-xs">Durée (sec)</Label>
                <Input
                  type="number"
                  min={0}
                  value={durationSeconds || ""}
                  onChange={(e) =>
                    setDurationSeconds(e.target.value ? parseInt(e.target.value) : null)
                  }
                  className="h-10"
                  placeholder="—"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedExercice(null)}
              >
                Retour
              </Button>
              <Button className="flex-1" onClick={handleAddExercice} disabled={saving}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
