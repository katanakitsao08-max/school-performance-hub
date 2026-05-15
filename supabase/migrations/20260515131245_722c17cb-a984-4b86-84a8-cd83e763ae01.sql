
CREATE TABLE IF NOT EXISTS public.grade_subject_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  grade text NOT NULL,
  learning_area_id uuid NOT NULL,
  lessons_per_week integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, grade, learning_area_id)
);

CREATE INDEX IF NOT EXISTS idx_gsl_school_grade ON public.grade_subject_lessons(school_id, grade);

ALTER TABLE public.grade_subject_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SA full grade_subject_lessons" ON public.grade_subject_lessons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manage school grade_subject_lessons" ON public.grade_subject_lessons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Users view school grade_subject_lessons" ON public.grade_subject_lessons
  FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));

CREATE TRIGGER update_grade_subject_lessons_updated_at
  BEFORE UPDATE ON public.grade_subject_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
