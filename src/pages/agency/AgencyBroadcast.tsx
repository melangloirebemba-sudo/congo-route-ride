import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Info, AlertTriangle, Siren, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Branch = { id: string; name: string; city: string | null };
type Kind = "broadcast_info" | "broadcast_alerte" | "broadcast_urgence";

const KIND_META: Record<Kind, { label: string; icon: any; badge: string }> = {
  broadcast_info:    { label: "Information", icon: Info, badge: "bg-primary/15 text-primary" },
  broadcast_alerte:  { label: "Alerte",      icon: AlertTriangle, badge: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  broadcast_urgence: { label: "Urgence",     icon: Siren, badge: "bg-destructive/15 text-destructive" },
};

const AgencyBroadcast = () => {
  const { agencyId } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<Kind>("broadcast_info");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!agencyId) return;
    supabase
      .from("agency_branches" as any)
      .select("id, name, city")
      .eq("agency_id", agencyId)
      .order("name")
      .then(({ data }) => setBranches(((data as any) || []) as Branch[]));
  }, [agencyId]);

  const toggleAll = (v: boolean) => setSelected(v ? new Set(branches.map((b) => b.id)) : new Set());
  const toggleOne = (id: string, v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id); else next.delete(id);
      return next;
    });
  };

  const send = async () => {
    if (!agencyId) return;
    if (!subject.trim() || !message.trim()) {
      toast.error("Sujet et message obligatoires");
      return;
    }
    if (selected.size === 0) {
      toast.error("Sélectionnez au moins une sous-agence");
      return;
    }
    setSending(true);
    const meta = KIND_META[kind];
    const rows = Array.from(selected).map((branch_id) => ({
      agency_id: agencyId,
      branch_id,
      kind,
      title: `Direction générale — ${meta.label} : ${subject.trim()}`,
      message: message.trim(),
    }));
    const { error } = await supabase.from("branch_notifications" as any).insert(rows as any);
    setSending(false);
    if (error) {
      toast.error("Envoi impossible", { description: error.message });
      return;
    }
    toast.success(`Notification envoyée à ${rows.length} sous-agence${rows.length > 1 ? "s" : ""}`);
    setSubject("");
    setMessage("");
    setSelected(new Set());
  };

  const allSelected = branches.length > 0 && selected.size === branches.length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" /> Communication interne
        </h1>
        <p className="text-sm text-muted-foreground">
          Diffusez un message « Direction générale » à vos sous-agences.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Type de message</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={kind} onValueChange={(v) => setKind(v as Kind)} className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(KIND_META) as Kind[]).map((k) => {
              const M = KIND_META[k];
              const Icon = M.icon;
              const active = kind === k;
              return (
                <label
                  key={k}
                  htmlFor={`kind-${k}`}
                  className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition ${
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
                  }`}
                >
                  <RadioGroupItem id={`kind-${k}`} value={k} />
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ${M.badge}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium text-sm">{M.label}</span>
                </label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>Destinataires</span>
            <Badge variant="outline">{selected.size}/{branches.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune sous-agence trouvée.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox id="all" checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
                <Label htmlFor="all" className="text-sm font-medium cursor-pointer">
                  Toutes les sous-agences
                </Label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {branches.map((b) => (
                  <label
                    key={b.id}
                    htmlFor={`b-${b.id}`}
                    className="flex items-center gap-2 rounded border p-2 cursor-pointer hover:bg-secondary/50"
                  >
                    <Checkbox
                      id={`b-${b.id}`}
                      checked={selected.has(b.id)}
                      onCheckedChange={(v) => toggleOne(b.id, !!v)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.name}</p>
                      {b.city && <p className="text-[11px] text-muted-foreground truncate">{b.city}</p>}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Contenu</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Sujet</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex : Réunion mensuelle, changement d'horaire…"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Contenu de l'annonce…"
              rows={6}
              maxLength={2000}
            />
            <p className="text-[11px] text-muted-foreground text-right">{message.length}/2000</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={send} disabled={sending}>
              <Send className="h-4 w-4 mr-1" />
              {sending ? "Envoi…" : `Envoyer${selected.size ? ` à ${selected.size}` : ""}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencyBroadcast;
