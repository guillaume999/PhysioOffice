import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Calendar, Play, Check } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";

export interface LibraryItem {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail_url?: string | null;
  pathologie_tags?: string[];
  objectif_tags?: string[];
  video_url?: string | null;
  image_url?: string | null;
  media_type?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "seance" | "exercice";
  /** Called with a library record id to copy from, or null for a blank item. */
  onPick: (sourceId: string | null) => void;
}

/**
 * Lets the practitioner add a séance or exercise to a patient instance, either
 * blank or by copying from their library (seance_types / exercices).
 */
export function AddFromLibraryDialog({ open, onOpenChange, mode, onPick }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterPathologie, setFilterPathologie] = useState<string>("all");
  const [filterObjectif, setFilterObjectif] = useState<string>("all");
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) fetchItems();
    if (!open) {
      setSearch("");
      setFilterPathologie("all");
      setFilterObjectif("all");
      setPreviewItem(null);
    }
  }, [open, user, mode]);

  const fetchItems = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (mode === "seance") {
        const data = await pb.collection("seance_types").getFullList({
          filter: `user = "${user.id}"`, sort: "-created",
          fields: "id,nom,pathologie,pathologies,objectif_principal,objectifs,objectifs_principaux",
        });
        setItems(data.map((s: any) => {
          const pathologies: string[] = Array.isArray(s.pathologies) && s.pathologies.length ? s.pathologies : (s.pathologie ? [s.pathologie] : []);
          const objectifs: string[] = Array.isArray(s.objectifs) && s.objectifs.length
            ? s.objectifs
            : (Array.isArray(s.objectifs_principaux) && s.objectifs_principaux.length ? s.objectifs_principaux : (s.objectif_principal ? [s.objectif_principal] : []));
          return {
            id: s.id,
            title: s.objectif_principal || s.pathologie || s.nom || "Séance",
            subtitle: s.pathologie || "",
            pathologie_tags: pathologies.filter(Boolean),
            objectif_tags: objectifs.filter(Boolean),
          };
        }));
      } else {
        const data = await pb.collection("exercices").getFullList({
          filter: `(user = "${user.id}" || status = "shared")`, sort: "title",
          fields: "id,title,description,thumbnail_url,pathologie_tags,objectif_tags,video_url,image_url,media_type",
        });
        setItems(data.map((e: any) => ({
          id: e.id, title: e.title, subtitle: e.description || "", thumbnail_url: e.thumbnail_url || null,
          pathologie_tags: Array.isArray(e.pathologie_tags) ? e.pathologie_tags : [],
          objectif_tags: Array.isArray(e.objectif_tags) ? e.objectif_tags : [],
          video_url: e.video_url || null,
          image_url: e.image_url || null,
          media_type: e.media_type || null,
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  // Distinct tag options derived from the fetched exercises
  const pathologieOptions = useMemo(
    () => [...new Set(items.flatMap((it) => it.pathologie_tags || []))].sort((a, b) => a.localeCompare(b, "fr")),
    [items]
  );
  const objectifOptions = useMemo(
    () => [...new Set(items.flatMap((it) => it.objectif_tags || []))].sort((a, b) => a.localeCompare(b, "fr")),
    [items]
  );

  const filtered = items.filter((it) => {
    if (filterPathologie !== "all" && !(it.pathologie_tags || []).includes(filterPathologie)) return false;
    if (filterObjectif !== "all" && !(it.objectif_tags || []).includes(filterObjectif)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      it.title.toLowerCase().includes(q) ||
      (it.subtitle || "").toLowerCase().includes(q) ||
      (it.pathologie_tags || []).some((t) => t.toLowerCase().includes(q)) ||
      (it.objectif_tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  const pick = (id: string | null) => {
    onPick(id);
    setPreviewItem(null);
    onOpenChange(false);
  };

  const hasMedia = (it: LibraryItem) => !!(it.video_url || it.image_url || it.thumbnail_url);

  const openPreview = (e: React.MouseEvent, it: LibraryItem) => {
    e.stopPropagation();
    if (hasMedia(it)) setPreviewItem(it);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "seance" ? "Ajouter une séance" : "Ajouter un exercice"}</DialogTitle>
        </DialogHeader>

        <Button variant="outline" className="w-full justify-start gap-2 border-dashed" onClick={() => pick(null)}>
          <Plus className="w-4 h-4" />
          {mode === "seance" ? "Créer une séance vierge" : "Créer un exercice vierge"}
        </Button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Ou rechercher dans la bibliothèque..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {(pathologieOptions.length > 0 || objectifOptions.length > 0) && (
          <div className="grid grid-cols-2 gap-2">
            <Select value={filterObjectif} onValueChange={setFilterObjectif}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Objectif" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les objectifs</SelectItem>
                {objectifOptions.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPathologie} onValueChange={setFilterPathologie}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Pathologie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les pathologies</SelectItem>
                {pathologieOptions.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="max-h-72 overflow-y-auto border rounded-lg p-2 space-y-1">
          {loading ? (
            <p className="text-sm text-muted-foreground p-2 text-center">Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2 text-center">Aucun élément dans la bibliothèque.</p>
          ) : (
            filtered.map((it) => (
              <div key={it.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer" onClick={() => pick(it.id)}>
                {mode === "exercice" ? (
                  it.thumbnail_url ? (
                    <img
                      src={it.thumbnail_url}
                      alt={it.title}
                      title="Cliquer pour prévisualiser"
                      onClick={(e) => openPreview(e, it)}
                      className="w-10 h-10 object-cover rounded flex-shrink-0 hover:ring-2 hover:ring-primary transition-shadow"
                    />
                  ) : (
                    <div
                      onClick={(e) => openPreview(e, it)}
                      title={hasMedia(it) ? "Cliquer pour prévisualiser" : undefined}
                      className={`w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0 ${hasMedia(it) ? "hover:ring-2 hover:ring-primary transition-shadow" : ""}`}
                    >
                      <Play className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )
                ) : (
                  <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{it.title}</p>
                  {it.subtitle && <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>}
                  {mode === "exercice" && ((it.pathologie_tags?.length || 0) > 0 || (it.objectif_tags?.length || 0) > 0) && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {[...(it.objectif_tags || []), ...(it.pathologie_tags || [])].join(" · ")}
                    </p>
                  )}
                </div>
                <Plus className="w-4 h-4 text-primary flex-shrink-0" />
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Media preview dialog */}
    <Dialog open={!!previewItem} onOpenChange={(o) => { if (!o) setPreviewItem(null); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{previewItem?.title}</DialogTitle>
        </DialogHeader>

        {previewItem && (
          <div className="space-y-3">
            {previewItem.media_type === "image" && (previewItem.image_url || previewItem.thumbnail_url) ? (
              <img
                src={previewItem.image_url || previewItem.thumbnail_url || undefined}
                alt={previewItem.title}
                className="w-full max-h-[60vh] object-contain rounded-md bg-muted"
              />
            ) : previewItem.video_url ? (
              <video
                src={previewItem.video_url}
                controls
                autoPlay
                playsInline
                poster={previewItem.thumbnail_url || undefined}
                className="w-full max-h-[60vh] rounded-md bg-black"
              />
            ) : previewItem.thumbnail_url ? (
              <img
                src={previewItem.thumbnail_url}
                alt={previewItem.title}
                className="w-full max-h-[60vh] object-contain rounded-md bg-muted"
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun média disponible.</p>
            )}

            {previewItem.subtitle && (
              <p className="text-sm text-muted-foreground line-clamp-3">{previewItem.subtitle}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPreviewItem(null)}>
                Fermer
              </Button>
              <Button className="flex-1" onClick={() => pick(previewItem.id)}>
                <Check className="w-4 h-4 mr-2" />
                Sélectionner
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
