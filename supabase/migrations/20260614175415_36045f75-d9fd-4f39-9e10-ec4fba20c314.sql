
CREATE POLICY "billing proofs: school upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'billing-proofs'
  AND (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
);

CREATE POLICY "billing proofs: school read own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'billing-proofs'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
  )
);
