import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import Index from "@/pages/Index";

/**
 * Page d'entrée du site :
 * - utilisateur authentifié -> redirection vers la liste des patients
 * - visiteur -> page d'accueil publique
 * Le hub d'accueil reste accessible aux connectés via /accueil.
 */
export function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return <Navigate to="/patients" replace />;

  return <Index />;
}
