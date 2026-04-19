// whatsapp-queue-worker: drains queued/scheduled messages. Designed to be invoked by pg_cron OR manually.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendWhatsAppWithSmsFallback } from '../_shared/whatsapp-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 25;
const RATE_LIMIT_MS = 200; // ~5 msgs/sec

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const apiKey = Deno.env.get('AFRICAS_TALKING_API_KEY');
    const username = Deno.env.get('AFRICAS_TALKING_USERNAME');
    if (!apiKey || !username) {
      return json({ success: false, error: 'AT credentials missing' }, 500);
    }

    // 1. Materialize due schedules into queue entries
    const { data: dueSchedules } = await admin
      .from('whatsapp_schedules')
      .select('*')
      .eq('is_active', true)
      .lte('run_at', new Date().toISOString())
      .limit(20);

    for (const s of dueSchedules ?? []) {
      // Resolve recipients: very simple — for grade/stream/school we read learners.parent_phone.
      let q = admin.from('learners').select('id, full_name, grade, parent_name, parent_phone').eq('school_id', s.school_id).eq('is_active', true);
      if (s.target_scope === 'grade' && s.target_grade) q = q.eq('grade', s.target_grade);
      if (s.target_scope === 'stream' && s.target_stream) q = q.eq('stream', s.target_stream);
      if (s.target_scope === 'class' && s.target_grade && s.target_stream) {
        q = q.eq('grade', s.target_grade).eq('stream', s.target_stream);
      }
      const { data: learners } = await q;
      const recipients = (s.target_scope === 'custom' ? [] : (learners ?? []))
        .filter((l: any) => l.parent_phone);
      for (const l of recipients) {
        await admin.from('whatsapp_queue').insert({
          school_id: s.school_id,
          template_id: s.template_id,
          learner_id: l.id,
          recipient: l.parent_phone,
          variables: { ...(s.variables ?? {}), 1: l.parent_name ?? '', 2: l.full_name },
          scheduled_for: new Date().toISOString(),
          created_by: s.created_by,
        });
      }
      await admin.from('whatsapp_schedules').update({
        last_run_at: new Date().toISOString(),
        is_active: false, // one-shot for now
      }).eq('id', s.id);
    }

    // 2. Drain queue
    const { data: queueRows } = await admin
      .from('whatsapp_queue')
      .select('*, whatsapp_templates(body_text, required_vars), schools(school_name), whatsapp_settings(enforce_school_branding)')
      .in('status', ['queued', 'failed'])
      .lte('scheduled_for', new Date().toISOString())
      .lt('attempt_count', 3)
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE);

    const processed: any[] = [];
    for (const row of queueRows ?? []) {
      // mark processing
      await admin.from('whatsapp_queue').update({ status: 'processing', last_attempt_at: new Date().toISOString() }).eq('id', row.id);

      const message = row.rendered_message ?? row.whatsapp_templates?.body_text ?? '';
      const send = await sendWhatsAppWithSmsFallback({
        apiKey, username, to: row.recipient, message,
      });

      const newAttempts = (row.attempt_count ?? 0) + 1;
      await admin.from('whatsapp_queue').update({
        status: send.ok ? 'sent' : (newAttempts >= row.max_attempts ? 'failed' : 'queued'),
        attempt_count: newAttempts,
        sent_at: send.ok ? new Date().toISOString() : null,
        channel_used: send.channel,
        provider_message_id: send.providerId,
        error_message: send.error,
      }).eq('id', row.id);

      await admin.from('report_delivery_log').insert({
        school_id: row.school_id,
        learner_id: row.learner_id,
        template_id: row.template_id,
        channel: send.channel,
        recipient: row.recipient,
        status: send.ok ? 'sent' : 'failed',
        provider_message_id: send.providerId,
        error_message: send.error,
        message_body: message,
        delivered_at: send.ok ? new Date().toISOString() : null,
        failed_at: send.ok ? null : new Date().toISOString(),
        sent_by: row.created_by,
      });

      processed.push({ id: row.id, ok: send.ok, channel: send.channel });
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }

    return json({ success: true, scheduled_materialized: dueSchedules?.length ?? 0, processed: processed.length, results: processed });
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
