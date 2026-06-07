
-- Lock new helper functions
REVOKE EXECUTE ON FUNCTION public.lms_is_school_learner_of(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.lms_is_independent_owner(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.lms_can_access_learner(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.lms_is_school_learner_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lms_is_independent_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lms_can_access_learner(uuid) TO authenticated;

-- Storage policies for lms-assets
CREATE POLICY "lms_assets read authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lms-assets');
CREATE POLICY "lms_assets super admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lms-assets' AND public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "lms_assets super admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lms-assets' AND public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (bucket_id = 'lms-assets' AND public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "lms_assets super admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lms-assets' AND public.has_role(auth.uid(), 'super_admin'::app_role));
