import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { XCircle } from "lucide-react";
import { pb } from "@/integrations/pocketbase/client";
import { useToast } from "@/hooks/use-toast";

interface RejectExerciceDialogProps {
  exerciceId: string | null;
  exerciceTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RejectExerciceDialog({
  exerciceId,
  exerciceTitle,
  open,
  onOpenChange,
  onSuccess,
}: RejectExerciceDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleReject = async () => {
    if (!exerciceId) return;
    
    if (!rejectionReason.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un motif de refus.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await pb.collection("exercices").update(exerciceId, { status: "rejected", rejection_reason: rejectionReason.trim() });

      toast({
        title: "Exercice refusé",
        description: "L'exercice a été refusé avec le motif indiqué.",
      });
      setRejectionReason("");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error rejecting exercice:", error);
      toast({
        title: "Erreur",
        description: "Impossible de refuser l'exercice.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRejectionReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="w-5 h-5" />
            Refuser l'exercice
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Vous êtes sur le point de refuser l'exercice : <strong>{exerciceTitle}</strong>
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Motif du refus *</Label>
            <Textarea
              id="rejection-reason"
              placeholder="Expliquez pourquoi cet exercice est refusé..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={loading || !rejectionReason.trim()}
            className="gap-1"
          >
            <XCircle className="w-4 h-4" />
            Confirmer le refus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
