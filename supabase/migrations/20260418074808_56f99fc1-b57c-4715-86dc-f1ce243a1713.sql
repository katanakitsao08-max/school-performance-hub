
-- Share links for tokenized public report viewing
CREATE TABLE public.report_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  term INTEGER NOT NULL,
  year INTEGER NOT NULL,
  assessment_type TEXT NOT NULL DEFAULT 'end_term',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ
);

CREATE INDEX idx_report_share_links_token ON public.report_share_links(token);
CREATE INDEX idx_report_share_links_school ON public.report_share_links(school_id);

ALTER TABLE public.report_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage school share links"
  ON public.report_share_links FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "HT view school share links"
  ON public.report_share_links FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "SA full share links"
  ON public.report_share_links FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Delivery log
CREATE TABLE public.report_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  share_link_id UUID REFERENCES public.report_share_links(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','sms')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','delivered')),
  provider_message_id TEXT,
  error_message TEXT,
  sent_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_log_school ON public.report_delivery_log(school_id);
CREATE INDEX idx_delivery_log_learner ON public.report_delivery_log(learner_id);

ALTER TABLE public.report_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view school delivery log"
  ON public.report_delivery_log FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "HT view school delivery log"
  ON public.report_delivery_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "SA full delivery log"
  ON public.report_delivery_log FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
