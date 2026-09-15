import { useLocation, useNavigate } from "react-router-dom";
import { Home, Search, Ticket, Clock, User } from "lucide-react";

const tabs = [
  { path: "/", icon: Home, label: "Accueil" },
  { path: "/search", icon: Search, label: "Rechercher" },
  { path: "/reservations", icon: Clock, label: "Réservations" },
  { path: "/bookings", icon: Ticket, label: "Billets" },
  { path: "/profile", icon: User, label: "Profil" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none">
      <div className="max-w-lg mx-auto flex items-center justify-between gap-1 rounded-full bg-foreground/95 backdrop-blur-xl px-3 py-2 shadow-lifted pointer-events-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || (path === "/search" && location.pathname.startsWith("/search"));
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-current={isActive ? "page" : undefined}
              className={`flex-1 flex flex-col items-center gap-1 rounded-full py-2 transition-all duration-300 press ${
                isActive
                  ? "bg-warning/15 text-warning"
                  : "text-background/55 hover:text-background/80"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="text-[10px] font-semibold leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
