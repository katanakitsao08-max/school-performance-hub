// Olympus/OTS SMS sender (Bearer token auth) with per-school metering & sender ID.
// Endpoint: https://sms.ots.co.ke/api/v3/sms/send
// Auth: Authorization: Bearer <API_TOKEN>
// Body: { recipient, sender_id, type, message }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatPhone(phone: string): string {
  let p = (phone || '').toString().trim().replace(/\s+/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
  return p;
}

function segmentsFor(msg: string): number {
  const len = (msg || '').length;
  if (len === 0) return 1;
  return len <= 160 ? 1 : Math.ceil(len / 153);
}

interface Msg { phone: string; message: string; learner_id?: string | null; }

function providerAccepted(response: Response, data: any): boolean {
  if (!response.ok) return false;
  if (typeof data === 'string') {
    const t = data.toLowerCase();
    if (t.includes('unauthenticated') || t.includes('unauthorized') || t.includes('invalid') || t.includes('error') || t.includes('fail')) return false;
    return true;
  }
  const item = data?.data ?? data?.responses?.[0] ?? data?.response?.[0] ?? data;
  const status = String(item?.status ?? data?.status ?? '').toLowerCase();
  const description = String(item?.message ?? data?.message ?? item?.description ?? '').toLowerCase();
  const messageId = item?.messageid ?? item?.message_id ?? item?.id ?? data?.messageid ?? data?.message_id;

  // Hard-fail on any explicit error indicators (status field OR message text)
  if (status === 'error' || status === 'failed' || status === 'rejected') return false;
  if (description.includes('unauthenticated') || description.includes('unauthorized') ||
      description.includes('invalid') || description.includes('fail') ||
      description.includes('error') || description.includes('insufficient') ||
      description.includes('rejected') || description.includes('blocked')) return false;

  // Explicit success
  if (status === 'success' || status === 'ok' || status === 'sent' || status === 'queued' || status === 'submitted') return true;
  if (messageId) return true;

  // Ambiguous 2xx with no clear signal → treat as failure (safer)
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(jwt);
    const userId = userData?.user?.id || null;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const school_id: string = body.school_id;
    const messages: Msg[] = Array.isArray(body.messages) ? body.messages : [];
    if (!school_id || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'school_id and messages required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: schoolCfg } = await supabase.from('school_sms_config')
      .select('*').eq('school_id', school_id).eq('is_active', true).maybeSingle();
    const { data: globalCfg } = await supabase.from('global_sms_config')
      .select('*').eq('is_active', true).maybeSingle();

    const cfg = schoolCfg || globalCfg;
    const usedFallback = !schoolCfg && !!globalCfg;
    if (!cfg) {
      return new Response(JSON.stringify({ error: 'No active SMS configuration' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiToken = (cfg as any).api_key || Deno.env.get('OTS_API_KEY') || '';
    const senderId = ((schoolCfg as any)?.sender_id || (globalCfg as any)?.sender_id || 'PROCALL')
      .toString().trim().slice(0, 11);
    const endpoint = ((cfg as any).endpoint || 'https://sms.ots.co.ke/api/v3/sms/send').trim();
    const msgType: string = ((cfg as any).body_template?.type) || 'plain';

    if (!apiToken) {
      return new Response(JSON.stringify({ error: 'Olympus API token missing' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalSegments = messages.reduce((s, m) => s + segmentsFor(m.message), 0);
    const { data: deductOk } = await supabase.rpc('deduct_sms_credits', {
      _school_id: school_id, _amount: totalSegments,
    });
    if (!deductOk) {
      return new Response(JSON.stringify({
        error: 'Insufficient SMS credits or SMS disabled', required: totalSegments,
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: any[] = [];
    let sent = 0, failed = 0;

    const BATCH = 10;
    for (let i = 0; i < messages.length; i += BATCH) {
      const chunk = messages.slice(i, i + BATCH);
      const settled = await Promise.all(chunk.map(async (m) => {
        const phone = formatPhone(m.phone);
        const payload = {
          recipient: phone,
          sender_id: senderId,
          type: msgType,
          message: m.message,
        };
        try {
          const r = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken.trim()}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          let data: any = null;
          try { data = await r.json(); } catch { data = await r.text(); }
          const ok = providerAccepted(r, data);
          const item = data?.data ?? data?.responses?.[0] ?? data?.response?.[0] ?? data;
          await supabase.from('sms_logs').insert({
            school_id, recipient: phone, message: m.message, sender_id: senderId,
            provider: 'olympus_teleserve',
            status: ok ? 'sent' : 'failed',
            provider_message_id: item?.messageid || item?.message_id || item?.id || null,
            error: ok ? null : (typeof data === 'string' ? data.slice(0, 500) : JSON.stringify(data).slice(0, 500)),
            segments: segmentsFor(m.message),
            sent_by: userId,
            used_global_fallback: usedFallback,
          });
          return { phone, ok, data };
        } catch (e) {
          await supabase.from('sms_logs').insert({
            school_id, recipient: phone, message: m.message, sender_id: senderId,
            provider: 'olympus_teleserve', status: 'failed',
            error: String(e).slice(0, 500), segments: segmentsFor(m.message),
            sent_by: userId, used_global_fallback: usedFallback,
          });
          return { phone, ok: false, error: String(e) };
        }
      }));
      for (const r of settled) { r.ok ? sent++ : failed++; results.push(r); }
    }

    // Refund credits for failed segments so users aren't billed for undelivered SMS
    const failedSegments = results.reduce((s: number, r: any, i: number) => r.ok ? s : s + segmentsFor(messages[i].message), 0);
    if (failedSegments > 0) {
      await supabase.from('school_sms_credits')
        .update({ balance: undefined })
        .eq('school_id', school_id);
      // Use raw RPC-style increment via update
      await supabase.rpc('deduct_sms_credits', { _school_id: school_id, _amount: -failedSegments }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, sent, failed, segments: totalSegments, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
