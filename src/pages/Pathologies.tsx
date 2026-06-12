import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Activity, ArrowRight, Loader2, User, Shield, Users } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PagePopup } from "@/components/popup/PagePopup";

interface Pathologie {
  id: string;
  name: string;
  traitement: string | null;
  user_id: string;
  is_shared?: boolean;
  is_validated?: boolean;
  is_copy?: boolean;
  is_hidden_from_list?: boolean;
  original_id?: string | null;
  author_name?: string | null;
}

type FilterType = "mine" | "platform" | "shared";

export default function Pathologies() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [pathologies, setPathologies] = useState<Pathologie[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("mine");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Restaure l'onglet et la recherche à partir de sessionStorage si on revient d'un détail.
  useEffect(() => {
    const raw = sessionStorage.getItem("pathologies_nav_ctx");
    if (raw) {
      try {
        const ctx = JSON.parse(raw);
        if (ctx.filter === "mine" || ctx.filter === "platform" || ctx.filter === "shared") {
          setFilter(ctx.filter);
        }
        if (typeof ctx.search === "string") setSearch(ctx.search);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Pathologies — toutes celles visibles par cet utilisateur (siennes + partagées)
      const data = await pb.collection("pathologies").getFullList({
        sort: "name",
        fields: "id,user,name,traitement,is_shared,is_validated,is_copy,is_hidden_from_list,original,author_name",
      });

      // Featured pathologies (plateforme) — la collection peut ne pas exister encore
      let featured: any[] = [];
      try {
        featured = await pb.collection("featured_pathologies").getFullList({ fields: "pathologie" });
      } catch {
        featured = [];
      }
      setFeaturedIds(featured.map((f: any) => f.pathologie));

      setPathologies(
        (data as any[]).map((r) => ({
          id: r.id,
          name: r.name,
          traitement: r.traitement || null,
          user_id: r.user,
          is_shared: !!r.is_shared,
          is_validated: !!r.is_validated,
          is_copy: !!r.is_copy,
          is_hidden_from_list: !!r.is_hidden_from_list,
          original_id: r.original ?? null,
          author_name: r.author_name ?? null,
        }))
      );
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    if (creating) return;
    setCreating(true);
    try {
      const pseudo = (pb.authStore.record as any)?.pseudo || null;
      await pb.collection("pathologies").create({
        user: user.id,
        name: newName.trim(),
        traitement: "",
        author_name: pseudo,
        is_shared: false,
        is_validated: false,
        is_copy: false,
      });
      toast.success("Pathologie créée");
      setNewName("");
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  // Filtre + recherche, à la manière de la page Exercices
  const userCopiedOriginalIds = pathologies
    .filter((p) => p.is_copy && p.user_id === user?.id && p.original_id)
    .map((p) => p.original_id);

  const filtered = pathologies.filter((p) => {
    // Visibilité globale : les non-admins ne voient jamais les pathologies marquées is_hidden_from_list.
    if (!isAdmin && p.is_hidden_from_list) return false;

    // Filter type
    if (filter === "mine") {
      if (p.user_id !== user?.id) return false;
    } else if (filter === "platform") {
      if (!featuredIds.includes(p.id)) return false;
    } else if (filter === "shared") {
      if (!p.is_shared || !p.is_validated) return false;
      if (p.user_id === user?.id) return false;
      if (featuredIds.includes(p.id)) return false;
      if (userCopiedOriginalIds.includes(p.id)) return false;
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.author_name || "").toLowerCase().includes(q)) return false;
    }

    return true;
  });

  // Pour les non-admins, on exclut les pathologies masquées (is_hidden_from_list) des compteurs.
  const visibleForCounts = pathologies.filter((p) => isAdmin || !p.is_hidden_from_list);
  const counts = {
    mine: visibleForCounts.filter((p) => p.user_id === user?.id).length,
    platform: visibleForCounts.filter((p) => featuredIds.includes(p.id)).length,
    shared: visibleForCounts.filter(
      (p) =>
        p.is_shared &&
        p.is_validated &&
        p.user_id !== user?.id &&
        !featuredIds.includes(p.id) &&
        !userCopiedOriginalIds.includes(p.id)
    ).length,
  };

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Connectez-vous pour accéder à cette page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PagePopup pageKey="pathologies" />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-fuchsia-500/10">
              <Activity className="w-8 h-8 text-fuchsia-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Pathologies & Traitements</h1>
              <p className="text-muted-foreground">
                {pathologies.length} pathologie(s) — cliquez sur l'une d'elles pour gérer son protocole de traitement.
              </p>
            </div>
          </div>
        </div>

        {/* Filtres + Recherche + Création */}
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filter === "mine" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("mine")}
                className="gap-2"
              >
                <User className="w-4 h-4" />
                Mes pathologies ({counts.mine})
              </Button>
              <Button
                variant={filter === "platform" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("platform")}
                className="gap-2"
              >
                <Shield className="w-4 h-4" />
                PhysioOffice ({counts.platform})
              </Button>
              <Button
                variant={filter === "shared" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("shared")}
                className="gap-2"
              >
                <Users className="w-4 h-4" />
                Partagés ({counts.shared})
              </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou auteur..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-1">
                <Input
                  placeholder="Nouvelle pathologie..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Créer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liste ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune pathologie.</p>
            ) : (
              <div className="grid gap-2">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      // Sauvegarde le contexte (onglet, recherche, ordre des ids visibles)
                      // pour permettre au détail d'offrir la navigation prev/next et au retour
                      // de restaurer le bon onglet.
                      sessionStorage.setItem(
                        "pathologies_nav_ctx",
                        JSON.stringify({
                          filter,
                          search,
                          orderedIds: filtered.map((x) => x.id),
                        })
                      );
                      navigate(`/pathologies/${p.id}`);
                    }}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{p.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {p.author_name && <span>par {p.author_name}</span>}
                        {p.traitement?.trim() && (
                          <span className="line-clamp-1">{p.traitement}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
