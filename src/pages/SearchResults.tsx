import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListPagination, usePagination } from "@/components/ListPagination";

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
  const branch = params.get("branch") || "";
  const district = params.get("district") || "";
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [branchLabel, setBranchLabel] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const pg = usePagination(trips, 5, [], { paramKey: "" });

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      // Si un arrondissement est choisi (sans branche précise), on résout d'abord
      // les branches correspondant à la ville + arrondissement pour restreindre les trajets.
      let branchIdsFilter: string[] | null = null;
      if (!branch && district) {
        let bq = supabase
          .from("agency_branches" as any)
          .select("id, city, district, status")
          .eq("status", "active")
          .ilike("district", district);
        if (from) bq = bq.ilike("city", from);
        const { data: bs } = await bq;
        branchIdsFilter = ((bs as any[]) || []).map((b) => b.id);
        if (branchIdsFilter.length === 0) {
          setTrips([]);
          setBranchLabel(`Arrondissement : ${district}`);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from("trips")
        .select("id, departure, destination, departure_time, arrival_time, date, price, available_seats, bus_type, agencies!inner(name, status)")
        .eq("status", "active")
        .eq("agencies.status", "active")
        .gt("available_seats", 0);

      if (from) query = query.eq("departure", from);
      if (to) query = query.eq("destination", to);
      if (date) query = query.eq("date", date);
      if (branch) query = query.eq("branch_id", branch);
      else if (branchIdsFilter) query = query.in("branch_id", branchIdsFilter);

      const { data } = await query.order("departure_time");
      // Mélange équitable: regroupe par heure de départ puis mélange aléatoirement
      // les trajets de la même tranche horaire pour ne privilégier aucune agence.
      const rows = ((data as unknown as TripRow[]) || []);
      const groups = new Map<string, TripRow[]>();
      rows.forEach((t) => {
        const key = t.departure_time || "";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(t);
      });
      const shuffled: TripRow[] = [];
      Array.from(groups.keys()).sort().forEach((k) => {
        const arr = groups.get(k)!;
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        shuffled.push(...arr);
      });
      setTrips(shuffled);

      if (branch) {
        const { data: br } = await supabase
          .from("agency_branches" as any)
          .select("name, city, district, agency:agencies(name)")
          .eq("id", branch)
          .maybeSingle();
        if (br) setBranchLabel(`${(br as any).agency?.name ? (br as any).agency.name + " — " : ""}${(br as any).name}${(br as any).district ? " · " + (br as any).district : ""}${(br as any).city ? " (" + (br as any).city + ")" : ""}`);
      } else if (district) {
        setBranchLabel(`Arrondissement : ${district}${from ? " (" + from + ")" : ""}`);
      } else setBranchLabel("");

      setLoading(false);
    };
    fetch();
  }, [from, to, date, branch, district]);

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
        {branchLabel && (
          <p className="text-primary-foreground/80 text-xs mt-1">Agence régionale : {branchLabel}</p>
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

            {pg.paginated.map((trip, i) => (
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
            {trips.length > 0 && <ListPagination {...pg} className="pt-2" />}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
