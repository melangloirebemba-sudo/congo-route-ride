import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { QrCode, Camera, CameraOff, CheckCircle2, XCircle, AlertTriangle, Search, Loader2, ShieldCheck, Building2, Download, Printer, Zap, WifiOff, Wifi, CloudUpload, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { useScanQueue } from "@/hooks/useScanQueue";
import { enqueueScan } from "@/lib/scanQueue";
import ScanHistory from "@/components/ScanHistory";

type FeedEntry = {
  id: string;
  code: string;
  passenger: string;
  seat: number | null;
  outcome: "boarded" | "queued" | "rejected";
  message: string;
  at: number;
};



type BookingResult = {
  id: string;
  qr_code: string;
  passenger_name: string;
  phone: string;
  seat_number: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total_amount: number;
  booking_date: string;
  boarding_status?: string | null;
  boarding_notes?: string | null;
  boarding_branch?: { name: string; city: string | null; district: string | null; address: string | null } | null;
  trip: {
    id: string;
    departure: string;
    destination: string;
    date: string;
    departure_time: string;
    arrival_time: string | null;
    bus_type: string | null;
    price: number;
    currency: string;
    agency: { id: string; name: string } | null;
  } | null;
};

type Verdict = "valid" | "used" | "unpaid" | "cancelled" | "expired" | "notfound" | "refused";

const verdictMeta: Record<Verdict, { label: string; tone: string; icon: any }> = {
  valid: { label: "Billet valide", tone: "bg-green-500/15 text-green-600 border-green-500/30", icon: CheckCircle2 },
  used: { label: "Déjà embarqué", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: AlertTriangle },
  refused: { label: "Refusé à l'embarquement", tone: "bg-red-500/15 text-red-600 border-red-500/30", icon: XCircle },
  unpaid: { label: "Non payé", tone: "bg-red-500/15 text-red-600 border-red-500/30", icon: XCircle },
  cancelled: { label: "Annulé", tone: "bg-red-500/15 text-red-600 border-red-500/30", icon: XCircle },
  expired: { label: "Voyage passé", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: AlertTriangle },
  notfound: { label: "Billet introuvable", tone: "bg-red-500/15 text-red-600 border-red-500/30", icon: XCircle },
};

const boardingBadgeTone = (s?: string | null) =>
  s === "boarded"
    ? "bg-green-500/15 text-green-700 border-green-500/30"
    : s === "refused"
    ? "bg-red-500/15 text-red-700 border-red-500/30"
    : "bg-amber-500/15 text-amber-700 border-amber-500/30";

const boardingLabel = (s?: string | null) =>
  s === "boarded" ? "Embarqué" : s === "refused" ? "Refusé" : "Non scanné";

export const formatBoardingLocation = (
  b?: { name?: string | null; city?: string | null; district?: string | null; address?: string | null } | null
) => {
  if (!b) return null;
  const detail = [b.address, b.district, b.city].filter(Boolean).join(", ");
  return [b.name, detail].filter(Boolean).join(" — ") || null;
};


const ScanAdmin = () => {
  const { isAdmin, agencyId, manager } = useAuth();
  const scope: "admin" | "agency" = isAdmin ? "admin" : "agency";
  // Effective agency for scoping: agency owners use their agency, branch managers use their parent agency
  const effectiveAgencyId = agencyId || manager?.agency_id || null;
  const managerBranchId = manager?.branch_id || null;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [lastCode, setLastCode] = useState<string>("");

  // Offline queue + burst (continuous) boarding mode
  const { queue, online, syncing, sync } = useScanQueue();
  const [burst, setBurst] = useState(false);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const burstRef = useRef(false);
  useEffect(() => { burstRef.current = burst; }, [burst]);

  const pushFeed = (e: Omit<FeedEntry, "id" | "at">) =>
    setFeed((f) => [{ ...e, id: `${Date.now()}-${Math.random()}`, at: Date.now() }, ...f].slice(0, 50));

  const feedStats = useMemo(() => ({
    boarded: feed.filter((f) => f.outcome === "boarded").length,
    queued: feed.filter((f) => f.outcome === "queued").length,
    rejected: feed.filter((f) => f.outcome === "rejected").length,
  }), [feed]);

  /** Validate a ticket without any dialog (burst mode). Falls back to the offline queue. */
  const autoValidate = async (b: BookingResult) => {
    const base = { code: b.qr_code, passenger: b.passenger_name, seat: b.seat_number };
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueScan({
        bookingId: b.id,
        qrCode: b.qr_code,
        passengerName: b.passenger_name,
        seatNumber: b.seat_number,
        tripLabel: b.trip ? `${b.trip.departure} → ${b.trip.destination}` : null,
      });
      pushFeed({ ...base, outcome: "queued", message: "Hors ligne — en attente de synchronisation" });
      toast.info("Hors ligne : embarquement mis en file d'attente");
      return;
    }
    const { data, error } = await supabase.rpc("check_in_booking", { _booking_id: b.id });
    if (error) {
      enqueueScan({
        bookingId: b.id,
        qrCode: b.qr_code,
        passengerName: b.passenger_name,
        seatNumber: b.seat_number,
        tripLabel: b.trip ? `${b.trip.departure} → ${b.trip.destination}` : null,
      });
      pushFeed({ ...base, outcome: "queued", message: "Réseau instable — mis en file d'attente" });
      return;
    }
    const res = (data ?? {}) as { ok?: boolean; message?: string };
    if (res.ok) {
      pushFeed({ ...base, outcome: "boarded", message: res.message || "Embarquement validé" });
      setVerdict("used");
      setBooking({ ...b, status: "used", boarding_status: "boarded" });
      toast.success(`${b.passenger_name} — embarqué`);
    } else {
      pushFeed({ ...base, outcome: "rejected", message: res.message || "Validation refusée" });
      toast.error(res.message || "Validation refusée");
    }
  };


  // Filters propagated from the Boarding dashboard so scanning stays in-context.
  const [searchParams] = useSearchParams();
  const filterDateFrom = searchParams.get("date_from") || "";
  const filterDateTo = searchParams.get("date_to") || "";
  const filterTripId = searchParams.get("trip_id") || "";
  const filterStatus = searchParams.get("status") || "";
  const hasFilters = !!(filterDateFrom || filterDateTo || filterTripId || filterStatus);
  const [filterTrip, setFilterTrip] = useState<{ departure: string; destination: string; date: string; departure_time: string } | null>(null);

  useEffect(() => {
    if (!filterTripId) { setFilterTrip(null); return; }
    (async () => {
      const { data } = await supabase
        .from("trips")
        .select("departure, destination, date, departure_time")
        .eq("id", filterTripId)
        .maybeSingle();
      setFilterTrip((data as any) || null);
    })();
  }, [filterTripId]);

  const filterMismatch = useMemo(() => {
    if (!booking || !hasFilters) return null;
    const issues: string[] = [];
    if (filterTripId && booking.trip?.id !== filterTripId) issues.push("trajet différent de celui filtré");
    const d = booking.trip?.date;
    if (filterDateFrom && d && d < filterDateFrom) issues.push(`date avant ${filterDateFrom}`);
    if (filterDateTo && d && d > filterDateTo) issues.push(`date après ${filterDateTo}`);
    if (filterStatus) {
      const bs = booking.boarding_status || "pending";
      if (bs !== filterStatus) issues.push(`statut « ${bs} » ≠ « ${filterStatus} »`);
    }
    return issues.length ? issues : null;
  }, [booking, hasFilters, filterTripId, filterDateFrom, filterDateTo, filterStatus]);

  const verify = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || trimmed === lastCode) return;
    setLastCode(trimmed);
    if (burstRef.current) {
      // allow the same ticket to be re-scanned after a short cooldown
      setTimeout(() => setLastCode(""), 2500);
    }

    // Fully offline: we cannot read the booking — queue the code, resolved at sync time.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueScan({ bookingId: "", qrCode: trimmed });
      pushFeed({ code: trimmed, passenger: "—", seat: null, outcome: "queued", message: "Hors ligne — en attente de synchronisation" });
      toast.info("Hors ligne : billet mis en file d'attente");
      return;
    }

    setLoading(true);
    setBooking(null);
    setVerdict(null);
    setRpcError(null);


    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id, qr_code, passenger_name, phone, seat_number, status, payment_status,
        payment_method, total_amount, booking_date, boarding_status, boarding_notes,
        boarding_branch_id,
        boarding_branch:agency_branches ( name, city, district, address ),
        trip:trips ( id, departure, destination, date, departure_time, arrival_time, bus_type, price, currency, branch_id, agency:agencies ( id, name ) )
      `)
      .eq("qr_code", trimmed)
      .maybeSingle();


    setLoading(false);
    if (error) {
      toast.error("Erreur lors de la vérification");
      return;
    }
    if (!data) {
      setVerdict("notfound");
      toast.error("Billet introuvable");
      return;
    }

    const b = data as unknown as BookingResult & { boarding_branch_id?: string | null; trip: any };

    // Agency scope: ticket must belong to this agency (owner) OR to this manager's branch
    // (either through the trip's branch or the passenger's chosen boarding branch).
    if (scope === "agency") {
      const sameAgency = b.trip?.agency?.id && b.trip.agency.id === effectiveAgencyId;
      const branchMatches = managerBranchId
        ? (b.boarding_branch_id === managerBranchId || b.trip?.branch_id === managerBranchId)
        : true; // agency owner: no branch restriction
      if (!sameAgency || !branchMatches) {
        setVerdict("notfound");
        toast.error(
          managerBranchId
            ? "Ce billet n'est pas embarquable dans votre sous-agence"
            : "Ce billet n'appartient pas à votre agence"
        );
        return;
      }
    }

    setBooking(b);

    let v: Verdict = "valid";
    if (b.status === "cancelled") v = "cancelled";
    else if (b.boarding_status === "refused") v = "refused";
    else if (b.status === "used" || b.status === "checked_in" || b.boarding_status === "boarded") v = "used";
    else if (b.payment_status !== "paid") v = "unpaid";
    else if (b.trip?.date && new Date(b.trip.date) < new Date(new Date().toDateString())) v = "expired";

    setVerdict(v);
    if (v === "valid") toast.success("Billet valide");
    else toast.warning(verdictMeta[v].label);
  };



  const startScanner = async () => {
    try {
      const el = document.getElementById("qr-reader");
      if (!el) return;
      const html5Qr = new Html5Qrcode("qr-reader");
      scannerRef.current = html5Qr;
      await html5Qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          verify(decoded);
        },
        () => {}
      );
      setScanning(true);
    } catch (e: any) {
      toast.error("Impossible d'accéder à la caméra");
      console.error(e);
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch {}
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [validating, setValidating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rpcError, setRpcError] = useState<{ code: string; title: string; message: string; hint: string } | null>(null);

  const rpcErrorMeta: Record<string, { title: string; message: string; hint: string }> = {
    unauthenticated: { title: "Session expirée", message: "Vous devez être connecté pour valider un billet.", hint: "Reconnectez-vous puis relancez le scan." },
    notfound: { title: "Réservation introuvable", message: "Aucune réservation ne correspond à ce billet en base.", hint: "Vérifiez le code QR ou saisissez-le manuellement." },
    forbidden: { title: "Accès refusé", message: "Ce billet n'appartient pas à votre agence.", hint: "Contactez un Super Admin si vous pensez qu'il s'agit d'une erreur." },
    used: { title: "Billet déjà utilisé", message: "Ce passager a déjà été embarqué par un autre agent.", hint: "Aucune action requise — refuser un nouvel embarquement." },
    cancelled: { title: "Réservation annulée", message: "Cette transaction a été annulée et le billet n'est plus valide.", hint: "Orientez le passager vers le guichet pour un nouveau billet." },
    unpaid: { title: "Paiement non confirmé", message: "Le paiement n'a pas encore été validé pour ce billet.", hint: "Demandez au passager de finaliser le paiement (MTN MoMo / Airtel Money) avant l'embarquement." },
    expired: { title: "Trajet expiré", message: "Le voyage associé à ce billet est déjà passé.", hint: "Ce billet ne peut plus être utilisé — proposez un nouveau trajet." },
    refused: { title: "Billet refusé", message: "Ce billet a été refusé à l'embarquement.", hint: "Consultez le motif du refus dans la fiche du billet." },
  };

  const [refuseOpen, setRefuseOpen] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");
  const [refusing, setRefusing] = useState(false);

  const refuseBoarding = async () => {
    if (!booking) return;
    setRefusing(true);
    const { data, error } = await supabase.rpc("refuse_boarding" as any, {
      _booking_id: booking.id,
      _reason: refuseReason.trim() || null,
    });
    setRefusing(false);
    if (error) {
      toast.error(error.message || "Échec du refus");
      return;
    }
    const res = (data ?? {}) as { ok?: boolean; message?: string };
    if (res.ok) {
      toast.success(res.message || "Billet refusé à l'embarquement");
      setBooking({ ...booking, boarding_status: "refused", boarding_notes: refuseReason.trim() || null });
      setVerdict("refused");
      setRefuseOpen(false);
      setRefuseReason("");
    } else {
      toast.error(res.message || "Refus impossible");
    }
  };


  const markAsUsed = async () => {
    if (!booking) return;
    setRpcError(null);
    if (verdict !== "valid") {
      toast.error("Ce billet ne peut pas être validé");
      return;
    }
    setValidating(true);

    // Atomic server-side validation: locks the booking row, re-checks status,
    // payment and permissions, and flips to "used" in a single transaction.
    const { data, error } = await supabase.rpc("check_in_booking", {
      _booking_id: booking.id,
    });

    setValidating(false);

    if (error) {
      setRpcError({
        code: "rpc_error",
        title: "Erreur technique",
        message: error.message || "L'appel de validation a échoué.",
        hint: "Vérifiez votre connexion réseau puis réessayez. Si le problème persiste, contactez le support.",
      });
      toast.error("Impossible de valider l'embarquement");
      return;
    }

    const res = (data ?? {}) as {
      ok?: boolean;
      code?: string;
      message?: string;
      status?: string;
      payment_status?: string;
    };

    if (res.ok) {
      toast.success(res.message || "Embarquement validé");
      setBooking({ ...booking, status: res.status || "used" });
      setVerdict("used");
      setRpcError(null);
      return;
    }

    // Failure: sync UI to the authoritative server state
    const nextBooking = {
      ...booking,
      status: res.status ?? booking.status,
      payment_status: res.payment_status ?? booking.payment_status,
    };
    setBooking(nextBooking);

    const code = res.code || "unknown";
    const meta = rpcErrorMeta[code] ?? {
      title: "Validation refusée",
      message: res.message || "La validation a été refusée par le serveur.",
      hint: "Rescannez le billet ou contactez un Super Admin.",
    };
    setRpcError({ code, ...meta });

    const verdictByCode: Record<string, Verdict> = {
      used: "used",
      cancelled: "cancelled",
      unpaid: "unpaid",
      expired: "expired",
      notfound: "notfound",
      refused: "refused",

    };
    if (verdictByCode[code]) setVerdict(verdictByCode[code]);
    toast.error(meta.title);
  };



  const resetCheck = () => {
    setBooking(null);
    setVerdict(null);
    setLastCode("");
    setManualCode("");
    setRpcError(null);
  };

  const buildTicketPdf = async (): Promise<jsPDF | null> => {
    if (!booking) return null;
    const doc = new jsPDF({ format: "a5", unit: "mm" });
    doc.setFillColor(255, 122, 0);
    doc.rect(0, 0, 148, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("TransCongo — Billet électronique", 10, 13);
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
    if (booking.trip) {
      line("Trajet", `${booking.trip.departure} → ${booking.trip.destination}`);
      line("Date / Heure", `${booking.trip.date} ${booking.trip.departure_time?.slice(0,5) || ""}`);
      if (booking.trip.agency?.name) line("Agence", booking.trip.agency.name);
    }
    const loc = formatBoardingLocation(booking.boarding_branch);
    if (loc) line("Lieu d'embarquement", loc);
    line("Siège", `#${booking.seat_number}`);
    line("Paiement", `${booking.payment_status}${booking.payment_method ? ` · ${booking.payment_method}` : ""}`);
    line("Montant", `${booking.total_amount.toLocaleString("fr-FR")} FCFA`);
    line("Statut", booking.status);
    line("Code", booking.qr_code);
    const qrDataUrl = await QRCode.toDataURL(booking.qr_code, { width: 240, margin: 1 });
    doc.addImage(qrDataUrl, "PNG", 95, 55, 45, 45);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Réimpression — présentez ce billet à l'embarquement", 10, 200);
    return doc;
  };

  const downloadTicket = async () => {
    const doc = await buildTicketPdf();
    if (!doc || !booking) return;
    doc.save(`${booking.qr_code}.pdf`);
  };

  const printTicket = async () => {
    const doc = await buildTicketPdf();
    if (!doc) return;
    const url = doc.output("bloburl") as unknown as string;
    const w = window.open(url, "_blank");
    if (w) {
      w.addEventListener("load", () => { try { w.print(); } catch {} });
    } else {
      toast.error("Autorisez les pop-ups pour imprimer");
    }
  };

  const VerdictIcon = verdict ? verdictMeta[verdict].icon : QrCode;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Scan de billets</h1>
          <p className="text-muted-foreground text-sm">
            {scope === "admin"
              ? "Super Admin — vérification de tous les billets de la plateforme"
              : "Agence — vérification des billets de vos propres trajets"}
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          {scope === "admin" ? <ShieldCheck className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
          {scope === "admin" ? "Super Admin" : "Agence"}
        </Badge>
      </div>

      {hasFilters && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex items-start gap-2 flex-wrap">
          <Search className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-primary">Filtres actifs depuis l'embarquement</div>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {filterTrip && <span>Trajet : {filterTrip.departure} → {filterTrip.destination} · {filterTrip.date} {filterTrip.departure_time?.slice(0,5)}</span>}
              {filterDateFrom && <span>Du : {filterDateFrom}</span>}
              {filterDateTo && <span>Au : {filterDateTo}</span>}
              {filterStatus && <span>Statut : {filterStatus}</span>}
            </div>
          </div>
        </div>
      )}




      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4" /> Scanner caméra
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              id="qr-reader"
              className="w-full aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center"
            >
              {!scanning && <QrCode className="h-16 w-16 text-muted-foreground/50" />}
            </div>
            <div className="flex gap-2">
              {!scanning ? (
                <Button onClick={startScanner} className="flex-1">
                  <Camera className="h-4 w-4 mr-2" /> Démarrer
                </Button>
              ) : (
                <Button onClick={stopScanner} variant="secondary" className="flex-1">
                  <CameraOff className="h-4 w-4 mr-2" /> Arrêter
                </Button>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <label className="text-sm font-medium">Saisie manuelle</label>
              <div className="flex gap-2">
                <Input
                  placeholder="TC-XXXXX"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && verify(manualCode)}
                />
                <Button onClick={() => verify(manualCode)} disabled={loading || !manualCode.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <VerdictIcon className="h-4 w-4" /> Résultat
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!verdict && !loading && (
              <p className="text-sm text-muted-foreground">Aucun billet vérifié pour le moment.</p>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Vérification en cours…
              </div>
            )}
            {verdict && (
              <div className="space-y-4">
                <div className={`rounded-lg border p-4 flex items-center gap-3 ${verdictMeta[verdict].tone}`}>
                  <VerdictIcon className="h-6 w-6" />
                  <div>
                    <div className="font-semibold">{verdictMeta[verdict].label}</div>
                    {booking && <div className="text-xs opacity-80">Code : {booking.qr_code}</div>}
                  </div>
                </div>

                {booking && (
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 break-words">
                      <Info label="Passager" value={booking.passenger_name} />
                      <Info label="Téléphone" value={booking.phone} />
                      <Info label="Siège" value={`#${booking.seat_number}`} />
                      <Info
                        label="Montant"
                        value={`${booking.total_amount.toLocaleString("fr-FR")} FCFA`}
                      />
                      <Info
                        label="Statut"
                        value={<Badge variant="outline">{booking.status}</Badge>}
                      />
                      <Info
                        label="Paiement"
                        value={
                          <Badge
                            variant="outline"
                            className={booking.payment_status === "paid" ? "text-green-600" : "text-red-600"}
                          >
                            {booking.payment_status}
                            {booking.payment_method ? ` · ${booking.payment_method}` : ""}
                          </Badge>
                        }
                      />
                    </div>

                    {booking.trip && (
                      <>
                        <Separator />
                        <div className="space-y-0.5">
                          <div className="font-medium mb-1">Trajet</div>
                          <div className="text-muted-foreground">
                            {booking.trip.departure} → {booking.trip.destination}
                          </div>
                          <div className="text-muted-foreground">
                            {format(new Date(booking.trip.date), "EEEE d MMM yyyy", { locale: fr })}
                            {" · "}
                            {booking.trip.departure_time?.slice(0, 5)}
                            {booking.trip.arrival_time ? ` → ${booking.trip.arrival_time.slice(0,5)}` : ""}
                          </div>
                          {booking.trip.bus_type && (
                            <div className="text-muted-foreground">Bus : {booking.trip.bus_type}</div>
                          )}
                          <div className="text-muted-foreground">
                            Prix : {booking.trip.price.toLocaleString("fr-FR")} {booking.trip.currency}
                          </div>
                          {booking.trip.agency?.name && (
                            <div className="text-muted-foreground">Agence : {booking.trip.agency.name}</div>
                          )}
                        </div>
                      </>
                    )}

                    {formatBoardingLocation(booking.boarding_branch) && (
                      <>
                        <Separator />
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                          <div className="text-xs font-semibold uppercase text-primary">Lieu d'embarquement</div>
                          <div className="text-sm break-words">{formatBoardingLocation(booking.boarding_branch)}</div>
                        </div>
                      </>
                    )}


                    <Separator />
                    {filterMismatch && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 text-xs p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold">Ce billet est hors des filtres actifs</div>
                          <div className="opacity-90">{filterMismatch.join(" · ")}</div>
                        </div>
                      </div>
                    )}
                    {verdict !== "valid" && (
                      <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-700 text-xs p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold">Embarquement impossible</div>
                          <div className="opacity-90">
                            {verdict === "used" && "Ce billet a déjà été utilisé. Le passager est déjà embarqué."}
                            {verdict === "cancelled" && "Cette réservation a été annulée."}
                            {verdict === "unpaid" && "Le paiement n'a pas été confirmé pour ce billet."}
                            {verdict === "expired" && "Le trajet associé à ce billet est déjà passé."}
                            {verdict === "notfound" && "Aucun billet ne correspond à ce code."}
                          </div>
                        </div>
                      </div>
                    )}
                    {rpcError && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <div className="font-semibold">{rpcError.title}</div>
                            <div className="opacity-90">{rpcError.message}</div>
                            <div className="opacity-80"><span className="font-medium">Que faire :</span> {rpcError.hint}</div>
                            <div className="opacity-60">Code : {rpcError.code}</div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" onClick={() => { if (booking) { setLastCode(""); verify(booking.qr_code); } }}>
                            Revérifier
                          </Button>
                          <Button size="sm" variant="outline" onClick={resetCheck}>
                            Nouveau scan
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="rounded-md border p-3 flex items-center justify-between text-xs">
                      <span className="font-medium">Statut d'embarquement</span>
                      <Badge variant="outline" className={boardingBadgeTone(booking.boarding_status)}>
                        {boardingLabel(booking.boarding_status)}
                      </Badge>
                    </div>
                    {booking.boarding_status === "refused" && booking.boarding_notes && (
                      <div className="text-xs text-muted-foreground italic">
                        Motif du refus : {booking.boarding_notes}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">

                      {verdict === "valid" ? (
                        <>
                          <Button onClick={() => setConfirmOpen(true)} disabled={validating} className="flex-1">
                            {validating ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validation…</>
                            ) : (
                              <><CheckCircle2 className="h-4 w-4 mr-2" /> Valider</>
                            )}
                          </Button>
                          <Button variant="destructive" onClick={() => setRefuseOpen(true)} className="flex-1">
                            <XCircle className="h-4 w-4 mr-2" /> Refuser
                          </Button>
                        </>
                      ) : (
                        <Button disabled className="flex-1" variant="secondary">
                          <XCircle className="h-4 w-4 mr-2" /> Validation bloquée
                        </Button>
                      )}
                      <Button variant="outline" onClick={resetCheck} className="flex-1">
                        Nouveau scan
                      </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">

                      <Button variant="secondary" onClick={downloadTicket} className="flex-1">
                        <Download className="h-4 w-4 mr-2" /> Télécharger PDF
                      </Button>
                      <Button variant="secondary" onClick={printTicket} className="flex-1">
                        <Printer className="h-4 w-4 mr-2" /> Réimprimer
                      </Button>
                    </div>

                    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmer l'embarquement</AlertDialogTitle>
                          <AlertDialogDescription>
                            Vérifiez les informations ci-dessous avant de valider. Un contrôle final sera effectué en base pour éviter tout double embarquement.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-3 text-sm">
                          <div className="rounded-lg border p-3 space-y-1">
                            <div className="text-xs font-semibold text-muted-foreground uppercase">Trajet</div>
                            <div className="font-medium">{booking.trip?.departure} → {booking.trip?.destination}</div>
                            <div className="text-muted-foreground">
                              {booking.trip?.date} · {booking.trip?.departure_time}
                            </div>
                            <div className="text-muted-foreground">{booking.trip?.agency?.name}</div>
                          </div>
                          <div className="rounded-lg border p-3 space-y-1">
                            <div className="text-xs font-semibold text-muted-foreground uppercase">Passager</div>
                            <div className="font-medium">{booking.passenger_name}</div>
                            <div className="text-muted-foreground">{booking.phone}</div>
                            <div className="text-muted-foreground">Siège {booking.seat_number} · Billet {booking.qr_code}</div>
                          </div>
                          <div className="rounded-lg border p-3 flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase">Statut actuel</span>
                            <div className="flex gap-2">
                              <Badge variant="outline">{booking.status}</Badge>
                              <Badge variant={booking.payment_status === "paid" ? "default" : "destructive"}>
                                {booking.payment_status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={validating}>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={validating}
                            onClick={async (e) => {
                              e.preventDefault();
                              await markAsUsed();
                              setConfirmOpen(false);
                            }}
                          >
                            {validating ? "Validation…" : "Confirmer l'embarquement"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog open={refuseOpen} onOpenChange={setRefuseOpen}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Refuser l'embarquement</AlertDialogTitle>
                          <AlertDialogDescription>
                            Ce billet sera marqué comme <strong>refusé</strong>. Indiquez le motif du refus (facultatif mais recommandé).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-2">
                          <Input
                            placeholder="Motif du refus (ex : pièce d'identité manquante)"
                            value={refuseReason}
                            onChange={(e) => setRefuseReason(e.target.value)}
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={refusing}>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={refusing}
                            onClick={async (e) => { e.preventDefault(); await refuseBoarding(); }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {refusing ? "Refus…" : "Confirmer le refus"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>



                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="font-medium">{value}</div>
  </div>
);

export default ScanAdmin;
