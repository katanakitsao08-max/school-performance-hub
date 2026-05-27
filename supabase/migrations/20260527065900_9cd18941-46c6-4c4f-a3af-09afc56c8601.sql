
-- documents table
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  title text NOT NULL,
  recipient_type text NOT NULL DEFAULT 'other',
  recipient_name text,
  tone text NOT NULL DEFAULT 'formal',
  language text NOT NULL DEFAULT 'en',
  prompt text,
  content text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage school documents" ON public.documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "HT view school documents" ON public.documents
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'headteacher'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "SA full documents" ON public.documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- document_templates table
CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL DEFAULT '',
  is_global boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read school or global templates" ON public.document_templates
  FOR SELECT TO authenticated
  USING (is_global = true OR school_id = get_user_school_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manage school templates" ON public.document_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()) AND is_global = false)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND school_id = get_user_school_id(auth.uid()) AND is_global = false);

CREATE POLICY "SA full templates" ON public.document_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for branding (signatures, stamps)
INSERT INTO storage.buckets (id, name, public) VALUES ('school-branding', 'school-branding', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin upload own school branding" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'school-branding'
    AND has_role(auth.uid(), 'admin'::app_role)
    AND (storage.foldername(name))[1] = get_user_school_id(auth.uid())::text
  );

CREATE POLICY "Admin update own school branding" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'school-branding'
    AND has_role(auth.uid(), 'admin'::app_role)
    AND (storage.foldername(name))[1] = get_user_school_id(auth.uid())::text
  );

CREATE POLICY "Admin delete own school branding" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'school-branding'
    AND has_role(auth.uid(), 'admin'::app_role)
    AND (storage.foldername(name))[1] = get_user_school_id(auth.uid())::text
  );

CREATE POLICY "School users read own branding" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'school-branding'
    AND ((storage.foldername(name))[1] = get_user_school_id(auth.uid())::text
         OR has_role(auth.uid(), 'super_admin'::app_role))
  );
