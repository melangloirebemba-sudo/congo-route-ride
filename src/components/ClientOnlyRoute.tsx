import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const ClientOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { loading, isAdmin, agencyId, isManager } = useAuth();
  const isStaff = isAdmin || !!agencyId || isManager;

  useEffect(() => {
    if (!loading && isStaff) {
      toast.error("Cet écran est réservé aux clients. Redirection vers votre espace.");
    }
  }, [loading, isStaff]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (agencyId) return <Navigate to="/agency" replace />;
  if (isManager) return <Navigate to="/manager" replace />;
  return <>{children}</>;
};

export default ClientOnlyRoute;
