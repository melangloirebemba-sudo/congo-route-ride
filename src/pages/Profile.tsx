import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User as UserIcon,
  Mail,
  Phone,
  LogOut,
  Ticket,
  Shield,
  Building2,
  ChevronRight,
  LogIn,
  Bell,
  HelpCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin, agencyId, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    if (user) {
      setFullName(
        (user.user_metadata?.full_name as string) ||
          (user.user_metadata?.name as string) ||
          ""
      );
      setPhoneNumber(user.phone || (user.user_metadata?.phone as string) || "");
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Déconnecté");
    navigate("/");
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName, phone: phoneNumber },
      });
      if (error) throw error;
      toast.success("Profil mis à jour");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Not authenticated → invite to login
  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24 px-4 pt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto text-center space-y-6"
        >
          <div className="mx-auto w-20 h-20 rounded-full gradient-primary flex items-center justify-center">
            <UserIcon className="h-10 w-10 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Bienvenue sur TransCongo</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Connectez-vous pour accéder à votre profil et gérer vos voyages.
            </p>
          </div>
          <Button
            onClick={() => navigate("/auth")}
            className="w-full gradient-primary text-primary-foreground h-12 font-display font-semibold"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Se connecter / Créer un compte
          </Button>
        </motion.div>
      </div>
    );
  }

  const initials = (fullName || user.email || "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const menuItems = [
    {
      icon: Ticket,
      label: "Mes billets",
      onClick: () => navigate("/bookings"),
    },
    ...(isAdmin
      ? [{ icon: Shield, label: "Panneau Admin", onClick: () => navigate("/admin") }]
      : []),
    ...(agencyId
      ? [{ icon: Building2, label: "Espace Agence", onClick: () => navigate("/agency") }]
      : []),
    { icon: Bell, label: "Préférences de notifications", onClick: () => navigate("/preferences") },
    { icon: HelpCircle, label: "Aide & Support", onClick: () => toast.info("Bientôt disponible") },
    { icon: FileText, label: "Conditions d'utilisation", onClick: () => toast.info("Bientôt disponible") },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="gradient-primary px-4 pt-12 pb-8 text-primary-foreground">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto flex items-center gap-4"
        >
          <Avatar className="h-16 w-16 border-2 border-primary-foreground/40">
            <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground font-display font-bold text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold truncate">
              {fullName || "Voyageur TransCongo"}
            </h1>
            <p className="text-sm text-primary-foreground/80 truncate">{user.email || user.phone}</p>
            <div className="flex gap-2 mt-1">
              {isAdmin && (
                <span className="text-[10px] bg-primary-foreground/20 px-2 py-0.5 rounded-full">
                  Admin
                </span>
              )}
              {agencyId && (
                <span className="text-[10px] bg-primary-foreground/20 px-2 py-0.5 rounded-full">
                  Agence
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-4 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 space-y-4"
        >
          <h2 className="font-display font-semibold">Informations personnelles</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="fullName" className="text-xs">Nom complet</Label>
              <div className="relative mt-1">
                <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Votre nom"
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email" className="text-xs">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" value={user.email || ""} disabled className="pl-10" />
              </div>
            </div>
            <div>
              <Label htmlFor="phone" className="text-xs">Téléphone</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+242 06 XXX XXXX"
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full gradient-primary text-primary-foreground"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl overflow-hidden"
        >
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={item.onClick}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/40 transition-colors border-b border-border/40 last:border-b-0"
            >
              <item.icon className="h-5 w-5 text-primary" />
              <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </motion.div>

        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full h-12 text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Se déconnecter
        </Button>
      </div>
    </div>
  );
};

export default Profile;
