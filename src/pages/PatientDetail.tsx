import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Trash2, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) fetchPatient();
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

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    
    const { error } = await supabase
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
    
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Patient mis à jour" });
      fetchPatient();
    }
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

        <div className="grid gap-6">
          {/* Informations générales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations générales</CardTitle>
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
                  <Label>Groupe sanguin</Label>
                  <Select value={formData.blood_type || ""} onValueChange={value => setFormData({...formData, blood_type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Non renseigné" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Adresse */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Adresse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Adresse</Label>
                <Input 
                  value={formData.address || ""} 
                  onChange={e => setFormData({...formData, address: e.target.value})} 
                  placeholder="Rue, numéro..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Code postal</Label>
                  <Input 
                    value={formData.postal_code || ""} 
                    onChange={e => setFormData({...formData, postal_code: e.target.value})} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informations médicales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations médicales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>N° Mutuelle</Label>
                  <Input 
                    value={formData.mutual_number || ""} 
                    onChange={e => setFormData({...formData, mutual_number: e.target.value})} 
                  />
                </div>
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
              <div>
                <Label>Allergies</Label>
                <Textarea 
                  value={formData.allergies || ""} 
                  onChange={e => setFormData({...formData, allergies: e.target.value})} 
                  placeholder="Allergies connues..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Notes médicales</Label>
                <Textarea 
                  value={formData.medical_notes || ""} 
                  onChange={e => setFormData({...formData, medical_notes: e.target.value})} 
                  placeholder="Antécédents, remarques..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
