import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertOctagon, Send, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Report = {
  id: string;
  category: string;
  severity: string;
  subject: string;
  message: string;
  status: string;
  owner_notes: string | null;
  created_at: string;
};

const SEV_META: Record<string, string> = {
  low: "bg-muted text-foreground",
  normal: "bg-primary/15 text-primary",
  high: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  critical: "bg-destructive/15 text-destructive",
};

const CATEGORIES = [
  { value: "technical", label: "Problème technique" },
  { value: "payment", label: "Paiement" },
  { value: "passenger", label: "Passager" },
  { value: "safety", label: "Sécurité" },
  { value: "other", label: "Autre" },
];

const SEVERITIES = [
  { value: "low", label: "Faible" },
  { value: "normal", label: "Normale" },
  { value: "high", label: "Élevée" },
  { value: "critical", label: "Critique" },
];

const ManagerReport = () => {
  const { manager, user } = useAuth();
  const [category, setCategory] = useState("technical");
  const [severity, setSeverity] = useState("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!manager?.branch_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("agency_reports" as any)
      .select("id, category, severity, subject, message, status, owner_notes, created_at")
      .eq("branch_id", manager.branch_id)
      .order("created_at", { ascending: false });
    setItems(((data as any) || []) as Report[]);
    setLoading(false);
  }, [manager?.branch_id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!manager?.branch_id) return;
    const channel = supabase
      .channel(`manager-reports-${manager.branch_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agency_reports", filter: `branch_id=eq.${manager.branch_id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [manager?.branch_id, load]);

  const submit = async () => {
    if (!manager || !user) return;
    if (!subject.trim() || !message.trim()) { toast.error("Sujet et message obligatoires"); return; }
    setSending(true);
    const { error } = await supabase.from("agency_reports" as any).insert({
      agency_id: manager.agency_id,
      branch_id: manager.branch_id,
      reported_by: user.id,
      category, severity,
      subject: subject.trim(),
      message: message.trim(),
    } as any);
    setSending(false);
    if (error) { toast.error("Envoi impossible", { description: error.message }); return; }
    toast.success("Signalement envoyé à la direction");
    setSubject(""); setMessage(""); setSeverity("normal"); setCategory("technical");
    load();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
          <AlertOctagon className="h-6 w-6 text-primary" /> Signaler un problème
        </h1>
        <p className="text-sm text-muted-foreground">
          Remontez un problème à l'agence principale.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Nouveau signalement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sévérité</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subj">Sujet</Label>
            <Input id="subj" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg">Description</Label>
            <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} />
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={sending}>
              <Send className="h-4 w-4 mr-1" />
              {sending ? "Envoi…" : "Envoyer à la direction"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique de mes signalements</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun signalement pour l'instant.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{r.subject}</p>
                    <Badge className={SEV_META[r.severity] || SEV_META.normal}>{r.severity}</Badge>
                    {r.status === "resolved" ? (
                      <Badge className="bg-green-500/15 text-green-700 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Résolu</Badge>
                    ) : (
                      <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{r.status}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">{r.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </p>
                  {r.owner_notes && (
                    <p className="text-[11px] mt-1 rounded bg-primary/5 border border-primary/20 px-2 py-1">
                      <span className="font-medium">Réponse direction : </span>{r.owner_notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerReport;
