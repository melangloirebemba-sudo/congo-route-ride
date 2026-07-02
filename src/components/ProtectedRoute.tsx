import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireScanAccess?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false, requireScanAccess = false }: ProtectedRouteProps) => {
  const { user, loading, isAdmin, agencyId, agencyStatus } = useAuth();

  const canScan = isAdmin || (!!agencyId && agencyStatus === "active");

  useEffect(() => {
    if (loading || !user) return;
    if (requireAdmin && !isAdmin) {
      toast.error("Accès réservé au Super Admin");
    } else if (requireScanAccess && !canScan) {
      toast.error(
        agencyId && agencyStatus !== "active"
          ? "Votre agence doit être active pour scanner des billets"
          : "Vous n'avez pas les droits pour scanner des billets"
      );
    }
  }, [loading, user, isAdmin, canScan, requireAdmin, requireScanAccess, agencyId, agencyStatus]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;
  if (requireScanAccess && !canScan) {
    if (agencyId) return <Navigate to="/agency" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

