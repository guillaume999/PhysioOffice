import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { LogOut, User, Menu, X } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 glass border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">M</span>
            </div>
            <span className="font-display font-bold text-xl text-foreground">MediCabinet</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`font-medium transition-colors hover:text-primary ${
                isActive("/") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Accueil
            </Link>
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
                  to="/videos"
                  className={`font-medium transition-colors hover:text-primary ${
                    isActive("/videos") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Vidéos
                </Link>
                <Link
                  to="/ia-diagnostic"
                  className={`font-medium transition-colors hover:text-primary ${
                    isActive("/ia-diagnostic") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  IA Diagnostic
                </Link>
                <Link
                  to="/notes"
                  className={`font-medium transition-colors hover:text-primary ${
                    isActive("/notes") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Notes
                </Link>
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

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t animate-fade-in">
            <div className="flex flex-col gap-4">
              <Link
                to="/"
                className="font-medium text-foreground hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Accueil
              </Link>
              {user && (
                <>
                  <Link
                    to="/patients"
                    className="font-medium text-foreground hover:text-primary transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Patients
                  </Link>
                  <Link
                    to="/videos"
                    className="font-medium text-foreground hover:text-primary transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Vidéos
                  </Link>
                  <Link
                    to="/ia-diagnostic"
                    className="font-medium text-foreground hover:text-primary transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    IA Diagnostic
                  </Link>
                  <Link
                    to="/notes"
                    className="font-medium text-foreground hover:text-primary transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Notes
                  </Link>
                </>
              )}
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="font-medium text-foreground hover:text-primary transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Mon Profil
                  </Link>
                  <Button variant="outline" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </Button>
                </>
              ) : (
                <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                  <Button className="w-full gradient-primary text-primary-foreground">
                    Connexion
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
