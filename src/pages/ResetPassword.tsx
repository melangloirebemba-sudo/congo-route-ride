import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, AlertCircle, Mail } from "lucide-react";

type InvalidState = {
  title: string;
  message: string;
} | null;

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState<InvalidState>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const COOLDOWN_SECONDS = 60;
  const cooldownKey = (email: string) => `reset-link-cooldown:${email.trim().toLowerCase()}`;

  // Recompute cooldown whenever the email changes (per-address throttle)
  useEffect(() => {
    if (!resendEmail) { setCooldown(0); return; }
    try {
      const until = Number(localStorage.getItem(cooldownKey(resendEmail)) || 0);
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setCooldown(remaining);
    } catch { setCooldown(0); }
  }, [resendEmail]);

  // Tick the countdown every second while active
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    const hash = window.location.hash || "";
    // Supabase encodes errors in the hash: #error=access_denied&error_code=otp_expired&error_description=...
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const errorCode = hashParams.get("error_code");
    const errorParam = hashParams.get("error");
    const errorDesc = hashParams.get("error_description");

    if (errorParam || errorCode) {
      const decoded = errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, " ")) : "";
      if (errorCode === "otp_expired" || /expired/i.test(decoded)) {
        setInvalid({
          title: "Lien expiré",
          message: "Ce lien de réinitialisation a expiré. Demandez un nouveau lien ci-dessous.",
        });
      } else if (errorCode === "access_denied" || /invalid|used/i.test(decoded)) {
        setInvalid({
          title: "Lien invalide ou déjà utilisé",
          message: "Ce lien n'est plus valide (déjà utilisé ou incorrect). Demandez-en un nouveau ci-dessous.",
        });
      } else {
        setInvalid({
          title: "Lien invalide",
          message: decoded || "Impossible de valider ce lien. Demandez un nouveau lien ci-dessous.",
        });
      }
      return;
    }

    const hasRecovery = hash.includes("type=recovery") || hash.includes("access_token");

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && hasRecovery)) {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && hasRecovery) setReady(true);
      else if (!hasRecovery) {
        setInvalid({
          title: "Lien invalide ou expiré",
          message: "Aucun jeton de récupération détecté. Demandez un nouveau lien de réinitialisation.",
        });
      }
    });

    const t = setTimeout(() => {
      if (!ready && !hasRecovery) {
        setInvalid({
          title: "Lien invalide ou expiré",
          message: "Impossible de valider le lien. Demandez un nouveau lien de réinitialisation.",
        });
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
    if (error) {
      // If the session got invalidated (token used/expired between load and submit)
      if (/session|token|expired|jwt/i.test(error.message)) {
        setInvalid({
          title: "Session expirée",
          message: "Votre session de récupération a expiré. Demandez un nouveau lien ci-dessous.",
        });
        return;
      }
      toast.error(error.message);
      return;
    }
    toast.success("Mot de passe mis à jour");
    setDone(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    }, 1500);
  };

  const resend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail || !/^\S+@\S+\.\S+$/.test(resendEmail)) {
      toast.error("Adresse email invalide");
      return;
    }
    // Client-side per-email throttle to prevent spamming the send button
    try {
      const until = Number(localStorage.getItem(cooldownKey(resendEmail)) || 0);
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining > 0) {
        setCooldown(remaining);
        toast.error(`Patientez ${remaining}s avant de renvoyer un lien`);
        return;
      }
    } catch { /* ignore storage errors */ }

    setResending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Start cooldown regardless of whether the address exists (avoids enumeration)
    try {
      localStorage.setItem(
        cooldownKey(resendEmail),
        String(Date.now() + COOLDOWN_SECONDS * 1000),
      );
    } catch { /* ignore */ }
    setCooldown(COOLDOWN_SECONDS);
    setResent(true);
    toast.success("Nouveau lien envoyé — vérifiez votre boîte mail");
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
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium text-destructive">{invalid.title}</p>
                  <p className="text-muted-foreground">{invalid.message}</p>
                </div>
              </div>

              {resent ? (
                <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
                  <p>
                    Si un compte existe pour <strong>{resendEmail}</strong>, un nouveau lien
                    de réinitialisation vient d'être envoyé. Le lien expire rapidement et est
                    à usage unique.
                  </p>
                </div>
              ) : (
                <form onSubmit={resend} className="space-y-3">
                  <div>
                    <Label htmlFor="resend-email">Renvoyer un lien à</Label>
                    <Input
                      id="resend-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={resending || cooldown > 0}>
                    <Mail className="h-4 w-4 mr-2" />
                    {resending
                      ? "Envoi..."
                      : cooldown > 0
                        ? `Renvoi possible dans ${cooldown}s`
                        : "Envoyer un nouveau lien"}
                  </Button>
                  {cooldown > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Pour éviter le spam, attendez {cooldown} seconde{cooldown > 1 ? "s" : ""} avant un nouvel envoi.
                    </p>
                  )}
                </form>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                Retour à la connexion
              </Button>
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
