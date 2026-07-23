import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "transcongo.webpush.enabled";

/** Returns true if the browser exposes the Notification API. */
export const isPushSupported = () =>
  typeof window !== "undefined" && "Notification" in window;

/** Current permission ("default" | "granted" | "denied") — safe on SSR. */
export const getPermission = (): NotificationPermission =>
  isPushSupported() ? Notification.permission : "denied";

/** Persisted local toggle (per browser). */
export const isPushEnabled = () =>
  isPushSupported() && localStorage.getItem(STORAGE_KEY) === "1" && Notification.permission === "granted";

const setPushEnabled = (v: boolean) => {
  if (v) localStorage.setItem(STORAGE_KEY, "1");
  else localStorage.removeItem(STORAGE_KEY);
};

const show = (title: string, body: string, tag?: string) => {
  if (!isPushEnabled()) return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
};

/** Hook for the Preferences page — enable/disable + request permission. */
export const useWebPushToggle = () => {
  const [permission, setPermission] = useState<NotificationPermission>(getPermission());
  const [enabled, setEnabled] = useState<boolean>(isPushEnabled());

  const enable = useCallback(async () => {
    if (!isPushSupported()) return false;
    let p = Notification.permission;
    if (p === "default") p = await Notification.requestPermission();
    setPermission(p);
    if (p !== "granted") return false;
    setPushEnabled(true);
    setEnabled(true);
    show("Notifications activées", "Vous recevrez ici vos alertes TransCongo.", "welcome");
    return true;
  }, []);

  const disable = useCallback(() => {
    setPushEnabled(false);
    setEnabled(false);
  }, []);

  return {
    supported: isPushSupported(),
    permission,
    enabled,
    enable,
    disable,
  };
};

/** Global listener: subscribes to booking + notification realtime events
 *  and displays a browser Notification when the user has opted in. */
export const useWebPushListener = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isPushSupported()) return;

    const channels: any[] = [];

    // Bookings owned by this user
    channels.push(
      supabase
        .channel(`push-bookings-${user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "bookings", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const b: any = payload.new;
            if (!b) return;
            if (b.payment_status === "paid") {
              show("Paiement confirmé", `Votre billet #${b.seat_number} est prêt.`, `bk-${b.id}-paid`);
            } else if (b.status === "cancelled") {
              show("Réservation annulée", `Siège #${b.seat_number} libéré.`, `bk-${b.id}-cancel`);
            } else if (b.boarding_status === "boarded") {
              show("Embarquement confirmé", `Bon voyage — siège #${b.seat_number}.`, `bk-${b.id}-board`);
            }
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [user]);
};

