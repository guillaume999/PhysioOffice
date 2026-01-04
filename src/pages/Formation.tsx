import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Play, Clock, BookOpen, Award, Video } from "lucide-react";
import { PagePopup } from "@/components/popup/PagePopup";

const formations = [
  {
    id: 1,
    title: "Rééducation de l'épaule",
    description: "Apprenez les techniques de rééducation pour les pathologies de l'épaule",
    duration: "2h30",
    modules: 8,
    level: "Intermédiaire",
    category: "Membre supérieur",
  },
  {
    id: 2,
    title: "Prise en charge du rachis lombaire",
    description: "Formation complète sur le traitement des lombalgies",
    duration: "3h00",
    modules: 12,
    level: "Avancé",
    category: "Rachis",
  },
  {
    id: 3,
    title: "Rééducation post-opératoire du genou",
    description: "Protocoles de rééducation après chirurgie du genou (LCA, prothèse...)",
    duration: "2h00",
    modules: 6,
    level: "Intermédiaire",
    category: "Membre inférieur",
  },
  {
    id: 4,
    title: "Introduction à la thérapie manuelle",
    description: "Les bases de la thérapie manuelle en kinésithérapie",
    duration: "1h30",
    modules: 5,
    level: "Débutant",
    category: "Thérapie manuelle",
  },
];

export default function Formation() {
  return (
    <Layout>
      <PagePopup pageKey="formation" />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Formation</h1>
              <p className="text-muted-foreground">
                Développez vos compétences avec nos formations en ligne
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="glass">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formations.length}</p>
                <p className="text-sm text-muted-foreground">Formations</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">31</p>
                <p className="text-sm text-muted-foreground">Modules</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">9h</p>
                <p className="text-sm text-muted-foreground">De contenu</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-sm text-muted-foreground">Complétées</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Formations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {formations.map((formation) => (
            <Card key={formation.id} className="glass hover:shadow-lg transition-shadow overflow-hidden">
              <div className="h-32 gradient-primary flex items-center justify-center">
                <GraduationCap className="w-16 h-16 text-primary-foreground/50" />
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary">{formation.category}</Badge>
                  <Badge variant="outline">{formation.level}</Badge>
                </div>
                <CardTitle className="text-lg">{formation.title}</CardTitle>
                <CardDescription>{formation.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formation.duration}
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    {formation.modules} modules
                  </div>
                </div>
                <Button className="w-full gradient-primary text-primary-foreground">
                  <Play className="w-4 h-4 mr-2" />
                  Commencer
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Coming Soon */}
        <Card className="glass mt-8">
          <CardContent className="p-8 text-center">
            <GraduationCap className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Plus de formations à venir
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Nous travaillons sur de nouvelles formations pour vous aider à développer vos compétences. 
              Restez à l'écoute !
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
