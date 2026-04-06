import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, ExternalLink, Facebook, Instagram, Linkedin, Globe, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FRENCH_REGIONS } from "@/lib/french-regions";
import { useAuth } from "@/lib/auth";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DirectoryEntry {
  id: string;
  user_id: string;
  city: string | null;
  region: string | null;
  departement: string | null;
  google_maps_link: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  photo_url: string | null;
  photo_url_2: string | null;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    pseudo: string | null;
    specialty: string | null;
    avatar_url: string | null;
  };
}

export default function Annuaire() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["annuaire"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_directory");
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        city: d.city,
        region: d.region,
        departement: d.departement,
        google_maps_link: d.google_maps_link,
        facebook_url: d.facebook_url,
        instagram_url: d.instagram_url,
        linkedin_url: d.linkedin_url,
        website_url: d.website_url,
        photo_url: d.photo_url,
        photo_url_2: d.photo_url_2,
        profile: {
          first_name: d.first_name,
          last_name: d.last_name,
          pseudo: d.pseudo,
          specialty: d.specialty,
          avatar_url: d.avatar_url,
        },
      })) as DirectoryEntry[];
    },
  });

  const departements = regionFilter && regionFilter !== "all"
    ? (FRENCH_REGIONS.find(r => r.name === regionFilter)?.departements.map(d => d.name) || [])
    : [];

  const filtered = entries.filter((entry) => {
    const name = `${entry.profile?.first_name || ""} ${entry.profile?.last_name || ""} ${entry.profile?.pseudo || ""} ${entry.profile?.specialty || ""} ${entry.city || ""}`.toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase());
    const matchesRegion = regionFilter === "all" || entry.region === regionFilter;
    const matchesDept = deptFilter === "all" || entry.departement === deptFilter;
    return matchesSearch && matchesRegion && matchesDept;
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
            Annuaire des Kinésithérapeutes
          </h1>
          <p className="text-muted-foreground">
            Trouvez un kinésithérapeute près de chez vous
          </p>
          {user && (
            <Button asChild variant="outline" className="mt-3 gap-2">
              <Link to="/profile#annuaire">
                <Settings className="w-4 h-4" />
                Configurer ma fiche
              </Link>
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-8 max-w-3xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, spécialité, ville..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v); setDeptFilter("all"); }}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Région" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les régions</SelectItem>
              {FRENCH_REGIONS.map((r) => (
                <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {departements.length > 0 && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Département" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {departements.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Results */}
        {isLoading ? (
          <p className="text-center text-muted-foreground">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground">Aucun kinésithérapeute trouvé.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {filtered.map((entry) => (
              <Card key={entry.id} className="overflow-hidden hover:shadow-soft transition-shadow">
                <CardContent className="p-0">
                  {/* Photos */}
                  {(entry.photo_url || entry.profile?.avatar_url) && (
                    <div className="h-48 overflow-hidden bg-muted flex">
                      <img
                        src={entry.photo_url || entry.profile?.avatar_url || ""}
                        alt={`${entry.profile?.first_name || ""} ${entry.profile?.last_name || ""}`}
                        className={`object-cover ${entry.photo_url_2 ? "w-1/2" : "w-full"} h-full`}
                      />
                      {entry.photo_url_2 && (
                        <img
                          src={entry.photo_url_2}
                          alt="Photo 2"
                          className="w-1/2 h-full object-cover"
                        />
                      )}
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-display font-semibold text-lg">
                      {entry.profile?.first_name} {entry.profile?.last_name}
                    </h3>
                    {entry.profile?.pseudo && (
                      <p className="text-sm text-muted-foreground">@{entry.profile.pseudo}</p>
                    )}
                    {entry.profile?.specialty && (
                      <Badge variant="secondary" className="mt-1">{entry.profile.specialty}</Badge>
                    )}

                    {/* Location */}
                    {(entry.city || entry.departement) && (
                      <div className="flex items-center gap-1 mt-3 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>
                          {[entry.city, entry.departement, entry.region].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}

                    {/* Links */}
                    <div className="flex items-center gap-2 mt-3">
                      {entry.google_maps_link && (
                        <a href={entry.google_maps_link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Google Maps">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {entry.facebook_url && (
                        <a href={entry.facebook_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Facebook">
                          <Facebook className="w-4 h-4" />
                        </a>
                      )}
                      {entry.instagram_url && (
                        <a href={entry.instagram_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Instagram">
                          <Instagram className="w-4 h-4" />
                        </a>
                      )}
                      {entry.linkedin_url && (
                        <a href={entry.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="LinkedIn">
                          <Linkedin className="w-4 h-4" />
                        </a>
                      )}
                      {entry.website_url && (
                        <a href={entry.website_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Site web">
                          <Globe className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
