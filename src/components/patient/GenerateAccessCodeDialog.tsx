import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pb } from "@/integrations/pocketbase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Copy, Loader2, Clock, ExternalLink, Check } from "lucide-react";

interface GenerateAccessCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seanceTypeId: string;
  seanceName: string;
  patientId: string;
  patientName: string;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function GenerateAccessCodeDialog({
  open,
  onOpenChange,
  seanceTypeId,
  seanceName,
  patientId,
  patientName,
}: GenerateAccessCodeDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      const code = generateCode();
      const expires = new Date();
      expires.setHours(expires.getHours() + 4);

      try {
        await pb.collection("patient_session_access").create({
          seance_type: seanceTypeId,
          patient: patientId,
          access_code: code,
          expires_at: expires.toISOString(),
          user: user.id,
        });
      } catch(e: any) {
        if (e?.status === 400 && JSON.stringify(e).includes("unique")) {
          handleGenerate(); return;
        }
        throw e;
      }

      setGeneratedCode(code);
      setExpiresAt(expires);
      toast.success("Code d'accès généré");
    } catch (error) {
      console.error("Error generating access code:", error);
      toast.error("Erreur lors de la génération du code");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast.success("Code copié");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    if (!generatedCode) return;
    const link = `${window.location.origin}/patient-session?code=${generatedCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Lien copié");
  };

  const handleClose = () => {
    setGeneratedCode(null);
    setExpiresAt(null);
    setCopied(false);
    onOpenChange(false);
  };

  const formatExpiration = () => {
    if (!expiresAt) return "";
    return expiresAt.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Accès temporaire patient</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <p className="text-sm text-muted-foreground">
            Générez un code d'accès temporaire pour que <strong>{patientName}</strong> puisse consulter la séance <strong>{seanceName}</strong>.
          </p>

          {!generatedCode ? (
            <Button onClick={handleGenerate} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Génération...
                </>
              ) : (
                "Générer un code d'accès"
              )}
            </Button>
          ) : (
            <div className="space-y-4">
              {/* Code display */}
              <div className="space-y-2">
                <Label>Code d'accès</Label>
                <div className="flex gap-2">
                  <Input
                    value={generatedCode}
                    readOnly
                    className="text-center text-2xl tracking-[0.5em] font-mono font-bold"
                  />
                  <Button variant="outline" size="icon" onClick={copyCode}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Expiration */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">
                  Valide jusqu'à <strong>{formatExpiration()}</strong> (4 heures)
                </span>
              </div>

              {/* Link */}
              <div className="space-y-2">
                <Label>Ou partagez ce lien</Label>
                <div className="flex gap-2">
                  <Input
                    value={`${window.location.origin}/patient-session?code=${generatedCode}`}
                    readOnly
                    className="text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Preview button */}
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => window.open(`/patient-session?code=${generatedCode}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
                Prévisualiser la page patient
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
