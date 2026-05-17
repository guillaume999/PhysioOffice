import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Trash2, User, Copy, History, Printer, Share2, ClipboardList, ChevronRight } from "lucide-react";
import { ShareResourceDialog } from "@/components/sharing/ShareResourceDialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { PatientCommentsCard } from "@/components/patient/PatientCommentsCard";
import { PatientCareObjectivesCard } from "@/components/patient/PatientCareObjectivesCard";
import { SelectTraitementDialog } from "@/components/patient/SelectTraitementDialog";
import { PatientReportPrintDialog } from "@/components/patient/PatientReportPrintDialog";
import { TraitementFormDialog } from "@/components/traitement/TraitementFormDialog";

interface PatientData {
  id: string;
  name: string;
  numero: string | null;
  status: string;
  has_mutual: boolean;
  remaining_sessions: number | null;
  prescription: string | null;
  address: string | null;
  postal_code: string | null;
  medical_notes: string | null;
  allergies: string | null;
  blood_type: string | null;
  antecedents: string | null;
  created_at: string;
}

interface CarePlanData {
  id?: string;
  comments: string;
  motif_consultation: string;
  bilan_kine: string;
  objectifs_prise_en_charge: string;
  active_traitement_id: string | null;
  bilan_initial_date: string | null;
  traitement_start_date: string | null;
}


const statusLabels: Record<string, string> = {
  active: "Actif",
  in_treatment: "En traitement",
  waiting: "En attente",
  inactive: "Inactif",
};

