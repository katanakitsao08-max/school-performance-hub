
-- 1) One-time retroactive block for already-deleted/disabled schools
DO $$
DECLARE
  s RECORD;
  disabled_users int;
  revoked_sessions int;
BEGIN
  FOR s IN
    SELECT id FROM public.schools
    WHERE subscription_status IN ('deleted','disabled')
       OR deleted_at IS NOT NULL
  LOOP
    UPDATE public.profiles
       SET school_access_status = 'disabled',
           disabled_at = COALESCE(disabled_at, now())
     WHERE school_id = s.id
       AND COALESCE(school_access_status,'active') <> 'disabled';
    GET DIAGNOSTICS disabled_users = ROW_COUNT;

    UPDATE public.user_sessions
       SET session_status = 'offline',
           logout_time = COALESCE(logout_time, now())
     WHERE school_id = s.id
       AND logout_time IS NULL;
    GET DIAGNOSTICS revoked_sessions = ROW_COUNT;

    IF disabled_users > 0 OR revoked_sessions > 0 THEN
      INSERT INTO public.audit_logs
        (school_id, user_id, user_name, role, action, module, record_type, record_id,
         before_state, after_state, affected_count, reason)
      VALUES
        (s.id, NULL, 'system', 'system', 'disable', 'school', 'school', s.id,
         NULL,
         jsonb_build_object('disabled_users', disabled_users, 'revoked_sessions', revoked_sessions),
         disabled_users,
         'retroactive enforcement: school previously deleted/disabled');
    END IF;
  END LOOP;
END $$;

-- 2) Trigger so any future flip to deleted/disabled cascades automatically
CREATE OR REPLACE FUNCTION public.cascade_school_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  became_inactive boolean;
BEGIN
  became_inactive :=
    (NEW.subscription_status IN ('deleted','disabled','suspended','expired')
     AND COALESCE(OLD.subscription_status,'') <> NEW.subscription_status)
    OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL);

  IF became_inactive THEN
    UPDATE public.profiles
       SET school_access_status = 'disabled',
           disabled_at = COALESCE(disabled_at, now())
     WHERE school_id = NEW.id
       AND COALESCE(school_access_status,'active') <> 'disabled';

    UPDATE public.user_sessions
       SET session_status = 'offline',
           logout_time = COALESCE(logout_time, now())
     WHERE school_id = NEW.id
       AND logout_time IS NULL;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cascade_school_deactivation ON public.schools;
CREATE TRIGGER trg_cascade_school_deactivation
  AFTER UPDATE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_school_deactivation();
