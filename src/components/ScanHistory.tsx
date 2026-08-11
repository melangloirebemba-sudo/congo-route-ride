import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { History, Download, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Row {
  id: string;
  created_at: string;
  action: string;
  entity_id: string | null;
  actor_role: string | null;
  details: any;
  qr_code?: string | null;
  passenger_name?: string | null;
  trip_label?: string | null;
}

const PAGE = 5;

const ScanHistory = () => {
  const { isAdmin, agencyId, manager } = useAuth();
  const effectiveAgencyId = agencyId || manager?.agency_id || null;
  const branchId = manager?.branch_id || null;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("agency_audit_logs" as any)
      .select("id, created_at, action, entity_id, actor_role, details")
      .in("action", ["booking_checked_in", "booking_refused"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (!isAdmin && effectiveAgencyId) q = q.eq("agency_id", effectiveAgencyId);
    if (branchId) q = q.eq("branch_id", branchId);
    if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);

    const { data } = await q;
    const logs = ((data as any[]) || []) as Row[];

    const ids = Array.from(new Set(logs.map((l) => l.entity_id).filter(Boolean))) as string[];
    let map: Record<string, any> = {};
    if (ids.length) {
      const { data: bk } = await supabase
        .from("bookings")
        .select("id, qr_code, passenger_name, seat_number, trips(departure, destination, date, departure_time)")
        .in("id", ids);
      map = Object.fromEntries(((bk as any[]) || []).map((b) => [b.id, b]));
    }

    setRows(
      logs.map((l) => {
        const b = l.entity_id ? map[l.entity_id] : null;
        return {
          ...l,
          qr_code: b?.qr_code ?? null,
          passenger_name: b?.passenger_name ?? null,
          trip_label: b?.trips
            ? `${b.trips.departure} → ${b.trips.destination} · ${b.trips.date} ${String(b.trips.departure_time || "").slice(0, 5)}`
            : null,
        };
      })
    );
    setPage(1);
    setLoading(false);
  }, [isAdmin, effectiveAgencyId, branchId, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const boarded = rows.filter((r) => r.action === "booking_checked_in").length;
    return { boarded, refused: rows.length - boarded, total: rows.length };
  }, [rows]);

  const paged = rows.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  const exportCsv = () => {
    const head = ["Date", "Action", "Billet", "Passager", "Trajet", "Siège", "Motif", "Rôle agent"];
    const lines = rows.map((r) => [
      format(new Date(r.created_at), "dd/MM/yyyy HH:mm"),
      r.action === "booking_checked_in" ? "Embarqué" : "Refusé",
      r.qr_code || "",
      r.passenger_name || "",
      r.trip_label || "",
      r.details?.seat ?? "",
      r.details?.reason ?? "",
      r.actor_role || "",
    ]);
    const csv = [head, ...lines]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `validations-embarquement-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Historique des validations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[130px]">
            <label className="text-xs text-muted-foreground">Du</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="text-xs text-muted-foreground">Au</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Rafraîchir">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
            Embarqués : {stats.boarded}
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
            Refusés : {stats.refused}
          </Badge>
          <Badge variant="outline">Total : {stats.total}</Badge>
        </div>

        {rows.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">Aucune validation sur cette période.</p>
        )}

        <div className="space-y-2">
          {paged.map((r) => {
            const ok = r.action === "booking_checked_in";
            return (
              <div key={r.id} className="rounded-lg border p-3 text-sm space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-medium min-w-0">
                    {ok ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                    )}
                    <span className="truncate">{r.passenger_name || "Passager"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.created_at), "dd MMM HH:mm", { locale: fr })}
                  </span>
                </div>
                {r.trip_label && <div className="text-xs text-muted-foreground break-words">{r.trip_label}</div>}
                <div className="text-xs text-muted-foreground">
                  {r.qr_code && <code>{r.qr_code}</code>}
                  {r.details?.seat != null && <> · Siège #{r.details.seat}</>}
                  {r.actor_role && <> · {r.actor_role}</>}
                </div>
                {!ok && r.details?.reason && (
                  <div className="text-xs italic text-muted-foreground">Motif : {r.details.reason}</div>
                )}
              </div>
            );
          })}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} / {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>
              Suivant
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScanHistory;
