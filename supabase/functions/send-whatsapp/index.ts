import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://voyagecongo.shop";

type Event = "booking_created" | "ticket" | "cancelled";

/** Normalise a local Congolese number to E.164 (default +242). */
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("+")) return s.length >= 9 ? s : null;
  s = s.replace(/\D/g, "");
  if (s.startsWith("00")) s = s.slice(2);
  if (s.startsWith("242")) return "+" + s;
  if (s.length === 9) return "+242" + s;
  if (s.length > 9) return "+" + s;
  return null;
}

const fmtMoney = (n: number) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;
const fmtDate = (d?: string | null) => {
  if (!d) return "?";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { booking_id, event } = (await req.json().catch(() => ({}))) as {
      booking_id?: string;
      event?: Event;
    };
    if (!booking_id || !event || !["booking_created", "ticket", "cancelled"].includes(event)) {
      return json({ error: "booking_id et event (booking_created | ticket | cancelled) requis" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Authentification requise" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // RLS-scoped read: the caller must be allowed to see this booking.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: booking, error: bErr } = await userClient
      .from("bookings")
      .select(
        "id, passenger_name, phone, seat_number, total_amount, qr_code, status, payment_status, boarding_branch_id, trip_id",
      )
      .eq("id", booking_id)
      .maybeSingle();
    if (bErr) return json({ error: bErr.message }, 400);
    if (!booking) return json({ error: "Réservation introuvable ou accès refusé" }, 404);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: trip } = await admin
      .from("trips")
      .select("id, departure, destination, date, departure_time, agency_id, branch_id")
      .eq("id", booking.trip_id)
      .maybeSingle();

    const branchId = booking.boarding_branch_id ?? trip?.branch_id ?? null;
    const { data: branch } = branchId
      ? await admin
          .from("agency_branches")
          .select("id, name, city, district, address, phone, whatsapp_number, whatsapp_enabled")
          .eq("id", branchId)
          .maybeSingle()
      : { data: null as any };

    const { data: agency } = trip?.agency_id
      ? await admin
          .from("agencies")
          .select("id, name, phone, whatsapp_number")
          .eq("id", trip.agency_id)
          .maybeSingle()
      : { data: null as any };

    if (branch && branch.whatsapp_enabled === false) {
      return json({ ok: true, skipped: "whatsapp_disabled_for_branch" });
    }

    const to = toE164(booking.phone);
    if (!to) return json({ ok: false, skipped: "invalid_recipient" });

    const fromRaw = branch?.whatsapp_number || agency?.whatsapp_number || Deno.env.get("WHATSAPP_FROM_NUMBER");
    const from = toE164(fromRaw ?? null);
    if (!from) {
      return json(
        { ok: false, skipped: "no_sender", error: "Aucun numéro WhatsApp expéditeur configuré" },
        200,
      );
    }

    const place =
      [branch?.name, [branch?.address, branch?.district, branch?.city].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(" — ") || trip?.departure || "";
    const contact = branch?.phone || agency?.phone || "";
    const link = `${SITE_URL}/bookings/${booking.id}`;
    const route = `${trip?.departure ?? "?"} → ${trip?.destination ?? "?"}`;
    const head = `*${agency?.name ?? "TransCongo"}*`;

    let body = "";
    if (event === "cancelled") {
      body = [
        `${head}`,
        ``,
        `❌ Votre réservation a été annulée.`,
        ``,
        `Trajet : ${route}`,
        `Date : ${fmtDate(trip?.date)} à ${trip?.departure_time ?? "?"}`,
        `Siège : #${booking.seat_number}`,
        `Code : ${booking.qr_code}`,
        booking.payment_status === "refunded" ? `Remboursement en cours.` : "",
        ``,
        contact ? `Pour toute question : ${contact}` : "",
        link,
      ]
        .filter(Boolean)
        .join("\n");
    } else if (event === "ticket") {
      body = [
        `${head}`,
        ``,
        `🎟️ Voici votre billet.`,
        ``,
        `Passager : ${booking.passenger_name}`,
        `Trajet : ${route}`,
        `Date : ${fmtDate(trip?.date)} à ${trip?.departure_time ?? "?"}`,
        `Siège : #${booking.seat_number}`,
        `Montant : ${fmtMoney(booking.total_amount)}`,
        `Code du billet : *${booking.qr_code}*`,
        place ? `Embarquement : ${place}` : "",
        ``,
        `Billet et QR code : ${link}`,
        `Présentez le QR code à l'embarquement.`,
      ]
        .filter(Boolean)
        .join("\n");
    } else {
      body = [
        `${head}`,
        ``,
        `✅ Réservation enregistrée.`,
        ``,
        `Passager : ${booking.passenger_name}`,
        `Trajet : ${route}`,
        `Date : ${fmtDate(trip?.date)} à ${trip?.departure_time ?? "?"}`,
        `Siège : #${booking.seat_number}`,
        `Montant : ${fmtMoney(booking.total_amount)}`,
        `Statut du paiement : ${booking.payment_status === "paid" ? "payé" : "en attente"}`,
        place ? `Embarquement : ${place}` : "",
        ``,
        `Détails : ${link}`,
        contact ? `Contact agence : ${contact}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const twilioKey = Deno.env.get("TWILIO_API_KEY");
    if (!lovableKey || !twilioKey) {
      await admin.from("whatsapp_messages").insert({
        booking_id: booking.id,
        agency_id: trip?.agency_id ?? null,
        branch_id: branchId,
        event,
        to_number: to,
        from_number: from,
        body,
        status: "failed",
        error: "Connexion WhatsApp (Twilio) non configurée",
      });
      return json({ ok: false, error: "Connexion WhatsApp non configurée" }, 200);
    }

    const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: `whatsapp:${to}`,
        From: `whatsapp:${from}`,
        Body: body,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`Twilio WhatsApp failed [${res.status}]: ${text}`);
      await admin.from("whatsapp_messages").insert({
        booking_id: booking.id,
        agency_id: trip?.agency_id ?? null,
        branch_id: branchId,
        event,
        to_number: to,
        from_number: from,
        body,
        status: "failed",
        error: `[${res.status}] ${text}`,
      });
      return json({ ok: false, status: res.status, details: text }, 200);
    }

    let sid: string | null = null;
    try {
      sid = JSON.parse(text)?.sid ?? null;
    } catch (_) {
      // ignore
    }

    await admin.from("whatsapp_messages").insert({
      booking_id: booking.id,
      agency_id: trip?.agency_id ?? null,
      branch_id: branchId,
      event,
      to_number: to,
      from_number: from,
      body,
      status: "sent",
      provider_sid: sid,
    });

    return json({ ok: true, sid });
  } catch (e) {
    console.error("send-whatsapp error", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
