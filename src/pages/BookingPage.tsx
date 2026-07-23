import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, User, CreditCard, CheckCircle2, Loader2, MapPin, Clock, AlertTriangle, UserPlus, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { generateUniqueTicketCode } from "@/lib/ticketCode";

interface TripData {
  id: string;
  departure: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  date: string;
  price: number;
  agency_id: string;
  branch_id: string | null;
  agencies: { name: string } | null;
}

interface Branch {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
}

const paymentLabels: Record<string, string> = {
  mtn: "MTN MoMo",
  airtel: "Airtel Money",
  card: "Carte bancaire",
  agency: "À payer à l'agence",
};

const BookingPage = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const seat = params.get("seat");

  const [trip, setTrip] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mtn");
  const [payMode, setPayMode] = useState<"now" | "later">("now");
  const [step, setStep] = useState<"form" | "confirmed">("form");
  const [bookingRef, setBookingRef] = useState("");
  const [pendingRef, setPendingRef] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allowedBranchIds, setAllowedBranchIds] = useState<string[]>([]);
  const [boardingBranchId, setBoardingBranchId] = useState<string>("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("trips")
        .select("id, departure, destination, departure_time, arrival_time, date, price, agency_id, branch_id, agencies(name)")
        .eq("id", id!)
        .maybeSingle();
      const t = data as unknown as TripData;
      setTrip(t);
      if (t) {
        const [{ data: b }, { data: tb }] = await Promise.all([
          supabase.from("agency_branches" as any).select("id, name, city, district").eq("agency_id", t.agency_id).eq("status", "active").order("name"),
          supabase.from("trip_branches" as any).select("branch_id").eq("trip_id", t.id),
        ]);
        setBranches((b as any) || []);
        const ids = new Set<string>((tb as any || []).map((r: any) => r.branch_id));
        if (t.branch_id) ids.add(t.branch_id);
        setAllowedBranchIds(Array.from(ids));
      }
      setLoading(false);
    };
    fetch();
  }, [id]);

  const hoursUntilTrip = useMemo(() => {
    if (!trip) return 0;
    const dt = new Date(`${trip.date}T${trip.departure_time || "00:00"}`);
    return (dt.getTime() - Date.now()) / 3600000;
  }, [trip]);

  const canReserveLater = hoursUntilTrip > 48;
  const canBuyDirect = hoursUntilTrip >= 0; // always allow direct, esp <24h forced
  const tooLate = hoursUntilTrip < 0;

  // Force "now" when reservation not allowed
  useEffect(() => {
    if (!canReserveLater && payMode === "later") setPayMode("now");
  }, [canReserveLater, payMode]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!trip) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Trajet introuvable</p></div>;
  }

  const agencyName = trip.agencies?.name || "Agence";
  const branchAllowed = boardingBranchId && allowedBranchIds.includes(boardingBranchId);
  const alternateBranches = branches.filter((b) => allowedBranchIds.includes(b.id));

  const handleConfirm = async () => {
    if (!name || !phone || !boardingBranchId) return;
    if (!branchAllowed) {
      toast.error("Ce trajet n'est pas disponible sur cette sous-agence");
      return;
    }
    setSubmitting(true);

    const qrCode = await generateUniqueTicketCode();
    let { data: session } = await supabase.auth.getSession();
    let userId = session?.session?.user?.id || null;
    let anonUsed = false;

    // Guest checkout: sign in anonymously to satisfy RLS and preserve history
    if (!userId) {
      const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr || !anon?.user?.id) {
        toast.error("Impossible de créer une session invité. Réessayez.");
        setSubmitting(false);
        return;
      }
      userId = anon.user.id;
      anonUsed = true;
    }

    const isReservation = payMode === "later";
    // deadline: 2h before departure OR now+30min if <2h, cap 24h before if trip far
    const departDate = new Date(`${trip.date}T${trip.departure_time || "00:00"}`);
    const deadline = new Date(departDate.getTime() - 2 * 3600000);

    const { error } = await (supabase as any).from("bookings").insert({
      trip_id: trip.id,
      passenger_name: name,
      phone,
      seat_number: Number(seat),
      payment_method: isReservation ? paymentLabels.agency : (paymentLabels[paymentMethod] || paymentMethod),
      payment_status: isReservation ? "pending" : "paid",
      status: "confirmed",
      total_amount: trip.price,
      qr_code: qrCode,
      user_id: userId,
      boarding_branch_id: boardingBranchId,
      sale_channel: "online",
      payment_deadline: isReservation ? deadline.toISOString() : null,
    });

    if (error) {
      toast.error("Erreur lors de la réservation. Veuillez réessayer.");
      setSubmitting(false);
      return;
    }

    if (!isReservation) {
      const commission = Math.round(trip.price * 0.1);
      await supabase.from("transactions").insert({
        agency_id: trip.agency_id,
        amount: trip.price,
        commission,
        net_amount: trip.price - commission,
        payment_method: paymentLabels[paymentMethod] || paymentMethod,
        status: "completed",
      });
    }

    setBookingRef(qrCode);
    setPendingRef(isReservation);
    setStep("confirmed");
    setSubmitting(false);
  };

  if (step === "confirmed") {
    return (
      <div className="min-h-screen pb-24">
        <div className={`${pendingRef ? "bg-warning" : "bg-accent"} px-4 pt-12 pb-8 text-center`}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
            {pendingRef ? <Clock className="h-16 w-16 mx-auto text-warning-foreground mb-3" /> : <CheckCircle2 className="h-16 w-16 mx-auto text-accent-foreground mb-3" />}
          </motion.div>
          <h1 className="font-display text-2xl font-bold text-accent-foreground">
            {pendingRef ? "Réservation enregistrée !" : "Réservation confirmée !"}
          </h1>
          <p className="text-accent-foreground/80 text-sm mt-1">
            {pendingRef ? "À payer à l'agence ou depuis « Mes réservations »" : "Votre billet a été généré"}
          </p>
        </div>

        <div className="px-4 py-6 max-w-lg mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-6 border border-border/50 text-center">
            <div className="mb-4 inline-block p-4 bg-secondary rounded-xl">
              <QRCodeSVG value={bookingRef} size={160} />
            </div>
            <p className="font-display font-bold text-sm mb-4">{bookingRef}</p>
            <div className="text-left space-y-2 border-t border-border/50 pt-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Passager</span><span className="font-medium">{name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Trajet</span><span className="font-medium">{trip.departure} → {trip.destination}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{new Date(trip.date).toLocaleDateString("fr-FR")} · {trip.departure_time}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Siège</span><span className="font-medium">N° {seat}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Agence</span><span className="font-medium">{agencyName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Embarquement</span><span className="font-medium">{branches.find(b => b.id === boardingBranchId)?.name || "-"}</span></div>
              <div className="flex justify-between border-t border-border/50 pt-2">
                <span className="text-muted-foreground">{pendingRef ? "À payer" : "Total payé"}</span>
                <span className="font-display font-bold text-primary">{trip.price.toLocaleString()} FCFA</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-6">
              {pendingRef && (
                <Button onClick={() => navigate("/reservations")} className="gradient-primary text-primary-foreground rounded-xl font-display h-12">Voir mes réservations</Button>
              )}
              <Button variant="outline" onClick={() => navigate("/")} className="rounded-xl h-12">Retour à l'accueil</Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="gradient-primary px-4 pt-10 pb-6">
        <button onClick={() => navigate(-1)} className="text-primary-foreground mb-4"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="font-display text-xl font-bold text-primary-foreground">Réserver</h1>
        <p className="text-primary-foreground/70 text-sm mt-1">{trip.departure} → {trip.destination} · Siège {seat}</p>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {tooLate && (
          <div className="bg-destructive/10 border border-destructive rounded-xl p-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Ce trajet est déjà passé.
          </div>
        )}

        <div className="bg-card rounded-2xl p-5 border border-border/50 space-y-3">
          <h2 className="font-display font-semibold">Informations passager</h2>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone (+242 ...)"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border/50 space-y-3">
          <h2 className="font-display font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Lieu d'embarquement</h2>
          <p className="text-xs text-muted-foreground">Choisissez la sous-agence où vous embarquerez.</p>
          <select
            value={boardingBranchId}
            onChange={(e) => setBoardingBranchId(e.target.value)}
            className="w-full py-3 px-3 rounded-xl bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">-- Sélectionner --</option>
            {branches.map((b) => {
              const ok = allowedBranchIds.includes(b.id);
              return (
                <option key={b.id} value={b.id}>
                  {b.name}{b.city ? ` — ${b.city}` : ""}{!ok ? " (trajet non disponible)" : ""}
                </option>
              );
            })}
          </select>
          {boardingBranchId && !branchAllowed && (
            <div className="bg-warning/10 border border-warning rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-warning-foreground">
                <AlertTriangle className="h-4 w-4" /> Ce trajet n'est pas activé dans cette sous-agence.
              </div>
              {alternateBranches.length > 0 ? (
                <div>
                  <p className="text-muted-foreground mb-1">Disponible dans :</p>
                  <ul className="space-y-1">
                    {alternateBranches.map((b) => (
                      <li key={b.id}>
                        <button onClick={() => setBoardingBranchId(b.id)} className="text-primary underline text-left">
                          → {b.name}{b.city ? ` — ${b.city}` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-muted-foreground">Aucune sous-agence n'offre ce trajet pour l'instant.</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border/50 space-y-3">
          <h2 className="font-display font-semibold">Mode d'achat</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={!canBuyDirect || tooLate}
              onClick={() => setPayMode("now")}
              className={`p-3 rounded-xl border-2 text-sm ${payMode === "now" ? "border-primary bg-secondary" : "border-border"} ${(!canBuyDirect || tooLate) ? "opacity-50" : ""}`}
            >
              <CreditCard className="h-4 w-4 mx-auto mb-1" />
              Payer maintenant
            </button>
            <button
              disabled={!canReserveLater}
              onClick={() => setPayMode("later")}
              className={`p-3 rounded-xl border-2 text-sm ${payMode === "later" ? "border-primary bg-secondary" : "border-border"} ${!canReserveLater ? "opacity-50" : ""}`}
            >
              <Clock className="h-4 w-4 mx-auto mb-1" />
              Réserver, payer plus tard
            </button>
          </div>
          {!canReserveLater && !tooLate && (
            <p className="text-[11px] text-muted-foreground">
              Les réservations à payer plus tard ne sont possibles qu'à plus de 48h du voyage. Achat direct uniquement.
            </p>
          )}
          {canReserveLater && (
            <p className="text-[11px] text-muted-foreground">
              Réservez maintenant et payez à l'agence d'embarquement, ou depuis « Mes réservations » avant 2h du départ.
            </p>
          )}
        </div>

        {payMode === "now" && (
          <div className="bg-card rounded-2xl p-5 border border-border/50 space-y-3">
            <h2 className="font-display font-semibold">Mode de paiement</h2>
            {[
              { id: "mtn", label: "MTN MoMo", emoji: "📱" },
              { id: "airtel", label: "Airtel Money", emoji: "📲" },
              { id: "card", label: "Carte bancaire", emoji: "💳" },
            ].map((m) => (
              <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${paymentMethod === m.id ? "border-primary bg-secondary" : "border-border bg-background"}`}>
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-sm font-medium">{m.label}</span>
                {paymentMethod === m.id && <CheckCircle2 className="ml-auto h-5 w-5 text-primary" />}
              </button>
            ))}
          </div>
        )}

        <div className="bg-card rounded-2xl p-5 border border-border/50">
          <h2 className="font-display font-semibold mb-3">Résumé</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Billet</span><span>{trip.price.toLocaleString()} FCFA</span></div>
            <div className="flex justify-between border-t border-border/50 pt-2 font-bold">
              <span>{payMode === "later" ? "À payer" : "Total"}</span>
              <span className="text-primary">{trip.price.toLocaleString()} FCFA</span>
            </div>
          </div>
        </div>

        <Button onClick={handleConfirm} disabled={!name || !phone || !boardingBranchId || !branchAllowed || submitting || tooLate}
          className="w-full gradient-primary text-primary-foreground py-3 rounded-xl font-display font-semibold h-12">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : payMode === "later" ? <Clock className="mr-2 h-4 w-4" /> : <CreditCard className="mr-2 h-4 w-4" />}
          {payMode === "later" ? "Confirmer la réservation" : "Payer et confirmer"}
        </Button>
      </div>
    </div>
  );
};

export default BookingPage;
