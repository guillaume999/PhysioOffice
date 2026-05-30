import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Printer, Trash2, FileText, Edit, Save, X, BookTemplate, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Certificat {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface CertificatModel {
  id: string;
  title: string;
  content: string;
  is_platform: boolean;
  user_id: string;
}

export default function PatientCertificats() {
  const { id: patientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patientName, setPatientName] = useState("");
  const [certificats, setCertificats] = useState<Certificat[]>([]);
  const [models, setModels] = useState<CertificatModel[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingCertificat, setPrintingCertificat] = useState<Certificat | null>(null);
  const [includeDate, setIncludeDate] = useState(true);
  const [includePatientName, setIncludePatientName] = useState(true);

  useEffect(() => {
    if (patientId && user) {
      fetchPatientAndCertificats();
      fetchModels();
    }
  }, [patientId, user]);

  const fetchPatientAndCertificats = async () => {
    try {
      try { const patient = await pb.collection("patients").getOne(patientId, { fields: "name" }); setPatientName(patient.name); } catch {}

      const notes = await pb.collection("notes").getFullList({
        filter: `patient = "${patientId}"`, sort: "-created",
      });
      setCertificats(notes.map((note: any) => ({
        id: note.id, title: note.title, content: note.content || "", created_at: note.created,
      })));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      setModels(await pb.collection("certificat_models").getFullList({ sort: "-is_platform,title" }) as any[]);
    } catch (error) {
      console.error("Error fetching models:", error);
    }
  };

  const handleAddCertificat = async () => {
    if (!newTitle.trim() || !user) return;

    try {
      const data = await pb.collection("notes").create({
          title: newTitle, content: newContent, patient: patientId, user: user.id,
        });
      setCertificats([
        {
          id: data.id,
          title: data.title,
          content: data.content || "",
          created_at: data.created,
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
      await pb.collection("notes").delete(id);

      setCertificats(certificats.filter((c) => c.id !== id));
      toast.success("Certificat supprimé");
    } catch (error) {
      console.error("Error deleting certificat:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleStartEdit = (certificat: Certificat) => {
    setEditingId(certificat.id);
    setEditTitle(certificat.title);
    setEditContent(certificat.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;

    try {
      await pb.collection("notes").update(editingId, { title: editTitle, content: editContent });

      setCertificats(
        certificats.map((c) =>
          c.id === editingId
            ? { ...c, title: editTitle, content: editContent }
            : c
        )
      );
      setEditingId(null);
      setEditTitle("");
      setEditContent("");
      toast.success("Certificat modifié");
    } catch (error) {
      console.error("Error updating certificat:", error);
      toast.error("Erreur lors de la modification");
    }
  };

  const handleSelectModel = (model: CertificatModel) => {
    setNewTitle(model.title);
    setNewContent(model.content);
    toast.success("Modèle appliqué");
  };

  const handleSaveAsModel = async (certificat: Certificat) => {
    if (!user) return;

    try {
      await pb.collection("certificat_models").create({
        user: user.id,
        title: certificat.title,
        content: certificat.content,
        is_platform: false,
      });

      await fetchModels();
      toast.success("Certificat enregistré comme modèle");
    } catch (error) {
      console.error("Error saving as model:", error);
      toast.error("Erreur lors de l'enregistrement du modèle");
    }
  };

  const openPrintDialog = (certificat: Certificat) => {
    setPrintingCertificat(certificat);
    setPrintDialogOpen(true);
  };

  const handlePrint = () => {
    if (!printingCertificat) return;
    
    const escapeHtml = (str: string) =>
      str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const patientSection = includePatientName 
      ? `<div class="patient-info">Patient : ${escapeHtml(patientName || "")}</div>` 
      : "";
    const dateSection = includeDate 
      ? `<div class="date">Date : ${new Date(printingCertificat.created_at).toLocaleDateString("fr-FR")}</div>` 
      : "";

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${printingCertificat.title}</title>
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
          <h1>${escapeHtml(printingCertificat.title)}</h1>
          ${patientSection}
          <div class="content">${escapeHtml(printingCertificat.content)}</div>
          ${dateSection}
          <div class="signature">Signature :</div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    setPrintDialogOpen(false);
    setPrintingCertificat(null);
  };

  const userModels = models.filter((m) => !m.is_platform && m.user_id === user?.id);
  const platformModels = models.filter((m) => m.is_platform);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Certificats & Constats</h1>
              <p className="text-muted-foreground">{patientName}</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <BookTemplate className="w-4 h-4 mr-2" />
                Modèles
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {platformModels.length > 0 && (
                <>
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    Modèles plateforme
                  </DropdownMenuLabel>
                  {platformModels.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => handleSelectModel(model)}
                    >
                      {model.title}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              {userModels.length > 0 && (
                <>
                  <DropdownMenuLabel>Mes modèles</DropdownMenuLabel>
                  {userModels.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => handleSelectModel(model)}
                    >
                      {model.title}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {platformModels.length === 0 && userModels.length === 0 && (
                <DropdownMenuItem disabled>
                  Aucun modèle disponible
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
                {editingId === certificat.id ? (
                  <>
                    <CardHeader>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Titre du certificat"
                      />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Contenu du certificat"
                        className="min-h-[150px]"
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleSaveEdit} size="sm">
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleCancelEdit}
                          size="sm"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Annuler
                        </Button>
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                      <div>
                        <CardTitle className="text-base">
                          {certificat.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {new Date(certificat.created_at).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleSaveAsModel(certificat)}
                          title="Enregistrer comme modèle"
                        >
                          <BookTemplate className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleStartEdit(certificat)}
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openPrintDialog(certificat)}
                          title="Imprimer"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteCertificat(certificat.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">
                        {certificat.content}
                      </p>
                    </CardContent>
                  </>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Dialogue d'options d'impression */}
        <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Options d'impression</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="includePatientName"
                  checked={includePatientName}
                  onCheckedChange={(checked) => setIncludePatientName(checked === true)}
                />
                <Label htmlFor="includePatientName" className="cursor-pointer">
                  Inclure le nom du patient
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="includeDate"
                  checked={includeDate}
                  onCheckedChange={(checked) => setIncludeDate(checked === true)}
                />
                <Label htmlFor="includeDate" className="cursor-pointer">
                  Inclure la date
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
