import { useEffect, useState } from "react";
import { Play, Image as ImageIcon, Video } from "lucide-react";
import {
  MediaSource,
  isImageMedia,
  hasMedia,
  getThumbnailUrl,
} from "@/lib/exerciceMedia";
import { createVideoThumbnailDataUrl } from "@/lib/videoThumbnail";
import { cn } from "@/lib/utils";

interface MediaThumbProps {
  source: MediaSource;
  alt?: string;
  /** Classes de taille/forme (ex: "w-12 h-8"). Par défaut w-12 h-8. */
  className?: string;
  /** Affiche l'icône Play en overlay sur les vidéos. */
  showPlayIcon?: boolean;
  onClick?: () => void;
}

/**
 * Vignette réutilisable pour un exercice / média (image ou vidéo).
 * Si la vidéo n'a pas de thumbnail_url, une vignette est générée côté client.
 */
export function MediaThumb({
  source,
  alt = "",
  className,
  showPlayIcon = false,
  onClick,
}: MediaThumbProps) {
  const [generatedThumb, setGeneratedThumb] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);
  const isImage = isImageMedia(source);
  const storedThumb = getThumbnailUrl(source);

  useEffect(() => {
    let cancelled = false;
    setThumbError(false);
    setGeneratedThumb(null);

    if (isImage) return;
    if (!source.video_url) return;
    if (source.thumbnail_url) return;

    createVideoThumbnailDataUrl(source.video_url).then((url) => {
      if (!cancelled) setGeneratedThumb(url);
    });

    return () => {
      cancelled = true;
    };
  }, [source.video_url, source.thumbnail_url, isImage]);

  const hasMediaContent = hasMedia(source);
  const thumbnailSrc = thumbError
    ? generatedThumb
    : storedThumb ?? generatedThumb;

  return (
    <div
      className={cn(
        "rounded overflow-hidden bg-muted flex-shrink-0 relative",
        onClick && hasMediaContent && "cursor-pointer",
        className || "w-12 h-8"
      )}
      onClick={() => hasMediaContent && onClick?.()}
    >
      {hasMediaContent && thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setThumbError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
          {isImage ? (
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
          ) : hasMediaContent ? (
            <Play className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Video className="w-4 h-4 text-muted-foreground/50" />
          )}
        </div>
      )}

      {showPlayIcon && hasMediaContent && !isImage && thumbnailSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/20">
          <Play className="w-4 h-4 text-background drop-shadow" />
        </div>
      )}
    </div>
  );
}
