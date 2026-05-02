// Olympus Teleserve v3 SMS sender with per-school metering & sender ID.
// Auth scheme: apikey + partnerID + shortcode (JSON body) on https://sms.ots.co.ke/api/v3/sms/send
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
  // GSM-7 fallback assumption (good enough for billing estimate)
  return len <= 160 ? 1 : Math.ceil(len / 153);
}

interface Msg { phone: string; message: string; learner_id?: string | null; }

function templateValue(value: unknown, ctx: Record<string, string>): unknown {
  if (typeof value === 'string') {
    return value.replace(/{{\s*(phone|message|sender_id|api_key|partner_id|partnerID)\s*}}/g, (_m, key) => {
      if (key === 'partnerID') return ctx.partner_id || ctx.partnerID || '';
      return ctx[key] ?? '';
    });
  }
  if (Array.isArray(value)) return value.map((v) => templateValue(v, ctx));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, templateValue(v, ctx)]));
  }
  return value;
}

function providerAccepted(response: Response, data: any): boolean {
  const item = data?.responses?.[0] || data?.response?.[0] || data?.data?.responses?.[0] || data;
  const code = item?.['respose-code'] ?? item?.['response-code'] ?? item?.respose_code ?? item?.response_code ?? item?.code;
  const description = String(item?.['response-description'] ?? item?.message ?? data?.message ?? '').toLowerCase();
  const messageId = item?.messageid ?? item?.messageId ?? item?.['message-id'] ?? data?.messageid ?? data?.['message-id'];
  return response.ok && (code === 200 || code === '200' || (!!messageId && !description.includes('invalid') && !description.includes('fail') && !description.includes('error')));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Auth: require user JWT for any non-public sender
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
    const sms_type: string = body.type || 'CUSTOM';
    if (!school_id || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'school_id and messages required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load per-school config (override) or global fallback
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

    // Required Olympus fields
    const apiKey = (cfg as any).api_key || Deno.env.get('OTS_API_KEY') || '';
    const bodyTemplate = (cfg as any).body_template || {};
    const partnerId = ((cfg as any).headers_json?.partnerID)
      || ((cfg as any).headers_json?.partner_id)
      || bodyTemplate?.body?.partnerID
      || bodyTemplate?.body?.partner_id
      || Deno.env.get('OTS_PARTNER_ID')
      || '';
    const senderId = ((schoolCfg as any)?.sender_id || (globalCfg as any)?.sender_id || 'PERFORMTRK')
      .toString().slice(0, 11);
    const endpoint = ((cfg as any).endpoint || 'https://sms.ots.co.ke/api/v3/sms/send').trim();

    if (!apiKey || !partnerId) {
      return new Response(JSON.stringify({ error: !apiKey ? 'Olympus API key missing' : 'Olympus partnerID missing' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cost (segments) for metering
    const totalSegments = messages.reduce((s, m) => s + segmentsFor(m.message), 0);
    const { data: deductOk } = await supabase.rpc('deduct_sms_credits', {
      _school_id: school_id, _amount: totalSegments,
    });
    if (!deductOk) {
      return new Response(JSON.stringify({
        error: 'Insufficient SMS credits or SMS disabled', required: totalSegments,
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Send (sequential with batching to avoid provider rate limits)
    const results: any[] = [];
    let sent = 0, failed = 0;

    const BATCH = 10;
    for (let i = 0; i < messages.length; i += BATCH) {
      const chunk = messages.slice(i, i + BATCH);
      const settled = await Promise.all(chunk.map(async (m) => {
        const phone = formatPhone(m.phone);
        const ctx = { phone, message: m.message, sender_id: senderId, api_key: apiKey, partner_id: partnerId, partnerID: partnerId };
        // Olympus v3 expects the JSON body directly, not the saved template wrapper metadata.
        const configuredPayload = bodyTemplate?.body
          ? templateValue(bodyTemplate.body, ctx)
          : (bodyTemplate && Object.keys(bodyTemplate).length ? templateValue(bodyTemplate, ctx) : null);
        const payload = configuredPayload || { apikey: apiKey, partnerID: partnerId, shortcode: senderId, mobile: phone, message: m.message };
        try {
          const r = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload),
          });
          let data: any = null;
          try { data = await r.json(); } catch { data = await r.text(); }
          // Olympus returns responses[].respose-code === 200 on real SMS acceptance.
          const ok = providerAccepted(r, data);
          const providerItem = data?.responses?.[0] || data?.response?.[0] || data;
          // Persist log
          await supabase.from('sms_logs').insert({
            school_id, recipient: phone, message: m.message, sender_id: senderId,
            provider: 'olympus_teleserve',
            status: ok ? 'sent' : 'failed',
            provider_message_id: providerItem?.messageid || providerItem?.messageId || providerItem?.['message-id'] || null,
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

    return new Response(JSON.stringify({ success: true, sent, failed, segments: totalSegments, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
