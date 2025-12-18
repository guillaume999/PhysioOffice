import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Brain, FileText, ArrowRight, Sparkles, ClipboardList, Calendar, Dumbbell } from "lucide-react";
import { useAuth } from "@/lib/auth";

const features = [
  {
    title: "Liste Patients",
    description: "Gérez vos patients avec leurs informations complètes",
    icon: Users,
    href: "/patients",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Exercices",
    description: "Gérez vos exercices de rééducation",
    icon: Dumbbell,
    href: "/exercices",
    color: "from-green-500 to-emerald-500",
    bgColor: "bg-green-500/10",
  },
  {
    title: "IA Diagnostic",
    description: "Assistant IA pour l'analyse des symptômes",
    icon: Brain,
    href: "/ia-diagnostic",
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "Notes",
    description: "Créez et organisez vos notes médicales",
    icon: FileText,
    href: "/notes",
    color: "from-orange-500 to-amber-500",
    bgColor: "bg-orange-500/10",
  },
  {
    title: "Traitement Type",
    description: "Modèles de traitements standardisés",
    icon: ClipboardList,
    href: "/traitement-type",
    color: "from-rose-500 to-red-500",
    bgColor: "bg-rose-500/10",
  },
  {
    title: "Séance Type",
    description: "Modèles de séances prédéfinies",
    icon: Calendar,
    href: "/seance-type",
    color: "from-indigo-500 to-violet-500",
    bgColor: "bg-indigo-500/10",
  },
];

export default function Index() {
  const { user } = useAuth();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 gradient-primary opacity-5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6 animate-fade-up">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Plateforme médicale intelligente</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              Votre cabinet médical
              <span className="text-gradient block mt-2">simplifié</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: "0.2s" }}>
              Gérez vos patients, accédez à votre vidéothèque, utilisez l'IA pour vos diagnostics et organisez vos notes en un seul endroit.
            </p>
            
            {!user && (
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl gradient-primary text-primary-foreground font-semibold text-lg shadow-soft hover:shadow-glow transition-all duration-300 animate-fade-up"
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
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Une suite complète d'outils pour optimiser la gestion de votre cabinet médical
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {features.map((feature, index) => (
              <Link
                key={feature.title}
                to={user ? feature.href : "/auth"}
                className="group animate-fade-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <Card className="h-full border-2 border-transparent hover:border-primary/20 transition-all duration-300 hover:shadow-soft group-hover:-translate-y-1">
                  <CardHeader className="flex flex-row items-start gap-4">
                    <div className={`p-3 rounded-xl ${feature.bgColor}`}>
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center`}>
                        <feature.icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-display group-hover:text-primary transition-colors">
                        {feature.title}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {feature.description}
                      </CardDescription>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>

          {!user && (
            <div className="text-center mt-12">
              <p className="text-muted-foreground">
                Connectez-vous pour accéder à toutes les fonctionnalités
              </p>
            </div>
          )}
        </div>
      </section>

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
                Rejoignez les professionnels de santé qui utilisent déjà MediCabinet pour optimiser leur quotidien.
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
