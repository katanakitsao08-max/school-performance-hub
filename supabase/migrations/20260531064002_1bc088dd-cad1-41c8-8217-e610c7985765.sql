
-- =====================================================================
-- CBC Continuous Learning Platform — foundational schema
-- =====================================================================
-- Content is global (shared across all schools + independent learners),
-- authored by Super Admin and (optionally) School Admins for their school.
-- Progress/attempts/streaks/badges are per-learner (user_id based).
-- =====================================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.cbc_competency_level AS ENUM
    ('emerging','approaching','meeting','exceeding');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.learning_question_type AS ENUM
    ('mcq','multi_select','true_false','short_answer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.learning_assessment_kind AS ENUM
    ('topic_quiz','subject_assessment','kpsea_mock','kjsea_mock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- TOPICS ----------
CREATE TABLE IF NOT EXISTS public.learning_topics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid REFERENCES public.schools(id) ON DELETE CASCADE, -- NULL = global
  subject_slug  text NOT NULL,
  grade         text NOT NULL,
  strand        text,
  sub_strand    text,
  title         text NOT NULL,
  description   text,
  sort_order    int  NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lt_subject_grade ON public.learning_topics(subject_slug, grade);
CREATE INDEX IF NOT EXISTS idx_lt_school ON public.learning_topics(school_id);

GRANT SELECT ON public.learning_topics TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.learning_topics TO authenticated;
GRANT ALL ON public.learning_topics TO service_role;
ALTER TABLE public.learning_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topics readable by all" ON public.learning_topics
  FOR SELECT USING (true);
CREATE POLICY "super admin manages topics" ON public.learning_topics
  FOR ALL USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "school admin manages own topics" ON public.learning_topics
  FOR ALL USING (
    school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'headteacher'::app_role))
  ) WITH CHECK (
    school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'headteacher'::app_role))
  );

-- ---------- VIDEOS ----------
CREATE TABLE IF NOT EXISTS public.learning_videos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id      uuid NOT NULL REFERENCES public.learning_topics(id) ON DELETE CASCADE,
  school_id     uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  video_url     text NOT NULL,    -- YouTube / Vimeo / direct mp4
  duration_seconds int,
  thumbnail_url text,
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lv_topic ON public.learning_videos(topic_id);

GRANT SELECT ON public.learning_videos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.learning_videos TO authenticated;
GRANT ALL ON public.learning_videos TO service_role;
ALTER TABLE public.learning_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "videos readable by all" ON public.learning_videos
  FOR SELECT USING (true);
CREATE POLICY "super admin manages videos" ON public.learning_videos
  FOR ALL USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "school admin manages own videos" ON public.learning_videos
  FOR ALL USING (
    school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'headteacher'::app_role))
  ) WITH CHECK (
    school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'headteacher'::app_role))
  );

-- ---------- NOTES ----------
CREATE TABLE IF NOT EXISTS public.learning_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id      uuid NOT NULL REFERENCES public.learning_topics(id) ON DELETE CASCADE,
  school_id     uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  title         text NOT NULL,
  content_md    text NOT NULL DEFAULT '',  -- markdown body for in-app + PDF export
  attachment_url text,                     -- optional pre-uploaded PDF
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ln_topic ON public.learning_notes(topic_id);

GRANT SELECT ON public.learning_notes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.learning_notes TO authenticated;
GRANT ALL ON public.learning_notes TO service_role;
ALTER TABLE public.learning_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes readable by all" ON public.learning_notes
  FOR SELECT USING (true);
CREATE POLICY "super admin manages notes" ON public.learning_notes
  FOR ALL USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "school admin manages own notes" ON public.learning_notes
  FOR ALL USING (
    school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'headteacher'::app_role))
  ) WITH CHECK (
    school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'headteacher'::app_role))
  );

