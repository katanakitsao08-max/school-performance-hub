-- Phase 2.1: Analytics foundations

CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  school_id uuid,
  role text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  device text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.user_activity_log TO authenticated;
GRANT ALL ON public.user_activity_log TO service_role;

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_insert_self" ON public.user_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "activity_select_super" ON public.user_activity_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "activity_select_own_school" ON public.user_activity_log
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'headteacher'::app_role)));

CREATE INDEX IF NOT EXISTS idx_activity_log_school ON public.user_activity_log(school_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.user_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.user_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.user_activity_log(user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activity_log;


CREATE TABLE IF NOT EXISTS public.platform_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_alerts TO authenticated;
GRANT ALL ON public.platform_alerts TO service_role;

ALTER TABLE public.platform_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_super_all" ON public.platform_alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_alerts_school ON public.platform_alerts(school_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON public.platform_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON public.platform_alerts(resolved_at);