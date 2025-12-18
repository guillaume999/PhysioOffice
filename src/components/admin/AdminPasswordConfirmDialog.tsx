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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AdminPasswordConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  userEmail: string | null;
  action: "add" | "remove";
}

export function AdminPasswordConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  userEmail,
  action,
}: AdminPasswordConfirmDialogProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!password) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer votre mot de passe.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get current user's email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error("Utilisateur non connecté");
      }

      // Verify password by attempting to sign in
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (error) {
        toast({
          title: "Mot de passe incorrect",
          description: "Le mot de passe que vous avez entré est incorrect.",
          variant: "destructive",
        });
        return;
      }

      // Password verified, proceed with action
      onConfirm();
      onOpenChange(false);
      setPassword("");
    } catch (error) {
      console.error("Error verifying password:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la vérification.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {action === "add" ? "Attribuer le rôle administrateur" : "Retirer le rôle administrateur"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Vous êtes sur le point de{" "}
              {action === "add" ? "donner les droits d'administrateur à" : "retirer les droits d'administrateur de"}{" "}
              <strong>{userEmail || "cet utilisateur"}</strong>.
            </p>
            <p>Pour confirmer cette action sensible, veuillez entrer votre mot de passe.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="admin-password">Votre mot de passe</Label>
          <Input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Entrez votre mot de passe"
            className="mt-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleConfirm();
              }
            }}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading}>
            {loading ? "Vérification..." : "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
