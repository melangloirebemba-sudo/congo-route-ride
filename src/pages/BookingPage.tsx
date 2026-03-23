import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, User, CreditCard, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trips } from "@/data/mockData";
import { QRCodeSVG } from "qrcode.react";

const BookingPage = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const trip = trips.find((t) => t.id === id);
  const seat = params.get("seat");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mtn");
  const [step, setStep] = useState<"form" | "confirmed">("form");

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Trajet introuvable</p>
      </div>
    );
  }

  const bookingRef = `TC-${Date.now().toString(36).toUpperCase()}`;

  const handleConfirm = () => {
    if (!name || !phone) return;
    setStep("confirmed");
  };

  if (step === "confirmed") {
    return (
      <div className="min-h-screen pb-24">
        <div className="bg-accent px-4 pt-12 pb-8 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
            <CheckCircle2 className="h-16 w-16 mx-auto text-accent-foreground mb-3" />
          </motion.div>
          <h1 className="font-display text-2xl font-bold text-accent-foreground">Réservation confirmée !</h1>
          <p className="text-accent-foreground/80 text-sm mt-1">Votre billet a été généré</p>
        </div>

        <div className="px-4 py-6 max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl p-6 border border-border/50 text-center"
          >
            <div className="mb-4 inline-block p-4 bg-secondary rounded-xl">
              <QRCodeSVG value={bookingRef} size={160} />
            </div>
            <p className="font-display font-bold text-sm mb-4">{bookingRef}</p>

            <div className="text-left space-y-3 border-t border-border/50 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Passager</span>
                <span className="font-medium">{name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trajet</span>
                <span className="font-medium">{trip.departure} → {trip.destination}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{new Date(trip.date).toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Heure</span>
                <span className="font-medium">{trip.departureTime}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Siège</span>
                <span className="font-medium">N° {seat}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Agence</span>
                <span className="font-medium">{trip.agencyName}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border/50 pt-3">
                <span className="text-muted-foreground">Total payé</span>
                <span className="font-display font-bold text-primary">{trip.price.toLocaleString()} FCFA</span>
              </div>
            </div>

            <Button
              onClick={() => navigate("/")}
              className="w-full mt-6 gradient-primary text-primary-foreground rounded-xl font-display h-12"
            >
              Retour à l'accueil
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="gradient-primary px-4 pt-10 pb-6">
        <button onClick={() => navigate(-1)} className="text-primary-foreground mb-4">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-bold text-primary-foreground">Réserver</h1>
        <p className="text-primary-foreground/70 text-sm mt-1">
          {trip.departure} → {trip.destination} · Siège {seat}
        </p>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* Passenger info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-5 border border-border/50 space-y-3"
        >
          <h2 className="font-display font-semibold">Informations passager</h2>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom complet"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Téléphone (+242 ...)"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </motion.div>

        {/* Payment method */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl p-5 border border-border/50 space-y-3"
        >
          <h2 className="font-display font-semibold">Mode de paiement</h2>
          {[
            { id: "mtn", label: "MTN MoMo", emoji: "📱", color: "border-warning" },
            { id: "airtel", label: "Airtel Money", emoji: "📲", color: "border-destructive" },
            { id: "card", label: "Carte bancaire", emoji: "💳", color: "border-muted-foreground" },
          ].map((method) => (
            <button
              key={method.id}
              onClick={() => setPaymentMethod(method.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                paymentMethod === method.id
                  ? `${method.color} bg-secondary`
                  : "border-border bg-background"
              }`}
            >
              <span className="text-2xl">{method.emoji}</span>
              <span className="text-sm font-medium">{method.label}</span>
              {paymentMethod === method.id && (
                <CheckCircle2 className="ml-auto h-5 w-5 text-primary" />
              )}
            </button>
          ))}
        </motion.div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl p-5 border border-border/50"
        >
          <h2 className="font-display font-semibold mb-3">Résumé</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Billet</span>
              <span>{trip.price.toLocaleString()} FCFA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frais de service</span>
              <span>0 FCFA</span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-2 font-bold">
              <span>Total</span>
              <span className="text-primary">{trip.price.toLocaleString()} FCFA</span>
            </div>
          </div>
        </motion.div>

        <Button
          onClick={handleConfirm}
          disabled={!name || !phone}
          className="w-full gradient-primary text-primary-foreground py-3 rounded-xl font-display font-semibold h-12"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Confirmer et payer
        </Button>
      </div>
    </div>
  );
};

export default BookingPage;
