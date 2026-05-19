import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("254")) return d;
  if (d.startsWith("0") && d.length === 10) return "254" + d.slice(1);
  if (d.length === 9) return "254" + d;
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { full_name, parent_name, parent_phone, grade, county, password } = body || {};

    if (!full_name || !parent_name || !parent_phone || !grade || !county || !password) {
      return new Response(JSON.stringify({ error: "All fields are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (String(password).length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalizePhone(parent_phone);
    if (phone.length < 12) {
      return new Response(JSON.stringify({ error: "Invalid phone number." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = `${phone}@learner.local`;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create auth user (auto-confirmed)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role_hint: "independent_learner" },
    });

    if (createErr || !created.user) {
      const msg = createErr?.message || "Could not create account.";
      const isDup = /already|registered|exists/i.test(msg);
      return new Response(
        JSON.stringify({ error: isDup ? "This phone number is already registered. Please log in instead." : msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = created.user.id;

    // Insert learner row
    const { data: learner, error: learnerErr } = await admin
      .from("independent_learners")
      .insert({
        user_id: userId,
        full_name: String(full_name).trim(),
        parent_name: String(parent_name).trim(),
        parent_phone: phone,
        grade: String(grade).trim(),
        county: String(county).trim(),
      })
      .select("id, learner_code")
      .single();

    if (learnerErr || !learner) {
      // Rollback auth user
      await admin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: learnerErr?.message || "Failed to create learner profile." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign role
    const { error: roleErr } = await admin.from("user_roles").insert({
      user_id: userId,
      role: "independent_learner",
    });

    if (roleErr) {
      await admin.from("independent_learners").delete().eq("id", learner.id);
      await admin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: roleErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        email,
        learner_id: learner.id,
        learner_code: learner.learner_code,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
