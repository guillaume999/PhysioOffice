import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdminPasswordConfirmDialog } from "@/components/admin/AdminPasswordConfirmDialog";
import { ExerciceDetailDialog } from "@/components/admin/ExerciceDetailDialog";
import { RejectExerciceDialog } from "@/components/admin/RejectExerciceDialog";
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
  Dumbbell,
  XCircle,
  BookTemplate,
  Plus,
  Edit,
  Save,
  X,
  Sparkles,
  CreditCard,
  Newspaper,
} from "lucide-react";
import { NewsManagement } from "@/components/admin/NewsManagement";

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
  subscription_tier: "free" | "basic" | "premium";
  subscription_end_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
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
  description: string | null;
  author_name: string | null;
  status: string;
  is_copy: boolean | null;
  original_id: string | null;
  user_id: string;
  created_at: string;
  video_url?: string | null;
  thumbnail_url?: string | null;
  pathologie_tags?: string[] | null;
  rejection_reason?: string | null;
}

interface CertificatModel {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_platform: boolean;
  created_at: string;
}

interface SubscriptionLimit {
  id: string;
  tier: "free" | "basic" | "premium";
  max_patients: number;
  max_exercices: number;
  max_seances: number;
  max_traitements: number;
  can_share_exercices: boolean;
  can_use_ai: boolean;
}

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  basicUsers: number;
  trialUsers: number;
  freeUsers: number;
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
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());
  const [seances, setSeances] = useState<SeanceType[]>([]);
  const [traitements, setTraitements] = useState<TraitementType[]>([]);
  const [exercices, setExercices] = useState<ExerciceType[]>([]);
  const [certificatModels, setCertificatModels] = useState<CertificatModel[]>([]);
  const [featuredExerciceIds, setFeaturedExerciceIds] = useState<Set<string>>(new Set());
  const [consultedExerciceIds, setConsultedExerciceIds] = useState<Set<string>>(new Set());
  const [selectedExercice, setSelectedExercice] = useState<ExerciceType | null>(null);
  const [exerciceDialogOpen, setExerciceDialogOpen] = useState(false);
  const [subscriptionLimits, setSubscriptionLimits] = useState<SubscriptionLimit[]>([]);
  const [editingLimits, setEditingLimits] = useState<Record<string, Partial<SubscriptionLimit>>>({});
  const [savingLimits, setSavingLimits] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    premiumUsers: 0,
    basicUsers: 0,
    trialUsers: 0,
    freeUsers: 0,
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
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(true);

  // Certificat model form state
  const [newModelTitle, setNewModelTitle] = useState("");
  const [newModelContent, setNewModelContent] = useState("");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editModelTitle, setEditModelTitle] = useState("");
  const [editModelContent, setEditModelContent] = useState("");
  
  // Admin role confirmation dialog state
  const [adminConfirmDialog, setAdminConfirmDialog] = useState<{
    open: boolean;
    userId: string;
    userEmail: string | null;
    action: "add" | "remove";
  }>({ open: false, userId: "", userEmail: null, action: "add" });

  // Reject exercice dialog state
  const [rejectExerciceDialog, setRejectExerciceDialog] = useState<{
    open: boolean;
    exerciceId: string | null;
    exerciceTitle: string;
  }>({ open: false, exerciceId: null, exerciceTitle: "" });

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

      // Fetch admin roles
      const { data: adminRolesData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      
      setAdminUserIds(new Set(adminRolesData?.map(r => r.user_id) || []));

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

      // Fetch featured exercices
      const { data: featuredData } = await supabase
        .from("featured_exercices")
        .select("exercice_id");
      
      setFeaturedExerciceIds(new Set(featuredData?.map(f => f.exercice_id) || []));

      // Fetch consulted exercices for current admin
      const { data: consultedData } = await supabase
        .from("exercice_consultations")
        .select("exercice_id")
        .eq("is_consulted", true);
      
      setConsultedExerciceIds(new Set(consultedData?.map(c => c.exercice_id) || []));

      // Fetch platform certificat models
      const { data: modelsData } = await supabase
        .from("certificat_models")
        .select("*")
        .eq("is_platform", true)
        .order("created_at", { ascending: false });
      
      setCertificatModels(modelsData || []);

      // Fetch subscription limits
      const { data: limitsData } = await supabase
        .from("subscription_limits")
        .select("*")
        .order("tier");
      
      setSubscriptionLimits(limitsData || []);

      // Calculate stats
      const now = new Date();
      const premiumCount = usersData?.filter(u => u.subscription_tier === 'premium').length || 0;
      const basicCount = usersData?.filter(u => u.subscription_tier === 'basic').length || 0;
      const trialCount = usersData?.filter(u => 
        u.subscription_tier === 'free' && u.trial_end_date && new Date(u.trial_end_date) > now
      ).length || 0;
      const freeCount = usersData?.filter(u => 
        u.subscription_tier === 'free' && (!u.trial_end_date || new Date(u.trial_end_date) <= now)
      ).length || 0;
      const pendingTraitementsCount = traitementsData?.filter(t => t.is_shared && !t.is_validated).length || 0;
      const pendingExercicesCount = exercicesData?.filter(e => e.status === 'pending').length || 0;

      // Fetch patients count
      const { count: patientsCount } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true });

      setStats({
        totalUsers: usersData?.length || 0,
        premiumUsers: premiumCount,
        basicUsers: basicCount,
        trialUsers: trialCount,
        freeUsers: freeCount,
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

  const updateSubscriptionTier = async (userId: string, newTier: "free" | "basic" | "premium") => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          subscription_tier: newTier,
          is_premium: newTier !== "free",
        })
        .eq("user_id", userId);

      if (error) throw error;

      setUsers(users.map(u => 
        u.user_id === userId ? { ...u, subscription_tier: newTier, is_premium: newTier !== "free" } : u
      ));

      const tierLabels = { free: "Gratuit", basic: "Basic", premium: "Premium" };
      toast({
        title: "Succès",
        description: `Abonnement modifié en ${tierLabels[newTier]}.`,
      });
    } catch (error) {
      console.error("Error updating subscription tier:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'abonnement.",
        variant: "destructive",
      });
    }
  };

  const updateSubscriptionEndDate = async (userId: string, newDate: string | null) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          subscription_end_date: newDate ? new Date(newDate).toISOString() : null,
        })
        .eq("user_id", userId);

      if (error) throw error;

      setUsers(users.map(u => 
        u.user_id === userId ? { ...u, subscription_end_date: newDate ? new Date(newDate).toISOString() : null } : u
      ));

      toast({
        title: "Succès",
        description: newDate ? `Date de fin modifiée.` : "Date de fin supprimée.",
      });
    } catch (error) {
      console.error("Error updating subscription end date:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la date.",
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

  const updateLimitField = (tier: string, field: keyof SubscriptionLimit, value: number | boolean) => {
    setEditingLimits(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [field]: value
      }
    }));
  };

  const saveSubscriptionLimits = async () => {
    setSavingLimits(true);
    try {
      for (const limit of subscriptionLimits) {
        const edits = editingLimits[limit.tier];
        if (edits && Object.keys(edits).length > 0) {
          const { error } = await supabase
            .from("subscription_limits")
            .update(edits)
            .eq("id", limit.id);
          
          if (error) throw error;
        }
      }

      toast({
        title: "Succès",
        description: "Limites mises à jour avec succès.",
      });

      setEditingLimits({});
      fetchData();
    } catch (error) {
      console.error("Error updating limits:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les limites.",
        variant: "destructive",
      });
    } finally {
      setSavingLimits(false);
    }
  };

  const getLimitValue = (tier: string, field: keyof SubscriptionLimit): number | boolean => {
    const edits = editingLimits[tier];
    if (edits && field in edits) {
      return edits[field] as number | boolean;
    }
    const limit = subscriptionLimits.find(l => l.tier === tier);
    return limit ? limit[field] as number | boolean : field.startsWith('can_') ? false : 0;
  };

  const hasUnsavedChanges = Object.keys(editingLimits).some(tier => 
    Object.keys(editingLimits[tier]).length > 0
  );

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

  const toggleExerciceValidation = async (exerciceId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'shared' ? 'pending' : 'shared';
    try {
      const { error } = await supabase
        .from("exercices")
        .update({ status: newStatus })
        .eq("id", exerciceId);

      if (error) throw error;

      setExercices(exercices.map(e => 
        e.id === exerciceId ? { ...e, status: newStatus } : e
      ));

      toast({
        title: "Succès",
        description: `Exercice ${newStatus === 'shared' ? "validé" : "invalidé"}.`,
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

  const toggleConsulted = async (exerciceId: string, isCurrentlyConsulted: boolean) => {
    if (!user) return;
    
    try {
      if (isCurrentlyConsulted) {
        // Remove consultation record
        await supabase
          .from("exercice_consultations")
          .delete()
          .eq("exercice_id", exerciceId)
          .eq("user_id", user.id);
        
        setConsultedExerciceIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(exerciceId);
          return newSet;
        });
      } else {
        // Upsert consultation record
        await supabase
          .from("exercice_consultations")
          .upsert({
            exercice_id: exerciceId,
            user_id: user.id,
            is_consulted: true,
            consulted_at: new Date().toISOString(),
          }, { onConflict: 'user_id,exercice_id' });
        
        setConsultedExerciceIds(prev => {
          const newSet = new Set(prev);
          newSet.add(exerciceId);
          return newSet;
        });
      }
    } catch (error) {
      console.error("Error toggling consulted status:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut consulté.",
        variant: "destructive",
      });
    }
  };

  // Certificat model functions
  const handleAddModel = async () => {
    if (!newModelTitle.trim() || !newModelContent.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from("certificat_models")
        .insert({
          user_id: user.id,
          title: newModelTitle,
          content: newModelContent,
          is_platform: true,
        })
        .select()
        .single();

      if (error) throw error;

      setCertificatModels([data, ...certificatModels]);
      setNewModelTitle("");
      setNewModelContent("");
      toast({ title: "Modèle ajouté" });
    } catch (error) {
      console.error("Error adding model:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le modèle.",
        variant: "destructive",
      });
    }
  };

  const handleStartEditModel = (model: CertificatModel) => {
    setEditingModelId(model.id);
    setEditModelTitle(model.title);
    setEditModelContent(model.content);
  };

  const handleCancelEditModel = () => {
    setEditingModelId(null);
    setEditModelTitle("");
    setEditModelContent("");
  };

  const handleSaveEditModel = async () => {
    if (!editingModelId || !editModelTitle.trim()) return;

    try {
      const { error } = await supabase
        .from("certificat_models")
        .update({
          title: editModelTitle,
          content: editModelContent,
        })
        .eq("id", editingModelId);

      if (error) throw error;

      setCertificatModels(
        certificatModels.map((m) =>
          m.id === editingModelId
            ? { ...m, title: editModelTitle, content: editModelContent }
            : m
        )
      );
      setEditingModelId(null);
      setEditModelTitle("");
      setEditModelContent("");
      toast({ title: "Modèle modifié" });
    } catch (error) {
      console.error("Error updating model:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le modèle.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce modèle ?")) return;

    try {
      const { error } = await supabase
        .from("certificat_models")
        .delete()
        .eq("id", modelId);

      if (error) throw error;

      setCertificatModels(certificatModels.filter((m) => m.id !== modelId));
      toast({ title: "Modèle supprimé" });
    } catch (error) {
      console.error("Error deleting model:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le modèle.",
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

  const getUserDisplayName = (userId: string) => {
    const foundUser = users.find(u => u.user_id === userId);
    if (!foundUser) return "Inconnu";
    if (foundUser.first_name || foundUser.last_name) {
      return `${foundUser.first_name || ""} ${foundUser.last_name || ""}`.trim();
    }
    if (foundUser.pseudo) return foundUser.pseudo;
    if (foundUser.email) return foundUser.email;
    return "Inconnu";
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

  const pendingTraitements = filteredTraitements.filter(t => t.is_shared && !t.is_validated);

  // Calculate copy counts for each original exercice
  const exerciceCopyCounts = exercices.reduce((acc, e) => {
    if (e.is_copy && e.original_id) {
      acc[e.original_id] = (acc[e.original_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Filter out copies from exercices (only show originals)
  const filteredExercices = exercices
    .filter(e => !e.is_copy)
    .filter(e =>
      e.title.toLowerCase().includes(exerciceSearch.toLowerCase()) ||
      e.author_name?.toLowerCase().includes(exerciceSearch.toLowerCase())
    );

  const pendingExercices = filteredExercices.filter(e => e.status === 'pending');

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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
              <p className="text-xs text-muted-foreground">Utilisateurs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Crown className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <p className="text-2xl font-bold">{stats.premiumUsers}</p>
              <p className="text-xs text-muted-foreground">Premium</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Sparkles className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{stats.basicUsers}</p>
              <p className="text-xs text-muted-foreground">Basic</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 mx-auto text-yellow-500 mb-2" />
              <p className="text-2xl font-bold">{stats.trialUsers}</p>
              <p className="text-xs text-muted-foreground">En essai</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CreditCard className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold">{stats.freeUsers}</p>
              <p className="text-xs text-muted-foreground">Gratuit</p>
            </CardContent>
          </Card>
          <Card className={stats.pendingExercices > 0 || stats.pendingTraitements > 0 ? "border-orange-500" : ""}>
            <CardContent className="p-4 text-center">
              <ClipboardList className="w-6 h-6 mx-auto text-orange-500 mb-2" />
              <p className="text-2xl font-bold">{stats.pendingTraitements + stats.pendingExercices}</p>
              <p className="text-xs text-muted-foreground">En attente</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Utilisateurs
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
            <TabsTrigger value="exercices" className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4" />
              Exercices
              {pendingExercices.length > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingExercices.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="certificats" className="flex items-center gap-2">
              <BookTemplate className="w-4 h-4" />
              Modèles certificats
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="news" className="flex items-center gap-2">
              <Newspaper className="w-4 h-4" />
              News
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
                        <th className="text-left py-3 px-2">Abonnement</th>
                        <th className="text-left py-3 px-2">Fin abonnement</th>
                        <th className="text-left py-3 px-2">Partage</th>
                        <th className="text-left py-3 px-2">Banni</th>
                        <th className="text-left py-3 px-2">Admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const isUserAdmin = adminUserIds.has(u.user_id);

                        return (
                          <tr key={u.id} className={`border-b hover:bg-muted/50 ${u.is_banned ? "bg-red-500/10" : ""} ${isUserAdmin ? "bg-primary/5" : ""}`}>
                            <td className="py-3 px-2">
                              <div className="flex flex-col">
                                <span>{u.first_name} {u.last_name}</span>
                                {u.pseudo && <span className="text-xs text-muted-foreground">{u.pseudo}</span>}
                              </div>
                            </td>
                            <td className="py-3 px-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                {u.email}
                                {u.stripe_customer_id && (
                                  <Badge variant="outline" className="text-xs">
                                    <CreditCard className="w-3 h-3 mr-1" />
                                    Stripe
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              {isUserAdmin ? (
                                <Badge className="bg-primary text-primary-foreground">
                                  <Shield className="w-3 h-3 mr-1" />
                                  Illimité
                                </Badge>
                              ) : (
                                <Select
                                  value={u.subscription_tier || "free"}
                                  onValueChange={(value: "free" | "basic" | "premium") => 
                                    updateSubscriptionTier(u.user_id, value)
                                  }
                                >
                                  <SelectTrigger className="w-[120px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="free">Gratuit</SelectItem>
                                    <SelectItem value="basic">Basic</SelectItem>
                                    <SelectItem value="premium">Premium</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </td>
                            <td className="py-3 px-2">
                              {isUserAdmin ? (
                                <span className="text-xs text-muted-foreground">-</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="date"
                                    className="w-[140px] h-8 text-sm"
                                    value={u.subscription_end_date ? new Date(u.subscription_end_date).toISOString().split('T')[0] : ""}
                                    onChange={(e) => updateSubscriptionEndDate(u.user_id, e.target.value || null)}
                                  />
                                  {u.subscription_end_date && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => updateSubscriptionEndDate(u.user_id, null)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              )}
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
                                variant={adminUserIds.has(u.user_id) ? "default" : "outline"}
                                size="sm"
                                onClick={() => openAdminConfirmDialog(u.user_id, u.email)}
                                className={adminUserIds.has(u.user_id) ? "bg-primary text-primary-foreground" : ""}
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
                        <th className="text-left py-3 px-2">Utilisateur</th>
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
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {getUserDisplayName(s.user_id)}
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
                        <th className="text-left py-3 px-2">Utilisateur</th>
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
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {getUserDisplayName(t.user_id)}
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
                    placeholder="Rechercher par titre ou auteur..."
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
                              <p className="text-sm text-muted-foreground">{e.author_name || "Anonyme"}</p>
                            </div>
                            {exerciceCopyCounts[e.id] > 0 && (
                              <Badge variant="secondary" className="text-xs">{exerciceCopyCounts[e.id]} copies</Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => toggleExerciceValidation(e.id, e.status)}
                              className="gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Valider
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRejectExerciceDialog({
                                open: true,
                                exerciceId: e.id,
                                exerciceTitle: e.title
                              })}
                              className="gap-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                            >
                              <XCircle className="w-4 h-4" />
                              Refuser
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
                        <th className="text-left py-3 px-2">Auteur</th>
                        <th className="text-left py-3 px-2">Créé le</th>
                        <th className="text-left py-3 px-2">Copies</th>
                        <th className="text-left py-3 px-2">Statut</th>
                        <th className="text-left py-3 px-2">Plateforme</th>
                        <th className="text-left py-3 px-2">Consulté</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExercices.map((e) => (
                        <tr 
                          key={e.id} 
                          className="border-b hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setSelectedExercice(e);
                            setExerciceDialogOpen(true);
                          }}
                        >
                          <td className="py-3 px-2 font-medium">{e.title}</td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {e.author_name || "Anonyme"}
                          </td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {formatDateTime(e.created_at)}
                          </td>
                          <td className="py-3 px-2">
                            {exerciceCopyCounts[e.id] ? (
                              <Badge variant="secondary">{exerciceCopyCounts[e.id]}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            {e.status === 'shared' ? (
                              <Badge className="bg-green-500">Partagé</Badge>
                            ) : e.status === 'pending' ? (
                              <Badge variant="secondary" className="bg-orange-500">En attente</Badge>
                            ) : (
                              <Badge variant="outline">Brouillon</Badge>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            {featuredExerciceIds.has(e.id) ? (
                              <Badge className="bg-yellow-500 text-yellow-900">Oui</Badge>
                            ) : (
                              <span className="text-muted-foreground">Non</span>
                            )}
                          </td>
                          <td className="py-3 px-2" onClick={(ev) => ev.stopPropagation()}>
                            <Button
                              variant={consultedExerciceIds.has(e.id) ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleConsulted(e.id, consultedExerciceIds.has(e.id))}
                              className="gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {consultedExerciceIds.has(e.id) ? "Consulté" : "Non consulté"}
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

          {/* Certificat Models Tab */}
          <TabsContent value="certificats">
            <Card>
              <CardHeader>
                <CardTitle>Modèles de certificats plateforme</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ces modèles seront disponibles pour tous les utilisateurs de la plateforme.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add new model form */}
                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Ajouter un nouveau modèle
                  </h3>
                  <div>
                    <label className="text-sm font-medium">Titre</label>
                    <Input
                      placeholder="Ex: Certificat médical type"
                      value={newModelTitle}
                      onChange={(e) => setNewModelTitle(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Contenu</label>
                    <textarea
                      placeholder="Rédigez le contenu du modèle..."
                      value={newModelContent}
                      onChange={(e) => setNewModelContent(e.target.value)}
                      className="mt-1 w-full min-h-[150px] p-3 border rounded-md bg-background"
                    />
                  </div>
                  <Button onClick={handleAddModel} disabled={!newModelTitle.trim() || !newModelContent.trim()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter le modèle
                  </Button>
                </div>

                {/* Models list */}
                <div className="space-y-4">
                  <h3 className="font-medium">Modèles existants ({certificatModels.length})</h3>
                  {certificatModels.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Aucun modèle de certificat plateforme
                    </p>
                  ) : (
                    certificatModels.map((model) => (
                      <div key={model.id} className="border rounded-lg p-4">
                        {editingModelId === model.id ? (
                          <div className="space-y-4">
                            <Input
                              value={editModelTitle}
                              onChange={(e) => setEditModelTitle(e.target.value)}
                              placeholder="Titre du modèle"
                            />
                            <textarea
                              value={editModelContent}
                              onChange={(e) => setEditModelContent(e.target.value)}
                              placeholder="Contenu du modèle"
                              className="w-full min-h-[150px] p-3 border rounded-md bg-background"
                            />
                            <div className="flex gap-2">
                              <Button onClick={handleSaveEditModel} size="sm">
                                <Save className="w-4 h-4 mr-2" />
                                Enregistrer
                              </Button>
                              <Button variant="outline" onClick={handleCancelEditModel} size="sm">
                                <X className="w-4 h-4 mr-2" />
                                Annuler
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium">{model.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  Créé le {new Date(model.created_at).toLocaleDateString("fr-FR")}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleStartEditModel(model)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleDeleteModel(model.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="mt-2 text-sm whitespace-pre-wrap border-t pt-2 mt-2">
                              {model.content}
                            </p>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Permissions par type de compte</CardTitle>
                {hasUnsavedChanges && (
                  <Button onClick={saveSubscriptionLimits} disabled={savingLimits}>
                    <Save className="w-4 h-4 mr-2" />
                    {savingLimits ? "Enregistrement..." : "Enregistrer les modifications"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Fonctionnalité</th>
                        <th className="text-center py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                            Gratuit
                          </div>
                        </th>
                        <th className="text-center py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Crown className="w-4 h-4 text-blue-500" />
                            Basic
                          </div>
                        </th>
                        <th className="text-center py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Crown className="w-4 h-4 text-amber-500" />
                            Premium
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-4 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            Nombre max de patients
                          </div>
                        </td>
                        {(["free", "basic", "premium"] as const).map(tier => (
                          <td key={tier} className="py-4 px-4 text-center">
                            <Input
                              type="number"
                              min="0"
                              className="w-24 mx-auto text-center"
                              value={getLimitValue(tier, "max_patients") as number}
                              onChange={(e) => updateLimitField(tier, "max_patients", parseInt(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-4 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <Dumbbell className="w-4 h-4 text-muted-foreground" />
                            Nombre max d'exercices
                          </div>
                        </td>
                        {(["free", "basic", "premium"] as const).map(tier => (
                          <td key={tier} className="py-4 px-4 text-center">
                            <Input
                              type="number"
                              min="0"
                              className="w-24 mx-auto text-center"
                              value={getLimitValue(tier, "max_exercices") as number}
                              onChange={(e) => updateLimitField(tier, "max_exercices", parseInt(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-4 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            Nombre max de séances
                          </div>
                        </td>
                        {(["free", "basic", "premium"] as const).map(tier => (
                          <td key={tier} className="py-4 px-4 text-center">
                            <Input
                              type="number"
                              min="0"
                              className="w-24 mx-auto text-center"
                              value={getLimitValue(tier, "max_seances") as number}
                              onChange={(e) => updateLimitField(tier, "max_seances", parseInt(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-4 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-muted-foreground" />
                            Nombre max de traitements
                          </div>
                        </td>
                        {(["free", "basic", "premium"] as const).map(tier => (
                          <td key={tier} className="py-4 px-4 text-center">
                            <Input
                              type="number"
                              min="0"
                              className="w-24 mx-auto text-center"
                              value={getLimitValue(tier, "max_traitements") as number}
                              onChange={(e) => updateLimitField(tier, "max_traitements", parseInt(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-4 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            Partage d'exercices
                          </div>
                        </td>
                        {(["free", "basic", "premium"] as const).map(tier => (
                          <td key={tier} className="py-4 px-4 text-center">
                            <Switch
                              checked={getLimitValue(tier, "can_share_exercices") as boolean}
                              onCheckedChange={(checked) => updateLimitField(tier, "can_share_exercices", checked)}
                            />
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-4 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-muted-foreground" />
                            Accès à l'IA
                          </div>
                        </td>
                        {(["free", "basic", "premium"] as const).map(tier => (
                          <td key={tier} className="py-4 px-4 text-center">
                            <Switch
                              checked={getLimitValue(tier, "can_use_ai") as boolean}
                              onCheckedChange={(checked) => updateLimitField(tier, "can_use_ai", checked)}
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note :</strong> Les administrateurs ont un accès illimité à toutes les fonctionnalités, 
                    indépendamment des limites définies ici.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="news">
            <NewsManagement />
          </TabsContent>
        </Tabs>

        <AdminPasswordConfirmDialog
          open={adminConfirmDialog.open}
          onOpenChange={(open) => setAdminConfirmDialog(prev => ({ ...prev, open }))}
          onConfirm={confirmToggleAdmin}
          userEmail={adminConfirmDialog.userEmail}
          action={adminConfirmDialog.action}
        />

        <ExerciceDetailDialog
          exercice={selectedExercice}
          open={exerciceDialogOpen}
          onOpenChange={setExerciceDialogOpen}
          onUpdate={fetchData}
          getUserDisplayName={getUserDisplayName}
          isFeatured={selectedExercice ? featuredExerciceIds.has(selectedExercice.id) : false}
          copyCount={selectedExercice ? (exerciceCopyCounts[selectedExercice.id] || 0) : 0}
          isConsulted={selectedExercice ? consultedExerciceIds.has(selectedExercice.id) : false}
          onConsultedChange={(consulted) => {
            if (!selectedExercice) return;
            toggleConsulted(selectedExercice.id, !consulted);
          }}
        />

        <RejectExerciceDialog
          exerciceId={rejectExerciceDialog.exerciceId}
          exerciceTitle={rejectExerciceDialog.exerciceTitle}
          open={rejectExerciceDialog.open}
          onOpenChange={(open) => setRejectExerciceDialog(prev => ({ ...prev, open }))}
          onSuccess={fetchData}
        />
      </div>
    </Layout>
  );
}
