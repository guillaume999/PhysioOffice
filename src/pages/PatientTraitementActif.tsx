import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PatientTraitementCard } from "@/components/patient/PatientTraitementCard";
import { SelectTraitementDialog } from "@/components/patient/SelectTraitementDialog";
import { TraitementFormDialog } from "@/components/traitement/TraitementFormDialog";

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
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    
    if (patientError || !patient) {
      toast({ title: "Patient non trouvé", variant: "destructive" });
      navigate("/patients");
      return;
    }
    
    setPatientName(patient.name);
    
    // Fetch care plan
    const { data: carePlan } = await supabase
      .from("patient_care_plans")
      .select("id, active_traitement_id")
      .eq("patient_id", id)
      .maybeSingle();
    
    if (carePlan) {
      setCarePlanId(carePlan.id);
      setActiveTraitementId(carePlan.active_traitement_id);
      
      if (carePlan.active_traitement_id) {
        const { data: traitement } = await supabase
          .from("traitement_types")
          .select("pathologie")
          .eq("id", carePlan.active_traitement_id)
          .maybeSingle();
        
        if (traitement) {
          setActiveTraitementName(traitement.pathologie);
        }
      }
    }
    
    setLoading(false);
  };

  const handleSelectTraitement = async (traitementId: string) => {
    if (!user || !id) return;
    
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
    if (carePlanId) {
      await supabase
        .from("patient_care_plans")
        .update({ active_traitement_id: traitementId })
        .eq("id", carePlanId);
    } else {
      const { data: newPlan } = await supabase
        .from("patient_care_plans")
        .insert({
          patient_id: id,
          user_id: user.id,
          active_traitement_id: traitementId,
        })
        .select()
        .single();
      
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
    
    const { data: latestTraitement } = await supabase
      .from("traitement_types")
      .select("id, pathologie")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestTraitement) {
      await handleSelectTraitement(latestTraitement.id);
    }
  };

  const handleRemoveTraitement = async () => {
    setActiveTraitementId(null);
    setActiveTraitementName(null);
    
    if (carePlanId) {
      await supabase
        .from("patient_care_plans")
        .update({ active_traitement_id: null })
        .eq("id", carePlanId);
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
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/patients/${id}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg md:text-2xl font-display font-bold">Traitement actif</h1>
            <p className="text-sm text-muted-foreground">{patientName}</p>
          </div>
        </div>

        <PatientTraitementCard
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
      </div>
    </Layout>
  );
}
