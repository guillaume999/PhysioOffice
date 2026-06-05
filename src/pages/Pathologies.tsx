import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Activity, ArrowRight, Loader2 } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PagePopup } from "@/components/popup/PagePopup";

interface Pathologie {
  id: string;
  name: string;
  traitement: string | null;
}

export default function Pathologies() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pathologies, setPathologies] = useState<Pathologie[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await pb.collection("pathologies").getFullList({
        filter: `user = "${user.id}"`,
        sort: "name",
        fields: "id,name,traitement",
      });
      setPathologies(data as unknown as Pathologie[]);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      await pb.collection("pathologies").create({ user: user.id, name: newName.trim(), traitement: "" });
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

  const filtered = search.trim()
    ? pathologies.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : pathologies;

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

        {/* Création + Recherche */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une pathologie..."
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
                    onClick={() => navigate(`/pathologies/${p.id}`)}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{p.name}</p>
                      {p.traitement?.trim() && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {p.traitement}
                        </p>
                      )}
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
