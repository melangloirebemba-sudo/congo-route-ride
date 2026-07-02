import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  branch_id?: string | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Non authentifié" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Find the agency owned by caller
    const { data: agency, error: agencyErr } = await admin
      .from("agencies")
      .select("id, name")
      .eq("owner_id", userData.user.id)
      .maybeSingle();
    if (agencyErr) return json({ error: agencyErr.message }, 400);
    if (!agency) return json({ error: "Aucune agence liée à votre compte" }, 403);

    const body = (await req.json()) as Payload;
    if (!body.email || !body.password || !body.full_name) {
      return json({ error: "Email, mot de passe et nom requis" }, 400);
    }

    // Validate branch belongs to agency if provided
    if (body.branch_id) {
      const { data: b } = await admin
        .from("agency_branches")
        .select("id, agency_id")
        .eq("id", body.branch_id)
        .maybeSingle();
      if (!b || b.agency_id !== agency.id) return json({ error: "Agence invalide" }, 400);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        role: "branch_manager",
        agency_id: agency.id,
        full_name: body.full_name,
        must_change_password: true,
      },
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message || "Création échouée" }, 400);
    }

    const { data: manager, error: mgrErr } = await admin
      .from("branch_managers")
      .insert({
        user_id: created.user.id,
        agency_id: agency.id,
        branch_id: body.branch_id || null,
        full_name: body.full_name,
        email: body.email,
        phone: body.phone || null,
        status: "active",
      })
      .select()
      .single();

    if (mgrErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: mgrErr.message }, 400);
    }

    return json({ manager, user_id: created.user.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
