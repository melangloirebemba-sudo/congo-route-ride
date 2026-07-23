import { NavLink, Outlet, Navigate } from "react-router-dom";
import { LayoutDashboard, Bus, Ticket, Settings, LogOut, Building2, QrCode, UserCog, ScrollText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

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


const AgencyLayout = () => {
  const { user, loading, signOut, agencyId } = useAuth();

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

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 bg-card border-r border-border hidden md:flex flex-col">
        <div className="p-5 border-b border-border">
          <h1 className="font-display text-lg font-bold text-gradient">Mon Agence</h1>
          <p className="text-xs text-muted-foreground">Espace gestionnaire</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
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
        </nav>
        <div className="p-3 border-t border-border">
          <Button variant="ghost" onClick={signOut} className="w-full justify-start text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Déconnexion
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <h1 className="font-display text-lg font-bold text-gradient">Agence</h1>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </header>
        <nav className="md:hidden flex overflow-x-auto border-b border-border bg-card px-2">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium whitespace-nowrap ${
                  isActive ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
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

export default AgencyLayout;
