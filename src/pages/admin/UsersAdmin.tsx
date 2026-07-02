import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield, User, Search, Ban, CheckCircle2, Trash2, KeyRound, Mail,
  MoreHorizontal, RefreshCcw, Loader2, Download, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type AdminUser = {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  status: "active" | "disabled" | "pending";
  roles: string[];
  agency: { id: string; name: string; status: string } | null;
  manager: { agency_id: string; branch_id: string | null; full_name: string | null } | null;
  full_name: string | null;
};

const StatusBadge = ({ status }: { status: AdminUser["status"] }) => {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Actif", className: "bg-green-500/10 text-green-600 border-green-500/30" },
    disabled: { label: "Désactivé", className: "bg-destructive/10 text-destructive border-destructive/30" },
    pending: { label: "En attente", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  };
  const s = map[status] ?? map.pending;
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
};

const RoleTag = ({ user }: { user: AdminUser }) => {
  if (user.roles.includes("admin")) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
        <Shield className="h-3 w-3" /> Administrateur
      </span>
    );
  }
  if (user.agency) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <User className="h-3 w-3" /> Agence · {user.agency.name}
      </span>
    );
  }
  if (user.manager) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <User className="h-3 w-3" /> Gestionnaire
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Client</span>;
};

const UsersAdmin = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [confirm, setConfirm] = useState<
    | { kind: "disable" | "enable" | "delete" | "reset"; user: AdminUser }
    | null
  >(null);
  const [pwdDialog, setPwdDialog] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "list", perPage: 200 },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Erreur de chargement");
      return;
    }
    setUsers((data as any).users || []);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSelfId(data.user?.id ?? null));
    fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (roleFilter !== "all") {
        const role =
          u.roles.includes("admin")
            ? "admin"
            : u.agency
              ? "agency"
              : u.manager
                ? "manager"
                : "client";
        if (role !== roleFilter) return false;
      }
      if (!q) return true;
      return (
        (u.email || "").toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.agency?.name || "").toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [users, search, statusFilter, roleFilter]);

  useEffect(() => { setPage(1); }, [search, statusFilter, roleFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  const exportCsv = () => {
    if (filtered.length === 0) { toast.error("Aucun compte à exporter"); return; }
    const headers = [
      "id", "email", "phone", "full_name", "role", "agency", "status",
      "email_confirmed_at", "last_sign_in_at", "created_at",
    ];
    const roleOf = (u: AdminUser) =>
      u.roles.includes("admin") ? "admin"
      : u.agency ? "agency"
      : u.manager ? "manager"
      : "client";
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filtered.map((u) => [
      u.id, u.email ?? "", u.phone ?? "", u.full_name ?? "",
      roleOf(u), u.agency?.name ?? "", u.status,
      u.email_confirmed_at ?? "", u.last_sign_in_at ?? "", u.created_at,
    ].map(esc).join(","));
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comptes_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} compte(s) exporté(s)`);
  };


  const callAction = async (payload: Record<string, unknown>, user: AdminUser) => {
    setBusyId(user.id);
    const { data, error } = await supabase.functions.invoke("admin-users", { body: payload });
    setBusyId(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Action échouée");
      return false;
    }
    toast.success((data as any)?.message || "OK");
    await fetchUsers();
    return true;
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, user } = confirm;
    if (kind === "disable") await callAction({ action: "disable", user_id: user.id }, user);
    if (kind === "enable") await callAction({ action: "enable", user_id: user.id }, user);
    if (kind === "delete") await callAction({ action: "delete", user_id: user.id }, user);
    if (kind === "reset")
      await callAction(
        {
          action: "reset_password",
          user_id: user.id,
          redirect_to: `${window.location.origin}/reset-password`,
        },
        user,
      );
    setConfirm(null);
  };

  const applyPassword = async () => {
    if (!pwdDialog) return;
    if (newPassword.length < 8) { toast.error("Minimum 8 caractères"); return; }
    const ok = await callAction(
      { action: "set_password", user_id: pwdDialog.id, password: newPassword },
      pwdDialog,
    );
    if (ok) { setPwdDialog(null); setNewPassword(""); }
  };

  const setRole = async (user: AdminUser, role: string | null) => {
    await callAction({ action: "set_role", user_id: user.id, role }, user);
  };

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      disabled: users.filter((u) => u.status === "disabled").length,
      admins: users.filter((u) => u.roles.includes("admin")).length,
    }),
    [users],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Gestion des comptes</h1>
          <p className="text-sm text-muted-foreground">
            Tous les comptes du système : statut, rôles et actions administrateur.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={loading || filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV ({filtered.length})
          </Button>
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total },
          { label: "Actifs", value: stats.active },
          { label: "Désactivés", value: stats.disabled },
          { label: "Administrateurs", value: stats.admins },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold font-display">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (email, nom, agence, ID)"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="disabled">Désactivés</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="admin">Administrateurs</SelectItem>
                <SelectItem value="agency">Agences</SelectItem>
                <SelectItem value="manager">Gestionnaires</SelectItem>
                <SelectItem value="client">Clients</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Rôle / Rattachement</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Chargement…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucun compte
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.email || u.phone || u.id.slice(0, 8)}</div>
                        {u.full_name && (
                          <div className="text-xs text-muted-foreground">{u.full_name}</div>
                        )}
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {u.id.slice(0, 8)}…
                        </div>
                      </TableCell>
                      <TableCell><RoleTag user={u} /></TableCell>
                      <TableCell><StatusBadge status={u.status} /></TableCell>
                      <TableCell className="text-xs">
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleString("fr")
                          : <span className="text-muted-foreground">Jamais</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" disabled={busyId === u.id}>
                              {busyId === u.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 bg-popover">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setConfirm({ kind: "reset", user: u })}>
                              <Mail className="h-4 w-4 mr-2" /> Envoyer lien de réinit.
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setPwdDialog(u); setNewPassword(""); }}>
                              <KeyRound className="h-4 w-4 mr-2" /> Définir un mot de passe
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.status === "disabled" ? (
                              <DropdownMenuItem onClick={() => setConfirm({ kind: "enable", user: u })}>
                                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> Réactiver
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={u.id === selfId}
                                onClick={() => setConfirm({ kind: "disable", user: u })}
                              >
                                <Ban className="h-4 w-4 mr-2" /> Désactiver
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs">Rôle</DropdownMenuLabel>
                            {u.roles.includes("admin") ? (
                              <DropdownMenuItem
                                disabled={u.id === selfId}
                                onClick={() => setRole(u, null)}
                              >
                                Retirer le rôle admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setRole(u, "admin")}>
                                <Shield className="h-4 w-4 mr-2" /> Promouvoir admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={u.id === selfId}
                              className="text-destructive focus:text-destructive"
                              onClick={() => setConfirm({ kind: "delete", user: u })}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Supprimer le compte
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
            <div className="text-muted-foreground">
              {filtered.length === 0
                ? "Aucun résultat"
                : `Affichage ${pageStart + 1}–${Math.min(pageStart + pageSize, filtered.length)} sur ${filtered.length}`}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Lignes</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 ml-2">
                <Button size="icon" variant="outline" className="h-8 w-8"
                  onClick={() => setPage(1)} disabled={currentPage === 1}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button size="icon" variant="outline" className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8"
                  onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete" && "Supprimer ce compte ?"}
              {confirm?.kind === "disable" && "Désactiver ce compte ?"}
              {confirm?.kind === "enable" && "Réactiver ce compte ?"}
              {confirm?.kind === "reset" && "Envoyer un lien de réinitialisation ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.user.email || confirm?.user.id}
              {confirm?.kind === "delete" && " — cette action est irréversible."}
              {confirm?.kind === "disable" && " — l'utilisateur ne pourra plus se connecter."}
              {confirm?.kind === "reset" && " — un email sera envoyé à l'utilisateur."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={runConfirm}
              className={confirm?.kind === "delete" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!pwdDialog} onOpenChange={(o) => !o && setPwdDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Définir un mot de passe</DialogTitle>
            <DialogDescription>
              {pwdDialog?.email} — l'utilisateur devra le changer à la prochaine connexion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nouveau mot de passe</Label>
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 caractères"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewPassword(Math.random().toString(36).slice(-10) + "A1!")}
            >
              Générer
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwdDialog(null)}>Annuler</Button>
            <Button onClick={applyPassword}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersAdmin;
