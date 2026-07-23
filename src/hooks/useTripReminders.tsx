import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isPushEnabled } from "@/hooks/useWebPush";

const OFFSETS_KEY = "transcongo.webpush.reminderOffsets";
const FIRED_KEY = "transcongo.webpush.remindersFired";

/** Available reminder offsets in minutes before boarding. */
export const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "15 minutes avant" },
  { value: 60, label: "1 heure avant" },
  { value: 180, label: "3 heures avant" },
  { value: 24 * 60, label: "24 heures avant" },
  { value: 48 * 60, label: "48 heures avant" },
];

export const getReminderOffsets = (): number[] => {
  try {
    const raw = localStorage.getItem(OFFSETS_KEY);
    if (!raw) return [60, 24 * 60]; // default: 1h + 24h
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n) => typeof n === "number") : [];
  } catch {
    return [60, 24 * 60];
  }
};

export const setReminderOffsets = (offsets: number[]) => {
  localStorage.setItem(OFFSETS_KEY, JSON.stringify(offsets));
};

const getFired = (): Record<string, true> => {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
};
const markFired = (key: string) => {
  const f = getFired();
  f[key] = true;
  localStorage.setItem(FIRED_KEY, JSON.stringify(f));
};

const notify = (title: string, body: string, tag: string) => {
  if (!isPushEnabled()) return;
  try {
    const n = new Notification(title, { body, icon: "/favicon.ico", badge: "/favicon.ico", tag });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
};

type BookingRow = {
  id: string;
  seat_number: number | null;
  status: string | null;
  payment_status: string | null;
  boarding_status: string | null;
  trips?: {
    departure: string | null;
    destination: string | null;
    date: string | null;
    departure_time: string | null;
  } | null;
};

/** IANA timezone of the departure city — Republic of Congo (UTC+1, no DST).
 *  Using Intl below makes any future DST-aware zone Just Work. */
export const DEPARTURE_TZ = "Africa/Brazzaville";

/** Minutes offset of `tz` at instant `utcMs` (positive = ahead of UTC). */
const tzOffsetMinutes = (tz: string, utcMs: number): number => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const map: Record<string, string> = {};
  parts.forEach((p) => (map[p.type] = p.value));
  const asIfUTC = Date.UTC(
    +map.year,
    +map.month - 1,
    +map.day,
    +map.hour === 24 ? 0 : +map.hour,
    +map.minute,
    +map.second
  );
  return (asIfUTC - utcMs) / 60_000;
};

/** Convert a local wall-clock date/time in `tz` to a UTC timestamp,
 *  correctly handling DST transitions by iterating the offset twice. */
const zonedWallToUTC = (dateStr: string, timeStr: string, tz: string): number => {
  const [Y, M, D] = dateStr.split("-").map(Number);
  const [h, m, s = 0] = timeStr.split(":").map(Number);
  let ts = Date.UTC(Y, M - 1, D, h, m, s);
  // Two passes converge across DST jumps.
  for (let i = 0; i < 2; i++) {
    const off = tzOffsetMinutes(tz, ts);
    ts = Date.UTC(Y, M - 1, D, h, m, s) - off * 60_000;
  }
  return ts;
};

const parseDeparture = (b: BookingRow): number | null => {
  const t = b.trips;
  if (!t?.date) return null;
  const rawTime = t.departure_time || "00:00:00";
  const time = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
  const ts = zonedWallToUTC(t.date, time, DEPARTURE_TZ);
  return isNaN(ts) ? null : ts;
};


const schedule = (bookings: BookingRow[], timers: number[]) => {
  const offsets = getReminderOffsets();
  if (offsets.length === 0) return;
  const now = Date.now();

  for (const b of bookings) {
    if (b.payment_status !== "paid") continue;
    if (b.status === "cancelled" || b.boarding_status === "boarded" || b.boarding_status === "refused") continue;
    const dep = parseDeparture(b);
    if (!dep || dep <= now) continue;

    for (const off of offsets) {
      const fireAt = dep - off * 60_000;
      const key = `${b.id}:${off}`;
      const fired = getFired();
      if (fired[key]) continue;
      const delay = fireAt - now;
      if (delay <= 0) {
        // If we're within window but haven't fired yet (page just opened), still notify
        if (fireAt > now - 10 * 60_000) {
          const label =
            off >= 60 ? `dans ${Math.round(off / 60)} h` : `dans ${off} min`;
          const route = b.trips ? `${b.trips.departure ?? "?"} → ${b.trips.destination ?? "?"}` : "";
          notify("Rappel d'embarquement", `${route} — départ ${label} (siège #${b.seat_number ?? "?"}).`, `rem-${key}`);
          markFired(key);
        }
        continue;
      }
      // clamp to setTimeout max (~24.8 days)
      if (delay > 2_000_000_000) continue;
      const id = window.setTimeout(() => {
        const label = off >= 60 ? `dans ${Math.round(off / 60)} h` : `dans ${off} min`;
        const route = b.trips ? `${b.trips.departure ?? "?"} → ${b.trips.destination ?? "?"}` : "";
        notify("Rappel d'embarquement", `${route} — départ ${label} (siège #${b.seat_number ?? "?"}).`, `rem-${key}`);
        markFired(key);
      }, delay);
      timers.push(id);
    }
  }
};

/** Global listener that schedules browser reminders for upcoming paid bookings. */
export const useTripReminders = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const timers: number[] = [];

    const load = async () => {
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, seat_number, status, payment_status, boarding_status, trips ( departure, destination, date, departure_time )"
        )
        .eq("user_id", user.id)
        .eq("payment_status", "paid")
        .neq("status", "cancelled");
      if (cancelled || !data) return;
      schedule(data as any, timers);
    };

    load();

    const channel = supabase
      .channel(`reminders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `user_id=eq.${user.id}` },
        () => {
          timers.forEach((t) => clearTimeout(t));
          timers.length = 0;
          load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
      supabase.removeChannel(channel);
    };
  }, [user]);
};
