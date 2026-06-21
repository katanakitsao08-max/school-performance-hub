
-- =========================
-- user_sessions
-- =========================
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  school_id uuid,
  role text,
  login_time timestamptz NOT NULL DEFAULT now(),
  logout_time timestamptz,
  last_activity timestamptz NOT NULL DEFAULT now(),
  device text,
  browser text,
  ip_address text,
  user_agent text,
  session_status text NOT NULL DEFAULT 'active',
  session_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON public.user_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_school ON public.user_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON public.user_sessions(session_status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_sessions_token ON public.user_sessions(session_token) WHERE session_token IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON public.user_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins view all sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP TRIGGER IF EXISTS trg_user_sessions_updated ON public.user_sessions;
CREATE TRIGGER trg_user_sessions_updated
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;

-- =========================
-- login_events
-- =========================
CREATE TABLE IF NOT EXISTS public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  school_id uuid,
  email_attempt text,
  success boolean NOT NULL DEFAULT true,
  failure_reason text,
  ip_address text,
  user_agent text,
  device text,
  browser text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_events_created ON public.login_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_success ON public.login_events(success);
CREATE INDEX IF NOT EXISTS idx_login_events_school ON public.login_events(school_id);

GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own login event"
  ON public.login_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Super admins view login events"
  ON public.login_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- =========================
-- Aggregate function
-- =========================
CREATE OR REPLACE FUNCTION public.get_live_user_stats(_window_minutes int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  cutoff timestamptz := now() - make_interval(mins => _window_minutes);
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH live AS (
    SELECT DISTINCT ON (user_id) user_id, school_id, role, last_activity
    FROM public.user_sessions
    WHERE last_activity >= cutoff AND logout_time IS NULL
    ORDER BY user_id, last_activity DESC
  ),
  by_role AS (
    SELECT COALESCE(role, 'unknown') AS role, COUNT(*) AS c FROM live GROUP BY role
  ),
  by_school AS (
    SELECT s.id, s.school_name, COUNT(l.user_id) AS c
    FROM public.schools s
    LEFT JOIN live l ON l.school_id = s.id
    GROUP BY s.id, s.school_name
    HAVING COUNT(l.user_id) > 0
    ORDER BY c DESC
    LIMIT 25
  )
  SELECT jsonb_build_object(
    'total_online', (SELECT COUNT(*) FROM live),
    'active_sessions', (SELECT COUNT(*) FROM public.user_sessions
                       WHERE last_activity >= cutoff AND logout_time IS NULL),
    'by_role', COALESCE((SELECT jsonb_object_agg(role, c) FROM by_role), '{}'::jsonb),
    'by_school', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'school_id', id, 'school_name', school_name, 'count', c))
                         FROM by_school), '[]'::jsonb),
    'window_minutes', _window_minutes,
    'as_of', now()
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_user_stats(int) TO authenticated;
