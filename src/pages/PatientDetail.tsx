import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Trash2, User, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { PatientCommentsCard } from "@/components/patient/PatientCommentsCard";
import { PatientCareObjectivesCard } from "@/components/patient/PatientCareObjectivesCard";
import { PatientSeancesCard } from "@/components/patient/PatientSeancesCard";
import { ImportTraitementDialog } from "@/components/patient/ImportTraitementDialog";
import { ImportSeanceDialog } from "@/components/patient/ImportSeanceDialog";

interface PatientData {
  id: string;
  name: string;
  numero: string | null;
  status: string;
  mutual_number: string | null;
  remaining_sessions: number | null;
  prescription: string | null;
  address: string | null;
  postal_code: string | null;
  medical_notes: string | null;
  allergies: string | null;
  blood_type: string | null;
  created_at: string;
}

interface CarePlanData {
  id?: string;
  comments: string;
  motif_consultation: string;
  bilan_kine: string;
  objectifs_prise_en_charge: string;
  active_traitement_id: string | null;
}

interface PatientSeance {
  id: string;
  seance_type_id: string;
  ordre: number;
  seance_type?: {
    pathologie: string;
    objectif_principal: string;
  };
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
  });
  const [patientSeances, setPatientSeances] = useState<PatientSeance[]>([]);
  const [activeTraitementName, setActiveTraitementName] = useState<string | null>(null);
  
  const [importTraitementOpen, setImportTraitementOpen] = useState(false);
  const [importSeanceOpen, setImportSeanceOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateOptions, setDuplicateOptions] = useState({
    keepComments: true,
    keepObjectives: true,
    keepTraitement: true,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchPatient();
      fetchCarePlan();
      fetchPatientSeances();
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
      .select("*")
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
      });
      
      if (data.active_traitement_id) {
        const { data: traitement } = await supabase
          .from("traitement_types")
          .select("pathologie")
          .eq("id", data.active_traitement_id)
          .maybeSingle();
        
        if (traitement) {
          setActiveTraitementName(traitement.pathologie);
        }
      }
    }
  };

  const fetchPatientSeances = async () => {
    const { data, error } = await supabase
      .from("patient_seances")
      .select(`
        id,
        seance_type_id,
        ordre,
        seance_type:seance_types(pathologie, objectif_principal)
      `)
      .eq("patient_id", id)
      .order("ordre", { ascending: true });
    
    if (data) {
      const formattedData = data.map((item: any) => ({
        id: item.id,
        seance_type_id: item.seance_type_id,
        ordre: item.ordre,
        seance_type: item.seance_type,
      }));
      setPatientSeances(formattedData);
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
        mutual_number: formData.mutual_number,
        remaining_sessions: formData.remaining_sessions,
        prescription: formData.prescription,
        address: formData.address,
        postal_code: formData.postal_code,
        medical_notes: formData.medical_notes,
        allergies: formData.allergies,
        blood_type: formData.blood_type,
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
          mutual_number: patient.mutual_number,
          remaining_sessions: patient.remaining_sessions,
          prescription: patient.prescription,
          address: patient.address,
          postal_code: patient.postal_code,
          medical_notes: patient.medical_notes,
          allergies: patient.allergies,
          blood_type: patient.blood_type,
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

  const handleSelectTraitement = async (traitementId: string) => {
    setCarePlan({ ...carePlan, active_traitement_id: traitementId });
    
    const { data: traitement } = await supabase
      .from("traitement_types")
      .select("pathologie")
      .eq("id", traitementId)
      .maybeSingle();
    
    if (traitement) {
      setActiveTraitementName(traitement.pathologie);
    }
  };

  const handleImportSeance = async (seanceTypeId: string) => {
    if (!id || !user) return;
    
    const nextOrdre = patientSeances.length;
    
    const { error } = await supabase.from("patient_seances").insert({
      patient_id: id,
      seance_type_id: seanceTypeId,
      user_id: user.id,
      ordre: nextOrdre,
    });
    
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Séance importée" });
      fetchPatientSeances();
    }
  };

  const handleDeleteSeance = async (seanceId: string) => {
    const { error } = await supabase.from("patient_seances").delete().eq("id", seanceId);
    
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Séance supprimée" });
      fetchPatientSeances();
    }
  };

  const handleEditSeance = (seance: PatientSeance) => {
    if (seance.seance_type_id) {
      navigate(`/seance-type/${seance.seance_type_id}`);
    }
  };

  const handleCreateSeance = () => {
    navigate("/seance-type/new");
  };

  const handleCreateTraitement = () => {
    navigate("/traitement-type/new");
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/patients")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <User className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">{patient.name}</h1>
              <p className="text-muted-foreground">Patient #{patient.numero || "-"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setDuplicateDialogOpen(true)}
              title="Dupliquer ce patient"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Enregistrer
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
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

        <Card>
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
                <Select value={formData.status || "active"} onValueChange={value => setFormData({...formData, status: value})}>
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
                <Label>N° Mutuelle</Label>
                <Input 
                  value={formData.mutual_number || ""} 
                  onChange={e => setFormData({...formData, mutual_number: e.target.value})} 
                />
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
                />
              </div>
              <div>
                <Label>Prescription</Label>
                <Select value={formData.prescription || "none"} onValueChange={value => setFormData({...formData, prescription: value})}>
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

        <div className="mt-6">
          <PatientCommentsCard
            comments={carePlan.comments}
            onChange={(value) => handleCarePlanChange("comments", value)}
          />
        </div>

        <div className="mt-6">
          <PatientCareObjectivesCard
            carePlan={{
              motif_consultation: carePlan.motif_consultation,
              bilan_kine: carePlan.bilan_kine,
              objectifs_prise_en_charge: carePlan.objectifs_prise_en_charge,
            }}
            onChange={handleCarePlanChange}
            onImportTraitement={() => setImportTraitementOpen(true)}
            onCreateTraitement={handleCreateTraitement}
            activeTraitementName={activeTraitementName}
          />
        </div>

        <div className="mt-6">
          <PatientSeancesCard
            seances={patientSeances}
            onImportSeance={() => setImportSeanceOpen(true)}
            onCreateSeance={handleCreateSeance}
            onEditSeance={handleEditSeance}
            onDeleteSeance={handleDeleteSeance}
          />
        </div>

        <ImportTraitementDialog
          open={importTraitementOpen}
          onOpenChange={setImportTraitementOpen}
          onSelect={handleSelectTraitement}
        />

        <ImportSeanceDialog
          open={importSeanceOpen}
          onOpenChange={setImportSeanceOpen}
          onSelect={handleImportSeance}
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
      </div>
    </Layout>
  );
}
