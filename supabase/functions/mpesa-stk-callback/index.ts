// Public Daraja callback. Idempotent.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/mpesa.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({}));
    console.log("mpesa callback", JSON.stringify(payload));
    const stk = payload?.Body?.stkCallback;
    if (!stk) return ok();

    const checkoutId: string = stk.CheckoutRequestID;
    const resultCode: number = stk.ResultCode;
    const resultDesc: string = stk.ResultDesc;
    const items: Array<{ Name: string; Value: any }> = stk.CallbackMetadata?.Item ?? [];
    const meta: Record<string, any> = {};
    for (const it of items) meta[it.Name] = it.Value;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: pay } = await admin
      .from("billing_payments")
      .select("id, status")
      .eq("mpesa_checkout_request_id", checkoutId)
      .maybeSingle();
    if (!pay) {
      console.warn("payment not found for", checkoutId);
      return ok();
    }
    if (["approved", "failed", "rejected"].includes(pay.status)) return ok();

    if (resultCode === 0) {
      await admin
        .from("billing_payments")
        .update({
          mpesa_result_code: resultCode,
          mpesa_result_desc: resultDesc,
          mpesa_raw: meta,
          reference: meta.MpesaReceiptNumber ?? null,
          receipt_number: meta.MpesaReceiptNumber ?? null,
          payment_date: new Date().toISOString().slice(0, 10),
        })
        .eq("id", pay.id);

      const { error: rpcErr } = await admin.rpc("activate_school_subscription", { _payment_id: pay.id });
      if (rpcErr) console.error("activate rpc error", rpcErr);
    } else {
      await admin
        .from("billing_payments")
        .update({
          status: "failed",
          mpesa_result_code: resultCode,
          mpesa_result_desc: resultDesc,
          mpesa_raw: stk,
        })
        .eq("id", pay.id);
    }
    return ok();
  } catch (e) {
    console.error("callback error", e);
    return ok(); // always 200 to Safaricom
  }
});

function ok() {
  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "ok" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
