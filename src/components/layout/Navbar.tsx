import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useAdmin } from "@/hooks/useAdmin";
import { LogOut, User, Shield } from "lucide-react";

const sectionRoutes: Record<string, { label: string; href: string }[]> = {
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
  for (const [section, routes] of Object.entries(sectionRoutes)) {
    if (routes.some((r) => pathname === r.href || pathname.startsWith(r.href + "/"))) {
      return section;
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
  const sectionLinks = currentSection ? sectionRoutes[currentSection] : [];

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
          <div className="hidden md:flex items-center gap-6">
            {sectionLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`font-medium transition-colors hover:text-primary ${
                  isActive(link.href) ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user && isAdmin && (
              <Link
                to="/admin"
                className={`font-medium transition-colors hover:text-primary flex items-center gap-1 ${
                  isActive("/admin") ? "text-primary" : "text-muted-foreground"
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
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span>{user.email}</span>
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
