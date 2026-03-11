-- Create schools table
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL,
  school_code text UNIQUE NOT NULL,
  county text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  subscription_status text NOT NULL DEFAULT 'trial',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Add school_id to all tables
ALTER TABLE public.profiles ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.learners ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.learning_areas ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.streams ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.scores ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.school_settings ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.promotion_log ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$ SELECT school_id FROM public.profiles WHERE user_id = _user_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.generate_school_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE code text; exists_count int;
BEGIN
  LOOP
    code := 'SCH-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 6));
    SELECT COUNT(*) INTO exists_count FROM public.schools WHERE school_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END; $$;

-- Schools RLS
CREATE POLICY "Super admins manage schools" ON public.schools FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users view own school" ON public.schools FOR SELECT TO authenticated USING (id = public.get_user_school_id(auth.uid()));

-- Learners RLS
DROP POLICY IF EXISTS "Admins can manage learners" ON public.learners;
DROP POLICY IF EXISTS "Headteachers can view all learners" ON public.learners;
DROP POLICY IF EXISTS "Teachers can view assigned learners" ON public.learners;
DROP POLICY IF EXISTS "Teachers can insert learners for assigned grades" ON public.learners;
DROP POLICY IF EXISTS "Teachers can update learners for assigned grades" ON public.learners;
CREATE POLICY "SA full learners" ON public.learners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin school learners" ON public.learners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "HT school learners" ON public.learners FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'headteacher') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Teacher view learners" ON public.learners FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher') AND school_id = public.get_user_school_id(auth.uid()) AND grade = ANY(public.get_user_assigned_grades(auth.uid())));
CREATE POLICY "Teacher insert learners" ON public.learners FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher') AND school_id = public.get_user_school_id(auth.uid()) AND grade = ANY(public.get_user_assigned_grades(auth.uid())));
CREATE POLICY "Teacher update learners" ON public.learners FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'teacher') AND school_id = public.get_user_school_id(auth.uid()) AND grade = ANY(public.get_user_assigned_grades(auth.uid())));

-- Scores RLS
DROP POLICY IF EXISTS "Admins can manage scores" ON public.scores;
DROP POLICY IF EXISTS "Headteachers can view all scores" ON public.scores;
DROP POLICY IF EXISTS "Teachers can view scores for assigned learners" ON public.scores;
DROP POLICY IF EXISTS "Teachers can insert scores for assigned learners" ON public.scores;
DROP POLICY IF EXISTS "Teachers can update scores for assigned learners" ON public.scores;
CREATE POLICY "SA full scores" ON public.scores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin school scores" ON public.scores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "HT school scores" ON public.scores FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'headteacher') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Teacher view scores" ON public.scores FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher') AND school_id = public.get_user_school_id(auth.uid()) AND learner_id IN (SELECT id FROM public.learners WHERE grade = ANY(public.get_user_assigned_grades(auth.uid()))));
CREATE POLICY "Teacher insert scores" ON public.scores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher') AND school_id = public.get_user_school_id(auth.uid()) AND learner_id IN (SELECT id FROM public.learners WHERE grade = ANY(public.get_user_assigned_grades(auth.uid()))));
CREATE POLICY "Teacher update scores" ON public.scores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'teacher') AND school_id = public.get_user_school_id(auth.uid()) AND learner_id IN (SELECT id FROM public.learners WHERE grade = ANY(public.get_user_assigned_grades(auth.uid()))));

-- Attendance RLS
DROP POLICY IF EXISTS "Admins can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Headteachers can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can view attendance for assigned learners" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can insert attendance for assigned learners" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can update attendance for assigned learners" ON public.attendance;
CREATE POLICY "SA full attendance" ON public.attendance FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin school attendance" ON public.attendance FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "HT school attendance" ON public.attendance FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'headteacher') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Teacher view attendance" ON public.attendance FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher') AND school_id = public.get_user_school_id(auth.uid()) AND learner_id IN (SELECT id FROM public.learners WHERE grade = ANY(public.get_user_assigned_grades(auth.uid()))));
CREATE POLICY "Teacher insert attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher') AND school_id = public.get_user_school_id(auth.uid()) AND learner_id IN (SELECT id FROM public.learners WHERE grade = ANY(public.get_user_assigned_grades(auth.uid()))));
CREATE POLICY "Teacher update attendance" ON public.attendance FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'teacher') AND school_id = public.get_user_school_id(auth.uid()) AND learner_id IN (SELECT id FROM public.learners WHERE grade = ANY(public.get_user_assigned_grades(auth.uid()))));

-- Learning areas RLS
DROP POLICY IF EXISTS "Admins can manage learning areas" ON public.learning_areas;
DROP POLICY IF EXISTS "Authenticated can view learning areas" ON public.learning_areas;
CREATE POLICY "SA full la" ON public.learning_areas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin school la" ON public.learning_areas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Users view school la" ON public.learning_areas FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));

-- Streams RLS
DROP POLICY IF EXISTS "Admins can manage streams" ON public.streams;
DROP POLICY IF EXISTS "Authenticated can view streams" ON public.streams;
CREATE POLICY "SA full streams" ON public.streams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin school streams" ON public.streams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Users view school streams" ON public.streams FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));

-- School settings RLS
DROP POLICY IF EXISTS "Admins can manage settings" ON public.school_settings;
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.school_settings;
CREATE POLICY "SA full settings" ON public.school_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin school settings" ON public.school_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Users view school settings" ON public.school_settings FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));

-- Promotion log RLS
DROP POLICY IF EXISTS "Admins can manage promotion log" ON public.promotion_log;
DROP POLICY IF EXISTS "Headteachers can view promotion log" ON public.promotion_log;
CREATE POLICY "SA full promo" ON public.promotion_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin school promo" ON public.promotion_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "HT school promo" ON public.promotion_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'headteacher') AND school_id = public.get_user_school_id(auth.uid()));

-- Profiles RLS
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Headteachers can view all profiles" ON public.profiles;
CREATE POLICY "SA full profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin view school profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admin update school profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admin insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Admin delete school profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "HT view school profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'headteacher') AND school_id = public.get_user_school_id(auth.uid()));

-- User roles RLS
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "SA full roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin view school roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.school_id = public.get_user_school_id(auth.uid())));
CREATE POLICY "Admin manage school roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') AND user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.school_id = public.get_user_school_id(auth.uid())));

-- Updated_at trigger for schools
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();