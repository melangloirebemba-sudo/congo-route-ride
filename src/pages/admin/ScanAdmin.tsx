import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { QrCode, Camera, CameraOff, CheckCircle2, XCircle, AlertTriangle, Search, Loader2, ShieldCheck, Building2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";


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
  trip: {
    id: string;
    origin: string;
    destination: string;
    departure_date: string;
    departure_time: string;
    agency: { id: string; name: string } | null;
  } | null;
};

type Verdict = "valid" | "used" | "unpaid" | "cancelled" | "expired" | "notfound";

const verdictMeta: Record<Verdict, { label: string; tone: string; icon: any }> = {
  valid: { label: "Billet valide", tone: "bg-green-500/15 text-green-600 border-green-500/30", icon: CheckCircle2 },
  used: { label: "Déjà utilisé", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: AlertTriangle },
  unpaid: { label: "Non payé", tone: "bg-red-500/15 text-red-600 border-red-500/30", icon: XCircle },
  cancelled: { label: "Annulé", tone: "bg-red-500/15 text-red-600 border-red-500/30", icon: XCircle },
  expired: { label: "Voyage passé", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: AlertTriangle },
  notfound: { label: "Billet introuvable", tone: "bg-red-500/15 text-red-600 border-red-500/30", icon: XCircle },
};

const ScanAdmin = () => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [lastCode, setLastCode] = useState<string>("");

  const verify = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || trimmed === lastCode) return;
    setLastCode(trimmed);
    setLoading(true);
    setBooking(null);
    setVerdict(null);

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id, qr_code, passenger_name, phone, seat_number, status, payment_status,
        payment_method, total_amount, booking_date,
        trip:trips ( id, origin, destination, departure_date, departure_time, agency:agencies ( name ) )
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

    const b = data as unknown as BookingResult;
    setBooking(b);

    let v: Verdict = "valid";
    if (b.status === "cancelled") v = "cancelled";
    else if (b.status === "used" || b.status === "checked_in") v = "used";
    else if (b.payment_status !== "paid") v = "unpaid";
    else if (b.trip?.departure_date && new Date(b.trip.departure_date) < new Date(new Date().toDateString())) v = "expired";

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

  const markAsUsed = async () => {
    if (!booking) return;
    const { error } = await supabase
      .from("bookings")
      .update({ status: "used" })
      .eq("id", booking.id);
    if (error) return toast.error("Impossible de marquer comme utilisé");
    toast.success("Billet marqué comme utilisé");
    setBooking({ ...booking, status: "used" });
    setVerdict("used");
  };

  const resetCheck = () => {
    setBooking(null);
    setVerdict(null);
    setLastCode("");
    setManualCode("");
  };

  const VerdictIcon = verdict ? verdictMeta[verdict].icon : QrCode;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Scan de billets</h1>
        <p className="text-muted-foreground text-sm">Vérifier la validité d'un QR code passager</p>
      </div>

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
                    <div className="grid grid-cols-2 gap-3">
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
                        <div>
                          <div className="font-medium mb-1">Trajet</div>
                          <div className="text-muted-foreground">
                            {booking.trip.origin} → {booking.trip.destination}
                          </div>
                          <div className="text-muted-foreground">
                            {format(new Date(booking.trip.departure_date), "EEEE d MMM yyyy", { locale: fr })}
                            {" · "}
                            {booking.trip.departure_time?.slice(0, 5)}
                          </div>
                          {booking.trip.agency?.name && (
                            <div className="text-muted-foreground">Agence : {booking.trip.agency.name}</div>
                          )}
                        </div>
                      </>
                    )}

                    <Separator />
                    <div className="flex gap-2">
                      {verdict === "valid" && (
                        <Button onClick={markAsUsed} className="flex-1">
                          <CheckCircle2 className="h-4 w-4 mr-2" /> Valider l'embarquement
                        </Button>
                      )}
                      <Button variant="outline" onClick={resetCheck} className="flex-1">
                        Nouveau scan
                      </Button>
                    </div>
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
