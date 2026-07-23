import { useCallback, useEffect, useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Ticket, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

type Notif = {
  id: string;
  title: string;
  message: string | null;
  kind: string;
  read_at: string | null;
  created_at: string;
  booking_id: string | null;
};

interface Props {
  branchId?: string | null;
  children: ReactNode;
  bookingsPath?: string;
}

export const NotificationsDrawer = ({ branchId, children, bookingsPath = "/manager/bookings" }: Props) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const [sortDesc, setSortDesc] = useState(true);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    const { data } = await supabase
      .from("branch_notifications" as any)
      .select("id, title, message, kind, read_at, created_at, booking_id")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems(((data as any) || []) as Notif[]);
    setLoading(false);
  }, [branchId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  useEffect(() => {
    if (!branchId || !open) return;
    const channel = supabase
      .channel(`drawer-notifs-${branchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "branch_notifications", filter: `branch_id=eq.${branchId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [branchId, open, load]);

  const markOne = async (id: string) => {
    // Optimistic
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    const { error } = await supabase
      .from("branch_notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Impossible de marquer comme lue");
      load();
    }
  };

  const markAll = async () => {
    const unread = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length === 0) return;
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    const { error } = await supabase
      .from("branch_notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .in("id", unread);
    if (error) {
      toast.error("Erreur lors de la mise à jour");
      load();
    } else {
      toast.success("Toutes marquées comme lues");
    }
  };

  const unreadCount = items.filter((n) => !n.read_at).length;
  const filtered = tab === "unread" ? items.filter((n) => !n.read_at) : items;
  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return sortDesc ? db - da : da - db;
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
            Notifications
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Réservations et alertes de votre sous-agence.
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 py-3 flex items-center justify-between gap-2 border-b">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "unread" | "all")}>
            <TabsList className="h-8">
              <TabsTrigger value="unread" className="text-xs h-6">
                Non lues {unreadCount > 0 && <span className="ml-1 opacity-70">({unreadCount})</span>}
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs h-6">Toutes</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              aria-label={sortDesc ? "Plus récentes d'abord" : "Plus anciennes d'abord"}
              onClick={() => setSortDesc((s) => !s)}
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              {sortDesc ? "Récent" : "Ancien"}
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="h-8" onClick={markAll}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Tout lire
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-5 py-2">
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {tab === "unread" ? "Aucune notification non lue." : "Aucune notification."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {sorted.map((n) => (
                  <li
                    key={n.id}
                    className={`py-3 ${!n.read_at ? "bg-primary/5 -mx-2 px-2 rounded" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => { if (!n.read_at) markOne(n.id); }}
                      className="w-full text-left"
                      aria-label={n.read_at ? n.title : `${n.title} — marquer comme lue`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />}
                        <p className="font-medium text-sm">{n.title}</p>
                      </div>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.message}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString("fr-FR")}
                      </p>
                    </button>
                    {n.booking_id && (
                      <div className="mt-2">
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>
                          <Link to={bookingsPath}>
                            <Ticket className="h-3 w-3 mr-1" /> Voir la réservation
                          </Link>
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          <Button asChild variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
            <Link to="/manager/notifications">Voir tout l'historique</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
