import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ListPagination, usePagination } from "@/components/ListPagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ManagerTrips = () => {
  const { manager } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"mine" | "all">("mine");

  useEffect(() => {
    if (!manager) return;
    (async () => {
      const { data: links } = await supabase
        .from("trip_branches" as any)
        .select("trip_id")
        .eq("branch_id", manager.branch_id);
      const ids = ((links as any[]) || []).map((l) => l.trip_id);
      setAssignedIds(ids);

      let q = supabase
        .from("trips")
        .select("*")
        .eq("agency_id", manager.agency_id)
        .order("date", { ascending: false });

      if (ids.length > 0) {
        q = q.or(`id.in.(${ids.join(",")}),branch_id.eq.${manager.branch_id}`);
      } else if (manager.branch_id) {
        q = q.eq("branch_id", manager.branch_id);
      }

      const { data } = await q;
      setTrips(data || []);
    })();
  }, [manager]);

  const scoped = useMemo(() => {
    if (scope === "all") return trips;
    // "mine" = trips explicitly assigned to this branch (via trip_branches or legacy branch_id)
    return trips.filter((t) =>
      assignedIds.includes(t.id) || (manager?.branch_id && t.branch_id === manager.branch_id)
    );
  }, [trips, scope, assignedIds, manager?.branch_id]);

  const filtered = scoped.filter((t) => {
    const q = search.toLowerCase();
    return !q || t.departure.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q);
  });
  const pg = usePagination(filtered, 5, [search, scope], { paramKey: "" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Trajets</h1>
        <p className="text-sm text-muted-foreground">Consultation en lecture seule — {filtered.length} trajet(s)</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par ville..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={scope} onValueChange={(v) => setScope(v as any)}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">Assignés à ma sous-agence</SelectItem>
            <SelectItem value="all">Toutes les sous-agences autorisées</SelectItem>
          </SelectContent>
        </Select>
      </div>


      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Départ</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Places</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun trajet</TableCell></TableRow>
                ) : pg.paginated.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">{t.departure} → {t.destination}</TableCell>
                    <TableCell className="text-sm">{t.date}</TableCell>
                    <TableCell className="text-sm">{t.departure_time}</TableCell>
                    <TableCell className="text-sm">{t.price.toLocaleString()} {t.currency}</TableCell>
                    <TableCell className="text-sm">{t.available_seats}/{t.total_seats}</TableCell>
                    <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/manager/sale?trip=${t.id}`}><Eye className="h-4 w-4 mr-1" /> Vendre</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t"><ListPagination {...pg} /></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerTrips;
