import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, QrCode, MapPin, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ListPagination, usePagination } from "@/components/ListPagination";

interface BookingRow {
  id: string;
  status: string;
  qr_code: string;
  seat_number: number;
  total_amount: number;
  booking_date: string;
  trips: {
    departure: string;
    destination: string;
    departure_time: string;
    date: string;
    agencies: { name: string } | null;
  } | null;
}

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
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const pg = usePagination(bookings, 5, [], { paramKey: "" });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, status, qr_code, seat_number, total_amount, booking_date, trips(departure, destination, departure_time, date, agencies(name))")
        .order("created_at", { ascending: false });
      setBookings((data as unknown as BookingRow[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="min-h-screen pb-24">
      <div className="gradient-primary px-4 pt-10 pb-6">
        <button onClick={() => navigate(-1)} className="text-primary-foreground mb-4">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-bold text-primary-foreground">Mes réservations</h1>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16">
            <QrCode className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Aucune réservation</p>
          </div>
        ) : (
          pg.paginated.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => navigate(`/bookings/${b.id}`)}
              className="bg-card rounded-2xl p-4 border border-border/50 cursor-pointer hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[b.status] || ""}`}>
                  {statusLabels[b.status] || b.status}
                </span>
                <span className="text-xs text-muted-foreground">{b.qr_code}</span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-3 w-3 text-primary" />
                <span className="text-sm font-medium">
                  {b.trips?.departure} → {b.trips?.destination}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {b.trips?.date ? new Date(b.trips.date).toLocaleDateString("fr-FR") : ""} · {b.trips?.departure_time}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  Siège {b.seat_number} · {b.trips?.agencies?.name || "Agence"}
                </span>
                <span className="font-display font-bold text-sm text-primary">
                  {b.total_amount.toLocaleString()} FCFA
                </span>
              </div>
            </motion.div>
          ))
        )}
        {!loading && bookings.length > 0 && <ListPagination {...pg} className="pt-2" />}
      </div>
    </div>
  );
};

export default BookingHistory;
