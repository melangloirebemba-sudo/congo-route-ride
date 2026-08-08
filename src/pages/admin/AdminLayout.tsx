import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, CreditCard, Settings, Users, BarChart3, LogOut,
  Ticket, QrCode, ScrollText, MapPin,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Tableau de bord", end: true },
  { to: "/admin/agencies", icon: Building2, label: "Agences" },
  { to: "/admin/agency-bookings", icon: Ticket, label: "Réservations agences" },
  { to: "/admin/scan", icon: QrCode, label: "Scan billets" },
  { to: "/admin/transactions", icon: CreditCard, label: "Transactions" },
  { to: "/admin/users", icon: Users, label: "Utilisateurs" },
  { to: "/admin/audit", icon: ScrollText, label: "Journal d'audit" },
  { to: "/admin/stats", icon: BarChart3, label: "Statistiques" },
  { to: "/admin/districts", icon: MapPin, label: "Arrondissements" },
  { to: "/admin/settings", icon: Settings, label: "Paramètres" },
];

const AdminSidebar = ({ onSignOut }: { onSignOut: () => void }) => {
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
              <h2 className="font-display text-base font-bold text-gradient truncate">TransCongo</h2>
              <p className="text-[10px] text-muted-foreground truncate">Administration</p>
            </>
          ) : (
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary mx-auto">
              T
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ to, icon: Icon, label, end }) => {
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

const AdminLayout = () => {
  const { signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar onSignOut={signOut} />

        <div className="flex-1 flex flex-col min-w-0 h-screen">
          <header className="sticky top-0 z-30 h-14 flex items-center gap-2 px-3 md:px-4 border-b border-border bg-card shrink-0">
            <SidebarTrigger aria-label="Ouvrir ou fermer le menu de navigation" />
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm md:text-base font-bold text-gradient truncate">TransCongo</p>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">Administration de la plateforme</p>
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

export default AdminLayout;
