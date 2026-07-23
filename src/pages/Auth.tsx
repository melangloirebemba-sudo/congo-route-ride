import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const redirectByRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate("/");
    const [{ data: isAdmin }, { data: agency }, { data: mgr }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      supabase.from("agencies").select("id").eq("owner_id", user.id).limit(1).maybeSingle(),
      supabase.from("branch_managers" as any).select("id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    ]);
    if (isAdmin) return navigate("/admin");
    if (agency) return navigate("/agency");
    if (mgr) return navigate("/manager");
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
                : "Accédez à votre compte TransCongo"}
            </p>
          </div>

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
