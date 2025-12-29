import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, Search, ChevronDown, ChevronRight, Play } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SeanceExercice {
  id: string;
  ordre: number;
  series: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  exercice?: {
    id: string;
    title: string;
    thumbnail_url: string | null;
  } | null;
}

interface SeanceType {
  id: string;
  pathologie: string;
  pathologies: string[] | null;
  objectif_principal: string;
  objectifs_principaux: string[] | null;
  author_name: string | null;
  is_shared: boolean;
  is_validated: boolean | null;
  user_id: string;
}

interface ImportSeanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (seanceTypeId: string) => void;
}

export function ImportSeanceDialog({
  open,
  onOpenChange,
  onSelect,
}: ImportSeanceDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [seances, setSeances] = useState<SeanceType[]>([]);
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());
  const [exercicesMap, setExercicesMap] = useState<Record<string, SeanceExercice[]>>({});
  const [loadingExercices, setLoadingExercices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && user) {
      fetchSeances();
      setExpandedSeances(new Set());
      setExercicesMap({});
    }
  }, [open, user]);

  const fetchSeances = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("seance_types")
      .select("id, pathologie, pathologies, objectif_principal, objectifs_principaux, author_name, is_shared, is_validated, user_id")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSeances(data);
    }
    setLoading(false);
  };

  const fetchExercicesForSeance = async (seanceId: string) => {
    if (exercicesMap[seanceId]) return;
    
    setLoadingExercices(prev => new Set(prev).add(seanceId));
    
    const { data, error } = await supabase
      .from("seance_exercices")
      .select(`
        id,
        ordre,
        series,
        repetitions,
        duration_seconds,
        exercice:exercices(id, title, thumbnail_url)
      `)
      .eq("seance_type_id", seanceId)
      .order("ordre", { ascending: true });

    if (!error && data) {
      setExercicesMap(prev => ({ ...prev, [seanceId]: data }));
    }
    
    setLoadingExercices(prev => {
      const next = new Set(prev);
      next.delete(seanceId);
      return next;
    });
  };

  const toggleSeance = (seanceId: string) => {
    setExpandedSeances(prev => {
      const next = new Set(prev);
      if (next.has(seanceId)) {
        next.delete(seanceId);
      } else {
        next.add(seanceId);
        fetchExercicesForSeance(seanceId);
      }
      return next;
    });
  };

  const getAllTags = (s: SeanceType): string[] => {
    const tags: string[] = [];
    if (s.pathologies?.length) tags.push(...s.pathologies);
    else if (s.pathologie) tags.push(s.pathologie);
    if (s.objectifs_principaux?.length) tags.push(...s.objectifs_principaux);
    else if (s.objectif_principal) tags.push(s.objectif_principal);
    return tags;
  };

  const filteredSeances = seances.filter((s) => {
    const searchLower = search.toLowerCase();
    const tags = getAllTags(s);
    return (
      s.pathologie.toLowerCase().includes(searchLower) ||
      s.objectif_principal.toLowerCase().includes(searchLower) ||
      tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  });

  const mySeances = filteredSeances.filter((s) => s.user_id === user?.id);
  const sharedSeances = filteredSeances.filter((s) => s.is_shared && s.is_validated && s.user_id !== user?.id);

  const renderSeanceItem = (s: SeanceType) => {
    const isExpanded = expandedSeances.has(s.id);
    const exercices = exercicesMap[s.id] || [];
    const isLoadingExercices = loadingExercices.has(s.id);
    const tags = getAllTags(s);

    return (
      <div key={s.id} className="border rounded-lg overflow-hidden">
        <div className="flex items-center">
          <Collapsible open={isExpanded} onOpenChange={() => toggleSeance(s.id)} className="flex-1">
            <div className="flex items-center">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2 h-auto">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <div className="flex-1 py-3 pr-3">
                <div className="flex flex-wrap items-center gap-1 mb-1">
                  {tags.slice(0, 3).map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
                  )}
                </div>
                {s.author_name && (
                  <span className="text-xs text-muted-foreground">Par {s.author_name}</span>
                )}
              </div>
              <Button
                size="sm"
                className="mr-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(s.id);
                  onOpenChange(false);
                }}
              >
                Importer
              </Button>
            </div>
            <CollapsibleContent>
              <div className="px-3 pb-3 border-t bg-muted/30">
                {isLoadingExercices ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : exercices.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">Aucun exercice</p>
                ) : (
                  <div className="space-y-2 pt-3">
                    {exercices.map((ex, idx) => (
                      <div key={ex.id} className="flex items-center gap-3 p-2 rounded-md bg-background">
                        <span className="text-xs font-medium text-muted-foreground w-5">
                          {idx + 1}
                        </span>
                        {ex.exercice?.thumbnail_url ? (
                          <img
                            src={ex.exercice.thumbnail_url}
                            alt=""
                            className="w-12 h-12 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                            <Play className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {ex.exercice?.title || "Exercice"}
                          </p>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {ex.series && <span>{ex.series} séries</span>}
                            {ex.repetitions && <span>{ex.repetitions} rép</span>}
                            {ex.duration_seconds && <span>{ex.duration_seconds}s</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer une séance</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre, pathologie ou objectif..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4 pr-2">
              {mySeances.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-sm text-muted-foreground">
                    Mes séances
                  </h4>
                  <div className="space-y-2">
                    {mySeances.map(renderSeanceItem)}
                  </div>
                </div>
              )}

              {sharedSeances.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-sm text-muted-foreground">
                    Séances partagées
                  </h4>
                  <div className="space-y-2">
                    {sharedSeances.map(renderSeanceItem)}
                  </div>
                </div>
              )}

              {filteredSeances.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucune séance trouvée
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
