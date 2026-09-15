import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Save, MessageCircle, Clock, MapPin, Copy, Building2 } from "lucide-react";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

type Day = { day: string; open: string; close: string; closed: boolean };

const defaultHours = (): Day[] =>
  DAYS.map((day) => ({ day, open: "07:00", close: "18:00", closed: day === "Dimanche" }));

const normalizeHours = (value: any): Day[] => {
  if (!Array.isArray(value) || value.length !== 7) return defaultHours();
  return DAYS.map((day, i) => ({
    day,
    open: value[i]?.open || "07:00",
    close: value[i]?.close || "18:00",
    closed: !!value[i]?.closed,
  }));
};

const HoursEditor = ({ value, onChange }: { value: Day[]; onChange: (v: Day[]) => void }) => {
  const set = (i: number, patch: Partial<Day>) =>
    onChange(value.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  return (
    <div className="space-y-2">
      {value.map((d, i) => (
        <div key={d.day} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2">
          <span className="w-24 text-sm font-medium">{d.day}</span>
          <div className="flex items-center gap-2">
            <Switch
              checked={!d.closed}
              onCheckedChange={(v) => set(i, { closed: !v })}
              aria-label={`Ouvert le ${d.day}`}
            />
            <span className="text-xs text-muted-foreground w-14">{d.closed ? "Fermé" : "Ouvert"}</span>
          </div>
          <Input
            type="time"
            className="w-32"
            disabled={d.closed}
            value={d.open}
            onChange={(e) => set(i, { open: e.target.value })}
          />
          <span className="text-muted-foreground text-sm">à</span>
          <Input
            type="time"
            className="w-32"
            disabled={d.closed}
            value={d.close}
            onChange={(e) => set(i, { close: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
};

const AgencyContactSettings = () => {
  const { agencyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState<any>(null);
  const [agencyHours, setAgencyHours] = useState<Day[]>(defaultHours());
  const [branches, setBranches] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    if (!agencyId) return;
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from("agencies").select("*").eq("id", agencyId).maybeSingle(),
      supabase
        .from("agency_branches")
        .select("*")
        .eq("agency_id", agencyId)
        .order("name"),
    ]);
    setAgency(a);
    setAgencyHours(normalizeHours((a as any)?.opening_hours));
    setBranches(
      ((b as any[]) || []).map((br) => ({
        ...br,
        opening_hours: normalizeHours(br.opening_hours),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  const saveAgency = async () => {
    if (!agencyId) return;
    setSaving("agency");
    const { error } = await supabase
      .from("agencies")
      .update({
        whatsapp_number: agency?.whatsapp_number || null,
        official_address: agency?.official_address || null,
        opening_hours: agencyHours,
      } as any)
      .eq("id", agencyId);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Paramètres de l'agence enregistrés");
  };

  const setBranch = (id: string, patch: any) =>
    setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const saveBranch = async (b: any) => {
    setSaving(b.id);
    const { error } = await supabase
      .from("agency_branches")
      .update({
        whatsapp_number: b.whatsapp_number || null,
        whatsapp_enabled: !!b.whatsapp_enabled,
        official_address: b.official_address || null,
        opening_hours: b.opening_hours,
      } as any)
      .eq("id", b.id);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${b.name} : paramètres enregistrés`);
  };

  const copyAgencyHours = (id: string) => {
    setBranch(id, { opening_hours: agencyHours.map((d) => ({ ...d })) });
    toast.success("Horaires de l'agence copiés");
  };

  const summary = (hours: Day[]) => {
    const open = hours.filter((d) => !d.closed);
    if (open.length === 0) return "Fermé toute la semaine";
    return `${open.length} jour(s) ouverts · ${open[0].open}–${open[0].close}`;
  };

  const missingWhatsapp = useMemo(
    () => branches.filter((b) => !b.whatsapp_number && !agency?.whatsapp_number).length,
    [branches, agency]
  );

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Coordonnées & horaires</h1>
        <p className="text-sm text-muted-foreground">
          Numéros WhatsApp, horaires d'ouverture et adresse officielle de l'agence et de ses sous-agences.
        </p>
      </div>

      {missingWhatsapp > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          {missingWhatsapp} sous-agence(s) sans numéro WhatsApp : les messages ne partiront pas depuis ces guichets.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-4 w-4" /> {agency?.name || "Agence"} — paramètres par défaut
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1"><MessageCircle className="h-4 w-4" /> Numéro WhatsApp</label>
              <Input
                placeholder="+242 06 000 00 00"
                value={agency?.whatsapp_number || ""}
                onChange={(e) => setAgency((p: any) => ({ ...p, whatsapp_number: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Utilisé si une sous-agence n'a pas son propre numéro.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1"><MapPin className="h-4 w-4" /> Adresse officielle</label>
              <Input
                placeholder="Siège social, ville"
                value={agency?.official_address || ""}
                onChange={(e) => setAgency((p: any) => ({ ...p, official_address: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1"><Clock className="h-4 w-4" /> Horaires d'ouverture</label>
            <HoursEditor value={agencyHours} onChange={setAgencyHours} />
          </div>
          <Button onClick={saveAgency} disabled={saving === "agency"} className="gradient-primary text-primary-foreground">
            <Save className="h-4 w-4 mr-1" /> Enregistrer
          </Button>
        </CardContent>
      </Card>

      {branches.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune sous-agence pour le moment.</p>
      ) : (
        branches.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">
                {b.name}
                <span className="block text-xs font-normal text-muted-foreground">
                  {[b.district, b.city].filter(Boolean).join(", ")} · {summary(b.opening_hours)}
                </span>
              </CardTitle>
              <Badge variant={b.whatsapp_enabled ? "default" : "secondary"}>
                {b.whatsapp_enabled ? "WhatsApp actif" : "WhatsApp désactivé"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1"><MessageCircle className="h-4 w-4" /> Numéro WhatsApp</label>
                  <Input
                    placeholder={agency?.whatsapp_number || "+242 06 000 00 00"}
                    value={b.whatsapp_number || ""}
                    onChange={(e) => setBranch(b.id, { whatsapp_number: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!b.whatsapp_enabled}
                      onCheckedChange={(v) => setBranch(b.id, { whatsapp_enabled: v })}
                      aria-label="Activer WhatsApp"
                    />
                    <span className="text-xs text-muted-foreground">Envoyer les messages WhatsApp depuis ce guichet</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1"><MapPin className="h-4 w-4" /> Adresse officielle</label>
                  <Input
                    placeholder={b.address || "Adresse affichée sur les billets"}
                    value={b.official_address || ""}
                    onChange={(e) => setBranch(b.id, { official_address: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-1"><Clock className="h-4 w-4" /> Horaires d'ouverture</label>
                  <Button size="sm" variant="ghost" onClick={() => copyAgencyHours(b.id)}>
                    <Copy className="h-4 w-4 mr-1" /> Copier ceux de l'agence
                  </Button>
                </div>
                <HoursEditor value={b.opening_hours} onChange={(v) => setBranch(b.id, { opening_hours: v })} />
              </div>

              <Button onClick={() => saveBranch(b)} disabled={saving === b.id} variant="outline">
                <Save className="h-4 w-4 mr-1" /> Enregistrer {b.name}
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default AgencyContactSettings;
