// Cron-invoked. Locks scores past 21 days and notifies school admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const tables = ["scores", "strand_scores"] as const;
  const lockedSchools = new Set<string>();
  let totalLocked = 0;

  for (const t of tables) {
    const { data, error } = await supabase
      .from(t)
      .update({ status: "locked", locked_at: new Date().toISOString() })
      .eq("status", "submitted")
      .lt("submitted_at", cutoff)
      .select("school_id");
    if (error) {
      console.error(`lock ${t} error`, error);
      continue;
    }
    totalLocked += data?.length ?? 0;
    (data ?? []).forEach((r: any) => r.school_id && lockedSchools.add(r.school_id));
  }

  // notify admins of affected schools
  for (const school_id of lockedSchools) {
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id, profiles!inner(school_id)")
      .in("role", ["admin", "headteacher"])
      .eq("profiles.school_id", school_id);
    const rows = (admins ?? []).map((a: any) => ({
      user_id: a.user_id,
      school_id,
      title: "Performance records locked",
      message: "Performance records have been automatically locked after 21 days. Use Admin Override to make corrections.",
      type: "alert",
      metadata: { reason: "auto_lock_21_days" },
    }));
    if (rows.length) await supabase.from("notifications").insert(rows);
  }

  return new Response(JSON.stringify({ locked: totalLocked, schools: lockedSchools.size }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
