import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { usePendingAdminCount } from "@/hooks/usePendingAdminCount";
import { Home, Users, Dumbbell, Brain, FileText, MoreHorizontal, Calendar, ClipboardList, Video, Shield, User, LogOut } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function MobileBottomNav() {
  const { user, signOut, isAdmin } = useAuth();
  const pendingAdminCount = usePendingAdminCount();
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const mainNavItems = [
    { icon: Home, label: "Accueil", href: "/" },
    { icon: Users, label: "Patients", href: "/patients" },
    { icon: Calendar, label: "Séance", href: "/seance-type" },
    { icon: Dumbbell, label: "Exercices", href: "/exercices" },
  ];

  const moreNavItems = [
    { icon: Video, label: "Vidéos", href: "/videos" },
    { icon: ClipboardList, label: "Traitement", href: "/traitement-type" },
    { icon: Brain, label: "IA Diagnostic", href: "/ia-diagnostic" },
    { icon: FileText, label: "Notes", href: "/notes" },
  ];

  if (!user) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {mainNavItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px] ${
              isActive(item.href)
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}

        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px] ${
                isMoreOpen
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">Plus</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-3xl">
            <SheetHeader className="pb-4">
              <SheetTitle>Plus d'options</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-4 gap-4 pb-4">
              {moreNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsMoreOpen(false)}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-colors ${
                    isActive(item.href)
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="w-6 h-6" />
                  <span className="text-xs font-medium text-center">{item.label}</span>
                </Link>
              ))}
            </div>
            
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 mb-4"
              >
                <div className="relative">
                  <Shield className="w-5 h-5 text-primary" />
                  {pendingAdminCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {pendingAdminCount}
                    </span>
                  )}
                </div>
                <span className="font-medium">Administration</span>
                {pendingAdminCount > 0 && (
                  <span className="ml-auto text-xs text-destructive font-semibold">{pendingAdminCount} en attente</span>
                )}
              </Link>
            )}

            <div className="border-t pt-4 space-y-2">
              <Link
                to="/profile"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-3 p-4 rounded-xl hover:bg-muted transition-colors"
              >
                <User className="w-5 h-5" />
                <div className="flex-1">
                  <span className="font-medium">Mon profil</span>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </Link>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={async () => {
                  setIsMoreOpen(false);
                  await signOut();
                }}
              >
                <LogOut className="w-5 h-5" />
                Déconnexion
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
