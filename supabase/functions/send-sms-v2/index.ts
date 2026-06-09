// Olympus/OTS SMS sender (Bearer token). SINGLE global provider only.
// Endpoint: https://sms.ots.co.ke/api/v3/sms/send
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatPhone(phone: string): string {
  let p = (phone || '').toString().trim().replace(/\D/g, '');
  if (p.startsWith('254')) return p;
  if (p.startsWith('0')) return '254' + p.slice(1);
  if (p.startsWith('7') || p.startsWith('1')) return '254' + p;
  return p;
}
function isValidPhone(raw?: string | null): boolean {
  if (!raw) return false;
  const p = formatPhone(String(raw));
  return /^254[71]\d{8}$/.test(p);
}
function resolvePhone(phone?: string | null, phone_alt?: string | null) {
  if (isValidPhone(phone)) return { phone: formatPhone(phone!), source: phone_alt === undefined ? 'direct' : 'preferred' as const };
  if (isValidPhone(phone_alt)) return { phone: formatPhone(phone_alt!), source: 'secondary' as const };
  return { phone: null, source: null };
}
function segmentsFor(msg: string): number {
  const len = (msg || '').length;
  if (len === 0) return 1;
  return len <= 160 ? 1 : Math.ceil(len / 153);
}

interface Msg { phone: string; phone_alt?: string | null; message: string; learner_id?: string | null; }

function parseResult(httpOk: boolean, data: any) {
  if (!httpOk) {
    const msg = typeof data === 'string' ? data : (data?.message || JSON.stringify(data));
    return { ok: false, messageId: null, errorText: String(msg).slice(0, 500) };
  }
  if (typeof data === 'string') return { ok: true, messageId: null, errorText: null };
  const topStatus = String(data?.status || '').toLowerCase();
  const inner = data?.data || {};
  const innerStatus = String(inner?.status || '').toLowerCase();
  const messageId = inner?.queue_uid || inner?.messageid || inner?.message_id || inner?.id || null;
  const errorText = data?.message || inner?.message || null;
  if (topStatus === 'error' || topStatus === 'failed') return { ok: false, messageId: null, errorText: String(errorText || JSON.stringify(data)).slice(0, 500) };
  if (topStatus === 'success' || ['accepted','queued','sent','submitted','ok','success'].includes(innerStatus) || messageId) return { ok: true, messageId, errorText: null };
  return { ok: false, messageId: null, errorText: String(errorText || JSON.stringify(data)).slice(0, 500) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization') || '';
    const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    const userId = userData?.user?.id || null;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const school_id: string = body.school_id;
    const messages: Msg[] = Array.isArray(body.messages) ? body.messages : [];
    if (!school_id || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'school_id and messages required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // SINGLE global provider only.
    const { data: cfg } = await supabase.from('global_sms_config').select('*').eq('is_active', true).maybeSingle();
    if (!cfg) {
      return new Response(JSON.stringify({ error: 'SMS is not configured. Ask Super Admin to enable the global SMS provider.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const apiToken: string = (cfg.api_key || Deno.env.get('OTS_API_KEY') || '').trim();
    const senderId: string = ((cfg.sender_id || '').toString().trim() || 'PERFORMTRK').slice(0, 11);
    const endpoint: string = (cfg.endpoint || 'https://sms.ots.co.ke/api/v3/sms/send').trim();
    const msgType: string = (cfg.body_template?.type) || 'plain';
    if (!apiToken) {
      return new Response(JSON.stringify({ error: 'SMS API token not configured by Super Admin' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const totalSegments = messages.reduce((s, m) => s + segmentsFor(m.message), 0);

    // Super admins bypass per-school credit checks (they pay from a global pool / system).
    const { data: isSuperAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'super_admin' });
    const bypassCredits = !!isSuperAdmin;

    if (!bypassCredits) {
      const { data: deductOk } = await supabase.rpc('deduct_sms_credits', { _school_id: school_id, _amount: totalSegments });
      if (!deductOk) {
        return new Response(JSON.stringify({ error: 'Insufficient SMS credits or SMS disabled for this school', required: totalSegments }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const results: any[] = [];
    let sent = 0, failed = 0;
    const send = async (m: Msg) => {
      const resolved = resolvePhone(m.phone, m.phone_alt);
      if (!resolved.phone) {
        await supabase.from('sms_logs').insert({
          school_id, recipient: String(m.phone || ''), message: m.message, sender_id: senderId,
          provider: 'olympus_teleserve', status: 'failed', provider_message_id: null,
          error: 'No valid phone', segments: segmentsFor(m.message), sent_by: userId,
          used_global_fallback: true, phone_source: null,
        });
        return { phone: m.phone, ok: false, messageId: null, error: 'invalid phone', phone_source: null, response: null };
      }
      const phone = resolved.phone;
      const payload = { recipient: phone, sender_id: senderId, type: msgType, message: m.message };
      let httpOk = false, data: any = null;
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });
        httpOk = r.ok;
        try { data = await r.json(); } catch { data = await r.text(); }
      } catch (e) { data = String(e); }
      const parsed = parseResult(httpOk, data);
      await supabase.from('sms_logs').insert({
        school_id, recipient: phone, message: m.message, sender_id: senderId,
        provider: 'olympus_teleserve', status: parsed.ok ? 'sent' : 'failed',
        provider_message_id: parsed.messageId, error: parsed.ok ? null : parsed.errorText,
        segments: segmentsFor(m.message), sent_by: userId,
        used_global_fallback: true, phone_source: resolved.source,
      });
      return { phone, ok: parsed.ok, messageId: parsed.messageId, error: parsed.errorText, phone_source: resolved.source, response: data };
    };

    const BATCH = 10;
    for (let i = 0; i < messages.length; i += BATCH) {
      const settled = await Promise.all(messages.slice(i, i + BATCH).map(send));
      for (const r of settled) { r.ok ? sent++ : failed++; results.push(r); }
    }

    const failedSegments = results.reduce((s, r, i) => r.ok ? s : s + segmentsFor(messages[i].message), 0);
    if (failedSegments > 0) {
      const { data: cur } = await supabase.from('school_sms_credits').select('balance, used').eq('school_id', school_id).maybeSingle();
      if (cur) {
        await supabase.from('school_sms_credits').update({
          balance: (cur.balance || 0) + failedSegments,
          used: Math.max(0, (cur.used || 0) - failedSegments),
        }).eq('school_id', school_id);
      }
    }

    return new Response(JSON.stringify({ success: true, sent, failed, segments: totalSegments, provider: 'olympus_teleserve', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
