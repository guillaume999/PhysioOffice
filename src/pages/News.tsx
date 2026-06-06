import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Newspaper, Calendar, Search, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PagePopup } from "@/components/popup/PagePopup";
import { pb } from "@/integrations/pocketbase/client";

interface NewsItem {
  id: string;
  title: string;
  description: string;
  category: string;
  is_new: boolean;
  created_at: string;
}

const getCategoryColor = (category: string) => {
  switch (category) {
    case "Nouveauté":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "Formation":
      return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    case "Amélioration":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "Annonce":
      return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function News() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const data = await pb.collection("news").getFullList({ sort: "-created_at" });
        setNewsItems(data as unknown as NewsItem[]);
      } catch (error) {
        console.error("Error fetching news:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  // Extract unique categories
  const categories = useMemo(() => {
    return [...new Set(newsItems.map((n) => n.category))];
  }, [newsItems]);

  // Filter news based on search and category
  const filteredNews = useMemo(() => {
    return newsItems.filter((news) => {
      const matchesSearch = searchQuery.trim() === "" || 
        news.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        news.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        news.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !selectedCategory || news.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [newsItems, searchQuery, selectedCategory]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
  };

  const hasActiveFilters = searchQuery.trim() !== "" || selectedCategory !== null;

  return (
    <Layout>
      <PagePopup pageKey="news" />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
              <Newspaper className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Actualités</h1>
              <p className="text-muted-foreground">
                Les dernières nouvelles et mises à jour de PhysioOffice
              </p>
            </div>
          </div>
        </div>

        {/* Search and filters */}
        <div className="mb-6 max-w-3xl space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par titre, description ou catégorie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Catégories :</span>
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    selectedCategory === cat 
                      ? "gradient-primary text-primary-foreground" 
                      : getCategoryColor(cat) + " hover:opacity-80"
                  }`}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                >
                  {cat}
                </Badge>
              ))}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6 px-2 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Effacer
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredNews.length === 0 ? (
          <Card className="glass max-w-3xl">
            <CardContent className="p-8 text-center">
              <Newspaper className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {hasActiveFilters ? "Aucun résultat" : "Aucune actualité"}
              </h3>
              <p className="text-muted-foreground">
                {hasActiveFilters 
                  ? "Aucune actualité ne correspond à votre recherche."
                  : "Les dernières nouvelles apparaîtront ici."}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="mt-4">
                  Effacer les filtres
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {filteredNews.map((news) => (
              <Card 
                key={news.id} 
                className={`glass hover:shadow-lg transition-shadow ${
                  news.is_new ? "border-primary/30" : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getCategoryColor(news.category)}>
                        {news.category}
                      </Badge>
                      {news.is_new && (
                        <Badge className="gradient-primary text-primary-foreground">
                          Nouveau
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(news.created_at), "d MMMM yyyy", { locale: fr })}
                    </div>
                  </div>
                  <CardTitle className="text-lg">{news.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{news.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
