import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, ClipboardList, User, Activity, Eye, Stethoscope, MessageSquare, Printer } from "lucide-react";

interface BilanData {
  // Infos patient
  profession: string;
  poids_taille_bmi: string;
  taille: string;
  poids: string;
  lateralite: string;
  loisir_sport: string;
  activite_physique_type: string;
  situation_fam: string;
  pathologie: string;
  pathologies_associees: string;
  plainte_patient: string;
  date_debut: string;
  circonstances: string;
  facteurs_declenchants: string;
  evolution: string;
  histoire_naturelle: string;
  recidive: string;
  chirurgie: string;
  chirurgie_detail: string;
  signes: string;
  mvt_impossibles: string;
  atcd: string;
  medicaments: string;
  tabac: string;
  etat_psychique: string;
  examen_complementaire: string;
  ttt_deja_suivis: string;
  projets_attentes: string;
  
  // Bilan douleurs
  douleur_frequence: string;
  douleur_eva_habituelle: string;
  douleur_eva_pire: string;
  douleur_eva_sport: string;
  douleur_eva_faible: string;
  douleur_type: string;
  douleur_sensations: string;
  douleur_localisation: string;
  douleur_circonstances_apparition: string;
  douleur_eva: string;
  douleur_soulage_aggrave: string;
  
  // Bilan morphodynamique
  morpho_extension_flexion: string;
  morpho_fonctionnel: string;
  
  // Bilan morphostatique
  morpho_attitude_statique: string;
  morpho_ceinture: string;
  morpho_dos: string;
  morpho_bassin: string;
  morpho_genou: string;
  morpho_pieds: string;
  morpho_articulaire: string;
  
  // Bilan cutanéo-trophique
  cutaneo_cicatrice_couleur: string;
  cutaneo_trophiques: string;
  cutaneo_adherences_chaleur: string;
  cutaneo_test_decollement: string;
  cutaneo_test_godet: string;
  cutaneo_amyotrophie: string;
  
  // Force et tests
  force_musculaire: string;
  tests_specifiques: string;
  
  // Commentaires
  commentaires: string;
}

const defaultBilan: BilanData = {
  profession: "",
  poids_taille_bmi: "",
  taille: "",
  poids: "",
  lateralite: "",
  loisir_sport: "",
  activite_physique_type: "",
  situation_fam: "",
  pathologie: "",
  pathologies_associees: "",
  plainte_patient: "",
  date_debut: "",
  circonstances: "",
  facteurs_declenchants: "",
  evolution: "",
  histoire_naturelle: "",
  recidive: "",
  chirurgie: "",
  chirurgie_detail: "",
  signes: "",
  mvt_impossibles: "",
  atcd: "",
  medicaments: "",
  tabac: "",
  etat_psychique: "",
  examen_complementaire: "",
  ttt_deja_suivis: "",
  projets_attentes: "",
  douleur_frequence: "",
  douleur_eva_habituelle: "",
  douleur_eva_pire: "",
  douleur_eva_sport: "",
  douleur_eva_faible: "",
  douleur_type: "",
  douleur_sensations: "",
  douleur_localisation: "",
  douleur_circonstances_apparition: "",
  douleur_eva: "",
  douleur_soulage_aggrave: "",
  morpho_extension_flexion: "",
  morpho_fonctionnel: "",
  morpho_attitude_statique: "",
  morpho_ceinture: "",
  morpho_dos: "",
  morpho_bassin: "",
  morpho_genou: "",
  morpho_pieds: "",
  morpho_articulaire: "",
  cutaneo_cicatrice_couleur: "",
  cutaneo_trophiques: "",
  cutaneo_adherences_chaleur: "",
  cutaneo_test_decollement: "",
  cutaneo_test_godet: "",
  cutaneo_amyotrophie: "",
  force_musculaire: "",
  tests_specifiques: "",
  commentaires: "",
};

