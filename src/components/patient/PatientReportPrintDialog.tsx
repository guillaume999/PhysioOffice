import { useState, type ReactNode, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer, Eye, User, FileText, Stethoscope, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";

// Helper function to escape HTML entities for safe rendering
const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

interface TraitementSeance {
  ordre: number;
  seance_date: string | null;
  nom?: string | null;
  objectifs_principaux: string[];
  pathologies: string[];
}

interface BilanIntermediaire {
  id: string;
  position_after_seance: number;
  bilan_date: string | null;
  content: string | null;
}

interface BilanInitialData {
  profession?: string;
  situation_fam?: string;
  pathologie?: string;
  plainte_patient?: string;
  atcd?: string;
  medicaments?: string;
  commentaires?: string;
  [key: string]: any;
}

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
  traitementSeances?: TraitementSeance[];
  bilanInitialData?: BilanInitialData | null;
  bilansIntermediaires?: BilanIntermediaire[];
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
  | "includeBilanInitial"
  // Sous-sections du bilan initial
  | "bilanInfosPatient"
  | "bilanHistoire"
  | "bilanPathologie"
  | "bilanDouleurs"
  | "bilanMorphodynamique"
  | "bilanMorphostatique"
  | "bilanCutaneo"
  | "bilanForceTests"
  | "bilanCommentaires"
  | "includeMotifConsultation"
  | "includeBilanKine"
  | "includeObjectifs"
  | "includeTraitement"
  | "includeDate";

// Sections dont le contenu peut être pré-rempli (données) ou laissé vierge (à remplir).
const fillableKeys: OptionKey[] = [
  "includePatientInfo",
  "includeAllergies",
  "includeAntecedents",
  "includeObjectifs",
  "includeTraitement",
  "includeComments",
  "bilanInfosPatient",
  "bilanHistoire",
  "bilanPathologie",
  "bilanDouleurs",
  "bilanMorphodynamique",
  "bilanMorphostatique",
  "bilanCutaneo",
  "bilanForceTests",
  "bilanCommentaires",
];

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
      { key: "includePatientInfo", label: "Numéro" },
    ],
  },
  {
    title: "Données médicales",
    icon: <Stethoscope className="w-4 h-4" />,
    options: [
      { key: "includeAllergies", label: "Allergies" },
      { key: "includeAntecedents", label: "Antécédents" },
    ],
  },
  {
    title: "Prise en charge",
    icon: <FileText className="w-4 h-4" />,
    options: [
      { key: "includeObjectifs", label: "Objectifs" },
      { key: "includeTraitement", label: "Plan de traitement" },
      { key: "includeComments", label: "Commentaires" },
    ],
  },
];

// Sous-sections du bilan initial, dans l'ordre de la page Bilan Initial.
// La case maîtresse "includeBilanInitial" active/désactive tout le bloc ;
// les sous-cases pilotent chaque section individuellement.
const bilanInitialOptions: { key: OptionKey; label: string }[] = [
  { key: "bilanInfosPatient", label: "Informations patient" },
  { key: "bilanHistoire", label: "Histoire du patient" },
  { key: "bilanPathologie", label: "Pathologie / Plainte" },
  { key: "bilanDouleurs", label: "Bilan douleurs" },
  { key: "bilanMorphodynamique", label: "Bilan morphodynamique" },
  { key: "bilanMorphostatique", label: "Bilan morphostatique" },
  { key: "bilanCutaneo", label: "Bilan cutanéo-trophique" },
  { key: "bilanForceTests", label: "Force et tests" },
  { key: "bilanCommentaires", label: "Commentaires du bilan" },
];

