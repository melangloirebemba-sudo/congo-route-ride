import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPagination, usePagination } from "@/components/ListPagination";
import { CheckCircle2, Clock, XCircle, QrCode, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

const ManagerBoarding = () => {
  const { manager } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState<string>("");
  const [tripId, setTripId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!manager?.branch_id) return;
    setLoading(true);

    // Bookings where boarding happens at this branch:
    // - explicit boarding_branch_id = this branch
    // - OR trip.branch_id = this branch AND boarding_branch_id is null
    const { data: bA } = await supabase
      .from("bookings")
      .select("id, passenger_name, phone, seat_number, qr_code, status, payment_status, boarding_status, boarded_at, boarding_notes, boarding_branch_id, trip_id, trips!inner(id, departure, destination, date, departure_time, branch_id, agency_id)")
      .eq("boarding_branch_id", manager.branch_id);

    const { data: bB } = await supabase
      .from("bookings")
      .select("id, passenger_name, phone, seat_number, qr_code, status, payment_status, boarding_status, boarded_at, boarding_notes, boarding_branch_id, trip_id, trips!inner(id, departure, destination, date, departure_time, branch_id, agency_id)")
      .is("boarding_branch_id", null)
      .eq("trips.branch_id", manager.branch_id);

    const map = new Map<string, any>();
    [...(bA || []), ...(bB || [])].forEach((r: any) => map.set(r.id, r));
    const all = Array.from(map.values());
    setRows(all);

    const tripMap = new Map<string, any>();
    all.forEach((r: any) => r.trips && tripMap.set(r.trips.id, r.trips));
    setTrips(Array.from(tripMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1)));

    setLoading(false);
  };

  useEffect(() => { load(); }, [manager?.branch_id]);

  // Realtime: refresh counters and list when any booking changes while scanning.
  useEffect(() => {
    if (!manager?.branch_id) return;
    let t: any;
    const debouncedLoad = () => { clearTimeout(t); t = setTimeout(load, 300); };
    const channel = supabase
      .channel(`boarding-${manager.branch_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, debouncedLoad)
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager?.branch_id]);

  const scanHref = useMemo(() => {
    const p = new URLSearchParams();
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    if (tripId !== "all") p.set("trip_id", tripId);
    if (status !== "all") p.set("status", status);
    const qs = p.toString();
    return `/manager/scan${qs ? `?${qs}` : ""}`;
  }, [dateFrom, dateTo, tripId, status]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const d = r.trips?.date;
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      if (tripId !== "all" && r.trip_id !== tripId) return false;
      if (status !== "all") {
        const bs = r.boarding_status || "pending";
        if (bs !== status) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.passenger_name} ${r.phone} ${r.qr_code} ${r.trips?.departure} ${r.trips?.destination}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, dateFrom, dateTo, tripId, status, search]);

  const stats = useMemo(() => {
    const s = { pending: 0, boarded: 0, refused: 0 };
    filtered.forEach((r) => {
      const bs = r.boarding_status || "pending";
      if (bs === "boarded") s.boarded++;
      else if (bs === "refused") s.refused++;
      else s.pending++;
    });
    return s;
  }, [filtered]);

  const pg = usePagination(filtered, 10, [dateFrom, dateTo, tripId, status, search], { paramKey: "" });

  const statusBadge = (bs: string | null) => {
    const v = bs || "pending";
    if (v === "boarded") return <Badge className="bg-green-600">Embarqué</Badge>;
    if (v === "refused") return <Badge variant="destructive">Refusé</Badge>;
    return <Badge variant="outline">Non scanné</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold">Tableau d'embarquement</h1>
          <p className="text-sm text-muted-foreground">Suivi des billets à embarquer dans votre sous-agence</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </Button>
          <Button asChild size="sm">
            <Link to={scanHref}><QrCode className="h-4 w-4 mr-2" /> Scanner</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-amber-600" /> Non scannés</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-amber-600">{stats.pending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Embarqués</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{stats.boarded}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /> Refusés</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-destructive">{stats.refused}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Du</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Au</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Trajet</label>
            <Select value={tripId} onValueChange={setTripId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les trajets</SelectItem>
                {trips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.departure} → {t.destination} — {t.date} {t.departure_time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Statut</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">Non scanné</SelectItem>
                <SelectItem value="boarded">Embarqué</SelectItem>
                <SelectItem value="refused">Refusé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5">
            <Input placeholder="Rechercher passager, téléphone, code TC-…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Passager</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Date / Heure</TableHead>
                  <TableHead>Siège</TableHead>
                  <TableHead>Embarquement</TableHead>
                  <TableHead>Scanné le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun billet trouvé</TableCell></TableRow>
                ) : pg.paginated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.qr_code}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{r.passenger_name}</div>
                      <div className="text-xs text-muted-foreground">{r.phone}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.trips?.departure} → {r.trips?.destination}</TableCell>
                    <TableCell className="text-sm">{r.trips?.date} <span className="text-muted-foreground">{r.trips?.departure_time}</span></TableCell>
                    <TableCell className="text-sm">#{r.seat_number}</TableCell>
                    <TableCell>
                      {statusBadge(r.boarding_status)}
                      {r.boarding_notes && <div className="text-xs text-muted-foreground mt-1">{r.boarding_notes}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.boarded_at ? new Date(r.boarded_at).toLocaleString("fr-FR") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t"><ListPagination {...pg} /></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerBoarding;
