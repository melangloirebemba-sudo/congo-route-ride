import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Trash2, Plus, Search, Edit, Eye, Bus, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tables } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { ListPagination, usePagination } from "@/components/ListPagination";
import { LogoUploader, AgencyLogo } from "@/components/LogoUploader";


type Agency = Tables<"agencies">;

const AgenciesAdmin = () => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newAgency, setNewAgency] = useState({ name: "", email: "", password: "", phone: "", address: "", commission_rate: "10", logo: "" as string | null });
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAgency, setEditAgency] = useState<Agency | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailAgency, setDetailAgency] = useState<Agency | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [agencyTrips, setAgencyTrips] = useState<any[]>([]);
  const [agencyStats, setAgencyStats] = useState<{ bookings: number; revenue: number }>({ bookings: 0, revenue: 0 });

  const fetchAgencies = async () => {
    const { data } = await supabase.from("agencies").select("*").order("created_at", { ascending: false });
    setAgencies(data || []);
  };

  useEffect(() => { fetchAgencies(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("agencies").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Agence ${status === "active" ? "activée" : status === "suspended" ? "suspendue" : "mise en attente"}`);
    fetchAgencies();
  };

  const togglePopular = async (a: Agency, value: boolean) => {
    const { error } = await supabase.from("agencies").update({ is_popular: value }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(value ? "Ajoutée aux agences populaires" : "Retirée des agences populaires");
    fetchAgencies();
  };

  const updateRank = async (id: string, rank: number | null) => {
    const { error } = await supabase.from("agencies").update({ popularity_rank: rank }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    fetchAgencies();
  };

  const deleteAgency = async (id: string) => {
    if (!confirm("Supprimer cette agence ? Toutes les données associées seront perdues.")) return;
    const { error } = await supabase.from("agencies").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Agence supprimée");
    fetchAgencies();
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    setNewAgency(prev => ({ ...prev, password: p }));
  };

  const createAgency = async () => {
    if (!newAgency.name || !newAgency.email || !newAgency.password) {
      toast.error("Nom, email et mot de passe sont requis");
      return;
    }
    if (newAgency.password.length < 8) {
      toast.error("Le mot de passe doit faire au moins 8 caractères");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-agency-account", {
      body: {
        name: newAgency.name,
        email: newAgency.email,
        password: newAgency.password,
        phone: newAgency.phone || null,
        address: newAgency.address || null,
        commission_rate: parseFloat(newAgency.commission_rate) || 10,
        logo: newAgency.logo || null,

      },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Erreur lors de la création");
      return;
    }
    toast.success("Compte agence créé");
    setCreatedCreds({ email: newAgency.email, password: newAgency.password });
    setNewAgency({ name: "", email: "", password: "", phone: "", address: "", commission_rate: "10", logo: "" });
    setDialogOpen(false);
    fetchAgencies();
  };

  const saveEdit = async () => {
    if (!editAgency) return;
    const { error } = await supabase.from("agencies").update({
      name: editAgency.name,
      email: editAgency.email,
      phone: editAgency.phone,
      address: editAgency.address,
      commission_rate: editAgency.commission_rate,
      logo: editAgency.logo,
    }).eq("id", editAgency.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Agence mise à jour");
    setEditDialogOpen(false);
    setEditAgency(null);
    fetchAgencies();
  };

  const viewDetails = async (agency: Agency) => {
    setDetailAgency(agency);
    setDetailDialogOpen(true);
    
    const [tripsRes, bookingsRes] = await Promise.all([
      supabase.from("trips").select("*").eq("agency_id", agency.id).order("date", { ascending: false }).limit(10),
      supabase.from("bookings").select("total_amount, trips!inner(agency_id)").eq("trips.agency_id", agency.id),
    ]);
    
    setAgencyTrips(tripsRes.data || []);
    const bookings = bookingsRes.data || [];
    setAgencyStats({
      bookings: bookings.length,
      revenue: bookings.reduce((s, b) => s + b.total_amount, 0),
    });
  };

  const filtered = agencies.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const pg = usePagination(filtered, 5, [search, statusFilter], { paramKey: "" });
  const tripsPg = usePagination(agencyTrips, 5, [agencyTrips], { paramKey: "trips" });


  const statusBadge = (status: string) => {
    const labels: Record<string, string> = {
      active: "Active",
      pending: "En attente",
      pending_setup: "À compléter",
      pending_review: "À valider",
      suspended: "Suspendue",
    };
    const styles: Record<string, string> = {
      active: "bg-accent/20 text-accent",
      pending: "bg-warning/20 text-warning-foreground",
      pending_setup: "bg-muted text-muted-foreground",
      pending_review: "bg-primary/20 text-primary",
      suspended: "bg-destructive/20 text-destructive",
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || ""}`}>{labels[status] || status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Gestion des agences</h1>
          <p className="text-sm text-muted-foreground">{agencies.length} agences • {agencies.filter(a => a.status === "active").length} actives</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un compte agence</DialogTitle>
              <p className="text-xs text-muted-foreground pt-1">L'agence se connectera avec l'email et le mot de passe ci-dessous, puis complètera son profil avant validation.</p>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input placeholder="Nom de l'agence *" value={newAgency.name} onChange={e => setNewAgency(p => ({ ...p, name: e.target.value }))} />
              <LogoUploader value={newAgency.logo} name={newAgency.name} onChange={(v) => setNewAgency(p => ({ ...p, logo: v || "" }))} />
              <Input placeholder="Email de connexion *" type="email" value={newAgency.email} onChange={e => setNewAgency(p => ({ ...p, email: e.target.value }))} />

              <div className="flex gap-2">
                <Input placeholder="Mot de passe temporaire *" value={newAgency.password} onChange={e => setNewAgency(p => ({ ...p, password: e.target.value }))} />
                <Button type="button" variant="outline" onClick={generatePassword}>Générer</Button>
              </div>
              <Input placeholder="Téléphone" value={newAgency.phone} onChange={e => setNewAgency(p => ({ ...p, phone: e.target.value }))} />
              <Input placeholder="Adresse" value={newAgency.address} onChange={e => setNewAgency(p => ({ ...p, address: e.target.value }))} />
              <Input placeholder="Commission (%)" type="number" value={newAgency.commission_rate} onChange={e => setNewAgency(p => ({ ...p, commission_rate: e.target.value }))} />
              <Button onClick={createAgency} disabled={creating} className="w-full gradient-primary text-primary-foreground">
                {creating ? "Création..." : "Créer le compte"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Credentials display dialog */}
      <Dialog open={!!createdCreds} onOpenChange={(o) => !o && setCreatedCreds(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Identifiants de connexion</DialogTitle></DialogHeader>
          {createdCreds && (
            <div className="space-y-3 pt-2 text-sm">
              <p className="text-muted-foreground">Communiquez ces identifiants à l'agence. Ils ne seront plus affichés après fermeture.</p>
              <div className="p-3 rounded-lg bg-secondary/50 space-y-2 font-mono text-xs">
                <div><span className="text-muted-foreground">Email :</span> {createdCreds.email}</div>
                <div><span className="text-muted-foreground">Mot de passe :</span> {createdCreds.password}</div>
              </div>
              <Button className="w-full" onClick={() => {
                navigator.clipboard.writeText(`Email: ${createdCreds.email}\nMot de passe: ${createdCreds.password}`);
                toast.success("Copié dans le presse-papier");
              }}>Copier</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher une agence..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending_setup">À compléter</SelectItem>
            <SelectItem value="pending_review">À valider</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspendue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agence</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Populaire</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune agence trouvée</TableCell>
                  </TableRow>
                ) : (
                  pg.paginated.map(agency => (
                    <TableRow key={agency.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AgencyLogo logo={agency.logo} name={agency.name} className="h-8 w-8" />
                          <div>
                            <p className="font-display font-semibold text-sm">{agency.name}</p>
                            <p className="text-xs text-muted-foreground">{agency.address || "—"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{agency.email || "—"}</p>
                        <p className="text-xs text-muted-foreground">{agency.phone || "—"}</p>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-sm">{agency.commission_rate}%</span>
                      </TableCell>
                      <TableCell>{statusBadge(agency.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!!(agency as any).is_popular}
                            disabled={agency.status !== "active"}
                            onCheckedChange={(v) => togglePopular(agency, v)}
                          />
                          {(agency as any).is_popular && (
                            <Input
                              type="number"
                              className="h-8 w-16"
                              placeholder="Rang"
                              value={(agency as any).popularity_rank ?? ""}
                              onChange={(e) => {
                                const v = e.target.value === "" ? null : parseInt(e.target.value);
                                updateRank(agency.id, Number.isNaN(v as number) ? null : v);
                              }}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => viewDetails(agency)} title="Détails">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { setEditAgency({ ...agency }); setEditDialogOpen(true); }} title="Modifier">
                            <Edit className="h-4 w-4" />
                          </Button>
                          {agency.status !== "active" && (
                            <Button size="icon" variant="ghost" onClick={() => updateStatus(agency.id, "active")} title="Activer">
                              <Check className="h-4 w-4 text-accent" />
                            </Button>
                          )}
                          {agency.status !== "suspended" && (
                            <Button size="icon" variant="ghost" onClick={() => updateStatus(agency.id, "suspended")} title="Suspendre">
                              <X className="h-4 w-4 text-warning-foreground" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => deleteAgency(agency.id)} title="Supprimer">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ListPagination {...pg} className="pt-4" />
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'agence</DialogTitle></DialogHeader>
          {editAgency && (
            <div className="space-y-3 pt-2">
              <Input placeholder="Nom *" value={editAgency.name} onChange={e => setEditAgency(p => p ? { ...p, name: e.target.value } : null)} />
              <Input placeholder="Email" value={editAgency.email || ""} onChange={e => setEditAgency(p => p ? { ...p, email: e.target.value } : null)} />
              <Input placeholder="Téléphone" value={editAgency.phone || ""} onChange={e => setEditAgency(p => p ? { ...p, phone: e.target.value } : null)} />
              <Input placeholder="Adresse" value={editAgency.address || ""} onChange={e => setEditAgency(p => p ? { ...p, address: e.target.value } : null)} />
              <LogoUploader value={editAgency.logo} name={editAgency.name} onChange={(v) => setEditAgency(p => p ? { ...p, logo: v } : null)} />
              <Input placeholder="Commission (%)" type="number" value={editAgency.commission_rate ?? ""} onChange={e => setEditAgency(p => p ? { ...p, commission_rate: parseFloat(e.target.value) } : null)} />
              <Button onClick={saveEdit} className="w-full gradient-primary text-primary-foreground">Enregistrer</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Détails de l'agence</DialogTitle></DialogHeader>
          {detailAgency && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <AgencyLogo logo={detailAgency.logo} name={detailAgency.name} className="h-12 w-12" />
                <div>
                  <h3 className="font-display font-bold text-lg">{detailAgency.name}</h3>
                  {statusBadge(detailAgency.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">Réservations</p>
                  <p className="font-display font-bold text-lg">{agencyStats.bookings}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">Revenu total</p>
                  <p className="font-display font-bold text-lg">{agencyStats.revenue.toLocaleString()} FCFA</p>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Email:</span> {detailAgency.email || "—"}</p>
                <p><span className="text-muted-foreground">Téléphone:</span> {detailAgency.phone || "—"}</p>
                <p><span className="text-muted-foreground">Adresse:</span> {detailAgency.address || "—"}</p>
                <p><span className="text-muted-foreground">Commission:</span> {detailAgency.commission_rate}%</p>
                <p><span className="text-muted-foreground">Note:</span> {detailAgency.rating}/5</p>
              </div>

              {agencyTrips.length > 0 && (
                <div>
                  <h4 className="font-display font-semibold text-sm mb-2 flex items-center gap-1">
                    <Bus className="h-4 w-4" /> Derniers trajets
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {tripsPg.paginated.map(trip => (
                      <div key={trip.id} className="flex justify-between items-center p-2 rounded bg-secondary/30 text-sm">
                        <span>{trip.departure} → {trip.destination}</span>
                        <span className="text-xs text-muted-foreground">{trip.date} • {trip.price.toLocaleString()} FCFA</span>
                      </div>
                    ))}
                    <ListPagination {...tripsPg} className="pt-2" />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgenciesAdmin;
