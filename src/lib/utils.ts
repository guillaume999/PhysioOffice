import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
