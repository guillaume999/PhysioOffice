import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePagePopup } from "@/hooks/usePagePopup";

interface PagePopupProps {
  pageKey: string;
}

export function PagePopup({ pageKey }: PagePopupProps) {
  const { popup, shouldShowPopup, dismissPopup } = usePagePopup(pageKey);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  if (!shouldShowPopup || !popup) return null;

  const handleClose = () => {
    dismissPopup(dontShowAgain);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{popup.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap">
            {popup.content}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-4 sm:flex-col">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label htmlFor="dont-show-again" className="text-sm text-muted-foreground cursor-pointer">
              Ne plus afficher ce message
            </Label>
          </div>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            Compris
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
