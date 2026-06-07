import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Trash2, User, Copy, History, Printer, Share2, ClipboardList, ChevronRight, AlertTriangle } from "lucide-react";
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
import { instantiateTraitementForPatient } from "@/lib/patientTraitement";
import { parseJsonField } from "@/lib/utils";

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
    try {
      const data = await pb.collection("patients").getOne(id as string);
      setPatient(data as any);
      setFormData(data as any);
    } catch(e: any) {
      toast({ title: "Patient non trouvé", variant: "destructive" });
      navigate("/patients");
    } finally { setLoading(false); }
  };

  const fetchCarePlan = async () => {
    const cpRes = await pb.collection("patient_care_plans").getList(1, 1, { filter: `patient = "${id}"` });
    const data: any = cpRes.items[0] ?? null;

    if (data) {
      setCarePlan({
        id: data.id,
        comments: data.comments || "",
        motif_consultation: data.motif_consultation || "",
        bilan_kine: data.bilan_kine || "",
        objectifs_prise_en_charge: data.objectifs_prise_en_charge || "",
        active_traitement_id: data.active_traitement ?? data.active_traitement_id,
        bilan_initial_date: data.bilan_initial_date || null,
        traitement_start_date: data.traitement_start_date || null,
      });

      // Parse bilan initial data
      // PB SDK renvoie un objet (champ "json"), mais d'anciens records peuvent être en string.
      const parsedBilan = parseJsonField<Record<string, any>>(data.bilan_initial_data);
      setBilanInitialData(parsedBilan);
      
      // Treatment summary is loaded from the patient instance below (independent of care_plan).
    } else {
      setBilanInitialData(null);
    }

    // Load the patient's active treatment INSTANCE (patient_traitements), independent of care_plan
    try {
      const ptRes = await pb.collection("patient_traitements").getList(1, 1, {
        filter: `patient = "${id}" && statut = "actif"`, sort: "-created",
      });
      const pt: any = ptRes.items[0] ?? null;
      if (pt) {
        setActiveTraitementName(pt.pathologie || pt.nom || null);
        const ps = await pb.collection("patient_seances").getFullList({
          filter: `patient_traitement = "${pt.id}"`, sort: "created",
        });
        setTraitementSeances(ps.map((s: any, i: number) => ({
          ordre: i + 1,
          seance_date: s.date_prevue || null,
          objectifs_principaux: s.objectif ? [s.objectif] : [],
          objectifs_secondaires: [],
          pathologies: [],
        })));
        const bilansData = await pb.collection("patient_bilans").getFullList({
          filter: `patient_traitement = "${pt.id}"`, sort: "position_after_seance",
          fields: "id,position_after_seance,bilan_date,content",
        });
        setBilansIntermediaires(bilansData as any[]);
      } else {
        setActiveTraitementName(null);
        setTraitementSeances([]);
        setBilansIntermediaires([]);
      }
    } catch {
      setActiveTraitementName(null);
      setTraitementSeances([]);
      setBilansIntermediaires([]);
    }
  };


  const handleSave = async () => {
    if (!id || !user) return;
    setSaving(true);
    
    // Save patient data
    try {
      await pb.collection("patients").update(id as string, {
        name: formData.name, status: formData.status,
        mutuelle: formData.has_mutual ?? false, seances_restantes: formData.remaining_sessions,
        prescription: formData.prescription, address: formData.address,
        postal_code: formData.postal_code, medical_notes: formData.medical_notes,
        allergies: formData.allergies, blood_type: formData.blood_type, antecedents: formData.antecedents,
      });
    } catch(e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); setSaving(false); return; }

    // Save or update care plan
    if (carePlan.id) {
      await pb.collection("patient_care_plans").update(carePlan.id, {
        comments: carePlan.comments, motif_consultation: carePlan.motif_consultation,
        bilan_kine: carePlan.bilan_kine, objectifs_prise_en_charge: carePlan.objectifs_prise_en_charge,
        active_traitement: carePlan.active_traitement_id,
        bilan_initial_date: carePlan.bilan_initial_date, traitement_start_date: carePlan.traitement_start_date,
      });
    } else {
      const newPlan = await pb.collection("patient_care_plans").create({
        patient: id, user: user.id,
        comments: carePlan.comments, motif_consultation: carePlan.motif_consultation,
        bilan_kine: carePlan.bilan_kine, objectifs_prise_en_charge: carePlan.objectifs_prise_en_charge,
        active_traitement: carePlan.active_traitement_id,
        bilan_initial_date: carePlan.bilan_initial_date, traitement_start_date: carePlan.traitement_start_date,
      });
      if (newPlan) setCarePlan({ ...carePlan, id: newPlan.id });
    }

    toast({ title: "Patient mis à jour" });
    fetchPatient();
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    
    try {
      await pb.collection("patients").delete(id);
      toast({ title: "Patient supprimé" });
      navigate("/patients");
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleDuplicate = async () => {
    if (!patient || !user) return;
    setDuplicating(true);

    try {
      // Create new patient with same data (except numero)
      const newPatient = await pb.collection("patients").create({
          user: user.id,
          name: `${patient.name} (copie)`,
          status: patient.status,
          mutuelle: patient.has_mutual,
          seances_restantes: patient.remaining_sessions,
          prescription: patient.prescription,
          address: patient.address,
          postal_code: patient.postal_code,
          medical_notes: patient.medical_notes,
          allergies: patient.allergies,
          blood_type: patient.blood_type,
          antecedents: patient.antecedents,
        });

      // Copy care plan if options selected
      if (duplicateOptions.keepComments || duplicateOptions.keepObjectives || duplicateOptions.keepTraitement) {
        await pb.collection("patient_care_plans").create({
          patient: newPatient.id,
          user: user.id,
          comments: duplicateOptions.keepComments ? carePlan.comments : "",
          motif_consultation: duplicateOptions.keepObjectives ? carePlan.motif_consultation : "",
          bilan_kine: duplicateOptions.keepObjectives ? carePlan.bilan_kine : "",
          objectifs_prise_en_charge: duplicateOptions.keepObjectives ? carePlan.objectifs_prise_en_charge : "",
          active_traitement: duplicateOptions.keepTraitement ? carePlan.active_traitement_id : null,
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
    try { await pb.collection("patients").update(id as string, {
      name: formData.name, status: formData.status,
      mutuelle: formData.has_mutual ?? false, seances_restantes: formData.remaining_sessions,
      prescription: formData.prescription, address: formData.address, postal_code: formData.postal_code,
      medical_notes: formData.medical_notes, allergies: formData.allergies,
      blood_type: formData.blood_type, antecedents: formData.antecedents,
    }); } catch {}

    // Save or update care plan
    if (carePlan.id) {
      try { await pb.collection("patient_care_plans").update(carePlan.id, {
        comments: carePlan.comments, motif_consultation: carePlan.motif_consultation,
        bilan_kine: carePlan.bilan_kine, objectifs_prise_en_charge: carePlan.objectifs_prise_en_charge,
        active_traitement: carePlan.active_traitement_id,
        bilan_initial_date: carePlan.bilan_initial_date, traitement_start_date: carePlan.traitement_start_date,
      }); } catch {}
    } else {
      try {
        const newPlan = await pb.collection("patient_care_plans").create({
          patient: id, user: user.id,
          comments: carePlan.comments, motif_consultation: carePlan.motif_consultation,
          bilan_kine: carePlan.bilan_kine, objectifs_prise_en_charge: carePlan.objectifs_prise_en_charge,
          active_traitement: carePlan.active_traitement_id,
          bilan_initial_date: carePlan.bilan_initial_date, traitement_start_date: carePlan.traitement_start_date,
        });
        if (newPlan) setCarePlan(prev => ({ ...prev, id: newPlan.id }));
      } catch {}
    }
  };

  // Assign an existing template: instantiate it as an independent patient instance
  const handleSelectTraitement = async (traitementId: string) => {
    if (!user || !id) return;
    try {
      await instantiateTraitementForPatient(traitementId, id, user.id);
      toast({ title: "Traitement enregistré" });
      fetchPatient();
    } catch {
      toast({ title: "Erreur lors de l'enregistrement", variant: "destructive" });
    }
  };

  const handleCreateTraitement = () => {
    setSelectTraitementDialogOpen(false);
    setCreateTraitementDialogOpen(true);
  };

  // The form dialog (patientId mode) creates the instance; just refresh.
  const handleCreateTraitementSuccess = async () => {
    fetchPatient();
  };

  const handleRemoveTraitement = async () => {
    if (!id) return;
    try {
      const ptRes = await pb.collection("patient_traitements").getList(1, 1, {
        filter: `patient = "${id}" && statut = "actif"`, sort: "-created",
      });
      if (ptRes.items[0]) await pb.collection("patient_traitements").delete(ptRes.items[0].id);
    } catch {}
    setActiveTraitementName(null);
    setTraitementSeances([]);
    setBilansIntermediaires([]);
    toast({ title: "Traitement retiré" });
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

        {/* Antécédents & Allergies Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
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

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <CardTitle className="text-lg">Allergies</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Allergies médicamenteuses, alimentaires, environnementales..."
                value={formData.allergies || ""}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                onBlur={handleAutoSave}
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>
        </div>

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
          patientId={id}
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
