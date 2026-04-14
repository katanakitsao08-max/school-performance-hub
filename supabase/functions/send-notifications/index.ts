import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AT_API_KEY = Deno.env.get('AFRICAS_TALKING_API_KEY');
    const AT_USERNAME = Deno.env.get('AFRICAS_TALKING_USERNAME');

    if (!AT_API_KEY || !AT_USERNAME) {
      return new Response(
        JSON.stringify({ success: false, error: "Africa's Talking credentials not configured." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, messages, channel } = await req.json();
    // type: 'results_release' | 'fee_reminder' | 'attendance_alert'
    // channel: 'sms' | 'whatsapp' | 'both'
    // messages: Array<{ phone: string; message: string }>

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No messages provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    const sendChannels = channel === 'both' ? ['sms', 'whatsapp'] : [channel || 'sms'];

    for (const msg of messages) {
      for (const ch of sendChannels) {
        try {
          if (ch === 'whatsapp') {
            // Africa's Talking WhatsApp API (sandbox/production)
            const productId = AT_USERNAME === 'sandbox' ? 'sandbox' : AT_USERNAME;
            const response = await fetch('https://content.africastalking.com/version1/messaging', {
              method: 'POST',
              headers: {
                'apiKey': AT_API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
              },
              body: new URLSearchParams({
                username: AT_USERNAME,
                productName: productId,
                to: msg.phone,
                message: msg.message,
                channel: 'whatsapp',
              }),
            });
            const data = await response.json();
            results.push({ phone: msg.phone, channel: 'whatsapp', success: true, data });
          } else {
            // Standard SMS
            const response = await fetch('https://api.africastalking.com/version1/messaging', {
              method: 'POST',
              headers: {
                'apiKey': AT_API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
              },
              body: new URLSearchParams({
                username: AT_USERNAME,
                to: msg.phone,
                message: msg.message,
              }),
            });
            const data = await response.json();
            results.push({ phone: msg.phone, channel: 'sms', success: true, data });
          }
        } catch (error) {
          results.push({ phone: msg.phone, channel: ch, success: false, error: String(error) });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, type, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
