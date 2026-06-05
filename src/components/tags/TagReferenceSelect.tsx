import { useState } from "react";
import { SearchableCreatableSelect } from "@/components/seance/SearchableCreatableSelect";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pb } from "@/integrations/pocketbase/client";
import { toast } from "sonner";

type TagType = "pathologie" | "objectif";

interface Props {
  type: TagType;
  options: string[];
  userId: string;
  onSelect: (value: string) => void;
  /** Appelé après création / renommage / suppression côté référence pour rafraîchir les listes parent. */
  onReferenceChanged: () => void;
  placeholder?: string;
  className?: string;
}

// Champs (collection PB → champ array) où ces tags peuvent figurer.
const USAGE_FIELDS: Record<TagType, { collection: string; field: string }[]> = {
  pathologie: [
    { collection: "exercices", field: "pathologie_tags" },
    { collection: "seance_types", field: "pathologies" },
    { collection: "traitement_types", field: "pathologies" },
  ],
  objectif: [
    { collection: "exercices", field: "objectif_tags" },
    { collection: "seance_types", field: "objectifs_principaux" },
    { collection: "traitement_types", field: "objectifs_principaux" },
  ],
};

const REF_COLLECTION: Record<TagType, string> = {
  pathologie: "pathologies",
  objectif: "objectifs",
};

const TYPE_LABEL: Record<TagType, string> = {
  pathologie: "pathologie",
  objectif: "objectif",
};

export function TagReferenceSelect({
  type,
  options,
  userId,
  onSelect,
  onReferenceChanged,
  placeholder,
  className,
}: Props) {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameMode, setRenameMode] = useState<"propagate" | "reference_only">("propagate");
  const [deleteMode, setDeleteMode] = useState<"cascade" | "reference_only">("reference_only");
  const [busy, setBusy] = useState(false);
  const [usages, setUsages] = useState<{ collection: string; field: string; ids: string[] }[]>([]);
  const [loadingUsages, setLoadingUsages] = useState(false);

  const countUsages = async (name: string) => {
    setLoadingUsages(true);
    const res: { collection: string; field: string; ids: string[] }[] = [];
    for (const { collection, field } of USAGE_FIELDS[type]) {
      try {
        const items = await pb.collection(collection).getFullList({
          filter: `user = "${userId}"`,
          fields: `id,${field}`,
        });
        const ids = (items as any[])
          .filter((r) => Array.isArray(r[field]) && r[field].includes(name))
          .map((r) => r.id);
        res.push({ collection, field, ids });
      } catch {
        res.push({ collection, field, ids: [] });
      }
    }
    setUsages(res);
    setLoadingUsages(false);
  };

  const openEdit = async (name: string) => {
    setEditingTag(name);
    setRenameValue(name);
    setRenameMode("propagate");
    await countUsages(name);
  };

  const openDelete = async (name: string) => {
    setDeletingTag(name);
    setDeleteMode("reference_only");
    await countUsages(name);
  };

  /** Retourne tous les enregistrements référence (peut être plusieurs si doublons). */
  const findRefRecords = async (name: string) => {
    return await pb.collection(REF_COLLECTION[type]).getFullList({
      filter: `user = "${userId}" && name = "${name.replace(/"/g, '\\"')}"`,
    });
  };

  const handleRename = async () => {
    if (!editingTag) return;
    const newName = renameValue.trim();
    if (!newName) return;
    if (newName === editingTag) {
      setEditingTag(null);
      return;
    }
    setBusy(true);
    try {
      const refs = await findRefRecords(editingTag);
      for (const rec of refs) {
        await pb.collection(REF_COLLECTION[type]).update(rec.id, { name: newName });
      }
      if (renameMode === "propagate") {
        for (const u of usages) {
          for (const id of u.ids) {
            const r = await pb.collection(u.collection).getOne(id);
            const arr = Array.isArray((r as any)[u.field]) ? [...(r as any)[u.field]] : [];
            const next = arr.map((v: string) => (v === editingTag ? newName : v));
            await pb.collection(u.collection).update(id, { [u.field]: next });
          }
        }
      }
      toast.success("Renommé");
      onReferenceChanged();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du renommage");
    } finally {
      setBusy(false);
      setEditingTag(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingTag) return;
    setBusy(true);
    try {
      const refs = await findRefRecords(deletingTag);
      for (const rec of refs) {
        await pb.collection(REF_COLLECTION[type]).delete(rec.id);
      }
      if (deleteMode === "cascade") {
        for (const u of usages) {
          for (const id of u.ids) {
            const r = await pb.collection(u.collection).getOne(id);
            const arr = Array.isArray((r as any)[u.field]) ? (r as any)[u.field] : [];
            const next = arr.filter((v: string) => v !== deletingTag);
            await pb.collection(u.collection).update(id, { [u.field]: next });
          }
        }
      }
      toast.success("Supprimé");
      onReferenceChanged();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression");
    } finally {
      setBusy(false);
      setDeletingTag(null);
    }
  };

  const totalUsages = usages.reduce((n, u) => n + u.ids.length, 0);
  const label = TYPE_LABEL[type];

  return (
    <>
      <SearchableCreatableSelect
        options={options}
        onSelect={onSelect}
        onEdit={openEdit}
        onDelete={openDelete}
        placeholder={placeholder}
        className={className}
      />

      {/* Rename Dialog */}
      <Dialog open={!!editingTag} onOpenChange={(open) => !open && !busy && setEditingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer « {editingTag} »</DialogTitle>
            <DialogDescription>
              {loadingUsages
                ? "Calcul des usages…"
                : totalUsages > 0
                  ? `Ce ${label} est utilisé dans ${totalUsages} contenu(s).`
                  : `Ce ${label} n'est utilisé nulle part.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Nouveau nom"
              autoFocus
            />
            {totalUsages > 0 && (
              <RadioGroup value={renameMode} onValueChange={(v) => setRenameMode(v as any)}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="propagate" id="r-propagate" className="mt-1" />
                  <Label htmlFor="r-propagate" className="font-normal">
                    Propager le nouveau nom partout ({totalUsages} contenu(s) mis à jour)
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="reference_only" id="r-ref-only" className="mt-1" />
                  <Label htmlFor="r-ref-only" className="font-normal">
                    Renommer la référence seulement (les contenus existants gardent l'ancien nom)
                  </Label>
                </div>
              </RadioGroup>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTag(null)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={handleRename} disabled={busy || !renameValue.trim()}>
              {busy ? "Renommage…" : "Renommer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deletingTag} onOpenChange={(open) => !open && !busy && setDeletingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer « {deletingTag} » ?</DialogTitle>
            <DialogDescription>
              {loadingUsages
                ? "Calcul des usages…"
                : totalUsages > 0
                  ? `Ce ${label} est utilisé dans ${totalUsages} contenu(s).`
                  : `Ce ${label} n'est utilisé nulle part.`}
            </DialogDescription>
          </DialogHeader>
          {totalUsages > 0 && (
            <RadioGroup value={deleteMode} onValueChange={(v) => setDeleteMode(v as any)}>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="cascade" id="d-cascade" className="mt-1" />
                <Label htmlFor="d-cascade" className="font-normal">
                  Supprimer le {label} partout (retirer le tag des {totalUsages} contenu(s))
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="reference_only" id="d-ref-only" className="mt-1" />
                <Label htmlFor="d-ref-only" className="font-normal">
                  Supprimer la référence seulement (les contenus existants conservent le tag)
                </Label>
              </div>
            </RadioGroup>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTag(null)} disabled={busy}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
