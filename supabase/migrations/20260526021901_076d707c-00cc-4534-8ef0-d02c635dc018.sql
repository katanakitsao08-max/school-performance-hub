
-- Add new role value
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pending_teacher';

-- pending_schools
CREATE TABLE IF NOT EXISTS public.pending_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL,
  normalized_name text NOT NULL,
  county text NOT NULL DEFAULT '',
  onboarding_status text NOT NULL DEFAULT 'pending',
  linked_school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pending_schools_normalized_name_key ON public.pending_schools(normalized_name);
ALTER TABLE public.pending_schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read pending_schools" ON public.pending_schools
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert pending_schools" ON public.pending_schools
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "SA full pending_schools" ON public.pending_schools
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- teacher_registrations
CREATE TABLE IF NOT EXISTS public.teacher_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  tsc_number text,
  school_name_raw text NOT NULL,
  pending_school_id uuid REFERENCES public.pending_schools(id) ON DELETE SET NULL,
  county text NOT NULL DEFAULT '',
  class_name text NOT NULL,
  stream text NOT NULL DEFAULT 'A',
  approval_status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  approved_by uuid,
  approved_at timestamptz,
  linked_school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Self read teacher_registrations" ON public.teacher_registrations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Self insert teacher_registrations" ON public.teacher_registrations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND approval_status = 'pending');
CREATE POLICY "SA full teacher_registrations" ON public.teacher_registrations
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- teacher_classes
CREATE TABLE IF NOT EXISTS public.teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id uuid NOT NULL,
  pending_school_id uuid REFERENCES public.pending_schools(id) ON DELETE SET NULL,
  class_name text NOT NULL,
  stream text NOT NULL DEFAULT 'A',
  linked_school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Self manage teacher_classes" ON public.teacher_classes
  FOR ALL TO authenticated USING (teacher_user_id = auth.uid())
  WITH CHECK (teacher_user_id = auth.uid());
CREATE POLICY "SA full teacher_classes" ON public.teacher_classes
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- teacher_learners
CREATE TABLE IF NOT EXISTS public.teacher_learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL,
  full_name text NOT NULL,
  admission_number text NOT NULL,
  gender text NOT NULL DEFAULT 'Male',
  parent_name text,
  parent_phone text,
  is_active boolean NOT NULL DEFAULT true,
  migrated_learner_id uuid REFERENCES public.learners(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS teacher_learners_class_idx ON public.teacher_learners(class_id);
ALTER TABLE public.teacher_learners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Self manage teacher_learners" ON public.teacher_learners
  FOR ALL TO authenticated USING (teacher_user_id = auth.uid())
  WITH CHECK (teacher_user_id = auth.uid());
CREATE POLICY "SA full teacher_learners" ON public.teacher_learners
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Updated_at triggers
CREATE TRIGGER trg_pending_schools_updated BEFORE UPDATE ON public.pending_schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_teacher_registrations_updated BEFORE UPDATE ON public.teacher_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_teacher_classes_updated BEFORE UPDATE ON public.teacher_classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_teacher_learners_updated BEFORE UPDATE ON public.teacher_learners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link helper
CREATE OR REPLACE FUNCTION public.link_pending_school_to_school(_pending_school_id uuid, _school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.pending_schools
    SET linked_school_id = _school_id, onboarding_status = 'linked', updated_at = now()
    WHERE id = _pending_school_id;
  UPDATE public.teacher_registrations
    SET linked_school_id = _school_id, updated_at = now()
    WHERE pending_school_id = _pending_school_id;
  UPDATE public.teacher_classes
    SET linked_school_id = _school_id, updated_at = now()
    WHERE pending_school_id = _pending_school_id;
END;
$$;
