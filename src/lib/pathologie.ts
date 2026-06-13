// Helpers partagés entre la page détail (lecture) et la page d'édition d'une
// pathologie. Le champ `description` de PocketBase stocke un Markdown structuré
// en sections de niveau 2 ; la section "Traitement kiné" contient une liste
// mixte (texte / référence exercice) sérialisée en JSON.

export const CATEGORIES = [
  "Traumatologie",
  "Orthopédie",
  "Neurologie",
  "Rhumatologie",
  "Cardiovasculaire",
  "Respiratoire",
  "Psychiatrie",
  "Gériatrie",
  "Urologie",
  "Dermatologie",
  "Pédiatrie",
  "Gynécologie",
  "Médecine interne",
  "Chirurgie",
] as const;

// Mode d'édition d'une section :
// - "text"   : un seul champ texte mis en forme (HTML).
// - "blocks" : liste de blocs texte (tiroirs titre + contenu), sans exercice.
// - "mixed"  : liste de blocs texte ET de références à des exercices.
// Les sections "blocks"/"mixed" stockent leur contenu en JSON (liste de KineItem)
// dans leur sous-section de `description`.
export type SectionMode = "text" | "blocks" | "mixed";

// Sections internes structurées du champ `description`.
// Ordre = ordre d'affichage et de stockage.
export const SECTIONS = [
  { key: "traitement_kine", label: "Traitement kiné", mode: "mixed" },
  { key: "bilan", label: "Bilan", mode: "mixed" },
  { key: "description", label: "Description", mode: "blocks" },
  { key: "traitement_orthopedique", label: "Traitement orthopédique", mode: "text" },
  { key: "traitement_chirurgical", label: "Traitement chirurgical", mode: "text" },
  { key: "complications", label: "Complications", mode: "text" },
  { key: "contre_indications", label: "Contre-indications", mode: "text" },
  { key: "evolution_delais", label: "Évolution & délais", mode: "text" },
  { key: "mots_cles", label: "Mots-clés", mode: "text" },
] as const satisfies ReadonlyArray<{ key: string; label: string; mode: SectionMode }>;

export type SectionKey = (typeof SECTIONS)[number]["key"];

// Sections stockées en liste de blocs (JSON) vs sections texte simples.
export const ITEM_SECTIONS = SECTIONS.filter((s) => s.mode !== "text");
export const TEXT_SECTIONS = SECTIONS.filter((s) => s.mode === "text");

// Élément d'une section en liste : bloc texte libre (titre + contenu mis en
// forme), ou référence (par id) à un exercice type de la bibliothèque.
export type KineItem =
  | { type: "text"; title?: string; value: string }
  | { type: "exercice"; id: string };

// Heuristique : le contenu contient-il des balises HTML (donc mis en forme) ?
// Sinon c'est du texte legacy (sauts de ligne à préserver à l'affichage).
export function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s || "");
}

export function emptySections(): Record<SectionKey, string> {
  return SECTIONS.reduce(
    (acc, s) => ({ ...acc, [s.key]: "" }),
    {} as Record<SectionKey, string>
  );
}

// Construit le Markdown final à partir du dictionnaire de sections.
export function buildDescription(sections: Record<SectionKey, string>): string {
  return SECTIONS.map(({ key, label }) => {
    const content = (sections[key] || "").trim();
    return `## ${label}\n${content}`;
  }).join("\n\n");
}

// Reconstruit `description` à partir des sections texte + des listes de blocs
// (sérialisées en JSON dans la sous-section correspondante).
export function buildSectionsDescription(
  texts: Record<SectionKey, string>,
  itemsBySection: Partial<Record<SectionKey, KineItem[]>>
): string {
  const merged: Record<SectionKey, string> = { ...texts };
  for (const s of SECTIONS) {
    if (s.mode !== "text") {
      const its = itemsBySection[s.key] || [];
      merged[s.key] = its.length ? JSON.stringify(its) : "";
    }
  }
  return buildDescription(merged);
}

// Parse un Markdown structuré en ses sections. Tolérant : le préambule non
// reconnu va dans la section "description". Cherche les headings de niveau 2.
export function parseDescription(md: string): Record<SectionKey, string> {
  if (!md) return emptySections();

  const labelToKey = new Map<string, SectionKey>(
    SECTIONS.map((s) => [s.label.toLowerCase(), s.key])
  );

  const lines = md.split(/\r?\n/);
  let current: SectionKey | null = null;
  const buffers: Record<SectionKey, string[]> = SECTIONS.reduce(
    (acc, s) => ({ ...acc, [s.key]: [] }),
    {} as Record<SectionKey, string[]>
  );
  const preamble: string[] = [];

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      const key = labelToKey.get(m[1].trim().toLowerCase());
      if (key) {
        current = key;
        continue;
      }
    }
    if (current) buffers[current].push(line);
    else preamble.push(line);
  }

  if (
    preamble.join("").trim().length > 0 &&
    Object.values(buffers).every((b) => b.length === 0)
  ) {
    buffers.description = preamble;
  }

  return SECTIONS.reduce(
    (acc, s) => ({ ...acc, [s.key]: buffers[s.key].join("\n").trim() }),
    {} as Record<SectionKey, string>
  );
}

// Parse le contenu brut de la section "Traitement kiné" en liste d'éléments.
// Format : JSON (array d'items). Rétrocompat : tout texte non-JSON est converti
// en un unique bloc texte.
export function parseKineItems(raw: string): KineItem[] {
  const t = (raw || "").trim();
  if (!t) return [];
  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) {
      return parsed
        .map((it: any): KineItem | null => {
          if (it && it.type === "exercice" && typeof it.id === "string")
            return { type: "exercice", id: it.id };
          if (it && it.type === "text" && typeof it.value === "string")
            return { type: "text", title: typeof it.title === "string" ? it.title : "", value: it.value };
          return null;
        })
        .filter((x): x is KineItem => !!x);
    }
  } catch {
    /* texte legacy non-JSON */
  }
  return [{ type: "text", value: t }];
}
