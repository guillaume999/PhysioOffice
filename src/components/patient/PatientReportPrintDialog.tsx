import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer, Eye } from "lucide-react";

interface PatientReportPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
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
  };
  carePlan: {
    comments: string;
    motif_consultation: string;
    bilan_kine: string;
    objectifs_prise_en_charge: string;
  };
  activeTraitementName: string | null;
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

export function PatientReportPrintDialog({
  open,
  onOpenChange,
  patient,
  carePlan,
  activeTraitementName,
}: PatientReportPrintDialogProps) {
  const [options, setOptions] = useState({
    includePatientInfo: true,
    includeStatus: true,
    includeMutual: true,
    includeRemainingSessions: true,
    includePrescription: true,
    includeAddress: true,
    includeMedicalNotes: true,
    includeAllergies: true,
    includeBloodType: true,
    includeAntecedents: true,
    includeComments: true,
    includeMotifConsultation: true,
    includeBilanKine: true,
    includeObjectifs: true,
    includeTraitement: true,
    includeDate: true,
  });

  const toggleOption = (key: keyof typeof options) => {
    setOptions({ ...options, [key]: !options[key] });
  };

  const generatePreviewContent = () => {
    const sections: string[] = [];
    
    if (options.includePatientInfo) {
      sections.push(`<h2 class="section-title">Informations patient</h2>`);
      sections.push(`<p><strong>Nom :</strong> ${patient.name}</p>`);
      if (patient.numero) {
        sections.push(`<p><strong>N° Patient :</strong> ${patient.numero}</p>`);
      }
    }

    if (options.includeStatus) {
      sections.push(`<p><strong>Statut :</strong> ${statusLabels[patient.status] || patient.status}</p>`);
    }

    if (options.includeMutual) {
      sections.push(`<p><strong>Mutuelle :</strong> ${patient.has_mutual ? "Oui" : "Non"}</p>`);
    }

    if (options.includeRemainingSessions && patient.remaining_sessions !== null) {
      sections.push(`<p><strong>Séances restantes :</strong> ${patient.remaining_sessions}</p>`);
    }

    if (options.includePrescription && patient.prescription) {
      sections.push(`<p><strong>Ordonnance :</strong> ${prescriptionLabels[patient.prescription] || patient.prescription}</p>`);
    }

    if (options.includeAddress && (patient.address || patient.postal_code)) {
      const addressParts = [patient.address, patient.postal_code].filter(Boolean).join(", ");
      sections.push(`<p><strong>Adresse :</strong> ${addressParts}</p>`);
    }

    if (options.includeBloodType && patient.blood_type) {
      sections.push(`<p><strong>Groupe sanguin :</strong> ${patient.blood_type}</p>`);
    }

    if (options.includeAllergies && patient.allergies) {
      sections.push(`<h2 class="section-title">Allergies</h2>`);
      sections.push(`<p class="multiline">${patient.allergies}</p>`);
    }

    if (options.includeAntecedents && patient.antecedents) {
      sections.push(`<h2 class="section-title">Antécédents</h2>`);
      sections.push(`<p class="multiline">${patient.antecedents}</p>`);
    }

    if (options.includeMedicalNotes && patient.medical_notes) {
      sections.push(`<h2 class="section-title">Notes médicales</h2>`);
      sections.push(`<p class="multiline">${patient.medical_notes}</p>`);
    }

    if (options.includeMotifConsultation && carePlan.motif_consultation) {
      sections.push(`<h2 class="section-title">Motif de consultation</h2>`);
      sections.push(`<p class="multiline">${carePlan.motif_consultation}</p>`);
    }

    if (options.includeBilanKine && carePlan.bilan_kine) {
      sections.push(`<h2 class="section-title">Bilan kiné</h2>`);
      sections.push(`<p class="multiline">${carePlan.bilan_kine}</p>`);
    }

    if (options.includeObjectifs && carePlan.objectifs_prise_en_charge) {
      sections.push(`<h2 class="section-title">Objectifs de prise en charge</h2>`);
      sections.push(`<p class="multiline">${carePlan.objectifs_prise_en_charge}</p>`);
    }

    if (options.includeTraitement && activeTraitementName) {
      sections.push(`<h2 class="section-title">Plan de traitement</h2>`);
      sections.push(`<p>${activeTraitementName}</p>`);
    }

    if (options.includeComments && carePlan.comments) {
      sections.push(`<h2 class="section-title">Commentaires</h2>`);
      sections.push(`<p class="multiline">${carePlan.comments}</p>`);
    }

    return sections.join("\n");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dateSection = options.includeDate
      ? `<div class="date">Date : ${new Date().toLocaleDateString("fr-FR")}</div>`
      : "";

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Compte-rendu - ${patient.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              color: #333;
            }
            h1 {
              text-align: center;
              margin-bottom: 30px;
              font-size: 24px;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              margin-top: 25px;
              margin-bottom: 10px;
              color: #444;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            p {
              margin: 8px 0;
              line-height: 1.5;
            }
            .multiline {
              white-space: pre-wrap;
            }
            .date {
              margin-top: 40px;
              text-align: right;
              font-style: italic;
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
          <h1>Compte-rendu Patient</h1>
          ${generatePreviewContent()}
          ${dateSection}
          <div class="signature">Signature :</div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const previewHtml = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: white; color: #333; font-size: 12px;">
      <h1 style="text-align: center; font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">Compte-rendu Patient</h1>
      <style>
        .section-title { font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 8px; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
        p { margin: 5px 0; line-height: 1.4; }
        .multiline { white-space: pre-wrap; }
      </style>
      ${generatePreviewContent()}
      ${options.includeDate ? `<div style="margin-top: 30px; text-align: right; font-style: italic;">Date : ${new Date().toLocaleDateString("fr-FR")}</div>` : ""}
      <div style="margin-top: 40px; text-align: right;">Signature :</div>
    </div>
  `;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Imprimer le compte-rendu patient
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Options */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Éléments à inclure
            </h3>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includePatientInfo"
                    checked={options.includePatientInfo}
                    onCheckedChange={() => toggleOption("includePatientInfo")}
                  />
                  <Label htmlFor="includePatientInfo" className="cursor-pointer">
                    Informations patient (nom, numéro)
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeStatus"
                    checked={options.includeStatus}
                    onCheckedChange={() => toggleOption("includeStatus")}
                  />
                  <Label htmlFor="includeStatus" className="cursor-pointer">
                    Statut
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeMutual"
                    checked={options.includeMutual}
                    onCheckedChange={() => toggleOption("includeMutual")}
                  />
                  <Label htmlFor="includeMutual" className="cursor-pointer">
                    Mutuelle
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeRemainingSessions"
                    checked={options.includeRemainingSessions}
                    onCheckedChange={() => toggleOption("includeRemainingSessions")}
                  />
                  <Label htmlFor="includeRemainingSessions" className="cursor-pointer">
                    Séances restantes
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includePrescription"
                    checked={options.includePrescription}
                    onCheckedChange={() => toggleOption("includePrescription")}
                  />
                  <Label htmlFor="includePrescription" className="cursor-pointer">
                    Ordonnance
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeAddress"
                    checked={options.includeAddress}
                    onCheckedChange={() => toggleOption("includeAddress")}
                  />
                  <Label htmlFor="includeAddress" className="cursor-pointer">
                    Adresse
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeBloodType"
                    checked={options.includeBloodType}
                    onCheckedChange={() => toggleOption("includeBloodType")}
                  />
                  <Label htmlFor="includeBloodType" className="cursor-pointer">
                    Groupe sanguin
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeAllergies"
                    checked={options.includeAllergies}
                    onCheckedChange={() => toggleOption("includeAllergies")}
                  />
                  <Label htmlFor="includeAllergies" className="cursor-pointer">
                    Allergies
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeAntecedents"
                    checked={options.includeAntecedents}
                    onCheckedChange={() => toggleOption("includeAntecedents")}
                  />
                  <Label htmlFor="includeAntecedents" className="cursor-pointer">
                    Antécédents
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeMedicalNotes"
                    checked={options.includeMedicalNotes}
                    onCheckedChange={() => toggleOption("includeMedicalNotes")}
                  />
                  <Label htmlFor="includeMedicalNotes" className="cursor-pointer">
                    Notes médicales
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeMotifConsultation"
                    checked={options.includeMotifConsultation}
                    onCheckedChange={() => toggleOption("includeMotifConsultation")}
                  />
                  <Label htmlFor="includeMotifConsultation" className="cursor-pointer">
                    Motif de consultation
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeBilanKine"
                    checked={options.includeBilanKine}
                    onCheckedChange={() => toggleOption("includeBilanKine")}
                  />
                  <Label htmlFor="includeBilanKine" className="cursor-pointer">
                    Bilan kiné
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeObjectifs"
                    checked={options.includeObjectifs}
                    onCheckedChange={() => toggleOption("includeObjectifs")}
                  />
                  <Label htmlFor="includeObjectifs" className="cursor-pointer">
                    Objectifs de prise en charge
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeTraitement"
                    checked={options.includeTraitement}
                    onCheckedChange={() => toggleOption("includeTraitement")}
                  />
                  <Label htmlFor="includeTraitement" className="cursor-pointer">
                    Plan de traitement
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeComments"
                    checked={options.includeComments}
                    onCheckedChange={() => toggleOption("includeComments")}
                  />
                  <Label htmlFor="includeComments" className="cursor-pointer">
                    Commentaires
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeDate"
                    checked={options.includeDate}
                    onCheckedChange={() => toggleOption("includeDate")}
                  />
                  <Label htmlFor="includeDate" className="cursor-pointer">
                    Date d'impression
                  </Label>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Aperçu
            </h3>
            <ScrollArea className="h-[400px] border rounded-lg">
              <div
                dangerouslySetInnerHTML={{ __html: previewHtml }}
                className="min-h-full"
              />
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
