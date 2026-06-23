import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Save, Send, ShieldCheck, Clock, AlertTriangle } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Agency = Tables<"agencies">;

const AgencySettings = () => {
  const { agencyId, refreshAgency } = useAuth();
  const [agency, setAgency] = useState<Partial<Agency>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!agencyId) return;
    const fetch = async () => {
      const { data } = await supabase.from("agencies").select("*").eq("id", agencyId).single();
      if (data) setAgency(data);
      setLoading(false);
    };
    fetch();
  }, [agencyId]);

  const status = agency.status || "pending_setup";
  const readOnly = status === "pending_review" || status === "suspended";

  const save = async () => {
    if (!agencyId) return;
    const { error } = await supabase.from("agencies").update({
      name: agency.name,
      email: agency.email,
      phone: agency.phone,
      address: agency.address,
      logo: agency.logo,
    }).eq("id", agencyId);
    if (error) { toast.error(error.message); return; }
    toast.success("Informations enregistrées");
  };

  const submitForReview = async () => {
    if (!agencyId) return;
    if (!agency.name || !agency.phone || !agency.address) {
      toast.error("Veuillez compléter nom, téléphone et adresse avant de soumettre");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("agencies").update({
      name: agency.name,
      email: agency.email,
      phone: agency.phone,
      address: agency.address,
      logo: agency.logo,
      status: "pending_review",
    }).eq("id", agencyId);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profil soumis pour validation");
    setAgency(p => ({ ...p, status: "pending_review" }));
    await refreshAgency();
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const StatusBanner = () => {
    if (status === "pending_setup") return (
      <div className="flex gap-3 p-4 rounded-lg bg-warning/10 border border-warning/30">
        <AlertTriangle className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">Compléter votre profil</p>
          <p className="text-muted-foreground">Renseignez vos informations puis soumettez votre agence pour validation par l'administration.</p>
        </div>
      </div>
    );
    if (status === "pending_review") return (
      <div className="flex gap-3 p-4 rounded-lg bg-primary/10 border border-primary/30">
        <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">En attente de validation</p>
          <p className="text-muted-foreground">Votre profil est en cours d'examen. Une fois activé, vos trajets seront visibles par les voyageurs.</p>
        </div>
      </div>
    );
    if (status === "active") return (
      <div className="flex gap-3 p-4 rounded-lg bg-accent/10 border border-accent/30">
        <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">Agence active</p>
          <p className="text-muted-foreground">Votre agence est visible publiquement et peut recevoir des réservations.</p>
        </div>
      </div>
    );
    if (status === "suspended") return (
      <div className="flex gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">Agence suspendue</p>
          <p className="text-muted-foreground">Contactez l'administration pour plus d'informations.</p>
        </div>
      </div>
    );
    return null;
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Paramètres de l'agence</h1>
      <StatusBanner />

      <Card>
        <CardHeader><CardTitle className="text-lg">Informations générales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nom de l'agence</label>
            <Input disabled={readOnly} value={agency.name || ""} onChange={e => setAgency(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Logo (emoji)</label>
            <Input disabled={readOnly} value={agency.logo || ""} onChange={e => setAgency(p => ({ ...p, logo: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input disabled={readOnly} value={agency.email || ""} onChange={e => setAgency(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Téléphone</label>
              <Input disabled={readOnly} value={agency.phone || ""} onChange={e => setAgency(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Adresse</label>
            <Input disabled={readOnly} value={agency.address || ""} onChange={e => setAgency(p => ({ ...p, address: e.target.value }))} />
          </div>

          <div className="pt-2 p-3 rounded-lg bg-secondary/50 text-sm">
            <p className="text-muted-foreground">Taux de commission : <span className="font-semibold text-foreground">{agency.commission_rate}%</span></p>
            <p className="text-xs text-muted-foreground mt-1">Ce taux est défini par l'administration de la plateforme.</p>
          </div>

          {!readOnly && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={save} variant="outline">
                <Save className="h-4 w-4 mr-1" /> Enregistrer
              </Button>
              {status === "pending_setup" && (
                <Button onClick={submitForReview} disabled={submitting} className="gradient-primary text-primary-foreground">
                  <Send className="h-4 w-4 mr-1" /> Soumettre pour validation
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencySettings;
