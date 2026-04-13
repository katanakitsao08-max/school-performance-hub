
-- Add gender column to learners
ALTER TABLE public.learners ADD COLUMN gender text NOT NULL DEFAULT 'Male';

-- Add assessment_type column to scores
ALTER TABLE public.scores ADD COLUMN assessment_type text NOT NULL DEFAULT 'end_term';

-- Drop existing unique constraint on scores (learner_id, learning_area_id, term, year)
-- and recreate with assessment_type included
DO $$
BEGIN
  -- Try dropping constraint by common names
  BEGIN
    ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_learner_id_learning_area_id_term_year_key;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS unique_score_entry;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Also drop any unique index that might serve as the upsert target
DROP INDEX IF EXISTS public.scores_learner_id_learning_area_id_term_year_key;
DROP INDEX IF EXISTS public.unique_score_entry;

-- Create the new unique constraint including assessment_type
CREATE UNIQUE INDEX scores_learner_subject_term_year_assessment_key
  ON public.scores (learner_id, learning_area_id, term, year, assessment_type);
