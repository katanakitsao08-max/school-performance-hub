
-- Allow teachers to insert learners for their assigned grades
CREATE POLICY "Teachers can insert learners for assigned grades"
ON public.learners
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND (grade = ANY (get_user_assigned_grades(auth.uid())))
);

-- Allow teachers to update learners for assigned grades
CREATE POLICY "Teachers can update learners for assigned grades"
ON public.learners
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND (grade = ANY (get_user_assigned_grades(auth.uid())))
);
