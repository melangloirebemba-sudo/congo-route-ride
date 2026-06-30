import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Building2, MapPin } from "lucide-react";

type Branch = {
  id: string;
  agency_id: string;
  parent_branch_id: string | null;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  manager_name: string | null;
  status: string;
};

const emptyForm = {
  name: "",
  city: "",
  address: "",
  phone: "",
  manager_name: "",
  parent_branch_id: "none",
  status: "active",
};

const AgencyBranches = () => {
  const { agencyId } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const fetchBranches = async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("agency_branches" as any)
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setBranches((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBranches(); }, [agencyId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({
      name: b.name,
      city: b.city || "",
      address: b.address || "",
      phone: b.phone || "",
      manager_name: b.manager_name || "",
      parent_branch_id: b.parent_branch_id || "none",
      status: b.status,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!agencyId) return;
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }
    const payload = {
      agency_id: agencyId,
      name: form.name.trim(),
      city: form.city || null,
      address: form.address || null,
      phone: form.phone || null,
      manager_name: form.manager_name || null,
      parent_branch_id: form.parent_branch_id === "none" ? null : form.parent_branch_id,
      status: form.status,
    };
    const q = editing
      ? supabase.from("agency_branches" as any).update(payload).eq("id", editing.id)
      : supabase.from("agency_branches" as any).insert(payload);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Agence mise à jour" : "Agence créée");
    setDialogOpen(false);
    fetchBranches();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette agence ? Les sous-agences liées seront aussi supprimées.")) return;
    const { error } = await supabase.from("agency_branches" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Agence supprimée");
    fetchBranches();
  };

  const parentOptions = branches.filter(b => !editing || b.id !== editing.id);
  const parentName = (id: string | null) => id ? branches.find(b => b.id === id)?.name || "—" : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Mes agences</h1>
          <p className="text-sm text-muted-foreground">
            Créez vos agences régionales et sous-agences de quartier
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gradient-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" /> Nouvelle agence
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier l'agence" : "Créer une agence"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input placeholder="Nom (ex. Agence de Brazzaville) *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Ville (ex. Brazzaville)" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              <Input placeholder="Adresse (ex. Mafouta, Château d'eau...)" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              <Input placeholder="Téléphone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              <Input placeholder="Nom du responsable" value={form.manager_name} onChange={e => setForm(p => ({ ...p, manager_name: e.target.value }))} />
              <div>
                <label className="text-xs text-muted-foreground">Agence parente (laisser vide pour une agence principale)</label>
                <Select value={form.parent_branch_id} onValueChange={v => setForm(p => ({ ...p, parent_branch_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune (agence principale)</SelectItem>
                    {parentOptions.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.status === "active"} onCheckedChange={v => setForm(p => ({ ...p, status: v ? "active" : "inactive" }))} />
                <span className="text-sm">Active</span>
              </div>
              <Button onClick={save} className="w-full gradient-primary text-primary-foreground">
                {editing ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Chargement…</div>
          ) : branches.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="font-display font-semibold">Aucune agence</p>
              <p className="text-sm text-muted-foreground">Créez votre première agence régionale.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Ville / Adresse</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Rattachée à</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map(b => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {b.parent_branch_id ? <MapPin className="h-4 w-4 text-muted-foreground" /> : <Building2 className="h-4 w-4 text-primary" />}
                          <span className="font-medium">{b.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{b.city || "—"}</div>
                        <div className="text-xs text-muted-foreground">{b.address || ""}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{b.manager_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{b.phone || ""}</div>
                      </TableCell>
                      <TableCell className="text-sm">{parentName(b.parent_branch_id)}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.status === "active" ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>
                          {b.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencyBranches;
