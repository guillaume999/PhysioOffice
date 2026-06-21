import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalise une chaîne pour la recherche : passe en minuscules et supprime
 * les accents/diacritiques. Permet une recherche insensible aux accents
 * (ex. "velo" trouve "vélo" et inversement).
 */
export function normalizeSearch(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Indique si `haystack` contient `needle` en ignorant la casse et les accents.
 */
export function matchesSearch(haystack: unknown, needle: unknown): boolean {
  return normalizeSearch(haystack).includes(normalizeSearch(needle));
}

/**
 * Parse un champ JSON renvoyé par PocketBase.
 * PocketBase SDK déserialise automatiquement les champs `json` en objet.
 * Mais d'anciens enregistrements (migration Supabase) peuvent contenir une string.
 * Retourne null si le contenu est vide ou invalide.
 */
export function parseJsonField<T = unknown>(value: unknown): T | null {
  if (value == null || value === "") return null;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed == null ? null : (parsed as T);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Normalise une date PocketBase pour un <Input type="date">.
 * PB renvoie les champs `date` au format "YYYY-MM-DD HH:mm:ss.sssZ" (ou ISO complet),
 * mais l'input HTML n'accepte que "YYYY-MM-DD". Retourne "" si la valeur est vide/invalide.
 */
export function toIsoDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value !== "string") return "";
  // Slice les 10 premiers caractères : "YYYY-MM-DD" ou ISO complet → "YYYY-MM-DD"
  const sliced = value.slice(0, 10);
  // Sanity check : format YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(sliced) ? sliced : "";
}
