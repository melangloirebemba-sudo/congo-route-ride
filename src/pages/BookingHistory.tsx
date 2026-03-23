import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, QrCode, MapPin, Calendar } from "lucide-react";
import { sampleBookings } from "@/data/mockData";

const statusColors: Record<string, string> = {
  confirmed: "bg-accent text-accent-foreground",
  completed: "bg-secondary text-secondary-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmé",
  completed: "Terminé",
  cancelled: "Annulé",
};

const BookingHistory = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24">
      <div className="gradient-primary px-4 pt-10 pb-6">
        <button onClick={() => navigate(-1)} className="text-primary-foreground mb-4">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-bold text-primary-foreground">Mes réservations</h1>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {sampleBookings.length === 0 ? (
          <div className="text-center py-16">
            <QrCode className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Aucune réservation</p>
          </div>
        ) : (
          sampleBookings.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card rounded-2xl p-4 border border-border/50"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[b.status]}`}>
                  {statusLabels[b.status]}
                </span>
                <span className="text-xs text-muted-foreground">{b.qrCode}</span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-3 w-3 text-primary" />
                <span className="text-sm font-medium">
                  {b.trip.departure} → {b.trip.destination}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{new Date(b.trip.date).toLocaleDateString("fr-FR")} · {b.trip.departureTime}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground">Siège {b.seatNumber} · {b.trip.agencyName}</span>
                <span className="font-display font-bold text-sm text-primary">
                  {b.totalAmount.toLocaleString()} FCFA
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default BookingHistory;
