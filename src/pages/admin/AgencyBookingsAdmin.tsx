import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Ticket, TrendingUp, CreditCard, Search, Copy, Check, Download, Ticket as TicketIcon } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { ListPagination, usePagination } from "@/components/ListPagination";


const paymentLabel = (m?: string) => {
  switch (m) {
    case "mtn_momo": return "MTN Mobile Money";
    case "airtel_money": return "Airtel Money";
    case "card": return "Carte bancaire";
    case "cash": return "Espèces";
    default: return m || "—";
  }
};

const buildPdf = async (r: any, kind: "receipt" | "ticket") => {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  const orange: [number, number, number] = [234, 88, 12];

  doc.setFillColor(...orange);
  doc.rect(0, 0, W, 20, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("TransCongo", 10, 13);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(kind === "receipt" ? "Reçu de paiement" : "Billet électronique", W - 10, 13, { align: "right" });

  doc.setTextColor(20);
  let y = 30;
  const line = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(label, 10, y);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(value || "—", W - 10, y, { align: "right" });
    y += 6;
  };

  line("Référence", r.qr_code || r.id.slice(0, 8));
  line("Date", new Date(r.created_at).toLocaleString("fr"));
  line("Agence", r.agency_name);
  doc.setDrawColor(220);
  doc.line(10, y, W - 10, y);
  y += 6;

  line("Passager", r.passenger_name);
  line("Téléphone", r.phone || "—");
  line("Trajet", `${r.trips?.departure || "?"} → ${r.trips?.destination || "?"}`);
  if (r.trips?.date) line("Date voyage", new Date(r.trips.date).toLocaleDateString("fr"));
  line("Siège", `#${r.seat_number}`);
  doc.line(10, y, W - 10, y);
  y += 6;

  if (kind === "receipt") {
    line("Mode paiement", paymentLabel(r.payment_method));
    line("Statut paiement", r.payment_status || "en attente");
    if (r.transaction?.id) line("ID transaction", r.transaction.id);
    doc.line(10, y, W - 10, y);
    y += 6;
    line("Montant total", `${r.total_amount.toLocaleString()} FCFA`);
    line("Commission", `${r.commission.toLocaleString()} FCFA`);
    line("Net agence", `${r.net.toLocaleString()} FCFA`);
  } else {
    line("Montant", `${r.total_amount.toLocaleString()} FCFA`);
    y += 4;
    try {
      const qrText = r.qr_code || `TC-${r.id}`;
      const qrData = await QRCode.toDataURL(qrText, { margin: 1, width: 200 });
      const size = 45;
      doc.addImage(qrData, "PNG", (W - size) / 2, y, size, size);
      y += size + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(qrText, W / 2, y, { align: "center" });
    } catch {
      // ignore
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("TransCongo • République du Congo", W / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });

  const suffix = kind === "receipt" ? "recu" : "billet";
  doc.save(`transcongo-${suffix}-${r.qr_code || r.id.slice(0, 8)}.pdf`);
};


const AgencyBookingsAdmin = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [ag, bk, tx] = await Promise.all([
        supabase.from("agencies").select("id, name, commission_rate").order("name"),
        supabase
          .from("bookings")
          .select("id, passenger_name, phone, total_amount, status, payment_method, payment_status, seat_number, qr_code, created_at, trips(departure, destination, date, agencies(id, name, commission_rate))")
          .order("created_at", { ascending: false }),
        supabase.from("transactions").select("id, booking_id, amount, commission, net_amount, payment_method, status, created_at"),
      ]);
      setAgencies((ag.data || []).map((a: any) => ({ id: a.id, name: a.name })));
      const txByBooking = new Map<string, any>();
      (tx.data || []).forEach((t: any) => txByBooking.set(t.booking_id, t));
      const enriched = (bk.data || []).map((b: any) => {
        const rate = b.trips?.agencies?.commission_rate ?? 10;
        const commission = Math.round((b.total_amount * rate) / 100);
        return {
          ...b,
          agency_id: b.trips?.agencies?.id || null,
          agency_name: b.trips?.agencies?.name || "—",
          commission,
          net: b.total_amount - commission,
          transaction: txByBooking.get(b.id) || null,
        };
      });
      setRows(enriched);
      setLoading(false);
    };
    load();

  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (agencyFilter !== "all" && r.agency_id !== agencyFilter) return false;
      if (paymentFilter !== "all" && (r.payment_method || "") !== paymentFilter) return false;
      if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(r.created_at) > end) return false;
      }
      if (search) {

        const s = search.toLowerCase();
        return (
          r.passenger_name?.toLowerCase().includes(s) ||
          r.phone?.toLowerCase().includes(s) ||
          r.agency_name?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [rows, agencyFilter, paymentFilter, dateFrom, dateTo, search]);

  const summary = useMemo(() => {
    const byAgency = new Map<string, { name: string; bookings: number; revenue: number; commission: number }>();
    for (const r of filtered) {
      const key = r.agency_id || "none";
      const cur = byAgency.get(key) || { name: r.agency_name, bookings: 0, revenue: 0, commission: 0 };
      cur.bookings += 1;
      if (r.status !== "cancelled") {
        cur.revenue += r.total_amount;
        cur.commission += r.commission;
      }
      byAgency.set(key, cur);
    }
    const list = Array.from(byAgency.values()).sort((a, b) => b.revenue - a.revenue);
    const totals = list.reduce(
      (acc, x) => ({
        bookings: acc.bookings + x.bookings,
        revenue: acc.revenue + x.revenue,
        commission: acc.commission + x.commission,
      }),
      { bookings: 0, revenue: 0, commission: 0 }
    );
    return { list, totals };
  }, [filtered]);

  const pg = usePagination(filtered, 5, [agencyFilter, paymentFilter, dateFrom, dateTo, search], { paramKey: "" });


  const statusBadge = (s: string) => {
    if (s === "confirmed") return "bg-accent/20 text-accent";
    if (s === "cancelled") return "bg-destructive/20 text-destructive";
    if (s === "completed") return "bg-primary/20 text-primary";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Réservations par agence</h1>
        <p className="text-sm text-muted-foreground">Suivi des réservations, montants et commissions</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground">Agences</CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent><div className="text-xl font-bold font-display">{summary.list.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground">Réservations</CardTitle>
              <Ticket className="h-4 w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent><div className="text-xl font-bold font-display">{summary.totals.bookings}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground">Revenus</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent><div className="text-lg font-bold font-display">{summary.totals.revenue.toLocaleString()} FCFA</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground">Commissions</CardTitle>
              <CreditCard className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent><div className="text-lg font-bold font-display">{summary.totals.commission.toLocaleString()} FCFA</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Synthèse par agence</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agence</TableHead>
                  <TableHead>Réservations</TableHead>
                  <TableHead>Revenus</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Net agence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.list.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucune donnée</TableCell></TableRow>
                ) : summary.list.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.bookings}</TableCell>
                    <TableCell className="font-semibold">{s.revenue.toLocaleString()} FCFA</TableCell>
                    <TableCell className="text-warning">{s.commission.toLocaleString()} FCFA</TableCell>
                    <TableCell className="text-accent">{(s.revenue - s.commission).toLocaleString()} FCFA</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <CardTitle className="text-lg">Détail des réservations</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8 w-full sm:w-64" placeholder="Passager, téléphone, agence" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={agencyFilter} onValueChange={setAgencyFilter}>
                <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Filtrer par agence" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les agences</SelectItem>
                  {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Du</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Au</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Paiement</label>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Mode de paiement" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les paiements</SelectItem>
                  <SelectItem value="mtn_momo">MTN MoMo</SelectItem>
                  <SelectItem value="airtel_money">Airtel Money</SelectItem>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="card">Carte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(dateFrom || dateTo || paymentFilter !== "all" || agencyFilter !== "all") && (
              <button
                type="button"
                onClick={() => { setDateFrom(""); setDateTo(""); setPaymentFilter("all"); setAgencyFilter("all"); }}
                className="text-xs text-primary underline self-start sm:self-end sm:pb-2"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead>Passager</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Siège</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Chargement…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Aucune réservation</TableCell></TableRow>
                ) : pg.paginated.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("fr")}</TableCell>
                    <TableCell className="text-sm">{r.agency_name}</TableCell>
                    <TableCell className="text-sm font-medium">{r.passenger_name}</TableCell>
                    <TableCell className="text-xs">{r.trips?.departure} → {r.trips?.destination}</TableCell>
                    <TableCell>{r.seat_number}</TableCell>
                    <TableCell className="font-semibold">{r.total_amount.toLocaleString()} FCFA</TableCell>
                    <TableCell className="text-warning">{r.commission.toLocaleString()} FCFA</TableCell>
                    <TableCell className="text-accent">{r.net.toLocaleString()} FCFA</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(r.status)}`}>{r.status}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination {...pg} className="pt-4" />
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Détail de la réservation</SheetTitle>
                <SheetDescription>{selected.agency_name} • {new Date(selected.created_at).toLocaleString("fr")}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Passager</h3>
                  <div className="text-sm"><span className="text-muted-foreground">Nom : </span><span className="font-medium">{selected.passenger_name}</span></div>
                  <div className="text-sm"><span className="text-muted-foreground">Téléphone : </span>{selected.phone || "—"}</div>
                  <div className="text-sm"><span className="text-muted-foreground">Siège : </span>#{selected.seat_number}</div>
                  <div className="text-sm"><span className="text-muted-foreground">Trajet : </span>{selected.trips?.departure} → {selected.trips?.destination}</div>
                </section>

                <section className="space-y-3 rounded-lg border p-4 bg-muted/30">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5" /> Paiement
                  </h3>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Statut</span>
                    <Badge variant={selected.payment_status === "paid" ? "default" : selected.payment_status === "failed" ? "destructive" : "secondary"}>
                      {selected.payment_status || "en attente"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Mode</span>
                    <span className="font-medium">{paymentLabel(selected.payment_method)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Identifiant transaction</span>
                    {selected.transaction?.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selected.transaction.id);
                          setCopied(true);
                          toast.success("Identifiant copié");
                          setTimeout(() => setCopied(false), 1500);
                        }}
                        className="flex items-center gap-1.5 font-mono text-xs bg-background border rounded px-2 py-1 hover:bg-muted"
                      >
                        {selected.transaction.id.slice(0, 8)}…{selected.transaction.id.slice(-4)}
                        {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Non disponible</span>
                    )}
                  </div>
                  {selected.transaction && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Statut transaction</span>
                      <Badge variant={selected.transaction.status === "completed" ? "default" : selected.transaction.status === "failed" ? "destructive" : "secondary"}>
                        {selected.transaction.status}
                      </Badge>
                    </div>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Montants</h3>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total</span><span className="font-semibold">{selected.total_amount.toLocaleString()} FCFA</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Commission</span><span className="text-warning">{selected.commission.toLocaleString()} FCFA</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Net agence</span><span className="text-accent font-semibold">{selected.net.toLocaleString()} FCFA</span></div>
                </section>

                {selected.qr_code && (
                  <section className="space-y-1">
                    <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Référence billet</h3>
                    <div className="font-mono text-xs bg-muted p-2 rounded">{selected.qr_code}</div>
                  </section>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try { await buildPdf(selected, "receipt"); toast.success("Reçu téléchargé"); }
                      catch { toast.error("Impossible de générer le reçu"); }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" /> Reçu
                  </Button>
                  <Button
                    onClick={async () => {
                      try { await buildPdf(selected, "ticket"); toast.success("Billet téléchargé"); }
                      catch { toast.error("Impossible de générer le billet"); }
                    }}
                  >
                    <TicketIcon className="h-4 w-4 mr-2" /> Billet
                  </Button>
                </div>
              </div>

            </>
          )}
        </SheetContent>
      </Sheet>
    </div>

  );
};

export default AgencyBookingsAdmin;
