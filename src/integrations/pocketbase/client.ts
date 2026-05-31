import PocketBase from "pocketbase";

// VITE_PB_URL from build args, falls back to production PocketBase URL
const PB_URL = (import.meta.env.VITE_PB_URL && import.meta.env.VITE_PB_URL !== "http://localhost:8090")
  ? import.meta.env.VITE_PB_URL
  : "https://pocketbase-dev.physiooffice.com";

export const pb = new PocketBase(PB_URL);

// Persist auth in localStorage (default PB behavior, but explicit for clarity)
pb.autoCancellation(false);

/**
 * Get a public file URL from a PocketBase record.
 */
export function getFileUrl(
  record: { id: string; collectionId?: string; collectionName?: string } & Record<string, any>,
  filename: string,
  queryParams?: Record<string, string>
): string {
  if (!filename) return "";
  return pb.files.getURL(record as any, filename, queryParams);
}
