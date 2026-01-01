import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer, Eye, User, FileText, Stethoscope, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

type OptionKey =
  | "includePatientInfo"
  | "includeStatus"
  | "includeMutual"
  | "includeRemainingSessions"
  | "includePrescription"
  | "includeAddress"
  | "includeMedicalNotes"
  | "includeAllergies"
  | "includeBloodType"
  | "includeAntecedents"
  | "includeComments"
  | "includeMotifConsultation"
  | "includeBilanKine"
  | "includeObjectifs"
  | "includeTraitement"
  | "includeDate";

interface OptionGroup {
  title: string;
  icon: ReactNode;
  options: { key: OptionKey; label: string }[];
}

const optionGroups: OptionGroup[] = [
  {
    title: "Informations patient",
    icon: <User className="w-4 h-4" />,
    options: [
      { key: "includePatientInfo", label: "Nom et numéro" },
      { key: "includeStatus", label: "Statut" },
      { key: "includeAddress", label: "Adresse" },
      { key: "includeMutual", label: "Mutuelle" },
      { key: "includeBloodType", label: "Groupe sanguin" },
    ],
  },
  {
    title: "Données médicales",
    icon: <Stethoscope className="w-4 h-4" />,
    options: [
      { key: "includeAllergies", label: "Allergies" },
      { key: "includeAntecedents", label: "Antécédents" },
      { key: "includeMedicalNotes", label: "Notes médicales" },
    ],
  },
  {
    title: "Prise en charge",
    icon: <FileText className="w-4 h-4" />,
    options: [
      { key: "includeMotifConsultation", label: "Motif de consultation" },
      { key: "includeBilanKine", label: "Bilan kiné" },
      { key: "includeObjectifs", label: "Objectifs" },
      { key: "includeTraitement", label: "Plan de traitement" },
      { key: "includePrescription", label: "Ordonnance" },
      { key: "includeRemainingSessions", label: "Séances restantes" },
      { key: "includeComments", label: "Commentaires" },
    ],
  },
];

export function PatientReportPrintDialog({
  open,
  onOpenChange,
  patient,
  carePlan,
  activeTraitementName,
}: PatientReportPrintDialogProps) {
  const [options, setOptions] = useState<Record<OptionKey, boolean>>({
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

  const [activeTab, setActiveTab] = useState<"options" | "preview">("options");

  const toggleOption = (key: OptionKey) => {
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

  const OptionsContent = () => (
    <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]]:!block [&_[data-radix-scroll-area-scrollbar]]:!opacity-100 [&_[data-radix-scroll-area-scrollbar]]:w-2.5 [&_[data-radix-scroll-area-thumb]]:bg-border">
      <div className="space-y-4 pr-4 pb-4">
        {optionGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-1.5">
              {group.icon}
              {group.title}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pl-1">
              {group.options.map(({ key, label }) => (
                <div
                  key={key}
                  className={cn(
                    "flex items-center space-x-2 p-1.5 rounded-md transition-colors cursor-pointer hover:bg-accent",
                    options[key] && "bg-accent/50"
                  )}
                  onClick={() => toggleOption(key)}
                >
                  <Checkbox
                    id={key}
                    checked={options[key]}
                    onCheckedChange={() => toggleOption(key)}
                    className="h-4 w-4"
                  />
                  <Label
                    htmlFor={key}
                    className="cursor-pointer text-sm leading-tight"
                  >
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Date option séparée */}
        <div className="pt-2 border-t">
          <div
            className={cn(
              "flex items-center space-x-2 p-1.5 rounded-md transition-colors cursor-pointer hover:bg-accent",
              options.includeDate && "bg-accent/50"
            )}
            onClick={() => toggleOption("includeDate")}
          >
            <Checkbox
              id="includeDate"
              checked={options.includeDate}
              onCheckedChange={() => toggleOption("includeDate")}
              className="h-4 w-4"
            />
            <Label htmlFor="includeDate" className="cursor-pointer text-sm">
              Inclure la date d'impression
            </Label>
          </div>
        </div>
      </div>
    </ScrollArea>
  );

  const PreviewContent = () => (
    <ScrollArea className="h-full border rounded-lg bg-card [&_[data-radix-scroll-area-viewport]]:!block [&_[data-radix-scroll-area-scrollbar]]:!opacity-100 [&_[data-radix-scroll-area-scrollbar]]:w-2.5 [&_[data-radix-scroll-area-thumb]]:bg-border">
      <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
    </ScrollArea>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-4xl h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Printer className="w-5 h-5 text-primary" />
            Imprimer le compte-rendu
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{patient.name}</p>
        </DialogHeader>

        {/* Mobile Tabs */}
        <div className="flex lg:hidden border-b mb-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab("options")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors border-b-2",
              activeTab === "options"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings2 className="w-4 h-4" />
            Options
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors border-b-2",
              activeTab === "preview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Eye className="w-4 h-4" />
            Aperçu
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Mobile: Single view based on tab */}
          <div className="lg:hidden h-full">
            {activeTab === "options" ? <OptionsContent /> : <PreviewContent />}
          </div>

          {/* Desktop: Side by side */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-4 h-full">
            <div className="flex flex-col min-h-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2 flex-shrink-0">
                <Settings2 className="w-4 h-4" />
                Options
              </div>
              <div className="flex-1 min-h-0">
                <OptionsContent />
              </div>
            </div>
            <div className="flex flex-col min-h-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2 flex-shrink-0">
                <Eye className="w-4 h-4" />
                Aperçu
              </div>
              <div className="flex-1 min-h-0">
                <PreviewContent />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t flex-row gap-2 sm:gap-2 flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-none"
          >
            Annuler
          </Button>
          <Button onClick={handlePrint} className="flex-1 sm:flex-none">
            <Printer className="w-4 h-4 mr-2" />
            Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
