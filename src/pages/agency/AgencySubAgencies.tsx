import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, UserCog, Ticket, CalendarClock, Search } from "lucide-react";
import { ListPagination, usePagination } from "@/components/ListPagination";

type Branch = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  manager_name: string | null;
  status: string;
  can_create_trips?: boolean;
  can_sell_counter?: boolean;
  can_scan?: boolean;
  can_view_stats?: boolean;
};

type ManagerRow = {
  branch_id: string;
  full_name: string | null;
  email: string | null;
  status: string;
};

const permBadges = (b: Branch) => [
  { key: "trips", label: "Trajets", on: b.can_create_trips !== false },
  { key: "sell", label: "Guichet", on: b.can_sell_counter !== false },
  { key: "scan", label: "Scan", on: b.can_scan !== false },
  { key: "stats", label: "Stats", on: b.can_view_stats !== false },
];

const AgencySubAgencies = () => {
  const { agencyId } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { trips: number; bookings: number }>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agencyId) return;
    (async () => {
      setLoading(true);
      const [{ data: b }, { data: m }, { data: t }, { data: bk }] = await Promise.all([
        supabase.from("agency_branches" as any).select("*").eq("agency_id", agencyId).order("name"),
        supabase.from("branch_managers" as any).select("branch_id, full_name, email, status").eq("agency_id", agencyId),
        supabase.from("trips").select("id, branch_id").eq("agency_id", agencyId),
        supabase.from("bookings").select("id, trips!inner(agency_id, branch_id)").eq("trips.agency_id", agencyId),
      ]);
      setBranches((b as any) || []);
      setManagers((m as any) || []);
      const map: Record<string, { trips: number; bookings: number }> = {};
      (t || []).forEach((row: any) => {
        if (!row.branch_id) return;
        map[row.branch_id] = map[row.branch_id] || { trips: 0, bookings: 0 };
        map[row.branch_id].trips++;
      });
      (bk || []).forEach((row: any) => {
        const bid = row.trips?.branch_id;
        if (!bid) return;
        map[bid] = map[bid] || { trips: 0, bookings: 0 };
        map[bid].bookings++;
      });
      setCounts(map);
      setLoading(false);
    })();
  }, [agencyId]);

  const managerByBranch = useMemo(() => {
    const m: Record<string, ManagerRow[]> = {};
    managers.forEach((r) => {
      if (!m[r.branch_id]) m[r.branch_id] = [];
      m[r.branch_id].push(r);
    });
    return m;
  }, [managers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.city || "").toLowerCase().includes(q) ||
        (b.district || "").toLowerCase().includes(q),
    );
  }, [branches, search]);

  const pg = usePagination(filtered, 5, [search], { paramKey: "" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Sous-agences</h1>
          <p className="text-sm text-muted-foreground">
            Détails de vos branches — accès rapide aux réservations et disponibilités
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/agency/branches"><Building2 className="h-4 w-4 mr-2" /> Gérer les branches</Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, ville, arrondissement..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune sous-agence trouvée.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {pg.items.map((b: Branch) => {
              const mgrs = managerByBranch[b.id] || [];
              const c = counts[b.id] || { trips: 0, bookings: 0 };
              return (
                <Card key={b.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base font-display truncate flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          {b.name}
                        </CardTitle>
                        {(b.city || b.district) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {[b.district, b.city].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                      <Badge variant={b.status === "active" ? "default" : "secondary"} className="shrink-0">
                        {b.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 flex-1 flex flex-col">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                        <UserCog className="h-3 w-3" /> Rôle / Gestionnaire
                      </p>
                      {mgrs.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Aucun gestionnaire assigné</p>
                      ) : (
                        <ul className="text-sm space-y-0.5">
                          {mgrs.map((m, i) => (
                            <li key={i} className="truncate">
                              <span className="font-medium">{m.full_name || m.email || "—"}</span>
                              <span className="text-xs text-muted-foreground"> · {m.status}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {permBadges(b).map((p) => (
                        <span
                          key={p.key}
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            p.on
                              ? "bg-accent/15 text-accent"
                              : "bg-muted text-muted-foreground line-through"
                          }`}
                        >
                          {p.label}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-secondary/50 p-2">
                        <p className="text-muted-foreground">Trajets</p>
                        <p className="font-semibold text-sm">{c.trips}</p>
                      </div>
                      <div className="rounded-md bg-secondary/50 p-2">
                        <p className="text-muted-foreground">Réservations</p>
                        <p className="font-semibold text-sm">{c.bookings}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 mt-auto">
                      <Button asChild size="sm" variant="outline" className="flex-1">
                        <Link to={`/agency/bookings?branch=${b.id}`}>
                          <Ticket className="h-3.5 w-3.5 mr-1" /> Réservations
                        </Link>
                      </Button>
                      <Button asChild size="sm" className="flex-1">
                        <Link to={`/agency/trips?branch=${b.id}`}>
                          <CalendarClock className="h-3.5 w-3.5 mr-1" /> Disponibilités
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <ListPagination pg={pg} />
        </>
      )}
    </div>
  );
};

export default AgencySubAgencies;
