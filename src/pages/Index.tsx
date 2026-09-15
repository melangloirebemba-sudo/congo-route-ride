import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Calendar, Search, ArrowRight, Star, Bus, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useDistricts } from "@/hooks/useDistricts";
import { useAuth } from "@/hooks/useAuth";
import { AgencyLogo } from "@/components/LogoUploader";

const Index = () => {
  const navigate = useNavigate();
  const { loading: authLoading, isAdmin, agencyId, isManager } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (isAdmin) navigate("/admin", { replace: true });
    else if (agencyId) navigate("/agency", { replace: true });
    else if (isManager) navigate("/manager", { replace: true });
  }, [authLoading, isAdmin, agencyId, isManager, navigate]);


  const [departure, setDeparture] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [district, setDistrict] = useState("");
  const [branchId, setBranchId] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; city: string | null; district: string | null; agency: { name: string } | null }[]>([]);
  const [agencies, setAgencies] = useState<{ id: string; name: string; logo: string | null; rating: number | null; total_trips: number | null }[]>([]);
  const { byCity: districtsByCity } = useDistricts();

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
      ...districtsByCity(departure),
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

  const fieldClass =
    "w-full pl-11 pr-4 py-3.5 rounded-2xl bg-secondary/70 text-secondary-foreground text-sm font-body border border-border/60 focus:outline-none focus:ring-2 focus:ring-warning focus:border-transparent transition-all";

  return (
    <div className="min-h-screen pb-32">
      {/* Hero */}
      <section className="relative gradient-hero px-5 pt-12 pb-28 overflow-hidden rounded-b-[2.5rem]">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="absolute bottom-6 right-5 opacity-20" aria-hidden="true">
          <svg width="72" height="72" viewBox="0 0 60 60" fill="none">
            <circle cx="30" cy="30" r="28" stroke="white" strokeWidth="2" strokeDasharray="4 4" />
            <circle cx="30" cy="30" r="14" fill="white" />
          </svg>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 max-w-lg mx-auto"
        >
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-primary-foreground leading-tight mb-2">
            Voyagez en toute sérénité
          </h1>
          <p className="text-primary-foreground/90 text-sm font-medium max-w-xs">
            Réservez votre trajet à travers le Congo en quelques clics.
          </p>
        </motion.div>
      </section>

      {/* Search card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="px-5 -mt-20 relative z-10 max-w-lg mx-auto"
      >
        <div className="bg-card rounded-4xl p-5 shadow-lifted border border-border/40 space-y-3">
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <select value={departure} onChange={(e) => setDeparture(e.target.value)} className={fieldClass}>
              <option value="">Ville de départ</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
            <select value={destination} onChange={(e) => setDestination(e.target.value)} className={fieldClass}>
              <option value="">Destination</option>
              {cities.filter((c) => c !== departure).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {departure && (
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
              <select
                value={district}
                onChange={(e) => { setDistrict(e.target.value); setBranchId(""); }}
                className={fieldClass}
              >
                <option value="">Arrondissement / quartier (tous)</option>
                {availableDistricts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <Bus className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={fieldClass}>
              <option value="">Agence la plus proche (toutes)</option>
              {filteredBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.agency?.name ? `${b.agency.name} — ` : ""}{b.name}{b.district ? ` · ${b.district}` : ""}{b.city ? ` (${b.city})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
            />
          </div>

          <Button
            onClick={handleSearch}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-display font-bold text-base h-14 shadow-warm press"
          >
            <Search className="mr-2 h-4 w-4" />
            Rechercher un trajet
          </Button>
        </div>
      </motion.div>

      {/* Features */}
      <section className="px-5 pt-10 max-w-lg mx-auto">
        <h2 className="font-display text-xl font-bold mb-4">Pourquoi TransCongo ?</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {[
            { icon: Shield, label: "Paiement sécurisé", hint: "Mobile Money & carte", tint: "bg-accent/10 text-accent" },
            { icon: Clock, label: "Réservation instantanée", hint: "Votre place en 2 min", tint: "bg-primary/10 text-primary" },
            { icon: Bus, label: "Meilleures agences", hint: "Compagnies vérifiées", tint: "bg-warning/20 text-warning" },
          ].map(({ icon: Icon, label, hint, tint }) => (
            <div
              key={label}
              className="min-w-[150px] flex-1 card-soft p-4 hover:shadow-warm transition-shadow duration-300"
            >
              <div className={`pill-icon h-11 w-11 mb-3 ${tint}`}>
                <Icon className="h-5 w-5" strokeWidth={1.9} />
              </div>
              <p className="font-display font-bold text-sm leading-tight">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular Agencies */}
      <section className="px-5 pt-8 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">Agences partenaires</h2>
          <button
            onClick={() => navigate("/agencies")}
            className="text-primary text-sm font-semibold flex items-center gap-1 press"
          >
            Voir tout <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-3">
          {agencies.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune agence active pour le moment.
            </p>
          )}
          {agencies.map((agency, i) => (
            <motion.button
              key={agency.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => navigate(`/agencies/${agency.id}`)}
              className="w-full flex items-center gap-4 card-soft p-3.5 hover:shadow-warm text-left press"
            >
              <AgencyLogo logo={agency.logo} name={agency.name} className="h-14 w-14 rounded-2xl" />
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-sm truncate">{agency.name}</h3>
                <p className="text-xs text-muted-foreground">{agency.total_trips || 0} trajets</p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1">
                <Star className="h-3 w-3 fill-warning text-warning" />
                <span className="text-xs font-bold text-foreground">{agency.rating || 0}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Index;
