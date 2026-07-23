import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListPagination, usePagination } from "@/components/ListPagination";
import { Badge } from "@/components/ui/badge";

const ManagerBookings = () => {
  const { manager } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!manager) return;
    (async () => {
      const select = "*, trips!inner(departure, destination, date, departure_time, agency_id, branch_id)";
      // Bookings whose trip belongs to this branch
      const tripBranchQuery = supabase
        .from("bookings")
        .select(select)
        .eq("trips.agency_id", manager.agency_id)
        .order("created_at", { ascending: false });
      const q1 = manager.branch_id ? tripBranchQuery.eq("trips.branch_id", manager.branch_id) : tripBranchQuery;

      // Bookings assigned to this branch for boarding (created by the agency owner)
      const q2 = manager.branch_id
        ? (supabase
            .from("bookings")
            .select(select)
            .eq("boarding_branch_id" as any, manager.branch_id)
            .order("created_at", { ascending: false }) as any)

        : null;

      const [{ data: d1 }, r2] = await Promise.all([q1, q2 ?? Promise.resolve({ data: [] as any[] })]);
      const map = new Map<string, any>();
      [...(d1 || []), ...((r2 as any).data || [])].forEach((b) => map.set(b.id, b));
      setBookings(Array.from(map.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
    })();
  }, [manager]);


  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.passenger_name.toLowerCase().includes(q) || b.phone.includes(search);
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const pg = usePagination(filtered, 5, [search, statusFilter], { paramKey: "" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Réservations</h1>
        <p className="text-sm text-muted-foreground">{bookings.length} réservations pour votre branche (en ligne + guichet)</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par nom ou téléphone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="confirmed">Confirmé</SelectItem>
            <SelectItem value="used">Embarqué</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Passager</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Siège</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune réservation</TableCell></TableRow>
                ) : pg.paginated.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{b.passenger_name}</p>
                      <p className="text-xs text-muted-foreground">{b.phone}</p>
                    </TableCell>
                    <TableCell className="text-sm">{b.trips?.departure} → {b.trips?.destination}</TableCell>
                    <TableCell className="text-sm">{b.trips?.date}</TableCell>
                    <TableCell className="text-sm">N°{b.seat_number}</TableCell>
                    <TableCell className="font-semibold text-sm">{b.total_amount.toLocaleString()} FCFA</TableCell>
                    <TableCell className="text-xs">{b.payment_method}</TableCell>
                    <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
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

export default ManagerBookings;
