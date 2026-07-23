import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPagination, usePagination } from "@/components/ListPagination";
import { CheckCircle2, Clock, XCircle, QrCode, RefreshCw, Megaphone, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const ManagerBoarding = () => {
  const { manager } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState<string>("");
  const [tripId, setTripId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTrip, setBroadcastTrip] = useState<string>("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [sendMode, setSendMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editAt, setEditAt] = useState<string>("");
  const [editMsg, setEditMsg] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [editMode, setEditMode] = useState<"edit" | "duplicate">("edit");

  useEffect(() => {
    if (!manager?.branch_id) return;
    supabase.from("agency_branches").select("id, name, city, district, address")
      .eq("id", manager.branch_id).maybeSingle()
      .then(({ data }) => setBranchInfo(data));
  }, [manager?.branch_id]);

  const selectedTripObj = useMemo(
    () => trips.find((t) => t.id === broadcastTrip) || null,
    [trips, broadcastTrip]
  );

  const branchLocation = useMemo(() => {
    if (!branchInfo) return "Votre sous-agence";
    const addr = [branchInfo.address, branchInfo.district, branchInfo.city].filter(Boolean).join(", ");
    return addr ? `${branchInfo.name} — ${addr}` : branchInfo.name;
  }, [branchInfo]);

  const previewMessage = useMemo(() => {
    if (!selectedTripObj) return "";
    const d = selectedTripObj.date
      ? new Date(selectedTripObj.date + "T00:00").toLocaleDateString("fr-FR")
      : "";
    const h = (selectedTripObj.departure_time || "").slice(0, 5);
    const base = `Embarquement le ${d} à ${h}. Lieu : ${branchLocation}.`;
    const extra = broadcastMsg?.trim();
    return extra ? `${base}\n${extra}` : base;
  }, [selectedTripObj, broadcastMsg, branchLocation]);

  // Recount targets whenever selected trip changes / dialog opens
  useEffect(() => {
    const run = async () => {
      if (!broadcastOpen || !broadcastTrip || !manager?.branch_id) {
        setTargetCount(null);
        return;
      }
      const tripBranchId = selectedTripObj?.branch_id ?? null;
      let q = supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", broadcastTrip)
        .eq("payment_status", "paid")
        .neq("status", "cancelled")
        .not("user_id", "is", null);
      if (tripBranchId === manager.branch_id) {
        q = q.or(`boarding_branch_id.eq.${manager.branch_id},boarding_branch_id.is.null`);
      } else {
        q = q.eq("boarding_branch_id", manager.branch_id);
      }
      const { count } = await q;
      setTargetCount(count ?? 0);
    };
    run();
  }, [broadcastOpen, broadcastTrip, manager?.branch_id, selectedTripObj]);

  const loadScheduled = async () => {
    if (!manager?.branch_id) return;
    const { data } = await (supabase as any)
      .from("scheduled_boarding_broadcasts")
      .select("id, trip_id, scheduled_at, status, sent_at, recipients_count, extra_message, failure_reason, trips(departure, destination, date, departure_time)")
      .eq("branch_id", manager.branch_id)
      .order("scheduled_at", { ascending: false })
      .limit(50);
    setScheduled(data || []);
  };

  useEffect(() => { loadScheduled(); }, [manager?.branch_id]);

  const sendBroadcast = async () => {
    if (!broadcastTrip) { toast.error("Sélectionnez un trajet"); return; }
    setBroadcasting(true);

    if (sendMode === "later") {
      if (!scheduledAt) { setBroadcasting(false); toast.error("Choisissez une date/heure"); return; }
      const when = new Date(scheduledAt);
      if (when.getTime() <= Date.now() + 30_000) {
        setBroadcasting(false);
        toast.error("La date planifiée doit être au moins 1 minute dans le futur");
        return;
      }
      const { error } = await (supabase as any).from("scheduled_boarding_broadcasts").insert({
        trip_id: broadcastTrip,
        branch_id: manager?.branch_id,
        agency_id: manager?.agency_id,
        created_by: (await supabase.auth.getUser()).data.user?.id,
        extra_message: broadcastMsg?.trim() || null,
        scheduled_at: when.toISOString(),
      });
      setBroadcasting(false);
      if (error) { toast.error(error.message); return; }
      toast.success(`Diffusion planifiée pour le ${when.toLocaleString("fr-FR")}`);
      setConfirmOpen(false); setBroadcastOpen(false); setBroadcastMsg(""); setScheduledAt(""); setSendMode("now");
      loadScheduled();
      return;
    }

    const { data, error } = await supabase.rpc("broadcast_boarding_info", {
      _trip_id: broadcastTrip,
      _extra_message: broadcastMsg?.trim() || null,
    });
    setBroadcasting(false);
    if (error) { toast.error(error.message); return; }
    const res: any = data;
    if (!res?.ok) { toast.error(res?.message || "Diffusion impossible"); return; }
    toast.success(`Diffusion envoyée à ${res.sent} passager(s)`);
    setConfirmOpen(false);
    setBroadcastOpen(false);
    setBroadcastMsg("");
  };

  const cancelScheduled = async (id: string) => {
    const { error } = await (supabase as any)
      .from("scheduled_boarding_broadcasts")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("status", "scheduled");
    if (error) { toast.error(error.message); return; }
    toast.success("Diffusion annulée");
    loadScheduled();
  };

  const openEditScheduled = (row: any, mode: "edit" | "duplicate") => {
    setEditItem(row);
    setEditMode(mode);
    const iso = row.scheduled_at ? new Date(row.scheduled_at) : new Date(Date.now() + 60 * 60 * 1000);
    // Convert to yyyy-MM-ddTHH:mm local
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditAt(`${iso.getFullYear()}-${pad(iso.getMonth() + 1)}-${pad(iso.getDate())}T${pad(iso.getHours())}:${pad(iso.getMinutes())}`);
    setEditMsg(row.extra_message || "");
    setScheduledOpen(false);
  };

  const submitEditScheduled = async () => {
    if (!editItem) return;
    if (!editAt) { toast.error("Choisissez une date/heure"); return; }
    const when = new Date(editAt);
    if (when.getTime() <= Date.now()) { toast.error("La date doit être dans le futur"); return; }
    setEditSaving(true);
    if (editMode === "edit") {
      const { error } = await (supabase as any)
        .from("scheduled_boarding_broadcasts")
        .update({ scheduled_at: when.toISOString(), extra_message: editMsg?.trim() || null })
        .eq("id", editItem.id)
        .eq("status", "scheduled");
      setEditSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Diffusion mise à jour");
    } else {
      const { error } = await (supabase as any).from("scheduled_boarding_broadcasts").insert({
        trip_id: editItem.trip_id,
        branch_id: editItem.branch_id ?? manager?.branch_id,
        agency_id: editItem.agency_id ?? manager?.agency_id,
        created_by: (await supabase.auth.getUser()).data.user?.id,
        extra_message: editMsg?.trim() || null,
        scheduled_at: when.toISOString(),
        status: "scheduled",
      });
      setEditSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Diffusion dupliquée et planifiée");
    }
    setEditItem(null);
    setEditConfirmOpen(false);
    loadScheduled();
    setScheduledOpen(true);
  };

  const load = async () => {
    if (!manager?.branch_id) return;
    setLoading(true);

    // Bookings where boarding happens at this branch:
    // - explicit boarding_branch_id = this branch
    // - OR trip.branch_id = this branch AND boarding_branch_id is null
    const { data: bA } = await supabase
      .from("bookings")
      .select("id, passenger_name, phone, seat_number, qr_code, status, payment_status, boarding_status, boarded_at, boarding_notes, boarding_branch_id, trip_id, trips!inner(id, departure, destination, date, departure_time, branch_id, agency_id)")
      .eq("boarding_branch_id", manager.branch_id);

    const { data: bB } = await supabase
      .from("bookings")
      .select("id, passenger_name, phone, seat_number, qr_code, status, payment_status, boarding_status, boarded_at, boarding_notes, boarding_branch_id, trip_id, trips!inner(id, departure, destination, date, departure_time, branch_id, agency_id)")
      .is("boarding_branch_id", null)
      .eq("trips.branch_id", manager.branch_id);

    const map = new Map<string, any>();
    [...(bA || []), ...(bB || [])].forEach((r: any) => map.set(r.id, r));
    const all = Array.from(map.values());
    setRows(all);

    const tripMap = new Map<string, any>();
    all.forEach((r: any) => r.trips && tripMap.set(r.trips.id, r.trips));
    setTrips(Array.from(tripMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1)));

    setLoading(false);
  };

  useEffect(() => { load(); }, [manager?.branch_id]);

  // Realtime: refresh counters and list when any booking changes while scanning.
  useEffect(() => {
    if (!manager?.branch_id) return;
    let t: any;
    const debouncedLoad = () => { clearTimeout(t); t = setTimeout(load, 300); };
    const channel = supabase
      .channel(`boarding-${manager.branch_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, debouncedLoad)
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager?.branch_id]);

  const scanHref = useMemo(() => {
    const p = new URLSearchParams();
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    if (tripId !== "all") p.set("trip_id", tripId);
    if (status !== "all") p.set("status", status);
    const qs = p.toString();
    return `/manager/scan${qs ? `?${qs}` : ""}`;
  }, [dateFrom, dateTo, tripId, status]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const d = r.trips?.date;
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      if (tripId !== "all" && r.trip_id !== tripId) return false;
      if (status !== "all") {
        const bs = r.boarding_status || "pending";
        if (bs !== status) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.passenger_name} ${r.phone} ${r.qr_code} ${r.trips?.departure} ${r.trips?.destination}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, dateFrom, dateTo, tripId, status, search]);

  const stats = useMemo(() => {
    const s = { pending: 0, boarded: 0, refused: 0 };
    filtered.forEach((r) => {
      const bs = r.boarding_status || "pending";
      if (bs === "boarded") s.boarded++;
      else if (bs === "refused") s.refused++;
      else s.pending++;
    });
    return s;
  }, [filtered]);

  const pg = usePagination(filtered, 10, [dateFrom, dateTo, tripId, status, search], { paramKey: "" });

  const statusBadge = (bs: string | null) => {
    const v = bs || "pending";
    if (v === "boarded") return <Badge className="bg-green-600">Embarqué</Badge>;
    if (v === "refused") return <Badge variant="destructive">Refusé</Badge>;
    return <Badge variant="outline">Non scanné</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold">Tableau d'embarquement</h1>
          <p className="text-sm text-muted-foreground">Suivi des billets à embarquer dans votre sous-agence</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setBroadcastTrip(tripId !== "all" ? tripId : (trips[0]?.id ?? ""));
              setBroadcastOpen(true);
            }}
            disabled={trips.length === 0}
          >
            <Megaphone className="h-4 w-4 mr-2" /> Diffuser embarquement
          </Button>
          <Button variant="outline" size="sm" onClick={() => { loadScheduled(); setScheduledOpen(true); }}>
            <Clock className="h-4 w-4 mr-2" /> Planifiées
            {scheduled.filter((s) => s.status === "scheduled").length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {scheduled.filter((s) => s.status === "scheduled").length}
              </Badge>
            )}
          </Button>
          <Button asChild size="sm">
            <Link to={scanHref}><QrCode className="h-4 w-4 mr-2" /> Scanner</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-amber-600" /> Non scannés</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-amber-600">{stats.pending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Embarqués</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{stats.boarded}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /> Refusés</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-destructive">{stats.refused}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Du</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Au</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Trajet</label>
            <Select value={tripId} onValueChange={setTripId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les trajets</SelectItem>
                {trips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.departure} → {t.destination} — {t.date} {t.departure_time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Statut</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">Non scanné</SelectItem>
                <SelectItem value="boarded">Embarqué</SelectItem>
                <SelectItem value="refused">Refusé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5">
            <Input placeholder="Rechercher passager, téléphone, code TC-…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Passager</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Date / Heure</TableHead>
                  <TableHead>Siège</TableHead>
                  <TableHead>Embarquement</TableHead>
                  <TableHead>Scanné le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun billet trouvé</TableCell></TableRow>
                ) : pg.paginated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.qr_code}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{r.passenger_name}</div>
                      <div className="text-xs text-muted-foreground">{r.phone}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.trips?.departure} → {r.trips?.destination}</TableCell>
                    <TableCell className="text-sm">{r.trips?.date} <span className="text-muted-foreground">{r.trips?.departure_time}</span></TableCell>
                    <TableCell className="text-sm">#{r.seat_number}</TableCell>
                    <TableCell>
                      {statusBadge(r.boarding_status)}
                      {r.boarding_notes && <div className="text-xs text-muted-foreground mt-1">{r.boarding_notes}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.boarded_at ? new Date(r.boarded_at).toLocaleString("fr-FR") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t"><ListPagination {...pg} /></div>
        </CardContent>
      </Card>

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Diffuser les infos d'embarquement</DialogTitle>
            <DialogDescription>
              Un message avec la date, l'heure et le lieu d'embarquement (votre sous-agence) sera envoyé à tous les passagers ayant payé leur billet pour ce trajet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Trajet</label>
              <Select value={broadcastTrip} onValueChange={setBroadcastTrip}>
                <SelectTrigger><SelectValue placeholder="Sélectionnez un trajet" /></SelectTrigger>
                <SelectContent>
                  {trips.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.departure} → {t.destination} — {t.date} {t.departure_time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Message additionnel (facultatif)</label>
              <Textarea
                rows={3}
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Ex: Merci de vous présenter 30 minutes avant le départ."
              />
            </div>
            <div className="rounded-xl border p-3 space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Envoi</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSendMode("now")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${sendMode === "now" ? "border-primary bg-primary/10 font-medium" : ""}`}>
                  Immédiat
                </button>
                <button type="button" onClick={() => setSendMode("later")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${sendMode === "later" ? "border-primary bg-primary/10 font-medium" : ""}`}>
                  Planifié
                </button>
              </div>
              {sendMode === "later" && (
                <div>
                  <label className="text-xs text-muted-foreground">Date et heure d'envoi</label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
              )}
            </div>

            {broadcastTrip && (
              <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Aperçu du message</span>
                  <Badge variant="secondary" className="text-xs">
                    {targetCount === null ? "…" : `${targetCount} passager${targetCount > 1 ? "s" : ""} ciblé${targetCount > 1 ? "s" : ""}`}
                  </Badge>
                </div>
                <div className="rounded-lg bg-background border p-3 text-sm">
                  <div className="font-semibold mb-1">
                    Rappel embarquement : {selectedTripObj?.departure} → {selectedTripObj?.destination}
                  </div>
                  <div className="whitespace-pre-wrap text-muted-foreground">{previewMessage}</div>
                </div>
                {targetCount === 0 && (
                  <p className="text-xs text-warning-foreground">
                    Aucun passager payé n'est associé à votre sous-agence pour ce trajet.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastOpen(false)}>Annuler</Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!broadcastTrip || targetCount === 0 || targetCount === null || (sendMode === "later" && !scheduledAt)}
            >
              <Megaphone className="h-4 w-4 mr-2" />
              {sendMode === "later" ? "Prévisualiser et planifier" : "Prévisualiser et envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sendMode === "later" ? "Confirmer la planification" : "Confirmer la diffusion"}</DialogTitle>
            <DialogDescription>
              {sendMode === "later"
                ? <>Ce message sera envoyé automatiquement le <strong>{scheduledAt ? new Date(scheduledAt).toLocaleString("fr-FR") : ""}</strong> à environ <strong>{targetCount ?? 0}</strong> passager(s) payés (le compte final est recalculé à l'envoi).</>
                : <>Ce message sera envoyé immédiatement à <strong>{targetCount ?? 0}</strong> passager{(targetCount ?? 0) > 1 ? "s" : ""} ayant payé leur billet. Cette action est irréversible.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/40 border p-3 text-sm">
            <div className="font-semibold mb-1">
              {selectedTripObj?.departure} → {selectedTripObj?.destination}
            </div>
            <div className="whitespace-pre-wrap text-muted-foreground">{previewMessage}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={broadcasting}>
              Modifier
            </Button>
            <Button onClick={sendBroadcast} disabled={broadcasting}>
              <Megaphone className="h-4 w-4 mr-2" />
              {broadcasting
                ? (sendMode === "later" ? "Planification..." : "Envoi...")
                : (sendMode === "later" ? "Confirmer la planification" : `Confirmer l'envoi à ${targetCount ?? 0}`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduledOpen} onOpenChange={setScheduledOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Diffusions planifiées</DialogTitle>
            <DialogDescription>Historique des envois planifiés pour votre sous-agence.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {scheduled.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune diffusion planifiée</p>
            ) : scheduled.map((s: any) => {
              const when = new Date(s.scheduled_at);
              const badge = s.status === "scheduled" ? "secondary" : s.status === "sent" ? "default" : "destructive";
              const label = s.status === "scheduled" ? "Planifié" : s.status === "sent" ? "Envoyé" : s.status === "cancelled" ? "Annulé" : "Échec";
              return (
                <div key={s.id} className="rounded-xl border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm font-medium">
                      {s.trips?.departure} → {s.trips?.destination}
                      <span className="text-xs text-muted-foreground ml-2">
                        {s.trips?.date} {s.trips?.departure_time}
                      </span>
                    </div>
                    <Badge variant={badge as any}>{label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Prévu : {when.toLocaleString("fr-FR")}
                    {s.sent_at && ` · Envoyé : ${new Date(s.sent_at).toLocaleString("fr-FR")} · ${s.recipients_count ?? 0} destinataire(s)`}
                  </div>
                  {s.extra_message && <div className="text-xs italic text-muted-foreground">« {s.extra_message} »</div>}
                  {s.failure_reason && <div className="text-xs text-destructive">{s.failure_reason}</div>}
                  <div className="pt-1 flex flex-wrap gap-2">
                    {s.status === "scheduled" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEditScheduled(s, "edit")}>Modifier</Button>
                        <Button variant="outline" size="sm" onClick={() => openEditScheduled(s, "duplicate")}>Dupliquer</Button>
                        <Button variant="outline" size="sm" onClick={() => cancelScheduled(s.id)}>Annuler l'envoi</Button>
                      </>
                    )}
                    {s.status !== "scheduled" && (
                      <Button variant="outline" size="sm" onClick={() => openEditScheduled(s, "duplicate")}>Dupliquer</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={loadScheduled}>Actualiser</Button>
            <Button size="sm" onClick={() => setScheduledOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) { setEditItem(null); setEditConfirmOpen(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode === "edit" ? "Modifier la diffusion planifiée" : "Dupliquer la diffusion"}</DialogTitle>
            <DialogDescription>
              {editMode === "edit"
                ? "Modifiez la date/heure et le message avant l'envoi."
                : "Créez une nouvelle diffusion planifiée basée sur celle-ci."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {editItem?.trips && (
              <div className="text-xs text-muted-foreground">
                Trajet : <strong>{editItem.trips.departure} → {editItem.trips.destination}</strong>
                {" · "}{editItem.trips.date} · {editItem.trips.departure_time}
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Date et heure d'envoi</label>
              <input
                type="datetime-local"
                value={editAt}
                onChange={(e) => setEditAt(e.target.value)}
                className="w-full rounded-xl bg-secondary text-secondary-foreground px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Message additionnel (optionnel)</label>
              <textarea
                value={editMsg}
                onChange={(e) => setEditMsg(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-secondary text-secondary-foreground px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} disabled={editSaving}>Annuler</Button>
            <Button onClick={() => setEditConfirmOpen(true)} disabled={editSaving || !editAt}>
              {editMode === "edit" ? "Enregistrer" : "Planifier la copie"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer</DialogTitle>
            <DialogDescription>
              {editMode === "edit"
                ? <>La diffusion sera envoyée le <strong>{editAt ? new Date(editAt).toLocaleString("fr-FR") : ""}</strong>. Confirmer les modifications ?</>
                : <>Une nouvelle diffusion sera planifiée pour le <strong>{editAt ? new Date(editAt).toLocaleString("fr-FR") : ""}</strong>. Confirmer ?</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditConfirmOpen(false)} disabled={editSaving}>Retour</Button>
            <Button onClick={submitEditScheduled} disabled={editSaving}>
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerBoarding;
