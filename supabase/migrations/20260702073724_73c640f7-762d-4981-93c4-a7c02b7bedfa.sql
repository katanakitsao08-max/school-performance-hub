
CREATE TABLE public.merged_subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  max_score NUMERIC NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX merged_subjects_school_grade_name_key
  ON public.merged_subjects (school_id, grade, lower(name));
CREATE INDEX merged_subjects_school_grade_idx
  ON public.merged_subjects (school_id, grade) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merged_subjects TO authenticated;
GRANT ALL ON public.merged_subjects TO service_role;
ALTER TABLE public.merged_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merged_subjects_select_same_school" ON public.merged_subjects
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR school_id = public.get_user_school_id(auth.uid())
  );

CREATE POLICY "merged_subjects_admin_write" ON public.merged_subjects
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE TRIGGER update_merged_subjects_updated_at
  BEFORE UPDATE ON public.merged_subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.merged_subject_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merged_subject_id UUID NOT NULL REFERENCES public.merged_subjects(id) ON DELETE CASCADE,
  learning_area_id UUID NOT NULL REFERENCES public.learning_areas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merged_subject_id, learning_area_id)
);
CREATE INDEX merged_subject_items_ms_idx ON public.merged_subject_items (merged_subject_id);
CREATE INDEX merged_subject_items_la_idx ON public.merged_subject_items (learning_area_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merged_subject_items TO authenticated;
GRANT ALL ON public.merged_subject_items TO service_role;
ALTER TABLE public.merged_subject_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merged_subject_items_select_same_school" ON public.merged_subject_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merged_subjects ms
      WHERE ms.id = merged_subject_id
        AND (
          public.has_role(auth.uid(), 'super_admin'::app_role)
          OR ms.school_id = public.get_user_school_id(auth.uid())
        )
    )
  );

CREATE POLICY "merged_subject_items_admin_write" ON public.merged_subject_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merged_subjects ms
      WHERE ms.id = merged_subject_id
        AND (
          public.has_role(auth.uid(), 'super_admin'::app_role)
          OR (ms.school_id = public.get_user_school_id(auth.uid())
              AND public.has_role(auth.uid(), 'admin'::app_role))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.merged_subjects ms
      WHERE ms.id = merged_subject_id
        AND (
          public.has_role(auth.uid(), 'super_admin'::app_role)
          OR (ms.school_id = public.get_user_school_id(auth.uid())
              AND public.has_role(auth.uid(), 'admin'::app_role))
        )
    )
  );

-- Enforce: a learning area can only sit in one merged subject per (school, grade)
CREATE OR REPLACE FUNCTION public.enforce_single_merge_per_grade()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ms_school UUID;
  ms_grade TEXT;
  la_grade TEXT;
  la_school UUID;
  conflict_count INT;
BEGIN
  SELECT school_id, grade INTO ms_school, ms_grade
  FROM public.merged_subjects WHERE id = NEW.merged_subject_id;

  SELECT school_id, grade INTO la_school, la_grade
  FROM public.learning_areas WHERE id = NEW.learning_area_id;

  IF la_school IS DISTINCT FROM ms_school OR la_grade IS DISTINCT FROM ms_grade THEN
    RAISE EXCEPTION 'Learning area school/grade does not match merged subject';
  END IF;

  SELECT COUNT(*) INTO conflict_count
  FROM public.merged_subject_items msi
  JOIN public.merged_subjects ms ON ms.id = msi.merged_subject_id
  WHERE msi.learning_area_id = NEW.learning_area_id
    AND ms.school_id = ms_school
    AND ms.grade = ms_grade
    AND msi.merged_subject_id <> NEW.merged_subject_id;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'This subject is already part of another merged subject for this grade';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER merged_subject_items_enforce_unique
  BEFORE INSERT OR UPDATE ON public.merged_subject_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_merge_per_grade();
