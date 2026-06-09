CREATE POLICY "Admins can manage therapy document files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'therapy-documents'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'therapy-documents'
  AND public.has_role(auth.uid(), 'admin')
);