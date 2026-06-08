import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Brain, FileText, ArrowRight, Sparkles, ClipboardList, Calendar, Dumbbell, GraduationCap, Newspaper, Video, Megaphone, BookOpen, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PagePopup } from "@/components/popup/PagePopup";

const featureGroups = [
  {
    label: "Cabinet",
    items: [
      { title: "Patients", description: "Gérez vos patients avec leurs informations complètes", icon: Users, href: "/patients", color: "from-blue-500 to-cyan-500", bgColor: "bg-blue-500/10" },
      { title: "Notes", description: "Créez et organisez vos notes médicales", icon: FileText, href: "/notes", color: "from-orange-500 to-amber-500", bgColor: "bg-orange-500/10" },
      { title: "Planning", description: "Organisez vos rendez-vous et votre emploi du temps", icon: Calendar, href: "/planning", color: "from-pink-500 to-rose-500", bgColor: "bg-pink-500/10" },
      { title: "IA Diagnostic", description: "Assistant IA pour l'analyse des symptômes", icon: Brain, href: "/ia-diagnostic", color: "from-emerald-500 to-teal-500", bgColor: "bg-emerald-500/10" },
    ],
  },
  {
    label: "Rééducation",
    items: [
      { title: "Exercices", description: "Bibliothèque d'exercices de rééducation", icon: Dumbbell, href: "/exercices", color: "from-violet-500 to-purple-500", bgColor: "bg-violet-500/10" },
      { title: "Traitements", description: "Protocoles de traitement personnalisés", icon: ClipboardList, href: "/traitement-type", color: "from-cyan-500 to-blue-500", bgColor: "bg-cyan-500/10" },
      { title: "Séances", description: "Créez et gérez vos séances de rééducation", icon: ClipboardList, href: "/seance-type", color: "from-indigo-500 to-blue-500", bgColor: "bg-indigo-500/10" },
      { title: "Vidéos", description: "Votre vidéothèque de techniques et exercices", icon: Video, href: "/videos", color: "from-red-500 to-orange-500", bgColor: "bg-red-500/10" },
      { title: "Pathologies & Traitements", description: "Liste de vos pathologies avec leur protocole de traitement", icon: Activity, href: "/pathologies", color: "from-fuchsia-500 to-pink-500", bgColor: "bg-fuchsia-500/10" },
    ],
  },
  {
    label: "Communauté",
    items: [
      { title: "Actualités", description: "Suivez les dernières nouvelles de la plateforme", icon: Newspaper, href: "/news", color: "from-rose-500 to-red-500", bgColor: "bg-rose-500/10", public: true },
      { title: "Annonces", description: "Offres d'emploi et remplacements entre kinés", icon: Megaphone, href: "/annonces", color: "from-yellow-500 to-orange-500", bgColor: "bg-yellow-500/10", public: true },
      { title: "Formation", description: "Développez vos compétences avec nos formations", icon: GraduationCap, href: "/formation", color: "from-purple-500 to-violet-500", bgColor: "bg-purple-500/10", public: true },
      { title: "Annuaire", description: "Trouvez un kinésithérapeute près de chez vous", icon: BookOpen, href: "/annuaire", color: "from-teal-500 to-cyan-500", bgColor: "bg-teal-500/10", public: true },
    ],
  },
];

export default function Index() {
  const { user } = useAuth();

  return (
    <Layout>
      <PagePopup pageKey="home" />
      <section className="relative overflow-hidden py-6 md:py-10 lg:py-16">
        <div className="absolute inset-0 gradient-primary opacity-5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4 md:mb-6 animate-fade-up">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Plateforme médicale intelligente</span>
            </div>

            <h1 className="text-3xl md:text-5xl lg:text-7xl font-display font-bold mb-4 md:mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              Votre cabinet kiné
              <span className="text-gradient block mt-2">simplifié</span>
            </h1>

            <p className="text-base md:text-xl text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto animate-fade-up px-4" style={{ animationDelay: "0.2s" }}>
              Gérez vos patients, accédez à votre vidéothèque, utilisez l'IA pour vos diagnostics et organisez vos notes en un seul endroit.
            </p>

            {!user && (
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 rounded-xl gradient-primary text-primary-foreground font-semibold text-base md:text-lg shadow-soft hover:shadow-glow transition-all duration-300 animate-fade-up"
                style={{ animationDelay: "0.3s" }}
              >
                Commencer maintenant
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
          </div>

        </div>
      </section>

      {/* Features Grid */}
      <div className="py-6 md:py-10 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-display font-bold mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
              Une suite complète d'outils pour optimiser la gestion de votre cabinet médical
            </p>
          </div>

          <div className="flex flex-col gap-6 md:gap-8 max-w-4xl mx-auto">
            {featureGroups.map((group) => (
              <div key={group.label} className="rounded-2xl border-2 border-border bg-card/50 p-4 md:p-6">
                <h3 className="text-lg md:text-xl font-display font-semibold mb-4 text-foreground">{group.label}</h3>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {group.items.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <Link
                        key={feature.title}
                        to={user || (feature as any).public ? feature.href : "/auth"}
                        className="group"
                      >
                        <Card className="h-full border-2 border-transparent hover:border-primary/20 transition-all duration-300 hover:shadow-soft group-hover:-translate-y-1">
                          <CardHeader className="flex flex-col md:flex-row items-start gap-3 md:gap-4 p-4 md:p-6">
                            <div className={`p-2 md:p-3 rounded-xl ${feature.bgColor}`}>
                              <div className={`w-6 h-6 md:w-8 md:h-8 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center`}>
                                <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-sm md:text-xl font-display group-hover:text-primary transition-colors leading-tight">
                                {feature.title}
                              </CardTitle>
                              <CardDescription className="mt-1 md:mt-2 text-xs md:text-sm line-clamp-2">
                                {feature.description}
                              </CardDescription>
                            </div>
                            <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all hidden md:block" />
                          </CardHeader>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {!user && (
            <div className="text-center mt-8 md:mt-12">
              <p className="text-muted-foreground text-sm">
                Connectez-vous pour accéder à toutes les fonctionnalités
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="relative rounded-3xl overflow-hidden gradient-primary p-8 md:p-16">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            
            <div className="relative z-10 text-center text-primary-foreground">
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
                Prêt à transformer votre pratique ?
              </h2>
              <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
                Rejoignez les professionnels de santé qui utilisent déjà PhysioOffice pour optimiser leur quotidien.
              </p>
              {!user && (
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-primary font-semibold hover:bg-white/90 transition-colors"
                >
                  Créer un compte gratuit
                  <ArrowRight className="w-5 h-5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
