
CREATE TABLE public.learning_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL,
  subject_name text NOT NULL,
  source text NOT NULL,
  question text NOT NULL,
  selected_answer text,
  correct_answer text,
  is_correct boolean NOT NULL,
  difficulty int,
  strand text,
  explanation text,
  level_at_time int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_learning_responses_learner_subject ON public.learning_responses(learner_id, subject_id, created_at DESC);

CREATE TABLE public.learning_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL,
  subject_name text NOT NULL,
  level int NOT NULL DEFAULT 1,
  xp int NOT NULL DEFAULT 0,
  streak int NOT NULL DEFAULT 0,
  badges text[] NOT NULL DEFAULT '{}',
  lessons_completed int NOT NULL DEFAULT 0,
  topics_covered text[] NOT NULL DEFAULT '{}',
  last_played timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(learner_id, subject_id)
);

ALTER TABLE public.learning_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;

-- Parent (linked) full access
CREATE POLICY "Parents manage own child responses" ON public.learning_responses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parent_learners pl WHERE pl.learner_id = learning_responses.learner_id AND pl.parent_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.parent_learners pl WHERE pl.learner_id = learning_responses.learner_id AND pl.parent_user_id = auth.uid()));

CREATE POLICY "Parents manage own child progress" ON public.learning_progress
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parent_learners pl WHERE pl.learner_id = learning_progress.learner_id AND pl.parent_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.parent_learners pl WHERE pl.learner_id = learning_progress.learner_id AND pl.parent_user_id = auth.uid()));

-- School staff (same school as learner)
CREATE POLICY "School staff view responses" ON public.learning_responses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learners l WHERE l.id = learning_responses.learner_id AND l.school_id = public.get_user_school_id(auth.uid())));

CREATE POLICY "School staff view progress" ON public.learning_progress
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learners l WHERE l.id = learning_progress.learner_id AND l.school_id = public.get_user_school_id(auth.uid())));

-- Super Admin
CREATE POLICY "SA full responses" ON public.learning_responses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "SA full progress" ON public.learning_progress FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_learning_progress_updated
  BEFORE UPDATE ON public.learning_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
