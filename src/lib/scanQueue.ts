/**
 * Offline queue for boarding validations.
 * When the network is unavailable, scans are stored locally and replayed
 * (via the check_in_booking RPC) as soon as the connection comes back.
 */
export interface QueuedScan {
  id: string;            // local uuid
  bookingId: string;
  qrCode: string;
  passengerName?: string | null;
  seatNumber?: number | null;
  tripLabel?: string | null;
  queuedAt: string;      // ISO
  attempts: number;
  lastError?: string | null;
}

const KEY = "tc_scan_queue_v1";
const listeners = new Set<(q: QueuedScan[]) => void>();

export const readQueue = (): QueuedScan[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedScan[]) : [];
  } catch {
    return [];
  }
};

const writeQueue = (q: QueuedScan[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    /* quota / private mode — ignore */
  }
  listeners.forEach((l) => l(q));
};

export const subscribeQueue = (cb: (q: QueuedScan[]) => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const enqueueScan = (item: Omit<QueuedScan, "id" | "queuedAt" | "attempts">) => {
  const q = readQueue();
  if (q.some((i) => i.qrCode === item.qrCode)) return q;
  const next: QueuedScan[] = [
    ...q,
    {
      ...item,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    },
  ];
  writeQueue(next);
  return next;
};

export const removeFromQueue = (id: string) => {
  writeQueue(readQueue().filter((i) => i.id !== id));
};

export const clearQueue = () => writeQueue([]);

export const markAttempt = (id: string, error?: string | null) => {
  writeQueue(
    readQueue().map((i) =>
      i.id === id ? { ...i, attempts: i.attempts + 1, lastError: error ?? null } : i
    )
  );
};
