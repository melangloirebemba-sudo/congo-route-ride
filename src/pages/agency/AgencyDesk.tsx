import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPagination, usePagination } from "@/components/ListPagination";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Printer, CheckCircle2, XCircle, RefreshCw, Building2, Search, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Branch = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  address: string | null;
  official_address?: string | null;
  phone: string | null;
  whatsapp_number?: string | null;
};

const todayStr = () => new Date().toISOString().split("T")[0];

const AgencyDesk = () => {
  const { agencyId } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [date, setDate] = useState<string>(todayStr());
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refuseFor, setRefuseFor] = useState<any>(null);
  const [refuseReason, setRefuseReason] = useState("");

  useEffect(() => {
    if (!agencyId) return;
    supabase
      .from("agencies")
      .select("*")
      .eq("id", agencyId)
      .maybeSingle()
      .then(({ data }) => setAgency(data));
    supabase
      .from("agency_branches")
      .select("id, name, city, district, address, official_address, phone, whatsapp_number")
      .eq("agency_id", agencyId)
      .order("name")
      .then(({ data }) => {
        const list = (data as any as Branch[]) || [];
        setBranches(list);
        setBranchId((prev) => prev || list[0]?.id || "");
      });
  }, [agencyId]);

  const branch = useMemo(() => branches.find((b) => b.id === branchId) || null, [branches, branchId]);

  const load = async () => {
    if (!branchId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, passenger_name, phone, seat_number, qr_code, total_amount, status, payment_status, payment_method, sale_channel, boarding_status, boarded_at, booking_date, trip:trips(id, departure, destination, date, departure_time, arrival_time, price, currency, bus_type)"
      )
      .eq("boarding_branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data as any[]) || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    const channel = supabase
      .channel(`desk-${branchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `boarding_branch_id=eq.${branchId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (date && r.trip?.date !== date) return false;
      if (status !== "all" && (r.boarding_status || "pending") !== status) return false;
      if (!q) return true;
      return (
        (r.passenger_name || "").toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q) ||
        (r.qr_code || "").toLowerCase().includes(q) ||
        String(r.seat_number || "").includes(q)
      );
    });
  }, [rows, date, status, search]);

  const { page, setPage, pageCount, slice } = usePagination(filtered.length, 5);
  const pageRows = slice(filtered);

  const counts = useMemo(
    () => ({
      total: filtered.length,
      boarded: filtered.filter((r) => r.boarding_status === "boarded").length,
      pending: filtered.filter((r) => (r.boarding_status || "pending") === "pending").length,
      refused: filtered.filter((r) => r.boarding_status === "refused").length,
    }),
    [filtered]
  );

  const validate = async (b: any) => {
    setBusyId(b.id);
    const { data, error } = await supabase.rpc("check_in_booking", { _booking_id: b.id });
    setBusyId(null);
    const res = data as any;
    if (error) {
      toast.error(error.message);
      return;
    }
    if (res?.ok) {
      toast.success(`Embarquement validé — ${b.passenger_name}`);
      load();
    } else {
      toast.error(res?.message || "Validation impossible");
    }
  };

  const refuse = async () => {
    if (!refuseFor) return;
    setBusyId(refuseFor.id);
    const { data, error } = await supabase.rpc("refuse_boarding" as any, {
      _booking_id: refuseFor.id,
      _reason: refuseReason || "Non précisé",
    });
    setBusyId(null);
    const res = data as any;
    if (error) {
      toast.error(error.message);
      return;
    }
    if (res?.ok === false) {
      toast.error(res?.message || "Action impossible");
      return;
    }
    toast.success("Embarquement refusé");
    setRefuseFor(null);
    setRefuseReason("");
    load();
  };

  const printTicket = (b: any) => {
    const loc = branch
      ? [branch.name, branch.official_address || branch.address, branch.district, branch.city]
          .filter(Boolean)
          .join(", ")
      : "";
    const money = `${(b.total_amount || 0).toLocaleString("fr-FR")} ${b.trip?.currency || "FCFA"}`;
    const dateFr = b.trip?.date ? new Date(b.trip.date + "T00:00").toLocaleDateString("fr-FR") : "";
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      b.qr_code || b.id
    )}`;
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Billet ${b.qr_code || ""}</title>
<style>
 *{box-sizing:border-box} body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;padding:24px;color:#1b1b1b}
 .ticket{max-width:640px;margin:0 auto;border:2px solid #f97316;border-radius:16px;overflow:hidden}
 .head{background:#f97316;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
 .head h1{margin:0;font-size:20px} .head span{font-size:12px;opacity:.9}
 .body{padding:20px;display:flex;gap:20px}
 .info{flex:1} .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e5e5e5;font-size:14px}
 .row b{font-weight:600} .route{font-size:22px;font-weight:700;margin-bottom:10px}
 .qr{text-align:center;font-size:11px} .qr img{width:150px;height:150px}
 .foot{padding:12px 20px;background:#fff7ed;font-size:11px;color:#7c2d12}
 @media print{body{padding:0}}
</style></head><body>
<div class="ticket">
 <div class="head"><h1>${(agency?.name || "Billet").toString()}</h1><span>${loc}</span></div>
 <div class="body">
  <div class="info">
   <div class="route">${b.trip?.departure || ""} → ${b.trip?.destination || ""}</div>
   <div class="row"><span>Passager</span><b>${b.passenger_name || ""}</b></div>
   <div class="row"><span>Téléphone</span><b>${b.phone || ""}</b></div>
   <div class="row"><span>Date</span><b>${dateFr}</b></div>
   <div class="row"><span>Départ</span><b>${(b.trip?.departure_time || "").slice(0, 5)}</b></div>
   <div class="row"><span>Siège</span><b>N° ${b.seat_number ?? "-"}</b></div>
   <div class="row"><span>Montant</span><b>${money} (${b.payment_status === "paid" ? "payé" : "à payer"})</b></div>
   <div class="row"><span>Référence</span><b>${b.qr_code || ""}</b></div>
  </div>
  <div class="qr"><img src="${qrSrc}" alt="Code du billet"/><div>${b.qr_code || ""}</div></div>
 </div>
 <div class="foot">Présentez ce billet à l'embarquement. Arrivée conseillée 30 minutes avant le départ.</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
</body></html>`;
    const w = window.open("", "_blank", "width=780,height=900");
    if (!w) {
      toast.error("Autorisez les fenêtres pop-up pour imprimer le billet");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  const statusBadge = (s: string) => {
    if (s === "boarded") return <Badge className="bg-accent/15 text-accent border-accent/30">Embarqué</Badge>;
    if (s === "refused") return <Badge variant="destructive">Refusé</Badge>;
    return <Badge variant="secondary">En attente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Guichet par sous-agence</h1>
          <p className="text-sm text-muted-foreground">
            Impression des billets et validation des embarquements en ligne.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Sous-agence</label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue placeholder="Choisir une sous-agence" /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date de voyage</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Statut</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="boarded">Embarqués</SelectItem>
                <SelectItem value="refused">Refusés</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Recherche</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Nom, téléphone, code, siège" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Billets du jour", value: counts.total, icon: Building2 },
          { label: "En attente", value: counts.pending, icon: Clock },
          { label: "Embarqués", value: counts.boarded, icon: CheckCircle2 },
          { label: "Refusés", value: counts.refused, icon: XCircle },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-6 flex items-center gap-3">
              <Icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Billets {branch ? `— ${branch.name}` : ""}</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucun billet pour ces critères.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Passager</TableHead>
                      <TableHead>Trajet</TableHead>
                      <TableHead>Départ</TableHead>
                      <TableHead>Siège</TableHead>
                      <TableHead>Paiement</TableHead>
                      <TableHead>Embarquement</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-medium">{b.passenger_name}</div>
                          <div className="text-xs text-muted-foreground">{b.phone} · {b.qr_code}</div>
                        </TableCell>
                        <TableCell className="text-sm">{b.trip?.departure} → {b.trip?.destination}</TableCell>
                        <TableCell className="text-sm">{(b.trip?.departure_time || "").slice(0, 5)}</TableCell>
                        <TableCell>N° {b.seat_number}</TableCell>
                        <TableCell>
                          {b.payment_status === "paid"
                            ? <Badge className="bg-accent/15 text-accent border-accent/30">Payé</Badge>
                            : <Badge variant="secondary">À payer</Badge>}
                        </TableCell>
                        <TableCell>{statusBadge(b.boarding_status || "pending")}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="sm" variant="outline" className="mr-1" onClick={() => printTicket(b)}>
                            <Printer className="h-4 w-4 mr-1" /> Imprimer
                          </Button>
                          <Button
                            size="sm"
                            className="gradient-primary text-primary-foreground mr-1"
                            disabled={busyId === b.id || b.boarding_status === "boarded" || b.status === "cancelled"}
                            onClick={() => validate(b)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === b.id || b.boarding_status !== "pending"}
                            onClick={() => { setRefuseFor(b); setRefuseReason(""); }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ListPagination page={page} pageCount={pageCount} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!refuseFor} onOpenChange={(o) => !o && setRefuseFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser l'embarquement</DialogTitle>
            <DialogDescription>
              {refuseFor?.passenger_name} — siège n° {refuseFor?.seat_number}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motif du refus"
            value={refuseReason}
            onChange={(e) => setRefuseReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefuseFor(null)}>Annuler</Button>
            <Button variant="destructive" onClick={refuse}>Confirmer le refus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgencyDesk;
