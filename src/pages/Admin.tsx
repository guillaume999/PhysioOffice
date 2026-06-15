import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { AdminPasswordConfirmDialog } from "@/components/admin/AdminPasswordConfirmDialog";
import { ExerciceDetailDialog } from "@/components/admin/ExerciceDetailDialog";
import { RejectExerciceDialog } from "@/components/admin/RejectExerciceDialog";
import {
  Users,
  FileText,
  Search,
  ChevronDown,
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
  Megaphone,
  MessageSquare,
  Undo2,
  Mail,
  Target,
  Calendar as CalendarIcon,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { NewsManagement } from "@/components/admin/NewsManagement";
import { AnnoncesManagement } from "@/components/admin/AnnoncesManagement";
import { PopupsManagement } from "@/components/admin/PopupsManagement";

interface UserProfile {
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
  subscription_tier: "free" | "basic" | "premium" | "admin";
  subscription_end_date: string | null;
  has_stripe_account: boolean | null;
}

interface SeanceType {
  id: string;
  pathologie: string;
  objectif_principal: string;
  author_name: string | null;
  is_shared: boolean;
  is_validated: boolean;
  is_refused?: boolean;
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
  is_refused?: boolean;
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

interface ObjectifItem {
  id: string;
  name: string;
  user_id: string | null;
  source: "objectifs" | "exercices" | "pathologies";
  created_at: string | null;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  created: string;
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
  totalObjectifs: number;
  pendingObjectifs: number;
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
  const [objectifs, setObjectifs] = useState<ObjectifItem[]>([]);
  const [newObjectifName, setNewObjectifName] = useState("");
  const [certificatModels, setCertificatModels] = useState<CertificatModel[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [featuredExerciceIds, setFeaturedExerciceIds] = useState<Set<string>>(new Set());
  const [consultedExerciceIds, setConsultedExerciceIds] = useState<Set<string>>(new Set());
  const [consultedTraitementIds, setConsultedTraitementIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`admin_consulted_traitements_${user?.id}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [consultedSeanceIds, setConsultedSeanceIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`admin_consulted_seances_${user?.id}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [archivedMessageIds, setArchivedMessageIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("admin_archived_messages");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
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
    totalObjectifs: 0,
    pendingObjectifs: 0,
  });
  const [userSearch, setUserSearch] = useState("");
  const [seanceSearch, setSeanceSearch] = useState("");
  const [seanceAuthorFilter, setSeanceAuthorFilter] = useState<string[]>([]);
  const [seancePathologieFilter, setSeancePathologieFilter] = useState<string[]>([]);
  const [seanceObjectifFilter, setSeanceObjectifFilter] = useState<string[]>([]);
  const [seanceDateFromFilter, setSeanceDateFromFilter] = useState<Date | undefined>(undefined);
  const [seanceDateToFilter, setSeanceDateToFilter] = useState<Date | undefined>(undefined);
  const [seanceCopiesFilter, setSeanceCopiesFilter] = useState<"all" | "with" | "without">("all");
  const [seanceStatusFilter, setSeanceStatusFilter] = useState<string[]>([]);
  const [seanceUserFilter, setSeanceUserFilter] = useState<string[]>([]);
  const [seanceConsultedFilter, setSeanceConsultedFilter] = useState<"all" | "consulted" | "not-consulted">("all");
  const [traitementSearch, setTraitementSearch] = useState("");
  const [traitementAuthorFilter, setTraitementAuthorFilter] = useState<string[]>([]);
  const [traitementPathologieFilter, setTraitementPathologieFilter] = useState<string[]>([]);
  const [traitementDateFromFilter, setTraitementDateFromFilter] = useState<Date | undefined>(undefined);
  const [traitementDateToFilter, setTraitementDateToFilter] = useState<Date | undefined>(undefined);
  const [traitementCopiesFilter, setTraitementCopiesFilter] = useState<"all" | "with" | "without">("all");
  const [traitementStatusFilter, setTraitementStatusFilter] = useState<string[]>([]);
  const [traitementUserFilter, setTraitementUserFilter] = useState<string[]>([]);
  const [traitementConsultedFilter, setTraitementConsultedFilter] = useState<"all" | "consulted" | "not-consulted">("all");
  const [exerciceSearch, setExerciceSearch] = useState("");
  const [exerciceAuthorFilter, setExerciceAuthorFilter] = useState<string[]>([]);
  const [exerciceDateFromFilter, setExerciceDateFromFilter] = useState<Date | undefined>(undefined);
  const [exerciceDateToFilter, setExerciceDateToFilter] = useState<Date | undefined>(undefined);
  const [exerciceCopiesFilter, setExerciceCopiesFilter] = useState<"all" | "with" | "without">("all");
  const [exerciceStatusFilter, setExerciceStatusFilter] = useState<string[]>([]);
  const [exerciceConsultedFilter, setExerciceConsultedFilter] = useState<"all" | "consulted" | "not-consulted">("all");
  const [objectifSearch, setObjectifSearch] = useState("");
  const [objectifLetterFilter, setObjectifLetterFilter] = useState("");
  const [objectifSourceFilter, setObjectifSourceFilter] = useState<string[]>([]);
  const [objectifUserFilter, setObjectifUserFilter] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(true);
  const [seanceDateSort, setSeanceDateSort] = useState<"asc" | "desc">("desc");
  const [traitementDateSort, setTraitementDateSort] = useState<"asc" | "desc">("desc");
  const [exerciceDateSort, setExerciceDateSort] = useState<"asc" | "desc">("desc");

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
    if (authLoading || adminLoading) return;
    if (user && !isAdmin) {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas les droits d'accès à cette page.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [isAdmin, adminLoading, authLoading, user, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);

    // Helper: isole chaque appel pour qu'une collection manquante (404) ou une
    // erreur ponctuelle ne casse pas toute la page admin.
    const safeFetch = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch (error: any) {
        console.error(`[Admin] Échec chargement ${label}:`, error);
        return fallback;
      }
    };

    // Fetch users (the PocketBase `users` collection holds the former `profiles` data).
    const usersRecords = await safeFetch(
      "users",
      () => pb.collection("users").getFullList({ sort: "-created" }),
      [] as any[],
    );
    const usersData = usersRecords.map((r: any) => ({ ...r, user_id: r.id, created_at: r.created }));
    setUsers(usersData as any);
    setAdminUserIds(
      new Set(usersData.filter((u: any) => u.subscription_tier === "admin").map((u: any) => u.user_id)),
    );

    // Fetch seances
    const seancesData = (
      await safeFetch("seance_types", () => pb.collection("seance_types").getFullList({ sort: "-created" }), [] as any[])
    ).map((r: any) => ({ ...r, created_at: r.created, user_id: r.user || r.user_id }));
    setSeances(seancesData as any);

    // Fetch traitements
    const traitementsData = (
      await safeFetch(
        "traitement_types",
        () => pb.collection("traitement_types").getFullList({ sort: "-created" }),
        [] as any[],
      )
    ).map((r: any) => ({ ...r, created_at: r.created, user_id: r.user || r.user_id }));
    setTraitements(traitementsData as any);

    // Fetch exercices
    const exercicesData = (
      await safeFetch("exercices", () => pb.collection("exercices").getFullList({ sort: "-created" }), [] as any[])
    ).map((r: any) => ({ ...r, created_at: r.created, user_id: r.user || r.user_id }));
    setExercices(exercicesData as any);

    // Fetch objectifs (bibliothèque), + tags des exercices + champ objectifs des pathologies
    const objectifsRecords = await safeFetch(
      "objectifs",
      () => pb.collection("objectifs").getFullList({ sort: "-created" }),
      [] as any[],
    );
    const pathologiesRecords = await safeFetch(
      "pathologies",
      () => pb.collection("pathologies").getFullList({ fields: "id,objectifs" }),
      [] as any[],
    );

    const aggregated = new Map<string, ObjectifItem>();
    for (const r of objectifsRecords as any[]) {
      const key = (r.name || "").trim().toLowerCase();
      if (!key) continue;
      if (!aggregated.has(key)) {
        aggregated.set(key, {
          id: r.id,
          name: r.name,
          user_id: r.user || null,
          source: "objectifs",
          created_at: r.created || null,
        });
      }
    }
    for (const e of exercicesData as any[]) {
      const tags: string[] = Array.isArray(e.objectif_tags) ? e.objectif_tags : [];
      for (const t of tags) {
        const key = (t || "").trim().toLowerCase();
        if (!key || aggregated.has(key)) continue;
        aggregated.set(key, { id: `ex_${e.id}_${key}`, name: t, user_id: e.user || null, source: "exercices", created_at: e.created || null });
      }
    }
    for (const p of pathologiesRecords as any[]) {
      const raw = (p.objectifs || "").trim();
      if (!raw) continue;
      // Split sur retours ligne / puces / points-virgules
      for (const line of raw.split(/[\n;]+/)) {
        const name = line.replace(/^[-•*\s]+/, "").trim();
        const key = name.toLowerCase();
        if (!key || aggregated.has(key)) continue;
        aggregated.set(key, { id: `pa_${p.id}_${key}`, name, user_id: null, source: "pathologies", created_at: null });
      }
    }
    setObjectifs(Array.from(aggregated.values()).sort((a, b) => a.name.localeCompare(b.name, "fr")));

    // Fetch featured exercices (relation field is `exercice`)
    const featuredData = await safeFetch(
      "featured_exercices",
      () => pb.collection("featured_exercices").getFullList({ fields: "exercice" }),
      [] as any[],
    );
    setFeaturedExerciceIds(new Set(featuredData.map((f: any) => f.exercice)));

    // Fetch consulted exercices for current admin
    const consultedData = user
      ? await safeFetch(
          "exercice_consultations",
          () =>
            pb.collection("exercice_consultations").getFullList({
              filter: `user = "${user.id}" && is_consulted = true`,
              fields: "exercice",
            }),
          [] as any[],
        )
      : [];
    setConsultedExerciceIds(new Set(consultedData.map((c: any) => c.exercice)));

    // Fetch platform certificat models
    const modelsData = (
      await safeFetch(
        "certificat_models",
        () =>
          pb.collection("certificat_models").getFullList({
            filter: "is_platform = true",
            sort: "-created",
          }),
        [] as any[],
      )
    ).map((r: any) => ({ ...r, created_at: r.created }));
    setCertificatModels(modelsData as any);

    // Fetch contact messages
    const messagesData = await safeFetch(
      "contact_messages",
      () => pb.collection("contact_messages").getFullList({ sort: "-created" }),
      [] as any[],
    );
    setContactMessages(messagesData as any);

    // Fetch subscription limits
    const limitsData = await safeFetch(
      "subscription_limits",
      () => pb.collection("subscription_limits").getFullList({ sort: "tier" }),
      [] as any[],
    );
    setSubscriptionLimits(limitsData as any);

    // Fetch patients count
    const patientsCount = await safeFetch(
      "patients",
      async () => (await pb.collection("patients").getList(1, 1)).totalItems,
      0,
    );

    // Calculate stats
    const now = new Date();
    const premiumCount = usersData?.filter((u: any) => u.subscription_tier === "premium").length || 0;
    const basicCount = usersData?.filter((u: any) => u.subscription_tier === "basic").length || 0;
    const trialCount =
      usersData?.filter(
        (u: any) => u.subscription_tier === "free" && u.trial_end_date && new Date(u.trial_end_date) > now,
      ).length || 0;
    const freeCount =
      usersData?.filter(
        (u: any) =>
          u.subscription_tier === "free" && (!u.trial_end_date || new Date(u.trial_end_date) <= now),
      ).length || 0;
    const pendingTraitementsCount = traitementsData?.filter((t: any) => t.is_shared && !t.is_validated).length || 0;
    const pendingExercicesCount = exercicesData?.filter((e: any) => e.status === "pending").length || 0;

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
      totalObjectifs: aggregated.size,
      pendingObjectifs: 0,
    });

    setLoading(false);
  };

  const updateSubscriptionTier = async (userId: string, newTier: "free" | "basic" | "premium") => {
    try {
      await pb.collection("users").update(userId, {
        subscription_tier: newTier,
        is_premium: newTier !== "free",
      });

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
      await pb.collection("users").update(userId, {
        subscription_end_date: newDate ? new Date(newDate).toISOString() : null,
      });

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
      await pb.collection("users").update(userId, { is_banned: !currentStatus });

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
      await pb.collection("users").update(userId, { can_share: !currentStatus });

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
    // Admin status is derived from the user's subscription_tier
    const targetUser = users.find(u => u.user_id === userId);
    const isAdmin = targetUser?.subscription_tier === "admin";

    setAdminConfirmDialog({
      open: true,
      userId,
      userEmail,
      action: isAdmin ? "remove" : "add",
    });
  };

  const confirmToggleAdmin = async () => {
    const { userId, action } = adminConfirmDialog;
    
    try {
      if (action === "remove") {
        // Demote: revert the admin tier back to free
        await pb.collection("users").update(userId, { subscription_tier: "free" });
        toast({ title: "Rôle admin retiré" });
      } else {
        await pb.collection("users").update(userId, { subscription_tier: "admin" });
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
          await pb.collection("subscription_limits").update(limit.id, edits);
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
      await pb.collection("traitement_types").update(traitementId, { is_validated: !currentStatus });

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

  const refuseTraitement = async (traitementId: string) => {
    try {
      await pb.collection("traitement_types").update(traitementId, { is_shared: false, is_validated: false, is_refused: true });
      setTraitements(traitements.map(t =>
        t.id === traitementId ? { ...t, is_shared: false, is_validated: false, is_refused: true } : t
      ));
      toast({ title: "Traitement refusé" });
    } catch (error) {
      console.error("Error refusing traitement:", error);
      toast({ title: "Erreur", description: "Impossible de refuser le traitement.", variant: "destructive" });
    }
  };

  const allowTraitement = async (traitementId: string) => {
    try {
      await pb.collection("traitement_types").update(traitementId, { is_shared: true, is_validated: true, is_refused: false });
      setTraitements(traitements.map(t =>
        t.id === traitementId ? { ...t, is_shared: true, is_validated: true, is_refused: false } : t
      ));
      toast({ title: "Traitement autorisé", description: "Le partage du traitement a été approuvé." });
    } catch (error) {
      console.error("Error allowing traitement:", error);
      toast({ title: "Erreur", description: "Impossible d'autoriser le traitement.", variant: "destructive" });
    }
  };

  const refuseSeance = async (seanceId: string) => {
    try {
      await pb.collection("seance_types").update(seanceId, { is_shared: false, is_validated: false, is_refused: true });
      setSeances(seances.map(s =>
        s.id === seanceId ? { ...s, is_shared: false, is_validated: false, is_refused: true } : s
      ));
      toast({ title: "Séance refusée" });
    } catch (error) {
      console.error("Error refusing seance:", error);
      toast({ title: "Erreur", description: "Impossible de refuser la séance.", variant: "destructive" });
    }
  };

  const revokeSeance = async (seanceId: string) => {
    try {
      await pb.collection("seance_types").update(seanceId, { is_shared: false, is_validated: false, is_refused: false });
      setSeances(seances.map(s =>
        s.id === seanceId ? { ...s, is_shared: false, is_validated: false, is_refused: false } : s
      ));
      toast({ title: "Partage révoqué", description: "La séance est repassée en statut privé." });
    } catch (error) {
      console.error("Error revoking seance:", error);
      toast({ title: "Erreur", description: "Impossible de révoquer le partage.", variant: "destructive" });
    }
  };

  const allowSeance = async (seanceId: string) => {
    try {
      await pb.collection("seance_types").update(seanceId, { is_shared: true, is_validated: true, is_refused: false });
      setSeances(seances.map(s =>
        s.id === seanceId ? { ...s, is_shared: true, is_validated: true, is_refused: false } : s
      ));
      toast({ title: "Séance autorisée", description: "Le partage de la séance a été approuvé." });
    } catch (error) {
      console.error("Error allowing seance:", error);
      toast({ title: "Erreur", description: "Impossible d'autoriser la séance.", variant: "destructive" });
    }
  };

  const deleteSeance = async (seanceId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette séance ?")) return;

    try {
      await pb.collection("seance_types").delete(seanceId);

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
      await pb.collection("traitement_types").delete(traitementId);

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
      await pb.collection("exercices").update(exerciceId, { status: newStatus });

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
      await pb.collection("exercices").delete(exerciceId);

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
      const existing = await pb.collection("exercice_consultations").getFullList({
        filter: `exercice = "${exerciceId}" && user = "${user.id}"`,
      });

      if (isCurrentlyConsulted) {
        // Remove consultation record(s)
        await Promise.all(
          existing.map((rec: any) => pb.collection("exercice_consultations").delete(rec.id))
        );

        setConsultedExerciceIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(exerciceId);
          return newSet;
        });
      } else {
        // Upsert consultation record (PocketBase has no upsert: update if present, else create)
        const payload = {
          exercice: exerciceId,
          user: user.id,
          is_consulted: true,
          consulted_at: new Date().toISOString(),
        };
        if (existing.length > 0) {
          await pb.collection("exercice_consultations").update(existing[0].id, payload);
        } else {
          await pb.collection("exercice_consultations").create(payload);
        }

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

  const toggleSeanceConsulted = (seanceId: string, isCurrentlyConsulted: boolean) => {
    if (!user) return;
    setConsultedSeanceIds(prev => {
      const next = new Set(prev);
      if (isCurrentlyConsulted) {
        next.delete(seanceId);
      } else {
        next.add(seanceId);
      }
      try {
        localStorage.setItem(`admin_consulted_seances_${user.id}`, JSON.stringify([...next]));
      } catch { /* ignore quota errors */ }
      return next;
    });
  };

  const addObjectif = async () => {
    const name = newObjectifName.trim();
    if (!name || !user) return;
    // évite les doublons (insensible casse)
    if (objectifs.some(o => o.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Cet objectif existe déjà", variant: "destructive" });
      return;
    }
    try {
      const created: any = await pb.collection("objectifs").create({
        user: user.id,
        name,
        type: "principal",
      });
      setObjectifs(prev =>
        [
          ...prev,
          {
            id: created.id,
            name: created.name,
            user_id: created.user || null,
            source: "objectifs" as const,
            created_at: created.created || null,
          },
        ].sort((a, b) => a.name.localeCompare(b.name, "fr"))
      );
      setNewObjectifName("");
      toast({ title: "Objectif ajouté" });
    } catch (error) {
      console.error("Error adding objectif:", error);
      toast({ title: "Erreur", description: "Impossible d'ajouter l'objectif.", variant: "destructive" });
    }
  };

  const deleteObjectif = async (objectif: ObjectifItem) => {
    if (objectif.source !== "objectifs") {
      toast({
        title: "Suppression impossible",
        description: "Cet objectif provient d'un exercice ou d'une pathologie, pas de la bibliothèque.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm(`Supprimer l'objectif "${objectif.name}" ?`)) return;
    try {
      await pb.collection("objectifs").delete(objectif.id);
      setObjectifs(prev => prev.filter(o => o.id !== objectif.id));
      toast({ title: "Objectif supprimé" });
    } catch (error) {
      console.error("Error deleting objectif:", error);
      toast({ title: "Erreur", description: "Impossible de supprimer l'objectif.", variant: "destructive" });
    }
  };

  const toggleMessageArchived = (msgId: string) => {
    setArchivedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      try {
        localStorage.setItem("admin_archived_messages", JSON.stringify([...next]));
      } catch { }
      return next;
    });
  };

  const toggleTraitementConsulted = (traitementId: string, isCurrentlyConsulted: boolean) => {
    if (!user) return;
    setConsultedTraitementIds(prev => {
      const next = new Set(prev);
      if (isCurrentlyConsulted) {
        next.delete(traitementId);
      } else {
        next.add(traitementId);
      }
      try {
        localStorage.setItem(`admin_consulted_traitements_${user.id}`, JSON.stringify([...next]));
      } catch { /* ignore quota errors */ }
      return next;
    });
  };

  const approveWithdrawalRequest = async (exerciceId: string) => {
    try {
      await pb.collection("exercices").update(exerciceId, { status: "draft" });
      setExercices((prev) => prev.map((e) => (e.id === exerciceId ? { ...e, status: "draft" } : e)));
      toast({ title: "Retrait approuvé", description: "L'exercice a été retiré des partagés." });
    } catch (error) {
      console.error("Error approving withdrawal:", error);
      toast({ title: "Erreur", description: "Impossible d'approuver la demande.", variant: "destructive" });
    }
  };

  const denyWithdrawalRequest = async (exerciceId: string) => {
    try {
      await pb.collection("exercices").update(exerciceId, { status: "shared" });
      setExercices((prev) => prev.map((e) => (e.id === exerciceId ? { ...e, status: "shared" } : e)));
      toast({ title: "Demande refusée", description: "L'exercice reste dans les partagés." });
    } catch (error) {
      console.error("Error denying withdrawal:", error);
      toast({ title: "Erreur", description: "Impossible de refuser la demande.", variant: "destructive" });
    }
  };

  // Certificat model functions
  const handleAddModel = async () => {
    if (!newModelTitle.trim() || !newModelContent.trim() || !user) return;

    try {
      const data = await pb.collection("certificat_models").create({
        user: user.id,
        title: newModelTitle,
        content: newModelContent,
        is_platform: true,
      });

      setCertificatModels([data as any, ...certificatModels]);
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
      await pb.collection("certificat_models").update(editingModelId, {
        title: editModelTitle,
        content: editModelContent,
      });

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
      await pb.collection("certificat_models").delete(modelId);

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

  // Unique author lists for filters
  const seanceAuthors = [...new Set(seances.filter(s => !s.is_copy && s.author_name).map(s => s.author_name as string))].sort((a, b) => a.localeCompare(b, "fr"));
  const traitementAuthors = [...new Set(traitements.filter(t => !t.is_copy && t.author_name).map(t => t.author_name as string))].sort((a, b) => a.localeCompare(b, "fr"));
  const exerciceAuthors = [...new Set(exercices.filter(e => !e.is_copy && e.author_name).map(e => e.author_name as string))].sort((a, b) => a.localeCompare(b, "fr"));

  const seancePathologies = [...new Set(seances.filter(s => !s.is_copy).map(s => s.pathologie).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const seanceObjectifs = [...new Set(seances.filter(s => !s.is_copy).map(s => s.objectif_principal).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const seanceUserNames = [...new Set(seances.filter(s => !s.is_copy).map(s => getUserDisplayName(s.user_id)))].filter(n => n !== "Inconnu").sort((a, b) => a.localeCompare(b, "fr"));

  const traitementPathologies = [...new Set(traitements.filter(t => !t.is_copy).map(t => t.pathologie).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const traitementUserNames = [...new Set(traitements.filter(t => !t.is_copy).map(t => getUserDisplayName(t.user_id)))].filter(n => n !== "Inconnu").sort((a, b) => a.localeCompare(b, "fr"));
  const exerciceUserNames = [...new Set(exercices.filter(e => !e.is_copy).map(e => getUserDisplayName(e.user_id)))].filter(n => n !== "Inconnu").sort((a, b) => a.localeCompare(b, "fr"));

  const getSeanceStatus = (s: SeanceType) => {
    if (s.is_refused) return "refuse";
    if (s.is_shared && s.is_validated) return "valide";
    if (s.is_shared && !s.is_validated) return "attente";
    return "prive";
  };

  // Filter out copies from seances (only show originals)
  const filteredSeances = seances
    .filter(s => !s.is_copy)
    .filter(s =>
      s.pathologie.toLowerCase().includes(seanceSearch.toLowerCase()) ||
      s.objectif_principal.toLowerCase().includes(seanceSearch.toLowerCase()) ||
      s.author_name?.toLowerCase().includes(seanceSearch.toLowerCase())
    )
    .filter(s => seanceAuthorFilter.length === 0 || (s.author_name !== null && seanceAuthorFilter.includes(s.author_name)))
    .filter(s => seancePathologieFilter.length === 0 || seancePathologieFilter.includes(s.pathologie))
    .filter(s => seanceObjectifFilter.length === 0 || seanceObjectifFilter.includes(s.objectif_principal))
    .filter(s => !seanceDateFromFilter || s.created_at.slice(0, 10) >= format(seanceDateFromFilter, "yyyy-MM-dd"))
    .filter(s => !seanceDateToFilter || s.created_at.slice(0, 10) <= format(seanceDateToFilter, "yyyy-MM-dd"))
    .filter(s => seanceCopiesFilter === "all" || (seanceCopiesFilter === "with" ? (seanceCopyCounts[s.id] || 0) > 0 : (seanceCopyCounts[s.id] || 0) === 0))
    .filter(s => seanceStatusFilter.length === 0 || seanceStatusFilter.includes(getSeanceStatus(s)))
    .filter(s => seanceUserFilter.length === 0 || seanceUserFilter.includes(getUserDisplayName(s.user_id)))
    .filter(s => seanceConsultedFilter === "all" || (seanceConsultedFilter === "consulted" ? consultedSeanceIds.has(s.id) : !consultedSeanceIds.has(s.id)))
    .sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return seanceDateSort === "asc" ? diff : -diff;
    });

  const getTraitementStatus = (t: TraitementType) => {
    if (t.is_refused) return "refuse";
    if (t.is_shared && t.is_validated) return "valide";
    if (t.is_shared && !t.is_validated) return "attente";
    return "prive";
  };

  // Filter out copies from traitements (only show originals)
  const filteredTraitements = traitements
    .filter(t => !t.is_copy)
    .filter(t =>
      t.pathologie.toLowerCase().includes(traitementSearch.toLowerCase()) ||
      t.author_name?.toLowerCase().includes(traitementSearch.toLowerCase())
    )
    .filter(t => traitementPathologieFilter.length === 0 || traitementPathologieFilter.includes(t.pathologie))
    .filter(t => traitementAuthorFilter.length === 0 || (t.author_name !== null && traitementAuthorFilter.includes(t.author_name)))
    .filter(t => !traitementDateFromFilter || t.created_at.slice(0, 10) >= format(traitementDateFromFilter, "yyyy-MM-dd"))
    .filter(t => !traitementDateToFilter || t.created_at.slice(0, 10) <= format(traitementDateToFilter, "yyyy-MM-dd"))
    .filter(t => traitementCopiesFilter === "all" || (traitementCopiesFilter === "with" ? (traitementCopyCounts[t.id] || 0) > 0 : (traitementCopyCounts[t.id] || 0) === 0))
    .filter(t => traitementStatusFilter.length === 0 || traitementStatusFilter.includes(getTraitementStatus(t)))
    .filter(t => traitementUserFilter.length === 0 || traitementUserFilter.includes(getUserDisplayName(t.user_id)))
    .filter(t => traitementConsultedFilter === "all" || (traitementConsultedFilter === "consulted" ? consultedTraitementIds.has(t.id) : !consultedTraitementIds.has(t.id)))
    .sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return traitementDateSort === "asc" ? diff : -diff;
    });

  const pendingTraitements = filteredTraitements.filter(t => t.is_shared && !t.is_validated);
  const pendingSeances = filteredSeances.filter(s => s.is_shared && !s.is_validated);

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
    )
    .filter(e => exerciceAuthorFilter.length === 0 || (e.author_name !== null && exerciceAuthorFilter.includes(e.author_name)))
    .filter(e => !exerciceDateFromFilter || e.created_at.slice(0, 10) >= format(exerciceDateFromFilter, "yyyy-MM-dd"))
    .filter(e => !exerciceDateToFilter || e.created_at.slice(0, 10) <= format(exerciceDateToFilter, "yyyy-MM-dd"))
    .filter(e => exerciceCopiesFilter === "all" || (exerciceCopiesFilter === "with" ? (exerciceCopyCounts[e.id] || 0) > 0 : (exerciceCopyCounts[e.id] || 0) === 0))
    .filter(e => {
      if (exerciceStatusFilter.length === 0) return true;
      const knownStatuses = ['shared', 'pending', 'rejected', 'withdrawal_requested'];
      if (exerciceStatusFilter.includes('brouillon') && !knownStatuses.includes(e.status)) return true;
      return exerciceStatusFilter.includes(e.status);
    })
    .filter(e => exerciceConsultedFilter === "all" || (exerciceConsultedFilter === "consulted" ? consultedExerciceIds.has(e.id) : !consultedExerciceIds.has(e.id)))
    .sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return exerciceDateSort === "asc" ? diff : -diff;
    });

  const pendingExercices = filteredExercices.filter(e => e.status === 'pending');
  const withdrawalExercices = filteredExercices.filter(e => e.status === 'withdrawal_requested');

  const objectifUserNames = [...new Set(objectifs.filter(o => o.user_id).map(o => getUserDisplayName(o.user_id!)))].filter(n => n !== "Inconnu").sort((a, b) => a.localeCompare(b, "fr"));

  const filteredObjectifs = objectifs.filter(o => {
    if (!o.name.toLowerCase().includes(objectifSearch.toLowerCase())) return false;
    if (objectifLetterFilter && !o.name.toUpperCase().startsWith(objectifLetterFilter)) return false;
    if (objectifSourceFilter.length > 0 && !objectifSourceFilter.includes(o.source)) return false;
    if (objectifUserFilter.length > 0 && !objectifUserFilter.includes(getUserDisplayName(o.user_id ?? ""))) return false;
    return true;
  });

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
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
              <p className="text-xs text-muted-foreground">Utilisateurs</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-500/10 border-purple-500/20">
            <CardContent className="p-4 text-center">
              <Crown className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <p className="text-2xl font-bold">{stats.premiumUsers}</p>
              <p className="text-xs text-muted-foreground">Premium</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardContent className="p-4 text-center">
              <Sparkles className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{stats.basicUsers}</p>
              <p className="text-xs text-muted-foreground">Basic</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/20">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 mx-auto text-yellow-500 mb-2" />
              <p className="text-2xl font-bold">{stats.trialUsers}</p>
              <p className="text-xs text-muted-foreground">En essai</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/60 border-muted-foreground/20">
            <CardContent className="p-4 text-center">
              <CreditCard className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold">{stats.freeUsers}</p>
              <p className="text-xs text-muted-foreground">Gratuit</p>
            </CardContent>
          </Card>
          <Card className={stats.pendingExercices > 0 || stats.pendingTraitements > 0 ? "bg-orange-500/10 border-orange-500" : "bg-muted/30"}>
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
            <TabsTrigger value="seances" className="relative flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Séances
              {filteredSeances.filter(s => !consultedSeanceIds.has(s.id)).length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 px-0 text-xs flex items-center justify-center">{filteredSeances.filter(s => !consultedSeanceIds.has(s.id)).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="traitements" className="relative flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Traitements
              {filteredTraitements.filter(t => !consultedTraitementIds.has(t.id)).length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 px-0 text-xs flex items-center justify-center">{filteredTraitements.filter(t => !consultedTraitementIds.has(t.id)).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="exercices" className="relative flex items-center gap-2">
              <Dumbbell className="w-4 h-4" />
              Exercices
              {filteredExercices.filter(e => !consultedExerciceIds.has(e.id)).length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 px-0 text-xs flex items-center justify-center">{filteredExercices.filter(e => !consultedExerciceIds.has(e.id)).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="objectifs" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Objectifs
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
            <TabsTrigger value="annonces" className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              Annonces
            </TabsTrigger>
            <TabsTrigger value="popups" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Pop-ups
            </TabsTrigger>
            <TabsTrigger value="messages" className="relative flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Messages
              {contactMessages.filter(m => !archivedMessageIds.has(m.id)).length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 px-0 text-xs flex items-center justify-center">{contactMessages.filter(m => !archivedMessageIds.has(m.id)).length}</Badge>
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
                        <th className="text-left py-3 px-2">Abonnement</th>
                        <th className="text-left py-3 px-2">Fin abonnement</th>
                        <th className="text-left py-3 px-2">Partage</th>
                        <th className="text-left py-3 px-2">Banni</th>
                        <th className="text-left py-3 px-2">Admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                         const isUserAdmin =
                           adminUserIds.has(u.user_id) ||
                           u.subscription_tier === "admin";

                        return (
                          <tr key={u.user_id} className={`border-b hover:bg-muted/50 ${u.is_banned ? "bg-red-500/10" : ""} ${isUserAdmin ? "bg-primary/5" : ""}`}>
                            <td className="py-3 px-2">
                              <div className="flex flex-col">
                                <span>{u.first_name} {u.last_name}</span>
                                {u.pseudo && <span className="text-xs text-muted-foreground">{u.pseudo}</span>}
                              </div>
                            </td>
                            <td className="py-3 px-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                {u.email}
                                {u.has_stripe_account && (
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
                                variant={isUserAdmin ? "default" : "outline"}
                                size="sm"
                                onClick={() => openAdminConfirmDialog(u.user_id, u.email)}
                                className={isUserAdmin ? "bg-primary text-primary-foreground" : ""}
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
                {pendingSeances.length > 0 && (
                  <div className="mb-6 p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <h3 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      En attente de validation de partage ({pendingSeances.length})
                    </h3>
                    <div className="space-y-2">
                      {pendingSeances.map((s) => (
                        <div key={s.id} className="flex items-center justify-between bg-background p-3 rounded-lg">
                          <div>
                            <p className="font-medium">{s.pathologie}</p>
                            <p className="text-sm text-muted-foreground">{s.author_name || "Anonyme"}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => refuseSeance(s.id)}
                              className="gap-1 border-red-500 text-red-500 hover:bg-red-50"
                            >
                              Refuser
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteSeance(s.id)}
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
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Pathologie</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {seancePathologieFilter.length === 0 ? "Tous" : `${seancePathologieFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-52 p-2" align="start">
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                  {seancePathologies.map(p => (
                                    <label key={p} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox checked={seancePathologieFilter.includes(p)} onCheckedChange={(checked) => setSeancePathologieFilter(prev => checked ? [...prev, p] : prev.filter(x => x !== p))} />
                                      {p}
                                    </label>
                                  ))}
                                </div>
                                {seancePathologieFilter.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setSeancePathologieFilter([])}>Tout effacer</Button>}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Objectif</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {seanceObjectifFilter.length === 0 ? "Tous" : `${seanceObjectifFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-52 p-2" align="start">
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                  {seanceObjectifs.map(o => (
                                    <label key={o} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox checked={seanceObjectifFilter.includes(o)} onCheckedChange={(checked) => setSeanceObjectifFilter(prev => checked ? [...prev, o] : prev.filter(x => x !== o))} />
                                      {o}
                                    </label>
                                  ))}
                                </div>
                                {seanceObjectifFilter.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setSeanceObjectifFilter([])}>Tout effacer</Button>}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">Auteur</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  Pseudo saisi lors de la création de la séance — figé à ce moment-là, même si l'utilisateur change de pseudo ensuite.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {seanceAuthorFilter.length === 0 ? "Tous" : `${seanceAuthorFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2" align="start">
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                  {seanceAuthors.map(a => (
                                    <label key={a} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox checked={seanceAuthorFilter.includes(a)} onCheckedChange={(checked) => setSeanceAuthorFilter(prev => checked ? [...prev, a] : prev.filter(x => x !== a))} />
                                      {a}
                                    </label>
                                  ))}
                                </div>
                                {seanceAuthorFilter.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setSeanceAuthorFilter([])}>Tout effacer</Button>}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => setSeanceDateSort(prev => prev === "desc" ? "asc" : "desc")}
                              className="flex items-center gap-1 hover:text-primary transition-colors font-semibold text-left"
                            >
                              Créé le
                              {seanceDateSort === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                            </button>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  <CalendarIcon className="w-3 h-3 mr-1 opacity-60" />
                                  {seanceDateFromFilter && seanceDateToFilter
                                    ? `${format(seanceDateFromFilter, "dd/MM")}–${format(seanceDateToFilter, "dd/MM")}`
                                    : seanceDateFromFilter
                                    ? `Dès ${format(seanceDateFromFilter, "dd/MM/yy")}`
                                    : seanceDateToFilter
                                    ? `≤ ${format(seanceDateToFilter, "dd/MM/yy")}`
                                    : "Tous"}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <div className="grid grid-cols-2 px-4 pt-3 pb-2 border-b">
                                  <div className="text-center">
                                    <p className="text-xs font-bold uppercase tracking-wide text-foreground">Du</p>
                                    <p className="text-sm text-muted-foreground mt-0.5">{seanceDateFromFilter ? format(seanceDateFromFilter, "d MMMM yyyy", { locale: fr }) : "—"}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs font-bold uppercase tracking-wide text-foreground">Au</p>
                                    <p className="text-sm text-muted-foreground mt-0.5">{seanceDateToFilter ? format(seanceDateToFilter, "d MMMM yyyy", { locale: fr }) : "—"}</p>
                                  </div>
                                </div>
                                <Calendar
                                  mode="range"
                                  selected={{ from: seanceDateFromFilter, to: seanceDateToFilter }}
                                  onSelect={(range) => {
                                    setSeanceDateFromFilter(range?.from);
                                    setSeanceDateToFilter(range?.to);
                                  }}
                                  numberOfMonths={2}
                                  locale={fr}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                                {(seanceDateFromFilter || seanceDateToFilter) && (
                                  <div className="px-3 pb-3">
                                    <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => { setSeanceDateFromFilter(undefined); setSeanceDateToFilter(undefined); }}>Effacer les dates</Button>
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Copies</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {seanceCopiesFilter === "all" ? "Tous" : seanceCopiesFilter === "with" ? "Avec" : "Sans"}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-40 p-2" align="start">
                                <div className="space-y-1">
                                  {([["all", "Tous"], ["with", "Avec copies"], ["without", "Sans copies"]] as const).map(([val, lbl]) => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <input type="radio" name="seanceCopiesFilter" checked={seanceCopiesFilter === val} onChange={() => setSeanceCopiesFilter(val)} />
                                      {lbl}
                                    </label>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Statut du partage</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {seanceStatusFilter.length === 0 ? "Tous" : `${seanceStatusFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2" align="start">
                                <div className="space-y-1">
                                  {([["prive", "Privé"], ["attente", "En attente"], ["valide", "Partagé & Validé"], ["refuse", "Refusé"]] as const).map(([val, lbl]) => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox checked={seanceStatusFilter.includes(val)} onCheckedChange={(checked) => setSeanceStatusFilter(prev => checked ? [...prev, val] : prev.filter(x => x !== val))} />
                                      {lbl}
                                    </label>
                                  ))}
                                </div>
                                {seanceStatusFilter.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setSeanceStatusFilter([])}>Tout effacer</Button>}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">Actions</th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">Utilisateur</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  Nom actuel du compte propriétaire de la séance — mis à jour si l'utilisateur modifie son profil.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {seanceUserFilter.length === 0 ? "Tous" : `${seanceUserFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2" align="start">
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                  {seanceUserNames.map(u => (
                                    <label key={u} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox checked={seanceUserFilter.includes(u)} onCheckedChange={(checked) => setSeanceUserFilter(prev => checked ? [...prev, u] : prev.filter(x => x !== u))} />
                                      {u}
                                    </label>
                                  ))}
                                </div>
                                {seanceUserFilter.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setSeanceUserFilter([])}>Tout effacer</Button>}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Consulté</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {seanceConsultedFilter === "all" ? "Tous" : seanceConsultedFilter === "consulted" ? "Consulté" : "Non consulté"}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-44 p-2" align="start">
                                <div className="space-y-1">
                                  {([["all", "Tous"], ["consulted", "Consulté"], ["not-consulted", "Non consulté"]] as const).map(([val, lbl]) => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <input type="radio" name="seanceConsultedFilter" checked={seanceConsultedFilter === val} onChange={() => setSeanceConsultedFilter(val)} />
                                      {lbl}
                                    </label>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
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
                            {s.is_refused ? (
                              <Badge className="bg-red-500">Refusé</Badge>
                            ) : s.is_shared ? (
                              s.is_validated ? (
                                <Badge className="bg-green-500">Partagé & Validé</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-orange-500">En attente</Badge>
                              )
                            ) : (
                              <Badge variant="outline">Privé</Badge>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex gap-2">
                              {s.is_refused && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => allowSeance(s.id)}
                                  className="gap-1 border-green-500 text-green-600 hover:bg-green-50"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Autoriser
                                </Button>
                              )}
                              {s.is_shared && s.is_validated && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => revokeSeance(s.id)}
                                  className="gap-1 border-orange-500 text-orange-600 hover:bg-orange-50"
                                >
                                  Révoquer
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteSeance(s.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {getUserDisplayName(s.user_id)}
                          </td>
                          <td className="py-3 px-2" onClick={(ev) => ev.stopPropagation()}>
                            <Button
                              variant={consultedSeanceIds.has(s.id) ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleSeanceConsulted(s.id, consultedSeanceIds.has(s.id))}
                              className="gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {consultedSeanceIds.has(s.id) ? "Consulté" : "Non consulté"}
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
                      En attente de validation de partage ({pendingTraitements.length})
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
                              variant="outline"
                              size="sm"
                              onClick={() => refuseTraitement(t.id)}
                              className="gap-1 border-red-500 text-red-500 hover:bg-red-50"
                            >
                              Refuser
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
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Pathologie</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {traitementPathologieFilter.length === 0 ? "Tous" : `${traitementPathologieFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-52 p-2" align="start">
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                  {traitementPathologies.map(p => (
                                    <label key={p} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox checked={traitementPathologieFilter.includes(p)} onCheckedChange={(checked) => setTraitementPathologieFilter(prev => checked ? [...prev, p] : prev.filter(x => x !== p))} />
                                      {p}
                                    </label>
                                  ))}
                                </div>
                                {traitementPathologieFilter.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setTraitementPathologieFilter([])}>Tout effacer</Button>}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">Auteur</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  Pseudo saisi lors de la création du traitement — figé à ce moment-là, même si l'utilisateur change de pseudo ensuite.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {traitementAuthorFilter.length === 0 ? "Tous" : `${traitementAuthorFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2" align="start">
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                  {traitementAuthors.map(a => (
                                    <label key={a} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox
                                        checked={traitementAuthorFilter.includes(a)}
                                        onCheckedChange={(checked) => setTraitementAuthorFilter(prev => checked ? [...prev, a] : prev.filter(x => x !== a))}
                                      />
                                      {a}
                                    </label>
                                  ))}
                                </div>
                                {traitementAuthorFilter.length > 0 && (
                                  <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setTraitementAuthorFilter([])}>
                                    Tout effacer
                                  </Button>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => setTraitementDateSort(prev => prev === "desc" ? "asc" : "desc")}
                              className="flex items-center gap-1 hover:text-primary transition-colors font-semibold text-left"
                            >
                              Créé le
                              {traitementDateSort === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                            </button>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  <CalendarIcon className="w-3 h-3 mr-1 opacity-60" />
                                  {traitementDateFromFilter && traitementDateToFilter
                                    ? `${format(traitementDateFromFilter, "dd/MM")}–${format(traitementDateToFilter, "dd/MM")}`
                                    : traitementDateFromFilter
                                    ? `Dès ${format(traitementDateFromFilter, "dd/MM/yy")}`
                                    : traitementDateToFilter
                                    ? `≤ ${format(traitementDateToFilter, "dd/MM/yy")}`
                                    : "Tous"}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <div className="grid grid-cols-2 px-4 pt-3 pb-2 border-b">
                                  <div className="text-center">
                                    <p className="text-xs font-bold uppercase tracking-wide text-foreground">Du</p>
                                    <p className="text-sm text-muted-foreground mt-0.5">{traitementDateFromFilter ? format(traitementDateFromFilter, "d MMMM yyyy", { locale: fr }) : "—"}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs font-bold uppercase tracking-wide text-foreground">Au</p>
                                    <p className="text-sm text-muted-foreground mt-0.5">{traitementDateToFilter ? format(traitementDateToFilter, "d MMMM yyyy", { locale: fr }) : "—"}</p>
                                  </div>
                                </div>
                                <Calendar
                                  mode="range"
                                  selected={{ from: traitementDateFromFilter, to: traitementDateToFilter }}
                                  onSelect={(range) => {
                                    setTraitementDateFromFilter(range?.from);
                                    setTraitementDateToFilter(range?.to);
                                  }}
                                  numberOfMonths={2}
                                  locale={fr}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                                {(traitementDateFromFilter || traitementDateToFilter) && (
                                  <div className="px-3 pb-3">
                                    <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => { setTraitementDateFromFilter(undefined); setTraitementDateToFilter(undefined); }}>Effacer les dates</Button>
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Copies</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {traitementCopiesFilter === "all" ? "Tous" : traitementCopiesFilter === "with" ? "Avec" : "Sans"}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-40 p-2" align="start">
                                <div className="space-y-1">
                                  {([["all", "Tous"], ["with", "Avec copies"], ["without", "Sans copies"]] as const).map(([val, lbl]) => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <input type="radio" name="traitementCopiesFilter" checked={traitementCopiesFilter === val} onChange={() => setTraitementCopiesFilter(val)} />
                                      {lbl}
                                    </label>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Statut du partage</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {traitementStatusFilter.length === 0 ? "Tous" : `${traitementStatusFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2" align="start">
                                <div className="space-y-1">
                                  {([["prive", "Privé"], ["attente", "En attente"], ["valide", "Partagé & Validé"], ["refuse", "Refusé"]] as const).map(([val, lbl]) => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox checked={traitementStatusFilter.includes(val)} onCheckedChange={(checked) => setTraitementStatusFilter(prev => checked ? [...prev, val] : prev.filter(x => x !== val))} />
                                      {lbl}
                                    </label>
                                  ))}
                                </div>
                                {traitementStatusFilter.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setTraitementStatusFilter([])}>Tout effacer</Button>}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">Validé</th>
                        <th className="text-left py-3 px-2 align-top">Actions</th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">Utilisateur</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  Nom actuel du compte propriétaire du traitement — mis à jour si l'utilisateur modifie son profil.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {traitementUserFilter.length === 0 ? "Tous" : `${traitementUserFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2" align="start">
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                  {traitementUserNames.map(u => (
                                    <label key={u} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox checked={traitementUserFilter.includes(u)} onCheckedChange={(checked) => setTraitementUserFilter(prev => checked ? [...prev, u] : prev.filter(x => x !== u))} />
                                      {u}
                                    </label>
                                  ))}
                                </div>
                                {traitementUserFilter.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setTraitementUserFilter([])}>Tout effacer</Button>}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Consulté</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {traitementConsultedFilter === "all" ? "Tous" : traitementConsultedFilter === "consulted" ? "Consulté" : "Non consulté"}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-44 p-2" align="start">
                                <div className="space-y-1">
                                  {([["all", "Tous"], ["consulted", "Consulté"], ["not-consulted", "Non consulté"]] as const).map(([val, lbl]) => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <input type="radio" name="traitementConsultedFilter" checked={traitementConsultedFilter === val} onChange={() => setTraitementConsultedFilter(val)} />
                                      {lbl}
                                    </label>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
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
                            {t.is_refused ? (
                              <Badge className="bg-red-500">Refusé</Badge>
                            ) : t.is_shared ? (
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
                            <div className="flex gap-2">
                              {t.is_refused && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => allowTraitement(t.id)}
                                  className="gap-1 border-green-500 text-green-600 hover:bg-green-50"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Autoriser
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteTraitement(t.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {getUserDisplayName(t.user_id)}
                          </td>
                          <td className="py-3 px-2" onClick={(ev) => ev.stopPropagation()}>
                            <Button
                              variant={consultedTraitementIds.has(t.id) ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleTraitementConsulted(t.id, consultedTraitementIds.has(t.id))}
                              className="gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {consultedTraitementIds.has(t.id) ? "Consulté" : "Non consulté"}
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
                    placeholder="Rechercher par titre ou auteur..."
                    value={exerciceSearch}
                    onChange={(e) => setExerciceSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {withdrawalExercices.length > 0 && (
                  <div className="mb-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h3 className="font-semibold text-blue-600 mb-3 flex items-center gap-2">
                      <Undo2 className="w-4 h-4" />
                      Demandes de retrait ({withdrawalExercices.length})
                    </h3>
                    <div className="space-y-2">
                      {withdrawalExercices.map((e) => (
                        <div key={e.id} className="flex items-center justify-between bg-background p-3 rounded-lg">
                          <div>
                            <p className="font-medium">{e.title}</p>
                            <p className="text-sm text-muted-foreground">{e.author_name || "Anonyme"}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => approveWithdrawalRequest(e.id)}
                              className="gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approuver le retrait
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => denyWithdrawalRequest(e.id)}
                              className="gap-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                            >
                              <XCircle className="w-4 h-4" />
                              Refuser
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pendingExercices.length > 0 && (
                  <div className="mb-6 p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <h3 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      En attente de validation de partage ({pendingExercices.length})
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
                        <th className="text-left py-3 px-2 align-top">Titre</th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">Auteur</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  Pseudo saisi lors de la création de l'exercice — figé à ce moment-là, même si l'utilisateur change de pseudo ensuite.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {exerciceAuthorFilter.length === 0 ? "Tous" : `${exerciceAuthorFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2" align="start">
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                  {exerciceAuthors.map(a => (
                                    <label key={a} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox
                                        checked={exerciceAuthorFilter.includes(a)}
                                        onCheckedChange={(checked) => setExerciceAuthorFilter(prev => checked ? [...prev, a] : prev.filter(x => x !== a))}
                                      />
                                      {a}
                                    </label>
                                  ))}
                                </div>
                                {exerciceAuthorFilter.length > 0 && (
                                  <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setExerciceAuthorFilter([])}>
                                    Tout effacer
                                  </Button>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => setExerciceDateSort(prev => prev === "desc" ? "asc" : "desc")}
                              className="flex items-center gap-1 hover:text-primary transition-colors font-semibold text-left"
                            >
                              Créé le
                              {exerciceDateSort === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                            </button>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  <CalendarIcon className="w-3 h-3 mr-1 opacity-60" />
                                  {exerciceDateFromFilter && exerciceDateToFilter
                                    ? `${format(exerciceDateFromFilter, "dd/MM")}–${format(exerciceDateToFilter, "dd/MM")}`
                                    : exerciceDateFromFilter
                                    ? `Dès ${format(exerciceDateFromFilter, "dd/MM/yy")}`
                                    : exerciceDateToFilter
                                    ? `≤ ${format(exerciceDateToFilter, "dd/MM/yy")}`
                                    : "Tous"}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <div className="grid grid-cols-2 px-4 pt-3 pb-2 border-b">
                                  <div className="text-center">
                                    <p className="text-xs font-bold uppercase tracking-wide text-foreground">Du</p>
                                    <p className="text-sm text-muted-foreground mt-0.5">{exerciceDateFromFilter ? format(exerciceDateFromFilter, "d MMMM yyyy", { locale: fr }) : "—"}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs font-bold uppercase tracking-wide text-foreground">Au</p>
                                    <p className="text-sm text-muted-foreground mt-0.5">{exerciceDateToFilter ? format(exerciceDateToFilter, "d MMMM yyyy", { locale: fr }) : "—"}</p>
                                  </div>
                                </div>
                                <Calendar
                                  mode="range"
                                  selected={{ from: exerciceDateFromFilter, to: exerciceDateToFilter }}
                                  onSelect={(range) => {
                                    setExerciceDateFromFilter(range?.from);
                                    setExerciceDateToFilter(range?.to);
                                  }}
                                  numberOfMonths={2}
                                  locale={fr}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                                {(exerciceDateFromFilter || exerciceDateToFilter) && (
                                  <div className="px-3 pb-3">
                                    <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => { setExerciceDateFromFilter(undefined); setExerciceDateToFilter(undefined); }}>Effacer les dates</Button>
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Copies</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {exerciceCopiesFilter === "all" ? "Tous" : exerciceCopiesFilter === "with" ? "Avec" : "Sans"}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-40 p-2" align="start">
                                <div className="space-y-1">
                                  {([["all", "Tous"], ["with", "Avec copies"], ["without", "Sans copies"]] as const).map(([val, lbl]) => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <input type="radio" name="exerciceCopiesFilter" checked={exerciceCopiesFilter === val} onChange={() => setExerciceCopiesFilter(val)} />
                                      {lbl}
                                    </label>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Statut du partage</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {exerciceStatusFilter.length === 0 ? "Tous" : `${exerciceStatusFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-52 p-2" align="start">
                                <div className="space-y-1">
                                  {([["shared", "Partagé"], ["pending", "En attente"], ["rejected", "Refusé"], ["withdrawal_requested", "Retrait demandé"], ["brouillon", "Brouillon"]] as const).map(([val, lbl]) => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox checked={exerciceStatusFilter.includes(val)} onCheckedChange={(checked) => setExerciceStatusFilter(prev => checked ? [...prev, val] : prev.filter(x => x !== val))} />
                                      {lbl}
                                    </label>
                                  ))}
                                </div>
                                {exerciceStatusFilter.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setExerciceStatusFilter([])}>Tout effacer</Button>}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">Plateforme</th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Consulté</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {exerciceConsultedFilter === "all" ? "Tous" : exerciceConsultedFilter === "consulted" ? "Consulté" : "Non consulté"}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-44 p-2" align="start">
                                <div className="space-y-1">
                                  {([["all", "Tous"], ["consulted", "Consulté"], ["not-consulted", "Non consulté"]] as const).map(([val, lbl]) => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <input type="radio" name="exerciceConsultedFilter" checked={exerciceConsultedFilter === val} onChange={() => setExerciceConsultedFilter(val)} />
                                      {lbl}
                                    </label>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
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
                            ) : e.status === 'rejected' ? (
                              <Badge className="bg-red-500">Refusé</Badge>
                            ) : e.status === 'withdrawal_requested' ? (
                              <Badge variant="secondary" className="bg-purple-500">Retrait demandé</Badge>
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

          <TabsContent value="objectifs">
            <Card>
              <CardHeader>
                <CardTitle>Bibliothèque d'objectifs ({objectifs.length})</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Regroupement de tous les objectifs issus des exercices et des pathologies.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nouvel objectif..."
                    value={newObjectifName}
                    onChange={(e) => setNewObjectifName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addObjectif(); } }}
                  />
                  <Button onClick={addObjectif} disabled={!newObjectifName.trim()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Rechercher..."
                    value={objectifSearch}
                    onChange={(e) => setObjectifSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex w-full gap-0.5">
                  {["Tous", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((letter) => {
                    const value = letter === "Tous" ? "" : letter;
                    const active = objectifLetterFilter === value;
                    const hasItems = letter === "Tous" || objectifs.some(o => o.name.toUpperCase().startsWith(letter));
                    return (
                      <button
                        key={letter}
                        onClick={() => setObjectifLetterFilter(value)}
                        disabled={!hasItems}
                        className={[
                          "flex-1 py-1.5 text-xs font-medium transition-all rounded-full border",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : hasItems
                              ? "bg-background text-foreground border-border hover:bg-muted"
                              : "bg-transparent text-muted-foreground/35 border-border/30 cursor-not-allowed",
                        ].join(" ")}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Objectif</th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Origine</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {objectifSourceFilter.length === 0 ? "Tous" : `${objectifSourceFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2" align="start">
                                <div className="space-y-1">
                                  {([["objectifs", "Bibliothèque"], ["exercices", "Exercice"], ["pathologies", "Pathologie"]] as const).map(([val, lbl]) => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox checked={objectifSourceFilter.includes(val)} onCheckedChange={(checked) => setObjectifSourceFilter(prev => checked ? [...prev, val] : prev.filter(x => x !== val))} />
                                      {lbl}
                                    </label>
                                  ))}
                                </div>
                                {objectifSourceFilter.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setObjectifSourceFilter([])}>Tout effacer</Button>}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span>Utilisateur</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal w-36 justify-between">
                                  {objectifUserFilter.length === 0 ? "Tous" : `${objectifUserFilter.length} sél.`}
                                  <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2" align="start">
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                  {objectifUserNames.map(u => (
                                    <label key={u} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                                      <Checkbox checked={objectifUserFilter.includes(u)} onCheckedChange={(checked) => setObjectifUserFilter(prev => checked ? [...prev, u] : prev.filter(x => x !== u))} />
                                      {u}
                                    </label>
                                  ))}
                                </div>
                                {objectifUserFilter.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setObjectifUserFilter([])}>Tout effacer</Button>}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="text-left py-3 px-2 w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredObjectifs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-muted-foreground">
                            Aucun objectif.
                          </td>
                        </tr>
                      ) : (
                        filteredObjectifs.map((o) => (
                          <tr key={o.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2 font-medium">{o.name}</td>
                            <td className="py-3 px-2">
                              {o.source === "objectifs" ? (
                                <Badge variant="secondary">Bibliothèque</Badge>
                              ) : o.source === "exercices" ? (
                                <Badge variant="outline" className="border-blue-500 text-blue-600">Exercice</Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-500 text-amber-600">Pathologie</Badge>
                              )}
                            </td>
                            <td className="py-3 px-2 text-sm text-muted-foreground">
                              {o.user_id ? getUserDisplayName(o.user_id) : "—"}
                            </td>
                            <td className="py-3 px-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteObjectif(o)}
                                disabled={o.source !== "objectifs"}
                                title={o.source !== "objectifs" ? "Provient d'un exercice/pathologie" : ""}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
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

          <TabsContent value="annonces">
            <AnnoncesManagement />
          </TabsContent>

          <TabsContent value="popups">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des pop-ups</CardTitle>
              </CardHeader>
              <CardContent>
                <PopupsManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Messages de contact ({contactMessages.filter(m => !archivedMessageIds.has(m.id)).length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Active messages */}
                {contactMessages.filter(m => !archivedMessageIds.has(m.id)).length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Aucun nouveau message.</p>
                ) : (
                  <div className="space-y-4">
                    {contactMessages.filter(m => !archivedMessageIds.has(m.id)).map((msg) => (
                      <div key={msg.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <p className="font-medium">{msg.name || "—"}</p>
                            <p className="text-sm text-muted-foreground">{msg.email}</p>
                            {msg.subject && (
                              <p className="text-sm font-medium text-foreground/80">{msg.subject}</p>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <p className="text-xs text-muted-foreground">{formatDateTime(msg.created)}</p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleMessageArchived(msg.id)}
                                className="gap-1"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Lu
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  if (!confirm("Supprimer ce message ?")) return;
                                  try {
                                    await pb.collection("contact_messages").delete(msg.id);
                                    setContactMessages(prev => prev.filter(m => m.id !== msg.id));
                                    toast({ title: "Message supprimé" });
                                  } catch (e: any) {
                                    toast({ title: "Erreur", description: e.message, variant: "destructive" });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Archived messages */}
                {contactMessages.filter(m => archivedMessageIds.has(m.id)).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-muted-foreground flex items-center gap-2 border-t pt-6">
                      <CheckCircle className="w-4 h-4" />
                      Messages archivés ({contactMessages.filter(m => archivedMessageIds.has(m.id)).length})
                    </h3>
                    {contactMessages.filter(m => archivedMessageIds.has(m.id)).map((msg) => (
                      <div key={msg.id} className="border rounded-lg p-4 space-y-2 opacity-60">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <p className="font-medium">{msg.name || "—"}</p>
                            <p className="text-sm text-muted-foreground">{msg.email}</p>
                            {msg.subject && (
                              <p className="text-sm font-medium text-foreground/80">{msg.subject}</p>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <p className="text-xs text-muted-foreground">{formatDateTime(msg.created)}</p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleMessageArchived(msg.id)}
                                className="gap-1"
                              >
                                <Undo2 className="w-4 h-4" />
                                Non lu
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  if (!confirm("Supprimer ce message ?")) return;
                                  try {
                                    await pb.collection("contact_messages").delete(msg.id);
                                    setContactMessages(prev => prev.filter(m => m.id !== msg.id));
                                    toast({ title: "Message supprimé" });
                                  } catch (e: any) {
                                    toast({ title: "Erreur", description: e.message, variant: "destructive" });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
