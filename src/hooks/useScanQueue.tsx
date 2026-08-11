import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  QueuedScan,
  readQueue,
  subscribeQueue,
  removeFromQueue,
  markAttempt,
  clearQueue,
} from "@/lib/scanQueue";

export interface SyncOutcome {
  item: QueuedScan;
  ok: boolean;
  message: string;
}

/**
 * Keeps the offline scan queue in sync: watches connectivity and replays
 * queued boarding validations against the server when back online.
 */
export const useScanQueue = () => {
  const [queue, setQueue] = useState<QueuedScan[]>(() => readQueue());
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [syncing, setSyncing] = useState(false);
  const [lastResults, setLastResults] = useState<SyncOutcome[]>([]);

  useEffect(() => subscribeQueue(setQueue), []);

  const sync = useCallback(async () => {
    const items = readQueue();
    if (items.length === 0 || syncing) return;
    setSyncing(true);
    const results: SyncOutcome[] = [];

    for (const item of items) {
      const { data, error } = await supabase.rpc("check_in_booking", {
        _booking_id: item.bookingId,
      });
      if (error) {
        markAttempt(item.id, error.message);
        results.push({ item, ok: false, message: error.message });
        continue;
      }
      const res = (data ?? {}) as { ok?: boolean; code?: string; message?: string };
      // Already used = the ticket was validated (possibly by this very queue) → drop it.
      if (res.ok || res.code === "used") {
        removeFromQueue(item.id);
        results.push({ item, ok: true, message: res.message || "Embarquement validé" });
      } else if (["cancelled", "unpaid", "expired", "notfound", "refused", "forbidden"].includes(res.code || "")) {
        removeFromQueue(item.id);
        results.push({ item, ok: false, message: res.message || "Validation refusée" });
      } else {
        markAttempt(item.id, res.message || "Échec inconnu");
        results.push({ item, ok: false, message: res.message || "Échec inconnu" });
      }
    }

    setLastResults(results);
    setSyncing(false);

    const okCount = results.filter((r) => r.ok).length;
    const koCount = results.length - okCount;
    if (okCount) toast.success(`${okCount} embarquement(s) synchronisé(s)`);
    if (koCount) toast.error(`${koCount} billet(s) rejeté(s) à la synchronisation`);
  }, [syncing]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      sync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [sync]);

  // Try once on mount when already online with a non-empty queue.
  useEffect(() => {
    if (online && readQueue().length > 0) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { queue, online, syncing, sync, lastResults, clearQueue };
};
