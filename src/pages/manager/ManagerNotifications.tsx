import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ListPagination, usePagination } from "@/components/ListPagination";

type Notif = {
  id: string;
  title: string;
  message: string | null;
  kind: string;
  read_at: string | null;
  created_at: string;
  booking_id: string | null;
};

const ManagerNotifications = () => {
  const { manager } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!manager?.branch_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("branch_notifications" as any)
      .select("id, title, message, kind, read_at, created_at, booking_id")
      .eq("branch_id", manager.branch_id)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems(((data as any) || []) as Notif[]);
    setLoading(false);
  }, [manager?.branch_id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const branchId = manager?.branch_id;
    if (!branchId) return;
    const channel = supabase
      .channel(`branch-notifs-page-${branchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "branch_notifications", filter: `branch_id=eq.${branchId}` },
        (payload: any) => {
          const n = payload.new;
          toast.info(n?.title || "Nouvelle notification", { description: n?.message ?? undefined });
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "branch_notifications", filter: `branch_id=eq.${branchId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [manager?.branch_id, load]);


  const markOne = async (id: string) => {
    await supabase.from("branch_notifications" as any).update({ read_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const markAll = async () => {
    const unread = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length === 0) return;
    await supabase.from("branch_notifications" as any).update({ read_at: new Date().toISOString() }).in("id", unread);
    toast.success("Toutes les notifications marquées comme lues");
    load();
  };

  const pg = usePagination(items, 10, [items.length]);
  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Notifications
            {unreadCount > 0 && <Badge variant="destructive" className="ml-1">{unreadCount}</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            Réservations assignées à votre sous-agence pour embarquement.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAll}>
            <CheckCheck className="h-4 w-4 mr-1" /> Tout marquer comme lu
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune notification pour l'instant.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {pg.paginated.map((n: Notif) => (
                  <li
                    key={n.id}
                    className={`py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 ${
                      !n.read_at ? "bg-primary/5 -mx-2 sm:-mx-4 px-2 sm:px-4 rounded" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{n.title}</p>
                        {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary" aria-label="non lue" />}
                      </div>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.message}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {n.booking_id && (
                        <Button asChild size="sm" variant="outline">
                          <Link to="/manager/bookings">
                            <Ticket className="h-3.5 w-3.5 mr-1" /> Voir
                          </Link>
                        </Button>
                      )}
                      {!n.read_at && (
                        <Button size="sm" variant="ghost" onClick={() => markOne(n.id)}>
                          <CheckCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <ListPagination {...pg} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerNotifications;
