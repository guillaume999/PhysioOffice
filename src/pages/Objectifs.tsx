import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Target, Loader2, Pencil, Trash2 } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PagePopup } from "@/components/popup/PagePopup";

interface Objectif {
  id: string;
  name: string;
}

export default function Objectifs() {
  const { user } = useAuth();
  const [objectifs, setObjectifs] = useState<Objectif[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Création
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Édition
  const [editTarget, setEditTarget] = useState<Objectif | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Suppression
  const [deleteTarget, setDeleteTarget] = useState<Objectif | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await pb.collection("objectifs").getFullList({
        filter: `user = "${user.id}"`,
        sort: "name",
        fields: "id,name",
      });
      setObjectifs(
        (data as any[]).map((o) => ({
          id: o.id,
          name: o.name,
        }))
      );
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement des objectifs");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    const name = newName.trim();
    if (objectifs.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Un objectif avec ce nom existe déjà");
      return;
    }
    setCreating(true);
    try {
      await pb.collection("objectifs").create({
        user: user.id,
        name,
        type: "principal",
      });
      toast.success("Objectif créé");
      setNewName("");
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (o: Objectif) => {
    setEditTarget(o);
    setEditName(o.name);
  };

  const handleSaveEdit = async () => {
    if (!editTarget || !editName.trim()) return;
    const name = editName.trim();
    if (
      objectifs.some(
        (o) => o.id !== editTarget.id && o.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      toast.error("Un objectif avec ce nom existe déjà");
      return;
    }
    setSaving(true);
    try {
      await pb.collection("objectifs").update(editTarget.id, {
        name,
      });
      toast.success("Objectif modifié");
      setEditTarget(null);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la modification");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await pb.collection("objectifs").delete(deleteTarget.id);
      setObjectifs((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      toast.success("Objectif supprimé");
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = objectifs.filter((o) => {
    if (!search.trim()) return true;
    return o.name.toLowerCase().includes(search.toLowerCase());
  });

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Connectez-vous pour accéder à cette page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PagePopup pageKey="objectifs" />
      <div className="container mx-auto px-2 sm:px-4 py-4 md:py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <Target className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold">Objectifs</h1>
              <p className="text-muted-foreground">
                {objectifs.length} objectif(s).
              </p>
            </div>
          </div>
        </div>

        {/* Recherche + Création */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un objectif..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-1">
                <Input
                  placeholder="Nouvel objectif..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Créer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste */}
        <Card>
          <CardHeader>
            <CardTitle>Liste ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {search.trim() ? "Aucun objectif pour cette recherche." : "Aucun objectif. Créez-en un ci-dessus."}
              </p>
            ) : (
              <div className="grid gap-2">
                {filtered.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <p className="font-semibold truncate">{o.name}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(o)}
                        aria-label={`Modifier ${o.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(o)}
                        aria-label={`Supprimer ${o.name}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog édition */}
        <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier l'objectif</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                  placeholder="Nom de l'objectif"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation suppression */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer l'objectif ?</AlertDialogTitle>
              <AlertDialogDescription>
                « {deleteTarget?.name} » sera supprimé de votre bibliothèque. Les exercices et
                séances qui l'utilisent comme tag ne seront pas modifiés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
