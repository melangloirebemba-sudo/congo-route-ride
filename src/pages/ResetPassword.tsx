import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, AlertCircle } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase places the recovery token in the URL hash and auto-consumes it
    // via detectSessionInUrl. We listen for the PASSWORD_RECOVERY event.
    const hash = window.location.hash || "";
    const hasRecovery = hash.includes("type=recovery") || hash.includes("access_token");

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && hasRecovery)) {
        setReady(true);
      }
    });

    // If already have a session (link was consumed on load), enable form
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && hasRecovery) setReady(true);
      else if (!hasRecovery) {
        setInvalid("Lien invalide ou expiré. Demandez un nouveau lien de réinitialisation.");
      }
    });

    // Fallback: if nothing happens within 3s, show invalid message
    const t = setTimeout(() => {
      if (!ready && !hasRecovery) {
        setInvalid("Lien invalide ou expiré.");
      }
    }, 3000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mot de passe mis à jour");
    setDone(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <KeyRound className="h-5 w-5 text-primary" />
            Réinitialiser le mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {invalid && !ready ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="space-y-2">
                <p>{invalid}</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
                  Retour à la connexion
                </Button>
              </div>
            </div>
          ) : done ? (
            <div className="flex items-center gap-2 text-sm text-primary">
              <ShieldCheck className="h-4 w-4" /> Mot de passe mis à jour. Redirection...
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Nouveau mot de passe</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={!ready}
                />
              </div>
              <div>
                <Label>Confirmer le mot de passe</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                  disabled={!ready}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!ready || submitting}>
                {submitting ? "Mise à jour..." : ready ? "Mettre à jour" : "Vérification du lien..."}
              </Button>
              <p className="text-xs text-muted-foreground">
                Le lien de réinitialisation est à usage unique et expire rapidement.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
