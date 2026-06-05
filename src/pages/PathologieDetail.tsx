import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
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

export default function PathologieDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [traitement, setTraitement] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (id && user) load();
  }, [id, user]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await pb.collection("pathologies").getOne(id);
      setName((r as any).name || "");
      setTraitement((r as any).traitement || "");
    } catch (e) {
      console.error(e);
      toast.error("Pathologie introuvable");
      navigate("/pathologies");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      await pb.collection("pathologies").update(id, { name: name.trim(), traitement });
      toast.success("Enregistré");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await pb.collection("pathologies").delete(id);
      toast.success("Pathologie supprimée");
      navigate("/pathologies");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression");
    }
  };

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
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate("/pathologies")} className="gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Pathologie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom de la pathologie"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="traitement">Traitement / Protocole</Label>
                <Textarea
                  id="traitement"
                  value={traitement}
                  onChange={(e) => setTraitement(e.target.value)}
                  placeholder="Décrivez le protocole de traitement, conseils, contre-indications, exercices recommandés…"
                  rows={14}
                  className="min-h-[300px]"
                />
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <Button
                  variant="ghost"
                  className="text-destructive gap-2"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
                <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette pathologie ?</AlertDialogTitle>
              <AlertDialogDescription>
                « {name} » sera supprimée. Les exercices, séances et traitements qui l'utilisent comme tag
                conserveront le tag tel quel.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
