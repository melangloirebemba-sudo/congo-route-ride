import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListPagination, usePagination } from "@/components/ListPagination";

type Branch = { id: string; name: string };

const AgencyBookings = () => {
  const { agencyId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState<string>(searchParams.get("branch") || "all");

  useEffect(() => {
    if (!agencyId) return;
    (async () => {
      const [{ data: bk }, { data: br }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, trips!inner(departure, destination, date, departure_time, agency_id, branch_id)")
          .eq("trips.agency_id", agencyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("agency_branches" as any)
          .select("id, name")
          .eq("agency_id", agencyId)
          .order("name"),
      ]);
      setBookings(bk || []);
      setBranches(((br as any) || []) as Branch[]);
    })();
  }, [agencyId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (branchFilter === "all") next.delete("branch");
    else next.set("branch", branchFilter);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter]);

  const filtered = useMemo(() => bookings.filter(b => {
    const matchSearch = b.passenger_name.toLowerCase().includes(search.toLowerCase()) ||
      b.phone.includes(search);
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    const matchBranch = branchFilter === "all"
      || b.boarding_branch_id === branchFilter
      || (!b.boarding_branch_id && b.trips?.branch_id === branchFilter);
    return matchSearch && matchStatus && matchBranch;
  }), [bookings, search, statusFilter, branchFilter]);

  const pg = usePagination(filtered, 5, [search, statusFilter, branchFilter], { paramKey: "" });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      confirmed: "bg-accent/20 text-accent",
      completed: "bg-muted text-muted-foreground",
      cancelled: "bg-destructive/20 text-destructive",
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || ""}`}>{status}</span>;
  };

  const branchName = (id?: string | null) => branches.find(b => b.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Réservations</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} / {bookings.length} réservation{bookings.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par nom ou téléphone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Sous-agence" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sous-agences</SelectItem>
            {branches.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="confirmed">Confirmé</SelectItem>
            <SelectItem value="completed">Terminé</SelectItem>
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
                  <TableHead>Sous-agence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Siège</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucune réservation</TableCell>
                  </TableRow>
                ) : (
                  pg.paginated.map(b => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{b.passenger_name}</p>
                        <p className="text-xs text-muted-foreground">{b.phone}</p>
                      </TableCell>
                      <TableCell className="text-sm">{b.trips?.departure} → {b.trips?.destination}</TableCell>
                      <TableCell className="text-xs">{branchName(b.boarding_branch_id || b.trips?.branch_id)}</TableCell>
                      <TableCell className="text-sm">{b.trips?.date}</TableCell>
                      <TableCell className="text-sm">N°{b.seat_number}</TableCell>
                      <TableCell className="font-semibold text-sm">{b.total_amount.toLocaleString()} FCFA</TableCell>
                      <TableCell className="text-xs">{b.payment_method}</TableCell>
                      <TableCell>{statusBadge(b.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t"><ListPagination {...pg} /></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencyBookings;
