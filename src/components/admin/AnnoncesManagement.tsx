import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";
import { ANNONCE_TYPES, AnnonceType } from "@/lib/french-regions";
import { 
  Search, 
  Trash2, 
  Sparkles, 
  Settings, 
  Save,
  MapPin,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
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
  id: string;
  free_duration_days: number;
  featured_price_cents: number;
  extension_price_cents: number;
  extension_duration_days: number;
}

export function AnnoncesManagement() {
  const { toast } = useToast();
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [settings, setSettings] = useState<AnnonceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Settings form
  const [formFreeDays, setFormFreeDays] = useState(30);
  const [formFeaturedPrice, setFormFeaturedPrice] = useState(500);
  const [formExtensionPrice, setFormExtensionPrice] = useState(300);
  const [formExtensionDays, setFormExtensionDays] = useState(30);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all annonces
      setAnnonces(await pb.collection("annonces").getFullList({ sort: "-created_at" }) as unknown as Annonce[]);

      const settingsRes = await pb.collection("annonce_settings").getList(1, 1, {});
      const settingsData = settingsRes.items[0] ?? null;
      if (settingsData) {
        const typedSettings = settingsData as unknown as AnnonceSettings;
        setSettings(typedSettings);
        setFormFreeDays(typedSettings.free_duration_days);
        setFormFeaturedPrice(typedSettings.featured_price_cents);
        setFormExtensionPrice(typedSettings.extension_price_cents);
        setFormExtensionDays(typedSettings.extension_duration_days);
      }
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

  const handleSaveSettings = async () => {
    if (!settings) return;

    setSavingSettings(true);
    try {
      await pb.collection("annonce_settings").update(settings.id, { free_duration_days: formFreeDays, featured_price_cents: formFeaturedPrice, extension_price_cents: formExtensionPrice, extension_duration_days: formExtensionDays });

      toast({
        title: "Paramètres sauvegardés",
        description: "Les paramètres des annonces ont été mis à jour.",
      });

      fetchData();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les paramètres.",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleFeatured = async (annonce: Annonce) => {
    try {
      await pb.collection("annonces").update(annonce.id, { is_featured: !annonce.is_featured });

      toast({
        title: annonce.is_featured ? "Mise en avant retirée" : "Annonce mise en avant",
      });

      fetchData();
    } catch (error) {
      console.error("Error toggling featured:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'annonce.",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (annonce: Annonce) => {
    try {
      await pb.collection("annonces").update(annonce.id, { is_active: !annonce.is_active });

      toast({
        title: annonce.is_active ? "Annonce désactivée" : "Annonce activée",
      });

      fetchData();
    } catch (error) {
      console.error("Error toggling active:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'annonce.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
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

  const getTypeLabel = (type: string) => {
    return ANNONCE_TYPES.find((t) => t.value === type)?.label || type;
  };

  const filteredAnnonces = annonces.filter(
    (a) =>
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.region.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Paramètres des annonces
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="freeDays">Durée gratuite (jours)</Label>
              <Input
                id="freeDays"
                type="number"
                min={1}
                value={formFreeDays}
                onChange={(e) => setFormFreeDays(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="featuredPrice">Prix mise en avant (centimes)</Label>
              <Input
                id="featuredPrice"
                type="number"
                min={0}
                value={formFeaturedPrice}
                onChange={(e) => setFormFeaturedPrice(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                {(formFeaturedPrice / 100).toFixed(2)} €
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extensionPrice">Prix prolongation (centimes)</Label>
              <Input
                id="extensionPrice"
                type="number"
                min={0}
                value={formExtensionPrice}
                onChange={(e) => setFormExtensionPrice(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                {(formExtensionPrice / 100).toFixed(2)} €
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extensionDays">Durée prolongation (jours)</Label>
              <Input
                id="extensionDays"
                type="number"
                min={1}
                value={formExtensionDays}
                onChange={(e) => setFormExtensionDays(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={handleSaveSettings}
            disabled={savingSettings}
          >
            <Save className="w-4 h-4 mr-2" />
            {savingSettings ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </CardContent>
      </Card>

      {/* Annonces List */}
      <Card>
        <CardHeader>
          <CardTitle>Annonces ({annonces.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher..."
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Chargement...</p>
          ) : filteredAnnonces.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Aucune annonce trouvée.</p>
          ) : (
            <div className="space-y-4">
              {filteredAnnonces.map((annonce) => (
                <div
                  key={annonce.id}
                  className={`p-4 border rounded-lg ${
                    !annonce.is_active || isExpired(annonce.expires_at)
                      ? "opacity-60 bg-muted/50"
                      : ""
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{getTypeLabel(annonce.type)}</Badge>
                        {annonce.is_featured && (
                          <Badge className="bg-primary/10 text-primary">
                            <Sparkles className="w-3 h-3 mr-1" />
                            En avant
                          </Badge>
                        )}
                        {!annonce.is_active && (
                          <Badge variant="destructive">Désactivée</Badge>
                        )}
                        {isExpired(annonce.expires_at) && (
                          <Badge variant="secondary">Expirée</Badge>
                        )}
                      </div>
                      <h3 className="font-medium">{annonce.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {annonce.region}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Expire: {format(new Date(annonce.expires_at), "dd/MM/yyyy", { locale: fr })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`featured-${annonce.id}`} className="text-sm">
                          En avant
                        </Label>
                        <Switch
                          id={`featured-${annonce.id}`}
                          checked={annonce.is_featured}
                          onCheckedChange={() => handleToggleFeatured(annonce)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`active-${annonce.id}`} className="text-sm">
                          Active
                        </Label>
                        <Switch
                          id={`active-${annonce.id}`}
                          checked={annonce.is_active}
                          onCheckedChange={() => handleToggleActive(annonce)}
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(annonce.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
