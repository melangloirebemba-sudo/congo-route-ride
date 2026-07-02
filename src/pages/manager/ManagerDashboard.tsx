import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Ticket, Bus, Wallet, CheckCircle } from "lucide-react";

const ManagerDashboard = () => {
  const { manager } = useAuth();
  const [stats, setStats] = useState({ bookings: 0, revenue: 0, tripsToday: 0, checkedIn: 0 });
  const [agencyName, setAgencyName] = useState("");
  const [branchName, setBranchName] = useState<string | null>(null);

  useEffect(() => {
    if (!manager) return;
    (async () => {
      const today = new Date().toISOString().split("T")[0];

      let tripsQ = supabase.from("trips").select("id, date").eq("agency_id", manager.agency_id).eq("date", today);
      let bkQ = supabase
        .from("bookings")
        .select("id, total_amount, status, trips!inner(agency_id, branch_id, date)")
        .eq("trips.agency_id", manager.agency_id)
        .eq("trips.date", today);
      if (manager.branch_id) {
        tripsQ = tripsQ.eq("branch_id", manager.branch_id);
        bkQ = bkQ.eq("trips.branch_id", manager.branch_id);
      }

      const [{ data: ag }, { data: br }, { data: trips }, { data: bookings }] = await Promise.all([
        supabase.from("agencies").select("name").eq("id", manager.agency_id).maybeSingle(),
        manager.branch_id
          ? supabase.from("agency_branches" as any).select("name, city").eq("id", manager.branch_id).maybeSingle()
          : Promise.resolve({ data: null }),
        tripsQ,
        bkQ,
      ]);
      setAgencyName(ag?.name || "");
      setBranchName(br ? `${(br as any).name}${(br as any).city ? " — " + (br as any).city : ""}` : null);
      const bks = bookings || [];
      setStats({
        bookings: bks.length,
        revenue: bks.reduce((s: number, b: any) => s + (b.total_amount || 0), 0),
        tripsToday: (trips || []).length,
        checkedIn: bks.filter((b: any) => b.status === "used").length,
      });
    })();
  }, [manager]);

  const cards = [
    { label: "Réservations du jour", value: stats.bookings, icon: Ticket, color: "text-primary" },
    { label: "Recettes du jour", value: `${stats.revenue.toLocaleString()} FCFA`, icon: Wallet, color: "text-accent" },
    { label: "Trajets aujourd'hui", value: stats.tripsToday, icon: Bus, color: "text-primary" },
    { label: "Embarqués", value: stats.checkedIn, icon: CheckCircle, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Bonjour {manager?.full_name?.split(" ")[0] || ""} 👋</h1>
        <p className="text-sm text-muted-foreground">
          {agencyName}{branchName ? ` · ${branchName}` : " · Aucune branche assignée"}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <Icon className={`h-5 w-5 mb-2 ${color}`} />
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-display text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ManagerDashboard;
