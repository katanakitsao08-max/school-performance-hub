import { createClient } from "npm:@supabase/supabase-js@2";
import { stkPush, normalizeMsisdn, corsHeaders } from "../_shared/mpesa.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: cErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const planId = body.plan_id as string | undefined;
    const cycle = body.billing_cycle as "monthly" | "term" | "annual" | "custom";
    const phone = body.phone as string;
    const amountIn = Number(body.amount);
    if (!cycle || !phone || !amountIn || amountIn < 1) return json({ error: "Missing fields" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // resolve school
    const { data: profile } = await admin.from("profiles").select("school_id").eq("user_id", userId).maybeSingle();
    const schoolId = profile?.school_id;
    if (!schoolId) return json({ error: "No school for user" }, 400);

    const { data: school } = await admin.from("schools").select("school_name, school_code").eq("id", schoolId).maybeSingle();
    const ref = (school?.school_code || "PT").slice(0, 12);
    const phoneNorm = normalizeMsisdn(phone);

    // initiate STK
    const stk = await stkPush({
      phone: phoneNorm,
      amount: amountIn,
      accountReference: ref,
      description: "Subscription",
    });

    // insert payment row
    const { data: pay, error: pErr } = await admin.from("billing_payments").insert({
      school_id: schoolId,
      plan_id: planId ?? null,
      billing_cycle: cycle,
      method: "mpesa_stk",
      amount: amountIn,
      status: "pending",
      mpesa_checkout_request_id: stk.CheckoutRequestID,
      mpesa_merchant_request_id: stk.MerchantRequestID,
      mpesa_phone: phoneNorm,
      created_by: userId,
    }).select("id").single();
    if (pErr) throw pErr;

    return json({
      ok: true,
      payment_id: pay.id,
      checkout_request_id: stk.CheckoutRequestID,
    });
  } catch (e) {
    console.error("billing-stk-initiate error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
