
-- Attendance table for daily tracking
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  remarks text,
  marked_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(learner_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage attendance" ON public.attendance FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Headteachers can view attendance" ON public.attendance FOR SELECT TO public
  USING (has_role(auth.uid(), 'headteacher'::app_role));

CREATE POLICY "Teachers can view attendance for assigned learners" ON public.attendance FOR SELECT TO public
  USING (has_role(auth.uid(), 'teacher'::app_role) AND learner_id IN (
    SELECT id FROM public.learners WHERE grade = ANY(get_user_assigned_grades(auth.uid()))
  ));

CREATE POLICY "Teachers can insert attendance for assigned learners" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND learner_id IN (
    SELECT id FROM public.learners WHERE grade = ANY(get_user_assigned_grades(auth.uid()))
  ));

CREATE POLICY "Teachers can update attendance for assigned learners" ON public.attendance FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'teacher'::app_role) AND learner_id IN (
    SELECT id FROM public.learners WHERE grade = ANY(get_user_assigned_grades(auth.uid()))
  ));
