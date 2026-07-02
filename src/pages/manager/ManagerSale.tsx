import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PlusCircle, Ticket, Download, RotateCcw } from "lucide-react";
import SeatSelector from "@/components/SeatSelector";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

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

  useEffect(() => {
    if (!manager) return;
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("trips")
        .select("id, departure, destination, date, departure_time, price, currency, total_seats, available_seats")
        .eq("agency_id", manager.agency_id)
        .gte("date", today)
        .order("date");
      setTrips(data || []);
    })();
  }, [manager]);

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
  };

  const submit = async () => {
    if (!trip) { toast.error("Choisissez un trajet"); return; }
    if (!passengerName.trim() || !phone.trim() || !seat) {
      toast.error("Remplissez tous les champs"); return;
    }
    if (takenSeats.includes(seat)) { toast.error("Siège déjà occupé"); return; }

    setSubmitting(true);
    const qr = `TC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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
    });

    if (error) { setSubmitting(false); toast.error(error.message); return; }

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

  return (
    <div className="space-y-6 max-w-3xl">
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
              <div className="bg-secondary/50 rounded-lg p-3 text-sm">
                <p><strong>Prix :</strong> {trip.price.toLocaleString()} {trip.currency} · <strong>Places :</strong> {takenSeats.length}/{trip.total_seats}</p>
              </div>
              <div>
                <Label className="mb-2 block">Choix du siège</Label>
                <SeatSelector totalSeats={trip.total_seats} bookedSeats={takenSeats} selected={seat} onSelect={setSeat} />
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
