import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertOctagon, CheckCircle2, Clock, Loader2, FileIcon, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Attachment = { path: string; name: string; type: string; size: number };
type Report = {
  id: string;
  branch_id: string;
  reported_by: string;
  category: string;
  severity: string;
  subject: string;
  message: string;
  status: string;
  owner_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  attachments: Attachment[] | null;
};

const AttachmentLink = ({ att }: { att: Attachment }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("report-attachments").createSignedUrl(att.path, 3600).then(({ data }) => {
      setUrl(data?.signedUrl || null);
    });
  }, [att.path]);
  const isImg = att.type.startsWith("image/");
  return (
    <a
      href={url || "#"}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded border bg-secondary/40 px-2 py-1 text-[11px] hover:bg-secondary max-w-full"
    >
      {isImg ? <ImageIcon className="h-3 w-3 shrink-0" /> : <FileIcon className="h-3 w-3 shrink-0" />}
      <span className="truncate max-w-[180px]">{att.name}</span>
    </a>
  );
};

type BranchMap = Record<string, string>;

const SEV_META: Record<string, string> = {
  low: "bg-muted text-foreground",
  normal: "bg-primary/15 text-primary",
  high: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  critical: "bg-destructive/15 text-destructive",
};

const CAT_LABELS: Record<string, string> = {
  technical: "Technique",
  payment: "Paiement",
  passenger: "Passager",
  safety: "Sécurité",
  other: "Autre",
};

const AgencyReports = () => {
  const { agencyId, user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [branches, setBranches] = useState<BranchMap>({});
  const [tab, setTab] = useState<"open" | "resolved" | "all">("open");
  const [severity, setSeverity] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Report | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const [{ data: r }, { data: b }] = await Promise.all([
      supabase
        .from("agency_reports" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false }),
      supabase.from("agency_branches" as any).select("id, name").eq("agency_id", agencyId),
    ]);
    setReports(((r as any) || []) as Report[]);
    const map: BranchMap = {};
    ((b as any) || []).forEach((row: any) => { map[row.id] = row.name; });
    setBranches(map);
    setLoading(false);
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!agencyId) return;
    const channel = supabase
      .channel(`agency-reports-${agencyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agency_reports", filter: `agency_id=eq.${agencyId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [agencyId, load]);

  const openEdit = (r: Report) => {
    setEditing(r);
    setNotes(r.owner_notes || "");
  };

  const setStatus = async (r: Report, status: string) => {
    setSaving(true);
    const patch: any = { status, owner_notes: notes || null };
    if (status === "resolved") { patch.resolved_at = new Date().toISOString(); patch.resolved_by = user?.id; }
    if (status !== "resolved") { patch.resolved_at = null; patch.resolved_by = null; }
    const { error } = await supabase.from("agency_reports" as any).update(patch).eq("id", r.id);
    setSaving(false);
    if (error) { toast.error("Mise à jour impossible", { description: error.message }); return; }
    toast.success("Signalement mis à jour");
    setEditing(null);
    load();
  };

  const filtered = reports.filter((r) => {
    if (tab === "open" && r.status === "resolved") return false;
    if (tab === "resolved" && r.status !== "resolved") return false;
    if (severity !== "all" && r.severity !== severity) return false;
    return true;
  });

  const stats = {
    open: reports.filter((r) => r.status !== "resolved").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
    critical: reports.filter((r) => r.severity === "critical" && r.status !== "resolved").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
          <AlertOctagon className="h-6 w-6 text-primary" /> Signalements des sous-agences
        </h1>
        <p className="text-sm text-muted-foreground">
          Problèmes remontés par vos sous-agences.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Ouverts</p>
          <p className="text-2xl font-bold">{stats.open}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Critiques</p>
          <p className="text-2xl font-bold text-destructive">{stats.critical}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Résolus</p>
          <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="open">Ouverts ({stats.open})</TabsTrigger>
            <TabsTrigger value="resolved">Résolus</TabsTrigger>
            <TabsTrigger value="all">Tous</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-9 w-full sm:w-48"><SelectValue placeholder="Sévérité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes sévérités</SelectItem>
            <SelectItem value="low">Faible</SelectItem>
            <SelectItem value="normal">Normale</SelectItem>
            <SelectItem value="high">Élevée</SelectItem>
            <SelectItem value="critical">Critique</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Liste</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun signalement.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((r) => (
                <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{r.subject}</p>
                      <Badge className={SEV_META[r.severity] || SEV_META.normal}>{r.severity}</Badge>
                      <Badge variant="outline" className="text-[10px]">{CAT_LABELS[r.category] || r.category}</Badge>
                      {r.status === "resolved" ? (
                        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Résolu</Badge>
                      ) : (
                        <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{r.status}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">{r.message}</p>
                    {r.attachments && r.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {r.attachments.map((a, i) => <AttachmentLink key={i} att={a} />)}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {branches[r.branch_id] || "Sous-agence"} · {new Date(r.created_at).toLocaleString("fr-FR")}
                    </p>
                    {r.owner_notes && (
                      <p className="text-[11px] mt-1 rounded bg-secondary/50 px-2 py-1">
                        <span className="font-medium">Note direction : </span>{r.owner_notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Traiter</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Traiter le signalement</DialogTitle>
            <DialogDescription>{editing?.subject}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">{editing?.message}</p>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Note de la direction (optionnel)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {editing?.status !== "in_progress" && (
              <Button variant="outline" disabled={saving} onClick={() => editing && setStatus(editing, "in_progress")}>
                En cours
              </Button>
            )}
            {editing?.status !== "resolved" ? (
              <Button disabled={saving} onClick={() => editing && setStatus(editing, "resolved")}>
                Marquer résolu
              </Button>
            ) : (
              <Button variant="outline" disabled={saving} onClick={() => editing && setStatus(editing, "open")}>
                Rouvrir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgencyReports;
