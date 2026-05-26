// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );
    const { data: userData } = await admin.auth.getUser(token);
    const caller = userData.user;
    if (!caller) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "super_admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { registration_id, action, reason } = await req.json();
    if (!registration_id || !["approve", "reject", "suspend"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reg, error: regErr } = await admin
      .from("teacher_registrations").select("*").eq("id", registration_id).single();
    if (regErr || !reg) throw regErr || new Error("Not found");

    const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "suspended";
    await admin.from("teacher_registrations").update({
      approval_status: newStatus,
      rejection_reason: action === "reject" ? (reason || null) : null,
      approved_by: caller.id,
      approved_at: new Date().toISOString(),
    }).eq("id", registration_id);

    if (action === "approve") {
      // Promote role pending_teacher -> teacher
      await admin.from("user_roles").delete().eq("user_id", reg.user_id).eq("role", "pending_teacher");
      await admin.from("user_roles").upsert({ user_id: reg.user_id, role: "teacher" }, { onConflict: "user_id,role" });
      // Ensure a class exists
      const { data: existingClass } = await admin
        .from("teacher_classes").select("id")
        .eq("teacher_user_id", reg.user_id).maybeSingle();
      if (!existingClass) {
        await admin.from("teacher_classes").insert({
          teacher_user_id: reg.user_id,
          pending_school_id: reg.pending_school_id,
          class_name: reg.class_name,
          stream: reg.stream,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
