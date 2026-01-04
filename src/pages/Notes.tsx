import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/lib/auth";
import { FileText, Loader2, Plus, Save, Trash2, Edit2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PagePopup } from "@/components/popup/PagePopup";

interface Note {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
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
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .is("patient_id", null)
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("Erreur lors du chargement des notes");
    } else {
      setNotes(data || []);
    }
    setLoadingNotes(false);
  };

  const createNote = async () => {
    if (!newTitle.trim() || !user) return;

    const { data, error } = await supabase
      .from("notes")
      .insert({ title: newTitle.trim(), content: "", user_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Erreur lors de la création");
    } else {
      setNotes([data, ...notes]);
      setSelectedNote(data);
      setEditedTitle(data.title);
      setEditedContent(data.content || "");
      setNewTitle("");
      setIsCreateOpen(false);
      toast.success("Note créée");
    }
  };

  const saveNote = async () => {
    if (!selectedNote) return;
    setSaving(true);

    const { error } = await supabase
      .from("notes")
      .update({ title: editedTitle, content: editedContent })
      .eq("id", selectedNote.id);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      setNotes(notes.map(n => 
        n.id === selectedNote.id 
          ? { ...n, title: editedTitle, content: editedContent, updated_at: new Date().toISOString() } 
          : n
      ));
      setSelectedNote({ ...selectedNote, title: editedTitle, content: editedContent });
      toast.success("Note sauvegardée");
    }
    setSaving(false);
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      setNotes(notes.filter(n => n.id !== id));
      if (selectedNote?.id === id) {
        setSelectedNote(null);
        setEditedContent("");
        setEditedTitle("");
      }
      toast.success("Note supprimée");
    }
  };

  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setEditedTitle(note.title);
    setEditedContent(note.content || "");
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PagePopup pageKey="notes" />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-orange-500/10">
              <FileText className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Notes</h1>
              <p className="text-muted-foreground">Gérez vos notes médicales</p>
            </div>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une note</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Titre de la note"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createNote()}
                />
                <Button onClick={createNote} disabled={!newTitle.trim()} className="w-full">
                  Créer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liste des notes */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Mes notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
              {loadingNotes ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : notes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune note
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between group ${
                      selectedNote?.id === note.id
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => selectNote(note)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{note.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(note.updated_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette note ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteNote(note.id)}>
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Éditeur de note */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Edit2 className="w-5 h-5" />
                {selectedNote ? "Modifier la note" : "Sélectionnez une note"}
              </CardTitle>
              {selectedNote && (
                <Button onClick={saveNote} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Sauvegarder
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {selectedNote ? (
                <div className="space-y-4">
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="Titre"
                    className="text-lg font-medium"
                  />
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    placeholder="Écrivez votre note ici..."
                    className="min-h-[400px] resize-none"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                  Sélectionnez une note pour la modifier
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
