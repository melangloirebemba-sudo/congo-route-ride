import { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Bus, Ticket, QrCode, LogOut, PlusCircle, Bell, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { SignOutConfirm } from "@/components/SignOutConfirm";
import { NotificationsDrawer } from "@/components/NotificationsDrawer";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const ManagerLayout = () => {
  const { user, loading, signOut, isManager, manager, managerPermissions } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const branchId = manager?.branch_id;
    if (!branchId) { setUnread(0); return; }
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("branch_notifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId)
        .is("read_at", null);
      if (!cancelled) setUnread(count || 0);
    };
    load();
    const channel = supabase
      .channel(`branch-notifs-${branchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "branch_notifications", filter: `branch_id=eq.${branchId}` },
        () => load()
      )
      .subscribe();
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [manager?.branch_id, location.pathname]);

  const navItems = [
    { to: "/manager", icon: LayoutDashboard, label: "Tableau de bord", end: true, show: true, badge: 0 },
    { to: "/manager/trips", icon: Bus, label: "Trajets", show: true, badge: 0 },
    { to: "/manager/bookings", icon: Ticket, label: "Réservations", show: true, badge: 0 },
    { to: "/manager/notifications", icon: Bell, label: "Notifications", show: true, badge: unread },
    { to: "/manager/sale", icon: PlusCircle, label: "Vente guichet", show: managerPermissions.can_sell_counter, badge: 0 },
    { to: "/manager/scan", icon: QrCode, label: "Scan billets", show: managerPermissions.can_scan, badge: 0 },
    { to: "/manager/boarding", icon: ClipboardCheck, label: "Embarquement", show: true, badge: 0 },
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <ManagerSidebar navItems={navItems} onSignOut={signOut} />

        <div className="flex-1 flex flex-col min-w-0 h-screen">
          <header className="sticky top-0 z-30 h-14 flex items-center gap-2 px-3 md:px-4 border-b border-border bg-card shrink-0">
            <SidebarTrigger aria-label="Ouvrir ou fermer le menu de navigation" />
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-sm md:text-base font-bold text-gradient truncate">Guichet</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">Espace gestionnaire</p>
            </div>
            <NotificationsDrawer branchId={manager?.branch_id}>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label={`Notifications${unread > 0 ? `, ${unread} non lues` : ""}`}
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unread > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none ring-2 ring-card"
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Button>
            </NotificationsDrawer>
            <SignOutConfirm onConfirm={signOut}>
              <Button variant="ghost" size="icon" aria-label="Déconnexion">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </SignOutConfirm>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

const ManagerSidebar = ({
  navItems,
  onSignOut,
}: {
  navItems: { to: string; icon: any; label: string; end?: boolean; badge: number }[];
  onSignOut: () => void;
}) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (to: string, end?: boolean) =>
    end ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="px-2 py-2">
          {!collapsed ? (
            <>
              <h2 className="font-display text-base font-bold text-gradient">Guichet</h2>
              <p className="text-[10px] text-muted-foreground">Navigation</p>
            </>
          ) : (
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary mx-auto">G</div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ to, icon: Icon, label, end, badge }) => {
                const active = isActive(to, end);
                const badgeText = badge > 99 ? "99+" : String(badge);
                const ariaLabel = badge > 0 ? `${label} (${badge} non lue${badge > 1 ? "s" : ""})` : label;
                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={ariaLabel}
                      className={
                        active
                          ? "bg-primary/15 text-primary font-semibold border-l-4 border-primary rounded-l-none hover:bg-primary/20"
                          : "hover:bg-secondary"
                      }
                    >
                      <NavLink
                        to={to}
                        end={end}
                        aria-label={ariaLabel}
                        aria-current={active ? "page" : undefined}
                        className="relative flex items-center gap-3"
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {!collapsed && <span className="flex-1 truncate">{label}</span>}
                        {badge > 0 && !collapsed && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-[10px]" aria-hidden="true">
                            {badgeText}
                          </Badge>
                        )}
                        {badge > 0 && collapsed && (
                          <span
                            aria-hidden="true"
                            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none ring-2 ring-sidebar"
                          >
                            {badgeText}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SignOutConfirm onConfirm={onSignOut}>
          <Button
            variant="ghost"
            aria-label="Déconnexion"
            className={`w-full text-muted-foreground ${collapsed ? "justify-center px-0" : "justify-start"}`}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {!collapsed && <span className="ml-2">Déconnexion</span>}
          </Button>
        </SignOutConfirm>
      </SidebarFooter>
    </Sidebar>
  );
};

export default ManagerLayout;
