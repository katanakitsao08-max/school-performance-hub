// Admin/Headteacher only — unlock + edit + audit a locked score row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Body = {
  table: "scores" | "strand_scores";
  score_id: string;
  new_value: Record<string, any>; // e.g. { score: 78, teacher_comment: "…" }
  reason: string;
  relock?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const role = roleRow?.role;
    if (!["admin", "super_admin"].includes(role)) {
      return json({ error: "forbidden" }, 403);
    }

    const body = (await req.json()) as Body;
    if (!body?.table || !body?.score_id || !body?.reason || !body?.new_value) {
      return json({ error: "missing fields" }, 400);
    }
    if (!["scores", "strand_scores"].includes(body.table)) {
      return json({ error: "invalid table" }, 400);
    }

    const { data: existing, error: fetchErr } = await admin
      .from(body.table).select("*").eq("id", body.score_id).maybeSingle();
    if (fetchErr || !existing) return json({ error: "not found" }, 404);

    const allowed: Record<string, true> = body.table === "scores"
      ? { score: true, teacher_comment: true }
      : { score: true, competency_level: true, teacher_comment: true };
    const update: Record<string, any> = {};
    for (const k of Object.keys(body.new_value)) {
      if (allowed[k]) update[k] = body.new_value[k];
    }
    update.edited_at = new Date().toISOString();
    update.edited_by = user.id;
    update.unlocked_at = new Date().toISOString();
    update.unlocked_by = user.id;
    update.unlock_reason = body.reason;
    update.status = body.relock === false ? "unlocked" : "locked";
    if (update.status === "locked") {
      update.locked_at = new Date().toISOString();
      update.locked_by = user.id;
    }

    const { error: updErr } = await admin
      .from(body.table).update(update).eq("id", body.score_id);
    if (updErr) return json({ error: updErr.message }, 400);

    const previous: Record<string, any> = {};
    const next: Record<string, any> = {};
    for (const k of Object.keys(allowed)) {
      previous[k] = existing[k];
      next[k] = update[k] ?? existing[k];
    }

    await admin.from("score_audit_log").insert({
      score_table: body.table,
      score_id: body.score_id,
      learner_id: existing.learner_id,
      learning_area_id: existing.learning_area_id ?? null,
      strand_id: existing.strand_id ?? null,
      school_id: existing.school_id,
      actor_user_id: user.id,
      action: "edit",
      previous_value: previous,
      new_value: next,
      reason: body.reason,
    });

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
