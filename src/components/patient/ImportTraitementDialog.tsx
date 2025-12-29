import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, Search, ChevronDown, ChevronRight, Play } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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

interface TraitementSeance {
  id: string;
  ordre: number;
  seance_type: {
    id: string;
    pathologie: string;
    pathologies: string[] | null;
    objectif_principal: string;
    objectifs_principaux: string[] | null;
  };
}

interface TraitementType {
  id: string;
  pathologie: string;
  description: string | null;
  author_name: string | null;
  is_shared: boolean;
  is_validated: boolean | null;
  user_id: string;
}

interface ImportTraitementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (traitementId: string) => void;
}

export function ImportTraitementDialog({
  open,
  onOpenChange,
  onSelect,
}: ImportTraitementDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [traitements, setTraitements] = useState<TraitementType[]>([]);
  const [userPseudo, setUserPseudo] = useState<string | null>(null);
  
  const [expandedTraitements, setExpandedTraitements] = useState<Set<string>>(new Set());
  const [seancesMap, setSeancesMap] = useState<Record<string, TraitementSeance[]>>({});
  const [loadingSeances, setLoadingSeances] = useState<Set<string>>(new Set());
  
  const [expandedSeances, setExpandedSeances] = useState<Set<string>>(new Set());
  const [exercicesMap, setExercicesMap] = useState<Record<string, SeanceExercice[]>>({});
  const [loadingExercices, setLoadingExercices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && user) {
      fetchTraitements();
      fetchUserPseudo();
      setExpandedTraitements(new Set());
      setSeancesMap({});
      setExpandedSeances(new Set());
      setExercicesMap({});
    }
  }, [open, user]);

  const fetchUserPseudo = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("user_id", user.id)
      .maybeSingle();
    setUserPseudo(data?.pseudo || null);
  };

  const fetchTraitements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("traitement_types")
      .select("id, pathologie, description, author_name, is_shared, is_validated, user_id")
      .eq("is_hidden_from_list", false)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTraitements(data);
    }
    setLoading(false);
  };

  const fetchSeancesForTraitement = async (traitementId: string) => {
    if (seancesMap[traitementId]) return;
    
    setLoadingSeances(prev => new Set(prev).add(traitementId));
    
    const { data, error } = await supabase
      .from("traitement_seances")
      .select(`
        id,
        ordre,
        seance_type:seance_types(id, pathologie, pathologies, objectif_principal, objectifs_principaux)
      `)
      .eq("traitement_type_id", traitementId)
      .order("ordre", { ascending: true });

    if (!error && data) {
      setSeancesMap(prev => ({ ...prev, [traitementId]: data as TraitementSeance[] }));
    }
    
    setLoadingSeances(prev => {
      const next = new Set(prev);
      next.delete(traitementId);
      return next;
    });
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

  const toggleTraitement = (traitementId: string) => {
    setExpandedTraitements(prev => {
      const next = new Set(prev);
      if (next.has(traitementId)) {
        next.delete(traitementId);
      } else {
        next.add(traitementId);
        fetchSeancesForTraitement(traitementId);
      }
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

  const filteredTraitements = traitements.filter((t) => {
    const searchLower = search.toLowerCase();
    return (
      t.pathologie.toLowerCase().includes(searchLower) ||
      (t.description?.toLowerCase().includes(searchLower) || false)
    );
  });

  const myTraitements = filteredTraitements.filter(
    (t) => t.user_id === user?.id
  );
  const sharedTraitements = filteredTraitements.filter(
    (t) => t.is_shared && t.is_validated && t.user_id !== user?.id
  );

  const handleSelectTraitement = async (traitement: TraitementType) => {
    if (!user) return;
    setCopying(true);

    try {
      const { data: newTraitement, error: traitementError } = await supabase
        .from("traitement_types")
        .insert({
          user_id: user.id,
          pathologie: traitement.pathologie,
          description: traitement.description,
          author_name: userPseudo || traitement.author_name,
          is_shared: false,
          is_copy: true,
          is_hidden_from_list: true,
          original_id: traitement.id
        })
        .select()
        .single();

      if (traitementError) throw traitementError;

      const { data: testsData } = await supabase
        .from("traitement_tests")
        .select("*")
        .eq("traitement_type_id", traitement.id)
        .order("ordre", { ascending: true });

      if (testsData && testsData.length > 0) {
        for (const test of testsData) {
          await supabase.from("traitement_tests").insert({
            traitement_type_id: newTraitement.id,
            description: test.description,
            exercice_id: test.exercice_id,
            ordre: test.ordre
          });
        }
      }

      const { data: seancesData } = await supabase
        .from("traitement_seances")
        .select("*")
        .eq("traitement_type_id", traitement.id)
        .order("ordre", { ascending: true });

      if (seancesData && seancesData.length > 0) {
        for (const seance of seancesData) {
          await supabase.from("traitement_seances").insert({
            traitement_type_id: newTraitement.id,
            seance_type_id: seance.seance_type_id,
            ordre: seance.ordre
          });
        }
      }

      toast.success("Traitement importé pour ce patient");
      onSelect(newTraitement.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error copying traitement:", error);
      toast.error("Erreur lors de l'importation du traitement");
    } finally {
      setCopying(false);
    }
  };

  const getSeanceTags = (seance: TraitementSeance["seance_type"]): string[] => {
    const tags: string[] = [];
    if (seance.pathologies?.length) tags.push(...seance.pathologies);
    else if (seance.pathologie) tags.push(seance.pathologie);
    if (seance.objectifs_principaux?.length) tags.push(...seance.objectifs_principaux);
    else if (seance.objectif_principal) tags.push(seance.objectif_principal);
    return tags;
  };

  const renderTraitementItem = (t: TraitementType) => {
    const isExpanded = expandedTraitements.has(t.id);
    const seances = seancesMap[t.id] || [];
    const isLoadingSeances = loadingSeances.has(t.id);

    return (
      <div key={t.id} className="border rounded-lg overflow-hidden">
        <div className="flex items-center">
          <Collapsible open={isExpanded} onOpenChange={() => toggleTraitement(t.id)} className="flex-1">
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
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{t.pathologie}</span>
                  {t.is_shared && t.is_validated && (
                    <Badge variant="secondary" className="text-xs">Validé</Badge>
                  )}
                </div>
                {t.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                )}
                {t.author_name && (
                  <span className="text-xs text-muted-foreground">Par {t.author_name}</span>
                )}
              </div>
              <Button
                size="sm"
                className="mr-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectTraitement(t);
                }}
                disabled={copying}
              >
                Importer
              </Button>
            </div>
            <CollapsibleContent>
              <div className="px-3 pb-3 border-t bg-muted/30">
                {isLoadingSeances ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : seances.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">Aucune séance</p>
                ) : (
                  <div className="space-y-2 pt-3">
                    {seances.map((seance, idx) => {
                      const seanceId = seance.seance_type.id;
                      const isSeanceExpanded = expandedSeances.has(seanceId);
                      const exercices = exercicesMap[seanceId] || [];
                      const isLoadingExercicesForSeance = loadingExercices.has(seanceId);
                      const tags = getSeanceTags(seance.seance_type);

                      return (
                        <Collapsible
                          key={seance.id}
                          open={isSeanceExpanded}
                          onOpenChange={() => toggleSeance(seanceId)}
                        >
                          <div className="rounded-md bg-background border">
                            <div className="flex items-center p-2">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-1 h-auto">
                                  {isSeanceExpanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                              <span className="text-xs font-medium text-muted-foreground w-5 ml-1">
                                {idx + 1}
                              </span>
                              <div className="flex-1 ml-2">
                                <div className="flex flex-wrap gap-1">
                                  {tags.slice(0, 2).map((tag, i) => (
                                    <Badge key={i} variant="outline" className="text-xs py-0">
                                      {tag}
                                    </Badge>
                                  ))}
                                  {tags.length > 2 && (
                                    <span className="text-xs text-muted-foreground">+{tags.length - 2}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <CollapsibleContent>
                              <div className="px-3 pb-3 border-t bg-muted/20">
                                {isLoadingExercicesForSeance ? (
                                  <div className="flex items-center justify-center py-3">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  </div>
                                ) : exercices.length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-2">Aucun exercice</p>
                                ) : (
                                  <div className="space-y-1 pt-2">
                                    {exercices.map((ex, exIdx) => (
                                      <div key={ex.id} className="flex items-center gap-2 p-1.5 rounded bg-background/50">
                                        <span className="text-xs text-muted-foreground w-4">{exIdx + 1}</span>
                                        {ex.exercice?.thumbnail_url ? (
                                          <img
                                            src={ex.exercice.thumbnail_url}
                                            alt=""
                                            className="w-8 h-8 rounded object-cover"
                                          />
                                        ) : (
                                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                            <Play className="w-3 h-3 text-muted-foreground" />
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium truncate">
                                            {ex.exercice?.title || "Exercice"}
                                          </p>
                                          <div className="flex gap-1 text-xs text-muted-foreground">
                                            {ex.series && <span>{ex.series}s</span>}
                                            {ex.repetitions && <span>{ex.repetitions}r</span>}
                                            {ex.duration_seconds && <span>{ex.duration_seconds}s</span>}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
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
          <DialogTitle>Importer un plan de traitement</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par pathologie ou description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading || copying ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
            {copying && <span className="ml-2 text-sm text-muted-foreground">Importation en cours...</span>}
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4 pr-2">
              {myTraitements.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-sm text-muted-foreground">
                    Mes traitements
                  </h4>
                  <div className="space-y-2">
                    {myTraitements.map(renderTraitementItem)}
                  </div>
                </div>
              )}

              {sharedTraitements.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-sm text-muted-foreground">
                    Traitements partagés
                  </h4>
                  <div className="space-y-2">
                    {sharedTraitements.map(renderTraitementItem)}
                  </div>
                </div>
              )}

              {filteredTraitements.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucun traitement trouvé
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
