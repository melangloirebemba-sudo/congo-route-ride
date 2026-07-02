import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Copy, UserCog, RefreshCw, Mail } from "lucide-react";

type Manager = {
  id: string;
  user_id: string;
  agency_id: string;
  branch_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
};

type Branch = { id: string; name: string; city: string | null };

const generatePassword = (len = 12) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const emptyForm = { email: "", full_name: "", phone: "", branch_id: "none", password: "" };

const AgencyManagers = () => {
  const { agencyId } = useAuth();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const fetchData = async () => {
    if (!agencyId) return;
    setLoading(true);
    const [{ data: mgrs, error: e1 }, { data: brs, error: e2 }] = await Promise.all([
      supabase
        .from("branch_managers" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("agency_branches" as any)
        .select("id,name,city")
        .eq("agency_id", agencyId)
        .order("name"),
    ]);
    if (e1) toast.error(e1.message);
    if (e2) toast.error(e2.message);
    setManagers((mgrs as any) || []);
    setBranches((brs as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [agencyId]);

  const openCreate = () => {
    setForm({ ...emptyForm, password: generatePassword() });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.email.trim() || !form.full_name.trim() || !form.password.trim()) {
      toast.error("Email, nom et mot de passe requis");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-branch-manager", {
      body: {
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone || undefined,
        branch_id: form.branch_id === "none" ? null : form.branch_id,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Erreur");
      return;
    }
    toast.success("Gestionnaire créé");
    setCredentials({ email: form.email.trim(), password: form.password });
    setDialogOpen(false);
    fetchData();
  };

  const remove = async (m: Manager) => {
    if (!confirm(`Retirer ${m.full_name} ?`)) return;
    const { error } = await supabase
      .from("branch_managers" as any)
      .delete()
      .eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Gestionnaire retiré");
    fetchData();
  };

  const sendReset = async (m: Manager) => {
    const { error } = await supabase.auth.resetPasswordForEmail(m.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Lien de réinitialisation envoyé à ${m.email}`);
  };

  const updateBranch = async (m: Manager, branch_id: string) => {
    const { error } = await supabase
      .from("branch_managers" as any)
      .update({ branch_id: branch_id === "none" ? null : branch_id })
      .eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Affectation mise à jour");
    fetchData();
  };

  const branchName = (id: string | null) => {
    if (!id) return "— Toutes les agences";
    const b = branches.find((x) => x.id === id);
    return b ? `${b.name}${b.city ? ` (${b.city})` : ""}` : "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" /> Gestionnaires
          </h1>
          <p className="text-sm text-muted-foreground">
            Créez des comptes pour gérer vos agences régionales.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Nouveau gestionnaire
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Créer un gestionnaire</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nom complet</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Agence affectée</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Toutes les agences</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}{b.city ? ` — ${b.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mot de passe provisoire</Label>
                <div className="flex gap-2">
                  <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <Button type="button" variant="outline" size="icon" onClick={() => setForm({ ...form, password: generatePassword() })}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Le gestionnaire devra le changer à sa première connexion.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {credentials && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <p className="font-semibold text-sm">Identifiants à transmettre au gestionnaire</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between gap-2 bg-background rounded px-3 py-2">
                <span className="truncate">{credentials.email}</span>
                <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(credentials.email); toast.success("Email copié"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2 bg-background rounded px-3 py-2">
                <code className="truncate">{credentials.password}</code>
                <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(credentials.password); toast.success("Mot de passe copié"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCredentials(null)}>Fermer</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Agence affectée</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : managers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun gestionnaire.</TableCell></TableRow>
              ) : managers.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.full_name}</TableCell>
                  <TableCell className="text-sm">{m.email}</TableCell>
                  <TableCell className="text-sm">{m.phone || "—"}</TableCell>
                  <TableCell>
                    <Select value={m.branch_id || "none"} onValueChange={(v) => updateBranch(m, v)}>
                      <SelectTrigger className="h-8 w-[220px]"><SelectValue>{branchName(m.branch_id)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Toutes les agences</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}{b.city ? ` — ${b.city}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Envoyer un lien de réinitialisation" onClick={() => sendReset(m)}>
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Retirer" onClick={() => remove(m)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencyManagers;
