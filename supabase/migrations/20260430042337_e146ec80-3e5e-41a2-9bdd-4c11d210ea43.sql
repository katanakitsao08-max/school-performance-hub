-- Lock down school_sms_config to super admins only
DROP POLICY IF EXISTS "Admin own school_sms_config" ON public.school_sms_config;
-- SA full school_sms_config policy already exists and remains in effect.