CREATE TABLE IF NOT EXISTS public.parent_portal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  term integer NOT NULL,
  year integer NOT NULL,
  assessment_type text NOT NULL DEFAULT 'end_term',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppl_token ON public.parent_portal_links(token);
CREATE INDEX IF NOT EXISTS idx_ppl_school ON public.parent_portal_links(school_id);
CREATE INDEX IF NOT EXISTS idx_ppl_learner ON public.parent_portal_links(learner_id);

ALTER TABLE public.parent_portal_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SA full ppl" ON public.parent_portal_links
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin school ppl" ON public.parent_portal_links
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "HT view school ppl" ON public.parent_portal_links
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));