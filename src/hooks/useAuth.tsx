import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface ManagerInfo {
  id: string;
  agency_id: string;
  branch_id: string | null;
  full_name: string;
}

export interface BranchPermissions {
  can_create_trips: boolean;
  can_sell_counter: boolean;
  can_scan: boolean;
  can_view_stats: boolean;
}

const DEFAULT_PERMS: BranchPermissions = {
  can_create_trips: true,
  can_sell_counter: true,
  can_scan: true,
  can_view_stats: true,
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  agencyId: string | null;
  agencyStatus: string | null;
  manager: ManagerInfo | null;
  isManager: boolean;
  managerPermissions: BranchPermissions;
  refreshAgency: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  agencyId: null,
  agencyStatus: null,
  manager: null,
  isManager: false,
  managerPermissions: DEFAULT_PERMS,
  refreshAgency: async () => {},
  signOut: async () => {},
});


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyStatus, setAgencyStatus] = useState<string | null>(null);
  const [manager, setManager] = useState<ManagerInfo | null>(null);
  const [managerPermissions, setManagerPermissions] = useState<BranchPermissions>(DEFAULT_PERMS);

  const checkAdmin = async (userId: string) => {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    setIsAdmin(!!data);
  };

  const checkAgency = async (userId: string) => {
    const { data } = await supabase
      .from("agencies")
      .select("id, status")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();
    setAgencyId(data?.id || null);
    setAgencyStatus(data?.status || null);
  };

  const checkManager = async (userId: string) => {
    const { data } = await supabase
      .from("branch_managers" as any)
      .select("id, agency_id, branch_id, full_name, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    setManager((data as any) || null);
    const branchId = (data as any)?.branch_id;
    if (branchId) {
      const { data: b } = await supabase
        .from("agency_branches" as any)
        .select("can_create_trips, can_sell_counter, can_scan, can_view_stats")
        .eq("id", branchId)
        .maybeSingle();
      if (b) {
        setManagerPermissions({
          can_create_trips: (b as any).can_create_trips ?? true,
          can_sell_counter: (b as any).can_sell_counter ?? true,
          can_scan: (b as any).can_scan ?? true,
          can_view_stats: (b as any).can_view_stats ?? true,
        });
      } else {
        setManagerPermissions(DEFAULT_PERMS);
      }
    } else {
      setManagerPermissions(DEFAULT_PERMS);
    }
  };


  const refreshAgency = async () => {
    if (user) await checkAgency(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            checkAdmin(session.user.id);
            checkAgency(session.user.id);
            checkManager(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
          setAgencyId(null);
          setAgencyStatus(null);
          setManager(null);
          setManagerPermissions(DEFAULT_PERMS);
        }

        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdmin(session.user.id);
        checkAgency(session.user.id);
        checkManager(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setAgencyId(null);
    setAgencyStatus(null);
    setManager(null);
    setManagerPermissions(DEFAULT_PERMS);
  };


  return (
    <AuthContext.Provider value={{
      user, session, loading, isAdmin,
      agencyId, agencyStatus,
      manager, isManager: !!manager,
      managerPermissions,
      refreshAgency, signOut,
    }}>

      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
