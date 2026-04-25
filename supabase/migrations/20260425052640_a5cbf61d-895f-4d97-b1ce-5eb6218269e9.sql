-- 1. Plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  price_monthly numeric NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view active plans"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "SA full plans"
  ON public.subscription_plans FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_subscription_plans_updated
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Seed default plans
INSERT INTO public.subscription_plans (name, description, price_monthly, sort_order, features) VALUES
  ('Free', 'Basic reporting and learner records', 0, 1, '{"ai_remarks": false, "whatsapp_auto": false, "batch_reports": false, "timetable": false, "advanced_analytics": false, "bulk_upload": true, "max_learners": 100}'::jsonb),
  ('Standard', 'Full school management with WhatsApp & timetable', 2500, 2, '{"ai_remarks": false, "whatsapp_auto": true, "batch_reports": true, "timetable": true, "advanced_analytics": false, "bulk_upload": true, "max_learners": 1000}'::jsonb),
  ('Premium', 'Everything including AI remarks and analytics', 5000, 3, '{"ai_remarks": true, "whatsapp_auto": true, "batch_reports": true, "timetable": true, "advanced_analytics": true, "bulk_upload": true, "max_learners": 99999}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 3. Schools: plan + expiry
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

-- Default existing schools to Free plan if missing
UPDATE public.schools
SET plan_id = (SELECT id FROM public.subscription_plans WHERE name = 'Free' LIMIT 1)
WHERE plan_id IS NULL;

-- 4. Helper: get effective features for a school
CREATE OR REPLACE FUNCTION public.get_school_plan_features(_school_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.plan_expires_at IS NOT NULL AND s.plan_expires_at < now() THEN
      COALESCE((SELECT features FROM public.subscription_plans WHERE name = 'Free' LIMIT 1), '{}'::jsonb)
    ELSE
      COALESCE(p.features, '{}'::jsonb)
  END
  FROM public.schools s
  LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
  WHERE s.id = _school_id;
$$;