-- ---------- QUESTIONS ----------
CREATE TABLE IF NOT EXISTS public.learning_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id      uuid NOT NULL REFERENCES public.learning_topics(id) ON DELETE CASCADE,
  school_id     uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  question_type public.learning_question_type NOT NULL DEFAULT 'mcq',
  prompt        text NOT NULL,
  -- options: jsonb array of { id, text }
  options       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- correct_answers: jsonb array of option ids (or acceptable strings for short_answer)
  correct_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation   text,
  difficulty    int NOT NULL DEFAULT 2,    -- 1 easy .. 3 hard
  marks         int NOT NULL DEFAULT 1,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lq_topic ON public.learning_questions(topic_id);

GRANT SELECT ON public.learning_questions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.learning_questions TO authenticated;
GRANT ALL ON public.learning_questions TO service_role;
ALTER TABLE public.learning_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questions readable by all" ON public.learning_questions
  FOR SELECT USING (true);
CREATE POLICY "super admin manages questions" ON public.learning_questions
  FOR ALL USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "school admin manages own questions" ON public.learning_questions
  FOR ALL USING (
    school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'headteacher'::app_role))
  ) WITH CHECK (
    school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'headteacher'::app_role))
  );

-- ---------- ASSESSMENTS ----------
CREATE TABLE IF NOT EXISTS public.learning_assessments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  kind          public.learning_assessment_kind NOT NULL,
  title         text NOT NULL,
  description   text,
  subject_slug  text,           -- nullable for full mock exams
  grade         text NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  pass_percent  int NOT NULL DEFAULT 50,
  -- ordered array of question ids
  question_ids  jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_la_grade_kind ON public.learning_assessments(grade, kind);

GRANT SELECT ON public.learning_assessments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.learning_assessments TO authenticated;
GRANT ALL ON public.learning_assessments TO service_role;
ALTER TABLE public.learning_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assessments readable by all" ON public.learning_assessments
  FOR SELECT USING (true);
CREATE POLICY "super admin manages assessments" ON public.learning_assessments
  FOR ALL USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "school admin manages own assessments" ON public.learning_assessments
  FOR ALL USING (
    school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'headteacher'::app_role))
  ) WITH CHECK (
    school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'headteacher'::app_role))
  );

-- ---------- LEARNER ATTEMPTS ----------
CREATE TABLE IF NOT EXISTS public.learning_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,                  -- auth user id
  assessment_id uuid REFERENCES public.learning_assessments(id) ON DELETE SET NULL,
  topic_id      uuid REFERENCES public.learning_topics(id) ON DELETE SET NULL,
  subject_slug  text,
  grade         text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  submitted_at  timestamptz,
  duration_seconds int,
  total_marks   int NOT NULL DEFAULT 0,
  earned_marks  int NOT NULL DEFAULT 0,
  score_percent numeric(5,2) NOT NULL DEFAULT 0,
  competency_level public.cbc_competency_level,
  -- per-question detail: [{ question_id, given, correct, marks_earned }]
  answers       jsonb NOT NULL DEFAULT '[]'::jsonb,
  passed        boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lat_user ON public.learning_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_lat_topic ON public.learning_attempts(topic_id);
CREATE INDEX IF NOT EXISTS idx_lat_assessment ON public.learning_attempts(assessment_id);

GRANT SELECT, INSERT, UPDATE ON public.learning_attempts TO authenticated;
GRANT ALL ON public.learning_attempts TO service_role;
ALTER TABLE public.learning_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own attempts read" ON public.learning_attempts
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_role(auth.uid(),'super_admin'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'headteacher'::app_role)
    OR has_role(auth.uid(),'parent'::app_role)
  );
CREATE POLICY "own attempts insert" ON public.learning_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own attempts update" ON public.learning_attempts
  FOR UPDATE USING (auth.uid() = user_id);

