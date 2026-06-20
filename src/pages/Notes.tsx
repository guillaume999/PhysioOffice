import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { FileText, Loader2, Plus, Save, Trash2, Edit2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { pb } from "@/integrations/pocketbase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PagePopup } from "@/components/popup/PagePopup";

interface Note {
  id: string;
  title: string;
  content: string | null;
  created: string;
  updated: string;
}

export default function Notes() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchNotes();
  }, [user]);

  const fetchNotes = async () => {
    try {
      const data = await pb.collection("notes").getFullList<Note>({
        filter: `user = "${user!.id}" && patient = null`,
        sort: "-updated",
      });
      setNotes(data);
    } catch {
      toast.error("Erreur lors du chargement des notes");
    } finally {
      setLoadingNotes(false);
    }
  };

  const createNote = async () => {
    if (!newTitle.trim() || !user) return;
    try {
      const data = await pb.collection("notes").create<Note>({
        title: newTitle.trim(),
        content: "",
        user: user.id,
      });
      setNotes([data, ...notes]);
      setSelectedNote(data);
      setEditedTitle(data.title);
      setEditedContent(data.content || "");
      setNewTitle("");
      setIsCreateOpen(false);
      toast.success("Note créée");
    } catch {
      toast.error("Erreur lors de la création");
    }
  };

  const saveNote = async () => {
    if (!selectedNote) return;
    setSaving(true);
    try {
      await pb.collection("notes").update(selectedNote.id, {
        title: editedTitle,
        content: editedContent,
      });
      setNotes(notes.map(n =>
        n.id === selectedNote.id
          ? { ...n, title: editedTitle, content: editedContent, updated: new Date().toISOString() }
          : n
      ));
      setSelectedNote({ ...selectedNote, title: editedTitle, content: editedContent });
      toast.success("Note sauvegardée");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await pb.collection("notes").delete(id);
      setNotes(notes.filter(n => n.id !== id));
      if (selectedNote?.id === id) {
        setSelectedNote(null);
        setEditedContent("");
        setEditedTitle("");
      }
      toast.success("Note supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setEditedTitle(note.title);
    setEditedContent(note.content || "");
  };

  if (loading) {
    return <Layout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;
  }

  return (
    <Layout>
      <PagePopup pageKey="notes" />
      <div className="container mx-auto px-2 sm:px-4 py-4 md:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-orange-500/10">
              <FileText className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold">Notes</h1>
              <p className="text-muted-foreground">Gérez vos notes médicales</p>
            </div>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nouvelle note</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer une note</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <Input placeholder="Titre de la note" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createNote()} />
                <Button onClick={createNote} disabled={!newTitle.trim()} className="w-full">Créer</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-lg">Mes notes</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
              {loadingNotes ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : notes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Aucune note</p>
              ) : notes.map((note) => (
                <div key={note.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between group ${selectedNote?.id === note.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"}`}
                  onClick={() => selectNote(note)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{note.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(note.updated).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette note ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteNote(note.id)}>Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Edit2 className="w-5 h-5" />
                {selectedNote ? "Modifier la note" : "Sélectionnez une note"}
              </CardTitle>
              {selectedNote && (
                <Button onClick={saveNote} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Sauvegarder
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {selectedNote ? (
                <div className="space-y-4">
                  <Input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} placeholder="Titre" className="text-lg font-medium" />
                  <Textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} placeholder="Écrivez votre note ici..." className="min-h-[400px] resize-none" />
                </div>
              ) : (
                <div className="flex items-center justify-center py-20 text-muted-foreground">Sélectionnez une note pour la modifier</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
