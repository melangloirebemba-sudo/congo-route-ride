import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Phone, Mail, Star, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ListPagination, usePagination } from "@/components/ListPagination";

type Agency = {
  id: string;
  name: string;
  logo: string | null;
  rating: number | null;
  total_trips: number | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  description?: string | null;
};

type Trip = {
  id: string;
  departure: string;
  destination: string;
  departure_time: string;
  price: number;
  available_seats: number | null;
};

const AgencyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const pg = usePagination(trips, 5, [], { paramKey: "" });

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [agencyRes, tripsRes] = await Promise.all([
        supabase.from("agencies").select("*").eq("id", id).eq("status", "active").maybeSingle(),
        supabase
          .from("trips")
          .select("id, departure, destination, departure_time, price, available_seats")
          .eq("agency_id", id)
          .eq("status", "active")
          .order("departure_time", { ascending: true })
          .limit(20),
      ]);
      setAgency(agencyRes.data as Agency | null);
      setTrips((tripsRes.data as Trip[]) || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <p className="text-center text-muted-foreground py-20">Chargement…</p>;
  }

  if (!agency) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">Agence introuvable.</p>
        <Button onClick={() => navigate("/agencies")}>Voir toutes les agences</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg font-bold truncate">{agency.name}</h1>
      </header>

      <section className="px-4 py-6 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-5 border border-border/50"
        >
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">{agency.logo || "🚌"}</span>
            <div className="flex-1">
              <h2 className="font-display font-bold text-xl">{agency.name}</h2>
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                <span className="font-semibold">{agency.rating || 0}</span>
                <span className="text-muted-foreground">· {agency.total_trips || 0} trajets</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {agency.address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {agency.address}
              </div>
            )}
            {agency.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {agency.phone}
              </div>
            )}
            {agency.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> {agency.email}
              </div>
            )}
          </div>
        </motion.div>

        <h3 className="font-display font-bold text-base mt-6 mb-3">Trajets disponibles</h3>
        {trips.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Aucun trajet disponible pour le moment.
          </p>
        ) : (
          <div className="space-y-3">
            {pg.paginated.map((trip) => (
              <button
                key={trip.id}
                onClick={() => navigate(`/trip/${trip.id}`)}
                className="w-full bg-card rounded-xl p-4 border border-border/50 hover:border-primary/50 transition text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display font-semibold text-sm">
                    {trip.departure} → {trip.destination}
                  </div>
                  <div className="text-primary font-bold text-sm">
                    {trip.price.toLocaleString()} FCFA
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(trip.departure_time).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>{trip.available_seats ?? 0} places</span>
                </div>
              </button>
            ))}
            <ListPagination {...pg} className="pt-2" />
          </div>
        )}
      </section>
    </div>
  );
};

export default AgencyDetail;
