import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useAdmin } from "@/hooks/useAdmin";
import { LogOut, User, Shield } from "lucide-react";

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
            {user && (
              <>
                <Link
                  to="/patients"
                  className={`font-medium transition-colors hover:text-primary ${
                    isActive("/patients") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Patients
                </Link>
                <Link
                  to="/notes"
                  className={`font-medium transition-colors hover:text-primary ${
                    isActive("/notes") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Notes
                </Link>
                <Link
                  to="/ia-diagnostic"
                  className={`font-medium transition-colors hover:text-primary ${
                    isActive("/ia-diagnostic") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  IA Diag
                </Link>
                <Link
                  to="/news"
                  className={`font-medium transition-colors hover:text-primary ${
                    isActive("/news") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  News
                </Link>
                <Link
                  to="/seance-type"
                  className={`font-medium transition-colors hover:text-primary ${
                    isActive("/seance-type") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Séance
                </Link>
                <Link
                  to="/exercices"
                  className={`font-medium transition-colors hover:text-primary ${
                    isActive("/exercices") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Exercices
                </Link>
                <Link
                  to="/traitement-type"
                  className={`font-medium transition-colors hover:text-primary ${
                    isActive("/traitement-type") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  TTT
                </Link>
                <Link
                  to="/formation"
                  className={`font-medium transition-colors hover:text-primary ${
                    isActive("/formation") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Formation
                </Link>
                {isAdmin && (
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
              </>
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
