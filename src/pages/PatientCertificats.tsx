import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Printer, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Certificat {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function PatientCertificats() {
  const { id: patientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patientName, setPatientName] = useState("");
  const [certificats, setCertificats] = useState<Certificat[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (patientId && user) {
      fetchPatientAndCertificats();
    }
  }, [patientId, user]);

  const fetchPatientAndCertificats = async () => {
    try {
      // Fetch patient name
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", patientId)
        .single();

      if (patient) {
        setPatientName(patient.name);
      }

      // Fetch notes linked to this patient (used as certificats)
      const { data: notes, error } = await supabase
        .from("notes")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCertificats(
        notes?.map((note) => ({
          id: note.id,
          title: note.title,
          content: note.content || "",
          created_at: note.created_at,
        })) || []
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCertificat = async () => {
    if (!newTitle.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          title: newTitle,
          content: newContent,
          patient_id: patientId,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCertificats([
        {
          id: data.id,
          title: data.title,
          content: data.content || "",
          created_at: data.created_at,
        },
        ...certificats,
      ]);
      setNewTitle("");
      setNewContent("");
      toast.success("Certificat ajouté");
    } catch (error) {
      console.error("Error adding certificat:", error);
      toast.error("Erreur lors de l'ajout du certificat");
    }
  };

  const handleDeleteCertificat = async (id: string) => {
    try {
      const { error } = await supabase.from("notes").delete().eq("id", id);

      if (error) throw error;

      setCertificats(certificats.filter((c) => c.id !== id));
      toast.success("Certificat supprimé");
    } catch (error) {
      console.error("Error deleting certificat:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handlePrint = (certificat: Certificat) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${certificat.title}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              text-align: center;
              margin-bottom: 30px;
              font-size: 24px;
            }
            .patient-info {
              margin-bottom: 20px;
              font-weight: bold;
            }
            .content {
              white-space: pre-wrap;
              line-height: 1.6;
              margin-top: 30px;
            }
            .date {
              margin-top: 40px;
              text-align: right;
            }
            .signature {
              margin-top: 60px;
              text-align: right;
            }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <h1>${certificat.title}</h1>
          <div class="patient-info">Patient : ${patientName}</div>
          <div class="content">${certificat.content}</div>
          <div class="date">Date : ${new Date(certificat.created_at).toLocaleDateString("fr-FR")}</div>
          <div class="signature">Signature :</div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Certificats & Constats</h1>
            <p className="text-muted-foreground">{patientName}</p>
          </div>
        </div>

        {/* Nouveau certificat */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Nouveau certificat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Titre</Label>
              <Input
                placeholder="Ex: Certificat médical, Constat de blessure..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Contenu</Label>
              <Textarea
                placeholder="Rédigez le contenu du certificat..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="mt-1 min-h-[150px]"
              />
            </div>
            <Button onClick={handleAddCertificat} disabled={!newTitle.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter le certificat
            </Button>
          </CardContent>
        </Card>

        {/* Liste des certificats */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Certificats existants</h2>
          {certificats.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucun certificat pour ce patient</p>
              </CardContent>
            </Card>
          ) : (
            certificats.map((certificat) => (
              <Card key={certificat.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">{certificat.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date(certificat.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePrint(certificat)}
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteCertificat(certificat.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{certificat.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
