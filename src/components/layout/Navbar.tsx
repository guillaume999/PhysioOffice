import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useAdmin } from "@/hooks/useAdmin";
import { LogOut, User, Shield } from "lucide-react";

const sections: Record<string, { label: string; href: string }[]> = {
  cabinet: [
      { label: "Patients", href: "/patients" },
      { label: "Notes", href: "/notes" },
      { label: "Planning", href: "/planning" },
      { label: "IA Diagnostic", href: "/ia-diagnostic" },
  ],
  reeducation: [
      { label: "Exercices", href: "/exercices" },
      { label: "Traitements", href: "/traitement-type" },
      { label: "Séances", href: "/seance-type" },
      { label: "Vidéos", href: "/videos" },
  ],
  communaute: [
      { label: "Actualités", href: "/news" },
      { label: "Annonces", href: "/annonces" },
      { label: "Formation", href: "/formation" },
      { label: "Annuaire", href: "/annuaire" },
  ],
};

function getCurrentSection(pathname: string): string | null {
  for (const [key, routes] of Object.entries(sections)) {
    if (routes.some((r) => pathname === r.href || pathname.startsWith(r.href + "/"))) {
      return key;
    }
  }
  return null;
}

export function Navbar() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const currentSection = getCurrentSection(location.pathname);
  const sectionLinks = currentSection ? sections[currentSection] : [];

  return (
    <nav className="sticky top-0 z-50 glass border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">P</span>
            </div>
            <span className="font-display font-bold text-xl text-foreground">PhysioOffice</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {sectionLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.href)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user && isAdmin && (
              <Link
                to="/admin"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ml-2 ${
                  isActive("/admin") ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-muted"
                >
                  <User className="w-4 h-4" />
                </Link>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            ) : (
              <Link to="/auth">
                <Button className="gradient-primary text-primary-foreground">
                  Connexion
                </Button>
              </Link>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
