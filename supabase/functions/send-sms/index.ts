import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatPhone(phone: string) {
  let p = (phone || "").toString().trim().replace(/\s+/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  return p;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_TOKEN = Deno.env.get("OTS_API_KEY");
    if (!API_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: "OTS_API_KEY missing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const msg of messages) {
      try {
        const payload = {
          recipient: formatPhone(msg.phone),
          sender_id: msg.sender_id || "PROCALL",
          type: "plain",
          message: msg.message,
        };
        const response = await fetch("https://sms.ots.co.ke/api/v3/sms/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_TOKEN.trim()}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(payload),
        });
        let data: any = null;
        try { data = await response.json(); } catch { data = await response.text(); }
        results.push({ phone: msg.phone, formatted: payload.recipient, success: response.ok, response: data });
      } catch (error) {
        results.push({ phone: msg.phone, success: false, error: String(error) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
