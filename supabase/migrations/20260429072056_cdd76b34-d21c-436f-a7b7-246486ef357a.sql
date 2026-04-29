-- Additive: assessment_number on learners (optional, unique per school when set)
ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS assessment_number text;

CREATE UNIQUE INDEX IF NOT EXISTS learners_school_assessment_unique
  ON public.learners (school_id, assessment_number)
  WHERE assessment_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS learners_assessment_number_idx
  ON public.learners (assessment_number)
  WHERE assessment_number IS NOT NULL;