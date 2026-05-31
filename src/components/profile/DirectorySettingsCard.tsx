import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MapPin, Save, Plus, Trash2 } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";
import { FRENCH_REGIONS } from "@/lib/french-regions";

interface DirectorySettingsCardProps {
  userId: string;
}

interface DirectoryEntry {
  id: string | null;
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
  phone: string;
  email: string;
  doctolib_url: string;
}

const emptyEntry = (): DirectoryEntry => ({
  id: null,
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
  phone: "",
  email: "",
  doctolib_url: "",
});

function DirectoryEntryForm({
  entry,
  onChange,
  onSave,
  onDelete,
  saving,
}: {
  entry: DirectoryEntry;
  onChange: (field: keyof DirectoryEntry, value: string | boolean) => void;
  onSave: (e: React.FormEvent) => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const departements = entry.region
    ? FRENCH_REGIONS.find((r) => r.name === entry.region)?.departements.map((d) => d.name) || []
    : [];

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">Visible dans l'annuaire</Label>
          <p className="text-sm text-muted-foreground">Activez pour apparaître dans l'annuaire public</p>
        </div>
        <Switch checked={entry.is_visible} onCheckedChange={(v) => onChange("is_visible", v)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Région</Label>
          <Select value={entry.region} onValueChange={(v) => { onChange("region", v); onChange("departement", ""); }}>
            <SelectTrigger><SelectValue placeholder="Sélectionner une région" /></SelectTrigger>
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
            <Select value={entry.departement} onValueChange={(v) => onChange("departement", v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un département" /></SelectTrigger>
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
        <Input value={entry.city} onChange={(e) => onChange("city", e.target.value)} placeholder="Paris, Lyon..." />
      </div>

      <div className="space-y-2">
        <Label>Lien Google Maps</Label>
        <Input value={entry.google_maps_link} onChange={(e) => onChange("google_maps_link", e.target.value)} placeholder="https://maps.google.com/..." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Facebook</Label>
          <Input value={entry.facebook_url} onChange={(e) => onChange("facebook_url", e.target.value)} placeholder="https://facebook.com/..." />
        </div>
        <div className="space-y-2">
          <Label>Instagram</Label>
          <Input value={entry.instagram_url} onChange={(e) => onChange("instagram_url", e.target.value)} placeholder="https://instagram.com/..." />
        </div>
        <div className="space-y-2">
          <Label>LinkedIn</Label>
          <Input value={entry.linkedin_url} onChange={(e) => onChange("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/..." />
        </div>
        <div className="space-y-2">
          <Label>Site web</Label>
          <Input value={entry.website_url} onChange={(e) => onChange("website_url", e.target.value)} placeholder="https://monsite.fr" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Téléphone</Label>
          <Input value={entry.phone} onChange={(e) => onChange("phone", e.target.value)} placeholder="06 12 34 56 78" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={entry.email} onChange={(e) => onChange("email", e.target.value)} placeholder="contact@exemple.fr" type="email" />
        </div>
        <div className="space-y-2">
          <Label>Lien Doctolib</Label>
          <Input value={entry.doctolib_url} onChange={(e) => onChange("doctolib_url", e.target.value)} placeholder="https://www.doctolib.fr/..." />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>URL photo 1</Label>
          <Input value={entry.photo_url} onChange={(e) => onChange("photo_url", e.target.value)} placeholder="https://..." />
        </div>
        <div className="space-y-2">
          <Label>URL photo 2 (optionnel)</Label>
          <Input value={entry.photo_url_2} onChange={(e) => onChange("photo_url_2", e.target.value)} placeholder="https://..." />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving} className="gradient-primary text-primary-foreground">
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Enregistrer la fiche</>
          )}
        </Button>
        {onDelete && (
          <Button type="button" variant="destructive" size="sm" onClick={onDelete} disabled={saving}>
            <Trash2 className="w-4 h-4 mr-1" />Supprimer
          </Button>
        )}
      </div>
    </form>
  );
}

export function DirectorySettingsCard({ userId }: DirectorySettingsCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState("0");

  useEffect(() => {
    fetchEntries();
  }, [userId]);

  const fetchEntries = async () => {
    try {
      let data: any[] = [];
      try { data = await pb.collection("practitioner_directory").getFullList({ filter: `user = "${userId}"`, sort: "created" }); } catch (error) {
        console.error("Error fetching directory:", error);
        return;
      }

      if (data && data.length > 0) {
        setEntries(data.map((e) => ({
          id: e.id,
          is_visible: e.is_visible,
          city: e.city || "",
          region: e.region || "",
          departement: e.departement || "",
          google_maps_link: e.google_maps_link || "",
          facebook_url: e.facebook_url || "",
          instagram_url: e.instagram_url || "",
          linkedin_url: e.linkedin_url || "",
          website_url: e.website_url || "",
          photo_url: e.photo_url || "",
          photo_url_2: e.photo_url_2 || "",
          phone: (e as any).phone || "",
          email: (e as any).email || "",
          doctolib_url: (e as any).doctolib_url || "",
        })));
      } else {
        setEntries([emptyEntry()]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (index: number, field: keyof DirectoryEntry, value: string | boolean) => {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const handleSave = async (index: number, e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const entry = entries[index];

    try {
      const payload = {
        user_id: userId,
        is_visible: entry.is_visible,
        city: entry.city || null,
        region: entry.region || null,
        departement: entry.departement || null,
        google_maps_link: entry.google_maps_link || null,
        facebook_url: entry.facebook_url || null,
        instagram_url: entry.instagram_url || null,
        linkedin_url: entry.linkedin_url || null,
        website_url: entry.website_url || null,
        photo_url: entry.photo_url || null,
        photo_url_2: entry.photo_url_2 || null,
        phone: entry.phone || null,
        email: entry.email || null,
        doctolib_url: entry.doctolib_url || null,
      };

      let error;
      if (entry.id) {
        try { await pb.collection("practitioner_directory").update(entry.id, payload); } catch(e: any) { error = e; }
      } else {
        try {
          const inserted = await pb.collection("practitioner_directory").create(payload);
          setEntries((prev) => prev.map((e, i) => i === index ? { ...e, id: inserted.id } : e));
        } catch(e: any) { error = e; }
      }

      if (error) {
        toast({ title: "Erreur", description: "Impossible de sauvegarder la fiche", variant: "destructive" });
      } else {
        toast({ title: "Fiche enregistrée", description: entry.is_visible ? "Votre fiche est visible dans l'annuaire" : "Votre fiche est masquée" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddEntry = () => {
    setEntries((prev) => [...prev, emptyEntry()]);
    setActiveTab(String(entries.length));
  };

  const handleDelete = async (index: number) => {
    const entry = entries[index];
    if (entry.id) {
      setSaving(true);
      try { await pb.collection("practitioner_directory").delete(entry.id); } catch(e: any) {
        setSaving(false);
        toast({ title: "Erreur", description: "Impossible de supprimer la fiche", variant: "destructive" });
        return;
      }
      setSaving(false);
    }
    const newEntries = entries.filter((_, i) => i !== index);
    if (newEntries.length === 0) newEntries.push(emptyEntry());
    setEntries(newEntries);
    setActiveTab("0");
    toast({ title: "Fiche supprimée" });
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Mes fiches annuaire
            </CardTitle>
            <CardDescription>
              Configurez vos fiches dans l'annuaire public (ex : plusieurs cabinets)
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddEntry} className="gap-1">
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 1 ? (
          <DirectoryEntryForm
            entry={entries[0]}
            onChange={(f, v) => handleChange(0, f, v)}
            onSave={(e) => handleSave(0, e)}
            onDelete={entries[0].id ? () => handleDelete(0) : undefined}
            saving={saving}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              {entries.map((entry, i) => (
                <TabsTrigger key={i} value={String(i)}>
                  {entry.city || `Fiche ${i + 1}`}
                </TabsTrigger>
              ))}
            </TabsList>
            {entries.map((entry, i) => (
              <TabsContent key={i} value={String(i)}>
                <DirectoryEntryForm
                  entry={entry}
                  onChange={(f, v) => handleChange(i, f, v)}
                  onSave={(e) => handleSave(i, e)}
                  onDelete={() => handleDelete(i)}
                  saving={saving}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
