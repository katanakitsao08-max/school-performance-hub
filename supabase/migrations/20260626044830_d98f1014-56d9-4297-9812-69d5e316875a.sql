CREATE OR REPLACE FUNCTION public.is_platform_account_active(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_text text;
  prof record;
  school_rec record;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT ur.role::text
    INTO role_text
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
  ORDER BY CASE ur.role::text
    WHEN 'super_admin' THEN 1
    WHEN 'independent_learner' THEN 2
    ELSE 10
  END
  LIMIT 1;

  IF role_text = 'super_admin' THEN
    RETURN true;
  END IF;

  SELECT p.school_id, p.school_access_status
    INTO prof
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF COALESCE(prof.school_access_status, 'active') <> 'active' THEN
    RETURN false;
  END IF;

  -- Independent learners are not attached to school lifecycle access.
  IF role_text = 'independent_learner' THEN
    RETURN true;
  END IF;

  -- All school platform roles require an existing, non-deleted school.
  IF prof.school_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT s.id, s.subscription_status, s.deleted_at
    INTO school_rec
  FROM public.schools s
  WHERE s.id = prof.school_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF school_rec.deleted_at IS NOT NULL
     OR COALESCE(school_rec.subscription_status, '') IN ('deleted', 'disabled', 'suspended') THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_account_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_account_active(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  )
  AND (
    _role = 'super_admin'::app_role
    OR public.is_platform_account_active(_user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.role
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
    AND (ur.role = 'super_admin'::app_role OR public.is_platform_account_active(_user_id))
  ORDER BY CASE ur.role::text
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'headteacher' THEN 3
    WHEN 'teacher' THEN 4
    WHEN 'parent' THEN 5
    WHEN 'independent_learner' THEN 6
    ELSE 10
  END
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.school_id
  FROM public.profiles p
  WHERE p.user_id = _user_id
    AND public.is_platform_account_active(_user_id)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.disable_school(_school_id uuid, _reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int := 0;
  sessions_ended int := 0;
  before_state jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT to_jsonb(s) INTO before_state
  FROM public.schools s
  WHERE s.id = _school_id;

  IF before_state IS NULL THEN
    RAISE EXCEPTION 'school not found';
  END IF;

  UPDATE public.schools
     SET subscription_status = 'deleted',
         deleted_at = COALESCE(deleted_at, now()),
         deleted_by = COALESCE(deleted_by, auth.uid()),
         updated_at = now()
   WHERE id = _school_id;

  UPDATE public.profiles
     SET school_access_status = 'disabled',
         disabled_at = COALESCE(disabled_at, now()),
         updated_at = now()
   WHERE school_id = _school_id
     AND COALESCE(school_access_status, 'active') <> 'disabled';
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.user_sessions
     SET session_status = 'offline',
         logout_time = COALESCE(logout_time, now()),
         updated_at = now()
   WHERE school_id = _school_id
     AND logout_time IS NULL;
  GET DIAGNOSTICS sessions_ended = ROW_COUNT;

  PERFORM public.log_audit(
    'delete', 'school', 'school', _school_id,
    before_state,
    jsonb_build_object('status', 'deleted', 'disabled_users', affected, 'ended_sessions', sessions_ended),
    affected,
    COALESCE(_reason, 'school deleted by super admin'),
    NULL,
    NULL,
    _school_id
  );

  RETURN jsonb_build_object(
    'disabled_users', affected,
    'ended_sessions', sessions_ended,
    'school_id', _school_id,
    'status', 'deleted'
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.disable_school(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_school(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.restore_school(_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int := 0;
  deleted_when timestamptz;
  before_state jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT deleted_at, to_jsonb(s)
    INTO deleted_when, before_state
  FROM public.schools s
  WHERE s.id = _school_id;

  IF before_state IS NULL THEN
    RAISE EXCEPTION 'school not found';
  END IF;

  IF deleted_when IS NOT NULL AND deleted_when < now() - interval '30 days' THEN
    RAISE EXCEPTION 'restore window of 30 days has elapsed';
  END IF;

  UPDATE public.schools
     SET subscription_status = 'active',
         deleted_at = NULL,
         deleted_by = NULL,
         updated_at = now()
   WHERE id = _school_id;

  UPDATE public.profiles
     SET school_access_status = 'active',
         disabled_at = NULL,
         updated_at = now()
   WHERE school_id = _school_id;
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.user_sessions
     SET session_status = 'offline',
         logout_time = COALESCE(logout_time, now()),
         updated_at = now()
   WHERE school_id = _school_id
     AND logout_time IS NULL;

  PERFORM public.log_audit(
    'restore', 'school', 'school', _school_id,
    before_state,
    jsonb_build_object('status', 'active', 'restored_users', affected, 'requires_fresh_login', true),
    affected,
    NULL,
    NULL,
    NULL,
    _school_id
  );

  RETURN jsonb_build_object('restored_users', affected, 'school_id', _school_id, 'requires_fresh_login', true);
END
$$;

GRANT EXECUTE ON FUNCTION public.restore_school(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_school(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cascade_school_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  became_inactive boolean;
  affected int := 0;
  sessions_ended int := 0;
BEGIN
  became_inactive :=
    (NEW.subscription_status IN ('deleted','disabled','suspended')
     AND COALESCE(OLD.subscription_status,'') <> NEW.subscription_status)
    OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL);

  IF became_inactive THEN
    UPDATE public.profiles
       SET school_access_status = 'disabled',
           disabled_at = COALESCE(disabled_at, now()),
           updated_at = now()
     WHERE school_id = NEW.id
       AND COALESCE(school_access_status,'active') <> 'disabled';
    GET DIAGNOSTICS affected = ROW_COUNT;

    UPDATE public.user_sessions
       SET session_status = 'offline',
           logout_time = COALESCE(logout_time, now()),
           updated_at = now()
     WHERE school_id = NEW.id
       AND logout_time IS NULL;
    GET DIAGNOSTICS sessions_ended = ROW_COUNT;

    IF affected > 0 OR sessions_ended > 0 THEN
      INSERT INTO public.audit_logs
        (school_id, user_id, user_name, role, action, module, record_type, record_id,
         before_state, after_state, affected_count, reason)
      VALUES
        (NEW.id, auth.uid(), 'system', 'system', 'deactivate', 'school', 'school', NEW.id,
         to_jsonb(OLD),
         jsonb_build_object('status', NEW.subscription_status, 'disabled_users', affected, 'ended_sessions', sessions_ended),
         affected,
         'school lifecycle enforcement');
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_cascade_school_deactivation ON public.schools;
CREATE TRIGGER trg_cascade_school_deactivation
  AFTER UPDATE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_school_deactivation();

CREATE OR REPLACE FUNCTION public.prevent_school_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Schools must be soft-deleted with disable_school() to preserve audit history and block linked accounts safely';
END
$$;

DROP TRIGGER IF EXISTS trg_prevent_school_hard_delete ON public.schools;
CREATE TRIGGER trg_prevent_school_hard_delete
  BEFORE DELETE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_school_hard_delete();

CREATE OR REPLACE FUNCTION public.protect_profile_lifecycle_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(jwt_role, '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role = 'super_admin'::app_role
     ) THEN
    IF NEW.school_id IS DISTINCT FROM OLD.school_id
       OR NEW.school_access_status IS DISTINCT FROM OLD.school_access_status
       OR NEW.disabled_at IS DISTINCT FROM OLD.disabled_at THEN
      RAISE EXCEPTION 'Only Super Admin can change school access lifecycle fields';
    END IF;
  END IF;

  IF NEW.school_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = NEW.school_id
      AND (s.deleted_at IS NOT NULL OR s.subscription_status IN ('deleted','disabled','suspended'))
  ) THEN
    NEW.school_access_status := 'disabled';
    NEW.disabled_at := COALESCE(NEW.disabled_at, now());
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_lifecycle_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_lifecycle_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_lifecycle_fields();