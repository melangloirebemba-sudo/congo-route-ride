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

    // Fetch target email for the audit trail (best effort)
    let targetEmail: string | null = null;
    try {
      const { data: t } = await admin.auth.admin.getUserById(targetId);
      targetEmail = t.user?.email ?? null;
    } catch { /* ignore */ }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;
    const userAgent = req.headers.get("user-agent");

    const audit = async (
      status: "success" | "error",
      message?: string,
      metadata: Record<string, unknown> = {},
    ) => {
      try {
        await admin.from("admin_audit_logs").insert({
          actor_id: userData.user.id,
          actor_email: userData.user.email,
          action,
          target_user_id: targetId,
          target_email: targetEmail,
          metadata,
          status,
          error_message: status === "error" ? message ?? null : null,
          ip_address: ip,
          user_agent: userAgent,
        });
      } catch { /* logging must not break the action */ }
    };

    const run = async () => {
      if (action === "disable") {
        const { error } = await admin.auth.admin.updateUserById(targetId, {
          ban_duration: "876000h",
        } as any);
        if (error) return { error: error.message };
        return { message: "Compte désactivé" };
      }
      if (action === "enable") {
        const { error } = await admin.auth.admin.updateUserById(targetId, {
          ban_duration: "none",
        } as any);
        if (error) return { error: error.message };
        return { message: "Compte réactivé" };
      }
      if (action === "delete") {
        const { error } = await admin.auth.admin.deleteUser(targetId);
        if (error) return { error: error.message };
        return { message: "Compte supprimé" };
      }
      if (action === "reset_password") {
        if (!targetEmail) return { error: "Email introuvable" };
        const redirectTo = (body.redirect_to as string) || undefined;
        const { error } = await admin.auth.resetPasswordForEmail(targetEmail, { redirectTo });
        if (error) return { error: error.message };
        return { message: "Lien de réinitialisation envoyé", metadata: { redirect_to: redirectTo } };
      }
      if (action === "set_password") {
        const newPassword = body.password as string;
        if (!newPassword || newPassword.length < 8) {
          return { error: "Mot de passe (≥ 8 caractères) requis" };
        }
        const { error } = await admin.auth.admin.updateUserById(targetId, {
          password: newPassword,
          user_metadata: { must_change_password: true },
        } as any);
        if (error) return { error: error.message };
        return { message: "Mot de passe défini", metadata: { must_change_password: true } };
      }
      if (action === "set_role") {
        const role = body.role as string | null;
        const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", targetId);
        if (delErr) return { error: delErr.message };
        if (role) {
          const { error: insErr } = await admin
            .from("user_roles")
            .insert({ user_id: targetId, role });
          if (insErr) return { error: insErr.message };
        }
        return { message: "Rôle mis à jour", metadata: { role: role ?? "none" } };
      }
      return { error: "Action inconnue" };
    };

    const result = await run();
    if ("error" in result && result.error) {
      await audit("error", result.error);
      return json({ error: result.error }, 400);
    }
    await audit("success", undefined, (result as any).metadata ?? {});
    return json({ ok: true, message: (result as any).message });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

