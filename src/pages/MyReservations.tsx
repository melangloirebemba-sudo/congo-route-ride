import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, Loader2, CreditCard, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Reservation {
  id: string;
  qr_code: string;
  seat_number: number;
  total_amount: number;
  payment_status: string;
  payment_deadline: string | null;
  passenger_name: string;
  boarding_branch_id: string | null;
  trips: {
    departure: string;
    destination: string;
    date: string;
    departure_time: string;
    agencies: { name: string } | null;
  } | null;
  boarding_branch?: { name: string; city: string | null } | null;
}

function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return { expired: true, label: "Expiré" };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const label = d > 0 ? `${d}j ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  return { expired: false, label, days: d };
}

const Countdown = ({ deadline }: { deadline: string | null }) => {
  const c = useCountdown(deadline);
  if (!c) return null;
  const urgent = !c.expired && (c.days ?? 0) < 1;
  return (
    <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg ${c.expired ? "bg-destructive/10 text-destructive" : urgent ? "bg-warning/20 text-warning-foreground" : "bg-secondary text-muted-foreground"}`}>
      {c.expired ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {c.expired ? "Réservation expirée" : `Payer dans ${c.label}`}
    </div>
  );
};

const MyReservations = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [payFor, setPayFor] = useState<Reservation | null>(null);
  const [method, setMethod] = useState("mtn");
  const [momoPhone, setMomoPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimQr, setClaimQr] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [isAnon, setIsAnon] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [processingReq, setProcessingReq] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAnon(!!data.user?.is_anonymous));
  }, []);

  const loadPendingRequests = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user?.id) return;
    const { data } = await (supabase as any)
      .from("passenger_notifications")
      .select("id, title, message, created_at, booking_id, kind, read_at")
      .eq("user_id", u.user.id)
      .eq("kind", "payment_request")
      .is("read_at", null)
      .order("created_at", { ascending: false });
    setPendingRequests((data as any) || []);
  };

  const confirmRequest = async (id: string) => {
    setProcessingReq(id);
    const { data, error } = await (supabase as any).rpc("confirm_payment_simulation", { _notification_id: id });
    setProcessingReq(null);
    if (error || (data && data.ok === false)) {
      toast.error(data?.message || error?.message || "Échec de la confirmation");
      return;
    }
    toast.success("Paiement confirmé");
    await Promise.all([loadPendingRequests(), load()]);
  };

  const refuseRequest = async (id: string) => {
    setProcessingReq(id);
    const { data, error } = await (supabase as any).rpc("refuse_payment_simulation", { _notification_id: id });
    setProcessingReq(null);
    if (error || (data && data.ok === false)) {
      toast.error(data?.message || error?.message || "Échec du refus");
      return;
    }
    toast.info("Transaction refusée");
    await Promise.all([loadPendingRequests(), load()]);
  };


  const handleClaim = async () => {
    if (!claimQr.trim() || !claimPhone.trim()) {
      toast.error("Renseignez le code du billet et le téléphone");
      return;
    }
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_booking_by_ref", {
      _qr: claimQr.trim(),
      _phone: claimPhone.trim(),
    });
    setClaiming(false);
    if (error) { toast.error(error.message); return; }
    const r: any = data;
    if (!r?.ok) { toast.error(r?.message || "Impossible de récupérer"); return; }
    toast.success(r.message || "Billet rattaché");
    setClaimOpen(false);
    setClaimQr(""); setClaimPhone("");
    if (r.booking_id) navigate(`/bookings/${r.booking_id}`);
    else load();
  };

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) { setItems([]); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("bookings")
      .select("id, qr_code, seat_number, total_amount, payment_status, payment_deadline, passenger_name, boarding_branch_id, trips(departure, destination, date, departure_time, agencies(name))")
      .eq("user_id", uid)
      .eq("payment_status", "pending")
      .eq("sale_channel", "online")
      .order("created_at", { ascending: false });
    const rows = (data as any) || [];
    const branchIds = Array.from(new Set(rows.map((r: any) => r.boarding_branch_id).filter(Boolean)));
    let branchMap: Record<string, any> = {};
    if (branchIds.length) {
      const { data: bs } = await supabase.from("agency_branches" as any).select("id, name, city").in("id", branchIds);
      branchMap = Object.fromEntries((bs || []).map((b: any) => [b.id, b]));
    }
    setItems(rows.map((r: any) => ({ ...r, boarding_branch: r.boarding_branch_id ? branchMap[r.boarding_branch_id] : null })));
    setLoading(false);
  };

  useEffect(() => { load(); loadPendingRequests(); }, []);

  useEffect(() => {
    let ch: any;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return;
      ch = supabase
        .channel(`passenger-notifs-${uid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "passenger_notifications", filter: `user_id=eq.${uid}` }, () => { loadPendingRequests(); load(); })
        .subscribe();
    })();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, []);

  const paymentLabels: Record<string, string> = { mtn: "MTN MoMo", airtel: "Airtel Money", card: "Carte bancaire" };

  const handlePay = async () => {
    if (!payFor) return;
    setSubmitting(true);
    const isMomo = method === "mtn" || method === "airtel";

    if (isMomo) {
      const { data, error } = await (supabase as any).rpc("init_payment_simulation", {
        _booking_id: payFor.id,
        _momo_phone: (momoPhone || payFor.passenger_name || "").trim() || "unknown",
        _provider: method === "mtn" ? "MTN MoMo" : "Airtel Money",
      });
      setSubmitting(false);
      if (error || (data && data.ok === false)) {
        toast.error(data?.message || error?.message || "Erreur lors de l'initialisation du paiement");
        return;
      }
      toast.success("Demande envoyée. Confirmez la transaction ci-dessous.");
      setPayFor(null);
      await loadPendingRequests();
      return;
    }

    // Card = simulated instant success
    const { error } = await supabase
      .from("bookings")
      .update({ payment_status: "paid", payment_method: paymentLabels[method] || method })
      .eq("id", payFor.id);
    if (error) {
      toast.error("Erreur lors du paiement");
      setSubmitting(false);
      return;
    }
    const commission = Math.round(payFor.total_amount * 0.1);
    await supabase.from("transactions").insert({
      agency_id: null,
      amount: payFor.total_amount,
      commission,
      net_amount: payFor.total_amount - commission,
      payment_method: paymentLabels[method] || method,
      status: "completed",
    } as any);
    toast.success("Paiement confirmé");
    setPayFor(null);
    setSubmitting(false);
    await load();
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="gradient-primary px-4 pt-10 pb-6">
        <button onClick={() => navigate(-1)} className="text-primary-foreground mb-4">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-bold text-primary-foreground">Mes réservations</h1>
        <p className="text-primary-foreground/70 text-xs mt-1">Réservations en attente de paiement</p>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        <div className="bg-card rounded-2xl p-4 border border-border/50 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Récupérer un billet invité</p>
            <p className="text-xs text-muted-foreground">
              {isAnon
                ? "Vous êtes en session invitée. Créez un compte ou connectez-vous pour rattacher vos billets à un compte permanent."
                : "Rattachez à votre compte un billet réservé sans compte."}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setClaimOpen(true)}>Récupérer</Button>
        </div>

        {pendingRequests.length > 0 && (
          <div className="bg-warning/10 border-2 border-warning rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-foreground" />
              <p className="text-sm font-semibold">Demande(s) de paiement Mobile Money</p>
            </div>
            {pendingRequests.map((req) => (
              <div key={req.id} className="bg-card rounded-xl p-3 border border-border/50 space-y-2">
                <p className="text-sm font-medium">{req.title}</p>
                {req.message && <p className="text-xs text-muted-foreground whitespace-pre-line">{req.message}</p>}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => confirmRequest(req.id)}
                    disabled={processingReq === req.id}
                    className="flex-1 gradient-primary text-primary-foreground"
                  >
                    {processingReq === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmer"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refuseRequest(req.id)}
                    disabled={processingReq === req.id}
                    className="flex-1"
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucune réservation en attente</p>
            <Button variant="link" onClick={() => navigate("/bookings")} className="mt-2">Voir mes billets payés →</Button>
          </div>
        ) : (
          items.map((r) => (
            <div key={r.id} onClick={() => navigate(`/bookings/${r.id}`)} className="bg-card rounded-2xl p-4 border border-border/50 space-y-3 cursor-pointer hover:border-primary/40 transition-colors" role="button">
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3 text-primary" />
                <span className="text-sm font-semibold">{r.trips?.departure} → {r.trips?.destination}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{r.trips?.date ? new Date(r.trips.date).toLocaleDateString("fr-FR") : ""} · {r.trips?.departure_time} · Siège {r.seat_number}</p>
                <p>{r.passenger_name} · {r.trips?.agencies?.name}</p>
                {r.boarding_branch && <p>🚏 Embarquement : {r.boarding_branch.name}{r.boarding_branch.city ? ` (${r.boarding_branch.city})` : ""}</p>}
                <p className="font-mono">{r.qr_code}</p>
              </div>
              <Countdown deadline={r.payment_deadline} />
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="font-display font-bold text-primary">{r.total_amount.toLocaleString()} FCFA</span>
                <Button size="sm" onClick={(e) => { e.stopPropagation(); setPayFor(r); }} className="gradient-primary text-primary-foreground">
                  <CreditCard className="h-3 w-3 mr-1" /> Payer maintenant
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">Ou payez directement à l'agence d'embarquement</p>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payer la réservation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Montant : <span className="font-bold text-primary">{payFor?.total_amount.toLocaleString()} FCFA</span></p>
            <div className="space-y-2">
              {[
                { id: "mtn", label: "MTN MoMo", emoji: "📱" },
                { id: "airtel", label: "Airtel Money", emoji: "📲" },
                { id: "card", label: "Carte bancaire", emoji: "💳" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 ${method === m.id ? "border-primary bg-secondary" : "border-border"}`}
                >
                  <span className="text-xl">{m.emoji}</span>
                  <span className="text-sm">{m.label}</span>
                </button>
              ))}
            </div>
            {(method === "mtn" || method === "airtel") && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Numéro Mobile Money</label>
                <input
                  value={momoPhone}
                  onChange={(e) => setMomoPhone(e.target.value)}
                  placeholder="Ex: 06 000 00 00"
                  inputMode="tel"
                  className="w-full rounded-xl bg-secondary text-secondary-foreground px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Une demande apparaîtra ci-dessus à confirmer ou refuser.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Annuler</Button>
            <Button onClick={handlePay} disabled={submitting} className="gradient-primary text-primary-foreground">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer le paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Récupérer un billet invité</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Renseignez le code du billet (QR) et le numéro de téléphone utilisé lors de la réservation. Le billet sera rattaché à votre compte.
            </p>
            <div>
              <label className="text-xs text-muted-foreground">Code du billet</label>
              <input
                value={claimQr}
                onChange={(e) => setClaimQr(e.target.value)}
                placeholder="Ex: TCG-XXXX-XXXX"
                className="w-full rounded-xl bg-secondary text-secondary-foreground px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Téléphone du passager</label>
              <input
                value={claimPhone}
                onChange={(e) => setClaimPhone(e.target.value)}
                placeholder="+242…"
                className="w-full rounded-xl bg-secondary text-secondary-foreground px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimOpen(false)}>Annuler</Button>
            <Button onClick={handleClaim} disabled={claiming} className="gradient-primary text-primary-foreground">
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rattacher le billet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyReservations;
