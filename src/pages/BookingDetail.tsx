import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, MapPin, Calendar, CreditCard, Download, Printer, QrCode as QrIcon, Clock, CheckCircle2, XCircle, Ticket, User, Building2, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface BookingRow {
  id: string;
  qr_code: string;
  seat_number: number;
  total_amount: number;
  passenger_name: string;
  phone: string;
  status: string;
  payment_status: string;
  payment_method: string;
  payment_deadline: string | null;
  sale_channel: string;
  booking_date: string;
  created_at: string;
  updated_at: string;
  boarding_status: string;
  boarded_at: string | null;
  boarding_notes: string | null;
  boarding_branch_id: string | null;
  trips: {
    departure: string;
    destination: string;
    date: string;
    departure_time: string;
    agencies: { name: string } | null;
  } | null;
}

interface EventItem {
  key: string;
  when: string;
  title: string;
  desc?: string;
  tone: "primary" | "success" | "warning" | "danger" | "muted";
  icon: any;
}

const statusMeta = (b: BookingRow) => {
  if (b.status === "cancelled") return { label: "Annulée", tone: "danger" as const, icon: XCircle };
  if (b.boarding_status === "refused") return { label: "Refusée à l'embarquement", tone: "danger" as const, icon: XCircle };
  if (b.boarding_status === "boarded" || b.status === "used") return { label: "Embarqué", tone: "success" as const, icon: CheckCircle2 };
  if (b.payment_status === "paid") return { label: "Payée · billet valide", tone: "success" as const, icon: Ticket };
  if (b.payment_status === "pending") return { label: "En attente de paiement", tone: "warning" as const, icon: Clock };
  return { label: b.status, tone: "muted" as const, icon: Ticket };
};

const toneClass: Record<string, string> = {
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-accent/15 text-accent border-accent/25",
  warning: "bg-warning/15 text-warning-foreground border-warning/25",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  muted: "bg-muted text-muted-foreground border-border",
};

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "";

const useCountdown = (target: string | null) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return { expired: true, label: "Expiré" };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { expired: false, label: d > 0 ? `${d}j ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s` };
};

const BookingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [branch, setBranch] = useState<{ name: string; city: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState("mtn");
  const [submitting, setSubmitting] = useState(false);
  const countdown = useCountdown(booking?.payment_status === "pending" ? booking.payment_deadline : null);

  const load = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("bookings")
      .select("id, qr_code, seat_number, total_amount, passenger_name, phone, status, payment_status, payment_method, payment_deadline, sale_channel, booking_date, created_at, updated_at, boarding_status, boarded_at, boarding_notes, boarding_branch_id, trips(departure, destination, date, departure_time, agencies(name))")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      setLoading(false);
      return;
    }
    setBooking(data as unknown as BookingRow);
    if ((data as any).boarding_branch_id) {
      const { data: b } = await supabase
        .from("agency_branches" as any)
        .select("name, city")
        .eq("id", (data as any).boarding_branch_id)
        .maybeSingle();
      setBranch((b as any) || null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const paymentLabels: Record<string, string> = { mtn: "MTN MoMo", airtel: "Airtel Money", card: "Carte bancaire" };

  const handlePay = async () => {
    if (!booking) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("bookings")
      .update({ payment_status: "paid", payment_method: paymentLabels[method] || method })
      .eq("id", booking.id);
    if (error) {
      toast.error("Erreur lors du paiement");
      setSubmitting(false);
      return;
    }
    const commission = Math.round(booking.total_amount * 0.1);
    await supabase.from("transactions").insert({
      agency_id: null,
      amount: booking.total_amount,
      commission,
      net_amount: booking.total_amount - commission,
      payment_method: paymentLabels[method] || method,
      status: "completed",
    } as any);
    toast.success("Paiement confirmé");
    setPayOpen(false);
    setSubmitting(false);
    await load();
  };

  const buildPdf = async (kind: "ticket" | "receipt") => {
    if (!booking) return null;
    const doc = new jsPDF({ format: "a5", unit: "mm" });
    doc.setFillColor(255, 122, 0);
    doc.rect(0, 0, 148, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text(kind === "ticket" ? "TransCongo — Billet électronique" : "TransCongo — Reçu de paiement", 10, 13);
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(11);
    let y = 30;
    const line = (label: string, val: string) => {
      doc.setFont("helvetica", "bold"); doc.text(label, 10, y);
      doc.setFont("helvetica", "normal"); doc.text(val, 55, y);
      y += 7;
    };
    line("Passager", booking.passenger_name);
    line("Téléphone", booking.phone);
    if (booking.trips) {
      line("Trajet", `${booking.trips.departure} → ${booking.trips.destination}`);
      line("Date / Heure", `${booking.trips.date} ${booking.trips.departure_time?.slice(0,5) || ""}`);
      if (booking.trips.agencies?.name) line("Agence", booking.trips.agencies.name);
    }
    if (branch) line("Embarquement", `${branch.name}${branch.city ? ` (${branch.city})` : ""}`);
    line("Siège", `#${booking.seat_number}`);
    line("Paiement", `${booking.payment_status}${booking.payment_method ? ` · ${booking.payment_method}` : ""}`);
    line("Montant", `${booking.total_amount.toLocaleString("fr-FR")} FCFA`);
    line("Statut", booking.status);
    line("Code", booking.qr_code);
    if (kind === "ticket") {
      const qrDataUrl = await QRCode.toDataURL(booking.qr_code, { width: 240, margin: 1 });
      doc.addImage(qrDataUrl, "PNG", 95, 55, 45, 45);
    } else {
      line("Émis le", fmt(booking.updated_at));
    }
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(kind === "ticket" ? "Présentez ce billet à l'embarquement" : "Reçu à conserver — merci de votre confiance", 10, 200);
    return doc;
  };

  const downloadTicket = async () => {
    const doc = await buildPdf("ticket");
    if (doc && booking) doc.save(`billet-${booking.qr_code}.pdf`);
  };
  const downloadReceipt = async () => {
    const doc = await buildPdf("receipt");
    if (doc && booking) doc.save(`recu-${booking.qr_code}.pdf`);
  };
  const printTicket = async () => {
    const doc = await buildPdf("ticket");
    if (!doc) return;
    const url = doc.output("bloburl") as unknown as string;
    const w = window.open(url, "_blank");
    if (w) w.addEventListener("load", () => { try { w.print(); } catch {} });
    else toast.error("Autorisez les pop-ups pour imprimer");
  };
  const downloadQr = async () => {
    if (!booking) return;
    const url = await QRCode.toDataURL(booking.qr_code, { width: 512, margin: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${booking.qr_code}.png`;
    a.click();
  };

  const events: EventItem[] = booking ? (() => {
    const list: EventItem[] = [];
    list.push({
      key: "created",
      when: booking.created_at,
      title: booking.sale_channel === "online" ? "Réservation créée en ligne" : "Vente au guichet",
      desc: `Siège #${booking.seat_number} · ${booking.total_amount.toLocaleString("fr-FR")} FCFA`,
      tone: "primary",
      icon: Ticket,
    });
    if (booking.payment_status === "pending" && booking.payment_deadline) {
      list.push({
        key: "deadline",
        when: booking.payment_deadline,
        title: "Échéance de paiement",
        desc: "Au-delà, la réservation sera libérée",
        tone: "warning",
        icon: Clock,
      });
    }
    if (booking.payment_status === "paid") {
      list.push({
        key: "paid",
        when: booking.updated_at,
        title: "Paiement confirmé",
        desc: booking.payment_method,
        tone: "success",
        icon: CreditCard,
      });
    }
    if (booking.boarding_status === "boarded" && booking.boarded_at) {
      list.push({
        key: "boarded",
        when: booking.boarded_at,
        title: "Embarqué",
        desc: "Billet scanné à l'embarquement",
        tone: "success",
        icon: CheckCircle2,
      });
    }
    if (booking.boarding_status === "refused" && booking.boarded_at) {
      list.push({
        key: "refused",
        when: booking.boarded_at,
        title: "Refusé à l'embarquement",
        desc: booking.boarding_notes || undefined,
        tone: "danger",
        icon: XCircle,
      });
    }
    if (booking.status === "cancelled") {
      list.push({
        key: "cancelled",
        when: booking.updated_at,
        title: "Réservation annulée",
        tone: "danger",
        icon: XCircle,
      });
    }
    return list.sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
  })() : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Réservation introuvable</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Retour</Button>
      </div>
    );
  }

  const st = statusMeta(booking);
  const StIcon = st.icon;
  const isPaid = booking.payment_status === "paid";

  return (
    <div className="min-h-screen pb-24">
      <div className="gradient-primary px-4 pt-10 pb-6">
        <button onClick={() => navigate(-1)} className="text-primary-foreground mb-4">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-bold text-primary-foreground">Détail de la réservation</h1>
        <p className="text-primary-foreground/70 text-xs mt-1 font-mono">{booking.qr_code}</p>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* Status */}
        <div className={`rounded-2xl border p-4 flex items-center gap-3 ${toneClass[st.tone]}`}>
          <StIcon className="h-6 w-6 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{st.label}</p>
            {countdown && (
              <p className="text-xs opacity-80 mt-0.5">
                {countdown.expired ? "Échéance dépassée" : `Payer dans ${countdown.label}`}
              </p>
            )}
          </div>
          <Badge variant="outline" className="capitalize">{booking.sale_channel === "online" ? "En ligne" : "Guichet"}</Badge>
        </div>

        {/* Trip card */}
        <div className="bg-card rounded-2xl p-4 border border-border/50 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-semibold">{booking.trips?.departure} → {booking.trips?.destination}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {booking.trips?.date ? new Date(booking.trips.date).toLocaleDateString("fr-FR") : ""} · {booking.trips?.departure_time?.slice(0,5)}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-border/50">
            <div><p className="text-muted-foreground">Passager</p><p className="font-medium flex items-center gap-1"><User className="h-3 w-3" />{booking.passenger_name}</p></div>
            <div><p className="text-muted-foreground">Téléphone</p><p className="font-medium">{booking.phone}</p></div>
            <div><p className="text-muted-foreground">Siège</p><p className="font-medium">#{booking.seat_number}</p></div>
            <div><p className="text-muted-foreground">Agence</p><p className="font-medium">{booking.trips?.agencies?.name || "—"}</p></div>
            {branch && (
              <div className="col-span-2"><p className="text-muted-foreground">Embarquement</p><p className="font-medium flex items-center gap-1"><Building2 className="h-3 w-3" />{branch.name}{branch.city ? ` (${branch.city})` : ""}</p></div>
            )}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground">Montant</span>
            <span className="font-display font-bold text-primary">{booking.total_amount.toLocaleString()} FCFA</span>
          </div>
        </div>

        {/* Payment action or QR */}
        {isPaid ? (
          <div className="bg-card rounded-2xl p-4 border border-border/50 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <QrIcon className="h-4 w-4 text-primary" /> Billet — QR code
            </div>
            <div className="flex justify-center bg-white p-4 rounded-xl">
              <QRCodeSVG value={booking.qr_code} size={180} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={downloadTicket}><Download className="h-3 w-3 mr-1" /> Billet PDF</Button>
              <Button variant="outline" size="sm" onClick={downloadReceipt}><Download className="h-3 w-3 mr-1" /> Reçu PDF</Button>
              <Button variant="outline" size="sm" onClick={downloadQr}><QrIcon className="h-3 w-3 mr-1" /> QR PNG</Button>
              <Button variant="outline" size="sm" onClick={printTicket}><Printer className="h-3 w-3 mr-1" /> Imprimer</Button>
            </div>
          </div>
        ) : booking.status !== "cancelled" ? (
          <div className="bg-card rounded-2xl p-4 border border-border/50 space-y-3">
            <p className="text-sm">Réglez cette réservation en ligne, ou présentez-vous à l'agence d'embarquement avant l'échéance.</p>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={() => setPayOpen(true)}>
              <CreditCard className="h-4 w-4 mr-2" /> Payer maintenant
            </Button>
          </div>
        ) : null}

        {/* Event log */}
        <div className="bg-card rounded-2xl p-4 border border-border/50">
          <p className="text-sm font-semibold mb-3">Journal d'événements</p>
          <ol className="relative border-l border-border/60 ml-2 space-y-4">
            {events.map((e) => {
              const Icon = e.icon;
              return (
                <li key={e.key} className="ml-4">
                  <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border ${toneClass[e.tone]}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <p className="text-sm font-medium">{e.title}</p>
                  {e.desc && <p className="text-xs text-muted-foreground">{e.desc}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">{fmt(e.when)}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payer la réservation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Montant : <span className="font-bold text-primary">{booking.total_amount.toLocaleString()} FCFA</span></p>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Annuler</Button>
            <Button onClick={handlePay} disabled={submitting} className="gradient-primary text-primary-foreground">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer le paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingDetail;
