CREATE TABLE public.principal_comment_bands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  min_score NUMERIC NOT NULL DEFAULT 0,
  max_score NUMERIC NOT NULL DEFAULT 100,
  comment TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pcb_school ON public.principal_comment_bands(school_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.principal_comment_bands TO authenticated;
GRANT ALL ON public.principal_comment_bands TO service_role;

ALTER TABLE public.principal_comment_bands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage school comment bands"
ON public.principal_comment_bands FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "School users view comment bands"
ON public.principal_comment_bands FOR SELECT TO authenticated
USING (school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Parent view school comment bands"
ON public.principal_comment_bands FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND school_id IN (SELECT school_id FROM parent_learners WHERE parent_user_id = auth.uid())
);

CREATE POLICY "SA full comment bands"
ON public.principal_comment_bands FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_pcb_updated_at
BEFORE UPDATE ON public.principal_comment_bands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();