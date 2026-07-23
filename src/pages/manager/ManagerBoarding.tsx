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
import { CheckCircle2, Clock, XCircle, QrCode, RefreshCw, Megaphone } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTrip, setBroadcastTrip] = useState<string>("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [branchInfo, setBranchInfo] = useState<any>(null);

  useEffect(() => {
    if (!manager?.branch_id) return;
    supabase.from("agency_branches").select("id, name, city, district, address")
      .eq("id", manager.branch_id).maybeSingle()
      .then(({ data }) => setBranchInfo(data));
  }, [manager?.branch_id]);

  const selectedTripObj = useMemo(
    () => trips.find((t) => t.id === broadcastTrip) || null,
    [trips, broadcastTrip]
  );

  const branchLocation = useMemo(() => {
    if (!branchInfo) return "Votre sous-agence";
    const addr = [branchInfo.address, branchInfo.district, branchInfo.city].filter(Boolean).join(", ");
    return addr ? `${branchInfo.name} — ${addr}` : branchInfo.name;
  }, [branchInfo]);

  const previewMessage = useMemo(() => {
    if (!selectedTripObj) return "";
    const d = selectedTripObj.date
      ? new Date(selectedTripObj.date + "T00:00").toLocaleDateString("fr-FR")
      : "";
    const h = (selectedTripObj.departure_time || "").slice(0, 5);
    const base = `Embarquement le ${d} à ${h}. Lieu : ${branchLocation}.`;
    const extra = broadcastMsg?.trim();
    return extra ? `${base}\n${extra}` : base;
  }, [selectedTripObj, broadcastMsg, branchLocation]);

  // Recount targets whenever selected trip changes / dialog opens
  useEffect(() => {
    const run = async () => {
      if (!broadcastOpen || !broadcastTrip || !manager?.branch_id) {
        setTargetCount(null);
        return;
      }
      const tripBranchId = selectedTripObj?.branch_id ?? null;
      let q = supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", broadcastTrip)
        .eq("payment_status", "paid")
        .neq("status", "cancelled")
        .not("user_id", "is", null);
      if (tripBranchId === manager.branch_id) {
        q = q.or(`boarding_branch_id.eq.${manager.branch_id},boarding_branch_id.is.null`);
      } else {
        q = q.eq("boarding_branch_id", manager.branch_id);
      }
      const { count } = await q;
      setTargetCount(count ?? 0);
    };
    run();
  }, [broadcastOpen, broadcastTrip, manager?.branch_id, selectedTripObj]);

  const sendBroadcast = async () => {
    if (!broadcastTrip) { toast.error("Sélectionnez un trajet"); return; }
    setBroadcasting(true);
    const { data, error } = await supabase.rpc("broadcast_boarding_info", {
      _trip_id: broadcastTrip,
      _extra_message: broadcastMsg?.trim() || null,
    });
    setBroadcasting(false);
    if (error) { toast.error(error.message); return; }
    const res: any = data;
    if (!res?.ok) { toast.error(res?.message || "Diffusion impossible"); return; }
    toast.success(`Diffusion envoyée à ${res.sent} passager(s)`);
    setConfirmOpen(false);
    setBroadcastOpen(false);
    setBroadcastMsg("");
  };

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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setBroadcastTrip(tripId !== "all" ? tripId : (trips[0]?.id ?? ""));
              setBroadcastOpen(true);
            }}
            disabled={trips.length === 0}
          >
            <Megaphone className="h-4 w-4 mr-2" /> Diffuser embarquement
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

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Diffuser les infos d'embarquement</DialogTitle>
            <DialogDescription>
              Un message avec la date, l'heure et le lieu d'embarquement (votre sous-agence) sera envoyé à tous les passagers ayant payé leur billet pour ce trajet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Trajet</label>
              <Select value={broadcastTrip} onValueChange={setBroadcastTrip}>
                <SelectTrigger><SelectValue placeholder="Sélectionnez un trajet" /></SelectTrigger>
                <SelectContent>
                  {trips.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.departure} → {t.destination} — {t.date} {t.departure_time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Message additionnel (facultatif)</label>
              <Textarea
                rows={3}
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Ex: Merci de vous présenter 30 minutes avant le départ."
              />
            </div>

            {broadcastTrip && (
              <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Aperçu du message</span>
                  <Badge variant="secondary" className="text-xs">
                    {targetCount === null ? "…" : `${targetCount} passager${targetCount > 1 ? "s" : ""} ciblé${targetCount > 1 ? "s" : ""}`}
                  </Badge>
                </div>
                <div className="rounded-lg bg-background border p-3 text-sm">
                  <div className="font-semibold mb-1">
                    Rappel embarquement : {selectedTripObj?.departure} → {selectedTripObj?.destination}
                  </div>
                  <div className="whitespace-pre-wrap text-muted-foreground">{previewMessage}</div>
                </div>
                {targetCount === 0 && (
                  <p className="text-xs text-warning-foreground">
                    Aucun passager payé n'est associé à votre sous-agence pour ce trajet.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastOpen(false)}>Annuler</Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!broadcastTrip || targetCount === 0 || targetCount === null}
            >
              <Megaphone className="h-4 w-4 mr-2" /> Prévisualiser et envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la diffusion</DialogTitle>
            <DialogDescription>
              Ce message sera envoyé immédiatement à <strong>{targetCount ?? 0}</strong> passager{(targetCount ?? 0) > 1 ? "s" : ""} ayant payé leur billet. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/40 border p-3 text-sm">
            <div className="font-semibold mb-1">
              {selectedTripObj?.departure} → {selectedTripObj?.destination}
            </div>
            <div className="whitespace-pre-wrap text-muted-foreground">{previewMessage}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={broadcasting}>
              Modifier
            </Button>
            <Button onClick={sendBroadcast} disabled={broadcasting}>
              <Megaphone className="h-4 w-4 mr-2" />
              {broadcasting ? "Envoi..." : `Confirmer l'envoi à ${targetCount ?? 0}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerBoarding;
