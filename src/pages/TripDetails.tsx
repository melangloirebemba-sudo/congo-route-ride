import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Bus, Users, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import SeatSelector from "@/components/SeatSelector";

interface TripData {
  id: string;
  departure: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  date: string;
  price: number;
  available_seats: number;
  total_seats: number;
  bus_type: string | null;
  agencies: { name: string } | null;
}

const TripDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [bookedSeats, setBookedSeats] = useState<number[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [tripRes, seatsRes] = await Promise.all([
        supabase
          .from("trips")
          .select("id, departure, destination, departure_time, arrival_time, date, price, available_seats, total_seats, bus_type, agencies(name)")
          .eq("id", id!)
          .maybeSingle(),
        supabase
          .from("bookings")
          .select("seat_number")
          .eq("trip_id", id!)
          .neq("status", "cancelled"),
      ]);
      setTrip(tripRes.data as unknown as TripData);
      setBookedSeats(seatsRes.data?.map((b) => b.seat_number) || []);
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Trajet introuvable</p>
      </div>
    );
  }

  const departDateTime = new Date(`${trip.date}T${trip.departure_time || "00:00"}`);
  const isPast = departDateTime.getTime() < Date.now();

  if (isPast) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-card border border-border/50 rounded-2xl p-6 max-w-md w-full text-center space-y-4">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="font-display text-xl font-bold">Trajet expiré</h1>
          <p className="text-sm text-muted-foreground">
            Ce trajet est déjà passé et ne peut plus être réservé.
          </p>
          <Button onClick={() => navigate("/search")} className="gradient-primary text-primary-foreground rounded-xl w-full h-11">
            Rechercher un autre trajet
          </Button>
        </div>
      </div>
    );
  }

  const agencyName = trip.agencies?.name || "Agence";

  return (
    <div className="min-h-screen pb-28">
      <div className="gradient-primary px-4 pt-10 pb-6">
        <button onClick={() => navigate(-1)} className="text-primary-foreground mb-4">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-bold text-primary-foreground">
          Détails du trajet
        </h1>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-5 border border-border/50"
        >
          <div className="flex items-center gap-1 mb-1">
            <span className="text-sm font-medium">{agencyName}</span>
          </div>

          <div className="flex items-start gap-4 my-4">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <div className="w-[2px] h-16 bg-border" />
              <div className="w-3 h-3 rounded-full bg-accent" />
            </div>
            <div className="flex-1 space-y-8">
              <div>
                <p className="font-display font-bold text-lg">{trip.departure_time}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {trip.departure}
                </p>
              </div>
              <div>
                <p className="font-display font-bold text-lg">{trip.arrival_time}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {trip.destination}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
            <div className="text-center">
              <Bus className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">{trip.bus_type}</p>
            </div>
            <div className="text-center">
              <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">{trip.available_seats} places</p>
            </div>
            <div className="text-center">
              <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">
                {new Date(trip.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl p-5 border border-border/50"
        >
          <h2 className="font-display font-semibold mb-3">Choisir un siège</h2>
          <SeatSelector
            totalSeats={trip.total_seats}
            bookedSeats={bookedSeats}
            selected={selectedSeat}
            onSelect={setSelectedSeat}
          />
        </motion.div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background/90 backdrop-blur-lg border-t border-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-display font-bold text-2xl text-primary">
              {trip.price.toLocaleString()} <span className="text-sm">FCFA</span>
            </p>
          </div>
          <Button
            onClick={() => navigate(`/booking/${trip.id}?seat=${selectedSeat}`)}
            disabled={!selectedSeat}
            className="gradient-primary text-primary-foreground px-8 py-3 rounded-xl font-display font-semibold h-12"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Réserver
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TripDetails;
