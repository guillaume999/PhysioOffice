import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";
import {
  TRASH_COLLECTIONS,
  TRASHED,
  restore,
  purge,
  recordTitle,
  type TrashCollection,
} from "@/lib/corbeille";

interface TrashItem {
  id: string;
  collection: TrashCollection;
  title: string;
  deletedAt: string;
  /** Libellé du propriétaire de l'élément (affiché en mode admin). */
  owner?: string;
}

/** Nom affichable du propriétaire d'un enregistrement à partir du user étendu / des champs disponibles. */
function ownerLabel(record: any): string | undefined {
  const u = record.expand?.user;
  if (u) {
    const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    return full || u.name || u.pseudo || u.email || undefined;
  }
  return record.author_name || undefined;
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  return months === 1 ? "il y a 1 mois" : `il y a ${months} mois`;
}

export function CorbeilleList({
  showHeader = true,
  showOwner = false,
  onCountChange,
}: {
  showHeader?: boolean;
  /** Affiche l'utilisateur propriétaire de chaque élément (vue admin). */
  showOwner?: boolean;
  /** Appelé avec le nombre total d'éléments à chaque chargement/restauration/suppression. */
  onCountChange?: (count: number) => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        TRASH_COLLECTIONS.map(async (collection) => {
          try {
            const records = await pb
              .collection(collection.name)
              .getFullList({ filter: TRASHED, sort: "-deleted_at", expand: showOwner ? "user" : "" });
            return records.map((r: any) => ({
              id: r.id,
              collection,
              title: recordTitle(r),
              deletedAt: r.deleted_at,
              owner: showOwner ? ownerLabel(r) : undefined,
            }));
          } catch {
            // Collection sans champ deleted_at ou inaccessible : on ignore.
            return [];
          }
        })
      );
      setItems(results.flat());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchTrash();
  }, [user]);

  // Tient le compteur du parent (badge de l'onglet) à jour après chaque
  // chargement, restauration ou suppression définitive.
  useEffect(() => {
    if (!loading) onCountChange?.(items.length);
  }, [items, loading, onCountChange]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) map[item.collection.name] = (map[item.collection.name] || 0) + 1;
    return map;
  }, [items]);

  const visible = useMemo(
    () => (activeFilter === "all" ? items : items.filter((i) => i.collection.name === activeFilter)),
    [items, activeFilter]
  );

  const handleRestore = async (item: TrashItem) => {
    setBusyId(item.id);
    try {
      await restore(item.collection.name, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Élément restauré");
    } catch {
      toast.error("Erreur lors de la restauration");
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async (item: TrashItem) => {
    setBusyId(item.id);
    try {
      await purge(item.collection.name, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Élément supprimé définitivement");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setBusyId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === visible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((i) => i.id)));
    }
  };

  const handleBulkPurge = async () => {
    setBulkBusy(true);
    try {
      const targets = visible.filter((i) => selected.has(i.id));
      await Promise.all(targets.map((i) => purge(i.collection.name, i.id)));
      setItems((prev) => prev.filter((i) => !selected.has(i.id)));
      setSelected(new Set());
      toast.success(`${targets.length} élément(s) supprimé(s) définitivement`);
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkRestore = async () => {
    setBulkBusy(true);
    try {
      const targets = visible.filter((i) => selected.has(i.id));
      await Promise.all(targets.map((i) => restore(i.collection.name, i.id)));
      setItems((prev) => prev.filter((i) => !selected.has(i.id)));
      setSelected(new Set());
      toast.success(`${targets.length} élément(s) restauré(s)`);
    } catch {
      toast.error("Erreur lors de la restauration");
    } finally {
      setBulkBusy(false);
    }
  };

  const filters = TRASH_COLLECTIONS.filter((c) => counts[c.name]);

  return (
    <div>
      {showHeader && (
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-muted">
            <Trash2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">Corbeille</h1>
            <p className="text-muted-foreground">
              {items.length} élément(s). La restauration les remet à leur place ; la suppression
              définitive est irréversible.
            </p>
          </div>
        </div>
      )}

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={activeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => { setActiveFilter("all"); setSelected(new Set()); }}
          >
            Tout ({items.length})
          </Button>
          {filters.map((c) => (
            <Button
              key={c.name}
              variant={activeFilter === c.name ? "default" : "outline"}
              size="sm"
              onClick={() => { setActiveFilter(c.name); setSelected(new Set()); }}
            >
              <c.icon className="w-4 h-4 mr-1.5" />
              {c.label} ({counts[c.name]})
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>La corbeille est vide.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Barre de sélection en masse */}
          <div className="flex items-center gap-3 px-1 py-2">
            <Checkbox
              checked={visible.length > 0 && selected.size === visible.length}
              onCheckedChange={toggleSelectAll}
              aria-label="Tout sélectionner"
            />
            <span className="text-sm text-muted-foreground">
              {selected.size > 0 ? `${selected.size} sélectionné(s)` : "Tout sélectionner"}
            </span>
            {selected.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkBusy}
                  onClick={handleBulkRestore}
                >
                  {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4 mr-1.5" />Restaurer</>}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={bulkBusy}>
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Supprimer ({selected.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {selected.size} élément(s) seront supprimés définitivement. Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleBulkPurge}
                      >
                        Supprimer définitivement
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
          {visible.map((item) => {
            const Icon = item.collection.icon;
            const busy = busyId === item.id;
            return (
              <Card key={`${item.collection.name}-${item.id}`}>
                <CardContent className="flex items-center gap-3 py-3">
                  <Checkbox
                    checked={selected.has(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    aria-label={`Sélectionner ${item.title}`}
                    className="shrink-0"
                  />
                  <div className="p-2 rounded-lg bg-muted shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.collection.label}
                      {showOwner && ` · par ${item.owner || "utilisateur inconnu"}`}
                      {" · supprimé "}
                      {timeAgo(item.deletedAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => handleRestore(item)}
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4 mr-1.5" />
                        Restaurer
                      </>
                    )}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={busy} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          « {item.title} » sera supprimé définitivement. Cette action est
                          irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handlePurge(item)}
                        >
                          Supprimer définitivement
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
