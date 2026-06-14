import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/mpesa.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);
    const url = new URL(req.url);
    const checkoutId = url.searchParams.get("checkout_request_id");
    if (!checkoutId) return j({ error: "Missing checkout_request_id" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await admin
      .from("billing_payments")
      .select("id, status, amount, receipt_number, mpesa_result_desc, subscription_id")
      .eq("mpesa_checkout_request_id", checkoutId)
      .maybeSingle();
    if (!data) return j({ status: "pending" });
    return j(data);
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
