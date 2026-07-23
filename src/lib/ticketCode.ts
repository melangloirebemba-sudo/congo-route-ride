import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a globally-unique ticket code (TC-XXXXXXXXXXXX).
 * Uses crypto.randomUUID + a DB uniqueness check to prevent collisions across
 * all sub-agencies. Retries up to 5 times if a (highly unlikely) collision occurs.
 */
const genRaw = () => {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `TC-${uuid.slice(0, 12).toUpperCase()}`;
};

export const generateUniqueTicketCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genRaw();
    const { data, error } = await supabase
      .from("bookings")
      .select("id")
      .eq("qr_code", code)
      .maybeSingle();
    if (error) {
      // If the check fails for a non-"no-rows" reason, fall back to returning
      // the code — the DB unique index (bookings_qr_code_unique) is the final guard.
      return code;
    }
    if (!data) return code;
  }
  // Fallback: extremely improbable — DB unique index still enforces safety.
  return genRaw();
};
