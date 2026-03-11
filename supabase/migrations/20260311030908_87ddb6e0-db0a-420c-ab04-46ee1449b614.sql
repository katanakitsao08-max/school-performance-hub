CREATE OR REPLACE FUNCTION public.generate_school_code()
RETURNS text LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE code text; exists_count int;
BEGIN
  LOOP
    code := 'SCH-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 6));
    SELECT COUNT(*) INTO exists_count FROM public.schools WHERE school_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END; $$;