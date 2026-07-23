import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPagination, usePagination } from "@/components/ListPagination";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PlusCircle, Ticket, Download, RotateCcw, RefreshCw, Wallet, Smartphone, CreditCard, Coins } from "lucide-react";
import SeatSelector from "@/components/SeatSelector";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { generateUniqueTicketCode } from "@/lib/ticketCode";


const paymentMethods = [
  { value: "cash", label: "Espèces (guichet)" },
  { value: "mtn_momo", label: "MTN MoMo" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "card", label: "Carte bancaire" },
];

interface LastTicket {
  qr: string;
  qrDataUrl: string;
  passengerName: string;
  phone: string;
  seat: number;
  payment: string;
  amount: number;
  currency: string;
  trip: any;
}

const ManagerSale = () => {
  const { manager, user } = useAuth();
  const [params] = useSearchParams();
  const [trips, setTrips] = useState<any[]>([]);
  const [tripId, setTripId] = useState<string>(params.get("trip") || "");
  const [passengerName, setPassengerName] = useState("");
  const [phone, setPhone] = useState("");
  const [seat, setSeat] = useState<number | null>(null);
  const [payment, setPayment] = useState("cash");
  const [takenSeats, setTakenSeats] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState<LastTicket | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [boardingBranchId, setBoardingBranchId] = useState<string>("");

  // Sales list (same model as Boarding page)
  const [sales, setSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState<string>("");
  const [filterTrip, setFilterTrip] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!manager) return;
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      // Counter sales: the agent can sell any of the agency's upcoming trips,
      // even if the passenger will board at another sub-agency.
      const { data } = await supabase
        .from("trips")
        .select("id, departure, destination, date, departure_time, price, currency, total_seats, available_seats, branch_id")
        .eq("agency_id", manager.agency_id)
        .gte("date", today)
        .order("date");
      setTrips(data || []);

      const { data: br } = await supabase
        .from("agency_branches" as any)
        .select("id, name, city")
        .eq("agency_id", manager.agency_id)
        .eq("status", "active")
        .order("name");
      setBranches((br as any) || []);

      // Default boarding branch = this manager's own branch
      if (manager.branch_id) setBoardingBranchId(manager.branch_id);
    })();
  }, [manager]);

  // Load recent sales for this manager's branch
  const loadSales = async () => {
    if (!manager?.branch_id) return;
    setSalesLoading(true);
    const { data: bA } = await supabase
      .from("bookings")
      .select("id, passenger_name, phone, seat_number, qr_code, payment_method, payment_status, total_amount, booking_date, created_at, boarding_status, boarding_branch_id, trip_id, trips!inner(id, departure, destination, date, departure_time, currency, branch_id)")
      .eq("boarding_branch_id", manager.branch_id)
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: bB } = await supabase
      .from("bookings")
      .select("id, passenger_name, phone, seat_number, qr_code, payment_method, payment_status, total_amount, booking_date, created_at, boarding_status, boarding_branch_id, trip_id, trips!inner(id, departure, destination, date, departure_time, currency, branch_id)")
      .is("boarding_branch_id", null)
      .eq("trips.branch_id", manager.branch_id)
      .order("created_at", { ascending: false })
      .limit(500);
    const map = new Map<string, any>();
    [...(bA || []), ...(bB || [])].forEach((r: any) => map.set(r.id, r));
    setSales(Array.from(map.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
    setSalesLoading(false);
  };

  useEffect(() => { loadSales(); }, [manager?.branch_id]);

  // Realtime refresh
  useEffect(() => {
    if (!manager?.branch_id) return;
    let t: any;
    const debounced = () => { clearTimeout(t); t = setTimeout(loadSales, 300); };
    const channel = supabase
      .channel(`sales-${manager.branch_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, debounced)
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager?.branch_id]);




  const trip = useMemo(() => trips.find((t) => t.id === tripId), [tripId, trips]);
  const [lockedSeats, setLockedSeats] = useState<number[]>([]);
  const [mySeatLock, setMySeatLock] = useState<{ seat: number; expiresAt: number } | null>(null);
  const [lockCountdown, setLockCountdown] = useState<number>(0);

  const refreshSeats = async (id: string) => {
    const [{ data: bookings }, { data: locks }] = await Promise.all([
      supabase.from("bookings").select("seat_number").eq("trip_id", id).neq("status", "cancelled"),
      supabase.from("seat_locks" as any).select("seat_number, locked_by, expires_at").eq("trip_id", id).gt("expires_at", new Date().toISOString()),
    ]);
    setTakenSeats((bookings || []).map((b: any) => b.seat_number));
    const myId = user?.id;
    setLockedSeats((locks || []).filter((l: any) => l.locked_by !== myId).map((l: any) => l.seat_number));
  };

  useEffect(() => {
    if (!tripId) { setTakenSeats([]); setLockedSeats([]); return; }
    refreshSeats(tripId);
    setSeat(null);
    setMySeatLock(null);
    const t = setInterval(() => refreshSeats(tripId), 10000);
    return () => clearInterval(t);
  }, [tripId, user?.id]);

  // Countdown for my lock
  useEffect(() => {
    if (!mySeatLock) { setLockCountdown(0); return; }
    const tick = () => setLockCountdown(Math.max(0, Math.round((mySeatLock.expiresAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [mySeatLock]);

  // Release lock on unmount or trip change
  useEffect(() => {
    return () => {
      if (mySeatLock && tripId) {
        supabase.rpc("release_seat" as any, { _trip_id: tripId, _seat_number: mySeatLock.seat });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectSeat = async (n: number) => {
    if (!tripId) return;
    // release previous
    if (mySeatLock && mySeatLock.seat !== n) {
      await supabase.rpc("release_seat" as any, { _trip_id: tripId, _seat_number: mySeatLock.seat });
    }
    const { data, error } = await supabase.rpc("lock_seat" as any, { _trip_id: tripId, _seat_number: n, _ttl_seconds: 300 });
    if (error) { toast.error(error.message); return; }
    const res: any = data;
    if (!res?.ok) {
      toast.error(res?.message || "Impossible de verrouiller ce siège");
      refreshSeats(tripId);
      return;
    }
    setSeat(n);
    setMySeatLock({ seat: n, expiresAt: new Date(res.expires_at).getTime() });
    refreshSeats(tripId);
  };

  const resetForm = () => {
    setPassengerName(""); setPhone(""); setSeat(null); setPayment("cash"); setLastTicket(null);
    setMySeatLock(null);
  };

  const submit = async () => {
    if (!trip) { toast.error("Choisissez un trajet"); return; }
    if (!passengerName.trim() || !phone.trim() || !seat) {
      toast.error("Remplissez tous les champs"); return;
    }
    if (takenSeats.includes(seat)) { toast.error("Siège déjà occupé"); return; }
    if (lockedSeats.includes(seat)) { toast.error("Siège verrouillé par un autre agent"); return; }
    if (!mySeatLock || mySeatLock.seat !== seat) {
      toast.error("Verrouillage du siège perdu, resélectionnez-le"); return;
    }
    if (Date.now() > mySeatLock.expiresAt) {
      toast.error("Verrouillage expiré, resélectionnez le siège");
      setMySeatLock(null); setSeat(null);
      return;
    }

    setSubmitting(true);
    const qr = await generateUniqueTicketCode();
    const { error } = await supabase.from("bookings").insert({
      trip_id: trip.id,
      user_id: user?.id,
      passenger_name: passengerName.trim(),
      phone: phone.trim(),
      seat_number: seat,
      status: "confirmed",
      payment_method: payment,
      payment_status: "paid",
      booking_date: new Date().toISOString().split("T")[0],
      qr_code: qr,
      total_amount: trip.price,
      boarding_branch_id: boardingBranchId || manager?.branch_id || null,
    });


    if (error) {
      setSubmitting(false);
      toast.error(error.message.includes("bookings_trip_id_seat")
        ? "Ce siège vient d'être réservé par un autre agent"
        : error.message);
      refreshSeats(trip.id);
      return;
    }

    // Consume the lock
    await supabase.rpc("release_seat" as any, { _trip_id: trip.id, _seat_number: seat });
    await supabase.from("trips").update({ available_seats: Math.max(0, (trip.available_seats || 0) - 1) }).eq("id", trip.id);

    const qrDataUrl = await QRCode.toDataURL(qr, { width: 240, margin: 1 });
    setSubmitting(false);
    toast.success(`Billet émis pour ${passengerName}`);
    setLastTicket({
      qr, qrDataUrl,
      passengerName: passengerName.trim(),
      phone: phone.trim(),
      seat,
      payment: paymentMethods.find((m) => m.value === payment)?.label || payment,
      amount: trip.price,
      currency: trip.currency,
      trip,
    });
    setTakenSeats((s) => [...s, seat]);
    setMySeatLock(null);
  };

  const downloadPdf = async () => {
    if (!lastTicket) return;
    const doc = new jsPDF({ format: "a5", unit: "mm" });
    doc.setFillColor(255, 122, 0);
    doc.rect(0, 0, 148, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("TransCongo — Billet", 10, 13);
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(11);
    let y = 30;
    const line = (label: string, val: string) => {
      doc.setFont("helvetica", "bold"); doc.text(label, 10, y);
      doc.setFont("helvetica", "normal"); doc.text(val, 55, y);
      y += 7;
    };
    line("Passager", lastTicket.passengerName);
    line("Téléphone", lastTicket.phone);
    line("Trajet", `${lastTicket.trip.departure} → ${lastTicket.trip.destination}`);
    line("Date / Heure", `${lastTicket.trip.date} ${lastTicket.trip.departure_time}`);
    line("Siège", `#${lastTicket.seat}`);
    line("Paiement", lastTicket.payment);
    line("Montant", `${lastTicket.amount.toLocaleString()} ${lastTicket.currency}`);
    line("Code", lastTicket.qr);
    doc.addImage(lastTicket.qrDataUrl, "PNG", 90, 60, 45, 45);
    doc.save(`${lastTicket.qr}.pdf`);
  };

  // Sales list computations (same model as Boarding)
  const salesTripOptions = useMemo(() => {
    const m = new Map<string, any>();
    sales.forEach((r) => r.trips && m.set(r.trips.id, r.trips));
    return Array.from(m.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter((r) => {
      const d = (r.booking_date || (r.created_at || "").slice(0, 10)) as string;
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      if (filterTrip !== "all" && r.trip_id !== filterTrip) return false;
      if (filterPayment !== "all" && r.payment_method !== filterPayment) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.passenger_name} ${r.phone} ${r.qr_code} ${r.trips?.departure} ${r.trips?.destination}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sales, dateFrom, dateTo, filterTrip, filterPayment, search]);

  const salesStats = useMemo(() => {
    const s = { count: 0, total: 0, cash: 0, mobile: 0, card: 0 };
    filteredSales.forEach((r) => {
      if (r.payment_status !== "paid") return;
      s.count++;
      s.total += Number(r.total_amount || 0);
      if (r.payment_method === "cash") s.cash += Number(r.total_amount || 0);
      else if (r.payment_method === "mtn_momo" || r.payment_method === "airtel_money") s.mobile += Number(r.total_amount || 0);
      else if (r.payment_method === "card") s.card += Number(r.total_amount || 0);
    });
    return s;
  }, [filteredSales]);

  const pgSales = usePagination(filteredSales, 10, [dateFrom, dateTo, filterTrip, filterPayment, search], { paramKey: "" });

  const paymentLabel = (m: string) => paymentMethods.find((p) => p.value === m)?.label || m;
  const paymentBadge = (m: string) => {
    if (m === "cash") return <Badge variant="outline">Espèces</Badge>;
    if (m === "mtn_momo") return <Badge className="bg-yellow-500 text-black">MTN MoMo</Badge>;
    if (m === "airtel_money") return <Badge className="bg-red-600">Airtel Money</Badge>;
    if (m === "card") return <Badge className="bg-blue-600">Carte</Badge>;
    return <Badge variant="outline">{m}</Badge>;
  };
  const boardingBadge = (bs: string | null) => {
    const v = bs || "pending";
    if (v === "boarded") return <Badge className="bg-green-600">Embarqué</Badge>;
    if (v === "refused") return <Badge variant="destructive">Refusé</Badge>;
    return <Badge variant="outline">Non scanné</Badge>;
  };
  const fmt = (n: number) => n.toLocaleString("fr-FR");
  const currency = salesTripOptions[0]?.currency || "FCFA";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <PlusCircle className="h-6 w-6 text-primary" /> Vente au guichet
        </h1>
        <p className="text-sm text-muted-foreground">Émettez un billet pour un passager qui se présente en agence.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label>Trajet</Label>
            <Select value={tripId} onValueChange={setTripId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un trajet" /></SelectTrigger>
              <SelectContent>
                {trips.length === 0 && <SelectItem value="none" disabled>Aucun trajet à venir</SelectItem>}
                {trips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.departure} → {t.destination} · {t.date} {t.departure_time} · {t.price.toLocaleString()} {t.currency} · {t.available_seats} places
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {trip && (
            <>
              <div className="bg-secondary/50 rounded-lg p-3 text-sm space-y-1">
                <p><strong>Prix :</strong> {trip.price.toLocaleString()} {trip.currency} · <strong>Places :</strong> {takenSeats.length}/{trip.total_seats}</p>
                {lockedSeats.length > 0 && (
                  <p className="text-xs text-muted-foreground">🔒 Sièges verrouillés par d'autres agents : {lockedSeats.sort((a,b)=>a-b).join(", ")}</p>
                )}
                {mySeatLock && lockCountdown > 0 && (
                  <p className="text-xs text-primary font-medium">
                    Siège #{mySeatLock.seat} verrouillé — {Math.floor(lockCountdown/60)}:{String(lockCountdown%60).padStart(2,"0")} restant
                  </p>
                )}
              </div>
              <div>
                <Label className="mb-2 block">Choix du siège</Label>
                <SeatSelector
                  totalSeats={trip.total_seats}
                  bookedSeats={[...takenSeats, ...lockedSeats]}
                  selected={seat}
                  onSelect={handleSelectSeat}
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nom du passager</Label>
              <Input value={passengerName} onChange={(e) => setPassengerName(e.target.value)} placeholder="Prénom et nom" />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+242…" />
            </div>
            <div className="sm:col-span-2">
              <Label>Mode de paiement</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Lieu d'embarquement</Label>
              <Select value={boardingBranchId} onValueChange={setBoardingBranchId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une sous-agence d'embarquement" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}{b.city ? ` — ${b.city}` : ""}{manager?.branch_id === b.id ? " (ici)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {boardingBranchId && manager?.branch_id && boardingBranchId !== manager.branch_id && (
                <p className="text-xs text-amber-700 mt-1">
                  ⚠️ Le passager embarquera dans une autre sous-agence. Elle sera notifiée automatiquement.
                </p>
              )}
            </div>

          </div>

          <Button onClick={submit} disabled={submitting || !trip || !seat} className="w-full">
            <Ticket className="h-4 w-4 mr-2" />
            {submitting ? "Émission…" : `Émettre le billet${trip ? ` — ${trip.price.toLocaleString()} ${trip.currency}` : ""}`}
          </Button>
        </CardContent>
      </Card>

      {lastTicket && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <img src={lastTicket.qrDataUrl} alt="QR code du billet" className="w-40 h-40 rounded-lg bg-white p-2 border" />
              <div className="flex-1 space-y-1 text-sm">
                <p className="font-display text-lg font-bold text-primary">Billet émis ✔</p>
                <p><strong>{lastTicket.passengerName}</strong> · {lastTicket.phone}</p>
                <p>{lastTicket.trip.departure} → {lastTicket.trip.destination}</p>
                <p>{lastTicket.trip.date} à {lastTicket.trip.departure_time} · Siège #{lastTicket.seat}</p>
                <p>{lastTicket.payment} · {lastTicket.amount.toLocaleString()} {lastTicket.currency}</p>
                <p className="text-xs text-muted-foreground">Code : <code>{lastTicket.qr}</code></p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={downloadPdf}><Download className="h-4 w-4 mr-1" />Télécharger PDF</Button>
                  <Button size="sm" variant="outline" onClick={resetForm}><RotateCcw className="h-4 w-4 mr-1" />Nouveau billet</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ManagerSale;
