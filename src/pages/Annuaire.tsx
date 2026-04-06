import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

  // Group filtered entries by user_id
  const grouped = useMemo(() => {
    const map = new Map<string, DirectoryEntry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.user_id) || [];
      list.push(entry);
      map.set(entry.user_id, list);
    }
    return Array.from(map.values());
  }, [filtered]);

  // Collect unique social links from all entries of a user
  const collectLinks = (entries: DirectoryEntry[]) => {
    const links: { type: string; url: string; icon: React.ReactNode; title: string }[] = [];
    const seen = new Set<string>();
    for (const e of entries) {
      if (e.facebook_url && !seen.has(e.facebook_url)) { seen.add(e.facebook_url); links.push({ type: "fb", url: e.facebook_url, icon: <Facebook className="w-4 h-4" />, title: "Facebook" }); }
      if (e.instagram_url && !seen.has(e.instagram_url)) { seen.add(e.instagram_url); links.push({ type: "ig", url: e.instagram_url, icon: <Instagram className="w-4 h-4" />, title: "Instagram" }); }
      if (e.linkedin_url && !seen.has(e.linkedin_url)) { seen.add(e.linkedin_url); links.push({ type: "li", url: e.linkedin_url, icon: <Linkedin className="w-4 h-4" />, title: "LinkedIn" }); }
      if (e.website_url && !seen.has(e.website_url)) { seen.add(e.website_url); links.push({ type: "web", url: e.website_url, icon: <Globe className="w-4 h-4" />, title: "Site web" }); }
    }
    return links;
  };

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
        ) : grouped.length === 0 ? (
          <p className="text-center text-muted-foreground">Aucun kinésithérapeute trouvé.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {grouped.map((userEntries) => {
              const first = userEntries[0];
              const profile = first.profile;
              const allLinks = collectLinks(userEntries);
              const hasMultiple = userEntries.length > 1;

              // Collect all unique photos
              const photos: string[] = [];
              for (const e of userEntries) {
                if (e.photo_url && !photos.includes(e.photo_url)) photos.push(e.photo_url);
                if (e.photo_url_2 && !photos.includes(e.photo_url_2)) photos.push(e.photo_url_2);
              }
              if (photos.length === 0 && profile?.avatar_url) photos.push(profile.avatar_url);

              return (
                <Card key={first.user_id} className="overflow-hidden hover:shadow-soft transition-shadow">
                  <CardContent className="p-0">
                    {/* Photos */}
                    {photos.length > 0 && (
                      <div className="h-48 overflow-hidden bg-muted flex">
                        {photos.slice(0, 2).map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`${profile?.first_name || ""} ${profile?.last_name || ""}`}
                            className={`object-cover h-full ${photos.length > 1 ? "w-1/2" : "w-full"}`}
                          />
                        ))}
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-display font-semibold text-lg">
                        {profile?.first_name} {profile?.last_name}
                      </h3>
                      {profile?.pseudo && (
                        <p className="text-sm text-muted-foreground">@{profile.pseudo}</p>
                      )}
                      {profile?.specialty && (
                        <Badge variant="secondary" className="mt-1">{profile.specialty}</Badge>
                      )}

                      {/* Locations - tabs if multiple */}
                      {hasMultiple ? (
                        <Tabs defaultValue="0" className="mt-3">
                          <TabsList className="h-auto flex-wrap">
                            {userEntries.map((e, i) => (
                              <TabsTrigger key={e.id} value={String(i)} className="text-xs px-2 py-1">
                                <MapPin className="w-3 h-3 mr-1" />
                                {e.city || `Cabinet ${i + 1}`}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                          {userEntries.map((e, i) => (
                            <TabsContent key={e.id} value={String(i)} className="mt-2">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span>{[e.city, e.departement, e.region].filter(Boolean).join(", ")}</span>
                              </div>
                              {e.google_maps_link && (
                                <a href={e.google_maps_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1">
                                  <ExternalLink className="w-3 h-3" /> Voir sur Google Maps
                                </a>
                              )}
                            </TabsContent>
                          ))}
                        </Tabs>
                      ) : (
                        <>
                          {(first.city || first.departement) && (
                            <div className="flex items-center gap-1 mt-3 text-sm text-muted-foreground">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{[first.city, first.departement, first.region].filter(Boolean).join(", ")}</span>
                            </div>
                          )}
                          {first.google_maps_link && (
                            <a href={first.google_maps_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1">
                              <ExternalLink className="w-3 h-3" /> Voir sur Google Maps
                            </a>
                          )}
                        </>
                      )}

                      {/* Social Links */}
                      {allLinks.length > 0 && (
                        <div className="flex items-center gap-2 mt-3">
                          {allLinks.map((link, i) => (
                            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title={link.title}>
                              {link.icon}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
