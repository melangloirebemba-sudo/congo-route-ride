import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    // Enforce admin role
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Accès refusé" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = (body.action as string) || "list";

    if (action === "list") {
      const page = Number(body.page ?? 1);
      const perPage = Number(body.perPage ?? 200);
      const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) return json({ error: error.message }, 400);

      const ids = list.users.map((u) => u.id);
      const [{ data: roles }, { data: agencies }, { data: managers }] = await Promise.all([
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
        admin.from("agencies").select("id, name, owner_id, status").in("owner_id", ids),
        admin.from("branch_managers").select("user_id, agency_id, branch_id, full_name").in("user_id", ids),
      ]);

      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      const agencyByOwner = new Map<string, any>();
      (agencies ?? []).forEach((a: any) => agencyByOwner.set(a.owner_id, a));
      const managerByUser = new Map<string, any>();
      (managers ?? []).forEach((m: any) => managerByUser.set(m.user_id, m));

      const users = list.users.map((u) => {
        const banned = (u as any).banned_until && new Date((u as any).banned_until) > new Date();
        return {
          id: u.id,
          email: u.email,
          phone: u.phone,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
          banned_until: (u as any).banned_until ?? null,
          status: banned ? "disabled" : u.email_confirmed_at ? "active" : "pending",
          roles: rolesByUser.get(u.id) ?? [],
          agency: agencyByOwner.get(u.id) ?? null,
          manager: managerByUser.get(u.id) ?? null,
          full_name:
            (u.user_metadata as any)?.full_name ??
            managerByUser.get(u.id)?.full_name ??
            null,
        };
      });

      return json({ users });
    }

    const targetId = body.user_id as string;
    if (!targetId) return json({ error: "user_id requis" }, 400);
    if (targetId === userData.user.id && ["delete", "disable"].includes(action)) {
      return json({ error: "Vous ne pouvez pas effectuer cette action sur votre propre compte" }, 400);
    }

    if (action === "disable") {
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: "876000h", // ~100 years
      } as any);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, message: "Compte désactivé" });
    }

    if (action === "enable") {
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: "none",
      } as any);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, message: "Compte réactivé" });
    }

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, message: "Compte supprimé" });
    }

    if (action === "reset_password") {
      const { data: u, error: getErr } = await admin.auth.admin.getUserById(targetId);
      if (getErr || !u.user?.email) return json({ error: "Email introuvable" }, 400);
      const redirectTo = (body.redirect_to as string) || undefined;
      const { error } = await admin.auth.resetPasswordForEmail(u.user.email, {
        redirectTo,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, message: "Lien de réinitialisation envoyé" });
    }

    if (action === "set_password") {
      const newPassword = body.password as string;
      if (!newPassword || newPassword.length < 8) {
        return json({ error: "Mot de passe (≥ 8 caractères) requis" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        password: newPassword,
        user_metadata: { must_change_password: true },
      } as any);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, message: "Mot de passe défini" });
    }

    if (action === "set_role") {
      const role = body.role as string; // 'admin' | 'user' | null (remove all)
      // Remove existing roles then add the requested one
      const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", targetId);
      if (delErr) return json({ error: delErr.message }, 400);
      if (role) {
        const { error: insErr } = await admin
          .from("user_roles")
          .insert({ user_id: targetId, role });
        if (insErr) return json({ error: insErr.message }, 400);
      }
      return json({ ok: true, message: "Rôle mis à jour" });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
