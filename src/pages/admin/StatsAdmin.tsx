import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(24, 95%, 53%)", "hsl(160, 60%, 40%)", "hsl(45, 93%, 47%)", "hsl(0, 72%, 51%)"];

const StatsAdmin = () => {
  const [agencyStats, setAgencyStats] = useState<any[]>([]);
  const [statusStats, setStatusStats] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Bookings by agency
      const { data: bookings } = await supabase
        .from("bookings")
        .select("total_amount, status, trips(agency_id, agencies:agency_id(name))");

      const byAgency: Record<string, number> = {};
      const byStatus: Record<string, number> = {};

      (bookings || []).forEach((b: any) => {
        const name = b.trips?.agencies?.name || "Inconnu";
        byAgency[name] = (byAgency[name] || 0) + b.total_amount;
        byStatus[b.status] = (byStatus[b.status] || 0) + 1;
      });

      setAgencyStats(Object.entries(byAgency).map(([name, revenue]) => ({ name, revenue })));
      setStatusStats(Object.entries(byStatus).map(([name, value]) => ({ name, value })));
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Statistiques globales</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Revenus par agence</CardTitle></CardHeader>
          <CardContent>
            {agencyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agencyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} FCFA`} />
                  <Bar dataKey="revenue" fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">Pas de données</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Réservations par statut</CardTitle></CardHeader>
          <CardContent>
            {statusStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {statusStats.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">Pas de données</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatsAdmin;
