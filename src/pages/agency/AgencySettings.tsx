import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Save } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Agency = Tables<"agencies">;

const AgencySettings = () => {
  const { agencyId } = useAuth();
  const [agency, setAgency] = useState<Partial<Agency>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agencyId) return;
    const fetch = async () => {
      const { data } = await supabase.from("agencies").select("*").eq("id", agencyId).single();
      if (data) setAgency(data);
      setLoading(false);
    };
    fetch();
  }, [agencyId]);

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
    toast.success("Informations mises à jour");
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Paramètres de l'agence</h1>

      <Card>
        <CardHeader><CardTitle className="text-lg">Informations générales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nom de l'agence</label>
            <Input value={agency.name || ""} onChange={e => setAgency(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Logo (emoji)</label>
            <Input value={agency.logo || ""} onChange={e => setAgency(p => ({ ...p, logo: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={agency.email || ""} onChange={e => setAgency(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Téléphone</label>
              <Input value={agency.phone || ""} onChange={e => setAgency(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Adresse</label>
            <Input value={agency.address || ""} onChange={e => setAgency(p => ({ ...p, address: e.target.value }))} />
          </div>

          <div className="pt-2 p-3 rounded-lg bg-secondary/50 text-sm">
            <p className="text-muted-foreground">Taux de commission : <span className="font-semibold text-foreground">{agency.commission_rate}%</span></p>
            <p className="text-xs text-muted-foreground mt-1">Ce taux est défini par l'administration de la plateforme.</p>
          </div>

          <Button onClick={save} className="gradient-primary text-primary-foreground">
            <Save className="h-4 w-4 mr-1" /> Enregistrer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencySettings;
