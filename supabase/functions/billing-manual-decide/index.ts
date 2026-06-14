// Super-admin approves or rejects a manual payment.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/mpesa.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return j({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
    if (!roleRow) return j({ error: "Forbidden" }, 403);

    const { payment_id, action, reason } = await req.json();
    if (!payment_id || !["approve","reject"].includes(action)) return j({ error: "Bad request" }, 400);

    if (action === "approve") {
      await admin.from("billing_payments").update({ approved_by: userId }).eq("id", payment_id);
      const { error } = await admin.rpc("activate_school_subscription", { _payment_id: payment_id });
      if (error) throw error;
      return j({ ok: true });
    } else {
      const { data: pay } = await admin.from("billing_payments").select("school_id").eq("id", payment_id).maybeSingle();
      await admin.from("billing_payments").update({
        status: "rejected",
        rejected_reason: reason ?? "Not approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      }).eq("id", payment_id);
      await admin.from("billing_audit_log").insert({
        actor_user_id: userId,
        school_id: pay?.school_id ?? null,
        action: "reject_manual_payment",
        target_table: "billing_payments",
        target_id: payment_id,
        metadata: { reason: reason ?? null },
      });
      return j({ ok: true });
    }
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
