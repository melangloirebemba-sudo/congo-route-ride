import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Ticket, TrendingUp, CreditCard, Search } from "lucide-react";

const AgencyBookingsAdmin = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [ag, bk] = await Promise.all([
        supabase.from("agencies").select("id, name, commission_rate").order("name"),
        supabase
          .from("bookings")
          .select("id, passenger_name, phone, total_amount, status, payment_method, seat_number, created_at, trips(departure, destination, date, agencies(id, name, commission_rate))")
          .order("created_at", { ascending: false }),
      ]);
      setAgencies((ag.data || []).map((a: any) => ({ id: a.id, name: a.name })));
      const enriched = (bk.data || []).map((b: any) => {
        const rate = b.trips?.agencies?.commission_rate ?? 10;
        const commission = Math.round((b.total_amount * rate) / 100);
        return {
          ...b,
          agency_id: b.trips?.agencies?.id || null,
          agency_name: b.trips?.agencies?.name || "—",
          commission,
          net: b.total_amount - commission,
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
  }, [rows, agencyFilter, search]);

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
        <CardHeader>
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
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencyBookingsAdmin;
