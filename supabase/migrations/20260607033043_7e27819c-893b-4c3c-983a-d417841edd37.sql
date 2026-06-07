
-- ============================================================
-- LMS FOUNDATION
-- ============================================================

-- ---------- Helper functions ----------
CREATE OR REPLACE FUNCTION public.lms_is_school_learner_of(_learner_ref uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_learners pl
    WHERE pl.learner_id = _learner_ref AND pl.parent_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.lms_is_independent_owner(_learner_ref uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.independent_learners il
    WHERE il.id = _learner_ref AND il.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.lms_can_access_learner(_learner_ref uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.lms_is_school_learner_of(_learner_ref)
      OR public.lms_is_independent_owner(_learner_ref);
$$;

-- ---------- 1. lms_courses ----------
CREATE TABLE public.lms_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  subject_slug text,
  grade text,
  level text CHECK (level IN ('KPSEA','KJSEA','ALL')) DEFAULT 'ALL',
  summary text,
  cover_url text,
  instructor_name text,
  pass_percent int NOT NULL DEFAULT 60,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lms_courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_courses TO authenticated;
GRANT ALL ON public.lms_courses TO service_role;
ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_courses read published" ON public.lms_courses FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "lms_courses super admin write" ON public.lms_courses FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 2. lms_modules ----------
CREATE TABLE public.lms_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lms_modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_modules TO authenticated;
GRANT ALL ON public.lms_modules TO service_role;
ALTER TABLE public.lms_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_modules read" ON public.lms_modules FOR SELECT USING (true);
CREATE POLICY "lms_modules super admin write" ON public.lms_modules FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 3. lms_lessons ----------
CREATE TABLE public.lms_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.lms_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('video','notes','reading','live','quiz')) DEFAULT 'video',
  video_url text,
  notes_md text,
  attachment_url text,
  duration_min int NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  is_free boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lms_lessons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_lessons TO authenticated;
GRANT ALL ON public.lms_lessons TO service_role;
ALTER TABLE public.lms_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_lessons read" ON public.lms_lessons FOR SELECT USING (true);
CREATE POLICY "lms_lessons super admin write" ON public.lms_lessons FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 4. lms_quizzes ----------
CREATE TABLE public.lms_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  pass_percent int NOT NULL DEFAULT 60,
  time_limit_min int,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lms_quizzes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_quizzes TO authenticated;
GRANT ALL ON public.lms_quizzes TO service_role;
ALTER TABLE public.lms_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_quizzes read" ON public.lms_quizzes FOR SELECT USING (true);
CREATE POLICY "lms_quizzes super admin write" ON public.lms_quizzes FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 5. lms_quiz_questions ----------
CREATE TABLE public.lms_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.lms_quizzes(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('mcq','multi_select','true_false','short_answer')) DEFAULT 'mcq',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answers text[] NOT NULL DEFAULT '{}',
  explanation text,
  marks int NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lms_quiz_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_quiz_questions TO authenticated;
GRANT ALL ON public.lms_quiz_questions TO service_role;
ALTER TABLE public.lms_quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_quiz_questions read" ON public.lms_quiz_questions FOR SELECT USING (true);
CREATE POLICY "lms_quiz_questions super admin write" ON public.lms_quiz_questions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 6. lms_assignments ----------
CREATE TABLE public.lms_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.lms_modules(id) ON DELETE SET NULL,
  title text NOT NULL,
  instructions_md text,
  attachment_url text,
  due_at timestamptz,
  max_marks int NOT NULL DEFAULT 100,
  allow_late boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lms_assignments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_assignments TO authenticated;
GRANT ALL ON public.lms_assignments TO service_role;
ALTER TABLE public.lms_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_assignments read" ON public.lms_assignments FOR SELECT USING (true);
CREATE POLICY "lms_assignments super admin write" ON public.lms_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 7. lms_assignment_submissions ----------
CREATE TABLE public.lms_assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.lms_assignments(id) ON DELETE CASCADE,
  learner_ref uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  file_url text,
  text_answer text,
  score numeric,
  feedback text,
  graded_at timestamptz,
  graded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_assignment_submissions TO authenticated;
GRANT ALL ON public.lms_assignment_submissions TO service_role;
ALTER TABLE public.lms_assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_submissions owner select" ON public.lms_assignment_submissions FOR SELECT
  USING (public.lms_can_access_learner(learner_ref));
CREATE POLICY "lms_submissions owner insert" ON public.lms_assignment_submissions FOR INSERT
  WITH CHECK (public.lms_can_access_learner(learner_ref));
CREATE POLICY "lms_submissions owner update" ON public.lms_assignment_submissions FOR UPDATE
  USING (public.lms_can_access_learner(learner_ref))
  WITH CHECK (public.lms_can_access_learner(learner_ref));
CREATE POLICY "lms_submissions super admin all" ON public.lms_assignment_submissions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 8. lms_live_sessions ----------
CREATE TABLE public.lms_live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 60,
  meeting_url text,
  host_name text,
  recording_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lms_live_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_live_sessions TO authenticated;
GRANT ALL ON public.lms_live_sessions TO service_role;
ALTER TABLE public.lms_live_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_live_sessions read" ON public.lms_live_sessions FOR SELECT USING (true);
CREATE POLICY "lms_live_sessions super admin write" ON public.lms_live_sessions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 9. lms_live_attendance ----------
CREATE TABLE public.lms_live_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.lms_live_sessions(id) ON DELETE CASCADE,
  learner_ref uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, learner_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_live_attendance TO authenticated;
GRANT ALL ON public.lms_live_attendance TO service_role;
ALTER TABLE public.lms_live_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_live_attendance owner" ON public.lms_live_attendance FOR ALL
  USING (public.lms_can_access_learner(learner_ref))
  WITH CHECK (public.lms_can_access_learner(learner_ref));
CREATE POLICY "lms_live_attendance super admin" ON public.lms_live_attendance FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 10. lms_discussion_threads ----------
CREATE TABLE public.lms_discussion_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_discussion_threads TO authenticated;
GRANT ALL ON public.lms_discussion_threads TO service_role;
ALTER TABLE public.lms_discussion_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_threads read" ON public.lms_discussion_threads FOR SELECT TO authenticated USING (true);
CREATE POLICY "lms_threads insert own" ON public.lms_discussion_threads FOR INSERT
  WITH CHECK (auth.uid() = author_user_id);
CREATE POLICY "lms_threads update own" ON public.lms_discussion_threads FOR UPDATE
  USING (auth.uid() = author_user_id OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (auth.uid() = author_user_id OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "lms_threads delete own" ON public.lms_discussion_threads FOR DELETE
  USING (auth.uid() = author_user_id OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 11. lms_discussion_replies ----------
CREATE TABLE public.lms_discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.lms_discussion_threads(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_discussion_replies TO authenticated;
GRANT ALL ON public.lms_discussion_replies TO service_role;
ALTER TABLE public.lms_discussion_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_replies read" ON public.lms_discussion_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "lms_replies insert own" ON public.lms_discussion_replies FOR INSERT
  WITH CHECK (auth.uid() = author_user_id);
CREATE POLICY "lms_replies update own" ON public.lms_discussion_replies FOR UPDATE
  USING (auth.uid() = author_user_id OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (auth.uid() = author_user_id OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "lms_replies delete own" ON public.lms_discussion_replies FOR DELETE
  USING (auth.uid() = author_user_id OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 12. lms_lesson_progress ----------
CREATE TABLE public.lms_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_ref uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('started','completed')) DEFAULT 'started',
  seconds_watched int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_ref, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_lesson_progress TO authenticated;
GRANT ALL ON public.lms_lesson_progress TO service_role;
ALTER TABLE public.lms_lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_progress owner" ON public.lms_lesson_progress FOR ALL
  USING (public.lms_can_access_learner(learner_ref))
  WITH CHECK (public.lms_can_access_learner(learner_ref));

-- ---------- 13. lms_quiz_attempts ----------
CREATE TABLE public.lms_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_ref uuid NOT NULL,
  quiz_id uuid NOT NULL REFERENCES public.lms_quizzes(id) ON DELETE CASCADE,
  score_percent numeric NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_seconds int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_quiz_attempts TO authenticated;
GRANT ALL ON public.lms_quiz_attempts TO service_role;
ALTER TABLE public.lms_quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_attempts owner" ON public.lms_quiz_attempts FOR ALL
  USING (public.lms_can_access_learner(learner_ref))
  WITH CHECK (public.lms_can_access_learner(learner_ref));

-- ---------- 14. lms_badges ----------
CREATE TABLE public.lms_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  rule_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lms_badges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_badges TO authenticated;
GRANT ALL ON public.lms_badges TO service_role;
ALTER TABLE public.lms_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_badges read" ON public.lms_badges FOR SELECT USING (true);
CREATE POLICY "lms_badges super admin write" ON public.lms_badges FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ---------- 15. lms_learner_badges ----------
CREATE TABLE public.lms_learner_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_ref uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.lms_badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_ref, badge_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_learner_badges TO authenticated;
GRANT ALL ON public.lms_learner_badges TO service_role;
ALTER TABLE public.lms_learner_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_learner_badges owner" ON public.lms_learner_badges FOR ALL
  USING (public.lms_can_access_learner(learner_ref))
  WITH CHECK (public.lms_can_access_learner(learner_ref));

-- ---------- 16. lms_certificates ----------
CREATE TABLE public.lms_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_ref uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  certificate_no text NOT NULL UNIQUE,
  pdf_url text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_ref, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_certificates TO authenticated;
GRANT ALL ON public.lms_certificates TO service_role;
ALTER TABLE public.lms_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_certificates owner" ON public.lms_certificates FOR ALL
  USING (public.lms_can_access_learner(learner_ref))
  WITH CHECK (public.lms_can_access_learner(learner_ref));

-- ---------- updated_at triggers ----------
CREATE TRIGGER trg_lms_courses_updated BEFORE UPDATE ON public.lms_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lms_modules_updated BEFORE UPDATE ON public.lms_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lms_lessons_updated BEFORE UPDATE ON public.lms_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lms_quizzes_updated BEFORE UPDATE ON public.lms_quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lms_assignments_updated BEFORE UPDATE ON public.lms_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lms_submissions_updated BEFORE UPDATE ON public.lms_assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lms_live_sessions_updated BEFORE UPDATE ON public.lms_live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lms_lesson_progress_updated BEFORE UPDATE ON public.lms_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Seed default badges ----------
INSERT INTO public.lms_badges (code, name, description, icon, rule_json) VALUES
  ('first_lesson', 'First Step', 'Completed your first lesson', '🎯', '{"lessons_completed": 1}'::jsonb),
  ('ten_lessons', 'Getting There', 'Completed 10 lessons', '📚', '{"lessons_completed": 10}'::jsonb),
  ('quiz_master', 'Quiz Master', 'Passed 5 quizzes', '🧠', '{"quizzes_passed": 5}'::jsonb),
  ('course_champion', 'Course Champion', 'Completed your first course', '🏆', '{"courses_completed": 1}'::jsonb),
  ('streak_7', 'On Fire', '7-day learning streak', '🔥', '{"streak": 7}'::jsonb)
ON CONFLICT (code) DO NOTHING;
