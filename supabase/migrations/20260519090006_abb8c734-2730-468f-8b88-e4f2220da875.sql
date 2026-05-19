
-- 1. Extend app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'independent_learner';

-- 2. independent_learners table
CREATE TABLE public.independent_learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  learner_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  grade text NOT NULL,
  county text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_independent_learners_user_id ON public.independent_learners(user_id);

-- 3. independent_subscriptions table
CREATE TABLE public.independent_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.independent_learners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','expired','suspended')),
  amount numeric NOT NULL DEFAULT 10,
  weeks integer NOT NULL DEFAULT 1,
  paid_to text NOT NULL DEFAULT '0701594268',
  mpesa_code text,
  mpesa_phone text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  expires_at timestamptz,
  activated_by uuid,
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_indep_subs_learner ON public.independent_subscriptions(learner_id);
CREATE INDEX idx_indep_subs_user ON public.independent_subscriptions(user_id);
CREATE INDEX idx_indep_subs_status ON public.independent_subscriptions(status);

-- 4. Learner code generator
CREATE OR REPLACE FUNCTION public.generate_independent_learner_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_seq int;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN learner_code ~ '^IL-[0-9]+$'
      THEN (regexp_replace(learner_code, '^IL-', ''))::int
      ELSE 0 END
  ), 0) + 1
  INTO next_seq
  FROM public.independent_learners;
  RETURN 'IL-' || lpad(next_seq::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_independent_learner_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.learner_code IS NULL OR NEW.learner_code = '' THEN
    NEW.learner_code := public.generate_independent_learner_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_independent_learner_code
BEFORE INSERT ON public.independent_learners
FOR EACH ROW EXECUTE FUNCTION public.set_independent_learner_code();

-- 5. updated_at triggers
CREATE TRIGGER trg_indep_learners_updated_at
BEFORE UPDATE ON public.independent_learners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_indep_subs_updated_at
BEFORE UPDATE ON public.independent_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Active-subscription helper
CREATE OR REPLACE FUNCTION public.has_active_independent_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.independent_subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- 7. Auto-expire helper (call from app on load)
CREATE OR REPLACE FUNCTION public.expire_old_independent_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  UPDATE public.independent_subscriptions
  SET status = 'expired', updated_at = now()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- 8. RLS
ALTER TABLE public.independent_learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.independent_subscriptions ENABLE ROW LEVEL SECURITY;

-- independent_learners policies
CREATE POLICY "Learner views own row"
  ON public.independent_learners FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Learner updates own row"
  ON public.independent_learners FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "SA full independent_learners"
  ON public.independent_learners FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- independent_subscriptions policies
CREATE POLICY "Learner views own subscriptions"
  ON public.independent_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Learner submits own subscription"
  ON public.independent_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND activated_at IS NULL
    AND expires_at IS NULL
    AND activated_by IS NULL
  );

CREATE POLICY "SA full independent_subscriptions"
  ON public.independent_subscriptions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
