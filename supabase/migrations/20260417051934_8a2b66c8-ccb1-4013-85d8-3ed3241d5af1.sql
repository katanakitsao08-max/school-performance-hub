
-- Activation keys for Timetable Generator (Super Admin issued, per school)
CREATE TABLE public.timetable_activation_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  activation_key TEXT NOT NULL UNIQUE,
  generated_by UUID NOT NULL,
  activated_at TIMESTAMP WITH TIME ZONE,
  activated_by UUID,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_tak_school ON public.timetable_activation_keys(school_id);
CREATE INDEX idx_tak_key ON public.timetable_activation_keys(activation_key);

ALTER TABLE public.timetable_activation_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SA full activation_keys" ON public.timetable_activation_keys
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin view own school key" ON public.timetable_activation_keys
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Admin activate own school key" ON public.timetable_activation_keys
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE TRIGGER trg_tak_updated
  BEFORE UPDATE ON public.timetable_activation_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Timetables
CREATE TABLE public.timetables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT,
  stream TEXT,
  days TEXT[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  periods_per_day INTEGER NOT NULL DEFAULT 8,
  break_period INTEGER,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_timetables_school ON public.timetables(school_id);

ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SA full timetables" ON public.timetables
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin school timetables" ON public.timetables
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "HT view timetables" ON public.timetables
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Teacher view timetables" ON public.timetables
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'teacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE TRIGGER trg_timetables_updated
  BEFORE UPDATE ON public.timetables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
