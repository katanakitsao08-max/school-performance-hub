
ALTER TABLE public.school_sms_config ADD COLUMN IF NOT EXISTS partner_id text;
ALTER TABLE public.global_sms_config ADD COLUMN IF NOT EXISTS partner_id text;

UPDATE public.school_sms_config
SET partner_id = NULLIF(COALESCE(body_template->'body'->>'partnerID', body_template->'body'->>'partner_id', headers_json->>'partnerID', headers_json->>'partner_id'), '')
WHERE partner_id IS NULL OR partner_id = '';

UPDATE public.global_sms_config
SET partner_id = NULLIF(COALESCE(body_template->'body'->>'partnerID', body_template->'body'->>'partner_id', headers_json->>'partnerID', headers_json->>'partner_id'), '')
WHERE partner_id IS NULL OR partner_id = '';
