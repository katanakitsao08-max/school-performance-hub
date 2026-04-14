
-- Strands table (e.g. "Number" under "Mathematics")
CREATE TABLE public.strands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learning_area_id UUID NOT NULL REFERENCES public.learning_areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  school_id UUID REFERENCES public.schools(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sub-strands table (e.g. "Whole Numbers" under "Number")
CREATE TABLE public.sub_strands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  strand_id UUID NOT NULL REFERENCES public.strands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Strand-level scores
CREATE TABLE public.strand_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  strand_id UUID NOT NULL REFERENCES public.strands(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 100,
  competency_level TEXT NOT NULL DEFAULT 'ME1',
  teacher_comment TEXT,
  term INTEGER NOT NULL,
  year INTEGER NOT NULL,
  assessment_type TEXT NOT NULL DEFAULT 'end_term',
  school_id UUID REFERENCES public.schools(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(learner_id, strand_id, term, year, assessment_type)
);

-- Indexes
CREATE INDEX idx_strands_learning_area ON public.strands(learning_area_id);
CREATE INDEX idx_strands_school ON public.strands(school_id);
CREATE INDEX idx_sub_strands_strand ON public.sub_strands(strand_id);
CREATE INDEX idx_strand_scores_learner ON public.strand_scores(learner_id);
CREATE INDEX idx_strand_scores_strand ON public.strand_scores(strand_id);
CREATE INDEX idx_strand_scores_school ON public.strand_scores(school_id);

-- RLS: strands
ALTER TABLE public.strands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin school strands" ON public.strands FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "SA full strands" ON public.strands FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users view school strands" ON public.strands FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));

-- RLS: sub_strands
ALTER TABLE public.sub_strands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin school sub_strands" ON public.sub_strands FOR ALL TO authenticated
  USING (strand_id IN (SELECT id FROM public.strands WHERE school_id = get_user_school_id(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "SA full sub_strands" ON public.sub_strands FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users view school sub_strands" ON public.sub_strands FOR SELECT TO authenticated
  USING (strand_id IN (SELECT id FROM public.strands WHERE school_id = get_user_school_id(auth.uid())));

-- RLS: strand_scores
ALTER TABLE public.strand_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin school strand_scores" ON public.strand_scores FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "SA full strand_scores" ON public.strand_scores FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HT view strand_scores" ON public.strand_scores FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Teacher view strand_scores" ON public.strand_scores FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'teacher'::app_role) AND school_id = get_user_school_id(auth.uid())
    AND learner_id IN (SELECT id FROM learners WHERE grade = ANY(get_user_assigned_grades(auth.uid()))));

CREATE POLICY "Teacher insert strand_scores" ON public.strand_scores FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND school_id = get_user_school_id(auth.uid())
    AND learner_id IN (SELECT id FROM learners WHERE grade = ANY(get_user_assigned_grades(auth.uid()))));

CREATE POLICY "Teacher update strand_scores" ON public.strand_scores FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'teacher'::app_role) AND school_id = get_user_school_id(auth.uid())
    AND learner_id IN (SELECT id FROM learners WHERE grade = ANY(get_user_assigned_grades(auth.uid()))));

CREATE POLICY "Parent view linked strand_scores" ON public.strand_scores FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'parent'::app_role) AND learner_id IN (
    SELECT learner_id FROM parent_learners WHERE parent_user_id = auth.uid()));

-- Trigger for updated_at on strand_scores
CREATE TRIGGER update_strand_scores_updated_at
  BEFORE UPDATE ON public.strand_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
