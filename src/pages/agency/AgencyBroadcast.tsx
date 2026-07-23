import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Megaphone, Info, AlertTriangle, Siren, Send, Clock, CheckCircle2, Eye, CalendarClock, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Branch = { id: string; name: string; city: string | null };
type Kind = "broadcast_info" | "broadcast_alerte" | "broadcast_urgence";

type Scheduled = {
  id: string;
  kind: Kind;
  subject: string;
  message: string;
  target_branch_ids: string[];
  scheduled_at: string;
  sent_at: string | null;
  status: "scheduled" | "sent" | "cancelled" | "failed";
  broadcast_id: string | null;
  created_at: string;
  failure_reason: string | null;
  fully_read_at: string | null;
};

type ReadRow = {
  id: string;
  branch_id: string;
  read_at: string | null;
  created_at: string;
};

const KIND_META: Record<Kind, { label: string; icon: any; badge: string }> = {
  broadcast_info:    { label: "Information", icon: Info, badge: "bg-primary/15 text-primary" },
  broadcast_alerte:  { label: "Alerte",      icon: AlertTriangle, badge: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  broadcast_urgence: { label: "Urgence",     icon: Siren, badge: "bg-destructive/15 text-destructive" },
};

const AgencyBroadcast = () => {
  const { agencyId, user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<Kind>("broadcast_info");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [items, setItems] = useState<Scheduled[]>([]);
  const [loading, setLoading] = useState(true);
  const [readOpen, setReadOpen] = useState<Scheduled | null>(null);
  const [readRows, setReadRows] = useState<ReadRow[]>([]);
  const [readLoading, setReadLoading] = useState(false);

  const branchName = useCallback(
    (id: string) => branches.find((b) => b.id === id)?.name || "Sous-agence",
    [branches]
  );

  useEffect(() => {
    if (!agencyId) return;
    supabase
      .from("agency_branches" as any)
      .select("id, name, city")
      .eq("agency_id", agencyId)
      .order("name")
      .then(({ data }) => setBranches(((data as any) || []) as Branch[]));
  }, [agencyId]);

  const loadItems = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("scheduled_broadcasts" as any)
      .select("*")
      .eq("agency_id", agencyId)
      .order("scheduled_at", { ascending: false });
    setItems(((data as any) || []) as Scheduled[]);
    setLoading(false);
  }, [agencyId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    if (!agencyId) return;
    const channel = supabase
      .channel(`sched-broadcasts-${agencyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scheduled_broadcasts", filter: `agency_id=eq.${agencyId}` },
        () => loadItems()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [agencyId, loadItems]);

  const toggleAll = (v: boolean) => setSelected(v ? new Set(branches.map((b) => b.id)) : new Set());
  const toggleOne = (id: string, v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id); else next.delete(id);
      return next;
    });
  };

  const resetForm = () => {
    setSubject(""); setMessage(""); setSelected(new Set());
    setScheduleOn(false); setScheduleAt("");
  };

  const send = async () => {
    if (!agencyId || !user) return;
    if (!subject.trim() || !message.trim()) { toast.error("Sujet et message obligatoires"); return; }
    if (selected.size === 0) { toast.error("Sélectionnez au moins une sous-agence"); return; }
    if (scheduleOn) {
      if (!scheduleAt) { toast.error("Choisissez une date et heure d'envoi"); return; }
      if (new Date(scheduleAt).getTime() <= Date.now()) { toast.error("La date d'envoi doit être future"); return; }
    }

    setSending(true);
    const meta = KIND_META[kind];
    const title = `Direction générale — ${meta.label} : ${subject.trim()}`;

    if (scheduleOn) {
      const { error } = await supabase.from("scheduled_broadcasts" as any).insert({
        agency_id: agencyId,
        created_by: user.id,
        kind,
        subject: title,
        message: message.trim(),
        target_branch_ids: Array.from(selected),
        scheduled_at: new Date(scheduleAt).toISOString(),
      } as any);
      setSending(false);
      if (error) { toast.error("Planification impossible", { description: error.message }); return; }
      toast.success("Broadcast planifié");
      resetForm();
      loadItems();
      return;
    }

    // Immediate send: group under a broadcast_id
    const broadcast_id = (globalThis as any).crypto?.randomUUID?.() ?? undefined;
    const rows = Array.from(selected).map((branch_id) => ({
      agency_id: agencyId,
      branch_id,
      kind,
      title,
      message: message.trim(),
      broadcast_id,
    }));
    const { error: nErr } = await supabase.from("branch_notifications" as any).insert(rows as any);
    if (nErr) { setSending(false); toast.error("Envoi impossible", { description: nErr.message }); return; }

    // Log as "sent" for history & read tracking
    await supabase.from("scheduled_broadcasts" as any).insert({
      agency_id: agencyId,
      created_by: user.id,
      kind,
      subject: title,
      message: message.trim(),
      target_branch_ids: Array.from(selected),
      scheduled_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      status: "sent",
      broadcast_id,
    } as any);

    setSending(false);
    toast.success(`Notification envoyée à ${rows.length} sous-agence${rows.length > 1 ? "s" : ""}`);
    resetForm();
    loadItems();
  };

  const cancelScheduled = async (id: string) => {
    const { error } = await supabase.from("scheduled_broadcasts" as any).delete().eq("id", id);
    if (error) { toast.error("Suppression impossible", { description: error.message }); return; }
    toast.success("Broadcast planifié supprimé");
    loadItems();
  };

  const openRead = async (b: Scheduled) => {
    setReadOpen(b);
    setReadLoading(true);
    setReadRows([]);
    if (!b.broadcast_id) { setReadLoading(false); return; }
    const { data } = await supabase
      .from("branch_notifications" as any)
      .select("id, branch_id, read_at, created_at")
      .eq("broadcast_id", b.broadcast_id);
    setReadRows(((data as any) || []) as ReadRow[]);
    setReadLoading(false);
  };

  const allSelected = branches.length > 0 && selected.size === branches.length;
  const scheduledList = items.filter((i) => i.status === "scheduled");
  const sentList = items.filter((i) => i.status === "sent");

  const readStats = (rows: ReadRow[]) => {
    const total = rows.length;
    const read = rows.filter((r) => r.read_at).length;
    return { total, read, pct: total ? Math.round((read / total) * 100) : 0 };
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" /> Communication interne
        </h1>
        <p className="text-sm text-muted-foreground">
          Diffusez un message « Direction générale » à vos sous-agences.
        </p>
      </div>

      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new">Nouveau</TabsTrigger>
          <TabsTrigger value="scheduled">Planifiés ({scheduledList.length})</TabsTrigger>
          <TabsTrigger value="sent">Envoyés ({sentList.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6 mt-4">
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

              <div className="flex items-center gap-3 rounded border p-3">
                <Switch id="schedule" checked={scheduleOn} onCheckedChange={setScheduleOn} />
                <Label htmlFor="schedule" className="cursor-pointer text-sm flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4" /> Planifier l'envoi
                </Label>
                {scheduleOn && (
                  <Input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                    className="max-w-[220px] ml-auto"
                  />
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={send} disabled={sending}>
                  <Send className="h-4 w-4 mr-1" />
                  {sending
                    ? "Envoi…"
                    : scheduleOn
                      ? `Planifier${selected.size ? ` pour ${selected.size}` : ""}`
                      : `Envoyer${selected.size ? ` à ${selected.size}` : ""}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Broadcasts planifiés</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : scheduledList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun envoi planifié.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {scheduledList.map((s) => {
                    const M = KIND_META[s.kind];
                    return (
                      <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={M.badge}>{M.label}</Badge>
                            <p className="font-medium text-sm truncate">{s.subject}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 break-words">{s.message}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Envoi prévu : {new Date(s.scheduled_at).toLocaleString("fr-FR")}
                            {" · "}{s.target_branch_ids.length} destinataire(s)
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancelScheduled(s.id)}>
                          <Trash2 className="h-4 w-4 mr-1" /> Annuler
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Broadcasts envoyés</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : sentList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun envoi.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {sentList.map((s) => {
                    const M = KIND_META[s.kind];
                    return (
                      <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={M.badge}>{M.label}</Badge>
                            <p className="font-medium text-sm truncate">{s.subject}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 break-words">{s.message}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Envoyé le {new Date(s.sent_at || s.scheduled_at).toLocaleString("fr-FR")}
                            {" · "}{s.target_branch_ids.length} destinataire(s)
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => openRead(s)} disabled={!s.broadcast_id}>
                          <Eye className="h-4 w-4 mr-1" /> Suivi de lecture
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!readOpen} onOpenChange={(v) => !v && setReadOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Suivi de lecture</DialogTitle>
            <DialogDescription>{readOpen?.subject}</DialogDescription>
          </DialogHeader>
          {readLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : readRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée de lecture disponible.</p>
          ) : (
            <>
              {(() => {
                const s = readStats(readRows);
                return (
                  <div className="rounded border p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Lu par</p>
                      <p className="text-lg font-bold">{s.read} / {s.total}</p>
                    </div>
                    <Badge variant="outline">{s.pct}%</Badge>
                  </div>
                );
              })()}
              <ul className="divide-y divide-border max-h-[50vh] overflow-auto -mx-1">
                {readRows
                  .slice()
                  .sort((a, b) => Number(!!b.read_at) - Number(!!a.read_at))
                  .map((r) => (
                    <li key={r.id} className="py-2 px-1 flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{branchName(r.branch_id)}</span>
                      {r.read_at ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {new Date(r.read_at).toLocaleString("fr-FR")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" /> Non lu
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgencyBroadcast;
