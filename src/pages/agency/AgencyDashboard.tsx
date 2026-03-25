import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Ticket, TrendingUp, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const AgencyDashboard = () => {
  const { agencyId } = useAuth();
  const [stats, setStats] = useState({ trips: 0, bookings: 0, revenue: 0, todayBookings: 0 });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [agencyName, setAgencyName] = useState("");

  useEffect(() => {
    if (!agencyId) return;

    const fetchData = async () => {
      const [agencyRes, tripsRes, bookingsRes] = await Promise.all([
        supabase.from("agencies").select("name").eq("id", agencyId).single(),
        supabase.from("trips").select("id").eq("agency_id", agencyId),
        supabase.from("bookings").select("total_amount, booking_date, passenger_name, status, trips!inner(agency_id, departure, destination)").eq("trips.agency_id", agencyId),
      ]);

      setAgencyName(agencyRes.data?.name || "");
      const trips = tripsRes.data || [];
      const bookings = bookingsRes.data || [];
      const today = new Date().toISOString().split("T")[0];

      setStats({
        trips: trips.length,
        bookings: bookings.length,
        revenue: bookings.filter((b: any) => b.status !== "cancelled").reduce((s: number, b: any) => s + b.total_amount, 0),
        todayBookings: bookings.filter((b: any) => b.booking_date === today).length,
      });

      setRecentBookings(bookings.slice(0, 5));
    };

    fetchData();
  }, [agencyId]);

  const cards = [
    { label: "Trajets actifs", value: stats.trips, icon: Bus, color: "text-primary" },
    { label: "Réservations", value: stats.bookings, icon: Ticket, color: "text-accent" },
    { label: "Revenus", value: `${stats.revenue.toLocaleString()} FCFA`, icon: TrendingUp, color: "text-accent" },
    { label: "Aujourd'hui", value: stats.todayBookings, icon: Calendar, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Bienvenue, {agencyName}</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble de votre activité</p>
      </div>

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
              <div className="text-xl font-bold font-display">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

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

export default AgencyDashboard;
