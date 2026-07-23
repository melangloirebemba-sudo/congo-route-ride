import { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Bus, Ticket, QrCode, LogOut, PlusCircle, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const ManagerLayout = () => {
  const { user, loading, signOut, isManager, manager, managerPermissions } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!manager?.branch_id) { setUnread(0); return; }
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("branch_notifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("branch_id", manager.branch_id)
        .is("read_at", null);
      if (!cancelled) setUnread(count || 0);
    };
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [manager?.branch_id, location.pathname]);

  const navItems = [
    { to: "/manager", icon: LayoutDashboard, label: "Tableau de bord", end: true, show: true, badge: 0 },
    { to: "/manager/trips", icon: Bus, label: "Trajets", show: managerPermissions.can_create_trips, badge: 0 },
    { to: "/manager/bookings", icon: Ticket, label: "Réservations", show: true, badge: 0 },
    { to: "/manager/notifications", icon: Bell, label: "Notifications", show: true, badge: unread },
    { to: "/manager/sale", icon: PlusCircle, label: "Vente guichet", show: managerPermissions.can_sell_counter, badge: 0 },
    { to: "/manager/scan", icon: QrCode, label: "Scan billets", show: managerPermissions.can_scan, badge: 0 },
  ].filter(i => i.show);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isManager) return <Navigate to="/" replace />;


  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 bg-card border-r border-border hidden md:flex flex-col">
        <div className="p-5 border-b border-border">
          <h1 className="font-display text-lg font-bold text-gradient">Guichet</h1>
          <p className="text-xs text-muted-foreground">Espace gestionnaire</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end, badge }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                }`}>
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {badge > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{badge}</Badge>}
            </NavLink>
          ))}

        </nav>
        <div className="p-3 border-t border-border">
          <Button variant="ghost" onClick={signOut} className="w-full justify-start text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Déconnexion
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <h1 className="font-display text-lg font-bold text-gradient">Guichet</h1>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </header>
        <nav className="md:hidden flex overflow-x-auto border-b border-border bg-card px-2">
          {navItems.map(({ to, icon: Icon, label, end, badge }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium whitespace-nowrap ${
                  isActive ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
                }`}>
              <Icon className="h-4 w-4" />
              {label}
              {badge > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </NavLink>
          ))}

        </nav>
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ManagerLayout;
