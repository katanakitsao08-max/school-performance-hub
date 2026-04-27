-- Table to store face descriptors (128-dim float vectors) per learner
CREATE TABLE public.learner_face_descriptors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL,
  school_id uuid NOT NULL,
  descriptor jsonb NOT NULL,
  enrolled_by uuid NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX learner_face_descriptors_learner_unique ON public.learner_face_descriptors(learner_id);
CREATE INDEX learner_face_descriptors_school_idx ON public.learner_face_descriptors(school_id);

ALTER TABLE public.learner_face_descriptors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SA full face_desc"
  ON public.learner_face_descriptors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin school face_desc"
  ON public.learner_face_descriptors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "HT view face_desc"
  ON public.learner_face_descriptors FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Teacher view face_desc assigned"
  ON public.learner_face_descriptors FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'teacher'::app_role)
    AND school_id = get_user_school_id(auth.uid())
    AND learner_id IN (SELECT id FROM learners WHERE grade = ANY(get_user_assigned_grades(auth.uid())))
  );

CREATE POLICY "Teacher insert face_desc assigned"
  ON public.learner_face_descriptors FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'teacher'::app_role)
    AND school_id = get_user_school_id(auth.uid())
    AND learner_id IN (SELECT id FROM learners WHERE grade = ANY(get_user_assigned_grades(auth.uid())))
  );

CREATE POLICY "Teacher update face_desc assigned"
  ON public.learner_face_descriptors FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'teacher'::app_role)
    AND school_id = get_user_school_id(auth.uid())
    AND learner_id IN (SELECT id FROM learners WHERE grade = ANY(get_user_assigned_grades(auth.uid())))
  );

CREATE TRIGGER update_face_desc_updated_at
  BEFORE UPDATE ON public.learner_face_descriptors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add a column on attendance to mark biometric capture
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS marked_via text NOT NULL DEFAULT 'manual';