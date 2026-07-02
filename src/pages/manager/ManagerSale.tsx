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
import { PlusCircle, Ticket } from "lucide-react";

const paymentMethods = [
  { value: "cash", label: "Espèces (guichet)" },
  { value: "mtn_momo", label: "MTN MoMo" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "card", label: "Carte bancaire" },
];

const ManagerSale = () => {
  const { manager, user } = useAuth();
  const [params] = useSearchParams();
  const [trips, setTrips] = useState<any[]>([]);
  const [tripId, setTripId] = useState<string>(params.get("trip") || "");
  const [passengerName, setPassengerName] = useState("");
  const [phone, setPhone] = useState("");
  const [seat, setSeat] = useState("");
  const [payment, setPayment] = useState("cash");
  const [takenSeats, setTakenSeats] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState<string | null>(null);

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

  useEffect(() => {
    if (!tripId) { setTakenSeats([]); return; }
    (async () => {
      const { data } = await supabase.from("bookings").select("seat_number").eq("trip_id", tripId).neq("status", "cancelled");
      setTakenSeats((data || []).map((b: any) => b.seat_number));
    })();
  }, [tripId]);

  const submit = async () => {
    if (!trip) { toast.error("Choisissez un trajet"); return; }
    if (!passengerName.trim() || !phone.trim() || !seat) {
      toast.error("Remplissez tous les champs"); return;
    }
    const seatNum = parseInt(seat, 10);
    if (isNaN(seatNum) || seatNum < 1 || seatNum > trip.total_seats) {
      toast.error("Numéro de siège invalide"); return;
    }
    if (takenSeats.includes(seatNum)) { toast.error("Siège déjà occupé"); return; }

    setSubmitting(true);
    const qr = `TC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { data, error } = await supabase.from("bookings").insert({
      trip_id: trip.id,
      user_id: user?.id,
      passenger_name: passengerName.trim(),
      phone: phone.trim(),
      seat_number: seatNum,
      status: "confirmed",
      payment_method: payment,
      payment_status: "paid",
      booking_date: new Date().toISOString().split("T")[0],
      qr_code: qr,
      total_amount: trip.price,
    }).select().single();
    setSubmitting(false);

    if (error) { toast.error(error.message); return; }

    await supabase.from("trips").update({ available_seats: Math.max(0, (trip.available_seats || 0) - 1) }).eq("id", trip.id);

    toast.success(`Billet émis pour ${passengerName}`);
    setLastTicket(qr);
    setPassengerName(""); setPhone(""); setSeat("");
    setTakenSeats((s) => [...s, seatNum]);
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
            <div className="bg-secondary/50 rounded-lg p-3 text-sm space-y-1">
              <p><strong>Prix :</strong> {trip.price.toLocaleString()} {trip.currency}</p>
              <p><strong>Places prises :</strong> {takenSeats.length} / {trip.total_seats}</p>
              {takenSeats.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Sièges occupés : {takenSeats.sort((a, b) => a - b).join(", ")}
                </p>
              )}
            </div>
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
            <div>
              <Label>N° de siège</Label>
              <Input type="number" min={1} max={trip?.total_seats || 50} value={seat} onChange={(e) => setSeat(e.target.value)} />
            </div>
            <div>
              <Label>Mode de paiement</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={submit} disabled={submitting || !trip} className="w-full">
            <Ticket className="h-4 w-4 mr-2" />
            {submitting ? "Émission…" : `Émettre le billet${trip ? ` — ${trip.price.toLocaleString()} ${trip.currency}` : ""}`}
          </Button>

          {lastTicket && (
            <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm">
              <p className="font-semibold">Billet émis ✔</p>
              <p className="text-xs text-muted-foreground">Code : <code>{lastTicket}</code></p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerSale;
