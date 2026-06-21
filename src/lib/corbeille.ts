import { pb } from "@/integrations/pocketbase/client";
import {
  Users,
  Dumbbell,
  Calendar,
  ClipboardList,
  Activity,
  Target,
  Video,
  FileText,
  Stethoscope,
  FileSignature,
  type LucideIcon,
} from "lucide-react";

/**
 * Soft-delete ("corbeille") infrastructure.
 *
 * Chaque collection listée ci-dessous possède un champ `deleted_at` (Date) dans
 * PocketBase. Un enregistrement "actif" a `deleted_at` vide ; un enregistrement
 * "dans la corbeille" porte une date. On ne supprime jamais physiquement depuis
 * l'app — sauf via le bouton "Supprimer définitivement" de la page corbeille.
 */

/** Filtre PocketBase : enregistrements actifs (pas dans la corbeille). */
export const ACTIVE = 'deleted_at = ""';

/** Filtre PocketBase : enregistrements présents dans la corbeille. */
export const TRASHED = 'deleted_at != ""';

/**
 * Combine le filtre "actif" avec un filtre existant (les deux en ET).
 * Utiliser dans tous les `getList`/`getFullList` des collections à corbeille.
 *
 *   pb.collection("seance_types").getFullList({ filter: withActive() })
 *   pb.collection("videos").getFullList({ filter: withActive(`user = "${id}"`) })
 */
export function withActive(filter?: string): string {
  return filter ? `(${filter}) && ${ACTIVE}` : ACTIVE;
}

/** Déplace un enregistrement vers la corbeille (soft delete). */
export function softDelete(collection: string, id: string) {
  return pb.collection(collection).update(id, { deleted_at: new Date().toISOString() });
}

/** Restaure un enregistrement depuis la corbeille. */
export function restore(collection: string, id: string) {
  return pb.collection(collection).update(id, { deleted_at: "" });
}

/** Supprime définitivement un enregistrement (irréversible). */
export function purge(collection: string, id: string) {
  return pb.collection(collection).delete(id);
}

/**
 * Un contenu "publié sur la plateforme" ne peut pas être supprimé directement
 * par son auteur : il doit faire une demande de retrait à l'admin.
 * Vrai pour une séance / un traitement / une pathologie partagé(e) ET validé(e).
 */
export function isPublished(record: { is_shared?: boolean; is_validated?: boolean }): boolean {
  return !!(record.is_shared && record.is_validated);
}

/**
 * Vrai si la suppression d'un contenu doit passer par une demande de retrait à
 * l'admin. C'est le cas d'un contenu publié — SAUF si l'admin a déjà refusé un
 * retrait (`withdrawal_refused`) : l'auteur peut alors l'envoyer directement à
 * sa corbeille sans relancer une demande.
 */
export function needsWithdrawalRequest(record: {
  is_shared?: boolean;
  is_validated?: boolean;
  withdrawal_refused?: boolean;
}): boolean {
  return isPublished(record) && !record.withdrawal_refused;
}

/** Envoie une demande de retrait à l'admin (le contenu reste visible jusqu'à validation). */
export function requestWithdrawal(collection: string, id: string) {
  return pb.collection(collection).update(id, { withdrawal_requested: true, withdrawal_refused: false });
}

export interface TrashCollection {
  /** Nom de la collection PocketBase. */
  name: string;
  /** Libellé affiché dans la page corbeille. */
  label: string;
  /** Icône (lucide). */
  icon: LucideIcon;
}

/** Collections couvertes par la corbeille, dans l'ordre d'affichage. */
export const TRASH_COLLECTIONS: TrashCollection[] = [
  { name: "patients", label: "Patients", icon: Users },
  { name: "exercices", label: "Exercices", icon: Dumbbell },
  { name: "seance_types", label: "Séances", icon: Calendar },
  { name: "traitement_types", label: "Traitements", icon: ClipboardList },
  { name: "pathologies", label: "Pathologies", icon: Activity },
  { name: "objectifs", label: "Objectifs", icon: Target },
  { name: "videos", label: "Vidéos", icon: Video },
  { name: "notes", label: "Notes", icon: FileText },
  { name: "patient_traitements", label: "Traitements patients", icon: Stethoscope },
  { name: "patient_seances", label: "Séances patients", icon: Stethoscope },
  { name: "patient_bilans", label: "Bilans", icon: FileText },
  { name: "certificat_models", label: "Modèles de certificat", icon: FileSignature },
];

/**
 * Collections concernées par les demandes de retrait (contenus publiés dont
 * l'auteur a demandé le retrait, en attente de validation par l'admin).
 * Les exercices utilisent un statut (`status = "withdrawal_requested"`) ; les
 * autres un booléen (`withdrawal_requested = true`).
 */
const WITHDRAWAL_SIMPLE = ["seance_types", "traitement_types", "pathologies"];

/** Nombre de demandes de retrait en attente (toutes collections confondues). */
export async function fetchWithdrawalCount(): Promise<number> {
  const totals = await Promise.all([
    pb
      .collection("exercices")
      .getList(1, 1, { filter: 'status = "withdrawal_requested"' })
      .then((r) => r.totalItems)
      .catch(() => 0),
    ...WITHDRAWAL_SIMPLE.map((name) =>
      pb
        .collection(name)
        .getList(1, 1, { filter: "withdrawal_requested = true" })
        .then((r) => r.totalItems)
        .catch(() => 0)
    ),
  ]);
  return totals.reduce((sum, n) => sum + n, 0);
}

/** Nombre d'éléments présents dans la corbeille (soft-delete, toutes collections). */
export async function fetchTrashedCount(): Promise<number> {
  const totals = await Promise.all(
    TRASH_COLLECTIONS.map((collection) =>
      pb
        .collection(collection.name)
        .getList(1, 1, { filter: TRASHED })
        .then((r) => r.totalItems)
        .catch(() => 0)
    )
  );
  return totals.reduce((sum, n) => sum + n, 0);
}

/**
 * Total affiché sur le badge de l'onglet "Corbeille" :
 * demandes de retrait en attente + éléments soft-supprimés.
 */
export async function fetchCorbeilleTotal(): Promise<number> {
  const [withdrawals, trashed] = await Promise.all([fetchWithdrawalCount(), fetchTrashedCount()]);
  return withdrawals + trashed;
}

/** Meilleur titre affichable d'un enregistrement, peu importe la collection. */
export function recordTitle(record: Record<string, any>): string {
  return (
    record.name ||
    record.nom ||
    record.titre ||
    record.title ||
    record.label ||
    record.pathologie ||
    record.objectif_principal ||
    "(sans titre)"
  );
}
