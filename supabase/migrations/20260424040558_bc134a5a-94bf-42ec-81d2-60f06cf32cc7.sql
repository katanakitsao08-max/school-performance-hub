-- Allow teachers to view their own school's activation key (read-only)
CREATE POLICY "Teacher view own school key"
ON public.timetable_activation_keys
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND school_id = get_user_school_id(auth.uid())
);

-- Allow headteachers to view their own school's activation key (read-only)
CREATE POLICY "HT view own school key"
ON public.timetable_activation_keys
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'headteacher'::app_role)
  AND school_id = get_user_school_id(auth.uid())
);