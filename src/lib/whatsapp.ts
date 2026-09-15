import { supabase } from "@/integrations/supabase/client";

export type WhatsAppEvent = "booking_created" | "ticket" | "cancelled";

/**
 * Envoie un message WhatsApp réel au numéro renseigné sur la réservation.
 * Silencieux : un échec d'envoi ne doit jamais bloquer le parcours utilisateur.
 */
export async function sendBookingWhatsApp(bookingId: string, event: WhatsAppEvent) {
  try {
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: { booking_id: bookingId, event },
    });
    if (error) {
      console.warn("send-whatsapp error", error);
      return { ok: false };
    }
    return data as { ok?: boolean; skipped?: string };
  } catch (e) {
    console.warn("send-whatsapp failed", e);
    return { ok: false };
  }
}
