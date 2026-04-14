
-- Allow parents to view teacher assignments for their school
CREATE POLICY "Parent view school teacher_assignments"
ON public.teacher_assignments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND school_id IN (
    SELECT school_id FROM parent_learners WHERE parent_user_id = auth.uid()
  )
);

-- Allow parents to view profiles for their school (to get teacher names/initials)
CREATE POLICY "Parent view school profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND school_id IN (
    SELECT school_id FROM parent_learners WHERE parent_user_id = auth.uid()
  )
);

-- Allow parents to view all learners in same school (for rankings)
CREATE POLICY "Parent view school learners"
ON public.learners
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND school_id IN (
    SELECT school_id FROM parent_learners WHERE parent_user_id = auth.uid()
  )
);

-- Allow parents to view all scores in same school (for rankings and class averages)
CREATE POLICY "Parent view school scores"
ON public.scores
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND school_id IN (
    SELECT school_id FROM parent_learners WHERE parent_user_id = auth.uid()
  )
);
