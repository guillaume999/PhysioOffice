import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Calendar, Play } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";

export interface LibraryItem {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail_url?: string | null;
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) fetchItems();
    if (!open) setSearch("");
  }, [open, user, mode]);

  const fetchItems = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (mode === "seance") {
        const data = await pb.collection("seance_types").getFullList({
          filter: `user = "${user.id}"`, sort: "-created",
          fields: "id,nom,pathologie,objectif_principal",
        });
        setItems(data.map((s: any) => ({
          id: s.id,
          title: s.objectif_principal || s.pathologie || s.nom || "Séance",
          subtitle: s.pathologie || "",
        })));
      } else {
        const data = await pb.collection("exercices").getFullList({
          filter: `(user = "${user.id}" || status = "shared")`, sort: "title",
          fields: "id,title,description,thumbnail_url",
        });
        setItems(data.map((e: any) => ({
          id: e.id, title: e.title, subtitle: e.description || "", thumbnail_url: e.thumbnail_url || null,
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  const filtered = items.filter((it) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return it.title.toLowerCase().includes(q) || (it.subtitle || "").toLowerCase().includes(q);
  });

  const pick = (id: string | null) => {
    onPick(id);
    onOpenChange(false);
  };

  return (
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
                    <img src={it.thumbnail_url} alt={it.title} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0"><Play className="w-4 h-4 text-muted-foreground" /></div>
                  )
                ) : (
                  <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{it.title}</p>
                  {it.subtitle && <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>}
                </div>
                <Plus className="w-4 h-4 text-primary flex-shrink-0" />
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
