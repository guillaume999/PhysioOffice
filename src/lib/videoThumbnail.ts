/**
 * Génère une vignette (data URL JPEG) à partir d'une URL vidéo, côté client.
 * Retourne null si la génération échoue (CORS, timeout, format non supporté…).
 */
export function createVideoThumbnailDataUrl(videoUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 6000);

    video.onloadeddata = () => {
      const t = Math.min(1.5, Math.max(0.1, video.duration * 0.1));
      video.currentTime = t;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          window.clearTimeout(timeout);
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        window.clearTimeout(timeout);
        cleanup();
        resolve(dataUrl);
      } catch {
        window.clearTimeout(timeout);
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      window.clearTimeout(timeout);
      cleanup();
      resolve(null);
    };
  });
}
