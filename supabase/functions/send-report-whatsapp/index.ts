import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendItem {
  learner_id: string;
  recipient: string; // E.164 e.g. +2547XXXXXXXX
  full_name: string;
  grade: string;
}

interface RequestBody {
  items: SendItem[];
  term: number;
  year: number;
  assessment_type: string;
  app_url: string; // e.g. https://app.example.com
  school_name: string;
}

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let p = raw.trim().replace(/[\s\-()]/g, '');
  if (p.startsWith('07') || p.startsWith('01')) p = '+254' + p.slice(1);
  else if (p.startsWith('254')) p = '+' + p;
  else if (!p.startsWith('+')) return null;
  if (!/^\+\d{10,15}$/.test(p)) return null;
  return p;
}

function genToken(): string {
  // 32 hex chars
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendAfricasTalking(opts: {
  apiKey: string; username: string; to: string; message: string; channel: 'whatsapp' | 'sms';
}) {
  // Africa's Talking sandbox: WhatsApp uses a different endpoint that requires a paid plan.
  // The free sandbox only supports SMS. We attempt WhatsApp (Premium endpoint) first; on failure,
  // the caller falls back to SMS.
  const endpoint = opts.channel === 'whatsapp'
    ? 'https://content.africastalking.com/whatsapp/message/send'
    : 'https://api.africastalking.com/version1/messaging';

  const body = opts.channel === 'whatsapp'
    ? JSON.stringify({
        username: opts.username,
        waNumber: opts.to,
        body: { text: opts.message },
      })
    : new URLSearchParams({ username: opts.username, to: opts.to, message: opts.message }).toString();

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'apiKey': opts.apiKey,
      'Accept': 'application/json',
      'Content-Type': opts.channel === 'whatsapp' ? 'application/json' : 'application/x-www-form-urlencoded',
    },
    body,
  });

  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep text */ }

  if (!res.ok) {
    return { ok: false as const, providerId: null, error: `${opts.channel} ${res.status}: ${text.slice(0, 200)}` };
  }
  // SMS API returns SMSMessageData.Recipients[*].status === 'Success'
  if (opts.channel === 'sms') {
    const recip = json?.SMSMessageData?.Recipients?.[0];
    if (recip?.status === 'Success') {
      return { ok: true as const, providerId: recip.messageId || null, error: null };
    }
    return { ok: false as const, providerId: null, error: `sms: ${recip?.status || 'unknown'}` };
  }
  return { ok: true as const, providerId: json?.id || null, error: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Resolve role + school_id
    const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
      supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
      supabaseAdmin.from('profiles').select('school_id').eq('user_id', user.id).maybeSingle(),
    ]);
    const role = roleRow?.role;
    const schoolId = profileRow?.school_id;
    if (!['admin', 'headteacher', 'super_admin'].includes(role)) {
      return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!schoolId && role !== 'super_admin') {
      return new Response(JSON.stringify({ success: false, error: 'No school assigned' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json() as RequestBody;
    if (!body?.items?.length) {
      return new Response(JSON.stringify({ success: false, error: 'No recipients' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('AFRICAS_TALKING_API_KEY');
    const username = Deno.env.get('AFRICAS_TALKING_USERNAME');
    if (!apiKey || !username) {
      return new Response(JSON.stringify({
        success: false, error: 'Africa\'s Talking credentials not configured',
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const appUrl = (body.app_url || '').replace(/\/+$/, '');
    const results: any[] = [];

    for (const item of body.items) {
      const phone = normalizePhone(item.recipient);
      if (!phone) {
        results.push({ learner_id: item.learner_id, status: 'failed', error: 'Invalid phone number' });
        await supabaseAdmin.from('report_delivery_log').insert({
          school_id: schoolId, learner_id: item.learner_id, channel: 'whatsapp',
          recipient: item.recipient || 'n/a', status: 'failed',
          error_message: 'Invalid phone number', sent_by: user.id,
        });
        continue;
      }

      // 1. Create share token
      const token = genToken();
      const { data: linkRow, error: linkErr } = await supabaseAdmin
        .from('report_share_links')
        .insert({
          token, school_id: schoolId, learner_id: item.learner_id,
          term: body.term, year: body.year, assessment_type: body.assessment_type,
          created_by: user.id,
        })
        .select('id, expires_at')
        .single();

      if (linkErr || !linkRow) {
        results.push({ learner_id: item.learner_id, status: 'failed', error: 'Could not create share link' });
        continue;
      }

      const url = `${appUrl}/r/${token}`;
      const message =
        `Hello, this is ${body.school_name}.\n` +
        `Here is the report card for ${item.full_name}, Grade ${item.grade}, Term ${body.term}.\n` +
        `View/Download: ${url}\n` +
        `(Link expires in 48 hours)`;

      // 2. Try WhatsApp, fall back to SMS
      let send = await sendAfricasTalking({ apiKey, username, to: phone, message, channel: 'whatsapp' });
      let usedChannel: 'whatsapp' | 'sms' = 'whatsapp';
      if (!send.ok) {
        // fallback
        const smsSend = await sendAfricasTalking({ apiKey, username, to: phone, message, channel: 'sms' });
        if (smsSend.ok) { send = smsSend; usedChannel = 'sms'; }
      }

      await supabaseAdmin.from('report_delivery_log').insert({
        school_id: schoolId,
        learner_id: item.learner_id,
        share_link_id: linkRow.id,
        channel: usedChannel,
        recipient: phone,
        status: send.ok ? 'sent' : 'failed',
        provider_message_id: send.providerId,
        error_message: send.error,
        sent_by: user.id,
      });

      results.push({
        learner_id: item.learner_id,
        status: send.ok ? 'sent' : 'failed',
        channel: usedChannel,
        url,
        error: send.error,
      });
    }

    const sent = results.filter(r => r.status === 'sent').length;
    return new Response(JSON.stringify({
      success: true, sent, failed: results.length - sent, results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
