import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Phone, Lock, ArrowLeft, Eye, EyeOff, User, Building2, Briefcase, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AuthMode = "login" | "signup" | "otp-request" | "otp-verify";
type RoleTab = "client" | "agency" | "manager" | "admin";


const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const claimQr = params.get("claim");
  const claimPhone = params.get("phone");
  const prefillEmail = params.get("email") || "";
  const [role, setRole] = useState<RoleTab>("client");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const tryClaim = async () => {
    if (!claimQr || !claimPhone) return false;
    const { data, error } = await supabase.rpc("claim_booking_by_ref", { _qr: claimQr, _phone: claimPhone });
    if (error) { toast.error(error.message); return false; }
    const r: any = data;
    if (r?.ok) {
      toast.success(r.message || "Billet rattaché à votre compte");
      navigate(r.booking_id ? `/bookings/${r.booking_id}` : "/reservations");
      return true;
    }
    toast.error(r?.message || "Impossible de récupérer le billet");
    return false;
  };

  const redirectByRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate("/");
    const [{ data: isAdmin }, { data: agency }, { data: mgr }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      supabase.from("agencies").select("id").eq("owner_id", user.id).limit(1).maybeSingle(),
      supabase.from("branch_managers" as any).select("id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    ]);

    const actual: RoleTab = isAdmin ? "admin" : agency ? "agency" : mgr ? "manager" : "client";
    if (role !== "client" && role !== actual) {
      await supabase.auth.signOut();
      const labels: Record<RoleTab, string> = {
        client: "Client",
        agency: "Propriétaire d'agence",
        manager: "Gestionnaire de sous-agence",
        admin: "Super Admin",
      };
      toast.error(`Ce compte n'est pas un compte ${labels[role]}. Utilisez l'onglet ${labels[actual]}.`);
      return;
    }

    if (actual === "client" && claimQr && claimPhone) {
      const claimed = await tryClaim();
      if (claimed) return;
    }

    if (actual === "admin") return navigate("/admin");
    if (actual === "agency") return navigate("/agency");
    if (actual === "manager") return navigate("/manager");
    navigate("/");
  };




  const handleEmailAuth = async () => {
    if (!email || !password) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Compte créé ! Vérifiez votre email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Connexion réussie !");
        await redirectByRole();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpRequest = async () => {
    if (!phone) {
      toast.error("Entrez votre numéro de téléphone");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      toast.success("Code OTP envoyé !");
      setMode("otp-verify");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (!otpCode) {
      toast.error("Entrez le code OTP");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otpCode,
        type: "sms",
      });
      if (error) throw error;
      toast.success("Connexion réussie !");
      await redirectByRole();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>

        {claimQr && (
          <div className="mb-4 rounded-xl border-2 border-primary/40 bg-primary/5 p-4 text-sm space-y-1">
            <p className="font-display font-semibold">Récupérez votre billet invité</p>
            <p className="text-xs text-muted-foreground">
              Connectez-vous avec votre compte pour rattacher automatiquement le billet <span className="font-mono">{claimQr}</span>.
              Le numéro de téléphone doit correspondre à celui utilisé lors de la réservation.
            </p>
          </div>
        )}
        <div className="glass rounded-2xl p-6 space-y-6">
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold">
              {mode === "login" && "Connexion"}
              {mode === "signup" && "Créer un compte"}
              {mode === "otp-request" && "Connexion par téléphone"}
              {mode === "otp-verify" && "Vérification OTP"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === "otp-verify"
                ? `Code envoyé au ${phone}`
                : role === "client"
                ? "Accédez à votre compte TransCongo"
                : role === "agency"
                ? "Espace propriétaire d'agence"
                : role === "manager"
                ? "Espace gestionnaire de sous-agence"
                : "Espace Super Admin"}
            </p>
          </div>

          <Tabs value={role} onValueChange={(v) => { setRole(v as RoleTab); setMode("login"); }}>
            <TabsList className="grid grid-cols-4 w-full h-auto">
              <TabsTrigger value="client" className="flex-col gap-1 py-2 text-[11px]"><User className="h-3.5 w-3.5" />Client</TabsTrigger>
              <TabsTrigger value="agency" className="flex-col gap-1 py-2 text-[11px]"><Building2 className="h-3.5 w-3.5" />Agence</TabsTrigger>
              <TabsTrigger value="manager" className="flex-col gap-1 py-2 text-[11px]"><Briefcase className="h-3.5 w-3.5" />Guichet</TabsTrigger>
              <TabsTrigger value="admin" className="flex-col gap-1 py-2 text-[11px]"><ShieldCheck className="h-3.5 w-3.5" />Admin</TabsTrigger>
            </TabsList>
            <TabsContent value={role} className="mt-0" />
          </Tabs>

          {role !== "client" && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              {role === "agency" && "Les comptes agence sont créés par l'administrateur. Utilisez les identifiants qui vous ont été communiqués."}
              {role === "manager" && "Les comptes gestionnaire sont créés par votre agence principale. Contactez-la si vous avez perdu votre accès."}
              {role === "admin" && "Accès réservé aux administrateurs de la plateforme."}
            </div>
          )}

          {(mode === "login" || mode === "signup") && (
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={handleEmailAuth}
                disabled={loading}
                className="w-full gradient-primary text-primary-foreground h-12 font-display font-semibold"
              >
                {loading ? "Chargement..." : mode === "login" ? "Se connecter" : "Créer le compte"}
              </Button>

              {role === "client" && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">ou</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setMode("otp-request")}
                    className="w-full h-12"
                  >
                    <Phone className="mr-2 h-4 w-4" /> Connexion par téléphone
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    {mode === "login" ? (
                      <>Pas de compte ?{" "}
                        <button onClick={() => setMode("signup")} className="text-primary font-medium">
                          Créer un compte
                        </button>
                      </>
                    ) : (
                      <>Déjà un compte ?{" "}
                        <button onClick={() => setMode("login")} className="text-primary font-medium">
                          Se connecter
                        </button>
                      </>
                    )}
                  </p>
                </>
              )}

              {role !== "client" && (
                <p className="text-center text-xs text-muted-foreground">
                  Mot de passe oublié ?{" "}
                  <button
                    onClick={async () => {
                      if (!email) { toast.error("Entrez d'abord votre email"); return; }
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) toast.error(error.message);
                      else toast.success("Email de réinitialisation envoyé");
                    }}
                    className="text-primary font-medium"
                  >
                    Réinitialiser
                  </button>
                </p>
              )}
            </div>
          )}


          {mode === "otp-request" && (
            <div className="space-y-4">
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="+242 06 XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={handleOtpRequest}
                disabled={loading}
                className="w-full gradient-primary text-primary-foreground h-12 font-display font-semibold"
              >
                {loading ? "Envoi..." : "Envoyer le code OTP"}
              </Button>
              <button
                onClick={() => setMode("login")}
                className="w-full text-center text-sm text-muted-foreground"
              >
                Retour à la connexion par email
              </button>
            </div>
          )}

          {mode === "otp-verify" && (
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Entrez le code à 6 chiffres"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="text-center text-2xl tracking-widest font-display"
                maxLength={6}
              />
              <Button
                onClick={handleOtpVerify}
                disabled={loading}
                className="w-full gradient-primary text-primary-foreground h-12 font-display font-semibold"
              >
                {loading ? "Vérification..." : "Vérifier"}
              </Button>
              <button
                onClick={() => setMode("otp-request")}
                className="w-full text-center text-sm text-muted-foreground"
              >
                Renvoyer le code
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
