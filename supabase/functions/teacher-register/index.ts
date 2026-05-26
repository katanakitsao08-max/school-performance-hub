// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const required = ["full_name", "email", "phone", "password", "school_name", "county", "class_name"];
    for (const k of required) {
      if (!body?.[k] || String(body[k]).trim() === "") {
        return new Response(JSON.stringify({ error: `Missing ${k}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (String(body.password).length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Dedupe pending school
    const norm = normalizeName(body.school_name);
    let { data: existing } = await admin
      .from("pending_schools").select("id").eq("normalized_name", norm).maybeSingle();
    let pendingSchoolId = existing?.id as string | undefined;
    if (!pendingSchoolId) {
      const { data: ins, error: insErr } = await admin
        .from("pending_schools")
        .insert({ school_name: body.school_name, normalized_name: norm, county: body.county || "" })
        .select("id").single();
      if (insErr) throw insErr;
      pendingSchoolId = ins.id;
    }

    // Create auth user (auto-confirm so they can sign in to see the waiting page)
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });
    if (authErr || !created.user) {
      return new Response(JSON.stringify({ error: authErr?.message || "Could not create user" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = created.user.id;

    // Profile (handle_new_user trigger may have made one already)
    await admin.from("profiles").upsert({ user_id: userId, full_name: body.full_name }, { onConflict: "user_id" });

    // Role
    await admin.from("user_roles").insert({ user_id: userId, role: "pending_teacher" });

    // Registration row
    const { error: regErr } = await admin.from("teacher_registrations").insert({
      user_id: userId,
      full_name: body.full_name,
      email: body.email,
      phone: body.phone,
      tsc_number: body.tsc_number || null,
      school_name_raw: body.school_name,
      pending_school_id: pendingSchoolId,
      county: body.county,
      class_name: body.class_name,
      stream: body.stream || "A",
      approval_status: "pending",
    });
    if (regErr) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      throw regErr;
    }

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
