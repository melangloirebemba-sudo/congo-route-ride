import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tables } from "@/integrations/supabase/types";
import { ListPagination, usePagination } from "@/components/ListPagination";

type Trip = Tables<"trips">;
type Branch = { id: string; name: string; city: string | null };

const emptyTrip = {
  departure: "", destination: "", date: "", departure_time: "", arrival_time: "",
  price: "", total_seats: "", bus_type: "Standard", branch_id: "",
};

const AgencyTrips = () => {
  const { agencyId } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyTrip);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchTrips = async () => {
    if (!agencyId) return;
    const [{ data }, { data: br }] = await Promise.all([
      supabase.from("trips").select("*").eq("agency_id", agencyId).order("date", { ascending: false }),
      supabase.from("agency_branches" as any).select("id, name, city").eq("agency_id", agencyId).eq("status", "active").order("name"),
    ]);
    setTrips(data || []);
    setBranches((br as any) || []);
  };

  useEffect(() => { fetchTrips(); }, [agencyId]);

  const saveTrip = async () => {
    if (!form.departure || !form.destination || !form.date || !form.departure_time || !form.arrival_time || !form.price || !form.total_seats) {
      toast.error("Tous les champs sont requis");
      return;
    }

    const payload = {
      agency_id: agencyId!,
      departure: form.departure,
      destination: form.destination,
      date: form.date,
      departure_time: form.departure_time,
      arrival_time: form.arrival_time,
      price: parseInt(form.price),
      total_seats: parseInt(form.total_seats),
      available_seats: editId ? undefined : parseInt(form.total_seats),
      bus_type: form.bus_type,
      branch_id: form.branch_id || null,
    };

    let error;
    if (editId) {
      const { available_seats, ...updatePayload } = payload;
      ({ error } = await supabase.from("trips").update(updatePayload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("trips").insert(payload as any));
    }

    if (error) { toast.error(error.message); return; }
    toast.success(editId ? "Trajet mis à jour" : "Trajet créé");
    setForm(emptyTrip);
    setEditId(null);
    setDialogOpen(false);
    fetchTrips();
  };

  const deleteTrip = async (id: string) => {
    if (!confirm("Supprimer ce trajet ?")) return;
    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Trajet supprimé");
    fetchTrips();
  };

  const openEdit = (trip: Trip) => {
    setForm({
      departure: trip.departure,
      destination: trip.destination,
      date: trip.date,
      departure_time: trip.departure_time,
      arrival_time: trip.arrival_time,
      price: trip.price.toString(),
      total_seats: trip.total_seats.toString(),
      bus_type: trip.bus_type || "Standard",
      branch_id: (trip as any).branch_id || "",
    });
    setEditId(trip.id);
    setDialogOpen(true);
  };

  const openNew = () => {
    setForm(emptyTrip);
    setEditId(null);
    setDialogOpen(true);
  };

  const pg = usePagination(trips, 5, [], { paramKey: "" });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-accent/20 text-accent",
      cancelled: "bg-destructive/20 text-destructive",
      completed: "bg-muted text-muted-foreground",
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || ""}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Mes trajets</h1>
          <p className="text-sm text-muted-foreground">{trips.length} trajets enregistrés</p>
        </div>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Nouveau trajet
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Horaires</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Places</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Aucun trajet. Créez votre premier trajet !
                    </TableCell>
                  </TableRow>
                ) : (
                  pg.paginated.map(trip => (
                    <TableRow key={trip.id}>
                      <TableCell className="font-medium text-sm">{trip.departure} → {trip.destination}</TableCell>
                      <TableCell className="text-sm">{trip.date}</TableCell>
                      <TableCell className="text-xs">{trip.departure_time} - {trip.arrival_time}</TableCell>
                      <TableCell className="font-semibold">{trip.price.toLocaleString()} FCFA</TableCell>
                      <TableCell>
                        <span className="text-sm">{trip.available_seats}/{trip.total_seats}</span>
                      </TableCell>
                      <TableCell className="text-xs">{trip.bus_type}</TableCell>
                      <TableCell>{statusBadge(trip.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(trip)} title="Modifier">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteTrip(trip.id)} title="Supprimer">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t"><ListPagination {...pg} /></div>
        </CardContent>
      </Card>


      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Modifier le trajet" : "Nouveau trajet"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Départ *" value={form.departure} onChange={e => setForm(p => ({ ...p, departure: e.target.value }))} />
              <Input placeholder="Destination *" value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} />
            </div>
            <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="time" placeholder="Heure départ" value={form.departure_time} onChange={e => setForm(p => ({ ...p, departure_time: e.target.value }))} />
              <Input type="time" placeholder="Heure arrivée" value={form.arrival_time} onChange={e => setForm(p => ({ ...p, arrival_time: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Prix (FCFA) *" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
              <Input type="number" placeholder="Nombre de places *" value={form.total_seats} onChange={e => setForm(p => ({ ...p, total_seats: e.target.value }))} />
            </div>
            <Select value={form.bus_type} onValueChange={v => setForm(p => ({ ...p, bus_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="Semi-luxe">Semi-luxe</SelectItem>
                <SelectItem value="Luxe">Luxe</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={saveTrip} className="w-full gradient-primary text-primary-foreground">
              {editId ? "Enregistrer" : "Créer le trajet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgencyTrips;
