
-- 1. Soft-delete columns on scores + strand_scores
ALTER TABLE public.scores
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text;

ALTER TABLE public.strand_scores
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text;

-- 2. Replace unique constraints with partial unique indexes (exclude deleted rows)
ALTER TABLE public.scores
  DROP CONSTRAINT IF EXISTS scores_learner_subject_term_year_assessment_key;
CREATE UNIQUE INDEX IF NOT EXISTS scores_active_unique_idx
  ON public.scores (learner_id, learning_area_id, term, year, assessment_type)
  WHERE deleted_at IS NULL;

ALTER TABLE public.strand_scores
  DROP CONSTRAINT IF EXISTS strand_scores_learner_id_strand_id_term_year_assessment_typ_key;
CREATE UNIQUE INDEX IF NOT EXISTS strand_scores_active_unique_idx
  ON public.strand_scores (learner_id, strand_id, term, year, assessment_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS scores_deleted_at_idx ON public.scores (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS strand_scores_deleted_at_idx ON public.strand_scores (deleted_at) WHERE deleted_at IS NOT NULL;

-- 3. Update SELECT policies for non-admin roles to exclude soft-deleted rows
DROP POLICY IF EXISTS "Teacher view scores" ON public.scores;
CREATE POLICY "Teacher view scores" ON public.scores FOR SELECT
  USING (
    has_role(auth.uid(), 'teacher'::app_role)
    AND school_id = get_user_school_id(auth.uid())
    AND learner_id IN (SELECT id FROM public.learners WHERE grade = ANY (get_user_assigned_grades(auth.uid())))
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "HT school scores" ON public.scores;
CREATE POLICY "HT school scores" ON public.scores FOR SELECT
  USING (
    has_role(auth.uid(), 'headteacher'::app_role)
    AND school_id = get_user_school_id(auth.uid())
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Parent view linked scores" ON public.scores;
CREATE POLICY "Parent view linked scores" ON public.scores FOR SELECT
  USING (
    has_role(auth.uid(), 'parent'::app_role)
    AND deleted_at IS NULL
    AND learner_id IN (SELECT learner_id FROM public.parent_learners WHERE parent_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Parent view school scores" ON public.scores;
CREATE POLICY "Parent view school scores" ON public.scores FOR SELECT
  USING (
    has_role(auth.uid(), 'parent'::app_role)
    AND deleted_at IS NULL
    AND school_id IN (SELECT school_id FROM public.parent_learners WHERE parent_user_id = auth.uid())
  );

-- 4. Bulk soft-delete function
CREATE OR REPLACE FUNCTION public.bulk_soft_delete_scores(
  _score_ids uuid[],
  _reason text DEFAULT NULL
) RETURNS TABLE (deleted_count int, skipped_count int, skipped_reasons jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  user_school uuid := public.get_user_school_id(uid);
  is_admin boolean := public.has_role(uid, 'admin'::app_role) OR public.has_role(uid, 'super_admin'::app_role);
  is_ht boolean := public.has_role(uid, 'headteacher'::app_role);
  is_teacher boolean := public.has_role(uid, 'teacher'::app_role);
  assigned_grades text[] := public.get_user_assigned_grades(uid);
  rec record;
  d_count int := 0;
  s_count int := 0;
  s_reasons jsonb := '[]'::jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (is_admin OR is_ht OR is_teacher) THEN RAISE EXCEPTION 'forbidden'; END IF;

  FOR rec IN
    SELECT s.*, l.grade AS learner_grade
    FROM public.scores s
    JOIN public.learners l ON l.id = s.learner_id
    WHERE s.id = ANY(_score_ids) AND s.deleted_at IS NULL
  LOOP
    -- School scope (super_admin bypass)
    IF NOT public.has_role(uid, 'super_admin'::app_role) AND rec.school_id <> user_school THEN
      s_count := s_count + 1;
      s_reasons := s_reasons || jsonb_build_object('id', rec.id, 'reason', 'wrong school');
      CONTINUE;
    END IF;

    -- Teacher: only assigned grades, only unlocked
    IF is_teacher AND NOT is_admin THEN
      IF assigned_grades IS NULL OR NOT (rec.learner_grade = ANY(assigned_grades)) THEN
        s_count := s_count + 1;
        s_reasons := s_reasons || jsonb_build_object('id', rec.id, 'reason', 'not assigned to grade');
        CONTINUE;
      END IF;
      IF public.is_score_locked(rec.submitted_at, rec.status) THEN
        s_count := s_count + 1;
        s_reasons := s_reasons || jsonb_build_object('id', rec.id, 'reason', 'score locked');
        CONTINUE;
      END IF;
    END IF;

    -- Head teacher: school-wide but lock applies
    IF is_ht AND NOT is_admin THEN
      IF public.is_score_locked(rec.submitted_at, rec.status) THEN
        s_count := s_count + 1;
        s_reasons := s_reasons || jsonb_build_object('id', rec.id, 'reason', 'score locked');
        CONTINUE;
      END IF;
    END IF;

    UPDATE public.scores
       SET deleted_at = now(), deleted_by = uid, delete_reason = _reason, updated_at = now()
     WHERE id = rec.id;

    INSERT INTO public.score_audit_log
      (score_table, score_id, learner_id, learning_area_id, school_id, actor_user_id, action, previous_value, reason)
    VALUES
      ('scores', rec.id, rec.learner_id, rec.learning_area_id, rec.school_id, uid, 'delete',
       to_jsonb(rec) - 'learner_grade', _reason);

    d_count := d_count + 1;
  END LOOP;

  deleted_count := d_count;
  skipped_count := s_count;
  skipped_reasons := s_reasons;
  RETURN NEXT;
END;
$$;

-- 5. Restore function (admin / super_admin only)
CREATE OR REPLACE FUNCTION public.restore_soft_deleted_scores(_audit_ids uuid[])
RETURNS TABLE (restored_count int, skipped_count int, skipped_reasons jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean := public.has_role(uid, 'admin'::app_role) OR public.has_role(uid, 'super_admin'::app_role);
  user_school uuid := public.get_user_school_id(uid);
  rec record;
  target_id uuid;
  prev jsonb;
  r_count int := 0;
  s_count int := 0;
  s_reasons jsonb := '[]'::jsonb;
  conflict_exists boolean;
BEGIN
  IF NOT is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;

  FOR rec IN
    SELECT * FROM public.score_audit_log
     WHERE id = ANY(_audit_ids) AND action='delete' AND score_table='scores'
       AND created_at > now() - interval '30 days'
  LOOP
    IF NOT public.has_role(uid, 'super_admin'::app_role) AND rec.school_id <> user_school THEN
      s_count := s_count + 1;
      s_reasons := s_reasons || jsonb_build_object('audit_id', rec.id, 'reason', 'wrong school');
      CONTINUE;
    END IF;

    target_id := rec.score_id;
    prev := rec.previous_value;

    -- Check uniqueness conflict (active row already exists for same learner/subject/term/year/assessment)
    SELECT EXISTS(
      SELECT 1 FROM public.scores
       WHERE deleted_at IS NULL
         AND id <> target_id
         AND learner_id = (prev->>'learner_id')::uuid
         AND learning_area_id = (prev->>'learning_area_id')::uuid
         AND term = (prev->>'term')::int
         AND year = (prev->>'year')::int
         AND assessment_type = prev->>'assessment_type'
    ) INTO conflict_exists;

    IF conflict_exists THEN
      s_count := s_count + 1;
      s_reasons := s_reasons || jsonb_build_object('audit_id', rec.id, 'reason', 'newer score exists');
      CONTINUE;
    END IF;

    UPDATE public.scores
       SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()
     WHERE id = target_id AND deleted_at IS NOT NULL;

    IF FOUND THEN
      INSERT INTO public.score_audit_log
        (score_table, score_id, learner_id, learning_area_id, school_id, actor_user_id, action, new_value, reason)
      VALUES
        ('scores', target_id, (prev->>'learner_id')::uuid, (prev->>'learning_area_id')::uuid,
         rec.school_id, uid, 'edit', jsonb_build_object('restored', true), 'restore');
      r_count := r_count + 1;
    ELSE
      s_count := s_count + 1;
      s_reasons := s_reasons || jsonb_build_object('audit_id', rec.id, 'reason', 'score row missing');
    END IF;
  END LOOP;

  restored_count := r_count;
  skipped_count := s_count;
  skipped_reasons := s_reasons;
  RETURN NEXT;
END;
$$;

-- 6. Undo last upload (recent submissions by current user)
CREATE OR REPLACE FUNCTION public.undo_last_score_upload(_minutes int DEFAULT 30)
RETURNS TABLE (deleted_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ids uuid[];
  n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT array_agg(id) INTO ids
  FROM public.scores
  WHERE submitted_by = uid
    AND deleted_at IS NULL
    AND created_at > now() - make_interval(mins => _minutes);

  IF ids IS NULL OR array_length(ids, 1) IS NULL THEN
    deleted_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT deleted_count INTO n FROM public.bulk_soft_delete_scores(ids, 'undo last upload');
  deleted_count := COALESCE(n, 0);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_soft_delete_scores(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_soft_deleted_scores(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_last_score_upload(int) TO authenticated;
