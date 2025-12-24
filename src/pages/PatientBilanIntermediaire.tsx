import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, ClipboardList, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface BilanData {
  douleur_localisation: string;
  douleur_intensite: string;
  douleur_type: string;
  amplitude_articulaire: string;
  force_musculaire: string;
  tests_specifiques: string;
  observations: string;
}

export default function PatientBilanIntermediaire() {
  const { id: patientId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const traitementId = searchParams.get("traitement");
  const position = parseInt(searchParams.get("position") || "0", 10);
  const bilanId = searchParams.get("bilan");

  const [patientName, setPatientName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingBilanId, setExistingBilanId] = useState<string | null>(bilanId);

  const [bilan, setBilan] = useState<BilanData>({
    douleur_localisation: "",
    douleur_intensite: "",
    douleur_type: "",
    amplitude_articulaire: "",
    force_musculaire: "",
    tests_specifiques: "",
    observations: "",
  });

  useEffect(() => {
    if (patientId && user) {
      fetchData();
    }
  }, [patientId, user, bilanId]);

  const fetchData = async () => {
    try {
      // Fetch patient name
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", patientId)
        .single();

      if (patient) {
        setPatientName(patient.name);
      }

      // Fetch existing bilan if we have an id
      if (bilanId) {
        const { data: bilanData } = await supabase
          .from("patient_bilans")
          .select("*")
          .eq("id", bilanId)
          .single();

        if (bilanData) {
          setExistingBilanId(bilanData.id);
          // Try to parse existing data if it's JSON
          if (bilanData.content) {
            try {
              const parsed = JSON.parse(bilanData.content);
              if (typeof parsed === "object") {
                setBilan({
                  douleur_localisation: parsed.douleur_localisation || "",
                  douleur_intensite: parsed.douleur_intensite || "",
                  douleur_type: parsed.douleur_type || "",
                  amplitude_articulaire: parsed.amplitude_articulaire || "",
                  force_musculaire: parsed.force_musculaire || "",
                  tests_specifiques: parsed.tests_specifiques || "",
                  observations: parsed.observations || "",
                });
              }
            } catch {
              // If not JSON, put it in observations
              setBilan(prev => ({ ...prev, observations: bilanData.content || "" }));
            }
          }
        }
      } else if (traitementId && patientId) {
        // Check if there's already a bilan at this position
        const { data: existingBilan } = await supabase
          .from("patient_bilans")
          .select("*")
          .eq("patient_id", patientId)
          .eq("traitement_id", traitementId)
          .eq("position_after_seance", position)
          .maybeSingle();

        if (existingBilan) {
          setExistingBilanId(existingBilan.id);
          // Try to parse existing data if it's JSON
          if (existingBilan.content) {
            try {
              const parsed = JSON.parse(existingBilan.content);
              if (typeof parsed === "object") {
                setBilan({
                  douleur_localisation: parsed.douleur_localisation || "",
                  douleur_intensite: parsed.douleur_intensite || "",
                  douleur_type: parsed.douleur_type || "",
                  amplitude_articulaire: parsed.amplitude_articulaire || "",
                  force_musculaire: parsed.force_musculaire || "",
                  tests_specifiques: parsed.tests_specifiques || "",
                  observations: parsed.observations || "",
                });
              }
            } catch {
              // If not JSON, put it in observations
              setBilan(prev => ({ ...prev, observations: existingBilan.content || "" }));
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !patientId) return;
    setIsSaving(true);

    // Store bilan as JSON string
    const bilanJson = JSON.stringify(bilan);

    try {
      if (existingBilanId) {
        // Update existing bilan
        const { error } = await supabase
          .from("patient_bilans")
          .update({ content: bilanJson })
          .eq("id", existingBilanId);

        if (error) throw error;
      } else {
        // Create new bilan
        const { data, error } = await supabase
          .from("patient_bilans")
          .insert({
            patient_id: patientId,
            traitement_id: traitementId,
            user_id: user.id,
            position_after_seance: position,
            content: bilanJson,
          })
          .select()
          .single();

        if (error) throw error;
        setExistingBilanId(data.id);
      }

      toast.success("Bilan enregistré");
      navigate(-1);
    } catch (error) {
      console.error("Error saving bilan:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof BilanData, value: string) => {
    setBilan(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="p-3 rounded-xl bg-amber-500/10">
              <ClipboardList className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Bilan intermédiaire</h1>
              <p className="text-muted-foreground flex items-center gap-1">
                <User className="w-4 h-4" />
                {patientName} • Après séance {position}
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="gradient-primary text-primary-foreground">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>

        <div className="space-y-6">
          {/* Évaluation de la douleur */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Évaluation de la douleur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Localisation</Label>
                <Input
                  placeholder="Ex: Épaule droite, lombaires..."
                  value={bilan.douleur_localisation}
                  onChange={(e) => handleChange("douleur_localisation", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Intensité (EVA 0-10)</Label>
                  <Input
                    placeholder="Ex: 6/10"
                    value={bilan.douleur_intensite}
                    onChange={(e) => handleChange("douleur_intensite", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Type de douleur</Label>
                  <Input
                    placeholder="Ex: Mécanique, inflammatoire, mixte..."
                    value={bilan.douleur_type}
                    onChange={(e) => handleChange("douleur_type", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bilan articulaire et musculaire */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bilan articulaire et musculaire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Amplitudes articulaires</Label>
                <Textarea
                  placeholder="Décrivez les limitations d'amplitude..."
                  value={bilan.amplitude_articulaire}
                  onChange={(e) => handleChange("amplitude_articulaire", e.target.value)}
                  className="mt-1 min-h-[100px]"
                />
              </div>
              <div>
                <Label>Force musculaire</Label>
                <Textarea
                  placeholder="Testing musculaire, déficits observés..."
                  value={bilan.force_musculaire}
                  onChange={(e) => handleChange("force_musculaire", e.target.value)}
                  className="mt-1 min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Tests spécifiques */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tests spécifiques</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Tests orthopédiques réalisés et résultats..."
                value={bilan.tests_specifiques}
                onChange={(e) => handleChange("tests_specifiques", e.target.value)}
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>

          {/* Observations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Observations complémentaires</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Évolution depuis le dernier bilan, progrès, difficultés..."
                value={bilan.observations}
                onChange={(e) => handleChange("observations", e.target.value)}
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
