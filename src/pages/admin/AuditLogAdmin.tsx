import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, RefreshCcw, Loader2, ScrollText, ChevronRight, Download,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ListPagination, usePagination } from "@/components/ListPagination";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

type AuditRow = {
  id: string;
  actor_id: string;
  actor_email: string | null;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  metadata: Record<string, unknown>;
  status: "success" | "error";
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

const ACTIONS: Record<string, string> = {
  disable: "Désactivation",
  enable: "Réactivation",
  delete: "Suppression",
  reset_password: "Envoi lien de réinit.",
  set_password: "Définition mot de passe",
  set_role: "Modification de rôle",
};

const actionLabel = (a: string) => ACTIONS[a] ?? a;

const AuditLogAdmin = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as AuditRow[]) || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 3600 * 1000 : null;
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const ts = new Date(r.created_at).getTime();
      if (from && ts < from) return false;
      if (to && ts > to) return false;
      if (!q) return true;
      return (
        (r.actor_email || "").toLowerCase().includes(q) ||
        (r.target_email || "").toLowerCase().includes(q) ||
        (r.target_user_id || "").toLowerCase().includes(q) ||
        (r.actor_id || "").toLowerCase().includes(q) ||
        (r.error_message || "").toLowerCase().includes(q) ||
        actionLabel(r.action).toLowerCase().includes(q)
      );
    });
  }, [rows, search, actionFilter, statusFilter, dateFrom, dateTo]);

  const stats = useMemo(() => ({
    total: filtered.length,
    success: filtered.filter((r) => r.status === "success").length,
    errors: filtered.filter((r) => r.status === "error").length,
    actors: new Set(filtered.map((r) => r.actor_id)).size,
  }), [filtered]);

  const pg = usePagination(filtered, 5, [filtered]);


  const exportCsv = () => {
    const header = ["Date", "Acteur", "Action", "Cible", "Statut", "IP", "Erreur"];
    const lines = filtered.map((r) => [
      new Date(r.created_at).toISOString(),
      r.actor_email || r.actor_id,
      actionLabel(r.action),
      r.target_email || r.target_user_id || "",
      r.status,
      r.ip_address || "",
      (r.error_message || "").replace(/[\r\n,]+/g, " "),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" /> Journal d'audit
          </h1>
          <p className="text-sm text-muted-foreground">
            Historique complet des actions administrateur sur les comptes (qui, quand, quoi).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-2" /> Exporter CSV
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Entrées (filtrées)", value: stats.total },
          { label: "Succès", value: stats.success },
          { label: "Erreurs", value: stats.errors },
          { label: "Acteurs distincts", value: stats.actors },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold font-display">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (acteur, cible, action, erreur…)"
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes actions</SelectItem>
                {Object.entries(ACTIONS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="success">Succès</SelectItem>
                <SelectItem value="error">Erreurs</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Acteur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Chargement…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucune entrée
                    </TableCell>
                  </TableRow>
                ) : (
                  pg.paginated.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(r)}
                    >
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("fr")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.actor_email || <span className="font-mono text-xs">{r.actor_id.slice(0,8)}…</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{actionLabel(r.action)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.target_email || (r.target_user_id
                          ? <span className="font-mono text-xs">{r.target_user_id.slice(0,8)}…</span>
                          : "—")}
                      </TableCell>
                      <TableCell>
                        {r.status === "success" ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Succès</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Erreur</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ListPagination {...pg} className="pt-4" />
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Détail de l'action</SheetTitle>
            <SheetDescription>
              {selected && new Date(selected.created_at).toLocaleString("fr")}
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-4 text-sm">
              <Field label="Action" value={actionLabel(selected.action)} />
              <Field label="Statut" value={selected.status} />
              {selected.error_message && (
                <Field label="Erreur" value={selected.error_message} mono />
              )}
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs uppercase text-muted-foreground">Acteur</p>
                <p>{selected.actor_email || "—"}</p>
                <p className="text-xs font-mono text-muted-foreground">{selected.actor_id}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs uppercase text-muted-foreground">Cible</p>
                <p>{selected.target_email || "—"}</p>
                <p className="text-xs font-mono text-muted-foreground">
                  {selected.target_user_id || "—"}
                </p>
              </div>
              <Field label="IP" value={selected.ip_address || "—"} mono />
              <Field label="Navigateur" value={selected.user_agent || "—"} mono />
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground mb-2">Metadata</p>
                <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(selected.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="text-xs uppercase text-muted-foreground">{label}</p>
    <p className={mono ? "font-mono text-xs break-all" : ""}>{value}</p>
  </div>
);

export default AuditLogAdmin;
