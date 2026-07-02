import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ListPagination, usePagination } from "@/components/ListPagination";

type Agency = {
  id: string;
  name: string;
  logo: string | null;
  rating: number | null;
  total_trips: number | null;
  address: string | null;
};

const Agencies = () => {
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("agencies")
        .select("id, name, logo, rating, total_trips, address")
        .eq("status", "active")
        .order("rating", { ascending: false });
      setAgencies(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = agencies.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );
  const pg = usePagination(filtered, 5, [query]);


  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg font-bold">Toutes les agences</h1>
      </header>

      <div className="px-4 py-4 max-w-lg mx-auto">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une agence"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-10">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">Aucune agence trouvée.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((agency, i) => (
              <motion.button
                key={agency.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/agencies/${agency.id}`)}
                className="w-full flex items-center gap-4 bg-card rounded-xl p-4 border border-border/50 hover:border-primary/50 transition text-left"
              >
                <span className="text-3xl">{agency.logo || "🚌"}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-sm truncate">{agency.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {agency.address || `${agency.total_trips || 0} trajets`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Star className="h-3 w-3 fill-warning text-warning" />
                  <span className="text-sm font-semibold">{agency.rating || 0}</span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Agencies;
