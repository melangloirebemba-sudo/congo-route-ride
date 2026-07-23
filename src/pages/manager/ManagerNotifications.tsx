import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bell, CheckCheck, ExternalLink, ArrowUpDown, Archive, ArchiveRestore } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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

const PAGE_SIZE = 20;

const KIND_OPTIONS: { value: string; label: string; match: (k: string) => boolean }[] = [
  { value: "all", label: "Tous les types", match: () => true },
  { value: "booking", label: "Réservations", match: (k) => k.startsWith("booking") },
  { value: "payment", label: "Paiements", match: (k) => k.includes("payment") },
  { value: "cancellation", label: "Annulations", match: (k) => k.includes("cancel") || k.includes("refus") },
  { value: "reminder", label: "Rappels", match: (k) => k.includes("remind") || k.includes("reminder") },
  { value: "system", label: "Système", match: (k) => k.includes("system") || k.includes("info") },
];

const ManagerNotifications = () => {
  const { manager } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState<"unread" | "all" | "archived">("all");
  const [sortDesc, setSortDesc] = useState(true);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(async (from: number, replace: boolean) => {
    if (!manager?.branch_id) return;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("branch_notifications" as any)
      .select("id, title, message, kind, read_at, archived_at, created_at, booking_id")
      .eq("branch_id", manager.branch_id);
    query = tab === "archived" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) return;
    const rows = ((data as any) || []) as Notif[];
    setHasMore(rows.length === PAGE_SIZE);
    setItems((prev) => (replace ? rows : [...prev, ...rows]));
  }, [manager?.branch_id, tab]);

  const load = useCallback(async () => {
    if (!manager?.branch_id) return;
    setLoading(true);
    await loadPage(0, true);
    setLoading(false);
  }, [manager?.branch_id, loadPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadPage(items.length, false);
    setLoadingMore(false);
  }, [loadingMore, hasMore, items.length, loadPage]);

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

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const markOne = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    const { error } = await supabase
      .from("branch_notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Erreur"); load(); }
  };

  const markAll = async () => {
    const branchId = manager?.branch_id;
    if (!branchId) return;
    const unread = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    const { error } = await supabase
      .from("branch_notifications" as any)
      .update({ read_at: now })
      .eq("branch_id", branchId)
      .is("read_at", null)
      .is("archived_at", null);
    if (error) { toast.error("Erreur"); load(); }
    else toast.success("Toutes les notifications marquées comme lues");
  };

  const archiveOne = async (id: string) => {
    const prev = items;
    setItems((list) => list.filter((n) => n.id !== id));
    const { error } = await supabase
      .from("branch_notifications" as any)
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Impossible d'archiver"); setItems(prev); }
    else toast.success("Notification archivée");
  };

  const restoreOne = async (id: string) => {
    const prev = items;
    setItems((list) => list.filter((n) => n.id !== id));
    const { error } = await supabase
      .from("branch_notifications" as any)
      .update({ archived_at: null })
      .eq("id", id);
    if (error) { toast.error("Impossible de restaurer"); setItems(prev); }
    else toast.success("Notification restaurée");
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

  const detailLink = (n: Notif) => (n.booking_id ? "/manager/bookings" : null);

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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setSortDesc((s) => !s)}>
            <ArrowUpDown className="h-4 w-4 mr-1" /> {sortDesc ? "Plus récentes" : "Plus anciennes"}
          </Button>
          <Button variant="outline" size="sm" onClick={markAll} disabled={unreadCount === 0}>
            <CheckCheck className="h-4 w-4 mr-1" /> Marquer tout comme lu
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "unread" | "all" | "archived")}>
          <TabsList>
            <TabsTrigger value="all">Actives</TabsTrigger>
            <TabsTrigger value="unread">Non lues ({unreadCount})</TabsTrigger>
            <TabsTrigger value="archived">Archivées</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((k) => (
              <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {tab === "unread" ? "Aucune notification non lue." : "Aucune notification pour l'instant."}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {sorted.map((n) => {
                  const link = detailLink(n);
                  return (
                    <li
                      key={n.id}
                      className={`py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 ${
                        !n.read_at ? "bg-primary/5 -mx-2 sm:-mx-4 px-2 sm:px-4 rounded" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => { if (!n.read_at) markOne(n.id); }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{n.title}</p>
                          {n.kind && <Badge variant="outline" className="text-[10px] px-1 py-0">{n.kind}</Badge>}
                          {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                        </div>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.message}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(n.created_at).toLocaleString("fr-FR")}
                        </p>
                      </button>
                      <div className="flex gap-2 shrink-0 flex-wrap">
                        {link && (
                          <Button asChild size="sm" variant="outline">
                            <Link to={link}>
                              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Voir le détail
                            </Link>
                          </Button>
                        )}
                        {!n.read_at && !n.archived_at && (
                          <Button size="sm" variant="ghost" onClick={() => markOne(n.id)} aria-label="Marquer comme lue">
                            <CheckCheck className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {n.archived_at ? (
                          <Button size="sm" variant="ghost" onClick={() => restoreOne(n.id)} aria-label="Restaurer">
                            <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Restaurer
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => archiveOne(n.id)} aria-label="Archiver">
                            <Archive className="h-3.5 w-3.5 mr-1" /> Archiver
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div ref={sentinelRef} className="py-4 flex justify-center">
                {hasMore ? (
                  <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Chargement…" : "Charger plus"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Fin de l'historique</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerNotifications;