const prescriptionLabels: Record<string, string> = {
  oui: "Oui",
  none: "Non",
  renouv_kine: "Renouv. kiné",
};

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<PatientData>>({});
  
  const [carePlan, setCarePlan] = useState<CarePlanData>({
    comments: "",
    motif_consultation: "",
    bilan_kine: "",
    objectifs_prise_en_charge: "",
    active_traitement_id: null,
    bilan_initial_date: null,
    traitement_start_date: null,
  });
  const [activeTraitementName, setActiveTraitementName] = useState<string | null>(null);
  const [traitementSeances, setTraitementSeances] = useState<{
    ordre: number;
    seance_date: string | null;
    objectifs_principaux: string[];
    objectifs_secondaires: string[];
    pathologies: string[];
  }[]>([]);
  const [bilanInitialData, setBilanInitialData] = useState<Record<string, any> | null>(null);
  const [bilansIntermediaires, setBilansIntermediaires] = useState<{
    id: string;
    position_after_seance: number;
    bilan_date: string | null;
    content: string | null;
  }[]>([]);
  
  
  const [selectTraitementDialogOpen, setSelectTraitementDialogOpen] = useState(false);
  const [createTraitementDialogOpen, setCreateTraitementDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateOptions, setDuplicateOptions] = useState({
    keepComments: true,
    keepObjectives: true,
    keepTraitement: true,
  });
  const [reportPrintDialogOpen, setReportPrintDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchPatient();
      fetchCarePlan();
    }
  }, [user, id]);

  const fetchPatient = async () => {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      navigate("/patients");
    } else if (!data) {
      toast({ title: "Patient non trouvé", variant: "destructive" });
      navigate("/patients");
    } else {
      setPatient(data);
      setFormData(data);
    }
    setLoading(false);
  };

  const fetchCarePlan = async () => {
    const { data, error } = await supabase
      .from("patient_care_plans")
      .select("*, bilan_initial_data")
      .eq("patient_id", id)
      .maybeSingle();
    
    if (data) {
      setCarePlan({
        id: data.id,
        comments: data.comments || "",
        motif_consultation: data.motif_consultation || "",
        bilan_kine: data.bilan_kine || "",
        objectifs_prise_en_charge: data.objectifs_prise_en_charge || "",
        active_traitement_id: data.active_traitement_id,
        bilan_initial_date: data.bilan_initial_date || null,
        traitement_start_date: data.traitement_start_date || null,
      });

      // Parse bilan initial data
      if (data.bilan_initial_data) {
        try {
          const parsed = JSON.parse(data.bilan_initial_data);
          setBilanInitialData(parsed);
        } catch {
          setBilanInitialData(null);
        }
      } else {
        setBilanInitialData(null);
      }
      
      if (data.active_traitement_id) {
        const { data: traitement } = await supabase
          .from("traitement_types")
          .select("pathologie")
          .eq("id", data.active_traitement_id)
          .maybeSingle();
        
        if (traitement) {
          setActiveTraitementName(traitement.pathologie);
        }

        // Fetch seances of the treatment with their dates
        const { data: traitementSeancesData } = await supabase
          .from("traitement_seances")
          .select(`
            ordre,
            seance_type_id,
            seance_types (
              objectifs_principaux,
              pathologies
            )
          `)
          .eq("traitement_type_id", data.active_traitement_id)
          .order("ordre", { ascending: true });

        // Fetch seance dates for this patient and treatment
        const { data: seanceDatesData } = await supabase
          .from("patient_traitement_seance_dates")
          .select("seance_ordre, seance_date")
          .eq("patient_id", id)
          .eq("traitement_id", data.active_traitement_id);

        const datesMap = new Map<number, string | null>();
        seanceDatesData?.forEach((d) => {
          datesMap.set(d.seance_ordre, d.seance_date);
        });

        if (traitementSeancesData) {
          const seances = traitementSeancesData.map((ts: any) => ({
            ordre: ts.ordre,
            seance_date: datesMap.get(ts.ordre) || null,
            objectifs_principaux: ts.seance_types?.objectifs_principaux || [],
            pathologies: ts.seance_types?.pathologies || [],
          }));
          setTraitementSeances(seances);
        }

        // Fetch bilans intermediaires
        const { data: bilansData } = await supabase
          .from("patient_bilans")
          .select("id, position_after_seance, bilan_date, content")
          .eq("patient_id", id)
          .eq("traitement_id", data.active_traitement_id)
          .order("position_after_seance", { ascending: true });

        if (bilansData) {
          setBilansIntermediaires(bilansData);
        } else {
          setBilansIntermediaires([]);
        }
      } else {
        setTraitementSeances([]);
        setBilansIntermediaires([]);
      }
    } else {
      setTraitementSeances([]);
      setBilanInitialData(null);
      setBilansIntermediaires([]);
    }
  };


  const handleSave = async () => {
    if (!id || !user) return;
    setSaving(true);
    
    // Save patient data
    const { error: patientError } = await supabase
      .from("patients")
      .update({
        name: formData.name,
        status: formData.status,
        has_mutual: formData.has_mutual ?? false,
        remaining_sessions: formData.remaining_sessions,
        prescription: formData.prescription,
        address: formData.address,
        postal_code: formData.postal_code,
        medical_notes: formData.medical_notes,
        allergies: formData.allergies,
        blood_type: formData.blood_type,
        antecedents: formData.antecedents,
      })
      .eq("id", id);
    
    if (patientError) {
      toast({ title: "Erreur", description: patientError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Save or update care plan
    if (carePlan.id) {
      await supabase
        .from("patient_care_plans")
        .update({
          comments: carePlan.comments,
          motif_consultation: carePlan.motif_consultation,
          bilan_kine: carePlan.bilan_kine,
          objectifs_prise_en_charge: carePlan.objectifs_prise_en_charge,
          active_traitement_id: carePlan.active_traitement_id,
          bilan_initial_date: carePlan.bilan_initial_date,
          traitement_start_date: carePlan.traitement_start_date,
        })
        .eq("id", carePlan.id);
    } else {
      const { data: newPlan } = await supabase
        .from("patient_care_plans")
        .insert({
          patient_id: id,
          user_id: user.id,
          comments: carePlan.comments,
          motif_consultation: carePlan.motif_consultation,
          bilan_kine: carePlan.bilan_kine,
          objectifs_prise_en_charge: carePlan.objectifs_prise_en_charge,
          active_traitement_id: carePlan.active_traitement_id,
          bilan_initial_date: carePlan.bilan_initial_date,
          traitement_start_date: carePlan.traitement_start_date,
        })
        .select()
        .single();
      
      if (newPlan) {
        setCarePlan({ ...carePlan, id: newPlan.id });
      }
    }

    toast({ title: "Patient mis à jour" });
    fetchPatient();
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    
    const { error } = await supabase.from("patients").delete().eq("id", id);
    
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Patient supprimé" });
      navigate("/patients");
    }
  };

  const handleDuplicate = async () => {
    if (!patient || !user) return;
    setDuplicating(true);

    try {
      // Create new patient with same data (except numero)
      const { data: newPatient, error: patientError } = await supabase
        .from("patients")
        .insert({
          user_id: user.id,
          name: `${patient.name} (copie)`,
          status: patient.status,
          has_mutual: patient.has_mutual,
          remaining_sessions: patient.remaining_sessions,
          prescription: patient.prescription,
          address: patient.address,
          postal_code: patient.postal_code,
          medical_notes: patient.medical_notes,
          allergies: patient.allergies,
          blood_type: patient.blood_type,
          antecedents: patient.antecedents,
        })
        .select()
        .single();

      if (patientError || !newPatient) {
        throw patientError || new Error("Erreur lors de la création du patient");
      }

      // Copy care plan if options selected
      if (duplicateOptions.keepComments || duplicateOptions.keepObjectives || duplicateOptions.keepTraitement) {
        await supabase.from("patient_care_plans").insert({
          patient_id: newPatient.id,
          user_id: user.id,
          comments: duplicateOptions.keepComments ? carePlan.comments : "",
          motif_consultation: duplicateOptions.keepObjectives ? carePlan.motif_consultation : "",
          bilan_kine: duplicateOptions.keepObjectives ? carePlan.bilan_kine : "",
          objectifs_prise_en_charge: duplicateOptions.keepObjectives ? carePlan.objectifs_prise_en_charge : "",
          active_traitement_id: duplicateOptions.keepTraitement ? carePlan.active_traitement_id : null,
        });
      }

      toast({ title: "Patient dupliqué avec succès" });
      setDuplicateDialogOpen(false);
      navigate(`/patients/${newPatient.id}`);
    } catch (error: any) {
      console.error("Error duplicating patient:", error);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setDuplicating(false);
    }
  };

  const handleCarePlanChange = (field: keyof Omit<CarePlanData, "id" | "active_traitement_id">, value: string) => {
    setCarePlan({ ...carePlan, [field]: value });
  };

  const handleAutoSave = async () => {
    if (!id || !user) return;
    
    // Save patient data
    await supabase
      .from("patients")
      .update({
        name: formData.name,
        status: formData.status,
        has_mutual: formData.has_mutual ?? false,
        remaining_sessions: formData.remaining_sessions,
        prescription: formData.prescription,
        address: formData.address,
        postal_code: formData.postal_code,
        medical_notes: formData.medical_notes,
        allergies: formData.allergies,
        blood_type: formData.blood_type,
        antecedents: formData.antecedents,
      })
      .eq("id", id);

    // Save or update care plan
    if (carePlan.id) {
      await supabase
        .from("patient_care_plans")
        .update({
          comments: carePlan.comments,
          motif_consultation: carePlan.motif_consultation,
          bilan_kine: carePlan.bilan_kine,
          objectifs_prise_en_charge: carePlan.objectifs_prise_en_charge,
          active_traitement_id: carePlan.active_traitement_id,
          bilan_initial_date: carePlan.bilan_initial_date,
          traitement_start_date: carePlan.traitement_start_date,
        })
        .eq("id", carePlan.id);
    } else {
      const { data: newPlan } = await supabase
        .from("patient_care_plans")
        .insert({
          patient_id: id,
          user_id: user.id,
          comments: carePlan.comments,
          motif_consultation: carePlan.motif_consultation,
          bilan_kine: carePlan.bilan_kine,
          objectifs_prise_en_charge: carePlan.objectifs_prise_en_charge,
          active_traitement_id: carePlan.active_traitement_id,
          bilan_initial_date: carePlan.bilan_initial_date,
          traitement_start_date: carePlan.traitement_start_date,
        })
        .select()
        .single();
      
      if (newPlan) {
        setCarePlan(prev => ({ ...prev, id: newPlan.id }));
      }
    }
  };

  const handleSelectTraitement = async (traitementId: string) => {
    const newCarePlan = { ...carePlan, active_traitement_id: traitementId };
    setCarePlan(newCarePlan);
    
    // Set the treatment visibility to hidden by default when assigned to a patient
    await supabase
      .from("traitement_types")
      .update({ is_hidden_from_list: true })
      .eq("id", traitementId);
    
    const { data: traitement } = await supabase
      .from("traitement_types")
      .select("pathologie")
      .eq("id", traitementId)
      .maybeSingle();
    
    if (traitement) {
      setActiveTraitementName(traitement.pathologie);
    }

    // Auto-save the care plan with the new treatment
    if (newCarePlan.id) {
      await supabase
        .from("patient_care_plans")
        .update({ active_traitement_id: traitementId })
        .eq("id", newCarePlan.id);
    } else if (user && id) {
      const { data: newPlan } = await supabase
        .from("patient_care_plans")
        .insert({
          patient_id: id,
          user_id: user.id,
          comments: newCarePlan.comments,
          motif_consultation: newCarePlan.motif_consultation,
          bilan_kine: newCarePlan.bilan_kine,
          objectifs_prise_en_charge: newCarePlan.objectifs_prise_en_charge,
          active_traitement_id: traitementId,
        })
        .select()
        .single();
      
      if (newPlan) {
        setCarePlan({ ...newCarePlan, id: newPlan.id });
      }
    }
    
    toast({ title: "Traitement enregistré" });
  };


  const handleCreateTraitement = () => {
    setSelectTraitementDialogOpen(false);
    setCreateTraitementDialogOpen(true);
  };

  const handleCreateTraitementSuccess = async () => {
    // Fetch the latest traitement created by this user to set as active
    if (!user) return;
    
    const { data: latestTraitement } = await supabase
      .from("traitement_types")
      .select("id, pathologie")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestTraitement) {
      // Use handleSelectTraitement to both update state and save to DB
      await handleSelectTraitement(latestTraitement.id);
    }
  };

  const handleRemoveTraitement = async () => {
    setCarePlan({ ...carePlan, active_traitement_id: null });
    setActiveTraitementName(null);
    
    // Auto-save the removal
    if (carePlan.id) {
      await supabase
        .from("patient_care_plans")
        .update({ active_traitement_id: null })
        .eq("id", carePlan.id);
      toast({ title: "Traitement retiré" });
    }
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

  if (!patient) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
        {/* Header mobile optimisé */}
        <div className="flex flex-col gap-4 mb-6 md:mb-8">
          {/* Ligne 1: Retour + Info patient */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/patients")} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 md:p-3 rounded-xl bg-blue-500/10 shrink-0">
                <User className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg md:text-2xl font-display font-bold truncate">{patient.name}</h1>
                <p className="text-sm text-muted-foreground">#{patient.numero || "-"}</p>
              </div>
            </div>
          </div>
          
          {/* Ligne 2: Actions (scroll horizontal sur mobile) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground shrink-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              <span className="hidden sm:inline">Enregistrer</span>
              <span className="sm:hidden">Sauver</span>
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setReportPrintDialogOpen(true)}
              title="Imprimer le compte-rendu"
              className="shrink-0"
            >
              <Printer className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setDuplicateDialogOpen(true)}
              title="Dupliquer ce patient"
              className="shrink-0"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <ShareResourceDialog
              resourceType="patient"
              resourceId={id}
              resourceName={patient.name}
              trigger={
                <Button variant="outline" size="icon" title="Partager ce patient" className="shrink-0">
                  <Share2 className="w-4 h-4" />
                </Button>
              }
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" className="shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce patient ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Toutes les données de ce patient seront supprimées.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Lien vers le traitement actif */}
        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate(`/patients/${id}/traitement-actif`)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ClipboardList className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Traitement actif</h3>
                  <p className="text-sm text-muted-foreground">
                    {activeTraitementName || "Aucun traitement sélectionné"}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <PatientCommentsCard
            comments={carePlan.comments}
            onChange={(value) => handleCarePlanChange("comments", value)}
            onBlur={handleAutoSave}
          />
        </div>

        <div className="mt-6">
          <PatientCareObjectivesCard
            carePlan={{
              motif_consultation: carePlan.motif_consultation,
              bilan_kine: carePlan.bilan_kine,
              objectifs_prise_en_charge: carePlan.objectifs_prise_en_charge,
              bilan_initial_date: carePlan.bilan_initial_date,
            }}
            onChange={handleCarePlanChange}
            onBlur={handleAutoSave}
            onBilanInitial={() => navigate(`/patients/${id}/bilan-initial`)}
            onCertificats={() => navigate(`/patients/${id}/certificats`)}
          />
        </div>

        {/* Antécédents Card */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-lg">Antécédents</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Antécédents médicaux, chirurgicaux, familiaux..."
              value={formData.antecedents || ""}
              onChange={(e) => setFormData({ ...formData, antecedents: e.target.value })}
              onBlur={handleAutoSave}
              className="min-h-[120px]"
            />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Informations du patient</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nom *</Label>
                <Input 
                  value={formData.name || ""} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  onBlur={handleAutoSave}
                />
              </div>
              <div>
                <Label>Numéro</Label>
                <Input value={patient.numero || "-"} disabled className="bg-muted" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Statut</Label>
                <Select value={formData.status || "active"} onValueChange={value => { setFormData({...formData, status: value}); setTimeout(handleAutoSave, 0); }}>
                  <SelectTrigger>
                    <SelectValue>{statusLabels[formData.status || "active"]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="in_treatment">En traitement</SelectItem>
                    <SelectItem value="waiting">En attente</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mutuelle</Label>
                <div className="flex items-center gap-3 h-10">
                  <Switch
                    checked={formData.has_mutual ?? false}
                    onCheckedChange={(checked) => { setFormData({...formData, has_mutual: checked}); setTimeout(handleAutoSave, 0); }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.has_mutual ? "Oui" : "Non"}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Séances restantes</Label>
                <Input 
                  type="number" 
                  min="0"
                  value={formData.remaining_sessions ?? 0} 
                  onChange={e => setFormData({...formData, remaining_sessions: parseInt(e.target.value) || 0})} 
                  onBlur={handleAutoSave}
                />
              </div>
              <div>
                <Label>Prescription</Label>
                <Select value={formData.prescription || "none"} onValueChange={value => { setFormData({...formData, prescription: value}); setTimeout(handleAutoSave, 0); }}>
                  <SelectTrigger>
                    <SelectValue>{prescriptionLabels[formData.prescription || "none"]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oui">Oui</SelectItem>
                    <SelectItem value="none">Non</SelectItem>
                    <SelectItem value="renouv_kine">Renouv. kiné</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <SelectTraitementDialog
          open={selectTraitementDialogOpen}
          onOpenChange={setSelectTraitementDialogOpen}
          onSelect={handleSelectTraitement}
          onCreate={handleCreateTraitement}
        />

        <TraitementFormDialog
          open={createTraitementDialogOpen}
          onOpenChange={setCreateTraitementDialogOpen}
          traitement={null}
          onSuccess={handleCreateTraitementSuccess}
          isHiddenFromList={true}
        />


        <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dupliquer ce patient</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Un nouveau patient sera créé avec les mêmes informations. Le numéro sera attribué automatiquement.
            </p>
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium">Informations générales</p>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="keepComments" 
                    checked={duplicateOptions.keepComments}
                    onCheckedChange={(checked) => setDuplicateOptions({...duplicateOptions, keepComments: !!checked})}
                  />
                  <Label htmlFor="keepComments">Conserver les commentaires</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="keepObjectives" 
                    checked={duplicateOptions.keepObjectives}
                    onCheckedChange={(checked) => setDuplicateOptions({...duplicateOptions, keepObjectives: !!checked})}
                  />
                  <Label htmlFor="keepObjectives">Conserver les objectifs de soins (motif, bilan, objectifs)</Label>
                </div>
              </div>
              <div className="space-y-3 pt-3 border-t">
                <p className="text-sm font-medium">Plan de traitement & séances</p>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="keepTraitement" 
                    checked={duplicateOptions.keepTraitement}
                    onCheckedChange={(checked) => setDuplicateOptions({...duplicateOptions, keepTraitement: !!checked})}
                  />
                  <Label htmlFor="keepTraitement">Conserver le plan de traitement actif</Label>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleDuplicate} disabled={duplicating} className="gradient-primary text-primary-foreground">
                {duplicating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Dupliquer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <PatientReportPrintDialog
          open={reportPrintDialogOpen}
          onOpenChange={setReportPrintDialogOpen}
          patient={{
            name: patient.name,
            numero: patient.numero,
            status: patient.status,
            has_mutual: patient.has_mutual,
            remaining_sessions: patient.remaining_sessions,
            prescription: patient.prescription,
            address: patient.address,
            postal_code: patient.postal_code,
            medical_notes: patient.medical_notes,
            allergies: patient.allergies,
            blood_type: patient.blood_type,
            antecedents: patient.antecedents,
          }}
          carePlan={{
            comments: carePlan.comments,
            motif_consultation: carePlan.motif_consultation,
            bilan_kine: carePlan.bilan_kine,
            objectifs_prise_en_charge: carePlan.objectifs_prise_en_charge,
          }}
          activeTraitementName={activeTraitementName}
          traitementSeances={traitementSeances}
          bilanInitialData={bilanInitialData}
          bilansIntermediaires={bilansIntermediaires}
        />
      </div>
    </Layout>
  );
}
