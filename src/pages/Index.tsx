import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Calendar, Search, ArrowRight, Star, Bus, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { districtsFor } from "@/lib/districts";

const Index = () => {
  const navigate = useNavigate();
  const [departure, setDeparture] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [district, setDistrict] = useState("");
  const [branchId, setBranchId] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; city: string | null; district: string | null; agency: { name: string } | null }[]>([]);
  const [agencies, setAgencies] = useState<{ id: string; name: string; logo: string | null; rating: number | null; total_trips: number | null }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [citiesRes, agenciesRes, branchesRes] = await Promise.all([
        supabase.from("trips").select("departure, destination"),
        supabase.from("agencies").select("id, name, logo, rating, total_trips").eq("status", "active").eq("is_popular", true).order("popularity_rank", { ascending: true, nullsFirst: false }).order("rating", { ascending: false }).limit(5),
        supabase.from("agency_branches" as any).select("id, name, city, district, agency:agencies!inner(name, status)").eq("status", "active").eq("agencies.status", "active").order("city"),
      ]);

      if (citiesRes.data) {
        const allCities = new Set<string>();
        citiesRes.data.forEach((t) => {
          allCities.add(t.departure);
          allCities.add(t.destination);
        });
        setCities(Array.from(allCities).sort());
      }

      if (agenciesRes.data) setAgencies(agenciesRes.data);
      if (branchesRes.data) setBranches((branchesRes.data as any) || []);
    };
    fetchData();
  }, []);

  // Filter branches by chosen departure city (when set)
  const cityBranches = departure
    ? branches.filter((b) => (b.city || "").toLowerCase() === departure.toLowerCase())
    : branches;
  const availableDistricts = Array.from(
    new Set([
      ...districtsFor(departure),
      ...cityBranches.map((b) => b.district).filter(Boolean) as string[],
    ])
  ).sort();
  const filteredBranches = district
    ? cityBranches.filter((b) => (b.district || "").toLowerCase() === district.toLowerCase())
    : cityBranches;

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (departure) params.set("from", departure);
    if (destination) params.set("to", destination);
    if (date) params.set("date", date);
    if (district) params.set("district", district);
    if (branchId) params.set("branch", branchId);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <section className="relative gradient-hero px-4 pt-12 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-lg mx-auto"
        >
          <h1 className="font-display text-3xl md:text-5xl font-bold text-primary-foreground mb-2">
            Voyagez<br />simplement.
          </h1>
          <p className="text-primary-foreground/80 text-sm md:text-base mb-8">
            Réservez vos billets de transport terrestre au Congo en quelques clics.
          </p>

          <div className="glass rounded-2xl p-4 space-y-3">
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-primary" />
              <select
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Ville de départ</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-accent" />
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Destination</option>
                {cities.filter((c) => c !== departure).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>


            <div className="relative">
              <Bus className="absolute left-3 top-3 h-4 w-4 text-primary" />
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Agence régionale (toutes)</option>
                {filteredBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.agency?.name ? `${b.agency.name} — ` : ""}{b.name}{b.city ? ` (${b.city})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <Button
              onClick={handleSearch}
              className="w-full gradient-primary text-primary-foreground py-3 rounded-xl font-display font-semibold text-base h-12"
            >
              <Search className="mr-2 h-4 w-4" />
              Rechercher un trajet
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-4 py-10 max-w-lg mx-auto">
        <h2 className="font-display text-lg font-bold mb-4">Pourquoi TransCongo ?</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Shield, label: "Paiement\nsécurisé", color: "text-accent" },
            { icon: Clock, label: "Réservation\ninstantanée", color: "text-primary" },
            { icon: Bus, label: "Meilleures\nagences", color: "text-warning" },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="bg-card rounded-xl p-4 text-center border border-border/50">
              <Icon className={`h-6 w-6 mx-auto mb-2 ${color}`} />
              <p className="text-xs font-body text-muted-foreground whitespace-pre-line">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular Agencies */}
      <section className="px-4 pb-10 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold">Agences populaires</h2>
          <button
            onClick={() => navigate("/agencies")}
            className="text-primary text-sm font-medium flex items-center gap-1"
          >
            Voir tout <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-3">
          {agencies.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune agence active pour le moment.
            </p>
          )}
          {agencies.map((agency, i) => (
            <motion.button
              key={agency.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => navigate(`/agencies/${agency.id}`)}
              className="w-full flex items-center gap-4 bg-card rounded-xl p-4 border border-border/50 hover:border-primary/50 transition text-left"
            >
              <span className="text-3xl">{agency.logo || "🚌"}</span>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-sm">{agency.name}</h3>
                <p className="text-xs text-muted-foreground">{agency.total_trips || 0} trajets</p>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-warning text-warning" />
                <span className="text-sm font-semibold">{agency.rating || 0}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Index;
