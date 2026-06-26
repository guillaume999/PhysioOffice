import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { softDelete, withActive } from "@/lib/corbeille";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, CalendarPlus, Plus, User, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";
import { PatientTraitementInstanceCardV2 } from "@/components/patient/PatientTraitementInstanceCardV2";
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
        filter: withActive(`patient = "${id}" && statut = "actif"`),
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
        filter: withActive(`patient = "${id}"`), sort: "-created",
      });
      if (res.items[0]) setActiveTraitementId(res.items[0].id);
    } catch { /* ignore */ }
  };

  const handleRemoveTraitement = async () => {
    if (!activeTraitementId) return;
    try {
      await softDelete("patient_traitements", activeTraitementId);
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
      <div className="container mx-auto px-1 sm:px-4 py-4 md:py-8 max-w-6xl">
        <div className="sticky top-16 z-10 bg-background/95 backdrop-blur-sm -mx-1 sm:-mx-4 px-1 sm:px-4 py-3 mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/patients")}>
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

        {/* Lien vers la fiche patient */}
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors mb-6"
          onClick={() => navigate(`/patients/${id}/details`)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <User className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-medium">Fiche patient</h3>
                  <p className="text-sm text-muted-foreground">
                    Informations, objectifs, bilans, certificats
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {!activeTraitementId && (
          <div className="flex items-center justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => setSelectTraitementDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <PatientTraitementInstanceCardV2
              key={`v2-${activeTraitementId}-${refreshKey}`}
              traitementId={activeTraitementId}
              patientId={id || ""}
              praticienId={user?.id || ""}
              onRemove={handleRemoveTraitement}
            />
          </div>
        </div>

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
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </Layout>
  );
}
