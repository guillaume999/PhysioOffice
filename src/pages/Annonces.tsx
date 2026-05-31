import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { FRENCH_REGIONS, ANNONCE_TYPES, AnnonceType } from "@/lib/french-regions";
import { 
  Search, 
  Plus, 
  MapPin, 
  Calendar, 
  Clock, 
  Sparkles, 
  User,
  Briefcase,
  Building,
  RefreshCw,
  Filter,
  X,
  Mail,
  Phone,
} from "lucide-react";
import { PagePopup } from "@/components/popup/PagePopup";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";

interface Annonce {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: AnnonceType;
  region: string;
  departement: string | null;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  expires_at: string;
  contact_email: string | null;
  contact_phone: string | null;
}

interface AnnonceSettings {
  free_duration_days: number;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  remplacement_recherche: <RefreshCw className="w-4 h-4" />,
  remplacement_offre: <RefreshCw className="w-4 h-4" />,
  emploi_offre: <Briefcase className="w-4 h-4" />,
  emploi_recherche: <User className="w-4 h-4" />,
  association: <Building className="w-4 h-4" />,
  vente_cabinet: <Building className="w-4 h-4" />,
  autre: <Briefcase className="w-4 h-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  remplacement_recherche: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  remplacement_offre: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  emploi_offre: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  emploi_recherche: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  association: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  vente_cabinet: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  autre: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function Annonces() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [myAnnonces, setMyAnnonces] = useState<Annonce[]>([]);
  const [settings, setSettings] = useState<AnnonceSettings>({ free_duration_days: 30 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAnnonce, setSelectedAnnonce] = useState<Annonce | null>(null);
  const [showMyAnnonces, setShowMyAnnonces] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<AnnonceType>("remplacement_recherche");
  const [formRegion, setFormRegion] = useState("");
  const [formDepartement, setFormDepartement] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const settingsRes = await pb.collection("annonce_settings").getList(1, 1, { fields: "free_duration_days" });
      if (settingsRes.items[0]) setSettings(settingsRes.items[0] as any);

      // Fetch all active annonces
      const annoncesData = await pb.collection("annonces").getFullList({
        filter: `is_active = true && expires_at > "${new Date().toISOString()}"`,
        sort: "-is_featured,-created",
      });
      setAnnonces(annoncesData as unknown as Annonce[]);

      // Fetch my annonces if logged in
      if (user) {
        const myData = await pb.collection("annonces").getFullList({ filter: `user = "${user.id}"`, sort: "-created" });
        setMyAnnonces(myData as unknown as Annonce[]);
      }
    } catch (error) {
      console.error("Error fetching annonces:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les annonces.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormType("remplacement_recherche");
    setFormRegion("");
    setFormDepartement("");
    setFormContactEmail(user?.email || "");
    setFormContactPhone("");
  };

  const handleCreateAnnonce = async () => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Vous devez être connecté pour publier une annonce.",
        variant: "destructive",
      });
      return;
    }

    if (!formTitle.trim() || !formDescription.trim() || !formRegion) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const expiresAt = addDays(new Date(), settings.free_duration_days);

      await pb.collection("annonces").create({
        user: user.id,
        title: formTitle.trim(),
        description: formDescription.trim(),
        type: formType,
        region: formRegion,
        departement: formDepartement || null,
        expires_at: expiresAt.toISOString(),
        contact_email: formContactEmail.trim() || null,
        contact_phone: formContactPhone.trim() || null,
      });

      toast({
        title: "Annonce publiée",
        description: `Votre annonce sera visible pendant ${settings.free_duration_days} jours.`,
      });

      resetForm();
      setCreateDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error creating annonce:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer l'annonce.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnonce = async (id: string) => {
    try {
      await pb.collection("annonces").delete(id);

      toast({ title: "Annonce supprimée" });
      fetchData();
    } catch (error) {
      console.error("Error deleting annonce:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'annonce.",
        variant: "destructive",
      });
    }
  };

  const filteredAnnonces = (showMyAnnonces ? myAnnonces : annonces).filter((annonce) => {
    const matchesSearch =
      annonce.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      annonce.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || annonce.type === filterType;
    const matchesRegion = filterRegion === "all" || annonce.region === filterRegion;
    return matchesSearch && matchesType && matchesRegion;
  });

  const selectedRegion = FRENCH_REGIONS.find((r) => r.name === formRegion);

  const getTypeLabel = (type: string) => {
    return ANNONCE_TYPES.find((t) => t.value === type)?.label || type;
  };

  return (
    <Layout>
      <PagePopup pageKey="annonces" />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Annonces</h1>
            <p className="text-muted-foreground mt-1">
              Trouvez ou publiez des annonces de remplacement, emploi et plus
            </p>
          </div>
          {user && (
            <div className="flex gap-2">
              <Button
                variant={showMyAnnonces ? "default" : "outline"}
                onClick={() => setShowMyAnnonces(!showMyAnnonces)}
              >
                {showMyAnnonces ? "Toutes les annonces" : "Mes annonces"}
              </Button>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary text-primary-foreground" onClick={resetForm}>
                    <Plus className="w-4 h-4 mr-2" />
                    Publier une annonce
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Nouvelle annonce</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Type d'annonce *</Label>
                      <Select value={formType} onValueChange={(v) => setFormType(v as AnnonceType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ANNONCE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="title">Titre *</Label>
                      <Input
                        id="title"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Ex: Recherche remplaçant pour congé maternité"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Décrivez votre annonce en détail..."
                        rows={5}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="region">Région *</Label>
                        <Select value={formRegion} onValueChange={(v) => { setFormRegion(v); setFormDepartement(""); }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            {FRENCH_REGIONS.map((region) => (
                              <SelectItem key={region.name} value={region.name}>
                                {region.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="departement">Département</Label>
                        <Select
                          value={formDepartement}
                          onValueChange={setFormDepartement}
                          disabled={!selectedRegion}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Optionnel" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedRegion?.departements.map((dept) => (
                              <SelectItem key={dept.code} value={dept.name}>
                                {dept.code} - {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email de contact</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formContactEmail}
                        onChange={(e) => setFormContactEmail(e.target.value)}
                        placeholder="votre@email.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Téléphone de contact</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formContactPhone}
                        onChange={(e) => setFormContactPhone(e.target.value)}
                        placeholder="06 XX XX XX XX"
                      />
                    </div>

                    <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
                      Votre annonce sera visible pendant <strong>{settings.free_duration_days} jours</strong> gratuitement.
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleCreateAnnonce}
                      disabled={submitting}
                    >
                      {submitting ? "Publication..." : "Publier l'annonce"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher une annonce..."
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="md:w-auto"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtres
                {(filterType !== "all" || filterRegion !== "all") && (
                  <Badge variant="secondary" className="ml-2">
                    {[filterType !== "all", filterRegion !== "all"].filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Type d'annonce</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      {ANNONCE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Région</Label>
                  <Select value={filterRegion} onValueChange={setFilterRegion}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les régions</SelectItem>
                      {FRENCH_REGIONS.map((region) => (
                        <SelectItem key={region.name} value={region.name}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setFilterType("all");
                      setFilterRegion("all");
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Réinitialiser
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Annonces List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Chargement...</div>
        ) : filteredAnnonces.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Aucune annonce trouvée</h3>
              <p className="text-muted-foreground">
                {showMyAnnonces
                  ? "Vous n'avez pas encore publié d'annonce."
                  : "Aucune annonce ne correspond à vos critères."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredAnnonces.map((annonce) => (
              <Card
                key={annonce.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  annonce.is_featured ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => {
                  setSelectedAnnonce(annonce);
                  setDetailDialogOpen(true);
                }}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start gap-3">
                        {annonce.is_featured && (
                          <Badge className="bg-primary/10 text-primary shrink-0">
                            <Sparkles className="w-3 h-3 mr-1" />
                            En avant
                          </Badge>
                        )}
                        <Badge className={TYPE_COLORS[annonce.type]}>
                          {TYPE_ICONS[annonce.type]}
                          <span className="ml-1">{getTypeLabel(annonce.type)}</span>
                        </Badge>
                      </div>

                      <h3 className="text-lg font-semibold text-foreground">{annonce.title}</h3>

                      <p className="text-muted-foreground line-clamp-2">{annonce.description}</p>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {annonce.departement ? `${annonce.departement}, ` : ""}
                          {annonce.region}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(annonce.created_at), "d MMM yyyy", { locale: fr })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Expire le {format(new Date(annonce.expires_at), "d MMM yyyy", { locale: fr })}
                        </span>
                      </div>
                    </div>

                    {showMyAnnonces && annonce.user_id === user?.id && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAnnonce(annonce.id);
                        }}
                      >
                        Supprimer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-lg">
            {selectedAnnonce && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={TYPE_COLORS[selectedAnnonce.type]}>
                      {TYPE_ICONS[selectedAnnonce.type]}
                      <span className="ml-1">{getTypeLabel(selectedAnnonce.type)}</span>
                    </Badge>
                    {selectedAnnonce.is_featured && (
                      <Badge className="bg-primary/10 text-primary">
                        <Sparkles className="w-3 h-3 mr-1" />
                        En avant
                      </Badge>
                    )}
                  </div>
                  <DialogTitle>{selectedAnnonce.title}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {selectedAnnonce.departement ? `${selectedAnnonce.departement}, ` : ""}
                      {selectedAnnonce.region}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Publié le {format(new Date(selectedAnnonce.created_at), "d MMM yyyy", { locale: fr })}
                    </span>
                  </div>

                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-foreground">{selectedAnnonce.description}</p>
                  </div>

                  {(selectedAnnonce.contact_email || selectedAnnonce.contact_phone) && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Contact</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedAnnonce.contact_email && (
                          <a
                            href={`mailto:${selectedAnnonce.contact_email}`}
                            className="flex items-center gap-2 text-primary hover:underline"
                          >
                            <Mail className="w-4 h-4" />
                            {selectedAnnonce.contact_email}
                          </a>
                        )}
                        {selectedAnnonce.contact_phone && (
                          <a
                            href={`tel:${selectedAnnonce.contact_phone}`}
                            className="flex items-center gap-2 text-primary hover:underline"
                          >
                            <Phone className="w-4 h-4" />
                            {selectedAnnonce.contact_phone}
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Cette annonce expire le {format(new Date(selectedAnnonce.expires_at), "d MMMM yyyy", { locale: fr })}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Call to action for non-logged users */}
        {!user && (
          <Card className="mt-8">
            <CardContent className="py-8 text-center">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Vous souhaitez publier une annonce ?
              </h3>
              <p className="text-muted-foreground mb-4">
                Connectez-vous pour publier gratuitement votre annonce pendant {settings.free_duration_days} jours.
              </p>
              <Button asChild>
                <a href="/auth">Se connecter</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
