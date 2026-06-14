
CREATE TABLE IF NOT EXISTS public.school_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL,
  school_type text NOT NULL DEFAULT 'primary',
  county text NOT NULL DEFAULT '',
  admin_full_name text NOT NULL,
  admin_phone text NOT NULL,
  admin_email text NOT NULL,
  learners_count int NOT NULL DEFAULT 0,
  selected_plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  terms_accepted boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  decided_by uuid,
  decided_at timestamptz,
  provisioned_school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_school_signups_status ON public.school_signups(status);

GRANT SELECT, INSERT, UPDATE ON public.school_signups TO authenticated;
GRANT INSERT ON public.school_signups TO anon;
GRANT ALL ON public.school_signups TO service_role;

ALTER TABLE public.school_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit school signup" ON public.school_signups
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Super admin read signups" ON public.school_signups
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "Super admin update signups" ON public.school_signups
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'::app_role));

DROP TRIGGER IF EXISTS trg_school_signups_updated ON public.school_signups;
CREATE TRIGGER trg_school_signups_updated BEFORE UPDATE ON public.school_signups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Expand is_school_billing_active to treat suspended/disabled as inactive (status overrides dates)
CREATE OR REPLACE FUNCTION public.is_school_billing_active(_school_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = _school_id
      AND s.subscription_status NOT IN ('suspended','disabled','expired')
      AND (
        s.subscription_status = 'active'
        OR s.subscription_status = 'trial'
        OR (s.plan_expires_at IS NOT NULL AND s.plan_expires_at > now())
        OR (s.subscription_grace_until IS NOT NULL AND s.subscription_grace_until > now())
      )
  );
$function$;
