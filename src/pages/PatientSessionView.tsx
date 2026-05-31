import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Calendar, FileText, Clock, AlertCircle, CheckCircle, Play, X, ChevronDown, ChevronUp, Repeat, Timer } from "lucide-react";

interface SeanceType {
  id: string;
  pathologie: string;
  objectif_principal: string;
  pathologies?: string[];
  objectifs_principaux?: string[];
  objectifs_secondaires?: string[];
}

interface SeanceExercice {
  id: string;
  name: string | null;
  description: string | null;
  duration_seconds: number | null;
  repetitions: number | null;
  series: number | null;
  ordre: number;
  exercice_id: string | null;
  exercices?: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    video_url: string | null;
  } | null;
}

interface AccessData {
  id: string;
  seance_type_id: string;
  patient_id: string;
  expires_at: string;
  seance?: SeanceType;
  patient?: {
    name: string;
  };
}

export default function PatientSessionView() {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  const [accessCode, setAccessCode] = useState(codeFromUrl || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessData, setAccessData] = useState<AccessData | null>(null);
  const [seanceExercices, setSeanceExercices] = useState<SeanceExercice[]>([]);
  const [completedExercices, setCompletedExercices] = useState<Set<string>>(new Set());
  const [expandedExercice, setExpandedExercice] = useState<string | null>(null);
  const [videoToPlay, setVideoToPlay] = useState<string | null>(null);

  useEffect(() => {
    if (codeFromUrl) {
      handleValidateCode();
    }
  }, [codeFromUrl]);

  const handleValidateCode = async () => {
    if (!accessCode.trim()) {
      setError("Veuillez entrer un code d'accès");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate the access code
      const { data: accessResult, error: accessError } = await supabase
        .rpc("get_session_by_access_code", { _code: accessCode.trim().toUpperCase() })
        .maybeSingle();

      if (accessError) throw accessError;

      if (!accessResult) {
        setError("Code d'accès invalide ou expiré");
        setLoading(false);
        return;
      }

      // Fetch seance details
      const { data: seanceData } = await supabase
        .from("seance_types")
        .select("id, pathologie, objectif_principal, pathologies, objectifs_principaux, objectifs_secondaires")
        .eq("id", accessResult.seance_type_id)
        .maybeSingle();

      // Fetch patient name
      const { data: patientData } = await supabase
        .from("patients")
        .select("name")
        .eq("id", accessResult.patient_id)
        .maybeSingle();

      setAccessData({
        ...accessResult,
        seance: seanceData || undefined,
        patient: patientData || undefined,
      });

      // Fetch exercices for this seance
      const { data: exercicesData } = await supabase
        .from("seance_exercices")
        .select(`
          id,
          name,
          description,
          duration_seconds,
          repetitions,
          series,
          ordre,
          exercice_id,
          exercices(id, title, description, thumbnail_url, video_url)
        `)
        .eq("seance_type_id", accessResult.seance_type_id)
        .order("ordre", { ascending: true });

      setSeanceExercices(exercicesData || []);

    } catch (err) {
      console.error("Error validating code:", err);
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const toggleExerciceComplete = (exerciceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletedExercices(prev => {
      const next = new Set(prev);
      if (next.has(exerciceId)) {
        next.delete(exerciceId);
      } else {
        next.add(exerciceId);
      }
      return next;
    });
  };

  const toggleExpandExercice = (exerciceId: string) => {
    setExpandedExercice(prev => prev === exerciceId ? null : exerciceId);
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const getTimeRemaining = () => {
    if (!accessData?.expires_at) return null;
    const expires = new Date(accessData.expires_at);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return "Expiré";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m restantes`;
  };

  const getSeanceDisplay = () => {
    if (!accessData?.seance) return "Séance";
    const pathologies = accessData.seance.pathologies?.length 
      ? accessData.seance.pathologies 
      : [accessData.seance.pathologie];
    return pathologies.join(", ");
  };

  const completedCount = completedExercices.size;
  const totalCount = seanceExercices.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Login form
  if (!accessData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Accès Patient</CardTitle>
            <p className="text-muted-foreground mt-2">
              Entrez votre code d'accès temporaire pour voir votre séance
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                placeholder="Code d'accès (ex: ABC123)"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
            </div>
            
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button 
              onClick={handleValidateCode} 
              className="w-full" 
              disabled={loading || !accessCode.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                "Accéder à ma séance"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Session view
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <Card className="mb-6 overflow-hidden">
          <div className="bg-primary/5 px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">{accessData.patient?.name || "Patient"}</h1>
                  <p className="text-sm text-muted-foreground">{getSeanceDisplay()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/50 px-3 py-1.5 rounded-full">
                <Clock className="w-4 h-4" />
                {getTimeRemaining()}
              </div>
            </div>
          </div>
          
          <CardContent className="pt-4 space-y-4">
            {/* Progress bar */}
            {totalCount > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-medium">{completedCount} / {totalCount} exercices</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exercices list */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Exercices ({seanceExercices.length})
          </h2>

          {seanceExercices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucun exercice dans cette séance
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {seanceExercices.map((exercice, index) => {
                const isCompleted = completedExercices.has(exercice.id);
                const isExpanded = expandedExercice === exercice.id;
                const hasVideo = !!exercice.exercices?.video_url;
                const hasDescription = !!(exercice.description || exercice.exercices?.description);
                
                return (
                  <Card 
                    key={exercice.id}
                    className={`transition-all overflow-hidden ${isCompleted ? 'bg-green-500/5 border-green-500/30' : ''}`}
                  >
                    {/* Main row - clickable */}
                    <div 
                      className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpandExercice(exercice.id)}
                    >
                      <div className="flex items-center gap-4">
                        {/* Complete button */}
                        <Button
                          variant={isCompleted ? "default" : "outline"}
                          size="icon"
                          className={`flex-shrink-0 h-10 w-10 ${isCompleted ? 'bg-green-500 hover:bg-green-600 border-green-500' : ''}`}
                          onClick={(e) => toggleExerciceComplete(exercice.id, e)}
                        >
                          <CheckCircle className="w-5 h-5" />
                        </Button>
                        
                        {/* Thumbnail */}
                        {exercice.exercices?.thumbnail_url ? (
                          <div className="relative flex-shrink-0">
                            <img 
                              src={exercice.exercices.thumbnail_url} 
                              alt="" 
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                            {hasVideo && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                                <Play className="w-6 h-6 text-white" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl font-bold text-muted-foreground">{index + 1}</span>
                          </div>
                        )}
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-base ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                            {exercice.exercices?.title || exercice.name || `Exercice ${index + 1}`}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            {exercice.series && exercice.series > 0 && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Repeat className="w-4 h-4" />
                                <span>{exercice.series} série{exercice.series > 1 ? 's' : ''}</span>
                              </div>
                            )}
                            {exercice.repetitions && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <span>× {exercice.repetitions} reps</span>
                              </div>
                            )}
                            {exercice.duration_seconds && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Timer className="w-4 h-4" />
                                <span>{formatDuration(exercice.duration_seconds)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Expand indicator */}
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t">
                        <div className="pt-4 space-y-4">
                          {/* Description */}
                          {hasDescription && (
                            <div>
                              <p className="text-sm font-medium mb-1">Description</p>
                              <p className="text-sm text-muted-foreground">
                                {exercice.description || exercice.exercices?.description}
                              </p>
                            </div>
                          )}
                          
                          {/* Video button */}
                          {hasVideo && (
                            <Button 
                              className="w-full gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVideoToPlay(exercice.exercices?.video_url || null);
                              }}
                            >
                              <Play className="w-4 h-4" />
                              Voir la vidéo
                            </Button>
                          )}
                          
                          {/* Details grid */}
                          <div className="grid grid-cols-3 gap-4">
                            {exercice.series && exercice.series > 0 && (
                              <div className="text-center p-3 bg-muted/50 rounded-lg">
                                <p className="text-2xl font-bold">{exercice.series}</p>
                                <p className="text-xs text-muted-foreground">Série{exercice.series > 1 ? 's' : ''}</p>
                              </div>
                            )}
                            {exercice.repetitions && (
                              <div className="text-center p-3 bg-muted/50 rounded-lg">
                                <p className="text-2xl font-bold">{exercice.repetitions}</p>
                                <p className="text-xs text-muted-foreground">Répétitions</p>
                              </div>
                            )}
                            {exercice.duration_seconds && (
                              <div className="text-center p-3 bg-muted/50 rounded-lg">
                                <p className="text-2xl font-bold">{formatDuration(exercice.duration_seconds)}</p>
                                <p className="text-xs text-muted-foreground">Durée</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Video Dialog */}
      <Dialog open={!!videoToPlay} onOpenChange={() => setVideoToPlay(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setVideoToPlay(null)}
            >
              <X className="w-4 h-4" />
            </Button>
            {videoToPlay && (
              <video
                src={videoToPlay}
                controls
                autoPlay
                className="w-full aspect-video"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}