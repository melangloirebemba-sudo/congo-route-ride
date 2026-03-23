import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CreditCard, TrendingUp, Users, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalAgencies: number;
  activeAgencies: number;
  totalBookings: number;
  totalRevenue: number;
  totalCommissions: number;
  pendingAgencies: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalAgencies: 0, activeAgencies: 0, totalBookings: 0,
    totalRevenue: 0, totalCommissions: 0, pendingAgencies: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [agencies, bookings, transactions] = await Promise.all([
        supabase.from("agencies").select("id, status"),
        supabase.from("bookings").select("id, total_amount, status"),
        supabase.from("transactions").select("amount, commission, status"),
      ]);

      const agencyData = agencies.data || [];
      const bookingData = bookings.data || [];
      const txData = transactions.data || [];

      setStats({
        totalAgencies: agencyData.length,
        activeAgencies: agencyData.filter(a => a.status === "active").length,
        pendingAgencies: agencyData.filter(a => a.status === "pending").length,
        totalBookings: bookingData.length,
        totalRevenue: txData.filter(t => t.status === "completed").reduce((s, t) => s + t.amount, 0),
        totalCommissions: txData.filter(t => t.status === "completed").reduce((s, t) => s + t.commission, 0),
      });
    };

    const fetchRecent = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, trips(departure, destination, date)")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentBookings(data || []);
    };

    fetchStats();
    fetchRecent();
  }, []);

  const cards = [
    { label: "Agences actives", value: stats.activeAgencies, total: stats.totalAgencies, icon: Building2, color: "text-primary" },
    { label: "Réservations", value: stats.totalBookings, icon: Ticket, color: "text-accent" },
    { label: "Revenus totaux", value: `${stats.totalRevenue.toLocaleString()} FCFA`, icon: TrendingUp, color: "text-success" },
    { label: "Commissions", value: `${stats.totalCommissions.toLocaleString()} FCFA`, icon: CreditCard, color: "text-warning" },
    { label: "En attente", value: stats.pendingAgencies, icon: Users, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Tableau de bord</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(({ label, value, total, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold font-display">{value}</div>
              {total !== undefined && (
                <p className="text-xs text-muted-foreground">sur {total} total</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Réservations récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune réservation pour le moment</p>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="font-medium text-sm">{b.passenger_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.trips?.departure} → {b.trips?.destination}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{b.total_amount.toLocaleString()} FCFA</p>
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

export default Dashboard;
