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
        JSON.stringify({ 
          success: false, 
          error: 'Africa\'s Talking API credentials not configured. Add AFRICAS_TALKING_API_KEY and AFRICAS_TALKING_USERNAME as secrets.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    for (const msg of messages) {
      try {
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
        results.push({ phone: msg.phone, success: true, data });
      } catch (error) {
        results.push({ phone: msg.phone, success: false, error: String(error) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
