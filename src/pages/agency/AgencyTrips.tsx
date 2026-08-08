import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Edit, Trash2, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";
import { ListPagination, usePagination } from "@/components/ListPagination";

type Trip = Tables<"trips">;
type Branch = { id: string; name: string; city: string | null };

const emptyForm = {
  departure: "", destination: "", date: "", departure_time: "", arrival_time: "",
  price: "", total_seats: "", bus_type: "Standard",
  assignAll: true as boolean,
  branchIds: [] as string[],
  repeat: "none" as "none" | "daily" | "weekly" | "monthly",
  weekDays: [] as number[],
  until: "",
};

const WEEK_DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Builds the list of trip dates from the recurrence settings (max 120 occurrences). */
export const buildRecurrenceDates = (
  startISO: string,
  repeat: "none" | "daily" | "weekly" | "monthly",
  weekDays: number[],
  untilISO: string,
): string[] => {
  if (!startISO) return [];
  if (repeat === "none" || !untilISO) return [startISO];
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${untilISO}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [startISO];

  const dates: string[] = [];
  if (repeat === "monthly") {
    const cursor = new Date(start);
    while (cursor <= end && dates.length < 120) {
      dates.push(toISO(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return dates;
  }

  const days = repeat === "weekly" && weekDays.length ? weekDays : null;
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 120) {
    if (repeat === "daily" || !days || days.includes(cursor.getDay())) dates.push(toISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates.length ? dates : [startISO];
};


const AgencyTrips = () => {
  const { agencyId } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tripBranchMap, setTripBranchMap] = useState<Record<string, string[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchTrips = async () => {
    if (!agencyId) return;
    const [{ data }, { data: br }] = await Promise.all([
      supabase.from("trips").select("*").eq("agency_id", agencyId).order("date", { ascending: false }),
      supabase.from("agency_branches" as any).select("id, name, city").eq("agency_id", agencyId).eq("status", "active").order("name"),
    ]);
    setTrips(data || []);
    setBranches((br as any) || []);

    const ids = (data || []).map((t) => t.id);
    if (ids.length) {
      const { data: links } = await supabase
        .from("trip_branches" as any)
        .select("trip_id, branch_id")
        .in("trip_id", ids);
      const map: Record<string, string[]> = {};
      (links as any[] || []).forEach((l) => {
        (map[l.trip_id] ||= []).push(l.branch_id);
      });
      setTripBranchMap(map);
    } else {
      setTripBranchMap({});
    }
  };

  useEffect(() => { fetchTrips(); }, [agencyId]);

  const syncTripBranches = async (tripId: string) => {
    // Wipe then insert according to form
    await supabase.from("trip_branches" as any).delete().eq("trip_id", tripId);
    const target = form.assignAll ? branches.map((b) => b.id) : form.branchIds;
    if (target.length === 0) return;
    const rows = target.map((branch_id) => ({ trip_id: tripId, branch_id }));
    const { error } = await supabase.from("trip_branches" as any).insert(rows);
    if (error) toast.error("Assignation aux sous-agences : " + error.message);
  };

  const saveTrip = async () => {
    if (!form.departure || !form.destination || !form.date || !form.departure_time || !form.arrival_time || !form.price || !form.total_seats) {
      toast.error("Tous les champs sont requis");
      return;
    }
    if (!form.assignAll && form.branchIds.length === 0) {
      toast.error("Sélectionnez au moins une sous-agence ou cochez « Toutes les sous-agences »");
      return;
    }

    // Keep legacy branch_id populated for older manager filters (single "home" branch)
    const homeBranch = form.assignAll
      ? null
      : (form.branchIds[0] || null);

    const payload: any = {
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
      branch_id: homeBranch,
    };

    if (editId) {
      const { available_seats, ...updatePayload } = payload;
      const { error } = await supabase.from("trips").update(updatePayload).eq("id", editId);
      if (error) { toast.error(error.message); return; }
      await syncTripBranches(editId);
      toast.success("Trajet mis à jour");
    } else {
      const dates = buildRecurrenceDates(form.date, form.repeat, form.weekDays, form.until);

      // Anti-doublons : on ignore les dates où ce même trajet (même départ,
      // destination et heure) existe déjà pour l'agence.
      const { data: existing } = await supabase
        .from("trips")
        .select("date")
        .eq("agency_id", agencyId!)
        .eq("departure", form.departure)
        .eq("destination", form.destination)
        .eq("departure_time", form.departure_time)
        .in("date", dates);
      const taken = new Set((existing || []).map((t: any) => t.date));
      const newDates = dates.filter((d) => !taken.has(d));

      if (newDates.length === 0) {
        toast.error("Ce trajet existe déjà sur toutes les dates sélectionnées");
        return;
      }

      const rows = newDates.map((d) => ({ ...payload, date: d }));
      const { data, error } = await supabase.from("trips").insert(rows).select("id");
      if (error) { toast.error(error.message); return; }
      for (const t of (data || [])) await syncTripBranches(t.id);
      const skipped = dates.length - newDates.length;
      toast.success(
        `${newDates.length} date(s) programmée(s)${skipped ? ` · ${skipped} doublon(s) ignoré(s)` : ""}`,
      );
    }

    setForm(emptyForm);
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
    const linked = tripBranchMap[trip.id] || [];
    const allSelected = branches.length > 0 && linked.length === branches.length;
    setForm({
      departure: trip.departure,
      destination: trip.destination,
      date: trip.date,
      departure_time: trip.departure_time,
      arrival_time: trip.arrival_time,
      price: trip.price.toString(),
      total_seats: trip.total_seats.toString(),
      bus_type: trip.bus_type || "Standard",
      assignAll: allSelected || linked.length === 0,
      branchIds: linked,
      repeat: "none" as const,
      weekDays: [],
      until: "",
    });

    setEditId(trip.id);
    setDialogOpen(true);
  };

  const openNew = () => {
    setForm({ ...emptyForm, assignAll: true, branchIds: [] });
    setEditId(null);
    setDialogOpen(true);
  };

  const toggleBranch = (id: string) => {
    setForm((p) => ({
      ...p,
      branchIds: p.branchIds.includes(id) ? p.branchIds.filter((x) => x !== id) : [...p.branchIds, id],
    }));
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

  const branchesLabel = (tripId: string) => {
    const ids = tripBranchMap[tripId] || [];
    if (branches.length > 0 && ids.length === branches.length) return "Toutes";
    if (ids.length === 0) return "—";
    if (ids.length <= 2) {
      return branches.filter((b) => ids.includes(b.id)).map((b) => b.name).join(", ");
    }
    return `${ids.length} sous-agences`;
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
                  <TableHead>Sous-agences</TableHead>
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
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          <Building2 className="h-3 w-3 mr-1" /> {branchesLabel(trip.id)}
                        </Badge>
                      </TableCell>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Modifier le trajet" : "Nouveau trajet"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Départ *" value={form.departure} onChange={e => setForm(p => ({ ...p, departure: e.target.value }))} />
              <Input placeholder="Destination *" value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date de début *</label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
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

            {!editId && (
              <div className="rounded-lg border p-3 space-y-3 bg-secondary/30">
                <label className="text-sm font-medium">Périodicité du trajet</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select value={form.repeat} onValueChange={(v: any) => setForm(p => ({ ...p, repeat: v }))}>
                    <SelectTrigger aria-label="Périodicité"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Une seule date</SelectItem>
                      <SelectItem value="daily">Tous les jours</SelectItem>
                      <SelectItem value="weekly">Certains jours de la semaine</SelectItem>
                      <SelectItem value="monthly">Une fois par mois</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.repeat !== "none" && (
                    <Input
                      type="date"
                      aria-label="Répéter jusqu'au"
                      value={form.until}
                      min={form.date || undefined}
                      onChange={e => setForm(p => ({ ...p, until: e.target.value }))}
                    />
                  )}
                </div>

                {form.repeat === "weekly" && (
                  <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map((d) => {
                      const on = form.weekDays.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setForm(p => ({
                            ...p,
                            weekDays: on ? p.weekDays.filter(x => x !== d.value) : [...p.weekDays, d.value],
                          }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {form.repeat !== "none" && form.date && form.until && (
                  <p className="text-[11px] text-muted-foreground">
                    {buildRecurrenceDates(form.date, form.repeat, form.weekDays, form.until).length} trajet(s) seront créés
                    (max 120), du {form.date} au {form.until}.
                  </p>
                )}
                {form.repeat !== "none" && !form.until && (
                  <p className="text-[11px] text-muted-foreground">Choisissez une date de fin pour générer la série.</p>
                )}
              </div>
            )}


            <div className="rounded-lg border p-3 space-y-3 bg-secondary/30">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Sous-agences autorisées à vendre ce trajet</label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={form.assignAll}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, assignAll: !!v, branchIds: v ? branches.map(b => b.id) : p.branchIds }))}
                  />
                  Toutes les sous-agences
                </label>
              </div>
              {!form.assignAll && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {branches.length === 0 && (
                    <p className="text-xs text-muted-foreground">Aucune sous-agence active. Créez-en une dans « Sous-agences ».</p>
                  )}
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer p-1 rounded hover:bg-background">
                      <Checkbox
                        checked={form.branchIds.includes(b.id)}
                        onCheckedChange={() => toggleBranch(b.id)}
                      />
                      <span>{b.name}{b.city ? ` — ${b.city}` : ""}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Les sous-agences sélectionnées verront et pourront vendre ce trajet. Les autres pourront le voir uniquement si un client demande explicitement à embarquer chez elles.
              </p>
            </div>

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
