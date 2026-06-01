-- Collapse SMS to single global provider: remove per-school config table
DROP TABLE IF EXISTS public.school_sms_config CASCADE;

-- Ensure exactly one row in global_sms_config (singleton pattern)
INSERT INTO public.global_sms_config (singleton, provider, endpoint, api_key, sender_id, is_active, body_template, headers_json)
SELECT true, 'olympus_teleserve', 'https://sms.ots.co.ke/api/v3/sms/send', '', 'PERFORMTRK', false, '{"type":"plain"}'::jsonb, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.global_sms_config);