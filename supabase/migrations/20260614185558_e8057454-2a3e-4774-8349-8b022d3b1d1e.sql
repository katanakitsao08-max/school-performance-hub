
-- 1. Extend scores
ALTER TABLE public.scores
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by uuid,
  ADD COLUMN IF NOT EXISTS unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS unlocked_by uuid,
  ADD COLUMN IF NOT EXISTS unlock_reason text,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by uuid;

UPDATE public.scores SET submitted_at = COALESCE(submitted_at, updated_at, created_at, now()) WHERE submitted_at IS NULL;

-- 2. Extend strand_scores
ALTER TABLE public.strand_scores
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by uuid,
  ADD COLUMN IF NOT EXISTS unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS unlocked_by uuid,
  ADD COLUMN IF NOT EXISTS unlock_reason text,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by uuid;

UPDATE public.strand_scores SET submitted_at = COALESCE(submitted_at, updated_at, created_at, now()) WHERE submitted_at IS NULL;

-- 3. Helper function
CREATE OR REPLACE FUNCTION public.is_score_locked(_submitted_at timestamptz, _status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _status = 'unlocked' THEN false
    WHEN _status = 'locked' THEN true
    WHEN _submitted_at IS NOT NULL AND _submitted_at < (now() - interval '21 days') THEN true
    ELSE false
  END;
$$;

-- 4. Replace teacher UPDATE policies with lock-aware versions
DROP POLICY IF EXISTS "Teacher update scores" ON public.scores;
CREATE POLICY "Teacher update scores"
  ON public.scores FOR UPDATE
  USING (
    has_role(auth.uid(), 'teacher'::app_role)
    AND school_id = get_user_school_id(auth.uid())
    AND learner_id IN (SELECT id FROM learners WHERE grade = ANY (get_user_assigned_grades(auth.uid())))
    AND NOT public.is_score_locked(submitted_at, status)
  );

CREATE POLICY "Teacher delete scores"
  ON public.scores FOR DELETE
  USING (
    has_role(auth.uid(), 'teacher'::app_role)
    AND school_id = get_user_school_id(auth.uid())
    AND learner_id IN (SELECT id FROM learners WHERE grade = ANY (get_user_assigned_grades(auth.uid())))
    AND NOT public.is_score_locked(submitted_at, status)
  );

DROP POLICY IF EXISTS "Teacher update strand_scores" ON public.strand_scores;
CREATE POLICY "Teacher update strand_scores"
  ON public.strand_scores FOR UPDATE
  USING (
    has_role(auth.uid(), 'teacher'::app_role)
    AND school_id = get_user_school_id(auth.uid())
    AND learner_id IN (SELECT id FROM learners WHERE grade = ANY (get_user_assigned_grades(auth.uid())))
    AND NOT public.is_score_locked(submitted_at, status)
  );

CREATE POLICY "Teacher delete strand_scores"
  ON public.strand_scores FOR DELETE
  USING (
    has_role(auth.uid(), 'teacher'::app_role)
    AND school_id = get_user_school_id(auth.uid())
    AND learner_id IN (SELECT id FROM learners WHERE grade = ANY (get_user_assigned_grades(auth.uid())))
    AND NOT public.is_score_locked(submitted_at, status)
  );

-- 5. Audit log table
CREATE TABLE IF NOT EXISTS public.score_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_table text NOT NULL CHECK (score_table IN ('scores','strand_scores')),
  score_id uuid NOT NULL,
  learner_id uuid,
  learning_area_id uuid,
  strand_id uuid,
  school_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('edit','unlock','lock','delete')),
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.score_audit_log TO authenticated;
GRANT ALL ON public.score_audit_log TO service_role;
ALTER TABLE public.score_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read school audit"
  ON public.score_audit_log FOR SELECT
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'headteacher'::app_role))
    AND school_id = get_user_school_id(auth.uid())
  );

CREATE POLICY "SA read all audit"
  ON public.score_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin insert audit"
  ON public.score_audit_log FOR INSERT
  WITH CHECK (
    actor_user_id = auth.uid()
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND school_id = get_user_school_id(auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_score_audit_school_created ON public.score_audit_log(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_audit_learner ON public.score_audit_log(learner_id);
CREATE INDEX IF NOT EXISTS idx_scores_status_submitted ON public.scores(status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_strand_scores_status_submitted ON public.strand_scores(status, submitted_at);
