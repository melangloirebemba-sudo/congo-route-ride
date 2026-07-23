import { useState, ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SignOutConfirmProps {
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
}

/**
 * Wraps a trigger (button/icon) with an accessible confirmation dialog
 * before executing sign-out. Prevents accidental clicks.
 */
export const SignOutConfirm = ({ onConfirm, children }: SignOutConfirmProps) => {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Se déconnecter ?</AlertDialogTitle>
          <AlertDialogDescription>
            Vous serez redirigé vers l'écran de connexion. Toute action non enregistrée sera perdue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm()}>Déconnexion</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
