import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, ClipboardList, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Traitement {
  id: string;
  pathologie: string;
  description: string | null;
  author_name: string | null;
  is_shared: boolean;
  seances_count: number;
  tests_count: number;
}

interface SelectTraitementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (traitementId: string) => void;
  onCreate: () => void;
}

export function SelectTraitementDialog({
  open,
  onOpenChange,
  onSelect,
  onCreate,
}: SelectTraitementDialogProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [personalTraitements, setPersonalTraitements] = useState<Traitement[]>([]);
  const [platformTraitements, setPlatformTraitements] = useState<Traitement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchTraitements();
    }
  }, [open, user]);

  const fetchTraitements = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch personal traitements (not hidden from list)
      const { data: personal } = await supabase
        .from("traitement_types")
        .select("id, pathologie, description, author_name, is_shared")
        .eq("user_id", user.id)
        .eq("is_hidden_from_list", false)
        .order("created_at", { ascending: false });

      // Fetch shared/platform traitements (validated and not user's own)
      const { data: platform } = await supabase
        .from("traitement_types")
        .select("id, pathologie, description, author_name, is_shared")
        .eq("is_shared", true)
        .eq("is_validated", true)
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Fetch counts for personal traitements
      const personalWithCounts = await Promise.all(
        (personal || []).map(async (t) => {
          const [{ count: seancesCount }, { count: testsCount }] = await Promise.all([
            supabase.from("traitement_seances").select("*", { count: "exact", head: true }).eq("traitement_type_id", t.id),
            supabase.from("traitement_tests").select("*", { count: "exact", head: true }).eq("traitement_type_id", t.id),
          ]);
          return { ...t, seances_count: seancesCount || 0, tests_count: testsCount || 0 };
        })
      );

      // Fetch counts for platform traitements
      const platformWithCounts = await Promise.all(
        (platform || []).map(async (t) => {
          const [{ count: seancesCount }, { count: testsCount }] = await Promise.all([
            supabase.from("traitement_seances").select("*", { count: "exact", head: true }).eq("traitement_type_id", t.id),
            supabase.from("traitement_tests").select("*", { count: "exact", head: true }).eq("traitement_type_id", t.id),
          ]);
          return { ...t, seances_count: seancesCount || 0, tests_count: testsCount || 0 };
        })
      );

      setPersonalTraitements(personalWithCounts);
      setPlatformTraitements(platformWithCounts);
    } catch (error) {
      console.error("Error fetching traitements:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterTraitements = (traitements: Traitement[]) => {
    if (!searchTerm) return traitements;
    const term = searchTerm.toLowerCase();
    return traitements.filter(
      (t) =>
        t.pathologie.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.author_name?.toLowerCase().includes(term)
    );
  };

  const handleSelect = (traitementId: string) => {
    onSelect(traitementId);
    onOpenChange(false);
  };

  const handleCreate = () => {
    onCreate();
    onOpenChange(false);
  };

  const TraitementCard = ({ traitement }: { traitement: Traitement }) => (
    <div
      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => handleSelect(traitement.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {traitement.pathologie}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {traitement.seances_count} séances • {traitement.tests_count} tests
            </span>
          </div>
          {traitement.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {traitement.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            par {traitement.author_name || "Anonyme"}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Ajouter un traitement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new button */}
          <Button onClick={handleCreate} className="w-full" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Créer un nouveau traitement
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                ou choisir un existant
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un traitement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Mes traitements ({filterTraitements(personalTraitements).length})
              </TabsTrigger>
              <TabsTrigger value="platform" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Plateforme ({filterTraitements(platformTraitements).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="mt-4">
              <ScrollArea className="h-[300px]">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Chargement...
                  </p>
                ) : filterTraitements(personalTraitements).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun traitement personnel trouvé
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filterTraitements(personalTraitements).map((t) => (
                      <TraitementCard key={t.id} traitement={t} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="platform" className="mt-4">
              <ScrollArea className="h-[300px]">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Chargement...
                  </p>
                ) : filterTraitements(platformTraitements).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun traitement de la plateforme trouvé
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filterTraitements(platformTraitements).map((t) => (
                      <TraitementCard key={t.id} traitement={t} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
