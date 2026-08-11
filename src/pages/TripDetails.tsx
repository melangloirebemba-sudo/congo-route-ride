import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Bus, Users, CreditCard, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import SeatSelector from "@/components/SeatSelector";

interface TripData {
  id: string;
  agency_id: string;
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
  const [occurrences, setOccurrences] = useState<{ id: string; date: string; available_seats: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setSelectedSeat(null);
      const [tripRes, seatsRes] = await Promise.all([
        supabase
          .from("trips")
          .select("id, agency_id, departure, destination, departure_time, arrival_time, date, price, available_seats, total_seats, bus_type, agencies(name)")
          .eq("id", id!)
          .maybeSingle(),
        supabase
          .from("bookings")
          .select("seat_number")
          .eq("trip_id", id!)
          .neq("status", "cancelled"),
      ]);
      const t = tripRes.data as unknown as TripData | null;
      setTrip(t);
      setBookedSeats(seatsRes.data?.map((b) => b.seat_number) || []);
      setLoading(false);

      // Autres dates du même trajet récurrent (même agence, trajet et heure).
      if (t) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: occ } = await supabase
          .from("trips")
          .select("id, date, available_seats")
          .eq("agency_id", t.agency_id)
          .eq("departure", t.departure)
          .eq("destination", t.destination)
          .eq("departure_time", t.departure_time)
          .eq("status", "active")
          .gte("date", today)
          .order("date")
          .limit(30);
        setOccurrences((occ as any[]) || []);
      } else {
        setOccurrences([]);
      }
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
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="bg-card border border-border/50 rounded-2xl p-8 max-w-md w-full text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <Clock className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-foreground">Trajet expiré</h1>
            <p className="text-muted-foreground leading-relaxed">
              Ce trajet est déjà passé et ne peut plus être réservé. Veuillez choisir un autre départ.
            </p>
          </div>
          <Button onClick={() => navigate("/search")} className="gradient-primary text-primary-foreground rounded-xl w-full h-12 font-display font-semibold shadow-lg hover:shadow-primary/20 transition-all">
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

        {occurrences.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl p-4 border border-border/50"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display font-semibold">Choisir la date de départ</h2>
              <div className="relative">
                <input
                  type="date"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    const found = occurrences.find(o => o.date === selectedDate);
                    if (found) {
                      navigate(`/trip/${found.id}`, { replace: true });
                    }
                  }}
                />
                <Button variant="outline" size="sm" className="h-8 text-xs gap-2 rounded-lg border-primary/20 hover:bg-primary/5">
                  <Calendar className="h-3 w-3 text-primary" />
                  Calendrier
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Ce trajet circule à plusieurs dates. Sélectionnez celle qui vous convient.
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {occurrences.map((o) => {
                const active = o.id === trip.id;
                const full = o.available_seats <= 0;
                return (
                  <button
                    key={o.id}
                    disabled={full}
                    onClick={() => navigate(`/trip/${o.id}`, { replace: true })}
                    className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                        : full
                          ? "bg-muted text-muted-foreground border-border opacity-60"
                          : "bg-background text-foreground border-border hover:bg-secondary hover:border-primary/30"
                    }`}
                  >
                    {new Date(o.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                    <span className="block text-[10px] opacity-80">
                      {full ? "Complet" : `${o.available_seats} places`}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}



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
