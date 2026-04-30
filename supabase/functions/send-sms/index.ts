import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ✅ Format Kenyan numbers correctly
function formatPhone(phone: string) {
  phone = phone.trim();

  if (phone.startsWith("0")) {
    return "254" + phone.substring(1);
  }

  if (phone.startsWith("+")) {
    return phone.replace("+", "");
  }

  return phone;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ✅ OTS credentials (UPDATED)
    const API_KEY = Deno.env.get("OTS_API_KEY");
    const PARTNER_ID = Deno.env.get("OTS_PARTNER_ID");

    if (!API_KEY || !PARTNER_ID) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "OTS credentials missing. Add OTS_API_KEY and OTS_PARTNER_ID as secrets.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const msg of messages) {
      try {
        // ✅ OTS payload format
        const payload = {
          body: {
            apikey: API_KEY,
            mobile: formatPhone(msg.phone),
            message: msg.message,
            partnerID: PARTNER_ID,
            shortcode: msg.sender_id || "PROCALL",
          },
          method: "POST",
          body_type: "json",
        };

        const response = await fetch("https://sms.ots.co.ke/api/v3/sms/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        // ✅ Proper success check
        const success = response.ok && data;

        results.push({
          phone: msg.phone,
          formatted: formatPhone(msg.phone),
          success,
          response: data,
        });
      } catch (error) {
        results.push({
          phone: msg.phone,
          success: false,
          error: String(error),
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
