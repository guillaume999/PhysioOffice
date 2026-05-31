import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CalendarPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";
import { PatientTraitementCard } from "@/components/patient/PatientTraitementCard";
import { SelectTraitementDialog } from "@/components/patient/SelectTraitementDialog";
import { TraitementFormDialog } from "@/components/traitement/TraitementFormDialog";
import { QuickAppointmentsDialog } from "@/components/patient/QuickAppointmentsDialog";

export default function PatientTraitementActif() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [carePlanId, setCarePlanId] = useState<string | null>(null);
  const [activeTraitementId, setActiveTraitementId] = useState<string | null>(null);
  const [activeTraitementName, setActiveTraitementName] = useState<string | null>(null);
  const [selectTraitementDialogOpen, setSelectTraitementDialogOpen] = useState(false);
  const [createTraitementDialogOpen, setCreateTraitementDialogOpen] = useState(false);
  const [quickApptOpen, setQuickApptOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchData();
    }
  }, [user, id]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch patient
    let patient: any = null;
    try {
      patient = await pb.collection("patients").getOne(id!, { fields: "id,name" });
    } catch { /* ignore */ }

    if (!patient) {
      toast({ title: "Patient non trouvé", variant: "destructive" });
      navigate("/patients");
      return;
    }

    setPatientName(patient.name);

    // Fetch care plan
    let carePlan: any = null;
    try {
      carePlan = await pb.collection("patient_care_plans").getFirstListItem(`patient = "${id}"`);
    } catch { /* none yet */ }

    if (carePlan) {
      const activeTraitement = carePlan.active_traitement ?? carePlan.active_traitement_id ?? null;
      setCarePlanId(carePlan.id);
      setActiveTraitementId(activeTraitement);

      if (activeTraitement) {
        try {
          const traitement = await pb.collection("traitement_types").getOne(activeTraitement, { fields: "pathologie" });
          if (traitement) setActiveTraitementName(traitement.pathologie);
        } catch { /* ignore */ }
      }
    }

    setLoading(false);
  };

  const handleSelectTraitement = async (traitementId: string) => {
    if (!user || !id) return;
    
    // Set the treatment visibility to hidden by default when assigned to a patient
    try {
      await pb.collection("traitement_types").update(traitementId, { is_hidden_from_list: true });
    } catch { /* ignore */ }

    try {
      const traitement = await pb.collection("traitement_types").getOne(traitementId, { fields: "pathologie" });
      if (traitement) setActiveTraitementName(traitement.pathologie);
    } catch { /* ignore */ }

    // Auto-save the care plan with the new treatment
    if (carePlanId) {
      await pb.collection("patient_care_plans").update(carePlanId, { active_traitement: traitementId });
    } else {
      const newPlan = await pb.collection("patient_care_plans").create({
        patient: id,
        user: user.id,
        active_traitement: traitementId,
      });
      if (newPlan) {
        setCarePlanId(newPlan.id);
      }
    }
    
    setActiveTraitementId(traitementId);
    toast({ title: "Traitement enregistré" });
  };

  const handleCreateTraitement = () => {
    setSelectTraitementDialogOpen(false);
    setCreateTraitementDialogOpen(true);
  };

  const handleCreateTraitementSuccess = async () => {
    if (!user) return;
    
    let latestTraitement: any = null;
    try {
      const res = await pb.collection("traitement_types").getList(1, 1, {
        filter: `user = "${user.id}"`,
        sort: "-created",
      });
      latestTraitement = res.items[0] ?? null;
    } catch { /* ignore */ }

    if (latestTraitement) {
      await handleSelectTraitement(latestTraitement.id);
    }
  };

  const handleRemoveTraitement = async () => {
    setActiveTraitementId(null);
    setActiveTraitementName(null);
    
    if (carePlanId) {
      await pb.collection("patient_care_plans").update(carePlanId, { active_traitement: null });
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

  return (
    <Layout>
      <div className="container mx-auto px-1 sm:px-4 py-4 md:py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/patients/${id}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg md:text-2xl font-display font-bold">Traitement actif</h1>
            <p className="text-sm text-muted-foreground">{patientName}</p>
          </div>
          <Button onClick={() => setQuickApptOpen(true)} size="sm" className="gap-2">
            <CalendarPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Ajouter des rendez-vous</span>
          </Button>
        </div>

        <PatientTraitementCard
          key={refreshKey}
          activeTraitementId={activeTraitementId}
          activeTraitementName={activeTraitementName}
          patientId={id || ""}
          patientName={patientName}
          onSelectTraitement={() => setSelectTraitementDialogOpen(true)}
          onRemoveTraitement={handleRemoveTraitement}
          onTraitementChanged={handleSelectTraitement}
        />

        <SelectTraitementDialog
          open={selectTraitementDialogOpen}
          onOpenChange={setSelectTraitementDialogOpen}
          onSelect={handleSelectTraitement}
          onCreate={handleCreateTraitement}
        />

        <TraitementFormDialog
          open={createTraitementDialogOpen}
          onOpenChange={setCreateTraitementDialogOpen}
          onSuccess={handleCreateTraitementSuccess}
        />

        <QuickAppointmentsDialog
          open={quickApptOpen}
          onOpenChange={setQuickApptOpen}
          patientId={id || ""}
          patientName={patientName}
          traitementId={activeTraitementId}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </Layout>
  );
}
