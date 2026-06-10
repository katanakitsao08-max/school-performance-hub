import { supabase } from '@/integrations/supabase/client';

export type ActivityAction =
  | 'login'
  | 'logout'
  | 'marks_entered'
  | 'report_generated'
  | 'sms_sent'
  | 'whatsapp_sent'
  | 'learner_created'
  | 'assessment_created'
  | 'attendance_marked'
  | 'fee_recorded';

interface LogOptions {
  action: ActivityAction;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, any>;
  school_id?: string | null;
  role?: string | null;
}

function detectDevice(ua: string) {
  const m = /mobile/i.test(ua);
  const t = /tablet|ipad/i.test(ua);
  return t ? 'tablet' : m ? 'mobile' : 'desktop';
}

/** Fire-and-forget activity logger. Never throws. */
export async function logActivity(opts: LogOptions) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    await supabase.from('user_activity_log').insert({
      user_id: user.id,
      school_id: opts.school_id ?? null,
      role: opts.role ?? null,
      action: opts.action,
      entity_type: opts.entity_type ?? null,
      entity_id: opts.entity_id ?? null,
      metadata: opts.metadata ?? {},
      device: detectDevice(ua),
      user_agent: ua.slice(0, 500),
    });
  } catch (e) {
    // swallow — telemetry must never break the app
  }
}
