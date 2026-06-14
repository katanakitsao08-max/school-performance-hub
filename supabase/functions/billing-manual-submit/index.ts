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
    const { data: claims, error: cErr } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    if (cErr || !claims?.claims) return j({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const { plan_id, billing_cycle, amount, method, reference, payment_date, proof_url, notes } = body;
    if (!billing_cycle || !amount || !method || !reference) return j({ error: "Missing fields" }, 400);
    if (!["bank","eft","cash","mobile_money","cheque"].includes(method)) return j({ error: "Invalid method" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await admin.from("profiles").select("school_id").eq("user_id", userId).maybeSingle();
    if (!profile?.school_id) return j({ error: "No school" }, 400);

    const { data, error } = await admin.from("billing_payments").insert({
      school_id: profile.school_id,
      plan_id: plan_id ?? null,
      billing_cycle,
      amount: Number(amount),
      method,
      reference,
      payment_date: payment_date ?? new Date().toISOString().slice(0,10),
      proof_url: proof_url ?? null,
      notes: notes ?? null,
      status: "submitted",
      created_by: userId,
    }).select("id").single();
    if (error) {
      if ((error as any).code === "23505") return j({ error: "Duplicate reference for this method" }, 409);
      throw error;
    }
    return j({ ok: true, payment_id: data.id });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
