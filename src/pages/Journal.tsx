import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Search, 
  ArrowLeft, 
  Trash2, 
  Calendar, 
  Plus, 
  Edit, 
  Eye, 
  Share2, 
  Copy, 
  UserPlus,
  FileText,
  Video,
  ClipboardList,
  Dumbbell,
  User,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ActivityLog {
  id: string;
  action_type: string;
  section: string;
  title: string;
  details: string | null;
  resource_id: string | null;
  resource_type: string | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <Plus className="w-4 h-4" />,
  edit: <Edit className="w-4 h-4" />,
  delete: <Trash2 className="w-4 h-4" />,
  view: <Eye className="w-4 h-4" />,
  share: <Share2 className="w-4 h-4" />,
  duplicate: <Copy className="w-4 h-4" />,
  add_patient: <UserPlus className="w-4 h-4" />,
};

const ACTION_LABELS: Record<string, string> = {
  create: "Création",
  edit: "Modification",
  delete: "Suppression",
  view: "Consultation",
  share: "Partage",
  duplicate: "Duplication",
  add_patient: "Ajout patient",
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  patients: <User className="w-4 h-4" />,
  exercices: <Dumbbell className="w-4 h-4" />,
  seances: <ClipboardList className="w-4 h-4" />,
  traitements: <FileText className="w-4 h-4" />,
  videos: <Video className="w-4 h-4" />,
  notes: <FileText className="w-4 h-4" />,
};

const SECTION_LABELS: Record<string, string> = {
  patients: "Patients",
  exercices: "Exercices",
  seances: "Séances",
  traitements: "Traitements",
  videos: "Vidéos",
  notes: "Notes",
  profile: "Profil",
  bilans: "Bilans",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  edit: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  view: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  share: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  duplicate: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  add_patient: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
};

export default function Journal() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [logs, searchQuery, sectionFilter, actionFilter]);

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("user_activity_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Erreur lors du chargement du journal");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...logs];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (log) =>
          log.title.toLowerCase().includes(query) ||
          log.details?.toLowerCase().includes(query) ||
          log.section.toLowerCase().includes(query)
      );
    }

    if (sectionFilter !== "all") {
      result = result.filter((log) => log.section === sectionFilter);
    }

    if (actionFilter !== "all") {
      result = result.filter((log) => log.action_type === actionFilter);
    }

    setFilteredLogs(result);
  };

  const handleClearLogs = async () => {
    if (!user) return;
    setClearing(true);
    
    try {
      const { error } = await supabase
        .from("user_activity_logs")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      
      setLogs([]);
      setClearDialogOpen(false);
      toast.success("Journal effacé");
    } catch (error) {
      console.error("Error clearing logs:", error);
      toast.error("Erreur lors de l'effacement");
    } finally {
      setClearing(false);
    }
  };

  const getSections = () => {
    const sections = new Set(logs.map((log) => log.section));
    return Array.from(sections);
  };

  const getActions = () => {
    const actions = new Set(logs.map((log) => log.action_type));
    return Array.from(actions);
  };

  const groupLogsByDate = () => {
    const groups: Record<string, ActivityLog[]> = {};
    
    filteredLogs.forEach((log) => {
      const date = format(new Date(log.created_at), "yyyy-MM-dd");
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(log);
    });
    
    return groups;
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  const groupedLogs = groupLogsByDate();

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 px-1 sm:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/profile")}
              className="h-9 w-9"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Journal d'activité</h1>
              <p className="text-sm text-muted-foreground">
                Historique de vos actions sur la plateforme
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClearDialogOpen(true)}
            disabled={logs.length === 0}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Effacer le journal
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes sections</SelectItem>
                    {getSections().map((section) => (
                      <SelectItem key={section} value={section}>
                        {SECTION_LABELS[section] || section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes actions</SelectItem>
                    {getActions().map((action) => (
                      <SelectItem key={action} value={action}>
                        {ACTION_LABELS[action] || action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Activités ({filteredLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">
                  {logs.length === 0
                    ? "Aucune activité enregistrée"
                    : "Aucune activité correspondant aux filtres"}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[60vh]">
                <div className="space-y-6">
                  {Object.entries(groupedLogs).map(([date, dateLogs]) => (
                    <div key={date}>
                      <div className="sticky top-0 bg-background/95 backdrop-blur-sm py-2 mb-2 z-10">
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(date), "EEEE d MMMM yyyy", { locale: fr })}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {dateLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                          >
                            {/* Action icon */}
                            <div className={`p-2 rounded-full ${ACTION_COLORS[log.action_type] || "bg-muted"}`}>
                              {ACTION_ICONS[log.action_type] || <FileText className="w-4 h-4" />}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-xs">
                                  {SECTION_LABELS[log.section] || log.section}
                                </Badge>
                                <span className="font-medium text-sm truncate">
                                  {log.title}
                                </span>
                              </div>
                              {log.details && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {log.details}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(log.created_at), "HH:mm", { locale: fr })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clear Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Effacer le journal ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement tout l'historique de vos activités.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearLogs}
              disabled={clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? "Suppression..." : "Effacer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}