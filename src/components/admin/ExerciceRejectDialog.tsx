import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ExerciceRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  exerciceTitle: string;
}

export function ExerciceRejectDialog({
  open,
  onOpenChange,
  onConfirm,
  exerciceTitle,
}: ExerciceRejectDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason);
    setReason("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Refuser l'exercice</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Vous êtes sur le point de refuser le partage de l'exercice{" "}
              <strong>"{exerciceTitle}"</strong>.
            </p>
            <p>Veuillez indiquer la raison du refus.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="rejection-reason">Raison du refus</Label>
          <Textarea
            id="rejection-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Vidéo de mauvaise qualité, description incomplète..."
            className="mt-2"
            rows={4}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Annuler</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            disabled={!reason.trim()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Refuser
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
