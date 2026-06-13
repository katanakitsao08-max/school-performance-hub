import { supabase } from '@/integrations/supabase/client';

export type FeeAuditAction =
  | 'fee_charge_created'
  | 'fee_charge_updated'
  | 'fee_charge_deleted'
  | 'payment_recorded'
  | 'payment_voided'
  | 'receipt_generated'
  | 'sms_sent'
  | 'structure_created'
  | 'structure_updated'
  | 'structure_deleted';

interface LogOpts {
  schoolId: string;
  action: FeeAuditAction;
  entityType: string;
  entityId?: string | null;
  before?: any;
  after?: any;
}

/** Fire-and-forget fee audit logger. Never throws. */
export async function logFeeAudit(opts: LogOpts): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('fee_audit_log' as any).insert({
      school_id: opts.schoolId,
      actor_user_id: user?.id ?? null,
      action: opts.action,
      entity_type: opts.entityType,
      entity_id: opts.entityId ?? null,
      before: opts.before ?? null,
      after: opts.after ?? null,
    });
  } catch {
    // swallow — audit must never break the app
  }
}
