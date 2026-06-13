import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Shield, User as UserIcon, Loader2 } from "lucide-react";
import { MediaThumb } from "@/components/MediaThumb";
import { pb } from "@/integrations/pocketbase/client";
import type { ExercicePreview } from "@/components/exercice/ExercicePreviewDialog";

interface SeanceBlock {
  id: string;
  label: string;
  exercices: ExercicePreview[];
}

interface Props {
  id: string;
  nom: string;
  isPlatform: boolean;
  onOpenExercice: (ex: ExercicePreview) => void;
}

function toExercice(e: any): ExercicePreview {
  return {
    id: e.id,
    code: e.code || "",
    title: e.title || "Sans titre",
    description: e.description || null,
    video_url: e.video_url || null,
    thumbnail_url: e.thumbnail_url || null,
    image_url: e.image_url || null,
    media_type: e.media_type || null,
    pathologie_tags: Array.isArray(e.pathologie_tags) ? e.pathologie_tags : [],
    objectif_tags: Array.isArray(e.objectif_tags) ? e.objectif_tags : [],
    author_name: e.author_name || null,
    user_id: e.user || null,
  };
}

// Tiroir d'un traitement lié : charge (à l'ouverture) ses séances et leurs
// exercices pour consulter tout le traitement sans quitter la fiche.
export function LinkedTraitementDrawer({ id, nom, isPlatform, onOpenExercice }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seances, setSeances] = useState<SeanceBlock[]>([]);

  const load = async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const ts = await pb.collection("traitement_seances").getFullList({
        filter: `traitement_type = "${id}"`,
        sort: "ordre",
        expand: "seance_type",
      });
      const blocks: SeanceBlock[] = [];
      for (const s of ts as any[]) {
        const st = s.expand?.seance_type;
        const label = st?.nom || st?.objectif_principal || st?.pathologie || "Séance";
        const exs = await pb.collection("seance_exercices").getFullList({
          filter: `seance_type = "${s.seance_type}"`,
          sort: "ordre",
          expand: "exercice",
        });
        blocks.push({
          id: s.id,
          label,
          exercices: (exs as any[]).map((e) => e.expand?.exercice).filter(Boolean).map(toExercice),
        });
      }
      setSeances(blocks);
      setLoaded(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Collapsible className="rounded-md border" onOpenChange={(o) => o && load()}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {isPlatform ? <Shield className="w-3.5 h-3.5 text-primary" /> : <UserIcon className="w-3.5 h-3.5" />}
          {nom}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-3 pb-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Chargement…
          </div>
        )}
        {loaded && seances.length === 0 && (
          <p className="text-sm italic text-muted-foreground">Aucune séance dans ce traitement.</p>
        )}
        {seances.map((s) => (
          <div key={s.id} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
            {s.exercices.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">Aucun exercice.</p>
            ) : (
              <div className="space-y-1.5">
                {s.exercices.map((ex, i) => (
                  <button
                    key={`${ex.id}-${i}`}
                    type="button"
                    onClick={() => onOpenExercice(ex)}
                    className="flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <MediaThumb source={ex} alt={ex.title} className="w-12 h-8 shrink-0" showPlayIcon />
                    <span className="flex min-w-0 items-center gap-2">
                      {ex.code && (
                        <Badge variant="outline" className="font-mono text-xs uppercase px-1.5 py-0.5 bg-muted/50">
                          {ex.code}
                        </Badge>
                      )}
                      <span className="truncate text-sm font-medium">{ex.title}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
