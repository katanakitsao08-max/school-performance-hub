-- Fix school_settings unique constraint to be per-school
ALTER TABLE public.school_settings DROP CONSTRAINT IF EXISTS school_settings_key_key;

-- Remove duplicate (school_id, key) rows keeping the most recent
DELETE FROM public.school_settings a
USING public.school_settings b
WHERE a.ctid < b.ctid
  AND a.school_id IS NOT DISTINCT FROM b.school_id
  AND a.key = b.key;

ALTER TABLE public.school_settings
  ADD CONSTRAINT school_settings_school_key_unique UNIQUE (school_id, key);