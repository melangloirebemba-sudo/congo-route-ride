import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, MapPin, Calendar, CreditCard, Download, Printer,
  QrCode as QrIcon, Clock, CheckCircle2, XCircle, Ticket, User, Building2,
  AlertTriangle, Share2, Ban, RefreshCw, Wifi, Mail, MessageSquare, Copy, Link2, CalendarPlus,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { googleCalendarUrl, outlookCalendarUrl, yahooCalendarUrl, downloadIcs, type CalendarEvent } from "@/lib/calendar";

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
  trip_id: string;
  trips: {
    departure: string;
    destination: string;
    date: string;
    departure_time: string;
    agencies: { name: string; logo: string | null } | null;
  } | null;
}

/** Load an image URL / data-URI into a data URL usable by jsPDF. */
const toDataUrl = async (src: string): Promise<{ data: string; format: string } | null> => {
  try {
    if (src.startsWith("data:image")) {
      return { data: src, format: src.includes("png") ? "PNG" : "JPEG" };
    }
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return { data, format: blob.type.includes("png") ? "PNG" : "JPEG" };
  } catch {
    return null;
  }
};

interface EventItem {
  key: string;
  when: string;
  title: string;
  desc?: string;
  tone: "primary" | "success" | "warning" | "danger" | "muted";
  icon: any;
}

const paymentLabels: Record<string, string> = {
  mtn: "MTN MoMo",
  airtel: "Airtel Money",
  card: "Carte bancaire",
};
const methodIdFromLabel = (label: string): string => {
  const found = Object.entries(paymentLabels).find(([, v]) => v === label);
  return found?.[0] ?? "mtn";
};

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

/** Refund policy based on hours until departure. */
const refundPolicy = (tripDate?: string, tripTime?: string, amount = 0) => {
  if (!tripDate) return { hours: null as number | null, pct: 0, refund: 0, label: "Aucun remboursement" };
  const dt = new Date(`${tripDate}T${(tripTime || "00:00").slice(0, 8)}`);
  const hours = (dt.getTime() - Date.now()) / 3600000;
  let pct = 0;
  if (hours >= 48) pct = 100;
  else if (hours >= 24) pct = 50;
  else if (hours >= 6) pct = 25;
  else pct = 0;
  const refund = Math.round((amount * pct) / 100);
  const label =
    pct === 100 ? "Remboursement intégral (>48h avant départ)"
    : pct === 50 ? "Remboursement partiel 50 % (24–48h avant départ)"
    : pct === 25 ? "Remboursement partiel 25 % (6–24h avant départ)"
    : hours < 0 ? "Trajet passé — aucun remboursement" : "Aucun remboursement (moins de 6h avant départ)";
  return { hours, pct, refund, label };
};

const BookingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [branch, setBranch] = useState<{ name: string; city: string | null; district?: string | null; address?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState("mtn");
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<{ code: string; message: string; method: string } | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const countdown = useCountdown(booking?.payment_status === "pending" ? booking.payment_deadline : null);

  const load = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("bookings")
      .select("id, qr_code, seat_number, total_amount, passenger_name, phone, status, payment_status, payment_method, payment_deadline, sale_channel, booking_date, created_at, updated_at, boarding_status, boarded_at, boarding_notes, boarding_branch_id, trip_id, trips(departure, destination, date, departure_time, agencies(name))")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) { setLoading(false); return; }
    setBooking(data as unknown as BookingRow);
    if ((data as any).boarding_branch_id) {
      const { data: b } = await supabase
        .from("agency_branches" as any)
        .select("name, city, district, address")
        .eq("id", (data as any).boarding_branch_id)
        .maybeSingle();
      setBranch((b as any) || null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Realtime subscription — reflects payments and counter-side changes instantly.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`booking-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `id=eq.${id}` },
        (payload) => {
          const next = payload.new as any;
          if (!next) return;
          setBooking((prev) => (prev ? { ...prev, ...next } : prev));
          if (payload.eventType === "UPDATE") {
            toast("Réservation mise à jour", { description: "Statut synchronisé en temps réel." });
          }
        }
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const handlePay = async (retryMethod?: string) => {
    if (!booking) return;
    const useMethod = retryMethod ?? method;
    setSubmitting(true);
    setPaymentError(null);
    try {
      // Simulated provider check: user can cancel a card auth, etc.
      // Any DB error is treated as a payment failure with a detailed message.
      const { error } = await supabase
        .from("bookings")
        .update({ payment_status: "paid", payment_method: paymentLabels[useMethod] || useMethod })
        .eq("id", booking.id);
      if (error) throw new Error(error.message);

      const commission = Math.round(booking.total_amount * 0.1);
      await supabase.from("transactions").insert({
        agency_id: null,
        amount: booking.total_amount,
        commission,
        net_amount: booking.total_amount - commission,
        payment_method: paymentLabels[useMethod] || useMethod,
        status: "completed",
      } as any);
      toast.success("Paiement confirmé");
      setPayOpen(false);
      setMethod(useMethod);
      await load();
    } catch (err: any) {
      const msg: string = err?.message || "Erreur inconnue";
      let code = "unknown";
      let human = "Une erreur inattendue est survenue pendant la transaction.";
      if (/permission|denied|rls|forbidden/i.test(msg)) {
        code = "forbidden";
        human = "Vous n'êtes pas autorisé à régler cette réservation. Contactez l'agence.";
      } else if (/network|failed to fetch|timeout/i.test(msg)) {
        code = "network";
        human = "Connexion internet instable. Vérifiez votre réseau puis réessayez.";
      } else if (/insufficient|balance|solde/i.test(msg)) {
        code = "insufficient_funds";
        human = "Solde insuffisant sur le compte mobile money sélectionné.";
      } else if (/cancel|refus/i.test(msg)) {
        code = "declined";
        human = "Paiement refusé par le fournisseur. Réessayez ou changez de moyen.";
      }
      setPaymentError({ code, message: `${human} (${msg})`, method: useMethod });
      toast.error("Paiement échoué");
    } finally {
      setSubmitting(false);
    }
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
    if (branch) {
      const detail = [branch.address, branch.district, branch.city].filter(Boolean).join(", ");
      line("Embarquement", [branch.name, detail].filter(Boolean).join(" — "));
    }

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

  const downloadTicket = async () => { const d = await buildPdf("ticket"); if (d && booking) d.save(`billet-${booking.qr_code}.pdf`); };
  const downloadReceipt = async () => { const d = await buildPdf("receipt"); if (d && booking) d.save(`recu-${booking.qr_code}.pdf`); };
  const printTicket = async () => {
    const doc = await buildPdf("ticket"); if (!doc) return;
    const url = doc.output("bloburl") as unknown as string;
    const w = window.open(url, "_blank");
    if (w) w.addEventListener("load", () => { try { w.print(); } catch {} });
    else toast.error("Autorisez les pop-ups pour imprimer");
  };
  const downloadQr = async () => {
    if (!booking) return;
    const url = await QRCode.toDataURL(booking.qr_code, { width: 512, margin: 2 });
    const a = document.createElement("a");
    a.href = url; a.download = `qr-${booking.qr_code}.png`; a.click();
  };

  /** Build receipt PDF + QR PNG as File[] plus a shareable text message. */
  const buildShareAssets = async () => {
    if (!booking) return null;
    const [pdfDoc, qrUrl] = await Promise.all([
      buildPdf("receipt"),
      QRCode.toDataURL(booking.qr_code, { width: 512, margin: 2 }),
    ]);
    if (!pdfDoc) return null;
    const pdfBlob = pdfDoc.output("blob") as Blob;
    const qrBlob = await (await fetch(qrUrl)).blob();
    const files = [
      new File([pdfBlob], `recu-${booking.qr_code}.pdf`, { type: "application/pdf" }),
      new File([qrBlob], `qr-${booking.qr_code}.png`, { type: "image/png" }),
    ];
    const text = `Reçu TransCongo — ${booking.trips?.departure} → ${booking.trips?.destination} le ${booking.trips?.date} à ${booking.trips?.departure_time?.slice(0,5)}. Siège #${booking.seat_number}. Code: ${booking.qr_code}. Montant: ${booking.total_amount.toLocaleString("fr-FR")} FCFA.`;
    return { files, text, pdfDoc, qrUrl };
  };

  /** System share sheet (WhatsApp, Messages, Email, etc.). Falls back to a channel dialog. */
  const shareSystem = async () => {
    if (!booking) return;
    try {
      const assets = await buildShareAssets();
      if (!assets) return;
      const nav: any = navigator;
      if (nav.canShare?.({ files: assets.files }) && nav.share) {
        await nav.share({ files: assets.files, title: "Reçu TransCongo", text: assets.text });
        toast.success("Partage ouvert");
        return;
      }
      if (nav.share) {
        await nav.share({ title: "Reçu TransCongo", text: assets.text });
        toast.success("Partage ouvert");
        return;
      }
      setShareOpen(true);
    } catch (e: any) {
      if (e?.name !== "AbortError") setShareOpen(true);
    }
  };

  /** Send receipt PDF + QR PNG through WhatsApp. Uses native share when files are supported. */
  const shareOnWhatsApp = async () => {
    if (!booking) return;
    try {
      const assets = await buildShareAssets();
      if (!assets) return;
      const { files, text, pdfDoc, qrUrl } = assets;
      const nav: any = navigator;
      if (nav.canShare?.({ files }) && nav.share) {
        await nav.share({ files, title: "Reçu TransCongo", text });
        toast.success("Partage WhatsApp ouvert");
        return;
      }
      // Fallback: download files + open wa.me with the text prefilled
      pdfDoc.save(`recu-${booking.qr_code}.pdf`);
      const a = document.createElement("a");
      a.href = qrUrl; a.download = `qr-${booking.qr_code}.png`; a.click();
      const phone = (booking.phone || "").replace(/[^\d]/g, "");
      const wa = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank");
      toast("Reçu et QR téléchargés", { description: "WhatsApp Web ouvert — joignez les fichiers au message." });
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Impossible d'ouvrir WhatsApp");
    }
  };

  /** Fallback channel actions used inside the share dialog (desktop). */
  const shareViaEmail = async () => {
    const assets = await buildShareAssets();
    if (!assets || !booking) return;
    assets.pdfDoc.save(`recu-${booking.qr_code}.pdf`);
    const a = document.createElement("a");
    a.href = assets.qrUrl; a.download = `qr-${booking.qr_code}.png`; a.click();
    const subject = `Reçu TransCongo — ${booking.qr_code}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(assets.text)}`;
    toast("Reçu et QR téléchargés", { description: "Client email ouvert — joignez les fichiers." });
    setShareOpen(false);
  };
  const shareViaSms = async () => {
    if (!booking) return;
    const assets = await buildShareAssets();
    if (!assets) return;
    const phone = (booking.phone || "").replace(/[^\d]/g, "");
    window.location.href = `sms:${phone}?body=${encodeURIComponent(assets.text)}`;
    setShareOpen(false);
  };
  const copyShareText = async () => {
    const assets = await buildShareAssets();
    if (!assets) return;
    await navigator.clipboard.writeText(assets.text);
    toast.success("Texte du reçu copié");
  };
  const copyBookingLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Lien copié");
  };

  const refund = useMemo(() => refundPolicy(booking?.trips?.date, booking?.trips?.departure_time, booking?.total_amount ?? 0), [booking]);

  /** Calendar event derived from the booking — used by the "Ajouter au calendrier" menu. */
  const calEvent: CalendarEvent | null = useMemo(() => {
    if (!booking?.trips?.date || !booking?.trips?.departure_time) return null;
    const locParts = [
      branch?.name,
      branch?.city,
      !branch ? booking.trips.departure : null,
    ].filter(Boolean);
    return {
      title: `TransCongo · ${booking.trips.departure} → ${booking.trips.destination}`,
      description: [
        `Passager : ${booking.passenger_name}`,
        `Siège : #${booking.seat_number}`,
        `Code : ${booking.qr_code}`,
        booking.trips.agencies?.name ? `Agence : ${booking.trips.agencies.name}` : "",
      ].filter(Boolean).join("\n"),
      location: locParts.join(", "),
      date: booking.trips.date,
      time: booking.trips.departure_time,
      durationMinutes: 240,
    };
  }, [booking, branch]);

  const handleCancel = async () => {
    if (!booking) return;
    setCancelling(true);
    const wasPaid = booking.payment_status === "paid";
    const { error } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        payment_status: wasPaid && refund.pct > 0 ? "refunded" : booking.payment_status,
      })
      .eq("id", booking.id);
    if (error) {
      toast.error("Impossible d'annuler : " + error.message);
      setCancelling(false);
      return;
    }
    if (wasPaid && refund.refund > 0) {
      await supabase.from("transactions").insert({
        agency_id: null,
        amount: -refund.refund,
        commission: 0,
        net_amount: -refund.refund,
        payment_method: booking.payment_method || "refund",
        status: "refunded",
      } as any);
    }
    toast.success("Réservation annulée" + (refund.refund > 0 ? ` — remboursement ${refund.refund.toLocaleString("fr-FR")} FCFA` : ""));
    setCancelOpen(false);
    setCancelling(false);
    await load();
  };

  const events: EventItem[] = booking ? (() => {
    const list: EventItem[] = [];
    list.push({
      key: "created", when: booking.created_at,
      title: booking.sale_channel === "online" ? "Réservation créée en ligne" : "Vente au guichet",
      desc: `Siège #${booking.seat_number} · ${booking.total_amount.toLocaleString("fr-FR")} FCFA`,
      tone: "primary", icon: Ticket,
    });
    if (booking.payment_status === "pending" && booking.payment_deadline) {
      list.push({ key: "deadline", when: booking.payment_deadline, title: "Échéance de paiement", desc: "Au-delà, la réservation sera libérée", tone: "warning", icon: Clock });
    }
    if (booking.payment_status === "paid" || booking.payment_status === "refunded") {
      list.push({ key: "paid", when: booking.updated_at, title: "Paiement confirmé", desc: booking.payment_method, tone: "success", icon: CreditCard });
    }
    if (paymentError) {
      list.push({ key: "payment_failed", when: new Date().toISOString(), title: "Paiement échoué", desc: paymentError.message, tone: "danger", icon: XCircle });
    }
    if (booking.boarding_status === "boarded" && booking.boarded_at) {
      list.push({ key: "boarded", when: booking.boarded_at, title: "Embarqué", desc: "Billet scanné à l'embarquement", tone: "success", icon: CheckCircle2 });
    }
    if (booking.boarding_status === "refused" && booking.boarded_at) {
      list.push({ key: "refused", when: booking.boarded_at, title: "Refusé à l'embarquement", desc: booking.boarding_notes || undefined, tone: "danger", icon: XCircle });
    }
    if (booking.status === "cancelled") {
      list.push({ key: "cancelled", when: booking.updated_at, title: booking.payment_status === "refunded" ? "Annulée · remboursée" : "Réservation annulée", tone: "danger", icon: Ban });
    }
    return list.sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
  })() : [];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
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
  const isCancelled = booking.status === "cancelled";
  const canCancel = !isCancelled && booking.boarding_status !== "boarded";

  return (
    <div className="min-h-screen pb-24">
      <div className="gradient-primary px-4 pt-10 pb-6">
        <button onClick={() => navigate(-1)} className="text-primary-foreground mb-4"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-xl font-bold text-primary-foreground">Détail de la réservation</h1>
            <p className="text-primary-foreground/70 text-xs mt-1 font-mono">{booking.qr_code}</p>
          </div>
          {live && (
            <span className="flex items-center gap-1 text-[10px] font-medium bg-white/15 text-primary-foreground px-2 py-1 rounded-full">
              <Wifi className="h-3 w-3" /> Temps réel
            </span>
          )}
        </div>
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

        {/* Payment failure banner */}
        {paymentError && !isPaid && !isCancelled && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-destructive">Le paiement a échoué</p>
                <p className="text-xs text-muted-foreground mt-1">Moyen tenté : <span className="font-medium">{paymentLabels[paymentError.method] || paymentError.method}</span></p>
                <p className="text-xs text-muted-foreground mt-1">{paymentError.message}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Code : {paymentError.code}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => handlePay(paymentError.method)} disabled={submitting} className="gradient-primary text-primary-foreground">
                {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Réessayer avec {paymentLabels[paymentError.method] || paymentError.method}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setPaymentError(null); setPayOpen(true); }}>Changer de moyen</Button>
            </div>
          </div>
        )}

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
              <div className="col-span-2">
                <p className="text-muted-foreground">Lieu d'embarquement</p>
                <p className="font-medium flex items-start gap-1">
                  <Building2 className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="break-words">
                    {[branch.name, [branch.address, branch.district, branch.city].filter(Boolean).join(", ")]
                      .filter(Boolean)
                      .join(" — ")}
                  </span>
                </p>
              </div>
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
            <Button size="sm" onClick={shareSystem} className="w-full gradient-primary text-primary-foreground">
              <Share2 className="h-4 w-4 mr-2" /> Partager (WhatsApp, Messages, Email…)
            </Button>
            <Button size="sm" variant="outline" onClick={shareOnWhatsApp} className="w-full border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/10">
              <MessageSquare className="h-4 w-4 mr-2" /> Envoyer par WhatsApp
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="w-full">
                  <CalendarPlus className="h-4 w-4 mr-2" /> Ajouter au calendrier
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Choisir un calendrier</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => window.open(googleCalendarUrl(calEvent!), "_blank")}>
                  Google Agenda
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(outlookCalendarUrl(calEvent!), "_blank")}>
                  Outlook / Microsoft 365
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(yahooCalendarUrl(calEvent!), "_blank")}>
                  Yahoo Calendrier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => downloadIcs(calEvent!, `voyage-${booking.qr_code}.ics`)}>
                  Apple Calendrier (.ics)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : !isCancelled ? (
          <div className="bg-card rounded-2xl p-4 border border-border/50 space-y-3">
            <p className="text-sm">Réglez cette réservation en ligne, ou présentez-vous à l'agence d'embarquement avant l'échéance.</p>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={() => { setMethod(paymentError?.method || methodIdFromLabel(booking.payment_method || "")); setPayOpen(true); }}>
              <CreditCard className="h-4 w-4 mr-2" /> Payer maintenant
            </Button>
          </div>
        ) : null}

        {/* Cancel */}
        {canCancel && (
          <Button variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => setCancelOpen(true)}>
            <Ban className="h-4 w-4 mr-2" /> Annuler la réservation
          </Button>
        )}

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
                  {e.desc && <p className="text-xs text-muted-foreground break-words">{e.desc}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">{fmt(e.when)}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Pay dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payer la réservation</DialogTitle>
            <DialogDescription>Choisissez un moyen de paiement.</DialogDescription>
          </DialogHeader>
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
            <Button variant="outline" onClick={() => setPayOpen(false)}>Fermer</Button>
            <Button onClick={() => handlePay()} disabled={submitting} className="gradient-primary text-primary-foreground">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer le paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette réservation ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Cette action libère le siège et ne peut pas être défaite.</p>
                <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
                  <p className="font-medium text-foreground">Politique de remboursement</p>
                  <p className="text-xs">{refund.label}</p>
                  {booking.payment_status === "paid" ? (
                    <p className="text-xs">
                      Montant payé : <span className="font-medium">{booking.total_amount.toLocaleString("fr-FR")} FCFA</span> ·{" "}
                      Remboursement : <span className="font-bold text-primary">{refund.refund.toLocaleString("fr-FR")} FCFA</span> ({refund.pct}%)
                    </p>
                  ) : (
                    <p className="text-xs">Aucun paiement n'a été enregistré — rien à rembourser.</p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer l'annulation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share fallback (desktop / navigator.share unavailable) */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Partager le reçu</DialogTitle>
            <DialogDescription>Choisissez un canal — le reçu PDF et le QR seront téléchargés pour être joints.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={shareOnWhatsApp} className="justify-start">
              <MessageSquare className="h-4 w-4 mr-2 text-[#25D366]" /> WhatsApp
            </Button>
            <Button variant="outline" onClick={shareViaSms} className="justify-start">
              <MessageSquare className="h-4 w-4 mr-2" /> SMS
            </Button>
            <Button variant="outline" onClick={shareViaEmail} className="justify-start">
              <Mail className="h-4 w-4 mr-2" /> Email
            </Button>
            <Button variant="outline" onClick={copyShareText} className="justify-start">
              <Copy className="h-4 w-4 mr-2" /> Copier texte
            </Button>
            <Button variant="outline" onClick={copyBookingLink} className="col-span-2 justify-start">
              <Link2 className="h-4 w-4 mr-2" /> Copier le lien de la réservation
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShareOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingDetail;