export function PatientReportPrintDialog({
  open,
  onOpenChange,
  patient,
  carePlan,
  activeTraitementName,
  traitementSeances = [],
  bilanInitialData = null,
  bilansIntermediaires = [],
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
    includeBilanInitial: true,
    bilanInfosPatient: true,
    bilanHistoire: true,
    bilanPathologie: true,
    bilanDouleurs: true,
    bilanMorphodynamique: true,
    bilanMorphostatique: true,
    bilanCutaneo: true,
    bilanForceTests: true,
    bilanCommentaires: true,
    includeMotifConsultation: true,
    includeBilanKine: true,
    includeObjectifs: true,
    includeTraitement: true,
    includeDate: true,
  });

  // Pré-rempli vs vierge, réglable section par section.
  // Une clé présente = section laissée VIERGE ; absente = pré-remplie (défaut).
  const [blankSections, setBlankSections] = useState<Set<OptionKey>>(new Set());
  const isPrefilled = (key: OptionKey) => !blankSections.has(key);
  const toggleFill = (key: OptionKey) => {
    setBlankSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const setAllFill = (prefill: boolean) =>
    setBlankSections(prefill ? new Set() : new Set(fillableKeys));
  const allPrefilled = blankSections.size === 0;
  const allBlank = fillableKeys.every((k) => blankSections.has(k));

  const [activeTab, setActiveTab] = useState<"options" | "preview">("options");

  const toggleOption = (key: OptionKey) => {
    setOptions({ ...options, [key]: !options[key] });
  };

  const generateBilanInitialContent = () => {
    if (!bilanInitialData) return "";

    const d = bilanInitialData;
    // Valeur brute du champ. Le motif de consultation est relié à la colonne BDD
    // (source unique) : on l'affiche en priorité, avec repli sur l'ancien JSON.
    const rawVal = (key: string): string => {
      if (key === "pathologie" && carePlan.motif_consultation && String(carePlan.motif_consultation).trim()) {
        return String(carePlan.motif_consultation).trim();
      }
      const v = d[key];
      return v === null || v === undefined ? "" : String(v).trim();
    };

    // Mise en page « formulaire » identique à la page Bilan Initial :
    // chaque section = des lignes de champs, chaque champ = libellé au-dessus d'une case bordée.
    // `tall` = champ texte (textarea) → case plus haute. Une ligne peut contenir 1 à 4 champs.
    type BilanField = { key: string; label: string; tall?: boolean };
    type BilanSection = { title: string; option: OptionKey; rows: BilanField[][] };
    const sections: BilanSection[] = [
      {
        title: "Informations patient",
        option: "bilanInfosPatient",
        rows: [
          [
            { key: "profession", label: "Profession" },
            { key: "taille", label: "Taille (cm)" },
            { key: "poids", label: "Poids (kg)" },
            { key: "lateralite", label: "Latéralité" },
          ],
          [
            { key: "loisir_sport", label: "Loisirs - Activités physiques" },
            { key: "activite_physique_type", label: "Type d'activité" },
            { key: "situation_fam", label: "Situation familiale" },
          ],
          [
            { key: "atcd", label: "Antécédents (ATCD)", tall: true },
            { key: "medicaments", label: "Médicaments", tall: true },
          ],
          [
            { key: "pathologies_associees", label: "Pathologies associées" },
            { key: "tabac", label: "Tabac" },
          ],
          [{ key: "etat_psychique", label: "État psychique du patient" }],
        ],
      },
      {
        title: "Histoire du patient",
        option: "bilanHistoire",
        rows: [[{ key: "histoire_patient", label: "Histoire du patient", tall: true }]],
      },
      {
        title: "Pathologie / Plainte",
        option: "bilanPathologie",
        rows: [
          [
            { key: "pathologie", label: "Motif de consultation / Pathologie", tall: true },
            { key: "date_debut", label: "Depuis quand ?" },
          ],
          [{ key: "plainte_patient", label: "Plainte patient", tall: true }],
          [
            { key: "facteurs_declenchants", label: "Facteurs déclenchants" },
            { key: "circonstances", label: "Circonstances" },
          ],
          [
            { key: "histoire_naturelle", label: "Histoire naturelle de la pathologie" },
            { key: "evolution", label: "Évolution" },
          ],
          [
            { key: "recidive", label: "Récidive" },
            { key: "chirurgie", label: "Chirurgie" },
            { key: "chirurgie_detail", label: "Si oui, quelle opération ?" },
          ],
          [
            { key: "examen_complementaire", label: "Examen complémentaire (imagerie)", tall: true },
            { key: "ttt_deja_suivis", label: "Traitements kiné déjà suivis", tall: true },
          ],
          [
            { key: "signes", label: "Signes" },
            { key: "mvt_impossibles", label: "Mouvements impossibles" },
          ],
          [{ key: "projets_attentes", label: "Objectifs / Projets / Attentes du patient", tall: true }],
        ],
      },
      {
        title: "Bilan cutanéo-trophique",
        option: "bilanCutaneo",
        rows: [
          [
            { key: "cutaneo_cicatrice_couleur", label: "Cicatrice / Couleur" },
            { key: "cutaneo_trophiques", label: "Troubles trophiques" },
          ],
          [
            { key: "cutaneo_adherences_chaleur", label: "Adhérences / Chaleur" },
            { key: "cutaneo_test_decollement", label: "Test de décollement" },
          ],
          [
            { key: "cutaneo_test_godet", label: "Test du godet" },
            { key: "cutaneo_amyotrophie", label: "Amyotrophie" },
          ],
        ],
      },
      {
        title: "Force et tests",
        option: "bilanForceTests",
        rows: [
          [{ key: "force_musculaire", label: "Force musculaire", tall: true }],
          [{ key: "tests_specifiques", label: "Tests spécifiques", tall: true }],
        ],
      },
      {
        title: "Commentaires",
        option: "bilanCommentaires",
        rows: [[{ key: "commentaires", label: "Commentaires", tall: true }]],
      },
    ];

    const content: string[] = [];

    // Une case de formulaire : libellé + encadré. En mode vierge, la case reste vide.
    const fieldBox = ({ key, label, tall }: BilanField, prefill: boolean): string => {
      const v = prefill ? rawVal(key) : "";
      const minH = tall ? "44px" : "20px";
      return (
        `<div style="display:flex; flex-direction:column;">` +
        `<span style="font-size:11px; font-weight:bold; color:#444; margin-bottom:3px;">${escapeHtml(label)}</span>` +
        `<div style="border:1px solid #cbd5e1; border-radius:6px; padding:5px 8px; min-height:${minH}; white-space:pre-wrap; word-break:break-word;">${v ? escapeHtml(v) : "&nbsp;"}</div>` +
        `</div>`
      );
    };

    sections.forEach(({ title, option, rows }) => {
      if (!options[option]) return;
      const prefill = isPrefilled(option);
      content.push(`<h2 class="section-title">${escapeHtml(title)}</h2>`);
      rows.forEach((row) => {
        content.push(`<div style="display:grid; grid-template-columns:repeat(${row.length}, 1fr); gap:10px; margin-bottom:8px;">`);
        row.forEach((f) => content.push(fieldBox(f, prefill)));
        content.push(`</div>`);
      });
    });

    // Tableaux dynamiques (zone / observation).
    const tables: { key: string; title: string; option: OptionKey }[] = [
      { key: "douleurs_entries", title: "Bilan douleurs", option: "bilanDouleurs" },
      { key: "morphodynamique_entries", title: "Bilan morphodynamique", option: "bilanMorphodynamique" },
      { key: "morphostatique_entries", title: "Bilan morphostatique", option: "bilanMorphostatique" },
    ];

    tables.forEach(({ key, title, option }) => {
      if (!options[option]) return;
      const entries = Array.isArray(d[key]) ? d[key] : [];
      const filled = isPrefilled(option)
        ? entries.filter((e: any) => (e?.zone || "").trim() || (e?.observation || "").trim())
        : [];
      // Si aucune ligne renseignée, on imprime des lignes vierges à remplir.
      const rows = filled.length > 0
        ? filled
        : [{ zone: "", observation: "" }, { zone: "", observation: "" }, { zone: "", observation: "" }];
      content.push(`<h2 class="section-title">${escapeHtml(title)}</h2>`);
      content.push(`<table style="width:100%; border-collapse:collapse; margin-top:6px;">`);
      content.push(`<thead><tr style="background:#f5f5f5;"><th style="border:1px solid #ddd; padding:6px; text-align:left;">Zone</th><th style="border:1px solid #ddd; padding:6px; text-align:left;">Observation</th></tr></thead><tbody>`);
      rows.forEach((e: any) => {
        content.push(`<tr><td style="border:1px solid #ddd; padding:6px; height:22px;">${escapeHtml(e.zone || "")}</td><td style="border:1px solid #ddd; padding:6px; height:22px;">${escapeHtml(e.observation || "")}</td></tr>`);
      });
      content.push(`</tbody></table>`);
    });

    return content.join("\n");
  };

  const generateBilansIntermediairesContent = () => {
    if (bilansIntermediaires.length === 0) return "";
    
    const content: string[] = [];
    bilansIntermediaires.forEach((bilan, index) => {
      const dateStr = bilan.bilan_date 
        ? new Date(bilan.bilan_date).toLocaleDateString("fr-FR") 
        : "Date non définie";
      content.push(`<div style="margin-bottom: 15px;">`);
      content.push(`<p><strong>Bilan ${index + 1}</strong> (après séance ${bilan.position_after_seance}) - ${escapeHtml(dateStr)}</p>`);
      content.push(`<p style="white-space: pre-wrap;">${escapeHtml(bilan.content) || "Aucun contenu"}</p>`);
      content.push(`</div>`);
    });

    return content.join("\n");
  };

  const generatePreviewContent = () => {
    const sections: string[] = [];
    
    // Toujours afficher les champs d'identification vides en 2 colonnes
    sections.push(`<h2 class="section-title">Informations patient</h2>`);
    sections.push(`<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">`);
    sections.push(`<p><strong>Nom :</strong> ____________________</p>`);
    sections.push(`<p><strong>Prénom :</strong> ____________________</p>`);
    sections.push(`<p><strong>N° Téléphone :</strong> ____________________</p>`);
    sections.push(`<p><strong>Mutuelle :</strong> ____________________</p>`);
    sections.push(`<p><strong>N° Sécu. Soc. :</strong> ____________________</p>`);
    sections.push(`<p><strong>Médecin prescripteur :</strong> ____________________</p>`);
    if (options.includePatientInfo) {
      const show = isPrefilled("includePatientInfo") && patient.numero;
      sections.push(`<p><strong>N° Patient :</strong> ${show ? escapeHtml(patient.numero) : "____________________"}</p>`);
    }
    sections.push(`</div>`);

    const emptyLines = '<span style="color: #999;">_________________________________________________<br/>_________________________________________________<br/>_________________________________________________</span>';
    const extraLines = '<br/><span style="color: #999;">_________________________________________________<br/>_________________________________________________</span>';

    if (options.includeBilanInitial) {
      sections.push(`<h2 class="section-title">Bilan initial</h2>`);
      const bilanInitialContent = generateBilanInitialContent();
      sections.push(bilanInitialContent || `<p class="multiline">${emptyLines}</p>`);
    }

    if (options.includeAllergies) {
      sections.push(`<h2 class="section-title">Allergies</h2>`);
      sections.push(`<p class="multiline">${isPrefilled("includeAllergies") && patient.allergies ? escapeHtml(patient.allergies) + extraLines : emptyLines}</p>`);
    }

    if (options.includeAntecedents) {
      sections.push(`<h2 class="section-title">Antécédents</h2>`);
      sections.push(`<p class="multiline">${isPrefilled("includeAntecedents") && patient.antecedents ? escapeHtml(patient.antecedents) + extraLines : emptyLines}</p>`);
    }

    if (options.includeObjectifs) {
      sections.push(`<h2 class="section-title">Objectifs de prise en charge</h2>`);
      sections.push(`<p class="multiline">${isPrefilled("includeObjectifs") && carePlan.objectifs_prise_en_charge ? escapeHtml(carePlan.objectifs_prise_en_charge) + extraLines : emptyLines}</p>`);
    }

    if (options.includeTraitement) {
      sections.push(`<h2 class="section-title">Plan de traitement</h2>`);
      sections.push(`<p><strong>Traitement :</strong> ${isPrefilled("includeTraitement") && activeTraitementName ? escapeHtml(activeTraitementName) : '____________________'}</p>`);

      if (isPrefilled("includeTraitement") && traitementSeances.length > 0) {
        sections.push(`<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">`);
        sections.push(`<thead><tr style="background: #f5f5f5;">`);
        sections.push(`<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">N°</th>`);
        sections.push(`<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Catégorie</th>`);
        sections.push(`<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>`);
        sections.push(`<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Type</th>`);
        sections.push(`</tr></thead><tbody>`);
        
        // Create combined list of seances and bilans sorted by date (chronological)
        const items: Array<{ type: 'seance' | 'bilan'; ordre: number; date: string | null; data: any }> = [];
        
        traitementSeances.forEach((seance) => {
          items.push({ type: 'seance', ordre: seance.ordre, date: seance.seance_date, data: seance });
        });
        
        bilansIntermediaires.forEach((bilan) => {
          items.push({ type: 'bilan', ordre: bilan.position_after_seance + 0.5, date: bilan.bilan_date, data: bilan });
        });
        
        // Sort chronologically by date; items without a date fall back to their ordre, after dated items
        items.sort((a, b) => {
          if (a.date && b.date) {
            const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (diff !== 0) return diff;
            return a.ordre - b.ordre;
          }
          if (a.date && !b.date) return -1;
          if (!a.date && b.date) return 1;
          return a.ordre - b.ordre;
        });
        
        items.forEach((item) => {
          if (item.type === 'seance') {
            const seance = item.data;
            const dateStr = seance.seance_date
              ? new Date(seance.seance_date).toLocaleDateString("fr-FR")
              : "____/____/________";
            const titre = seance.nom
              ? escapeHtml(seance.nom)
              : "-";

            sections.push(`<tr>`);
            sections.push(`<td style="border: 1px solid #ddd; padding: 8px;">${seance.ordre}</td>`);
            sections.push(`<td style="border: 1px solid #ddd; padding: 8px;">Séance</td>`);
            sections.push(`<td style="border: 1px solid #ddd; padding: 8px;">${dateStr}</td>`);
            sections.push(`<td style="border: 1px solid #ddd; padding: 8px;">${titre}</td>`);
            sections.push(`</tr>`);
          } else {
            const bilan = item.data;
            const dateStr = bilan.bilan_date
              ? new Date(bilan.bilan_date).toLocaleDateString("fr-FR")
              : "____/____/________";
            let observations = "-";
            if (bilan.content) {
              // PocketBase renvoie `content` soit en string JSON, soit déjà désérialisé en objet.
              let parsed: any = null;
              if (typeof bilan.content === "string") {
                try { parsed = JSON.parse(bilan.content); } catch { /* ancien format texte libre */ }
                if (parsed === null) {
                  // contenu en texte libre → on l'utilise tel quel
                  const raw = String(bilan.content).trim();
                  if (raw) observations = escapeHtml(raw);
                }
              } else if (typeof bilan.content === "object") {
                parsed = bilan.content;
              }
              if (parsed && typeof parsed === "object" && parsed.objectif_intermediaire) {
                observations = escapeHtml(String(parsed.objectif_intermediaire));
              }
            }

            sections.push(`<tr style="background: #f9f9f9;">`);
            sections.push(`<td style="border: 1px solid #ddd; padding: 8px; font-style: italic;">-</td>`);
            sections.push(`<td style="border: 1px solid #ddd; padding: 8px; font-style: italic;">Bilan intermédiaire</td>`);
            sections.push(`<td style="border: 1px solid #ddd; padding: 8px; font-style: italic;">${dateStr}</td>`);
            sections.push(`<td style="border: 1px solid #ddd; padding: 8px; font-style: italic; white-space: pre-wrap;"><strong>Observations / commentaires :</strong> ${observations}</td>`);
            sections.push(`</tr>`);
          }
        });
        
        sections.push(`</tbody></table>`);
      }
    }

    if (options.includeComments) {
      sections.push(`<h2 class="section-title">Commentaires</h2>`);
      sections.push(`<p class="multiline">${isPrefilled("includeComments") && carePlan.comments ? escapeHtml(carePlan.comments) + extraLines : emptyLines}</p>`);
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
          <title>Compte-rendu Patient</title>
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
            .print-footer {
              margin-top: 40px;
              text-align: center;
              font-size: 11px;
              color: #888;
              border-top: 1px solid #ddd;
              padding-top: 10px;
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
          <div class="print-footer">Imprimé avec PhysioOffice — kine-ajaccio.fr</div>
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
      <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 8px;">Imprimé avec PhysioOffice — kine-ajaccio.fr</div>
    </div>
  `;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-4xl h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] overflow-hidden flex flex-col p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Printer className="w-5 h-5 text-primary" />
                Imprimer
              </DialogTitle>
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={activeTab === "options" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("options")}
                  className="h-8 px-3 text-xs"
                >
                  <Settings2 className="w-4 h-4 mr-1.5" />
                  Options
                </Button>
                <Button
                  variant={activeTab === "preview" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("preview")}
                  className="h-8 px-3 text-xs"
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  Aperçu
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {/* Options */}
            {activeTab === "options" && (
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 pr-3">
                  {/* Mode de remplissage global + réglage par section (2e case verte sur chaque ligne) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-1.5">
                      <FileText className="w-4 h-4" />
                      Contenu des champs
                    </div>
                    <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
                      <Button
                        variant={allPrefilled ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setAllFill(true)}
                      >
                        Tout pré-rempli
                      </Button>
                      <Button
                        variant={allBlank ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setAllFill(false)}
                      >
                        Tout vierge
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">
                      Sur chaque ligne : la case <span className="text-primary font-medium">bleue</span> affiche la section,
                      la case <span className="text-emerald-600 font-medium">verte</span> la pré-remplit (décochée = vierge).
                    </p>
                  </div>

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
                              "flex items-center space-x-2 p-1.5 rounded-md transition-colors",
                              options[key] && "bg-accent/50"
                            )}
                          >
                            <Checkbox
                              checked={options[key]}
                              onCheckedChange={() => toggleOption(key)}
                              className="h-4 w-4"
                              title="Afficher cette section"
                            />
                            <Checkbox
                              checked={isPrefilled(key)}
                              disabled={!options[key]}
                              onCheckedChange={() => toggleFill(key)}
                              className="h-4 w-4 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                              title="Pré-remplir avec les données (décocher = vierge)"
                            />
                            <Label
                              className="cursor-pointer text-sm leading-tight"
                              onClick={() => toggleOption(key)}
                            >
                              {label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Bilan initial — case maîtresse + sous-sections activables */}
                  <div className="space-y-2">
                    <div
                      className={cn(
                        "flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-1.5 cursor-pointer rounded-md px-1 -mx-1 hover:bg-accent",
                        options.includeBilanInitial && "text-foreground"
                      )}
                      onClick={() => toggleOption("includeBilanInitial")}
                    >
                      <Checkbox
                        id="includeBilanInitial"
                        checked={options.includeBilanInitial}
                        onCheckedChange={() => toggleOption("includeBilanInitial")}
                        className="h-4 w-4"
                      />
                      <FileText className="w-4 h-4" />
                      Bilan initial
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pl-6">
                      {bilanInitialOptions.map(({ key, label }) => (
                        <div
                          key={key}
                          className={cn(
                            "flex items-center space-x-2 p-1.5 rounded-md transition-colors",
                            options.includeBilanInitial ? "" : "opacity-40 pointer-events-none",
                            options[key] && options.includeBilanInitial && "bg-accent/50"
                          )}
                        >
                          <Checkbox
                            checked={options[key]}
                            disabled={!options.includeBilanInitial}
                            onCheckedChange={() => toggleOption(key)}
                            className="h-4 w-4"
                            title="Afficher cette section"
                          />
                          <Checkbox
                            checked={isPrefilled(key)}
                            disabled={!options.includeBilanInitial || !options[key]}
                            onCheckedChange={() => toggleFill(key)}
                            className="h-4 w-4 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                            title="Pré-remplir avec les données (décocher = vierge)"
                          />
                          <Label
                            className="cursor-pointer text-sm leading-tight"
                            onClick={() => options.includeBilanInitial && toggleOption(key)}
                          >
                            {label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

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
            )}

            {/* Preview */}
            {activeTab === "preview" && (
              <ScrollArea className="flex-1 min-h-0 border rounded-lg bg-card">
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }} className="min-h-full" />
              </ScrollArea>
            )}
          </div>

          <DialogFooter className="pt-4 border-t flex-row gap-2 sm:gap-2">
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
