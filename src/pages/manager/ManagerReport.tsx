import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertOctagon, Send, CheckCircle2, Clock, Loader2, Paperclip, X, FileIcon, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Attachment = { path: string; name: string; type: string; size: number };
type Report = {
  id: string;
  category: string;
  severity: string;
  subject: string;
  message: string;
  status: string;
  owner_notes: string | null;
  created_at: string;
  attachments: Attachment[] | null;
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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 5;

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

const ManagerReport = () => {
  const { manager, user } = useAuth();
  const [category, setCategory] = useState("technical");
  const [severity, setSeverity] = useState("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!manager?.branch_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("agency_reports" as any)
      .select("id, category, severity, subject, message, status, owner_notes, created_at, attachments")
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

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    const next = [...files];
    for (const f of list) {
      if (next.length >= MAX_FILES) { toast.error(`Maximum ${MAX_FILES} fichiers`); break; }
      if (f.size > MAX_FILE_SIZE) { toast.error(`${f.name} dépasse 5 Mo`); continue; }
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!manager || !user) return;
    if (!subject.trim() || !message.trim()) { toast.error("Sujet et message obligatoires"); return; }
    setSending(true);

    // Upload files first
    const uploaded: Attachment[] = [];
    for (const f of files) {
      const safeName = f.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${manager.agency_id}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("report-attachments")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (error) {
        setSending(false);
        toast.error(`Téléversement de ${f.name} échoué`, { description: error.message });
        return;
      }
      uploaded.push({ path, name: f.name, type: f.type || "application/octet-stream", size: f.size });
    }

    const { error } = await supabase.from("agency_reports" as any).insert({
      agency_id: manager.agency_id,
      branch_id: manager.branch_id,
      reported_by: user.id,
      category, severity,
      subject: subject.trim(),
      message: message.trim(),
      attachments: uploaded,
    } as any);
    setSending(false);
    if (error) { toast.error("Envoi impossible", { description: error.message }); return; }
    toast.success("Signalement envoyé à la direction");
    setSubject(""); setMessage(""); setSeverity("normal"); setCategory("technical"); setFiles([]);
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

          <div className="space-y-2">
            <Label>Pièces jointes (max {MAX_FILES}, 5 Mo chacune)</Label>
            <input
              ref={fileRef}
              type="file"
              multiple
              onChange={onPickFiles}
              className="hidden"
              accept="image/*,application/pdf,.doc,.docx,.txt"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4 mr-1" /> Ajouter des fichiers
            </Button>
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <li key={i} className="inline-flex items-center gap-1.5 rounded border bg-secondary/40 px-2 py-1 text-[11px]">
                    {f.type.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileIcon className="h-3 w-3" />}
                    <span className="truncate max-w-[160px]">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
                  {r.attachments && r.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {r.attachments.map((a, i) => <AttachmentLink key={i} att={a} />)}
                    </div>
                  )}
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
