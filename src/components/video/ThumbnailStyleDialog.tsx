import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Image, Smile, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ThumbnailStyle = "normal" | "sticker" | "drawing";

interface ThumbnailStyleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  videoUrl: string;
  currentThumbnailUrl: string | null;
  onSuccess: () => void;
}

export function ThumbnailStyleDialog({
  open,
  onOpenChange,
  videoId,
  videoUrl,
  currentThumbnailUrl,
  onSuccess,
}: ThumbnailStyleDialogProps) {
  const [style, setStyle] = useState<ThumbnailStyle>("normal");
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const generateThumbnailFromUrl = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";

      const timeout = setTimeout(() => {
        resolve(null);
      }, 15000);

      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 180;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            clearTimeout(timeout);
            resolve(null);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          clearTimeout(timeout);
          resolve(dataUrl);
        } catch {
          clearTimeout(timeout);
          resolve(null);
        }
      };

      video.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };

      video.src = url;
    });
  };

  const applyDrawingStyle = async (imageDataUrl: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("stylize-thumbnail", {
        body: { imageDataUrl, style: "drawing" },
      });

      if (error) {
        console.error("Edge function error:", error);
        return null;
      }

      return data?.styledImageUrl || null;
    } catch (error) {
      console.error("Error calling stylize function:", error);
      return null;
    }
  };

  const applyStickerStyle = async (imageDataUrl: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("stylize-thumbnail", {
        body: { imageDataUrl, style: "sticker" },
      });

      if (error) {
        console.error("Edge function error:", error);
        return null;
      }

      return data?.styledImageUrl || null;
    } catch (error) {
      console.error("Error calling sticker function:", error);
      return null;
    }
  };

  const uploadThumbnailToStorage = async (
    thumbnailDataUrl: string
  ): Promise<string | null> => {
    try {
      const response = await fetch(thumbnailDataUrl);
      const blob = await response.blob();

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return null;

      const objectName = `${userData.user.id}/thumbnails/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("exercice-videos")
        .upload(objectName, blob, {
          cacheControl: "3600",
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error("Thumbnail upload error:", uploadError);
        return null;
      }

      const { data } = supabase.storage
        .from("exercice-videos")
        .getPublicUrl(objectName);
      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      return null;
    }
  };

  const handleApply = async () => {
    setIsProcessing(true);
    setPreviewUrl(null);

    try {
      // Step 1: Generate base thumbnail from video
      toast.info("Génération de la vignette...");
      let thumbnailDataUrl = await generateThumbnailFromUrl(videoUrl);

      if (!thumbnailDataUrl) {
        toast.error("Impossible de générer la vignette depuis la vidéo");
        return;
      }

      // Step 2: Apply style if needed
      if (style === "drawing") {
        toast.info("Application du style dessin...");
        const styledUrl = await applyDrawingStyle(thumbnailDataUrl);
        if (styledUrl) {
          thumbnailDataUrl = styledUrl;
        } else {
          toast.error("Erreur lors de l'application du style dessin");
          return;
        }
      } else if (style === "sticker") {
        toast.info("Ajout des stickers sur les visages...");
        const styledUrl = await applyStickerStyle(thumbnailDataUrl);
        if (styledUrl) {
          thumbnailDataUrl = styledUrl;
        } else {
          toast.error("Erreur lors de l'ajout des stickers");
          return;
        }
      }

      // Step 3: Upload to storage
      toast.info("Enregistrement de la vignette...");
      const uploadedUrl = await uploadThumbnailToStorage(thumbnailDataUrl);

      if (!uploadedUrl) {
        toast.error("Erreur lors de l'upload de la vignette");
        return;
      }

      // Step 4: Update video record
      const { error: updateError } = await supabase
        .from("videos")
        .update({ thumbnail_url: uploadedUrl })
        .eq("id", videoId);

      if (updateError) {
        throw updateError;
      }

      toast.success("Vignette mise à jour avec succès");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error applying style:", error);
      toast.error("Erreur lors de la génération de la vignette");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Style de la vignette</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current thumbnail preview */}
          {currentThumbnailUrl && (
            <div className="space-y-2">
              <Label>Vignette actuelle</Label>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={currentThumbnailUrl}
                  alt="Vignette actuelle"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Style selection */}
          <div className="space-y-3">
            <Label>Choisir un style</Label>
            <RadioGroup
              value={style}
              onValueChange={(v) => setStyle(v as ThumbnailStyle)}
              className="grid gap-3"
            >
              <div className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Image className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Normal</div>
                    <div className="text-sm text-muted-foreground">
                      Vignette standard extraite de la vidéo
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="sticker" id="sticker" />
                <Label htmlFor="sticker" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Smile className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Sticker sur visages</div>
                    <div className="text-sm text-muted-foreground">
                      Détecte et masque les visages avec des emojis
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="drawing" id="drawing" />
                <Label htmlFor="drawing" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Pencil className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Style dessin</div>
                    <div className="text-sm text-muted-foreground">
                      Transforme la vignette en illustration artistique
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Preview if available */}
          {previewUrl && (
            <div className="space-y-2">
              <Label>Aperçu</Label>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Aperçu"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          <Button
            onClick={handleApply}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Traitement en cours...
              </>
            ) : (
              "Appliquer le style"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
