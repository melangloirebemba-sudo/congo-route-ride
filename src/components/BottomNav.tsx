import { useLocation, useNavigate } from "react-router-dom";
import { Home, Search, Ticket, User } from "lucide-react";

const tabs = [
  { path: "/", icon: Home, label: "Accueil" },
  { path: "/search", icon: Search, label: "Rechercher" },
  { path: "/bookings", icon: Ticket, label: "Billets" },
  { path: "/profile", icon: User, label: "Profil" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border/50 z-50">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || (path === "/search" && location.pathname.startsWith("/search"));
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex-1 flex flex-col items-center py-2 pt-3 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] mt-1 font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
