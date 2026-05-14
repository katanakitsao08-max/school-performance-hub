
-- Per-school timetable settings (one row per school)
CREATE TABLE public.timetable_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE,
  num_days integer NOT NULL DEFAULT 5,
  day_labels jsonb NOT NULL DEFAULT '["Monday","Tuesday","Wednesday","Thursday","Friday"]'::jsonb,
  weekend jsonb NOT NULL DEFAULT '["Saturday","Sunday"]'::jsonb,
  periods_per_day integer NOT NULL DEFAULT 11,
  zero_period boolean NOT NULL DEFAULT false,
  break_periods jsonb NOT NULL DEFAULT '[3,6,9]'::jsonb,
  break_labels jsonb NOT NULL DEFAULT '["SHORT BREAK","LONG BREAK","LUNCH"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timetable_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SA full timetable_settings" ON public.timetable_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manage school timetable_settings" ON public.timetable_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Users view school timetable_settings" ON public.timetable_settings
  FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));

CREATE TRIGGER update_timetable_settings_updated_at
  BEFORE UPDATE ON public.timetable_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Per-class subject lesson definitions
CREATE TABLE public.timetable_class_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  grade text NOT NULL,
  stream text NOT NULL,
  learning_area_id uuid NOT NULL,
  teacher_id uuid,
  count integer NOT NULL DEFAULT 1,
  length integer NOT NULL DEFAULT 1,
  classroom text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, grade, stream, learning_area_id)
);

CREATE INDEX idx_ttcl_school_class ON public.timetable_class_lessons(school_id, grade, stream);

ALTER TABLE public.timetable_class_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SA full timetable_class_lessons" ON public.timetable_class_lessons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manage school timetable_class_lessons" ON public.timetable_class_lessons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Users view school timetable_class_lessons" ON public.timetable_class_lessons
  FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));

CREATE TRIGGER update_timetable_class_lessons_updated_at
  BEFORE UPDATE ON public.timetable_class_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
