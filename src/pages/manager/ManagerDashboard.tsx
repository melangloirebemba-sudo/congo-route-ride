import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Ticket, Bus, Wallet, CheckCircle, Globe } from "lucide-react";
import { Link } from "react-router-dom";

const ManagerDashboard = () => {
  const { manager } = useAuth();
  const [stats, setStats] = useState({ bookings: 0, revenue: 0, tripsToday: 0, checkedIn: 0, onlineToday: 0 });
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

      const onlineQ = manager.branch_id
        ? (supabase as any)
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("sale_channel", "online")
            .eq("boarding_branch_id", manager.branch_id)
            .gte("created_at", `${today}T00:00:00`)
            .lte("created_at", `${today}T23:59:59`)
        : Promise.resolve({ count: 0 });

      const [{ data: ag }, { data: br }, { data: trips }, { data: bookings }, onlineRes] = await Promise.all([
        supabase.from("agencies").select("name").eq("id", manager.agency_id).maybeSingle(),
        manager.branch_id
          ? supabase.from("agency_branches" as any).select("name, city").eq("id", manager.branch_id).maybeSingle()
          : Promise.resolve({ data: null }),
        tripsQ,
        bkQ,
        onlineQ,
      ]);
      setAgencyName(ag?.name || "");
      setBranchName(br ? `${(br as any).name}${(br as any).city ? " — " + (br as any).city : ""}` : null);
      const bks = bookings || [];
      setStats({
        bookings: bks.length,
        revenue: bks.reduce((s: number, b: any) => s + (b.total_amount || 0), 0),
        tripsToday: (trips || []).length,
        checkedIn: bks.filter((b: any) => b.status === "used").length,
        onlineToday: (onlineRes as any)?.count || 0,
      });
    })();
  }, [manager]);

  const cards = [
    { label: "Réservations du jour", value: stats.bookings, icon: Ticket, color: "text-primary", to: "/manager/bookings" },
    { label: "Ventes en ligne aujourd'hui", value: stats.onlineToday, icon: Globe, color: "text-primary", to: "/manager/online-sales" },
    { label: "Recettes du jour", value: `${stats.revenue.toLocaleString()} FCFA`, icon: Wallet, color: "text-accent", to: "/manager/sale" },
    { label: "Trajets aujourd'hui", value: stats.tripsToday, icon: Bus, color: "text-primary", to: "/manager/trips" },
    { label: "Embarqués", value: stats.checkedIn, icon: CheckCircle, color: "text-accent", to: "/manager/boarding" },
  ];


  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Bonjour {manager?.full_name?.split(" ")[0] || ""} 👋</h1>
        <p className="text-sm text-muted-foreground">
          {agencyName}{branchName ? ` · ${branchName}` : " · Aucune branche assignée"}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(({ label, value, icon: Icon, color, to }) => (
          <Link to={to} key={label}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4">
                <Icon className={`h-5 w-5 mb-2 ${color}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-display text-xl font-bold">{value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ManagerDashboard;
