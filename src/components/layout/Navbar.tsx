import { useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { usePendingAdminCount } from "@/hooks/usePendingAdminCount";
import {
  LogOut, User, Shield,
  Briefcase, Stethoscope, Globe,
  Users, FileText, Calendar, Brain,
  Dumbbell, ClipboardList, Video, Activity,
  Newspaper, Megaphone, GraduationCap, BookOpen,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavSubItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  key: string;
  label: string;
  icon: LucideIcon;
  btnClass: string;
  btnActiveClass: string;
  itemClass: string;
  itemActiveClass: string;
  items: NavSubItem[];
}

const navSections: NavSection[] = [
  {
    key: "cabinet",
    label: "Cabinet",
    icon: Briefcase,
    btnClass: "bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20",
    btnActiveClass: "bg-indigo-500/20 text-indigo-600",
    itemClass: "text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-600",
    itemActiveClass: "bg-indigo-500/20 text-indigo-600 font-medium",
    items: [
      { label: "Patients", href: "/patients", icon: Users },
      { label: "Notes", href: "/notes", icon: FileText },
      { label: "Planning", href: "/planning", icon: Calendar },
      { label: "IA Diagnostic", href: "/ia-diagnostic", icon: Brain },
    ],
  },
  {
    key: "reeducation",
    label: "Rééducation",
    icon: Stethoscope,
    btnClass: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20",
    btnActiveClass: "bg-emerald-500/20 text-emerald-600",
    itemClass: "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600",
    itemActiveClass: "bg-emerald-500/20 text-emerald-600 font-medium",
    items: [
      { label: "Exercices", href: "/exercices", icon: Dumbbell },
      { label: "Traitements", href: "/traitement-type", icon: ClipboardList },
      { label: "Séances", href: "/seance-type", icon: ClipboardList },
      { label: "Vidéos", href: "/videos", icon: Video },
      { label: "Pathologies", href: "/pathologies", icon: Activity },
    ],
  },
  {
    key: "communaute",
    label: "Communauté",
    icon: Globe,
    btnClass: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20",
    btnActiveClass: "bg-amber-500/20 text-amber-600",
    itemClass: "text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600",
    itemActiveClass: "bg-amber-500/20 text-amber-600 font-medium",
    items: [
      { label: "Actualités", href: "/news", icon: Newspaper },
      { label: "Annonces", href: "/annonces", icon: Megaphone },
      { label: "Formation", href: "/formation", icon: GraduationCap },
      { label: "Annuaire", href: "/annuaire", icon: BookOpen },
    ],
  },
];

function getCurrentSection(pathname: string): string | null {
  for (const section of navSections) {
    if (section.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"))) {
      return section.key;
    }
  }
  return null;
}

export function Navbar() {
  const { user, signOut, isAdmin } = useAuth();
  const pendingAdminCount = usePendingAdminCount();
  const navigate = useNavigate();
  const location = useLocation();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();

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

  const openDropdown = (key: string) => {
    clearTimeout(leaveTimer.current);
    setOpenSection(key);
  };

  const closeDropdown = () => {
    leaveTimer.current = setTimeout(() => setOpenSection(null), 150);
  };

  return (
    <nav className="sticky top-0 z-50 glass border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">P</span>
            </div>
            <span className="font-display font-bold text-xl text-foreground">PhysioOffice</span>
          </Link>

          {/* Section nav — desktop, logged-in only */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navSections.map((section) => {
                const Icon = section.icon;
                const isCurrentSection = currentSection === section.key;
                const isOpen = openSection === section.key;

                return (
                  <div
                    key={section.key}
                    className="relative"
                    onMouseEnter={() => openDropdown(section.key)}
                    onMouseLeave={closeDropdown}
                  >
                    <button
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isCurrentSection || isOpen ? section.btnActiveClass : section.btnClass
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {section.label}
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Dropdown */}
                    <div
                      className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-200 ${
                        isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
                      }`}
                    >
                      <div className="bg-card border border-border rounded-xl shadow-lg p-1.5 flex flex-col gap-0.5 min-w-44">
                        {section.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              to={item.href}
                              onClick={() => setOpenSection(null)}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                                isActive(item.href) ? section.itemActiveClass : section.itemClass
                              }`}
                            >
                              <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isAdmin && (
                <Link
                  to="/admin"
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ml-1 ${
                    isActive("/admin") ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Admin
                  {pendingAdminCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {pendingAdminCount}
                    </span>
                  )}
                </Link>
              )}
            </div>
          )}

          {/* Auth */}
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