export default function PatientBilanInitial() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patientName, setPatientName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [bilan, setBilan] = useState<BilanData>(defaultBilan);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchPatientData();
    }
  }, [user, id]);

  const fetchPatientData = async () => {
    const { data: patient } = await supabase
      .from("patients")
      .select("name")
      .eq("id", id)
      .maybeSingle();

    if (patient) {
      setPatientName(patient.name);
    }

    const { data: carePlan } = await supabase
      .from("patient_care_plans")
      .select("bilan_kine")
      .eq("patient_id", id)
      .maybeSingle();

    if (carePlan?.bilan_kine) {
      try {
        const parsed = JSON.parse(carePlan.bilan_kine);
        if (typeof parsed === "object") {
          setBilan({ ...defaultBilan, ...parsed });
        }
      } catch {
        setBilan(prev => ({ ...prev, commentaires: carePlan.bilan_kine || "" }));
      }
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!id || !user) return;
    setSaving(true);

    const bilanJson = JSON.stringify(bilan);

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

  const handlePrint = () => {
    window.print();
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
      <div className="container mx-auto px-4 py-8 max-w-5xl">
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} className="print:hidden">
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground print:hidden">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Enregistrer
            </Button>
          </div>
        </div>

        <div className="space-y-6 print:space-y-4">
          {/* En-tête pour impression avec champs nom/prénom vides */}
          <Card className="hidden print:block">
            <CardHeader>
              <CardTitle className="text-lg text-center">Bilan Initial Kinésithérapie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Label className="font-semibold">Nom :</Label>
                  <div className="flex-1 border-b border-foreground min-h-[1.5rem]"></div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="font-semibold">Prénom :</Label>
                  <div className="flex-1 border-b border-foreground min-h-[1.5rem]"></div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="font-semibold">Date de naissance :</Label>
                  <div className="flex-1 border-b border-foreground min-h-[1.5rem]"></div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="font-semibold">Date :</Label>
                  <div className="flex-1 border-b border-foreground min-h-[1.5rem]"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informations complémentaires patient */}
          <Card>
            <CardHeader className="print:py-2">
              <CardTitle className="text-lg flex items-center gap-2 print:text-base">
                <User className="w-5 h-5 print:w-4 print:h-4" />
                Informations patient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 print:space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:gap-2">
                <div>
                  <Label>Profession</Label>
                  <Input
                    placeholder="Ex: Employé de bureau"
                    value={bilan.profession}
                    onChange={(e) => handleChange("profession", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Taille (cm)</Label>
                  <Input
                    placeholder="Ex: 175"
                    value={bilan.taille}
                    onChange={(e) => handleChange("taille", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Poids (kg)</Label>
                  <Input
                    placeholder="Ex: 75"
                    value={bilan.poids}
                    onChange={(e) => handleChange("poids", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Latéralité</Label>
                  <Input
                    placeholder="Droitier / Gaucher"
                    value={bilan.lateralite}
                    onChange={(e) => handleChange("lateralite", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Loisirs - Activités physiques</Label>
                  <Input
                    placeholder="Ex: Tennis, natation"
                    value={bilan.loisir_sport}
                    onChange={(e) => handleChange("loisir_sport", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Type d'activité</Label>
                  <Input
                    placeholder="Occasionnelle / Compétition / Loisir / Pro"
                    value={bilan.activite_physique_type}
                    onChange={(e) => handleChange("activite_physique_type", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Situation familiale</Label>
                  <Input
                    placeholder="Ex: Marié, 2 enfants"
                    value={bilan.situation_fam}
                    onChange={(e) => handleChange("situation_fam", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Antécédents (ATCD)</Label>
                  <Textarea
                    placeholder="Antécédents médicaux, chirurgicaux..."
                    value={bilan.atcd}
                    onChange={(e) => handleChange("atcd", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Médicaments</Label>
                  <Textarea
                    placeholder="Traitements médicamenteux en cours..."
                    value={bilan.medicaments}
                    onChange={(e) => handleChange("medicaments", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Pathologies associées</Label>
                  <Input
                    placeholder="Ex: Diabète, HTA..."
                    value={bilan.pathologies_associees}
                    onChange={(e) => handleChange("pathologies_associees", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Tabac</Label>
                  <Input
                    placeholder="Oui / Non / Sevré"
                    value={bilan.tabac}
                    onChange={(e) => handleChange("tabac", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>État psychique du patient</Label>
                <Input
                  placeholder="Normal / Inquiet / Dépressif / Désespéré / Autre"
                  value={bilan.etat_psychique}
                  onChange={(e) => handleChange("etat_psychique", e.target.value)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Histoire */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Histoire
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Motif de consultation / Pathologie</Label>
                  <Input
                    placeholder="Ex: Lombalgie chronique"
                    value={bilan.pathologie}
                    onChange={(e) => handleChange("pathologie", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Depuis quand ?</Label>
                  <Input
                    type="date"
                    value={bilan.date_debut}
                    onChange={(e) => handleChange("date_debut", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Plainte patient</Label>
                <Textarea
                  placeholder="Description de la plainte principale..."
                  value={bilan.plainte_patient}
                  onChange={(e) => handleChange("plainte_patient", e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Facteurs déclenchants</Label>
                  <Input
                    placeholder="Trauma / Progressif / Spontané / Autre"
                    value={bilan.facteurs_declenchants}
                    onChange={(e) => handleChange("facteurs_declenchants", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Circonstances</Label>
                  <Input
                    placeholder="Ex: Accident, effort..."
                    value={bilan.circonstances}
                    onChange={(e) => handleChange("circonstances", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Histoire naturelle de la pathologie</Label>
                  <Input
                    placeholder="S'améliore / Stationnaire / S'empire / Fluctuant"
                    value={bilan.histoire_naturelle}
                    onChange={(e) => handleChange("histoire_naturelle", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Évolution</Label>
                  <Input
                    placeholder="Ex: Stable, amélioration, aggravation..."
                    value={bilan.evolution}
                    onChange={(e) => handleChange("evolution", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Récidive</Label>
                  <Input
                    placeholder="Oui / Non"
                    value={bilan.recidive}
                    onChange={(e) => handleChange("recidive", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Chirurgie</Label>
                  <Input
                    placeholder="Oui / Non"
                    value={bilan.chirurgie}
                    onChange={(e) => handleChange("chirurgie", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Si oui, quelle opération ?</Label>
                  <Input
                    placeholder="Détail de l'opération..."
                    value={bilan.chirurgie_detail}
                    onChange={(e) => handleChange("chirurgie_detail", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Examen complémentaire (imagerie)</Label>
                  <Textarea
                    placeholder="Radio, IRM, Scanner..."
                    value={bilan.examen_complementaire}
                    onChange={(e) => handleChange("examen_complementaire", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Traitements kiné déjà suivis</Label>
                  <Textarea
                    placeholder="Traitements précédents..."
                    value={bilan.ttt_deja_suivis}
                    onChange={(e) => handleChange("ttt_deja_suivis", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Signes</Label>
                  <Input
                    placeholder="Ex: Douleur, raideur, œdème..."
                    value={bilan.signes}
                    onChange={(e) => handleChange("signes", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Mouvements impossibles</Label>
                  <Input
                    placeholder="Ex: Rotation externe, élévation..."
                    value={bilan.mvt_impossibles}
                    onChange={(e) => handleChange("mvt_impossibles", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Objectifs / Projets / Attentes du patient</Label>
                <Textarea
                  placeholder="Objectifs et attentes du patient..."
                  value={bilan.projets_attentes}
                  onChange={(e) => handleChange("projets_attentes", e.target.value)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Bilan douleurs */}
          <Card>
            <CardHeader className="print:py-2">
              <CardTitle className="text-lg flex items-center gap-2 print:text-base">
                <Activity className="w-5 h-5 print:w-4 print:h-4" />
                Bilan douleurs
              </CardTitle>
            </CardHeader>
            <CardContent className="print:p-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Critère</TableHead>
                    <TableHead>Valeur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Fréquence (2 dernières semaines)</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Jamais / 1-2 fois / 1-2x/sem / 3-6x/sem / Chaque jour"
                        value={bilan.douleur_frequence}
                        onChange={(e) => handleChange("douleur_frequence", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">EVA habituelle /10</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Ex: 5"
                        value={bilan.douleur_eva_habituelle}
                        onChange={(e) => handleChange("douleur_eva_habituelle", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Pire douleur /10</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Ex: 8"
                        value={bilan.douleur_eva_pire}
                        onChange={(e) => handleChange("douleur_eva_pire", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Douleur sport /10</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Ex: 7"
                        value={bilan.douleur_eva_sport}
                        onChange={(e) => handleChange("douleur_eva_sport", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Douleur la plus faible /10</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Ex: 2"
                        value={bilan.douleur_eva_faible}
                        onChange={(e) => handleChange("douleur_eva_faible", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Type de douleur</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Constante / Diffuse / Intermittente / Aiguë..."
                        value={bilan.douleur_type}
                        onChange={(e) => handleChange("douleur_type", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Sensations</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Engourdissements / Picotements / Brûlure..."
                        value={bilan.douleur_sensations}
                        onChange={(e) => handleChange("douleur_sensations", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Localisation</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Ex: Épaule droite, lombaires..."
                        value={bilan.douleur_localisation}
                        onChange={(e) => handleChange("douleur_localisation", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Circonstances d'apparition</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Ex: Au mouvement, au repos..."
                        value={bilan.douleur_circonstances_apparition}
                        onChange={(e) => handleChange("douleur_circonstances_apparition", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Soulagé / Aggravé par</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Ex: Repos / Effort"
                        value={bilan.douleur_soulage_aggrave}
                        onChange={(e) => handleChange("douleur_soulage_aggrave", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Bilan morphodynamique */}
          <Card>
            <CardHeader className="print:py-2">
              <CardTitle className="text-lg flex items-center gap-2 print:text-base">
                <Activity className="w-5 h-5 print:w-4 print:h-4" />
                Bilan morphodynamique
              </CardTitle>
            </CardHeader>
            <CardContent className="print:p-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Critère</TableHead>
                    <TableHead>Observation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Extension / Flexion / Oscillé / Trajets / Force</TableCell>
                    <TableCell>
                      <Textarea
                        placeholder="Décrivez les observations morphodynamiques..."
                        value={bilan.morpho_extension_flexion}
                        onChange={(e) => handleChange("morpho_extension_flexion", e.target.value)}
                        className="border-0 p-0 min-h-[60px] focus-visible:ring-0 resize-none"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Fonctionnel</TableCell>
                    <TableCell>
                      <Textarea
                        placeholder="Évaluation fonctionnelle..."
                        value={bilan.morpho_fonctionnel}
                        onChange={(e) => handleChange("morpho_fonctionnel", e.target.value)}
                        className="border-0 p-0 min-h-[60px] focus-visible:ring-0 resize-none"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Bilan morphostatique */}
          <Card>
            <CardHeader className="print:py-2">
              <CardTitle className="text-lg flex items-center gap-2 print:text-base">
                <Eye className="w-5 h-5 print:w-4 print:h-4" />
                Bilan morphostatique
              </CardTitle>
            </CardHeader>
            <CardContent className="print:p-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Zone</TableHead>
                    <TableHead>Observation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Attitude statique</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Description de l'attitude statique..."
                        value={bilan.morpho_attitude_statique}
                        onChange={(e) => handleChange("morpho_attitude_statique", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Ceinture</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Observations ceinture..."
                        value={bilan.morpho_ceinture}
                        onChange={(e) => handleChange("morpho_ceinture", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Dos</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Observations dos..."
                        value={bilan.morpho_dos}
                        onChange={(e) => handleChange("morpho_dos", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Bassin</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Observations bassin..."
                        value={bilan.morpho_bassin}
                        onChange={(e) => handleChange("morpho_bassin", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Genou</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Observations genou..."
                        value={bilan.morpho_genou}
                        onChange={(e) => handleChange("morpho_genou", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Pieds</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Observations pieds..."
                        value={bilan.morpho_pieds}
                        onChange={(e) => handleChange("morpho_pieds", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Articulaire</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Observations articulaires..."
                        value={bilan.morpho_articulaire}
                        onChange={(e) => handleChange("morpho_articulaire", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Bilan cutanéo-trophique */}
          <Card>
            <CardHeader className="print:py-2">
              <CardTitle className="text-lg flex items-center gap-2 print:text-base">
                <Stethoscope className="w-5 h-5 print:w-4 print:h-4" />
                Bilan cutanéo-trophique
              </CardTitle>
            </CardHeader>
            <CardContent className="print:p-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Critère</TableHead>
                    <TableHead>Observation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Cicatrice / Couleur</TableCell>
                    <TableCell>
                      <Input
                        placeholder="État cicatriciel, coloration..."
                        value={bilan.cutaneo_cicatrice_couleur}
                        onChange={(e) => handleChange("cutaneo_cicatrice_couleur", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Trophiques</TableCell>
                    <TableCell>
                      <Input
                        placeholder="État trophique..."
                        value={bilan.cutaneo_trophiques}
                        onChange={(e) => handleChange("cutaneo_trophiques", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Adhérences / Chaleur</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Présence d'adhérences, chaleur..."
                        value={bilan.cutaneo_adherences_chaleur}
                        onChange={(e) => handleChange("cutaneo_adherences_chaleur", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Test décollement</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Résultat du test..."
                        value={bilan.cutaneo_test_decollement}
                        onChange={(e) => handleChange("cutaneo_test_decollement", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Test godet</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Résultat du test..."
                        value={bilan.cutaneo_test_godet}
                        onChange={(e) => handleChange("cutaneo_test_godet", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Amyotrophie</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Présence d'amyotrophie..."
                        value={bilan.cutaneo_amyotrophie}
                        onChange={(e) => handleChange("cutaneo_amyotrophie", e.target.value)}
                        className="border-0 p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Force musculaire et tests */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Force musculaire et tests spécifiques
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Force musculaire</Label>
                <Textarea
                  placeholder="Testing musculaire, déficits observés..."
                  value={bilan.force_musculaire}
                  onChange={(e) => handleChange("force_musculaire", e.target.value)}
                  className="mt-1 min-h-[100px]"
                />
              </div>
              <div>
                <Label>Tests spécifiques</Label>
                <Textarea
                  placeholder="Tests orthopédiques réalisés et résultats..."
                  value={bilan.tests_specifiques}
                  onChange={(e) => handleChange("tests_specifiques", e.target.value)}
                  className="mt-1 min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Commentaires */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Commentaires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Commentaires additionnels, observations générales..."
                value={bilan.commentaires}
                onChange={(e) => handleChange("commentaires", e.target.value)}
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
