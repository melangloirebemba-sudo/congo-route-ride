import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bus, Ticket, TrendingUp, Calendar, Building2,
  PlusCircle, ShoppingCart, QrCode, Settings,
  FileDown, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import jsPDF from "jspdf";
import { toast } from "sonner";

type SaleRow = {
  booking_date: string;
  total_amount: number;
  status: string;
  passenger_name: string;
  trips: { agency_id: string; departure: string; destination: string; branch_id: string | null } | null;
};

type BranchInfo = { id: string; name: string; city: string | null };


const todayISO = () => new Date().toISOString().split("T")[0];
const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};

const AgencyDashboard = () => {
  const { agencyId, isManager } = useAuth();
  const [stats, setStats] = useState({ trips: 0, bookings: 0, revenue: 0, todayBookings: 0, branches: 0 });
  const [allBookings, setAllBookings] = useState<SaleRow[]>([]);
  const [recentBookings, setRecentBookings] = useState<SaleRow[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [agencyName, setAgencyName] = useState("");
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());

  useEffect(() => {
    if (!agencyId) return;

    const fetchData = async () => {
      const [agencyRes, tripsRes, bookingsRes, branchesRes] = await Promise.all([
        supabase.from("agencies").select("name").eq("id", agencyId).single(),
        supabase.from("trips").select("id").eq("agency_id", agencyId),
        supabase
          .from("bookings")
          .select("total_amount, booking_date, passenger_name, status, trips!inner(agency_id, departure, destination, branch_id)")
          .eq("trips.agency_id", agencyId)
          .order("booking_date", { ascending: false }),
        supabase.from("agency_branches" as any).select("id, name, city").eq("agency_id", agencyId),
      ]);

      setAgencyName(agencyRes.data?.name || "");
      const trips = tripsRes.data || [];
      const bookings = (bookingsRes.data || []) as unknown as SaleRow[];
      const branchList = ((branchesRes.data as any) || []) as BranchInfo[];
      const today = todayISO();

      setStats({
        trips: trips.length,
        bookings: bookings.length,
        revenue: bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + Number(b.total_amount || 0), 0),
        todayBookings: bookings.filter((b) => b.booking_date === today).length,
        branches: branchList.length,
      });

      setAllBookings(bookings);
      setRecentBookings(bookings.slice(0, 5));
      setBranches(branchList);
    };

    fetchData();
  }, [agencyId]);


  const cards = [
    { label: "Sous-agences", value: stats.branches, icon: Building2, color: "text-primary", to: "/agency/sub-agencies" },
    { label: "Trajets actifs", value: stats.trips, icon: Bus, color: "text-primary", to: "/agency/trips" },
    { label: "Réservations", value: stats.bookings, icon: Ticket, color: "text-accent", to: "/agency/bookings" },
    { label: "Revenus", value: `${stats.revenue.toLocaleString()} FCFA`, icon: TrendingUp, color: "text-accent", to: "/agency/bookings" },
    { label: "Aujourd'hui", value: stats.todayBookings, icon: Calendar, color: "text-primary", to: "/agency/bookings?today=1" },
  ];

  const quickActions = [
    { label: "Créer un trajet", icon: PlusCircle, to: "/agency/trips?new=1", color: "text-primary" },
    { label: "Ventes du jour", icon: ShoppingCart, to: "/agency/bookings?today=1", color: "text-accent" },
    { label: "Scanner", icon: QrCode, to: "/admin/scan", color: "text-primary" },
    { label: "Réglages", icon: Settings, to: "/agency/settings", color: "text-muted-foreground" },
  ];

  // Sales in [from, to] grouped by trip route
  const periodSales = useMemo(() => {
    const rows = allBookings.filter(
      (b) => b.status !== "cancelled" && b.booking_date >= from && b.booking_date <= to,
    );
    const byTrip = new Map<string, { route: string; count: number; total: number }>();
    let total = 0;
    let count = 0;
    rows.forEach((b) => {
      const route = b.trips ? `${b.trips.departure} → ${b.trips.destination}` : "—";
      const cur = byTrip.get(route) || { route, count: 0, total: 0 };
      cur.count++;
      cur.total += Number(b.total_amount || 0);
      byTrip.set(route, cur);
      total += Number(b.total_amount || 0);
      count++;
    });
    return { rows, byTrip: [...byTrip.values()].sort((a, b) => b.total - a.total), total, count };
  }, [allBookings, from, to]);

  // Sales per branch (sub-agency) — main agency = rows without branch_id
  const branchSales = useMemo(() => {
    const map = new Map<string, { name: string; city: string | null; count: number; total: number }>();
    map.set("__main__", { name: "Agence principale (siège)", city: null, count: 0, total: 0 });
    branches.forEach((b) => map.set(b.id, { name: b.name, city: b.city, count: 0, total: 0 }));
    periodSales.rows.forEach((b) => {
      const key = b.trips?.branch_id || "__main__";
      const cur = map.get(key) || { name: "Sous-agence supprimée", city: null, count: 0, total: 0 };
      cur.count++;
      cur.total += Number(b.total_amount || 0);
      map.set(key, cur);
    });
    return [...map.values()].filter((r) => r.count > 0).sort((a, b) => b.total - a.total);
  }, [periodSales.rows, branches]);


  const exportCSV = () => {
    if (periodSales.byTrip.length === 0) {
      toast.info("Aucune vente sur la période sélectionnée");
      return;
    }
    const header = ["Trajet", "Nombre de ventes", "Total (FCFA)"];
    const lines = [header.join(";")];
    periodSales.byTrip.forEach((r) => {
      lines.push([`"${r.route}"`, r.count, r.total].join(";"));
    });
    lines.push(["TOTAL", periodSales.count, periodSales.total].join(";"));
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventes_${agencyName || "agence"}_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  const exportPDF = () => {
    if (periodSales.byTrip.length === 0) {
      toast.info("Aucune vente sur la période sélectionnée");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Récapitulatif des ventes", 14, 18);
    doc.setFontSize(10);
    doc.text(`Agence : ${agencyName || "—"}`, 14, 26);
    doc.text(`Période : ${from}  →  ${to}`, 14, 32);

    let y = 44;
    doc.setFont("helvetica", "bold");
    doc.text("Trajet", 14, y);
    doc.text("Ventes", 130, y, { align: "right" });
    doc.text("Total (FCFA)", 195, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.line(14, y + 2, 195, y + 2);
    y += 8;

    periodSales.byTrip.forEach((r) => {
      if (y > 275) { doc.addPage(); y = 20; }
      const route = r.route.length > 60 ? r.route.slice(0, 57) + "..." : r.route;
      doc.text(route, 14, y);
      doc.text(String(r.count), 130, y, { align: "right" });
      doc.text(r.total.toLocaleString(), 195, y, { align: "right" });
      y += 7;
    });

    y += 4;
    doc.line(14, y, 195, y);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", 14, y);
    doc.text(String(periodSales.count), 130, y, { align: "right" });
    doc.text(`${periodSales.total.toLocaleString()} FCFA`, 195, y, { align: "right" });

    doc.save(`ventes_${agencyName || "agence"}_${from}_${to}.pdf`);
    toast.success("Export PDF téléchargé");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Bienvenue, {agencyName}</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble de votre activité</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(({ label, value, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="block">
            <Card className="transition-all hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-display">{value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Actions rapides</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map(({ label, icon: Icon, to, color }) => (
            <Link key={label} to={to} className="block">
              <Card className="transition-all hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer h-full">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <p className="font-medium text-sm">{label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg">Récapitulatif des ventes</CardTitle>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="from" className="text-xs">Du</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
              </div>
              <div>
                <Label htmlFor="to" className="text-xs">Au</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <FileDown className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button size="sm" onClick={exportPDF}>
                <FileText className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">Ventes sur la période</p>
              <p className="text-lg font-bold font-display">{periodSales.count}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">Total encaissé</p>
              <p className="text-lg font-bold font-display">{periodSales.total.toLocaleString()} FCFA</p>
            </div>
          </div>
          {periodSales.byTrip.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune vente sur la période sélectionnée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2">Trajet</th>
                    <th className="py-2 text-right">Ventes</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {periodSales.byTrip.slice(0, 8).map((r) => (
                    <tr key={r.route} className="border-b last:border-0">
                      <td className="py-2">{r.route}</td>
                      <td className="py-2 text-right">{r.count}</td>
                      <td className="py-2 text-right font-medium">{r.total.toLocaleString()} FCFA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Dernières réservations</CardTitle></CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune réservation</p>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((b: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="font-medium text-sm">{b.passenger_name}</p>
                    <p className="text-xs text-muted-foreground">{b.trips?.departure} → {b.trips?.destination}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{Number(b.total_amount).toLocaleString()} FCFA</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      b.status === "confirmed" ? "bg-accent/20 text-accent" :
                      b.status === "cancelled" ? "bg-destructive/20 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgencyDashboard;
