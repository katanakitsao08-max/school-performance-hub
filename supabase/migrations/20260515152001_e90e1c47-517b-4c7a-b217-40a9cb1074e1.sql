-- Learning Path entitlements + payment requests
CREATE TABLE public.learning_path_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL,
  school_id uuid NOT NULL,
  parent_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | active | rejected | expired
  mpesa_code text,
  mpesa_phone text,
  amount numeric NOT NULL DEFAULT 50,
  weeks integer NOT NULL DEFAULT 1,
  paid_to text NOT NULL DEFAULT '0701594268',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  expires_at timestamptz,
  activated_by uuid,
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lpe_learner ON public.learning_path_entitlements(learner_id);
CREATE INDEX idx_lpe_status ON public.learning_path_entitlements(status);
CREATE INDEX idx_lpe_school ON public.learning_path_entitlements(school_id);

ALTER TABLE public.learning_path_entitlements ENABLE ROW LEVEL SECURITY;

-- Parents: insert/view their own children's entitlements
CREATE POLICY "Parent insert own entitlements"
ON public.learning_path_entitlements FOR INSERT TO authenticated
WITH CHECK (
  parent_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.parent_learners pl
              WHERE pl.parent_user_id = auth.uid() AND pl.learner_id = learning_path_entitlements.learner_id)
);

CREATE POLICY "Parent view own entitlements"
ON public.learning_path_entitlements FOR SELECT TO authenticated
USING (parent_user_id = auth.uid());

-- School admin: view their school
CREATE POLICY "Admin view school entitlements"
ON public.learning_path_entitlements FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND school_id = public.get_user_school_id(auth.uid()));

-- Super admin: full
CREATE POLICY "SA full entitlements"
ON public.learning_path_entitlements FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_lpe_updated_at
BEFORE UPDATE ON public.learning_path_entitlements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper to check active entitlement
CREATE OR REPLACE FUNCTION public.has_active_learning_path(_learner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.learning_path_entitlements
    WHERE learner_id = _learner_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;