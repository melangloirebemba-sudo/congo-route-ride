import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted px-4">
      <div className="text-center max-w-md">
        <h1 className="mb-2 font-display text-7xl font-bold text-primary">404</h1>
        <p className="mb-2 text-2xl font-semibold">Page introuvable</p>
        <p className="mb-6 text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to="/"><Home className="h-4 w-4 mr-2" />Accueil</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/search"><Search className="h-4 w-4 mr-2" />Rechercher un trajet</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
