import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, ClipboardList, Loader2, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";
import { parseJsonField } from "@/lib/utils";
import { toast } from "sonner";

interface BilanData {
  objectif_intermediaire: string;
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
  const patientTraitementId = searchParams.get("pt");
  const bilanId = searchParams.get("bilan");

  const [patientName, setPatientName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingBilanId, setExistingBilanId] = useState<string | null>(bilanId);
  // Empêche d'enregistrer pendant le chargement initial (sinon onBlur peut créer un bilan vide).
  const isReadyRef = useRef(false);
  // Sérialise les sauvegardes concurrentes (onBlur rapides) pour éviter de dupliquer la création.
  const savingPromiseRef = useRef<Promise<void> | null>(null);

  const [bilan, setBilan] = useState<BilanData>({
    objectif_intermediaire: "",
    douleur_localisation: "",
    douleur_intensite: "",
    douleur_type: "",
    amplitude_articulaire: "",
    force_musculaire: "",
    tests_specifiques: "",
    observations: "",
  });

  const [bilanDate, setBilanDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (patientId && user) {
      fetchData();
    }
  }, [patientId, user, bilanId]);

  const fetchData = async () => {
    try {
      // Fetch patient name
      let patient: any = null;
      try {
        patient = await pb.collection("patients").getOne(patientId!, { fields: "id,name" });
      } catch { /* ignore */ }

      if (patient) {
        setPatientName(patient.name);
      }

      // Fetch existing bilan if we have an id
      if (bilanId) {
        let bilanData: any = null;
        try {
          bilanData = await pb.collection("patient_bilans").getOne(bilanId);
        } catch { /* ignore */ }

        if (bilanData) {
          setExistingBilanId(bilanData.id);
          if (bilanData.bilan_date) {
            // Normalize to yyyy-MM-dd for the date input
            setBilanDate(String(bilanData.bilan_date).slice(0, 10));
          }
          // PocketBase renvoie le champ `json` déjà déserialisé en objet,
          // mais d'anciens records peuvent être une string brute.
          if (bilanData.content) {
            const parsed = parseJsonField<Partial<BilanData>>(bilanData.content);
            if (parsed && typeof parsed === "object") {
              // Force string : d'anciens records corrompus contiennent un sous-objet
              // dans `observations` (régression d'un bug précédent où content entier
              // était écrit dans observations).
              const s = (v: unknown) => (typeof v === "string" ? v : "");
              setBilan({
                objectif_intermediaire: s(parsed.objectif_intermediaire),
                douleur_localisation: s(parsed.douleur_localisation),
                douleur_intensite: s(parsed.douleur_intensite),
                douleur_type: s(parsed.douleur_type),
                amplitude_articulaire: s(parsed.amplitude_articulaire),
                force_musculaire: s(parsed.force_musculaire),
                tests_specifiques: s(parsed.tests_specifiques),
                observations: s(parsed.observations),
              });
            } else if (typeof bilanData.content === "string") {
              // Contenu en texte libre (ancien format) → on le met dans observations.
              setBilan(prev => ({ ...prev, observations: bilanData.content }));
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setIsLoading(false);
      // Active l'auto-save uniquement après le chargement initial.
      isReadyRef.current = true;
    }
  };

  // Sauvegarde silencieuse (create/update) sans toast ni navigation.
  // Utilisée pour l'auto-save onBlur. Sérialisée pour ne pas créer plusieurs records.
  const persistBilan = async (
    nextBilan: BilanData,
    nextDate: string,
  ): Promise<void> => {
    if (!user || !patientId) return;
    if (!isReadyRef.current) return;

    // Évite de créer un record vide tant qu'on n'a aucun contenu.
    const hasContent = Object.values(nextBilan).some(v => v && v.trim() !== "");
    if (!existingBilanId && !hasContent) return;

    // Attend la sauvegarde en cours pour récupérer l'id éventuellement créé.
    if (savingPromiseRef.current) {
      try { await savingPromiseRef.current; } catch { /* ignore */ }
    }

    const bilanJson = JSON.stringify(nextBilan);
    const run = (async () => {
      if (existingBilanId) {
        await pb.collection("patient_bilans").update(existingBilanId, {
          content: bilanJson,
          bilan_date: nextDate,
        });
      } else {
        const data = await pb.collection("patient_bilans").create({
          patient: patientId,
          traitement: traitementId || null,
          patient_traitement: patientTraitementId || null,
          user: user.id,
          position_after_seance: 0,
          content: bilanJson,
          bilan_date: nextDate,
        });
        setExistingBilanId(data.id);
      }
    })();

    savingPromiseRef.current = run;
    try {
      await run;
    } catch (error) {
      console.error("Error auto-saving bilan:", error);
      toast.error("Erreur lors de l'enregistrement automatique");
    } finally {
      if (savingPromiseRef.current === run) savingPromiseRef.current = null;
    }
  };

  const handleAutoSave = () => {
    void persistBilan(bilan, bilanDate);
  };

  // Bouton "Enregistrer" : sauvegarde explicite avec feedback + retour arrière.
  const handleSave = async () => {
    if (!user || !patientId) return;
    setIsSaving(true);
    try {
      // Force le flag même si onBlur n'a jamais été déclenché.
      isReadyRef.current = true;
      await persistBilan(bilan, bilanDate);
      toast.success("Bilan enregistré");
      navigate(-1);
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
                {patientName}
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="gradient-primary text-primary-foreground">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>

        <div className="space-y-6">
          {/* Date du bilan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Date du bilan</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="date"
                value={bilanDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setBilanDate(v);
                  // La date ne reçoit pas onBlur de manière fiable → on déclenche l'auto-save sur change.
                  setTimeout(() => { void persistBilan(bilan, v); }, 0);
                }}
                onBlur={handleAutoSave}
                className="max-w-xs"
              />
            </CardContent>
          </Card>

          {/* Observations / commentaires */}
          <Card className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
            <CardHeader>
              <CardTitle className="text-lg text-amber-700 dark:text-amber-400">Observations / commentaires</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Observations et commentaires pour ce bilan intermédiaire..."
                value={bilan.objectif_intermediaire}
                onChange={(e) => handleChange("objectif_intermediaire", e.target.value)}
                onBlur={handleAutoSave}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

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
                  onBlur={handleAutoSave}
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
                    onBlur={handleAutoSave}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Type de douleur</Label>
                  <Input
                    placeholder="Ex: Mécanique, inflammatoire, mixte..."
                    value={bilan.douleur_type}
                    onChange={(e) => handleChange("douleur_type", e.target.value)}
                    onBlur={handleAutoSave}
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
                  onBlur={handleAutoSave}
                  className="mt-1 min-h-[100px]"
                />
              </div>
              <div>
                <Label>Force musculaire</Label>
                <Textarea
                  placeholder="Testing musculaire, déficits observés..."
                  value={bilan.force_musculaire}
                  onChange={(e) => handleChange("force_musculaire", e.target.value)}
                  onBlur={handleAutoSave}
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
                onBlur={handleAutoSave}
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
                onBlur={handleAutoSave}
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
