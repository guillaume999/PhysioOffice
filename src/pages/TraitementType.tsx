import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardList, Plus, Trash2, Video, X, Search, Users, User, Shield, Copy, Play, FileText, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface TraitementType {
  id: string;
  pathologie: string;
  author_name: string | null;
  is_shared: boolean;
  is_copy: boolean;
  is_validated: boolean;
  original_id: string | null;
  user_id: string;
  created_at: string;
  tests?: TraitementTest[];
  seances?: TraitementSeance[];
}

interface TraitementTest {
  id: string;
  description: string;
  ordre: number;
}

interface TraitementSeance {
  id: string;
  seance_type_id: string;
  ordre: number;
  seance?: {
    id: string;
    pathologie: string;
    objectif_principal: string;
  };
}

interface VideoOption {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
}

interface SeanceOption {
  id: string;
  pathologie: string;
  objectif_principal: string;
}

type FilterType = "all" | "mine" | "shared";

export default function TraitementType() {
  const { user } = useAuth();
  const [userPseudo, setUserPseudo] = useState<string | null>(null);
  const [userCanShare, setUserCanShare] = useState<boolean>(true);
  const [traitements, setTraitements] = useState<TraitementType[]>([]);
  const [filteredTraitements, setFilteredTraitements] = useState<TraitementType[]>([]);
  const [pathologies, setPathologies] = useState<string[]>([]);
  const [videos, setVideos] = useState<VideoOption[]>([]);
  const [seancesOptions, setSeancesOptions] = useState<SeanceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testDetailDialog, setTestDetailDialog] = useState<TraitementTest | null>(null);
  const [videoDialog, setVideoDialog] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    pathologie: "",
    newPathologie: "",
    tests: [] as { description: string }[],
    seances: [] as string[]
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [traitements, filter, searchQuery, user]);

  const applyFilters = () => {
    let result = [...traitements];

    // Get IDs of originals that the user has copied
    const userCopiedOriginalIds = traitements
      .filter((t) => t.is_copy && t.user_id === user?.id && t.original_id)
      .map((t) => t.original_id);

    // Filter out originals that user has already copied
    result = result.filter((t) => !userCopiedOriginalIds.includes(t.id));

    // Filter out copies from other users
    result = result.filter((t) => {
      // Keep if not a copy
      if (!t.is_copy) return true;
      // Keep if it's the user's own copy
      if (t.user_id === user?.id) return true;
      // Hide copies from other users
      return false;
    });

    if (filter === "mine") {
      result = result.filter((t) => t.user_id === user?.id);
    } else if (filter === "shared") {
      result = result.filter((t) => t.is_shared && t.user_id !== user?.id);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.author_name?.toLowerCase().includes(query) ||
          t.pathologie.toLowerCase().includes(query)
      );
    }

    setFilteredTraitements(result);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user pseudo
      const { data: profileData } = await supabase
        .from("profiles")
        .select("pseudo, can_share")
        .eq("user_id", user!.id)
        .single();
      
      setUserPseudo(profileData?.pseudo || null);
      setUserCanShare(profileData?.can_share !== false);

      const { data: traitementsData, error: traitementsError } = await supabase
        .from("traitement_types")
        .select("*")
        .order("created_at", { ascending: false });

      if (traitementsError) throw traitementsError;

      const traitementsWithDetails = await Promise.all(
        (traitementsData || []).map(async (traitement) => {
          const { data: testsData } = await supabase
            .from("traitement_tests")
            .select("*")
            .eq("traitement_type_id", traitement.id)
            .order("ordre");

          const { data: seancesData } = await supabase
            .from("traitement_seances")
            .select("*, seance_types(id, pathologie, objectif_principal)")
            .eq("traitement_type_id", traitement.id)
            .order("ordre");

          return {
            ...traitement,
            tests: testsData || [],
            seances: seancesData?.map((s) => ({
              ...s,
              seance: s.seance_types
            })) || []
          };
        })
      );

      setTraitements(traitementsWithDetails);

      const { data: pathoData } = await supabase.from("pathologies").select("name");
      setPathologies([...new Set(pathoData?.map((p) => p.name) || [])]);

      const { data: seancesData } = await supabase
        .from("seance_types")
        .select("id, pathologie, objectif_principal");
      setSeancesOptions(seancesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    const pathologie = formData.newPathologie || formData.pathologie;

    if (!pathologie) {
      toast.error("Pathologie requise");
      return;
    }

    try {
      const { data: traitementData, error: traitementError } = await supabase
        .from("traitement_types")
        .insert({
          user_id: user.id,
          pathologie,
          author_name: userPseudo,
          is_shared: false
        })
        .select()
        .single();

      if (traitementError) throw traitementError;

      if (formData.newPathologie) {
        await supabase.from("pathologies").insert({ user_id: user.id, name: formData.newPathologie });
      }

      for (let i = 0; i < formData.tests.length; i++) {
        const test = formData.tests[i];
        await supabase.from("traitement_tests").insert({
          traitement_type_id: traitementData.id,
          description: test.description,
          ordre: i
        });
      }

      for (let i = 0; i < formData.seances.length; i++) {
        await supabase.from("traitement_seances").insert({
          traitement_type_id: traitementData.id,
          seance_type_id: formData.seances[i],
          ordre: i
        });
      }

      toast.success("Traitement type créé avec succès");
      setDialogOpen(false);
      setFormData({
        pathologie: "",
        newPathologie: "",
        tests: [],
        seances: []
      });
      fetchData();
    } catch (error) {
      console.error("Error creating traitement:", error);
      toast.error("Erreur lors de la création");
    }
  };

  const toggleShare = async (traitementId: string, currentlyShared: boolean, isCopy: boolean, isValidated: boolean) => {
    if (isCopy) {
      toast.error("Les copies ne peuvent pas être partagées");
      return;
    }
    if (!userCanShare) {
      toast.error("Vous n'avez pas la permission de partager du contenu");
      return;
    }
    if (isValidated && currentlyShared) {
      toast.error("Ce traitement a été validé et ne peut plus être modifié");
      return;
    }
    try {
      await supabase
        .from("traitement_types")
        .update({ is_shared: !currentlyShared, is_validated: false })
        .eq("id", traitementId);

      toast.success(currentlyShared ? "Traitement non partagé" : "Traitement partagé (en attente de validation)");
      fetchData();
    } catch (error) {
      console.error("Error toggling share:", error);
      toast.error("Erreur lors du partage");
    }
  };

  const deleteTraitement = async (id: string) => {
    try {
      await supabase.from("traitement_types").delete().eq("id", id);
      toast.success("Traitement supprimé");
      fetchData();
    } catch (error) {
      console.error("Error deleting traitement:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const copyTraitement = async (traitement: TraitementType) => {
    if (!user) return;

    try {
      const { data: newTraitement, error: traitementError } = await supabase
        .from("traitement_types")
        .insert({
          user_id: user.id,
          pathologie: traitement.pathologie,
          author_name: traitement.author_name,
          is_shared: false,
          is_copy: true,
          original_id: traitement.id
        })
        .select()
        .single();

      if (traitementError) throw traitementError;

      if (traitement.tests && traitement.tests.length > 0) {
        for (const test of traitement.tests) {
          await supabase.from("traitement_tests").insert({
            traitement_type_id: newTraitement.id,
            description: test.description,
            ordre: test.ordre
          });
        }
      }

      if (traitement.seances && traitement.seances.length > 0) {
        for (const seance of traitement.seances) {
          await supabase.from("traitement_seances").insert({
            traitement_type_id: newTraitement.id,
            seance_type_id: seance.seance_type_id,
            ordre: seance.ordre
          });
        }
      }

      toast.success("Traitement copié dans votre bibliothèque");
      fetchData();
    } catch (error) {
      console.error("Error copying traitement:", error);
      toast.error("Erreur lors de la copie");
    }
  };

  const addTest = () => {
    setFormData({
      ...formData,
      tests: [...formData.tests, { description: "" }]
    });
  };

  const removeTest = (index: number) => {
    setFormData({
      ...formData,
      tests: formData.tests.filter((_, i) => i !== index)
    });
  };

  const updateTest = (index: number, field: string, value: string) => {
    const updated = [...formData.tests];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, tests: updated });
  };

  const toggleSeance = (seanceId: string) => {
    if (formData.seances.includes(seanceId)) {
      setFormData({
        ...formData,
        seances: formData.seances.filter((id) => id !== seanceId)
      });
    } else {
      setFormData({
        ...formData,
        seances: [...formData.seances, seanceId]
      });
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
            <div className="p-3 rounded-xl bg-rose-500/10">
              <ClipboardList className="w-8 h-8 text-rose-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Traitement Type</h1>
              <p className="text-muted-foreground">Gérez vos modèles de traitements standardisés</p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nouveau traitement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer un traitement type</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {userPseudo ? (
                  <p className="text-sm text-muted-foreground">Auteur: <span className="font-medium text-foreground">{userPseudo}</span></p>
                ) : (
                  <p className="text-sm text-amber-600">Définissez votre pseudo dans votre profil pour qu'il apparaisse comme auteur</p>
                )}

                <div className="space-y-2">
                  <Label>Pathologie</Label>
                  <Select value={formData.pathologie} onValueChange={(v) => setFormData({ ...formData, pathologie: v, newPathologie: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner ou créer" />
                    </SelectTrigger>
                    <SelectContent>
                      {pathologies.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Créer nouveau</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.pathologie === "__new__" && (
                    <Input
                      placeholder="Nouvelle pathologie"
                      value={formData.newPathologie}
                      onChange={(e) => setFormData({ ...formData, newPathologie: e.target.value })}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Tests</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addTest}>
                      <Plus className="w-4 h-4 mr-1" /> Ajouter test
                    </Button>
                  </div>
                  {formData.tests.map((test, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Textarea
                          placeholder="Description du test"
                          value={test.description}
                          onChange={(e) => updateTest(index, "description", e.target.value)}
                          rows={2}
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeTest(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Séances associées</Label>
                  <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {seancesOptions.map((seance) => (
                      <div key={seance.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded">
                        <Checkbox
                          checked={formData.seances.includes(seance.id)}
                          onCheckedChange={() => toggleSeance(seance.id)}
                        />
                        <span className="text-sm">
                          {seance.pathologie} - {seance.objectif_principal}
                        </span>
                      </div>
                    ))}
                    {seancesOptions.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2">Aucune séance disponible</p>
                    )}
                  </div>
                </div>

                <Button onClick={handleSubmit} className="w-full">
                  Créer le traitement
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par pathologie ou auteur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("all")}
                  className="gap-1"
                >
                  <Users className="w-4 h-4" /> Tous
                </Button>
                <Button
                  variant={filter === "mine" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("mine")}
                  className="gap-1"
                >
                  <User className="w-4 h-4" /> Mes traitements
                </Button>
                <Button
                  variant={filter === "shared" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("shared")}
                  className="gap-1"
                >
                  <Shield className="w-4 h-4" /> Partagés
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modèles de traitements ({filteredTraitements.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Chargement...</p>
            ) : filteredTraitements.length === 0 ? (
              <p className="text-muted-foreground">Aucun traitement trouvé.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pathologie</TableHead>
                    <TableHead>Tests</TableHead>
                    <TableHead>Séances</TableHead>
                    <TableHead>Auteur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTraitements.map((traitement) => (
                    <TableRow key={traitement.id}>
                      <TableCell className="font-medium">{traitement.pathologie}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {traitement.tests?.map((test) => (
                            <Badge
                              key={test.id}
                              variant="outline"
                              className="cursor-pointer hover:bg-muted flex items-center gap-1"
                              onClick={() => setTestDetailDialog(test)}
                            >
                              <FileText className="w-3 h-3" />
                              {test.description.substring(0, 20)}...
                            </Badge>
                          ))}
                          {(!traitement.tests || traitement.tests.length === 0) && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {traitement.seances?.map((s) => (
                            <Badge key={s.id} variant="secondary" className="text-xs">
                              <Calendar className="w-3 h-3 mr-1" />
                              {s.seance?.objectif_principal?.substring(0, 15) || "Séance"}
                            </Badge>
                          ))}
                          {(!traitement.seances || traitement.seances.length === 0) && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{traitement.author_name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {traitement.is_copy && (
                            <Badge variant="outline" className="text-xs">Copie</Badge>
                          )}
                          {traitement.is_shared && traitement.is_validated && (
                            <Badge className="text-xs bg-green-500">Validé</Badge>
                          )}
                          {traitement.is_shared && !traitement.is_validated && (
                            <Badge variant="secondary" className="text-xs bg-orange-500">En attente</Badge>
                          )}
                          {traitement.user_id === user?.id && (
                            <Badge className="text-xs">Propriétaire</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {traitement.user_id === user?.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleShare(traitement.id, traitement.is_shared, traitement.is_copy || false, traitement.is_validated || false)}
                                title={traitement.is_copy ? "Les copies ne peuvent pas être partagées" : traitement.is_validated && traitement.is_shared ? "Validé - non modifiable" : (traitement.is_shared ? "Retirer du partage" : "Partager")}
                                disabled={(traitement.is_copy || false) || (traitement.is_validated && traitement.is_shared)}
                              >
                                <Users className={`w-4 h-4 ${traitement.is_shared ? "text-primary" : ""}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteTraitement(traitement.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyTraitement(traitement)}
                              title="Copier dans ma bibliothèque"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Test Detail Dialog */}
        <Dialog open={!!testDetailDialog} onOpenChange={() => setTestDetailDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Détail du test</DialogTitle>
            </DialogHeader>
            {testDetailDialog && (
              <div className="space-y-4">
                <p className="text-sm">{testDetailDialog.description}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Video Player Dialog */}
        <Dialog open={!!videoDialog} onOpenChange={() => setVideoDialog(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Vidéo</DialogTitle>
            </DialogHeader>
            {videoDialog && (
              <video
                src={videoDialog}
                controls
                autoPlay
                className="w-full rounded-lg"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
