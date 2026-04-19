// whatsapp-send: render a template + send (or queue) WhatsApp messages with SMS fallback.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  renderTemplate,
  enforceSchoolBranding,
  normalizePhoneKE,
  sendWhatsAppWithSmsFallback,
} from '../_shared/whatsapp-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Recipient {
  learner_id?: string | null;
  recipient: string;
  variables?: Record<string, string | number | null>;
}

interface Body {
  template_id: string;
  recipients: Recipient[];
  // If true, persist to whatsapp_queue for the worker rather than sending live.
  enqueue?: boolean;
  // Optional schedule for queued items
  scheduled_for?: string;
  // Optional override for share-link generation (report cards)
  generate_share_link?: { term: number; year: number; assessment_type: string; app_url: string };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ success: false, error: 'Not authenticated' }, 401);
    }

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
    if (!body.template_id || !Array.isArray(body.recipients) || !body.recipients.length) {
      return json({ success: false, error: 'template_id and recipients are required' }, 400);
    }

    const [{ data: tpl }, { data: school }, { data: settings }] = await Promise.all([
      admin.from('whatsapp_templates').select('*').eq('id', body.template_id).eq('school_id', schoolId).maybeSingle(),
      admin.from('schools').select('school_name').eq('id', schoolId).maybeSingle(),
      admin.from('whatsapp_settings').select('*').eq('school_id', schoolId).maybeSingle(),
    ]);

    if (!tpl) return json({ success: false, error: 'Template not found for this school' }, 404);
    if (!school?.school_name) return json({ success: false, error: 'School name not configured' }, 400);

    const enforce = settings?.enforce_school_branding ?? true;
    const apiKey = Deno.env.get('AFRICAS_TALKING_API_KEY');
    const username = Deno.env.get('AFRICAS_TALKING_USERNAME');
    if (!body.enqueue && (!apiKey || !username)) {
      return json({ success: false, error: 'WhatsApp credentials not configured' }, 500);
    }

    const results: any[] = [];

    for (const r of body.recipients) {
      const phone = normalizePhoneKE(r.recipient);
      const vars: Record<string, any> = { ...(r.variables ?? {}), school_name: school.school_name };

      // Optional: generate report-share link and inject as {{3}}
      if (body.generate_share_link && r.learner_id) {
        const token = genToken();
        const { data: link } = await admin
          .from('report_share_links')
          .insert({
            token,
            school_id: schoolId,
            learner_id: r.learner_id,
            term: body.generate_share_link.term,
            year: body.generate_share_link.year,
            assessment_type: body.generate_share_link.assessment_type,
            created_by: user.id,
          })
          .select('id')
          .single();
        if (link) vars['3'] = `${body.generate_share_link.app_url.replace(/\/+$/, '')}/r/${token}`;
      }

      const rendered = renderTemplate(tpl.body_text, vars, tpl.required_vars ?? []);
      let message = rendered.body;
      if (enforce) message = enforceSchoolBranding(message, school.school_name);

      if (rendered.missing.length) {
        results.push({
          recipient: r.recipient,
          status: 'failed',
          error: `Missing variables: ${rendered.missing.join(', ')}`,
        });
        await admin.from('report_delivery_log').insert({
          school_id: schoolId,
          learner_id: r.learner_id ?? null,
          template_id: tpl.id,
          channel: 'whatsapp',
          recipient: r.recipient,
          status: 'failed',
          error_message: `Missing variables: ${rendered.missing.join(', ')}`,
          message_body: message,
          failed_at: new Date().toISOString(),
          sent_by: user.id,
        });
        continue;
      }

      if (!phone) {
        results.push({ recipient: r.recipient, status: 'failed', error: 'Invalid phone number' });
        await admin.from('report_delivery_log').insert({
          school_id: schoolId,
          learner_id: r.learner_id ?? null,
          template_id: tpl.id,
          channel: 'whatsapp',
          recipient: r.recipient || 'n/a',
          status: 'failed',
          error_message: 'Invalid phone number',
          message_body: message,
          failed_at: new Date().toISOString(),
          sent_by: user.id,
        });
        continue;
      }

      if (body.enqueue) {
        await admin.from('whatsapp_queue').insert({
          school_id: schoolId,
          template_id: tpl.id,
          learner_id: r.learner_id ?? null,
          recipient: phone,
          variables: vars,
          rendered_message: message,
          scheduled_for: body.scheduled_for ?? new Date().toISOString(),
          created_by: user.id,
        });
        results.push({ recipient: phone, status: 'queued' });
        continue;
      }

      const send = await sendWhatsAppWithSmsFallback({
        apiKey: apiKey!,
        username: username!,
        to: phone,
        message,
      });

      await admin.from('report_delivery_log').insert({
        school_id: schoolId,
        learner_id: r.learner_id ?? null,
        template_id: tpl.id,
        channel: send.channel,
        recipient: phone,
        status: send.ok ? 'sent' : 'failed',
        provider_message_id: send.providerId,
        error_message: send.error,
        message_body: message,
        delivered_at: send.ok ? new Date().toISOString() : null,
        failed_at: send.ok ? null : new Date().toISOString(),
        sent_by: user.id,
      });

      results.push({
        recipient: phone,
        status: send.ok ? 'sent' : 'failed',
        channel: send.channel,
        error: send.error,
      });
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    const queued = results.filter((r) => r.status === 'queued').length;
    return json({
      success: true,
      sent,
      queued,
      failed: results.length - sent - queued,
      results,
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

function genToken(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}
