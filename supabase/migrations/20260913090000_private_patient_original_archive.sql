-- A restrictive rule prevents broader legacy storage policies from exposing patient originals.
CREATE POLICY therapy_documents_private_admin_only ON storage.objects AS RESTRICTIVE
FOR ALL TO public
USING (bucket_id <> 'therapy-documents' OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id <> 'therapy-documents' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY therapy_documents_archive_admin_access ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'therapy-documents' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'therapy-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.prepare_therapy_document_archive(
  _pseudonym_id text, _sha256 text, _size_bytes bigint,
  _document_type text, _extension text, _document_date date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pid text := btrim(_pseudonym_id);
  object_path text;
  date_folder text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF pid ~* '^P-[0-9]{4}-[0-9]{4}$' THEN pid := upper(pid); END IF;
  IF nullif(pid, '') IS NULL OR length(pid) < 6 OR length(pid) > 100
    OR pid ~ E'[/\\\\[:cntrl:]]'
    OR (pid ~* '^P-' AND pid !~ '^P-[0-9]{4}-[0-9]{4}$') THEN
    RAISE EXCEPTION 'Invalid patient archive identifier';
  END IF;
  IF _sha256 IS NULL OR _sha256 !~ '^[0-9a-f]{64}$'
    OR _size_bytes IS NULL OR _size_bytes < 1 OR _size_bytes > 52428800 THEN
    RAISE EXCEPTION 'Invalid original file digest or size';
  END IF;
  IF _document_type IS NULL OR _document_type NOT IN ('anamnese','labor','arzt','metatron','vieva','sonstige','dokument')
    OR _extension IS NULL OR _extension NOT IN ('pdf','docx','txt','md','html','htm','csv','json') THEN
    RAISE EXCEPTION 'Unsupported original document type';
  END IF;
  IF _document_date IS NOT NULL AND NOT isfinite(_document_date) THEN
    RAISE EXCEPTION 'Invalid original document date';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'therapy-documents' AND public = false) THEN
    RAISE EXCEPTION 'Patient archive is not confirmed private';
  END IF;
  date_folder := coalesce(to_char(_document_date, 'YYYY-MM-DD'), 'undatiert');
  object_path := pid || '/' || date_folder || '/' || _document_type || '-' || _sha256 || '.' || _extension;
  RETURN jsonb_build_object('bucket', 'therapy-documents', 'path', object_path,
    'pseudonym_id', pid, 'sha256', _sha256, 'bytes', _size_bytes,
    'exists', EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'therapy-documents' AND name = object_path));
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_therapy_document_archive(text, text, bigint, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_therapy_document_archive(text, text, bigint, text, text, date) TO authenticated;
