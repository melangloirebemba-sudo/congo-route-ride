import { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Bus, Ticket, Settings, LogOut, Building2, QrCode, UserCog, ScrollText, PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SignOutConfirm } from "@/components/SignOutConfirm";
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

const ownerNavItems = [
  { to: "/agency", icon: LayoutDashboard, label: "Tableau de bord", end: true },
  { to: "/agency/branches", icon: Building2, label: "Mes agences" },
  { to: "/agency/managers", icon: UserCog, label: "Gestionnaires" },
  { to: "/agency/trips", icon: Bus, label: "Trajets" },
  { to: "/agency/bookings", icon: Ticket, label: "Réservations" },
  { to: "/agency/counter-sale", icon: PlusCircle, label: "Nouvelle réservation" },
  { to: "/admin/scan", icon: QrCode, label: "Scan billets" },
  { to: "/agency/audit", icon: ScrollText, label: "Journal d'audit" },
  { to: "/agency/settings", icon: Settings, label: "Paramètres" },
];

const managerNavItems = ownerNavItems.filter((i) => i.to !== "/agency/counter-sale");

const AgencySidebar = ({
  agencyName,
  roleLabel,
  items,
  onSignOut,
}: {
  agencyName: string;
  roleLabel: string;
  items: typeof ownerNavItems;
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
              <h2 className="font-display text-base font-bold text-gradient truncate">{agencyName || "Mon Agence"}</h2>
              <p className="text-[10px] text-muted-foreground truncate">{roleLabel}</p>
            </>
          ) : (
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary mx-auto">
              {(agencyName || "A").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ to, icon: Icon, label, end }) => {
                const active = isActive(to, end);
                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={label}
                      className={
                        active
                          ? "bg-primary/15 text-primary font-semibold border-l-4 border-primary rounded-l-none hover:bg-primary/20"
                          : "hover:bg-secondary"
                      }
                    >
                      <NavLink
                        to={to}
                        end={end}
                        aria-label={label}
                        aria-current={active ? "page" : undefined}
                        className="flex items-center gap-3"
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {!collapsed && <span className="truncate">{label}</span>}
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

const AgencyLayout = () => {
  const { user, loading, signOut, agencyId, manager, isManager } = useAuth();
  const [agencyName, setAgencyName] = useState("");
  const [branchName, setBranchName] = useState<string | null>(null);

  useEffect(() => {
    if (!agencyId) return;
    supabase.from("agencies").select("name").eq("id", agencyId).single().then(({ data }) => {
      setAgencyName((data as any)?.name || "");
    });
  }, [agencyId]);

  useEffect(() => {
    const branchId = (manager as any)?.branch_id;
    if (!branchId) { setBranchName(null); return; }
    supabase.from("agency_branches" as any).select("name").eq("id", branchId).single().then(({ data }) => {
      setBranchName((data as any)?.name || null);
    });
  }, [manager]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!agencyId) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <p className="text-lg font-display font-semibold">Accès refusé</p>
        <p className="text-sm text-muted-foreground">Vous n'êtes propriétaire d'aucune agence.</p>
        <Button variant="outline" onClick={() => window.location.href = "/"}>Retour</Button>
      </div>
    </div>
  );

  const roleLabel = isManager
    ? `Gestionnaire${branchName ? ` · ${branchName}` : ""}`
    : "Propriétaire d'agence";
  const items = isManager ? managerNavItems : ownerNavItems;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AgencySidebar agencyName={agencyName} roleLabel={roleLabel} items={items} onSignOut={signOut} />

        <div className="flex-1 flex flex-col min-w-0 h-screen">
          <header className="sticky top-0 z-30 h-14 flex items-center gap-2 px-3 md:px-4 border-b border-border bg-card shrink-0">
            <SidebarTrigger aria-label="Ouvrir ou fermer le menu de navigation" />
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm md:text-base font-bold text-gradient truncate">{agencyName || "Agence"}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">{roleLabel}</p>
            </div>
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

export default AgencyLayout;
