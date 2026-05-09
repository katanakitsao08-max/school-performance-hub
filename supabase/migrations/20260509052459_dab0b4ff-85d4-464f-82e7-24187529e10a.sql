CREATE OR REPLACE FUNCTION public.get_user_assigned_grades(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT grade ORDER BY grade), '{}')
  FROM (
    SELECT unnest(COALESCE(p.assigned_grades, '{}')) AS grade
    FROM public.profiles p
    WHERE p.user_id = _user_id

    UNION

    SELECT ta.grade
    FROM public.teacher_assignments ta
    WHERE ta.teacher_id = _user_id

    UNION

    SELECT ct.grade
    FROM public.class_teachers ct
    WHERE ct.teacher_id = _user_id
  ) g
  WHERE grade IS NOT NULL AND btrim(grade) <> '';
$$;