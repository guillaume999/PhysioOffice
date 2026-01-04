import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Info } from "lucide-react";

interface Popup {
  id: string;
  page_key: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const PAGE_LABELS: Record<string, string> = {
  home: "Accueil",
  patients: "Patients",
  planning: "Planning",
  exercices: "Exercices",
  seances: "Séances",
  traitements: "Traitements",
  videos: "Vidéos",
  notes: "Notes",
  annonces: "Annonces",
  news: "Actualités",
  formation: "Formation",
  "ia-diagnostic": "IA Diagnostic",
  pricing: "Tarifs",
  profile: "Profil",
};

export function PopupsManagement() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPopup, setEditingPopup] = useState<Popup | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    is_active: false,
  });

  const fetchPopups = async () => {
    try {
      const { data, error } = await supabase
        .from("admin_popups")
        .select("*")
        .order("page_key");

      if (error) throw error;
      setPopups(data || []);
    } catch (err) {
      console.error("Error fetching popups:", err);
      toast.error("Erreur lors du chargement des pop-ups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPopups();
  }, []);

  const handleEdit = (popup: Popup) => {
    setEditingPopup(popup);
    setFormData({
      title: popup.title,
      content: popup.content,
      is_active: popup.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingPopup) return;

    try {
      const { error } = await supabase
        .from("admin_popups")
        .update({
          title: formData.title,
          content: formData.content,
          is_active: formData.is_active,
        })
        .eq("id", editingPopup.id);

      if (error) throw error;

      toast.success("Pop-up mis à jour avec succès");
      setIsDialogOpen(false);
      setEditingPopup(null);
      fetchPopups();
    } catch (err) {
      console.error("Error updating popup:", err);
      toast.error("Erreur lors de la mise à jour du pop-up");
    }
  };

  const handleToggleActive = async (popup: Popup) => {
    try {
      const { error } = await supabase
        .from("admin_popups")
        .update({ is_active: !popup.is_active })
        .eq("id", popup.id);

      if (error) throw error;

      toast.success(
        popup.is_active ? "Pop-up désactivé" : "Pop-up activé"
      );
      fetchPopups();
    } catch (err) {
      console.error("Error toggling popup:", err);
      toast.error("Erreur lors de la modification");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
        <Info className="w-5 h-5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">
          Lorsqu'un pop-up est modifié (titre ou contenu), tous les utilisateurs
          qui l'avaient masqué le reverront automatiquement.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page</TableHead>
            <TableHead>Titre</TableHead>
            <TableHead>Actif</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {popups.map((popup) => (
            <TableRow key={popup.id}>
              <TableCell className="font-medium">
                {PAGE_LABELS[popup.page_key] || popup.page_key}
              </TableCell>
              <TableCell>{popup.title}</TableCell>
              <TableCell>
                <Switch
                  checked={popup.is_active}
                  onCheckedChange={() => handleToggleActive(popup)}
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(popup)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Modifier le pop-up -{" "}
              {editingPopup && (PAGE_LABELS[editingPopup.page_key] || editingPopup.page_key)}
            </DialogTitle>
            <DialogDescription>
              Modifiez le contenu du pop-up. Les utilisateurs qui l'avaient masqué
              le reverront si vous changez le titre ou le contenu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Titre du pop-up"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Contenu</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="Contenu du pop-up"
                rows={5}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Activer le pop-up</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
