import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banknote, Wallet, TrendingUp, Building2, FileDown, Loader2, Smartphone, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Row = {
  id: string;
  total_amount: number;
  payment_method: string | null;
  payment_status: string | null;
  status: string;
  booking_date: string;
  sale_channel: string | null;
  boarding_branch_id: string | null;
  trips: { agency_id: string; branch_id: string | null } | null;
};

type BranchInfo = { id: string; name: string; city: string | null };

const MAIN = "__main__";

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthsAgoISO = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const isCash = (m: string | null) => (m || "").toLowerCase() === "cash" || (m || "").toLowerCase() === "espèces";
const isMomo = (m: string | null) => ["momo", "mtn", "airtel", "mobile_money", "mtn_momo", "airtel_money"].some((k) => (m || "").toLowerCase().includes(k));

const AgencyCashbox = () => {
  const { agencyId, manager, isManager } = useAuth();
  const managerBranch = (manager as any)?.branch_id as string | undefined;
  const [rows, setRows] = useState<Row[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [agencyName, setAgencyName] = useState("");
  const [commissionRate, setCommissionRate] = useState(10);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(monthsAgoISO(5));
  const [to, setTo] = useState(todayISO());
  const [branchFilter, setBranchFilter] = useState<string>("all");

  useEffect(() => {
    if (!agencyId) return;
    const load = async () => {
      setLoading(true);
      const [agencyRes, branchesRes, bookingsRes] = await Promise.all([
        supabase.from("agencies").select("name, commission_rate").eq("id", agencyId).maybeSingle(),
        supabase.from("agency_branches" as any).select("id, name, city").eq("agency_id", agencyId).order("name"),
        supabase
          .from("bookings")
          .select(
            "id, total_amount, payment_method, payment_status, status, booking_date, sale_channel, boarding_branch_id, trips!inner(agency_id, branch_id)",
          )
          .eq("trips.agency_id", agencyId)
          .order("booking_date", { ascending: false })
          .limit(5000),
      ]);
      setAgencyName((agencyRes.data as any)?.name || "");
      setCommissionRate(Number((agencyRes.data as any)?.commission_rate ?? 10));
      setBranches(((branchesRes.data as any) || []) as BranchInfo[]);
      setRows(((bookingsRes.data as any) || []) as Row[]);
      setLoading(false);
    };
    load();
  }, [agencyId]);

  const branchName = (id: string) =>
    id === MAIN ? "Agence principale (siège)" : branches.find((b) => b.id === id)?.name || "Sous-agence supprimée";

  const paid = useMemo(
    () =>
      rows.filter((r) => {
        if (r.status === "cancelled") return false;
        if ((r.payment_status || "") !== "paid") return false;
        if (r.booking_date < from || r.booking_date > to) return false;
        const key = r.boarding_branch_id || r.trips?.branch_id || MAIN;
        if (managerBranch && isManager && key !== managerBranch) return false;
        if (branchFilter !== "all" && key !== branchFilter) return false;
        return true;
      }),
    [rows, from, to, branchFilter, managerBranch, isManager],
  );

  const totals = useMemo(() => {
    let total = 0, cash = 0, momo = 0, card = 0, online = 0, counter = 0;
    paid.forEach((r) => {
      const a = Number(r.total_amount || 0);
      total += a;
      if (isCash(r.payment_method)) cash += a;
      else if (isMomo(r.payment_method)) momo += a;
      else card += a;
      if ((r.sale_channel || "") === "online") online += a;
      else counter += a;
    });
    const commission = (total * commissionRate) / 100;
    return { total, cash, momo, card, online, counter, commission, net: total - commission, count: paid.length };
  }, [paid, commissionRate]);

  const byBranch = useMemo(() => {
    const map = new Map<string, { id: string; count: number; total: number; cash: number }>();
    paid.forEach((r) => {
      const key = r.boarding_branch_id || r.trips?.branch_id || MAIN;
      const cur = map.get(key) || { id: key, count: 0, total: 0, cash: 0 };
      const a = Number(r.total_amount || 0);
      cur.count++;
      cur.total += a;
      if (isCash(r.payment_method)) cur.cash += a;
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [paid]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { ym: string; count: number; total: number; cash: number }>();
    paid.forEach((r) => {
      const ym = (r.booking_date || "").slice(0, 7);
      if (!ym) return;
      const cur = map.get(ym) || { ym, count: 0, total: 0, cash: 0 };
      const a = Number(r.total_amount || 0);
      cur.count++;
      cur.total += a;
      if (isCash(r.payment_method)) cur.cash += a;
      map.set(ym, cur);
    });
    return [...map.values()].sort((a, b) => (a.ym < b.ym ? 1 : -1));
  }, [paid]);

  const maxMonth = Math.max(1, ...byMonth.map((m) => m.total));

  const exportCSV = () => {
    if (paid.length === 0) {
      toast.info("Aucun encaissement sur la période");
      return;
    }
    const lines = ["Type;Libellé;Encaissements;Total (FCFA);Dont espèces (FCFA)"];
    byBranch.forEach((b) =>
      lines.push(["Sous-agence", `"${branchName(b.id)}"`, b.count, Math.round(b.total), Math.round(b.cash)].join(";")),
    );
    byMonth.forEach((m) =>
      lines.push(["Mois", `"${monthLabel(m.ym)}"`, m.count, Math.round(m.total), Math.round(m.cash)].join(";")),
    );
    lines.push(["TOTAL", '"Toutes caisses"', totals.count, Math.round(totals.total), Math.round(totals.cash)].join(";"));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caisse_${agencyName || "agence"}_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  const cards = [
    { label: "Revenus encaissés", value: fmt(totals.total), icon: TrendingUp, color: "text-accent" },
    { label: "Solde espèces (guichet)", value: fmt(totals.cash), icon: Banknote, color: "text-primary" },
    { label: "Mobile Money", value: fmt(totals.momo), icon: Smartphone, color: "text-accent" },
    { label: "Carte / autres", value: fmt(totals.card), icon: CreditCard, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Caisse</h1>
          <p className="text-sm text-muted-foreground">
            Revenus encaissés, répartition par sous-agence et par mois, solde espèces.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="cb-from" className="text-xs">Du</Label>
            <Input id="cb-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div>
            <Label htmlFor="cb-to" className="text-xs">Au</Label>
            <Input id="cb-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
          </div>
          {!isManager && (
            <div>
              <Label htmlFor="cb-branch" className="text-xs">Sous-agence</Label>
              <select
                id="cb-branch"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-9 rounded-2xl border border-input bg-background px-3 text-sm"
              >
                <option value="all">Toutes</option>
                <option value={MAIN}>Agence principale (siège)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <FileDown className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold font-display">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" /> Synthèse de la période
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { l: "Billets payés", v: String(totals.count) },
                { l: "Ventes au guichet", v: fmt(totals.counter) },
                { l: "Ventes en ligne", v: fmt(totals.online) },
                { l: `Net agence (après ${commissionRate}% de commission)`, v: fmt(totals.net) },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground">{s.l}</p>
                  <p className="text-base font-bold font-display">{s.v}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Revenus par sous-agence
              </CardTitle>
            </CardHeader>
            <CardContent>
              {byBranch.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun encaissement sur la période.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-2">Sous-agence</th>
                        <th className="py-2 text-right">Billets</th>
                        <th className="py-2 text-right">Total</th>
                        <th className="py-2 text-right">Solde espèces</th>
                        <th className="py-2 text-right">Part</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byBranch.map((b) => (
                        <tr key={b.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{branchName(b.id)}</td>
                          <td className="py-2 text-right">{b.count}</td>
                          <td className="py-2 text-right font-medium">{fmt(b.total)}</td>
                          <td className="py-2 text-right text-primary font-medium">{fmt(b.cash)}</td>
                          <td className="py-2 text-right text-muted-foreground">
                            {totals.total > 0 ? Math.round((b.total / totals.total) * 100) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenus par mois</CardTitle>
            </CardHeader>
            <CardContent>
              {byMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun encaissement sur la période.</p>
              ) : (
                <div className="space-y-3">
                  {byMonth.map((m) => (
                    <div key={m.ym} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{monthLabel(m.ym)}</span>
                        <span className="text-muted-foreground">
                          {m.count} billet(s) · <span className="font-semibold text-foreground">{fmt(m.total)}</span> · espèces {fmt(m.cash)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(m.total / maxMonth) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AgencyCashbox;
