import { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate } from "react-router-dom";
import { LayoutDashboard, Bus, Ticket, Settings, LogOut, Building2, QrCode, UserCog, ScrollText, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/agency", icon: LayoutDashboard, label: "Tableau de bord", end: true },
  { to: "/agency/branches", icon: Building2, label: "Mes agences" },
  { to: "/agency/managers", icon: UserCog, label: "Gestionnaires" },
  { to: "/agency/trips", icon: Bus, label: "Trajets" },
  { to: "/agency/bookings", icon: Ticket, label: "Réservations" },
  { to: "/admin/scan", icon: QrCode, label: "Scan billets" },
  { to: "/agency/audit", icon: ScrollText, label: "Journal d'audit" },
  { to: "/agency/settings", icon: Settings, label: "Paramètres" },
];

const SidebarContent = ({
  agencyName,
  roleLabel,
  onNavigate,
  onSignOut,
}: {
  agencyName: string;
  roleLabel: string;
  onNavigate?: () => void;
  onSignOut: () => void;
}) => (
  <div className="flex flex-col h-full">
    <div className="p-5 border-b border-border shrink-0 bg-card">
      <h1 className="font-display text-lg font-bold text-gradient truncate">
        {agencyName || "Mon Agence"}
      </h1>
      <p className="text-xs text-muted-foreground truncate">{roleLabel}</p>
    </div>
    <nav className="p-3 space-y-1 overflow-y-auto flex-1">
      {navItems.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
      <div className="pt-3 mt-2 border-t border-border">
        <Button
          variant="ghost"
          onClick={onSignOut}
          className="w-full justify-start text-muted-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" /> Déconnexion
        </Button>
      </div>
    </nav>
  </div>
);

const AgencyLayout = () => {
  const { user, loading, signOut, agencyId, manager, isManager } = useAuth();
  const [agencyName, setAgencyName] = useState("");
  const [branchName, setBranchName] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 bg-card border-r border-border hidden md:flex flex-col sticky top-0 h-screen shrink-0">
        <SidebarContent agencyName={agencyName} roleLabel={roleLabel} onSignOut={signOut} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between p-3 border-b border-border bg-card">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Menu className="h-4 w-4" /> Menu
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SidebarContent
                agencyName={agencyName}
                roleLabel={roleLabel}
                onNavigate={() => setMobileOpen(false)}
                onSignOut={signOut}
              />
            </SheetContent>
          </Sheet>
          <div className="text-right min-w-0">
            <p className="font-display text-sm font-bold text-gradient truncate">{agencyName || "Agence"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{roleLabel}</p>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AgencyLayout;
