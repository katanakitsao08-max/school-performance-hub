-- Standalone teacher: subjects, scores, attendance scoped to teacher_classes

CREATE TABLE IF NOT EXISTS public.teacher_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL,
  name text NOT NULL,
  max_score integer NOT NULL DEFAULT 100,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS teacher_subjects_class_idx ON public.teacher_subjects(class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_subjects TO authenticated;
GRANT ALL ON public.teacher_subjects TO service_role;

ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Self manage teacher_subjects" ON public.teacher_subjects
  FOR ALL TO authenticated USING (teacher_user_id = auth.uid())
  WITH CHECK (teacher_user_id = auth.uid());
CREATE POLICY "SA full teacher_subjects" ON public.teacher_subjects
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_teacher_subjects_updated BEFORE UPDATE ON public.teacher_subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.teacher_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.teacher_learners(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.teacher_subjects(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL,
  term integer NOT NULL,
  year integer NOT NULL DEFAULT EXTRACT(year FROM now())::int,
  exam_type text NOT NULL DEFAULT 'end_term', -- opener | mid_term | end_term
  score numeric NOT NULL DEFAULT 0,
  max_score integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, subject_id, term, year, exam_type)
);
CREATE INDEX IF NOT EXISTS teacher_scores_class_idx ON public.teacher_scores(class_id);
CREATE INDEX IF NOT EXISTS teacher_scores_learner_idx ON public.teacher_scores(learner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_scores TO authenticated;
GRANT ALL ON public.teacher_scores TO service_role;

ALTER TABLE public.teacher_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Self manage teacher_scores" ON public.teacher_scores
  FOR ALL TO authenticated USING (teacher_user_id = auth.uid())
  WITH CHECK (teacher_user_id = auth.uid());
CREATE POLICY "SA full teacher_scores" ON public.teacher_scores
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_teacher_scores_updated BEFORE UPDATE ON public.teacher_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.teacher_learners(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'present', -- present | absent | late
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, date)
);
CREATE INDEX IF NOT EXISTS teacher_attendance_class_date_idx ON public.teacher_attendance(class_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_attendance TO authenticated;
GRANT ALL ON public.teacher_attendance TO service_role;

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Self manage teacher_attendance" ON public.teacher_attendance
  FOR ALL TO authenticated USING (teacher_user_id = auth.uid())
  WITH CHECK (teacher_user_id = auth.uid());
CREATE POLICY "SA full teacher_attendance" ON public.teacher_attendance
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_teacher_attendance_updated BEFORE UPDATE ON public.teacher_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();