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
import { pb } from "@/integrations/pocketbase/client";
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
      const [personal, platform] = await Promise.all([
        pb.collection("traitement_types").getFullList({
          filter: `user = "${user.id}" && is_hidden_from_list = false`,
          sort: "-created", fields: "id,pathologie,description,author_name,is_shared",
        }),
        pb.collection("traitement_types").getFullList({
          filter: `is_shared = true && is_validated = true && user != "${user.id}"`,
          sort: "-created", fields: "id,pathologie,description,author_name,is_shared",
        }),
      ]);

      // Fetch counts for personal traitements
      const personalWithCounts = await Promise.all(
        (personal || []).map(async (t) => {
          const [seancesRes, testsRes] = await Promise.all([
            pb.collection("traitement_seances").getList(1, 1, { filter: `traitement_type = "${t.id}"` }),
            pb.collection("traitement_tests").getList(1, 1, { filter: `traitement_type = "${t.id}"` }),
          ]);
          return { ...t, seances_count: seancesRes.totalItems, tests_count: testsRes.totalItems };
        })
      );

      // Fetch counts for platform traitements
      const platformWithCounts = await Promise.all(
        (platform || []).map(async (t) => {
          const [seancesRes, testsRes] = await Promise.all([
            pb.collection("traitement_seances").getList(1, 1, { filter: `traitement_type = "${t.id}"` }),
            pb.collection("traitement_tests").getList(1, 1, { filter: `traitement_type = "${t.id}"` }),
          ]);
          return { ...t, seances_count: seancesRes.totalItems, tests_count: testsRes.totalItems };
        })
      );

      setPersonalTraitements(personalWithCounts as unknown as Traitement[]);
      setPlatformTraitements(platformWithCounts as unknown as Traitement[]);
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
      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors active:bg-muted"
      onClick={() => handleSelect(traitement.id)}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs shrink-0">
            {traitement.pathologie}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {traitement.seances_count} séances • {traitement.tests_count} tests
          </span>
        </div>
        {traitement.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {traitement.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          par {traitement.author_name || "Anonyme"}
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
            Ajouter un traitement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {/* Create new button */}
          <Button onClick={handleCreate} className="w-full h-10 sm:h-11" variant="outline">
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
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-auto p-1">
              <TabsTrigger value="personal" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 px-2">
                <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Mes traitements</span>
                <span className="text-muted-foreground">({filterTraitements(personalTraitements).length})</span>
              </TabsTrigger>
              <TabsTrigger value="platform" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 px-2">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Plateforme</span>
                <span className="text-muted-foreground">({filterTraitements(platformTraitements).length})</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="mt-3">
              <ScrollArea className="h-[calc(50vh-200px)] min-h-[180px] max-h-[300px]">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Chargement...
                  </p>
                ) : filterTraitements(personalTraitements).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun traitement personnel trouvé
                  </p>
                ) : (
                  <div className="space-y-2 pr-2">
                    {filterTraitements(personalTraitements).map((t) => (
                      <TraitementCard key={t.id} traitement={t} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="platform" className="mt-3">
              <ScrollArea className="h-[calc(50vh-200px)] min-h-[180px] max-h-[300px]">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Chargement...
                  </p>
                ) : filterTraitements(platformTraitements).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun traitement de la plateforme trouvé
                  </p>
                ) : (
                  <div className="space-y-2 pr-2">
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
