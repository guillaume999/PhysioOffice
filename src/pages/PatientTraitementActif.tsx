import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CalendarPlus, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";
import { PatientTraitementInstanceCard } from "@/components/patient/PatientTraitementInstanceCard";
import { SelectTraitementDialog } from "@/components/patient/SelectTraitementDialog";
import { TraitementFormDialog } from "@/components/traitement/TraitementFormDialog";
import { QuickAppointmentsDialog } from "@/components/patient/QuickAppointmentsDialog";
import { instantiateTraitementForPatient } from "@/lib/patientTraitement";

export default function PatientTraitementActif() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTraitementId, setActiveTraitementId] = useState<string | null>(null);
  const [selectTraitementDialogOpen, setSelectTraitementDialogOpen] = useState(false);
  const [createTraitementDialogOpen, setCreateTraitementDialogOpen] = useState(false);
  const [quickApptOpen, setQuickApptOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) fetchData();
  }, [user, id]);

  const fetchData = async () => {
    setLoading(true);

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

    // Load the patient's active treatment instance (most recent active one)
    try {
      const res = await pb.collection("patient_traitements").getList(1, 1, {
        filter: `patient = "${id}" && statut = "actif"`,
        sort: "-created",
      });
      setActiveTraitementId(res.items[0]?.id ?? null);
    } catch {
      setActiveTraitementId(null);
    }

    setLoading(false);
  };

  // Assign an existing template: instantiate it as an independent patient instance
  const handleSelectTraitement = async (templateId: string) => {
    if (!user || !id) return;
    try {
      const pt = await instantiateTraitementForPatient(templateId, id, user.id);
      setActiveTraitementId(pt.id);
      toast({ title: "Traitement enregistré" });
    } catch (e) {
      console.error("Error instantiating traitement:", e);
      toast({ title: "Erreur lors de l'enregistrement", variant: "destructive" });
    }
  };

  const handleCreateTraitement = () => {
    setSelectTraitementDialogOpen(false);
    setCreateTraitementDialogOpen(true);
  };

  // After creating a blank/custom instance via the form dialog, pick it up
  const handleCreateTraitementSuccess = async () => {
    if (!user || !id) return;
    try {
      const res = await pb.collection("patient_traitements").getList(1, 1, {
        filter: `patient = "${id}"`, sort: "-created",
      });
      if (res.items[0]) setActiveTraitementId(res.items[0].id);
    } catch { /* ignore */ }
  };

  const handleRemoveTraitement = async () => {
    if (!activeTraitementId) return;
    try {
      await pb.collection("patient_traitements").delete(activeTraitementId);
    } catch { /* ignore */ }
    setActiveTraitementId(null);
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

        {!activeTraitementId && (
          <div className="flex items-center justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => setSelectTraitementDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </div>
        )}

        <PatientTraitementInstanceCard
          key={`${activeTraitementId}-${refreshKey}`}
          traitementId={activeTraitementId}
          patientId={id || ""}
          praticienId={user?.id || ""}
          onRemove={handleRemoveTraitement}
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
          patientId={id}
        />

        <QuickAppointmentsDialog
          open={quickApptOpen}
          onOpenChange={setQuickApptOpen}
          patientId={id || ""}
          patientName={patientName}
          traitementId={activeTraitementId}
          onCreated={() => setR