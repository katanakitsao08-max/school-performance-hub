
-- =========================================================
-- 1. Extend subscription_plans
-- =========================================================
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS price_term numeric,
  ADD COLUMN IF NOT EXISTS price_annual numeric,
  ADD COLUMN IF NOT EXISTS allow_custom_pricing boolean NOT NULL DEFAULT false;

-- =========================================================
-- 2. Extend schools with grace tracking
-- =========================================================
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS subscription_grace_until timestamptz;

-- =========================================================
-- 3. school_subscriptions
-- =========================================================
CREATE TABLE IF NOT EXISTS public.school_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','term','annual','custom')),
  amount numeric NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('active','pending_payment','trial','suspended','expired')),
  grace_days int NOT NULL DEFAULT 7,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_school_subs_school ON public.school_subscriptions(school_id);
CREATE INDEX IF NOT EXISTS idx_school_subs_status ON public.school_subscriptions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_subscriptions TO authenticated;
GRANT ALL ON public.school_subscriptions TO service_role;
ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school members can read own subs"
  ON public.school_subscriptions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR school_id = public.get_user_school_id(auth.uid())
  );
CREATE POLICY "super admin can insert subs"
  ON public.school_subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "super admin can update subs"
  ON public.school_subscriptions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "super admin can delete subs"
  ON public.school_subscriptions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_school_subs_updated_at
  BEFORE UPDATE ON public.school_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4. billing_payments
-- =========================================================
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.school_subscriptions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.subscription_plans(id),
  billing_cycle text CHECK (billing_cycle IN ('monthly','term','annual','custom')),
  method text NOT NULL
    CHECK (method IN ('mpesa_stk','bank','eft','cash','mobile_money','cheque')),
  amount numeric NOT NULL,
  reference text,
  receipt_number text,
  payment_date date,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','approved','rejected','failed')),
  -- mpesa
  mpesa_checkout_request_id text UNIQUE,
  mpesa_merchant_request_id text,
  mpesa_phone text,
  mpesa_result_code int,
  mpesa_result_desc text,
  mpesa_raw jsonb,
  -- manual
  proof_url text,
  notes text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rejected_reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bp_school ON public.billing_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_bp_status ON public.billing_payments(status);
CREATE INDEX IF NOT EXISTS idx_bp_method ON public.billing_payments(method);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bp_manual_ref
  ON public.billing_payments(school_id, method, reference)
  WHERE reference IS NOT NULL AND method <> 'mpesa_stk';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_payments TO authenticated;
GRANT ALL ON public.billing_payments TO service_role;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own school payments"
  ON public.billing_payments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR school_id = public.get_user_school_id(auth.uid())
  );
CREATE POLICY "members create payments for own school"
  ON public.billing_payments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND status IN ('pending','submitted')
    )
  );
CREATE POLICY "super admin updates payments"
  ON public.billing_payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "super admin deletes payments"
  ON public.billing_payments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_bp_updated_at
  BEFORE UPDATE ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 5. billing_invoices
