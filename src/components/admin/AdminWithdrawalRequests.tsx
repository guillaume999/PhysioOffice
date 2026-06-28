import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, XCircle, Undo2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { pb } from "@/integrations/pocketbase/client";
import { recordTitle } from "@/lib/corbeille";

interface WithdrawalItem {
  id: string;
  collection: string;
  label: string;
  title: string;
  author: string;
}

// Collections "partage simple" : retrait = repasser en privé (is_shared/is_validated false).
const SIMPLE = [
  { name: "seance_types", label: "Séance" },
  { name: "traitement_types", label: "Traitement" },
  { name: "pathologies", label: "Pathologie" },
];

export function AdminWithdrawalRequests({
  onCountChange,
}: {
  /** Appelé avec le nombre de demandes en attente à chaque chargement/approbation/refus. */
  onCountChange?: (count: number) => void;
}) {
  const [items, setItems] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const groups = await Promise.all([
        // Exercices : modèle à statut
        pb.collection("exercices")
          .getFullList({ filter: 'status = "withdrawal_requested"', sort: "-updated" })
          .then((rows: any[]) =>
            rows.map((r) => ({ id: r.id, collection: "exercices", label: "Exercice", title: recordTitle(r), author: r.author_name || "Anonyme" }))
          )
          .catch(() => [] as WithdrawalItem[]),
        // Séances / traitements / pathologies : champ booléen withdrawal_requested
        ...SIMPLE.map((c) =>
          pb.collection(c.name)
            .getFullList({ filter: "withdrawal_requested = true", sort: "-updated" })
            .then((rows: any[]) =>
              rows.map((r) => ({ id: r.id, collection: c.name, label: c.label, title: recordTitle(r), author: r.author_name || "Anonyme" }))
            )
            .catch(() => [] as WithdrawalItem[])
        ),
      ]);
      setItems(groups.flat());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Tient le compteur du parent (badge de l'onglet) à jour après chaque
  // chargement, approbation ou refus de demande de retrait.
  useEffect(() => {
    if (!loading) onCountChange?.(items.length);
  }, [items, loading, onCountChange]);

  const approve = async (item: WithdrawalItem) => {
    setBusyId(item.id);
    try {
      if (item.collection === "exercices") {
        await pb.collection("exercices").update(item.id, { status: "draft", withdrawal_refused: false });
      } else {
        await pb.collection(item.collection).update(item.id, {
          is_shared: false,
          is_validated: false,
          withdrawal_requested: false,
          withdrawal_refused: false,
        });
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Retrait approuvé — l'élément a été retiré des partagés");
    } catch {
      toast.error("Impossible d'approuver la demande");
    } finally {
      setBusyId(null);
    }
  };

  const deny = async (item: WithdrawalItem) => {
    setBusyId(item.id);
    try {
      if (item.collection === "exercices") {
        await pb.collection("exercices").update(item.id, { status: "shared", withdrawal_refused: true });
      } else {
        await pb.collection(item.collection).update(item.id, { withdrawal_requested: false, withdrawal_refused: true });
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Demande refusée — l'élément reste partagé");
    } catch {
      toast.error("Impossible de refuser la demande");
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
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const handleBulkApprove = async () => {
    setBulkBusy(true);
    try {
      const targets = items.filter((i) => selected.has(i.id));
      await Promise.all(targets.map((item) => {
        if (item.collection === "exercices") {
          return pb.collection("exercices").update(item.id, { status: "draft", withdrawal_refused: false });
        }
        return pb.collection(item.collection).update(item.id, {
          is_shared: false,
          is_validated: false,
          withdrawal_requested: false,
          withdrawal_refused: false,
        });
      }));
      setItems((prev) => prev.filter((i) => !selected.has(i.id)));
      setSelected(new Set());
      toast.success(`${targets.length} retrait(s) approuvé(s)`);
    } catch {
      toast.error("Impossible d'approuver les demandes");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDeny = async () => {
    setBulkBusy(true);
    try {
      const targets = items.filter((i) => selected.has(i.id));
      await Promise.all(targets.map((item) => {
        if (item.collection === "exercices") {
          return pb.collection("exercices").update(item.id, { status: "shared", withdrawal_refused: true });
        }
        return pb.collection(item.collection).update(item.id, { withdrawal_requested: false, withdrawal_refused: true });
      }));
      setItems((prev) => prev.filter((i) => !selected.has(i.id)));
      setSelected(new Set());
      toast.success(`${targets.length} demande(s) refusée(s)`);
    } catch {
      toast.error("Impossible de refuser les demandes");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Undo2 className="w-5 h-5" />
          Demandes de retrait {items.length > 0 && `(${items.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Aucune demande de retrait en attente.</p>
        ) : (
          <div className="space-y-2">
            {/* Barre de sélection en masse */}
            <div className="flex items-center gap-3 px-1 py-2">
              <Checkbox
                checked={items.length > 0 && selected.size === items.length}
                onCheckedChange={toggleSelectAll}
                aria-label="Tout sélectionner"
              />
              <span className="text-sm text-muted-foreground">
                {selected.size > 0 ? `${selected.size} sélectionné(s)` : "Tout sélectionner"}
              </span>
              {selected.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1"
                    disabled={bulkBusy}
                    onClick={handleBulkApprove}
                  >
                    {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approuver ({selected.size})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                    disabled={bulkBusy}
                    onClick={handleBulkDeny}
                  >
                    <XCircle className="w-4 h-4" />
                    Refuser ({selected.size})
                  </Button>
                </div>
              )}
            </div>
            {items.map((item) => {
              const busy = busyId === item.id;
              return (
                <div key={`${item.collection}-${item.id}`} className="flex items-center gap-3 bg-background p-3 rounded-lg border">
                  <Checkbox
                    checked={selected.has(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    aria-label={`Sélectionner ${item.title}`}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.label} · {item.author}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="default" size="sm" className="gap-1" disabled={busy || bulkBusy} onClick={() => approve(item)}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approuver le retrait
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                      disabled={busy || bulkBusy}
                      onClick={() => deny(item)}
                    >
                      <XCircle className="w-4 h-4" />
                      Refuser
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
