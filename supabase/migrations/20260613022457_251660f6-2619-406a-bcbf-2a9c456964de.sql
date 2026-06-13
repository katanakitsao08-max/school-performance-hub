
ALTER TABLE public.fee_records
  ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'charge',
  ADD COLUMN IF NOT EXISTS allocation_parent_id uuid REFERENCES public.fee_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allocation_mode text,
  ADD COLUMN IF NOT EXISTS payer_phone text;

CREATE INDEX IF NOT EXISTS idx_fee_records_allocation_parent ON public.fee_records(allocation_parent_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_learner_live ON public.fee_records(learner_id) WHERE voided_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fee_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.fee_audit_log TO authenticated;
GRANT ALL ON public.fee_audit_log TO service_role;

ALTER TABLE public.fee_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fee audit log: school staff read" ON public.fee_audit_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR school_id = public.get_user_school_id(auth.uid())
  );

CREATE POLICY "Fee audit log: school staff insert" ON public.fee_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR school_id = public.get_user_school_id(auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_fee_audit_log_school ON public.fee_audit_log(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fee_audit_log_entity ON public.fee_audit_log(entity_type, entity_id);
