
-- Create parent_learners linking table
CREATE TABLE public.parent_learners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id UUID NOT NULL,
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'parent',
  school_id UUID REFERENCES public.schools(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(parent_user_id, learner_id)
);

ALTER TABLE public.parent_learners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own links"
ON public.parent_learners FOR SELECT
TO authenticated
USING (auth.uid() = parent_user_id);

CREATE POLICY "Admin manage parent links"
ON public.parent_learners FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND school_id = get_user_school_id(auth.uid())
);

CREATE POLICY "SA full parent_learners"
ON public.parent_learners FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_parent_learners_parent ON public.parent_learners(parent_user_id);
CREATE INDEX idx_parent_learners_learner ON public.parent_learners(learner_id);

-- Parent RLS policies on existing tables
CREATE POLICY "Parent view linked learners"
ON public.learners FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND id IN (SELECT learner_id FROM public.parent_learners WHERE parent_user_id = auth.uid())
);

CREATE POLICY "Parent view linked scores"
ON public.scores FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND learner_id IN (SELECT learner_id FROM public.parent_learners WHERE parent_user_id = auth.uid())
);

CREATE POLICY "Parent view linked attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND learner_id IN (SELECT learner_id FROM public.parent_learners WHERE parent_user_id = auth.uid())
);

CREATE POLICY "Parent view learning areas"
ON public.learning_areas FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'parent'::app_role));

CREATE POLICY "Parent view school"
ON public.schools FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND id IN (
    SELECT school_id FROM public.parent_learners WHERE parent_user_id = auth.uid()
  )
);

-- Automated attendance alert function
CREATE OR REPLACE FUNCTION public.check_attendance_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT l.id AS learner_id, l.full_name, l.grade, l.stream, l.school_id,
      ROUND(COUNT(*) FILTER (WHERE a.status = 'present')::numeric / NULLIF(COUNT(*), 0) * 100) AS pct
    FROM learners l
    JOIN attendance a ON a.learner_id = l.id
    WHERE a.date >= CURRENT_DATE - INTERVAL '7 days'
      AND l.is_active = true
    GROUP BY l.id, l.full_name, l.grade, l.stream, l.school_id
    HAVING ROUND(COUNT(*) FILTER (WHERE a.status = 'present')::numeric / NULLIF(COUNT(*), 0) * 100) < 70
  LOOP
    INSERT INTO notifications (user_id, school_id, title, message, type, metadata)
    SELECT p.user_id, rec.school_id,
      'Low Attendance Alert',
      rec.full_name || ' (Grade ' || rec.grade || ' ' || rec.stream || ') has ' || rec.pct || '% attendance this week.',
      'attendance',
      jsonb_build_object('learner_id', rec.learner_id, 'attendance_pct', rec.pct)
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE p.school_id = rec.school_id
      AND ur.role IN ('admin', 'teacher', 'headteacher');
  END LOOP;
END;
$$;

-- Automated performance drop function
CREATE OR REPLACE FUNCTION public.check_performance_drops()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    WITH ranked AS (
      SELECT s.learner_id, s.term, s.year, s.assessment_type,
        AVG(s.score) AS avg_score,
        ROW_NUMBER() OVER (PARTITION BY s.learner_id ORDER BY s.year DESC, s.term DESC,
          CASE s.assessment_type WHEN 'end_term' THEN 3 WHEN 'mid_term' THEN 2 ELSE 1 END DESC
        ) AS rn
      FROM scores s
      GROUP BY s.learner_id, s.term, s.year, s.assessment_type
    ),
    drops AS (
      SELECT r1.learner_id,
        r1.avg_score AS latest_avg,
        r2.avg_score AS prev_avg,
        r2.avg_score - r1.avg_score AS drop_amount
      FROM ranked r1
      JOIN ranked r2 ON r1.learner_id = r2.learner_id AND r1.rn = 1 AND r2.rn = 2
      WHERE r2.avg_score - r1.avg_score > 15
    )
    SELECT d.*, l.full_name, l.grade, l.stream, l.school_id
    FROM drops d
    JOIN learners l ON l.id = d.learner_id
    WHERE l.is_active = true
  LOOP
    INSERT INTO notifications (user_id, school_id, title, message, type, metadata)
    SELECT p.user_id, rec.school_id,
      'Performance Drop Alert',
      rec.full_name || ' (Grade ' || rec.grade || ') dropped by ' || ROUND(rec.drop_amount) || ' points.',
      'alert',
      jsonb_build_object('learner_id', rec.learner_id, 'drop', rec.drop_amount)
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE p.school_id = rec.school_id
      AND ur.role IN ('admin', 'teacher', 'headteacher');
  END LOOP;
END;
$$;
