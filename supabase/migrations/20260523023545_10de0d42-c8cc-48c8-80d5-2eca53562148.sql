ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS parent_phone_2 text;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS phone_source text;
COMMENT ON COLUMN public.learners.parent_phone IS 'Preferred parent phone (primary contact for SMS)';
COMMENT ON COLUMN public.learners.parent_phone_2 IS 'Secondary parent phone (fallback if preferred is missing/invalid)';
COMMENT ON COLUMN public.sms_logs.phone_source IS 'Which phone was used: preferred, secondary, or direct';