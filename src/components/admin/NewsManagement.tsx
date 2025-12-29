import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Save, X, Newspaper } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface NewsItem {
  id: string;
  title: string;
  description: string;
  category: string;
  is_new: boolean;
  created_at: string;
  created_by: string;
}

const CATEGORIES = ["Nouveauté", "Formation", "Amélioration", "Annonce"];

export function NewsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New news form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("Nouveauté");
  const [newIsNew, setNewIsNew] = useState(true);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editIsNew, setEditIsNew] = useState(false);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error("Error fetching news:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les actualités.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNews = async () => {
    if (!newTitle.trim() || !newDescription.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from("news")
        .insert({
          title: newTitle,
          description: newDescription,
          category: newCategory,
          is_new: newIsNew,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setNews([data, ...news]);
      setNewTitle("");
      setNewDescription("");
      setNewCategory("Nouveauté");
      setNewIsNew(true);
      setShowNewForm(false);
      toast({ title: "Actualité ajoutée" });
    } catch (error) {
      console.error("Error adding news:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter l'actualité.",
        variant: "destructive",
      });
    }
  };

  const handleStartEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditCategory(item.category);
    setEditIsNew(item.is_new);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditCategory("");
    setEditIsNew(false);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim() || !editDescription.trim()) return;

    try {
      const { error } = await supabase
        .from("news")
        .update({
          title: editTitle,
          description: editDescription,
          category: editCategory,
          is_new: editIsNew,
        })
        .eq("id", editingId);

      if (error) throw error;

      setNews(news.map((n) =>
        n.id === editingId
          ? { ...n, title: editTitle, description: editDescription, category: editCategory, is_new: editIsNew }
          : n
      ));
      handleCancelEdit();
      toast({ title: "Actualité modifiée" });
    } catch (error) {
      console.error("Error updating news:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'actualité.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette actualité ?")) return;

    try {
      const { error } = await supabase
        .from("news")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setNews(news.filter((n) => n.id !== id));
      toast({ title: "Actualité supprimée" });
    } catch (error) {
      console.error("Error deleting news:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'actualité.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="w-5 h-5" />
            Gestion des actualités
          </CardTitle>
          <Button onClick={() => setShowNewForm(!showNewForm)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle actualité
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* New news form */}
        {showNewForm && (
          <Card className="border-dashed border-primary/50 bg-primary/5">
            <CardContent className="p-4 space-y-4">
              <h4 className="font-semibold">Nouvelle actualité</h4>
              <div className="space-y-3">
                <Input
                  placeholder="Titre"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                />
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[150px]">
                    <Label className="text-sm text-muted-foreground mb-1 block">Catégorie</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      checked={newIsNew}
                      onCheckedChange={setNewIsNew}
                      id="new-is-new"
                    />
                    <Label htmlFor="new-is-new">Marquer comme nouveau</Label>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddNews} disabled={!newTitle.trim() || !newDescription.trim()}>
                  <Save className="w-4 h-4 mr-2" />
                  Ajouter
                </Button>
                <Button variant="outline" onClick={() => setShowNewForm(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* News list */}
        <div className="space-y-4">
          {news.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune actualité pour le moment.
            </p>
          ) : (
            news.map((item) => (
              <Card key={item.id} className="border">
                {editingId === item.id ? (
                  <CardContent className="p-4 space-y-4">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Titre"
                    />
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description"
                      rows={3}
                    />
                    <div className="flex flex-wrap gap-4">
                      <div className="flex-1 min-w-[150px]">
                        <Label className="text-sm text-muted-foreground mb-1 block">Catégorie</Label>
                        <Select value={editCategory} onValueChange={setEditCategory}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch
                          checked={editIsNew}
                          onCheckedChange={setEditIsNew}
                          id="edit-is-new"
                        />
                        <Label htmlFor="edit-is-new">Marquer comme nouveau</Label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveEdit} size="sm">
                        <Save className="w-4 h-4 mr-2" />
                        Enregistrer
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                        <X className="w-4 h-4 mr-2" />
                        Annuler
                      </Button>
                    </div>
                  </CardContent>
                ) : (
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{item.category}</Badge>
                          {item.is_new && (
                            <Badge className="gradient-primary text-primary-foreground">
                              Nouveau
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(item.created_at), "d MMM yyyy", { locale: fr })}
                          </span>
                        </div>
                        <h4 className="font-semibold mb-1">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(item)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteNews(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
