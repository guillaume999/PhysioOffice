import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Video, Search, Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface ExerciceWithVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  author_name: string | null;
}

export default function Videos() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<ExerciceWithVideo[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<ExerciceWithVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [videoToPlay, setVideoToPlay] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredVideos(videos);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredVideos(
        videos.filter(
          (v) =>
            v.title.toLowerCase().includes(query) ||
            v.description?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, videos]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("exercices")
        .select("id, title, description, video_url, thumbnail_url, author_name")
        .eq("user_id", user?.id)
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVideos((data || []) as ExerciceWithVideo[]);
    } catch (error) {
      console.error("Erreur lors du chargement des vidéos:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">
            Veuillez vous connecter pour accéder à vos vidéos.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10">
                  <Video className="w-6 h-6 text-purple-500" />
                </div>
                <CardTitle className="text-2xl font-display">
                  Ma Vidéothèque
                </CardTitle>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une vidéo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-video bg-muted rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="text-center py-12">
                <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Aucune vidéo ne correspond à votre recherche"
                    : "Aucune vidéo dans votre bibliothèque"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Ajoutez des vidéos à vos exercices pour les retrouver ici
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredVideos.map((video) => (
                  <div
                    key={video.id}
                    className="group relative aspect-video rounded-xl overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                    onClick={() => setVideoToPlay(video.video_url)}
                  >
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={video.video_url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    )}

                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-7 h-7 text-white fill-white" />
                      </div>
                    </div>

                    {/* Title overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="text-white font-medium text-sm truncate">
                        {video.title}
                      </p>
                      {video.author_name && (
                        <p className="text-white/70 text-xs truncate">
                          Par {video.author_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Video Player Dialog */}
        <Dialog open={!!videoToPlay} onOpenChange={(open) => !open && setVideoToPlay(null)}>
          <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-black border-none">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
              onClick={() => setVideoToPlay(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            {videoToPlay && (
              <video
                src={videoToPlay}
                controls
                autoPlay
                className="w-full h-auto max-h-[80vh]"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
