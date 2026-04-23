// whatsapp-send-raw: send a single ad-hoc rendered message (no template required).
// Used by the Live Composer for per-recipient streamed sending.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizePhoneKE, sendWhatsAppWithSmsFallback } from '../_shared/whatsapp-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  recipient: string;
  message: string;
  learner_id?: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'Not authenticated' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const caller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ success: false, error: 'Not authenticated' }, 401);

    const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
      admin.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
      admin.from('profiles').select('school_id').eq('user_id', user.id).maybeSingle(),
    ]);
    const role = roleRow?.role;
    const schoolId = profileRow?.school_id;
    if (!['admin', 'headteacher', 'super_admin'].includes(role)) {
      return json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    if (!schoolId) return json({ success: false, error: 'No school assigned' }, 400);

    const body = (await req.json()) as Body;
    if (!body.recipient || !body.message?.trim()) {
      return json({ success: false, error: 'recipient and message are required' }, 400);
    }
    if (body.message.length > 4000) {
      return json({ success: false, error: 'message too long' }, 400);
    }

    const phone = normalizePhoneKE(body.recipient);
    if (!phone) return json({ success: false, error: 'Invalid phone number' }, 400);

    const apiKey = Deno.env.get('AFRICAS_TALKING_API_KEY');
    const username = Deno.env.get('AFRICAS_TALKING_USERNAME');
    if (!apiKey || !username) {
      return json({ success: false, error: 'WhatsApp credentials not configured' }, 500);
    }

    const send = await sendWhatsAppWithSmsFallback({
      apiKey, username, to: phone, message: body.message,
    });

    await admin.from('report_delivery_log').insert({
      school_id: schoolId,
      learner_id: body.learner_id ?? null,
      template_id: null,
      channel: send.channel,
      recipient: phone,
      status: send.ok ? 'sent' : 'failed',
      provider_message_id: send.providerId,
      error_message: send.error,
      message_body: body.message,
      delivered_at: send.ok ? new Date().toISOString() : null,
      failed_at: send.ok ? null : new Date().toISOString(),
      sent_by: user.id,
    });

    return json({
      success: send.ok,
      channel: send.channel,
      provider_message_id: send.providerId,
      error: send.error,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
