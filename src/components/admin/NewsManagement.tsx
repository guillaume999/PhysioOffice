import { useState, useEffect, useMemo } from "react";
import { pb } from "@/integrations/pocketbase/client";
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
import { Plus, Edit, Trash2, Save, X, Newspaper, Tag, Search, Loader2 } from "lucide-react";
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

const DEFAULT_CATEGORIES = ["Nouveauté", "Formation", "Amélioration", "Annonce"];

export function NewsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  
  // Search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // New news form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("Nouveauté");
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [newIsNew, setNewIsNew] = useState(true);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCustomCategory, setEditCustomCategory] = useState("");
  const [useEditCustomCategory, setUseEditCustomCategory] = useState(false);
  const [editIsNew, setEditIsNew] = useState(false);

  useEffect(() => {
    fetchNews();
  }, []);

  // Extract unique categories from existing news
  useEffect(() => {
    const existingCategories = news.map((n) => n.category);
    const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...existingCategories])];
    setCategories(allCategories);
  }, [news]);

  // Filter news based on search and category
  const filteredNews = useMemo(() => {
    return news.filter((item) => {
      const matchesSearch = searchQuery.trim() === "" ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !filterCategory || item.category === filterCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [news, searchQuery, filterCategory]);

  const hasActiveFilters = searchQuery.trim() !== "" || filterCategory !== null;

  const clearFilters = () => {
    setSearchQuery("");
    setFilterCategory(null);
  };

  const fetchNews = async () => {
    try {
      setNews(await pb.collection("news").getFullList({ sort: "-id" }));
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

    const categoryToUse = useCustomCategory ? newCustomCategory.trim() : newCategory;
    if (!categoryToUse) return;

    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = await pb.collection("news").create({
          title: newTitle, description: newDescription, category: categoryToUse,
          is_new: newIsNew, created_by: user.id,
        });
      setNews([data as any, ...news]);
      setNewTitle("");
      setNewDescription("");
      setNewCategory("Nouveauté");
      setNewCustomCategory("");
      setUseCustomCategory(false);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description);
    
    // Check if category is custom (not in default list)
    if (!DEFAULT_CATEGORIES.includes(item.category)) {
      setUseEditCustomCategory(true);
      setEditCustomCategory(item.category);
      setEditCategory("");
    } else {
      setUseEditCustomCategory(false);
      setEditCategory(item.category);
      setEditCustomCategory("");
    }
    
    setEditIsNew(item.is_new);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditCategory("");
    setEditCustomCategory("");
    setUseEditCustomCategory(false);
    setEditIsNew(false);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim() || !editDescription.trim()) return;

    const categoryToUse = useEditCustomCategory ? editCustomCategory.trim() : editCategory;
    if (!categoryToUse) return;

    try {
      await pb.collection("news").update(editingId, { title: editTitle, description: editDescription, category: categoryToUse, is_new: editIsNew });

      setNews(news.map((n) =>
        n.id === editingId
          ? { ...n, title: editTitle, description: editDescription, category: categoryToUse, is_new: editIsNew }
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
      await pb.collection("news").delete(id);

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

  const getSelectedCategory = () => {
    return useCustomCategory ? newCustomCategory.trim() : newCategory;
  };

  const getEditSelectedCategory = () => {
    return useEditCustomCategory ? editCustomCategory.trim() : editCategory;
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

        {/* Search and filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par titre, description, catégorie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCategory || "all"} onValueChange={(v) => setFilterCategory(v === "all" ? null : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Toutes catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Effacer
            </Button>
          )}
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
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm text-muted-foreground">Catégorie</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 text-xs"
                        onClick={() => setUseCustomCategory(!useCustomCategory)}
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {useCustomCategory ? "Choisir existante" : "Nouvelle catégorie"}
                      </Button>
                    </div>
                    {useCustomCategory ? (
                      <Input
                        placeholder="Nom de la nouvelle catégorie"
                        value={newCustomCategory}
                        onChange={(e) => setNewCustomCategory(e.target.value)}
                      />
                    ) : (
                      <Select value={newCategory} onValueChange={setNewCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
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
                <Button
                  onClick={handleAddNews}
                  disabled={isSubmitting || !newTitle.trim() || !newDescription.trim() || !getSelectedCategory()}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
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
          {filteredNews.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {hasActiveFilters 
                ? "Aucune actualité ne correspond à votre recherche." 
                : "Aucune actualité pour le moment."}
            </p>
          ) : (
            filteredNews.map((item) => (
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
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm text-muted-foreground">Catégorie</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1 text-xs"
                            onClick={() => setUseEditCustomCategory(!useEditCustomCategory)}
                          >
                            <Tag className="w-3 h-3 mr-1" />
                            {useEditCustomCategory ? "Choisir existante" : "Nouvelle catégorie"}
                          </Button>
                        </div>
                        {useEditCustomCategory ? (
                          <Input
                            placeholder="Nom de la nouvelle catégorie"
                            value={editCustomCategory}
                            onChange={(e) => setEditCustomCategory(e.target.value)}
                          />
                        ) : (
                          <Select value={editCategory} onValueChange={setEditCategory}>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une catégorie" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
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
                      <Button 
                        onClick={handleSaveEdit} 
                        size="sm"
                        disabled={!getEditSelectedCategory()}
                      >
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
                            {item.created_at ? format(new Date(item.created_at), "d MMM yyyy", { locale: fr }) : "—"}
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
