
CREATE TABLE IF NOT EXISTS public.learner_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject_slug TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  quiz_score INT,
  quiz_total INT,
  seconds_spent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_slug, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_llp_user ON public.learner_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_llp_user_subject ON public.learner_lesson_progress(user_id, subject_slug);

ALTER TABLE public.learner_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learners view own progress"
ON public.learner_lesson_progress FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Learners insert own progress"
ON public.learner_lesson_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Learners update own progress"
ON public.learner_lesson_progress FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER trg_llp_updated_at
BEFORE UPDATE ON public.learner_lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