-- ---------- LEARNER TOPIC MASTERY (rolled-up) ----------
CREATE TABLE IF NOT EXISTS public.learner_topic_mastery (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  topic_id      uuid NOT NULL REFERENCES public.learning_topics(id) ON DELETE CASCADE,
  subject_slug  text NOT NULL,
  grade         text NOT NULL,
  mastery_percent numeric(5,2) NOT NULL DEFAULT 0,
  competency_level public.cbc_competency_level NOT NULL DEFAULT 'emerging',
  attempts_count int NOT NULL DEFAULT 0,
  time_spent_seconds int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_ltm_user_subject ON public.learner_topic_mastery(user_id, subject_slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learner_topic_mastery TO authenticated;
GRANT ALL ON public.learner_topic_mastery TO service_role;
ALTER TABLE public.learner_topic_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own mastery read" ON public.learner_topic_mastery
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_role(auth.uid(),'super_admin'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'headteacher'::app_role)
    OR has_role(auth.uid(),'parent'::app_role)
  );
CREATE POLICY "own mastery upsert" ON public.learner_topic_mastery
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- LEARNER STREAKS ----------
CREATE TABLE IF NOT EXISTS public.learner_streaks (
  user_id       uuid PRIMARY KEY,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_active_date date,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.learner_streaks TO authenticated;
GRANT ALL ON public.learner_streaks TO service_role;
ALTER TABLE public.learner_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own streak read" ON public.learner_streaks
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_role(auth.uid(),'super_admin'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'parent'::app_role)
  );
CREATE POLICY "own streak write" ON public.learner_streaks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- BADGES ----------
CREATE TABLE IF NOT EXISTS public.learning_badges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,
  title         text NOT NULL,
  description   text,
  icon          text,                 -- emoji or icon key
  criteria      jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active     boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.learning_badges TO anon, authenticated;
GRANT ALL ON public.learning_badges TO service_role;
ALTER TABLE public.learning_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges readable" ON public.learning_badges FOR SELECT USING (true);
CREATE POLICY "super admin manages badges" ON public.learning_badges
  FOR ALL USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));

CREATE TABLE IF NOT EXISTS public.learner_badges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  badge_id      uuid NOT NULL REFERENCES public.learning_badges(id) ON DELETE CASCADE,
  awarded_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_lbb_user ON public.learner_badges(user_id);
GRANT SELECT, INSERT ON public.learner_badges TO authenticated;
GRANT ALL ON public.learner_badges TO service_role;
ALTER TABLE public.learner_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own badges read" ON public.learner_badges
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_role(auth.uid(),'super_admin'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'parent'::app_role)
  );
CREATE POLICY "own badge insert" ON public.learner_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------- updated_at triggers ----------
CREATE TRIGGER trg_lt_uat BEFORE UPDATE ON public.learning_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lv_uat BEFORE UPDATE ON public.learning_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ln_uat BEFORE UPDATE ON public.learning_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lq_uat BEFORE UPDATE ON public.learning_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_la_uat BEFORE UPDATE ON public.learning_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ltm_uat BEFORE UPDATE ON public.learner_topic_mastery
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ls_uat BEFORE UPDATE ON public.learner_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Seed a few starter badges ----------
INSERT INTO public.learning_badges (code, title, description, icon, criteria) VALUES
  ('first_steps',     'First Steps',       'Completed your first quiz', '🌱', '{"attempts":1}'),
  ('streak_3',        '3-Day Streak',      'Active 3 days in a row',     '🔥', '{"streak":3}'),
  ('streak_7',        '7-Day Streak',      'Active a full week',         '🔥', '{"streak":7}'),
  ('meeting_5',       'On Track',          'Reached Meeting in 5 topics','🎯', '{"meeting_topics":5}'),
  ('exceeding_5',     'High Flyer',        'Reached Exceeding in 5 topics','🚀','{"exceeding_topics":5}'),
  ('kpsea_ready',     'KPSEA Ready',       'Passed a KPSEA mock exam',   '🎓', '{"kpsea_pass":true}'),
  ('kjsea_ready',     'KJSEA Ready',       'Passed a KJSEA mock exam',   '🎓', '{"kjsea_pass":true}')
ON CONFLICT (code) DO NOTHING;
