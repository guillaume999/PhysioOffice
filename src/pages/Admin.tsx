import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdminPasswordConfirmDialog } from "@/components/admin/AdminPasswordConfirmDialog";
import { 
  Users, 
  FileText, 
  Search, 
  Crown, 
  Clock, 
  Trash2,
  Shield,
  CheckCircle,
  ClipboardList,
  Dumbbell
} from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  pseudo: string | null;
  trial_end_date: string | null;
  is_premium: boolean | null;
  is_banned: boolean | null;
  can_share: boolean | null;
  created_at: string;
}

interface SeanceType {
  id: string;
  pathologie: string;
  objectif_principal: string;
  author_name: string | null;
  is_shared: boolean;
  is_validated: boolean;
  is_copy: boolean | null;
  original_id: string | null;
  user_id: string;
  created_at: string;
}

interface TraitementType {
  id: string;
  pathologie: string;
  author_name: string | null;
  is_shared: boolean;
  is_validated: boolean;
  is_copy: boolean | null;
  original_id: string | null;
  user_id: string;
  created_at: string;
}

interface ExerciceType {
  id: string;
  title: string;
  category_pathology: string | null;
  is_shared: boolean;
  is_validated: boolean | null;
  is_copy: boolean | null;
  user_id: string;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  trialUsers: number;
  totalSeances: number;
  totalTraitements: number;
  pendingTraitements: number;
  totalExercices: number;
  pendingExercices: number;
  totalPatients: number;
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [seances, setSeances] = useState<SeanceType[]>([]);
  const [traitements, setTraitements] = useState<TraitementType[]>([]);
  const [exercices, setExercices] = useState<ExerciceType[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    premiumUsers: 0,
    trialUsers: 0,
    totalSeances: 0,
    totalTraitements: 0,
    pendingTraitements: 0,
    totalExercices: 0,
    pendingExercices: 0,
    totalPatients: 0,
  });
  const [userSearch, setUserSearch] = useState("");
  const [seanceSearch, setSeanceSearch] = useState("");
  const [traitementSearch, setTraitementSearch] = useState("");
  const [exerciceSearch, setExerciceSearch] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Admin role confirmation dialog state
  const [adminConfirmDialog, setAdminConfirmDialog] = useState<{
    open: boolean;
    userId: string;
    userEmail: string | null;
    action: "add" | "remove";
  }>({ open: false, userId: "", userEmail: null, action: "add" });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && user) {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas les droits d'accès à cette page.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [isAdmin, adminLoading, user, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch seances
      const { data: seancesData, error: seancesError } = await supabase
        .from("seance_types")
        .select("*")
        .order("created_at", { ascending: false });

      if (seancesError) throw seancesError;
      setSeances(seancesData || []);

      // Fetch traitements
      const { data: traitementsData, error: traitementsError } = await supabase
        .from("traitement_types")
        .select("*")
        .order("created_at", { ascending: false });

      if (traitementsError) throw traitementsError;
      setTraitements(traitementsData || []);

      // Fetch exercices
      const { data: exercicesData, error: exercicesError } = await supabase
        .from("exercices")
        .select("*")
        .order("created_at", { ascending: false });

      if (exercicesError) throw exercicesError;
      setExercices(exercicesData || []);

      // Calculate stats
      const now = new Date();
      const premiumCount = usersData?.filter(u => u.is_premium).length || 0;
      const trialCount = usersData?.filter(u => 
        !u.is_premium && u.trial_end_date && new Date(u.trial_end_date) > now
      ).length || 0;
      const pendingTraitementsCount = traitementsData?.filter(t => t.is_shared && !t.is_validated).length || 0;
      const pendingExercicesCount = exercicesData?.filter(e => e.is_shared && !e.is_validated).length || 0;

      // Fetch patients count
      const { count: patientsCount } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true });

      setStats({
        totalUsers: usersData?.length || 0,
        premiumUsers: premiumCount,
        trialUsers: trialCount,
        totalSeances: seancesData?.length || 0,
        totalTraitements: traitementsData?.length || 0,
        pendingTraitements: pendingTraitementsCount,
        totalExercices: exercicesData?.length || 0,
        pendingExercices: pendingExercicesCount,
        totalPatients: patientsCount || 0,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePremium = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_premium: !currentStatus })
        .eq("user_id", userId);

      if (error) throw error;

      setUsers(users.map(u => 
        u.user_id === userId ? { ...u, is_premium: !currentStatus } : u
      ));

      toast({
        title: "Succès",
        description: `Utilisateur ${!currentStatus ? "passé en premium" : "retiré du premium"}.`,
      });
    } catch (error) {
      console.error("Error updating premium status:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut.",
        variant: "destructive",
      });
    }
  };

  const toggleBan = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_banned: !currentStatus })
        .eq("user_id", userId);

      if (error) throw error;

      setUsers(users.map(u => 
        u.user_id === userId ? { ...u, is_banned: !currentStatus } : u
      ));

      toast({
        title: "Succès",
        description: `Utilisateur ${!currentStatus ? "banni" : "débanni"}.`,
      });
    } catch (error) {
      console.error("Error updating ban status:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut.",
        variant: "destructive",
      });
    }
  };

  const toggleCanShare = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ can_share: !currentStatus })
        .eq("user_id", userId);

      if (error) throw error;

      setUsers(users.map(u => 
        u.user_id === userId ? { ...u, can_share: !currentStatus } : u
      ));

      toast({
        title: "Succès",
        description: `Partage ${!currentStatus ? "autorisé" : "interdit"} pour cet utilisateur.`,
      });
    } catch (error) {
      console.error("Error updating share permission:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la permission.",
        variant: "destructive",
      });
    }
  };

  const openAdminConfirmDialog = async (userId: string, userEmail: string | null) => {
    try {
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      setAdminConfirmDialog({
        open: true,
        userId,
        userEmail,
        action: existingRole ? "remove" : "add",
      });
    } catch (error) {
      console.error("Error checking admin status:", error);
      toast({
        title: "Erreur",
        description: "Impossible de vérifier le statut admin.",
        variant: "destructive",
      });
    }
  };

  const confirmToggleAdmin = async () => {
    const { userId, action } = adminConfirmDialog;
    
    try {
      if (action === "remove") {
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        
        toast({ title: "Rôle admin retiré" });
      } else {
        await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        
        toast({ title: "Rôle admin ajouté" });
      }

      fetchData();
    } catch (error) {
      console.error("Error toggling admin:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le rôle.",
        variant: "destructive",
      });
    }
  };

  const toggleTraitementValidation = async (traitementId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("traitement_types")
        .update({ is_validated: !currentStatus })
        .eq("id", traitementId);

      if (error) throw error;

      setTraitements(traitements.map(t => 
        t.id === traitementId ? { ...t, is_validated: !currentStatus } : t
      ));

      toast({
        title: "Succès",
        description: `Traitement ${!currentStatus ? "validé" : "invalidé"}.`,
      });
    } catch (error) {
      console.error("Error validating traitement:", error);
      toast({
        title: "Erreur",
        description: "Impossible de valider le traitement.",
        variant: "destructive",
      });
    }
  };

  const deleteSeance = async (seanceId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette séance ?")) return;

    try {
      const { error } = await supabase
        .from("seance_types")
        .delete()
        .eq("id", seanceId);

      if (error) throw error;

      setSeances(seances.filter(s => s.id !== seanceId));
      toast({ title: "Séance supprimée" });
    } catch (error) {
      console.error("Error deleting seance:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la séance.",
        variant: "destructive",
      });
    }
  };

  const deleteTraitement = async (traitementId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce traitement ?")) return;

    try {
      const { error } = await supabase
        .from("traitement_types")
        .delete()
        .eq("id", traitementId);

      if (error) throw error;

      setTraitements(traitements.filter(t => t.id !== traitementId));
      toast({ title: "Traitement supprimé" });
    } catch (error) {
      console.error("Error deleting traitement:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le traitement.",
        variant: "destructive",
      });
    }
  };

  const toggleExerciceValidation = async (exerciceId: string, currentStatus: boolean | null) => {
    try {
      const { error } = await supabase
        .from("exercices")
        .update({ is_validated: !currentStatus })
        .eq("id", exerciceId);

      if (error) throw error;

      setExercices(exercices.map(e => 
        e.id === exerciceId ? { ...e, is_validated: !currentStatus } : e
      ));

      toast({
        title: "Succès",
        description: `Exercice ${!currentStatus ? "validé" : "invalidé"}.`,
      });
    } catch (error) {
      console.error("Error validating exercice:", error);
      toast({
        title: "Erreur",
        description: "Impossible de valider l'exercice.",
        variant: "destructive",
      });
    }
  };

  const deleteExercice = async (exerciceId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet exercice ?")) return;

    try {
      const { error } = await supabase
        .from("exercices")
        .delete()
        .eq("id", exerciceId);

      if (error) throw error;

      setExercices(exercices.filter(e => e.id !== exerciceId));
      toast({ title: "Exercice supprimé" });
    } catch (error) {
      console.error("Error deleting exercice:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'exercice.",
        variant: "destructive",
      });
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const filteredUsers = users.filter(u => 
    (u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.first_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.last_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.pseudo?.toLowerCase().includes(userSearch.toLowerCase()))
  );

  // Calculate copy counts for each original seance
  const seanceCopyCounts = seances.reduce((acc, s) => {
    if (s.is_copy && s.original_id) {
      acc[s.original_id] = (acc[s.original_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Calculate copy counts for each original traitement
  const traitementCopyCounts = traitements.reduce((acc, t) => {
    if (t.is_copy && t.original_id) {
      acc[t.original_id] = (acc[t.original_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Filter out copies from seances (only show originals)
  const filteredSeances = seances
    .filter(s => !s.is_copy)
    .filter(s =>
      s.pathologie.toLowerCase().includes(seanceSearch.toLowerCase()) ||
      s.objectif_principal.toLowerCase().includes(seanceSearch.toLowerCase()) ||
      s.author_name?.toLowerCase().includes(seanceSearch.toLowerCase())
    );

  // Filter out copies from traitements (only show originals)
  const filteredTraitements = traitements
    .filter(t => !t.is_copy)
    .filter(t =>
      t.pathologie.toLowerCase().includes(traitementSearch.toLowerCase()) ||
      t.author_name?.toLowerCase().includes(traitementSearch.toLowerCase())
    );

  // Filter exercices
  const filteredExercices = exercices
    .filter(e => !e.is_copy)
    .filter(e =>
      e.title.toLowerCase().includes(exerciceSearch.toLowerCase()) ||
      e.category_pathology?.toLowerCase().includes(exerciceSearch.toLowerCase())
    );

  const pendingTraitements = filteredTraitements.filter(t => t.is_shared && !t.is_validated);
  const pendingExercices = filteredExercices.filter(e => e.is_shared && !e.is_validated);

  if (authLoading || adminLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="font-display text-3xl font-bold text-foreground">
            Administration
          </h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
              <p className="text-xs text-muted-foreground">Utilisateurs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Crown className="w-6 h-6 mx-auto text-yellow-500 mb-2" />
              <p className="text-2xl font-bold">{stats.premiumUsers}</p>
              <p className="text-xs text-muted-foreground">Premium</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{stats.trialUsers}</p>
              <p className="text-xs text-muted-foreground">En essai</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="w-6 h-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{stats.totalSeances}</p>
              <p className="text-xs text-muted-foreground">Séances</p>
            </CardContent>
          </Card>
          <Card className={stats.pendingTraitements > 0 ? "border-orange-500" : ""}>
            <CardContent className="p-4 text-center">
              <ClipboardList className="w-6 h-6 mx-auto text-orange-500 mb-2" />
              <p className="text-2xl font-bold">{stats.pendingTraitements}</p>
              <p className="text-xs text-muted-foreground">TTT en attente</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="exercices" className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4" />
              Exercices
              {pendingExercices.length > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingExercices.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="seances" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Séances
            </TabsTrigger>
            <TabsTrigger value="traitements" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Traitements
              {pendingTraitements.length > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingTraitements.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des utilisateurs</CardTitle>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Rechercher par nom, email ou pseudo..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Utilisateur</th>
                        <th className="text-left py-3 px-2">Email</th>
                        <th className="text-left py-3 px-2">Pseudo</th>
                        <th className="text-left py-3 px-2">Statut</th>
                        <th className="text-left py-3 px-2">Premium</th>
                        <th className="text-left py-3 px-2">Partage</th>
                        <th className="text-left py-3 px-2">Banni</th>
                        <th className="text-left py-3 px-2">Admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const now = new Date();
                        const trialEnd = u.trial_end_date ? new Date(u.trial_end_date) : null;
                        const isInTrial = trialEnd && trialEnd > now && !u.is_premium;
                        const trialExpired = trialEnd && trialEnd <= now && !u.is_premium;

                        return (
                          <tr key={u.id} className={`border-b hover:bg-muted/50 ${u.is_banned ? "bg-red-500/10" : ""}`}>
                            <td className="py-3 px-2">
                              {u.first_name} {u.last_name}
                            </td>
                            <td className="py-3 px-2 text-sm text-muted-foreground">
                              {u.email}
                            </td>
                            <td className="py-3 px-2 text-sm">
                              {u.pseudo || "-"}
                            </td>
                            <td className="py-3 px-2">
                              {u.is_banned ? (
                                <Badge variant="destructive">Banni</Badge>
                              ) : u.is_premium ? (
                                <Badge className="bg-yellow-500">Premium</Badge>
                              ) : isInTrial ? (
                                <Badge variant="secondary">En essai</Badge>
                              ) : trialExpired ? (
                                <Badge variant="outline">Essai expiré</Badge>
                              ) : (
                                <Badge variant="outline">Standard</Badge>
                              )}
                            </td>
                            <td className="py-3 px-2">
                              <Switch
                                checked={u.is_premium || false}
                                onCheckedChange={() => togglePremium(u.user_id, u.is_premium || false)}
                              />
                            </td>
                            <td className="py-3 px-2">
                              <Switch
                                checked={u.can_share !== false}
                                onCheckedChange={() => toggleCanShare(u.user_id, u.can_share !== false)}
                              />
                            </td>
                            <td className="py-3 px-2">
                              <Switch
                                checked={u.is_banned || false}
                                onCheckedChange={() => toggleBan(u.user_id, u.is_banned || false)}
                              />
                            </td>
                            <td className="py-3 px-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAdminConfirmDialog(u.user_id, u.email)}
                              >
                                <Shield className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seances">
            <Card>
              <CardHeader>
                <CardTitle>Modération des séances</CardTitle>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Rechercher par pathologie, objectif ou auteur..."
                    value={seanceSearch}
                    onChange={(e) => setSeanceSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Pathologie</th>
                        <th className="text-left py-3 px-2">Objectif</th>
                        <th className="text-left py-3 px-2">Auteur</th>
                        <th className="text-left py-3 px-2">Créé le</th>
                        <th className="text-left py-3 px-2">Copies</th>
                        <th className="text-left py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSeances.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{s.pathologie}</td>
                          <td className="py-3 px-2">{s.objectif_principal}</td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {s.author_name || "Anonyme"}
                          </td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {formatDateTime(s.created_at)}
                          </td>
                          <td className="py-3 px-2">
                            {seanceCopyCounts[s.id] ? (
                              <Badge variant="secondary">{seanceCopyCounts[s.id]}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteSeance(s.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="traitements">
            <Card>
              <CardHeader>
                <CardTitle>Modération des traitements</CardTitle>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Rechercher par pathologie ou auteur..."
                    value={traitementSearch}
                    onChange={(e) => setTraitementSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {pendingTraitements.length > 0 && (
                  <div className="mb-6 p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <h3 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      En attente de validation ({pendingTraitements.length})
                    </h3>
                    <div className="space-y-2">
                      {pendingTraitements.map((t) => (
                        <div key={t.id} className="flex items-center justify-between bg-background p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">{t.pathologie}</p>
                              <p className="text-sm text-muted-foreground">{t.author_name || "Anonyme"}</p>
                            </div>
                            {traitementCopyCounts[t.id] > 0 && (
                              <Badge variant="secondary" className="text-xs">{traitementCopyCounts[t.id]} copies</Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => toggleTraitementValidation(t.id, false)}
                              className="gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Valider
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteTraitement(t.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Pathologie</th>
                        <th className="text-left py-3 px-2">Auteur</th>
                        <th className="text-left py-3 px-2">Créé le</th>
                        <th className="text-left py-3 px-2">Copies</th>
                        <th className="text-left py-3 px-2">Statut</th>
                        <th className="text-left py-3 px-2">Validé</th>
                        <th className="text-left py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTraitements.map((t) => (
                        <tr key={t.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{t.pathologie}</td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {t.author_name || "Anonyme"}
                          </td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {formatDateTime(t.created_at)}
                          </td>
                          <td className="py-3 px-2">
                            {traitementCopyCounts[t.id] ? (
                              <Badge variant="secondary">{traitementCopyCounts[t.id]}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            {t.is_shared ? (
                              t.is_validated ? (
                                <Badge className="bg-green-500">Partagé & Validé</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-orange-500">En attente</Badge>
                              )
                            ) : (
                              <Badge variant="outline">Privé</Badge>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <Switch
                              checked={t.is_validated}
                              onCheckedChange={() => toggleTraitementValidation(t.id, t.is_validated)}
                              disabled={!t.is_shared}
                            />
                          </td>
                          <td className="py-3 px-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteTraitement(t.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exercices">
            <Card>
              <CardHeader>
                <CardTitle>Modération des exercices</CardTitle>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Rechercher par titre ou catégorie..."
                    value={exerciceSearch}
                    onChange={(e) => setExerciceSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {pendingExercices.length > 0 && (
                  <div className="mb-6 p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <h3 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      En attente de validation ({pendingExercices.length})
                    </h3>
                    <div className="space-y-2">
                      {pendingExercices.map((e) => (
                        <div key={e.id} className="flex items-center justify-between bg-background p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">{e.title}</p>
                              <p className="text-sm text-muted-foreground">{e.category_pathology || "Sans catégorie"}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => toggleExerciceValidation(e.id, false)}
                              className="gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Valider
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteExercice(e.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Titre</th>
                        <th className="text-left py-3 px-2">Catégorie</th>
                        <th className="text-left py-3 px-2">Créé le</th>
                        <th className="text-left py-3 px-2">Statut</th>
                        <th className="text-left py-3 px-2">Validé</th>
                        <th className="text-left py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExercices.map((e) => (
                        <tr key={e.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{e.title}</td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {e.category_pathology || "-"}
                          </td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {formatDateTime(e.created_at)}
                          </td>
                          <td className="py-3 px-2">
                            {e.is_shared ? (
                              e.is_validated ? (
                                <Badge className="bg-green-500">Partagé & Validé</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-orange-500">En attente</Badge>
                              )
                            ) : (
                              <Badge variant="outline">Privé</Badge>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <Switch
                              checked={e.is_validated || false}
                              onCheckedChange={() => toggleExerciceValidation(e.id, e.is_validated)}
                              disabled={!e.is_shared}
                            />
                          </td>
                          <td className="py-3 px-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteExercice(e.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AdminPasswordConfirmDialog
        open={adminConfirmDialog.open}
        onOpenChange={(open) => setAdminConfirmDialog({ ...adminConfirmDialog, open })}
        onConfirm={confirmToggleAdmin}
        userEmail={adminConfirmDialog.userEmail}
        action={adminConfirmDialog.action}
      />
    </Layout>
  );
}
