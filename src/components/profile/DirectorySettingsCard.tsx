import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FRENCH_REGIONS } from "@/lib/french-regions";

interface DirectorySettingsCardProps {
  userId: string;
}

interface DirectoryData {
  is_visible: boolean;
  city: string;
  region: string;
  departement: string;
  google_maps_link: string;
  facebook_url: string;
  instagram_url: string;
  linkedin_url: string;
  website_url: string;
  photo_url: string;
  photo_url_2: string;
}

const emptyData: DirectoryData = {
  is_visible: false,
  city: "",
  region: "",
  departement: "",
  google_maps_link: "",
  facebook_url: "",
  instagram_url: "",
  linkedin_url: "",
  website_url: "",
  photo_url: "",
  photo_url_2: "",
};

export function DirectorySettingsCard({ userId }: DirectorySettingsCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<DirectoryData>(emptyData);
  const [exists, setExists] = useState(false);

  const departements = data.region
    ? FRENCH_REGIONS.find((r) => r.name === data.region)?.departements.map((d) => d.name) || []
    : [];

  useEffect(() => {
    fetchDirectory();
  }, [userId]);

  const fetchDirectory = async () => {
    try {
      const { data: entry, error } = await supabase
        .from("practitioner_directory")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching directory:", error);
        return;
      }

      if (entry) {
        setExists(true);
        setData({
          is_visible: entry.is_visible,
          city: entry.city || "",
          region: entry.region || "",
          departement: entry.departement || "",
          google_maps_link: entry.google_maps_link || "",
          facebook_url: entry.facebook_url || "",
          instagram_url: entry.instagram_url || "",
          linkedin_url: entry.linkedin_url || "",
          website_url: entry.website_url || "",
          photo_url: entry.photo_url || "",
          photo_url_2: entry.photo_url_2 || "",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        user_id: userId,
        is_visible: data.is_visible,
        city: data.city || null,
        region: data.region || null,
        departement: data.departement || null,
        google_maps_link: data.google_maps_link || null,
        facebook_url: data.facebook_url || null,
        instagram_url: data.instagram_url || null,
        linkedin_url: data.linkedin_url || null,
        website_url: data.website_url || null,
        photo_url: data.photo_url || null,
        photo_url_2: data.photo_url_2 || null,
      };

      let error;
      if (exists) {
        ({ error } = await supabase
          .from("practitioner_directory")
          .update(payload)
          .eq("user_id", userId));
      } else {
        ({ error } = await supabase
          .from("practitioner_directory")
          .insert(payload));
        if (!error) setExists(true);
      }

      if (error) {
        toast({ title: "Erreur", description: "Impossible de sauvegarder la fiche", variant: "destructive" });
      } else {
        toast({ title: "Fiche annuaire enregistrée", description: data.is_visible ? "Votre fiche est visible dans l'annuaire" : "Votre fiche est masquée" });
      }
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof DirectoryData, value: string | boolean) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="annuaire">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Ma fiche annuaire
        </CardTitle>
        <CardDescription>
          Configurez votre visibilité dans l'annuaire public des kinésithérapeutes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          {/* Visibility toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Visible dans l'annuaire</Label>
              <p className="text-sm text-muted-foreground">
                Activez pour apparaître dans l'annuaire public
              </p>
            </div>
            <Switch
              checked={data.is_visible}
              onCheckedChange={(v) => update("is_visible", v)}
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Région</Label>
              <Select value={data.region} onValueChange={(v) => { update("region", v); update("departement", ""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une région" />
                </SelectTrigger>
                <SelectContent>
                  {FRENCH_REGIONS.map((r) => (
                    <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {departements.length > 0 && (
              <div className="space-y-2">
                <Label>Département</Label>
                <Select value={data.departement} onValueChange={(v) => update("departement", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un département" />
                  </SelectTrigger>
                  <SelectContent>
                    {departements.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Ville</Label>
            <Input value={data.city} onChange={(e) => update("city", e.target.value)} placeholder="Paris, Lyon..." />
          </div>

          <div className="space-y-2">
            <Label>Lien Google Maps</Label>
            <Input value={data.google_maps_link} onChange={(e) => update("google_maps_link", e.target.value)} placeholder="https://maps.google.com/..." />
          </div>

          {/* Social links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Facebook</Label>
              <Input value={data.facebook_url} onChange={(e) => update("facebook_url", e.target.value)} placeholder="https://facebook.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input value={data.instagram_url} onChange={(e) => update("instagram_url", e.target.value)} placeholder="https://instagram.com/..." />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn</Label>
              <Input value={data.linkedin_url} onChange={(e) => update("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="space-y-2">
              <Label>Site web</Label>
              <Input value={data.website_url} onChange={(e) => update("website_url", e.target.value)} placeholder="https://monsite.fr" />
            </div>
          </div>

          {/* Photos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL photo 1</Label>
              <Input value={data.photo_url} onChange={(e) => update("photo_url", e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>URL photo 2 (optionnel)</Label>
              <Input value={data.photo_url_2} onChange={(e) => update("photo_url_2", e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <Button type="submit" disabled={saving} className="gradient-primary text-primary-foreground">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Enregistrer la fiche
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
