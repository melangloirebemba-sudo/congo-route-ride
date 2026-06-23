import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TripRow {
  id: string;
  departure: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  date: string;
  price: number;
  available_seats: number;
  bus_type: string | null;
  agencies: { name: string } | null;
}

const SearchResults = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const date = params.get("date") || "";
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let query = supabase
        .from("trips")
        .select("id, departure, destination, departure_time, arrival_time, date, price, available_seats, bus_type, agencies!inner(name, status)")
        .eq("status", "active")
        .eq("agencies.status", "active")
        .gt("available_seats", 0);

      if (from) query = query.eq("departure", from);
      if (to) query = query.eq("destination", to);
      if (date) query = query.eq("date", date);

      const { data } = await query.order("departure_time");
      setTrips((data as unknown as TripRow[]) || []);
      setLoading(false);
    };
    fetch();
  }, [from, to, date]);

  return (
    <div className="min-h-screen pb-24">
      <div className="gradient-primary px-4 pt-10 pb-6">
        <button onClick={() => navigate(-1)} className="text-primary-foreground mb-4">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-bold text-primary-foreground">
          {from || "Toutes"} → {to || "Toutes"}
        </h1>
        {date && (
          <p className="text-primary-foreground/70 text-sm mt-1">
            {new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        )}
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{trips.length} trajet(s) trouvé(s)</p>

            {trips.length === 0 && (
              <div className="text-center py-16">
                <p className="text-muted-foreground">Aucun trajet disponible pour cette recherche.</p>
              </div>
            )}

            {trips.map((trip, i) => (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => navigate(`/trip/${trip.id}`)}
                className="bg-card rounded-2xl p-4 border border-border/50 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium bg-secondary text-secondary-foreground px-2 py-1 rounded-full">
                    {trip.agencies?.name || "Agence"}
                  </span>
                  <span className="text-xs text-muted-foreground">{trip.bus_type}</span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="text-center">
                    <p className="font-display font-bold text-lg">{trip.departure_time}</p>
                    <p className="text-xs text-muted-foreground">{trip.departure}</p>
                  </div>
                  <div className="flex-1 flex items-center">
                    <div className="h-[2px] flex-1 bg-border" />
                    <Clock className="h-3 w-3 mx-2 text-muted-foreground" />
                    <div className="h-[2px] flex-1 bg-border" />
                  </div>
                  <div className="text-center">
                    <p className="font-display font-bold text-lg">{trip.arrival_time}</p>
                    <p className="text-xs text-muted-foreground">{trip.destination}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span className={trip.available_seats <= 5 ? "text-destructive font-medium" : ""}>
                      {trip.available_seats} places
                    </span>
                  </div>
                  <p className="font-display font-bold text-lg text-primary">
                    {trip.price.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">FCFA</span>
                  </p>
                </div>
              </motion.div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
