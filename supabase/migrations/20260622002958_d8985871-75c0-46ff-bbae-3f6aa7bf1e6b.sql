-- Auto-mark stale sessions offline after 10 min of inactivity (hygiene; dashboard already filters by 5-min window)
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  UPDATE public.user_sessions
     SET session_status = 'offline',
         logout_time = COALESCE(logout_time, last_activity)
   WHERE logout_time IS NULL
     AND last_activity < now() - interval '10 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Useful index for the live query (logout_time IS NULL + last_activity desc)
CREATE INDEX IF NOT EXISTS idx_user_sessions_live
  ON public.user_sessions (last_activity DESC)
  WHERE logout_time IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_token
  ON public.user_sessions (session_token);