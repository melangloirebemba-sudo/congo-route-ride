import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ListPagination, usePagination } from "@/components/ListPagination";
import { Globe, Search, Wallet, CheckCircle2 } from "lucide-react";

const ManagerOnlineSales = () => {
  const { manager } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!manager?.branch_id) { setRows([]); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("bookings")
      .select("id, passenger_name, phone, seat_number, qr_code, total_amount, payment_method, payment_status, payment_deadline, booking_date, created_at, boarding_status, trips!inner(departure, destination, date, departure_time, agency_id)")
      .eq("sale_channel", "online")
      .eq("payment_status", "paid")
      .eq("boarding_branch_id", manager.branch_id)
      .eq("trips.agency_id", manager.agency_id)
      .order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!manager?.branch_id) return;
    const ch = supabase
      .channel(`online-sales-${manager.branch_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `boarding_branch_id=eq.${manager.branch_id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager?.branch_id]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = rows.filter((r) => (r.booking_date || r.created_at || "").slice(0, 10) === today);
    return {
      total: rows.length,
      today: todayRows.length,
      revenue: rows.reduce((s, r) => s + (r.total_amount || 0), 0),
      todayRevenue: todayRows.reduce((s, r) => s + (r.total_amount || 0), 0),
    };
  }, [rows]);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchQ = !q || r.passenger_name?.toLowerCase().includes(q) || r.phone?.includes(search) || r.qr_code?.toLowerCase().includes(q);
    const day = (r.booking_date || r.created_at || "").slice(0, 10);
    const matchFrom = !dateFrom || day >= dateFrom;
    const matchTo = !dateTo || day <= dateTo;
    return matchQ && matchFrom && matchTo;
  });
  const pg = usePagination(filtered, 10, [search, dateFrom, dateTo], { paramKey: "" });

  const cards = [
    { label: "Ventes en ligne aujourd'hui", value: stats.today, icon: Globe, color: "text-primary" },
    { label: "Recettes du jour", value: `${stats.todayRevenue.toLocaleString()} FCFA`, icon: Wallet, color: "text-accent" },
    { label: "Total ventes confirmées", value: stats.total, icon: CheckCircle2, color: "text-primary" },
    { label: "Recettes totales", value: `${stats.revenue.toLocaleString()} FCFA`, icon: Wallet, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Ventes en ligne</h1>
        <p className="text-sm text-muted-foreground">Toutes les réservations en ligne à embarquer dans votre sous-agence</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label}><CardContent className="p-4">
            <c.icon className={`h-5 w-5 mb-2 ${c.color}`} />
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-display text-xl font-bold">{c.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Nom, téléphone, code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Du</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Au</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="self-end text-xs underline text-muted-foreground pb-2 px-1"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Passager</TableHead>
              <TableHead>Trajet</TableHead>
              <TableHead>Date voyage</TableHead>
              <TableHead>Vente</TableHead>
              <TableHead>Siège</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Paiement</TableHead>
              <TableHead>Code</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune vente en ligne confirmée</TableCell></TableRow>
              ) : pg.paginated.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{b.passenger_name}</p>
                    <p className="text-xs text-muted-foreground">{b.phone}</p>
                  </TableCell>
                  <TableCell className="text-sm">{b.trips?.departure} → {b.trips?.destination}</TableCell>
                  <TableCell className="text-sm">{b.trips?.date} · {b.trips?.departure_time}</TableCell>
                  <TableCell className="text-xs">{(b.booking_date || b.created_at || "").slice(0, 10)}</TableCell>
                  <TableCell>N°{b.seat_number}</TableCell>
                  <TableCell className="font-semibold text-sm">{b.total_amount?.toLocaleString()} FCFA</TableCell>
                  <TableCell className="text-xs">{b.payment_method || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{b.qr_code}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="p-4 border-t"><ListPagination {...pg} /></div>
      </CardContent></Card>
    </div>
  );
};

export default ManagerOnlineSales;
