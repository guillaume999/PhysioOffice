import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, FileText, Clock, AlertCircle, Play, CheckCircle } from "lucide-react";

interface TraitementSeance {
  id: string;
  seance_type_id: string;
  ordre: number;
  seance_types?: {
    id: string;
    pathologie: string;
    objectif_principal: string;
    pathologies?: string[];
    objectifs_principaux?: string[];
    objectifs_secondaires?: string[];
  } | null;
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
  traitement_id: string;
  patient_id: string;
  expires_at: string;
  traitement?: {
    pathologie: string;
    description: string | null;
  };
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
  const [seances, setSeances] = useState<TraitementSeance[]>([]);
  const [expandedSeance, setExpandedSeance] = useState<string | null>(null);
  const [seanceExercices, setSeanceExercices] = useState<Record<string, SeanceExercice[]>>({});
  const [completedExercices, setCompletedExercices] = useState<Set<string>>(new Set());

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
        .from("patient_session_access")
        .select(`
          id,
          traitement_id,
          patient_id,
          expires_at
        `)
        .eq("access_code", accessCode.trim().toUpperCase())
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (accessError) throw accessError;

      if (!accessResult) {
        setError("Code d'accès invalide ou expiré");
        setLoading(false);
        return;
      }

      // Fetch traitement details
      const { data: traitementData } = await supabase
        .from("traitement_types")
        .select("pathologie, description")
        .eq("id", accessResult.traitement_id)
        .maybeSingle();

      // Fetch patient name
      const { data: patientData } = await supabase
        .from("patients")
        .select("name")
        .eq("id", accessResult.patient_id)
        .maybeSingle();

      setAccessData({
        ...accessResult,
        traitement: traitementData || undefined,
        patient: patientData || undefined,
      });

      // Fetch seances for this traitement
      const { data: seancesData } = await supabase
        .from("traitement_seances")
        .select(`
          id,
          seance_type_id,
          ordre,
          seance_types(id, pathologie, objectif_principal, pathologies, objectifs_principaux, objectifs_secondaires)
        `)
        .eq("traitement_type_id", accessResult.traitement_id)
        .order("ordre", { ascending: true });

      setSeances(seancesData || []);

    } catch (err) {
      console.error("Error validating code:", err);
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const loadSeanceExercices = async (seanceTypeId: string) => {
    if (seanceExercices[seanceTypeId]) return;

    const { data } = await supabase
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
      .eq("seance_type_id", seanceTypeId)
      .order("ordre", { ascending: true });

    setSeanceExercices(prev => ({
      ...prev,
      [seanceTypeId]: data || []
    }));
  };

  const toggleSeance = (seanceTypeId: string) => {
    if (expandedSeance === seanceTypeId) {
      setExpandedSeance(null);
    } else {
      setExpandedSeance(seanceTypeId);
      loadSeanceExercices(seanceTypeId);
    }
  };

  const toggleExerciceComplete = (exerciceId: string) => {
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
              Entrez votre code d'accès temporaire pour voir votre programme
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
                "Accéder à mon programme"
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
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{accessData.patient?.name || "Patient"}</h1>
                <p className="text-muted-foreground">{accessData.traitement?.pathologie}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {getTimeRemaining()}
              </div>
            </div>
            {accessData.traitement?.description && (
              <p className="text-sm text-muted-foreground">{accessData.traitement.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Seances list */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Vos séances ({seances.length})
          </h2>

          {seances.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucune séance dans ce programme
              </CardContent>
            </Card>
          ) : (
            seances.map((seance, index) => (
              <Card 
                key={seance.id} 
                className={`cursor-pointer transition-all ${expandedSeance === seance.seance_type_id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => toggleSeance(seance.seance_type_id)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-primary">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {(seance.seance_types?.pathologies?.length 
                          ? seance.seance_types.pathologies 
                          : [seance.seance_types?.pathologie]
                        ).map((p, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {seance.seance_types?.objectif_principal}
                      </p>
                    </div>
                    <Play className={`w-5 h-5 transition-transform ${expandedSeance === seance.seance_type_id ? 'rotate-90' : ''}`} />
                  </div>

                  {/* Expanded content */}
                  {expandedSeance === seance.seance_type_id && (
                    <div className="mt-4 pt-4 border-t space-y-4" onClick={(e) => e.stopPropagation()}>
                      {/* Objectifs */}
                      {seance.seance_types?.objectifs_principaux && seance.seance_types.objectifs_principaux.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Objectifs</p>
                          <div className="flex flex-wrap gap-1">
                            {seance.seance_types.objectifs_principaux.map((obj, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{obj}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Exercices */}
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Exercices ({seanceExercices[seance.seance_type_id]?.length || 0})
                        </p>
                        {!seanceExercices[seance.seance_type_id] ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        ) : seanceExercices[seance.seance_type_id].length === 0 ? (
                          <p className="text-sm text-muted-foreground">Aucun exercice</p>
                        ) : (
                          <div className="space-y-2">
                            {seanceExercices[seance.seance_type_id].map((exercice) => {
                              const isCompleted = completedExercices.has(exercice.id);
                              return (
                                <div 
                                  key={exercice.id}
                                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                    isCompleted ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/30'
                                  }`}
                                >
                                  <Button
                                    variant={isCompleted ? "default" : "outline"}
                                    size="icon"
                                    className={`flex-shrink-0 ${isCompleted ? 'bg-green-500 hover:bg-green-600' : ''}`}
                                    onClick={() => toggleExerciceComplete(exercice.id)}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                  
                                  {exercice.exercices?.thumbnail_url && (
                                    <img 
                                      src={exercice.exercices.thumbnail_url} 
                                      alt="" 
                                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  
                                  <div className="flex-1 min-w-0">
                                    <p className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                      {exercice.exercices?.title || exercice.name || "Exercice"}
                                    </p>
                                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                      {exercice.series && (
                                        <span>{exercice.series} séries</span>
                                      )}
                                      {exercice.repetitions && (
                                        <span>× {exercice.repetitions} reps</span>
                                      )}
                                      {exercice.duration_seconds && (
                                        <span>{formatDuration(exercice.duration_seconds)}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
