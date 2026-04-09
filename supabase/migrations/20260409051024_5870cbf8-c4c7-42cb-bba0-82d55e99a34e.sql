
-- Granular teacher-to-subject+class assignments
CREATE TABLE public.teacher_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  grade TEXT NOT NULL,
  stream TEXT NOT NULL,
  learning_area_id UUID NOT NULL REFERENCES public.learning_areas(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, grade, stream, learning_area_id, school_id)
);

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SA full teacher_assignments" ON public.teacher_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin school teacher_assignments" ON public.teacher_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "HT view teacher_assignments" ON public.teacher_assignments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Teacher view own assignments" ON public.teacher_assignments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'teacher'::app_role) AND teacher_id = auth.uid());

-- Class teacher assignments (independent from subject assignments)
CREATE TABLE public.class_teachers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  grade TEXT NOT NULL,
  stream TEXT NOT NULL,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (grade, stream, school_id)
);

ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SA full class_teachers" ON public.class_teachers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin school class_teachers" ON public.class_teachers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "HT view class_teachers" ON public.class_teachers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Teacher view own class_teacher" ON public.class_teachers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'teacher'::app_role) AND teacher_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_teacher_assignments_teacher ON public.teacher_assignments(teacher_id);
CREATE INDEX idx_teacher_assignments_school ON public.teacher_assignments(school_id);
CREATE INDEX idx_class_teachers_teacher ON public.class_teachers(teacher_id);
CREATE INDEX idx_class_teachers_school ON public.class_teachers(school_id);
