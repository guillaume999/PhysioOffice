import PocketBase from "pocketbase";

// Use || instead of ?? so empty string also falls back to default
const PB_URL = import.meta.env.VITE_PB_URL || "https://pocketbase-dev.physiooffice.com";

export const pb = new PocketBase(PB_URL);

// Persist auth in localStorage (default PB behavior, but explicit for clarity)
pb.autoCancellation(false);

/**
 * Get a public file URL from a PocketBase record.
 * Usage: getFileUrl(record, "video_file") or getFileUrl(record, "video_file", { thumb: "100x100" })
 */
export function getFileUrl(
  record: { id: string; collectionId?: string; collectionName?: string } & Record<string, any>,
  filename: string,
  queryParams?: Record<string, string>
): string {
  if (!filename) return "";
  return pb.files.getURL(record as any, filename, queryParams);
}
