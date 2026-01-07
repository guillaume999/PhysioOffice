import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Edit, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  comment: string;
  onSave: (comment: string) => Promise<void>;
  saving?: boolean;
}

export function CommentDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  comment,
  onSave,
  saving = false,
}: CommentDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(comment);

  // Reset state when dialog opens/closes or comment changes
  useEffect(() => {
    if (open) {
      setValue(comment);
      // Start in edit mode if no comment exists
      setIsEditing(!comment);
    } else {
      setIsEditing(false);
    }
  }, [open, comment]);

  const handleSave = async () => {
    await onSave(value);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(comment);
    if (comment) {
      setIsEditing(false);
    } else {
      onOpenChange(false);
    }
  };

  const hasComment = comment && comment.trim().length > 0;
  const hasChanges = value !== comment;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          {subtitle && (
            <DialogDescription className="text-sm">
              {subtitle}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4 flex-1 min-h-0">
          {isEditing ? (
            <ScrollArea className="h-[50vh] max-h-[400px]">
              <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Saisissez votre commentaire ici..."
                className="min-h-[200px] text-base resize-y"
                autoFocus
              />
            </ScrollArea>
          ) : hasComment ? (
            <ScrollArea className="h-[50vh] max-h-[400px]">
              <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed pr-4">
                {comment}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm">Aucun commentaire</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Ajouter un commentaire
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t gap-2 sm:gap-0">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !hasChanges}
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </>
          ) : hasComment ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Fermer
              </Button>
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
