import { useCallback, useEffect, useState, ReactNode, useMemo } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bell, CheckCheck, ArrowUpDown, ExternalLink, Archive } from "lucide-react";
import { toast } from "sonner";

type Notif = {
  id: string;
  title: string;
  message: string | null;
  kind: string;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  booking_id: string | null;
};

interface Props {
  branchId?: string | null;
  children: ReactNode;
  bookingsPath?: string;
}

const PAGE_SIZE = 15;

const KIND_OPTIONS: { value: string; label: string; match: (k: string) => boolean }[] = [
  { value: "all", label: "Tous les types", match: () => true },
  { value: "booking", label: "Réservations", match: (k) => k.startsWith("booking") },
  { value: "payment", label: "Paiements", match: (k) => k.includes("payment") },
  { value: "cancellation", label: "Annulations", match: (k) => k.includes("cancel") || k.includes("refus") },
  { value: "reminder", label: "Rappels", match: (k) => k.includes("remind") || k.includes("reminder") },
  { value: "system", label: "Système", match: (k) => k.includes("system") || k.includes("info") },
];

export const NotificationsDrawer = ({ branchId, children, bookingsPath = "/manager/bookings" }: Props) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const [sortDesc, setSortDesc] = useState(true);
  const [kindFilter, setKindFilter] = useState<string>("all");

  const loadPage = useCallback(async (from: number, replace: boolean) => {
    if (!branchId) return;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("branch_notifications" as any)
      .select("id, title, message, kind, read_at, archived_at, created_at, booking_id")
      .eq("branch_id", branchId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) return;
    const rows = ((data as any) || []) as Notif[];
    setHasMore(rows.length === PAGE_SIZE);
    setItems((prev) => (replace ? rows : [...prev, ...rows]));
  }, [branchId]);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    await loadPage(0, true);
    setLoading(false);
  }, [branchId, loadPage]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadPage(items.length, false);
    setLoadingMore(false);
  };

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
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    const { error } = await supabase
      .from("branch_notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Impossible de marquer comme lue"); load(); }
  };

  const markAll = async () => {
    const unread = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length === 0 || !branchId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    // Cover all unread in DB, not just what's loaded
    const { error } = await supabase
      .from("branch_notifications" as any)
      .update({ read_at: now })
      .eq("branch_id", branchId)
      .is("read_at", null)
      .is("archived_at", null);
    if (error) { toast.error("Erreur lors de la mise à jour"); load(); }
    else toast.success("Toutes marquées comme lues");
  };

  const archiveOne = async (id: string) => {
    const prev = items;
    setItems((list) => list.filter((n) => n.id !== id));
    const { error } = await supabase
      .from("branch_notifications" as any)
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Impossible d'archiver"); setItems(prev); return; }
    toast.success("Notification archivée", {
      duration: 6000,
      action: {
        label: "Annuler",
        onClick: async () => {
          const { error: e2 } = await supabase
            .from("branch_notifications" as any)
            .update({ archived_at: null })
            .eq("id", id);
          if (e2) toast.error("Annulation impossible");
          else { toast.success("Archivage annulé"); load(); }
        },
      },
    });
  };

  const kindMatcher = useMemo(
    () => KIND_OPTIONS.find((k) => k.value === kindFilter)?.match ?? (() => true),
    [kindFilter],
  );

  const unreadCount = items.filter((n) => !n.read_at).length;
  const filtered = items.filter((n) =>
    (tab === "unread" ? !n.read_at : true) && kindMatcher(n.kind || "")
  );
  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return sortDesc ? db - da : da - db;
  });

  const detailLink = (n: Notif) => (n.booking_id ? bookingsPath : null);

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

        <div className="px-5 py-3 flex flex-col gap-2 border-b">
          <div className="flex items-center justify-between gap-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "unread" | "all")}>
              <TabsList className="h-8">
                <TabsTrigger value="unread" className="text-xs h-6">
                  Non lues {unreadCount > 0 && <span className="ml-1 opacity-70">({unreadCount})</span>}
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs h-6">Toutes</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setSortDesc((s) => !s)}>
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              {sortDesc ? "Récent" : "Ancien"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((k) => (
                  <SelectItem key={k.value} value={k.value} className="text-xs">{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={markAll}
              disabled={unreadCount === 0}
              aria-label="Marquer tout comme lu"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Tout lire
            </Button>
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
                {sorted.map((n) => {
                  const link = detailLink(n);
                  return (
                    <li key={n.id} className={`py-3 ${!n.read_at ? "bg-primary/5 -mx-2 px-2 rounded" : ""}`}>
                      <button
                        type="button"
                        onClick={() => { if (!n.read_at) markOne(n.id); }}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />}
                          <p className="font-medium text-sm">{n.title}</p>
                          {n.kind && <Badge variant="outline" className="text-[10px] px-1 py-0">{n.kind}</Badge>}
                        </div>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.message}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(n.created_at).toLocaleString("fr-FR")}
                        </p>
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {link && (
                          <Button asChild size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>
                            <Link to={link}>
                              <ExternalLink className="h-3 w-3 mr-1" /> Voir le détail
                            </Link>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => archiveOne(n.id)}
                          aria-label="Archiver la notification"
                        >
                          <Archive className="h-3 w-3 mr-1" /> Archiver
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {hasMore && !loading && (
              <div className="py-3 flex justify-center">
                <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Chargement…" : "Charger plus"}
                </Button>
              </div>
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
