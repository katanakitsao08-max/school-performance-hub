
-- 1) school_billing: one row per school storing plan/cycle/amount
CREATE TABLE IF NOT EXISTS public.school_billing (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'basic',
  billing_cycle text NOT NULL DEFAULT 'annual',
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_billing TO authenticated;
GRANT ALL ON public.school_billing TO service_role;

ALTER TABLE public.school_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage school_billing"
ON public.school_billing
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE TRIGGER trg_school_billing_updated
BEFORE UPDATE ON public.school_billing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) subscription_payments: append-only log of payments per school
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  year int NOT NULL,
  plan text,
  billing_cycle text,
  notes text,
  receipt_number text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_school_year
  ON public.subscription_payments(school_id, year);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage subscription_payments"
ON public.subscription_payments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE TRIGGER trg_subscription_payments_updated
BEFORE UPDATE ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
