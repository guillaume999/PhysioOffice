/**
 * Helpers pour gérer le média (image ou vidéo) d'un exercice ou d'un item de médiathèque.
 *
 * Schéma :
 * - media_type = "video" → utilise video_url + thumbnail_url
 * - media_type = "image" → utilise image_url (l'image sert de vignette)
 * - media_type absent/null → traité comme "video" (rétrocompatibilité)
 */

export type MediaType = "video" | "image";

export interface MediaSource {
  media_type?: MediaType | string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  image_url?: string | null;
}

export function getMediaType(source: MediaSource): MediaType {
  return source.media_type === "image" ? "image" : "video";
}

export function isImageMedia(source: MediaSource): boolean {
  return getMediaType(source) === "image";
}

export function hasMedia(source: MediaSource): boolean {
  return Boolean(
    isImageMedia(source) ? source.image_url : source.video_url
  );
}

/** URL du média principal (image ou vidéo) — pour lecteur/téléchargement. */
export function getMediaUrl(source: MediaSource): string | null {
  return isImageMedia(source)
    ? source.image_url || null
    : source.video_url || null;
}

/** URL de la vignette à afficher dans une liste/grille. */
export function getThumbnailUrl(source: MediaSource): string | null {
  if (isImageMedia(source)) return source.image_url || null;
  return source.thumbnail_url || null;
}

/** Extensions image acceptées. */
export const IMAGE_ACCEPT = "image/*";
export const VIDEO_ACCEPT = "video/*";
export const MEDIA_ACCEPT = "image/*,video/*";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 Mo
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 Mo

export function detectFileMediaType(file: File): MediaType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}