-- =========================================================
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.school_subscriptions(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.billing_payments(id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'issued'
    CHECK (status IN ('draft','issued','paid','void')),
  pdf_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bi_school ON public.billing_invoices(school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_invoices TO authenticated;
GRANT ALL ON public.billing_invoices TO service_role;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own school invoices"
  ON public.billing_invoices FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR school_id = public.get_user_school_id(auth.uid())
  );
CREATE POLICY "super admin manages invoices"
  ON public.billing_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_bi_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 6. billing_audit_log
-- =========================================================
CREATE TABLE IF NOT EXISTS public.billing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bal_school ON public.billing_audit_log(school_id);
CREATE INDEX IF NOT EXISTS idx_bal_action ON public.billing_audit_log(action);

GRANT SELECT ON public.billing_audit_log TO authenticated;
GRANT ALL ON public.billing_audit_log TO service_role;
ALTER TABLE public.billing_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin reads audit log"
  ON public.billing_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- =========================================================
-- 7. Helper functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_billing_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr text := to_char(now(),'YYYY');
  next_seq int;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN invoice_number ~ ('^INV-' || yr || '-[0-9]+$')
      THEN (regexp_replace(invoice_number, '^INV-' || yr || '-',''))::int
      ELSE 0 END
  ),0)+1
  INTO next_seq FROM public.billing_invoices;
  RETURN 'INV-' || yr || '-' || lpad(next_seq::text, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION public.activate_school_subscription(_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  new_end date;
  sub_id uuid;
  invoice_id uuid;
  starting date := CURRENT_DATE;
BEGIN
  SELECT * INTO p FROM public.billing_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found'; END IF;
  IF p.status = 'approved' THEN RETURN p.subscription_id; END IF;

  -- compute new end date
  new_end := CASE p.billing_cycle
    WHEN 'monthly' THEN starting + INTERVAL '1 month'
    WHEN 'term'    THEN starting + INTERVAL '4 months'
    WHEN 'annual'  THEN starting + INTERVAL '1 year'
    ELSE starting + INTERVAL '1 month'
  END;

  -- extend if school already has active sub
  SELECT id INTO sub_id FROM public.school_subscriptions
   WHERE school_id = p.school_id AND status IN ('active','trial')
   ORDER BY end_date DESC LIMIT 1;

  IF sub_id IS NOT NULL THEN
    UPDATE public.school_subscriptions
       SET end_date = GREATEST(end_date, CURRENT_DATE) + (new_end - CURRENT_DATE),
           status = 'active',
           plan_id = COALESCE(p.plan_id, plan_id),
           updated_at = now()
     WHERE id = sub_id
     RETURNING end_date INTO new_end;
  ELSE
    INSERT INTO public.school_subscriptions
      (school_id, plan_id, billing_cycle, amount, start_date, end_date, status, created_by)
    VALUES
      (p.school_id, p.plan_id, COALESCE(p.billing_cycle,'monthly'),
       p.amount, starting, new_end, 'active', p.created_by)
    RETURNING id INTO sub_id;
  END IF;

  -- update school
  UPDATE public.schools
     SET plan_id = COALESCE(p.plan_id, plan_id),
         plan_expires_at = new_end::timestamptz,
         subscription_status = 'active',
         subscription_grace_until = (new_end + INTERVAL '7 days')::timestamptz,
         updated_at = now()
   WHERE id = p.school_id;

  -- mark payment approved
  UPDATE public.billing_payments
     SET status = 'approved',
         subscription_id = sub_id,
         approved_at = now(),
         approved_by = COALESCE(approved_by, auth.uid()),
         receipt_number = COALESCE(receipt_number,
           CASE WHEN method = 'mpesa_stk'
                THEN COALESCE(mpesa_raw->>'MpesaReceiptNumber', reference)
                ELSE reference END)
   WHERE id = _payment_id;

  -- create invoice
  INSERT INTO public.billing_invoices
    (school_id, subscription_id, payment_id, invoice_number, amount, status)
  VALUES
    (p.school_id, sub_id, _payment_id, public.generate_billing_invoice_number(),
     p.amount, 'paid')
  RETURNING id INTO invoice_id;

  -- audit
  INSERT INTO public.billing_audit_log
    (actor_user_id, school_id, action, target_table, target_id, metadata)
  VALUES
    (auth.uid(), p.school_id, 'activate_subscription', 'billing_payments', _payment_id,
     jsonb_build_object('subscription_id', sub_id, 'invoice_id', invoice_id, 'method', p.method));

  RETURN sub_id;
END $$;

CREATE OR REPLACE FUNCTION public.is_school_billing_active(_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = _school_id
      AND (
        s.subscription_status = 'active'
        OR (s.plan_expires_at IS NOT NULL AND s.plan_expires_at > now())
        OR (s.subscription_grace_until IS NOT NULL AND s.subscription_grace_until > now())
      )
  );
$$;
