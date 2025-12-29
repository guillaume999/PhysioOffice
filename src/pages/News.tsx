import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const { data, error } = await supabase
          .from("news")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setNewsItems(data || []);
      } catch (error) {
        console.error("Error fetching news:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  return (
    <Layout>
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

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : newsItems.length === 0 ? (
          <Card className="glass max-w-3xl">
            <CardContent className="p-8 text-center">
              <Newspaper className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Aucune actualité
              </h3>
              <p className="text-muted-foreground">
                Les dernières nouvelles apparaîtront ici.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {newsItems.map((news) => (
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
