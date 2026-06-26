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
     AND auth.uid() IS NOT NULL
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