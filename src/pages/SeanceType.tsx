import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Heart, MessageCircle, Trash2, Search, Users, User, Shield, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface SeanceType {
  id: string;
  pathologie: string;
  objectif_principal: string;
  objectif_secondaire: string | null;
  author_name: string | null;
  is_shared: boolean;
  is_copy: boolean;
  is_validated: boolean;
  original_id: string | null;
  user_id: string;
  created_at: string;
  exercices?: SeanceExercice[];
  likes_count?: number;
  comments_count?: number;
  user_liked?: boolean;
}

interface SeanceExercice {
  id: string;
  ordre: number;
  name: string | null;
  description: string | null;
  repetitions: number | null;
  duration_seconds: number | null;
}

type FilterType = "mine" | "platform" | "shared";

export default function SeanceType() {
  const { user } = useAuth();
  const [userCanShare, setUserCanShare] = useState<boolean>(true);
  const [seances, setSeances] = useState<SeanceType[]>([]);
  const [filteredSeances, setFilteredSeances] = useState<SeanceType[]>([]);
  const [featuredSeanceIds, setFeaturedSeanceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter and search state
  const [filter, setFilter] = useState<FilterType>("mine");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [seances, filter, searchQuery, user, featuredSeanceIds]);

  const applyFilters = () => {
    let result = [...seances];

    // Get IDs of originals that the user has copied (for hiding in shared view)
    const userCopiedOriginalIds = seances
      .filter((s) => s.is_copy && s.user_id === user?.id && s.original_id)
      .map((s) => s.original_id);

    // Filter out originals that user has already copied (in shared view)
    if (filter === "shared") {
      result = result.filter((s) => !userCopiedOriginalIds.includes(s.id));
    }

    // Apply filter type
    if (filter === "mine") {
      result = result.filter((s) => s.user_id === user?.id);
    } else if (filter === "platform") {
      result = result.filter((s) => featuredSeanceIds.includes(s.id));
    } else if (filter === "shared") {
      result = result.filter((s) => 
        s.is_shared && 
        s.is_validated &&
        s.user_id !== user?.id && 
        !featuredSeanceIds.includes(s.id)
      );
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.author_name?.toLowerCase().includes(query) ||
          s.pathologie.toLowerCase().includes(query) ||
          s.objectif_principal.toLowerCase().includes(query)
      );
    }

    setFilteredSeances(result);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("can_share")
        .eq("user_id", user!.id)
        .maybeSingle();
      
      setUserCanShare(profileData?.can_share !== false);

      // Fetch featured seances
      const { data: featuredData } = await supabase
        .from("featured_seances")
        .select("seance_type_id");
      setFeaturedSeanceIds(featuredData?.map((f) => f.seance_type_id) || []);

      // Fetch seance types
      const { data: seancesData, error: seancesError } = await supabase
        .from("seance_types")
        .select("*")
        .order("created_at", { ascending: false });

      if (seancesError) throw seancesError;

      // Fetch exercices for each seance
      const seancesWithDetails = await Promise.all(
        (seancesData || []).map(async (seance) => {
          const { data: exercicesData } = await supabase
            .from("seance_exercices")
            .select("*")
            .eq("seance_type_id", seance.id)
            .order("ordre");

          const { count: likesCount } = await supabase
            .from("seance_likes")
            .select("*", { count: "exact", head: true })
            .eq("seance_type_id", seance.id);

          const { count: commentsCount } = await supabase
            .from("seance_comments")
            .select("*", { count: "exact", head: true })
            .eq("seance_type_id", seance.id);

          const { data: userLike } = await supabase
            .from("seance_likes")
            .select("id")
            .eq("seance_type_id", seance.id)
            .eq("user_id", user?.id)
            .maybeSingle();

          return {
            ...seance,
            exercices: exercicesData || [],
            likes_count: likesCount || 0,
            comments_count: commentsCount || 0,
            user_liked: !!userLike
          };
        })
      );

      setSeances(seancesWithDetails);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const toggleShare = async (seanceId: string, currentlyShared: boolean, isCopy: boolean, isValidated: boolean) => {
    if (isCopy) {
      toast.error("Les copies ne peuvent pas être partagées");
      return;
    }
    if (!userCanShare) {
      toast.error("Vous n'avez pas la permission de partager du contenu");
      return;
    }
    if (isValidated && currentlyShared) {
      toast.error("Cette séance a été validée et ne peut plus être modifiée");
      return;
    }
    try {
      await supabase
        .from("seance_types")
        .update({ is_shared: !currentlyShared, is_validated: false })
        .eq("id", seanceId);
      
      toast.success(currentlyShared ? "Séance non partagée" : "Séance partagée (en attente de validation)");
      fetchData();
    } catch (error) {
      console.error("Error toggling share:", error);
      toast.error("Erreur lors du partage");
    }
  };

  const handleLike = async (seanceId: string, currentlyLiked: boolean) => {
    if (!user) return;

    try {
      if (currentlyLiked) {
        await supabase
          .from("seance_likes")
          .delete()
          .eq("seance_type_id", seanceId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("seance_likes")
          .insert({ seance_type_id: seanceId, user_id: user.id });
      }
      fetchData();
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const deleteSeance = async (id: string) => {
    try {
      await supabase.from("seance_types").delete().eq("id", id);
      toast.success("Séance supprimée");
      fetchData();
    } catch (error) {
      console.error("Error deleting seance:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const copySeance = async (seance: SeanceType) => {
    if (!user) return;

    try {
      // Fetch user pseudo
      const { data: profileData } = await supabase
        .from("profiles")
        .select("pseudo")
        .eq("user_id", user.id)
        .maybeSingle();

      // Create the seance copy
      const { data: newSeance, error: seanceError } = await supabase
        .from("seance_types")
        .insert({
          user_id: user.id,
          pathologie: seance.pathologie,
          objectif_principal: seance.objectif_principal,
          objectif_secondaire: seance.objectif_secondaire,
          author_name: seance.author_name,
          is_shared: false,
          is_copy: true,
          original_id: seance.id,
        })
        .select()
        .single();

      if (seanceError) throw seanceError;

      // Copy exercices
      if (seance.exercices && seance.exercices.length > 0) {
        for (const ex of seance.exercices) {
          await supabase.from("seance_exercices").insert({
            seance_type_id: newSeance.id,
            name: ex.name,
            description: ex.description,
            repetitions: ex.repetitions,
            duration_seconds: ex.duration_seconds,
            ordre: ex.ordre,
          });
        }
      }

      toast.success("Séance copiée dans votre bibliothèque");
      fetchData();
    } catch (error) {
      console.error("Error copying seance:", error);
      toast.error("Erreur lors de la copie");
    }
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10">
              <Calendar className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Séance Type</h1>
              <p className="text-muted-foreground">Gérez vos modèles de séances prédéfinies</p>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Filter Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filter === "mine" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("mine")}
                  className="gap-2"
                >
                  <User className="w-4 h-4" />
                  Mes séances
                </Button>
                <Button
                  variant={filter === "platform" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("platform")}
                  className="gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Plateforme
                </Button>
                <Button
                  variant={filter === "shared" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("shared")}
                  className="gap-2"
                >
                  <Users className="w-4 h-4" />
                  Partagées
                </Button>
              </div>

              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par auteur, pathologie ou objectif..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modèles de séances ({filteredSeances.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Chargement...</p>
            ) : filteredSeances.length === 0 ? (
              <p className="text-muted-foreground">Aucune séance type trouvée.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pathologie</TableHead>
                      <TableHead>Objectif Principal</TableHead>
                      <TableHead>Objectif Secondaire</TableHead>
                      <TableHead>Exercices</TableHead>
                      <TableHead>Interactions</TableHead>
                      <TableHead>Auteur</TableHead>
                      <TableHead>Partagée</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSeances.map((seance) => {
                      const isOwner = seance.user_id === user?.id;
                      const canShare = isOwner && !seance.is_copy;
                      return (
                      <TableRow key={seance.id}>
                        <TableCell>
                          <Badge variant="outline">{seance.pathologie}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{seance.objectif_principal}</Badge>
                        </TableCell>
                        <TableCell>
                          {seance.objectif_secondaire ? (
                            <Badge variant="outline">{seance.objectif_secondaire}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2 max-w-xs">
                            {seance.exercices?.map((ex, i) => (
                              <div key={ex.id} className="flex items-start gap-2 text-sm">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{ex.name || `Exercice ${i + 1}`}</p>
                                  {ex.description && (
                                    <p className="text-muted-foreground text-xs truncate">{ex.description}</p>
                                  )}
                                  {(ex.repetitions || ex.duration_seconds) && (
                                    <p className="text-muted-foreground text-xs">
                                      {ex.repetitions && `${ex.repetitions} reps`}
                                      {ex.repetitions && ex.duration_seconds && " - "}
                                      {ex.duration_seconds && `${ex.duration_seconds}s`}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {(!seance.exercices || seance.exercices.length === 0) && (
                              <span className="text-muted-foreground text-sm">Aucun exercice</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`gap-1 ${seance.user_liked ? "text-red-500" : ""}`}
                              onClick={() => handleLike(seance.id, seance.user_liked || false)}
                            >
                              <Heart className={`w-4 h-4 ${seance.user_liked ? "fill-current" : ""}`} />
                              {seance.likes_count}
                            </Button>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MessageCircle className="w-4 h-4" />
                              {seance.comments_count}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{seance.author_name || "Anonyme"}</span>
                          {seance.is_copy && (
                            <Badge variant="outline" className="ml-2 text-xs">Copie</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {canShare ? (
                            <>
                              <Checkbox
                                checked={seance.is_shared}
                                onCheckedChange={() => toggleShare(seance.id, seance.is_shared, seance.is_copy || false, seance.is_validated || false)}
                                disabled={seance.is_validated && seance.is_shared}
                              />
                              {seance.is_shared && seance.is_validated && (
                                <Badge className="ml-2 text-xs bg-green-500">Validé</Badge>
                              )}
                              {seance.is_shared && !seance.is_validated && (
                                <Badge variant="secondary" className="ml-2 text-xs bg-orange-500">En attente</Badge>
                              )}
                            </>
                          ) : isOwner && seance.is_copy ? (
                            <span className="text-xs text-muted-foreground">Non partageable</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Badge variant={seance.is_shared ? "default" : "outline"}>
                                {seance.is_shared ? "Oui" : "Non"}
                              </Badge>
                              {seance.is_shared && seance.is_validated && (
                                <Badge className="text-xs bg-green-500">Validé</Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!isOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copySeance(seance)}
                                title="Copier dans ma bibliothèque"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            )}
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => deleteSeance(seance.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
