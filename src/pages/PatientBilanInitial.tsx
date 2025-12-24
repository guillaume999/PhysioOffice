import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, ClipboardList, User } from "lucide-react";

interface BilanData {
  douleur_localisation: string;
  douleur_intensite: string;
  douleur_type: string;
  amplitude_articulaire: string;
  force_musculaire: string;
  tests_specifiques: string;
  observations: string;
}

export default function PatientBilanInitial() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patientName, setPatientName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bilanKine, setBilanKine] = useState<string>("");
  
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
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchPatientData();
    }
  }, [user, id]);

  const fetchPatientData = async () => {
    // Fetch patient name
    const { data: patient } = await supabase
      .from("patients")
      .select("name")
      .eq("id", id)
      .maybeSingle();

    if (patient) {
      setPatientName(patient.name);
    }

    // Fetch existing bilan_kine from care plan
    const { data: carePlan } = await supabase
      .from("patient_care_plans")
      .select("bilan_kine")
      .eq("patient_id", id)
      .maybeSingle();

    if (carePlan?.bilan_kine) {
      setBilanKine(carePlan.bilan_kine);
      // Try to parse existing data if it's JSON
      try {
        const parsed = JSON.parse(carePlan.bilan_kine);
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
        setBilan(prev => ({ ...prev, observations: carePlan.bilan_kine || "" }));
      }
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!id || !user) return;
    setSaving(true);

    // Store bilan as JSON string in bilan_kine field
    const bilanJson = JSON.stringify(bilan);

    // Check if care plan exists
    const { data: existingPlan } = await supabase
      .from("patient_care_plans")
      .select("id")
      .eq("patient_id", id)
      .maybeSingle();

    if (existingPlan) {
      await supabase
        .from("patient_care_plans")
        .update({ bilan_kine: bilanJson })
        .eq("id", existingPlan.id);
    } else {
      await supabase
        .from("patient_care_plans")
        .insert({
          patient_id: id,
          user_id: user.id,
          bilan_kine: bilanJson,
        });
    }

    toast({ title: "Bilan initial enregistré" });
    setSaving(false);
  };

  const handleChange = (field: keyof BilanData, value: string) => {
    setBilan(prev => ({ ...prev, [field]: value }));
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/patients/${id}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <ClipboardList className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Bilan Initial</h1>
              <p className="text-muted-foreground flex items-center gap-1">
                <User className="w-4 h-4" />
                {patientName}
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
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
                placeholder="Posture, marche, observations générales..."
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
