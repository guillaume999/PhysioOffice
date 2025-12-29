import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const newsItems = [
  {
    id: 1,
    title: "Nouvelle fonctionnalité : Partage de ressources",
    description: "Vous pouvez désormais partager vos fiches patients et votre planning avec d'autres utilisateurs PhysioOffice. Définissez les permissions et la durée d'accès.",
    date: new Date("2024-12-29"),
    category: "Nouveauté",
    isNew: true,
  },
  {
    id: 2,
    title: "Formation disponible : Rééducation de l'épaule",
    description: "Découvrez notre nouvelle formation complète sur les techniques de rééducation pour les pathologies de l'épaule.",
    date: new Date("2024-12-20"),
    category: "Formation",
    isNew: true,
  },
  {
    id: 3,
    title: "Amélioration du planning",
    description: "Le planning a été optimisé avec de nouvelles fonctionnalités : duplication de semaine, impression améliorée et vue journalière.",
    date: new Date("2024-12-15"),
    category: "Amélioration",
    isNew: false,
  },
  {
    id: 4,
    title: "Bienvenue sur PhysioOffice",
    description: "Nous sommes ravis de vous accueillir sur PhysioOffice, votre nouvelle plateforme de gestion de cabinet de kinésithérapie.",
    date: new Date("2024-12-01"),
    category: "Annonce",
    isNew: false,
  },
];

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

        {/* News List */}
        <div className="space-y-4 max-w-3xl">
          {newsItems.map((news) => (
            <Card 
              key={news.id} 
              className={`glass hover:shadow-lg transition-shadow cursor-pointer ${
                news.isNew ? "border-primary/30" : ""
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getCategoryColor(news.category)}>
                      {news.category}
                    </Badge>
                    {news.isNew && (
                      <Badge className="gradient-primary text-primary-foreground">
                        Nouveau
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {format(news.date, "d MMMM yyyy", { locale: fr })}
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

        {/* Empty state if no news */}
        {newsItems.length === 0 && (
          <Card className="glass">
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
        )}
      </div>
    </Layout>
  );
}
