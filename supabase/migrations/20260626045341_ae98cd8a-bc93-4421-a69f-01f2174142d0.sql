REVOKE EXECUTE ON FUNCTION public.is_platform_account_active(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.disable_school(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_school(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_school_hard_delete() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protect_profile_lifecycle_fields() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cascade_school_deactivation() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_platform_account_active(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.disable_school(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_school(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prevent_school_hard_delete() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_lifecycle_fields() TO service_role;
GRANT EXECUTE ON FUNCTION public.cascade_school_deactivation() TO service_role;