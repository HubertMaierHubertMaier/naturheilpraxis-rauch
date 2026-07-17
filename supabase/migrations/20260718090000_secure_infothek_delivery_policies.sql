-- Unlike the legacy 2FA helper, this function does not treat
-- an admin role as a substitute for a completed, session-bound 2FA challenge.
CREATE OR REPLACE FUNCTION public.is_current_session_two_factor_completed(
  _max_age interval DEFAULT interval '24 hours'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_session_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    current_session_id := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  IF current_session_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.two_factor_verified_sessions AS verified
    WHERE verified.session_id = current_session_id
      AND verified.user_id = current_user_id
      AND verified.verified_at > now() - _max_age
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_current_session_two_factor_completed(interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_session_two_factor_completed(interval) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_current_session_two_factor_completed(interval) TO authenticated;

DROP POLICY IF EXISTS "Verified patients can view published resources" ON public.patient_resources;
CREATE POLICY "Verified patients can view published resources"
ON public.patient_resources FOR SELECT
TO authenticated
USING (
  is_published = true
  AND public.is_verified_patient(auth.uid())
  AND (select public.is_current_session_two_factor_completed())
  AND EXISTS (
    SELECT 1
    FROM public.patient_access AS access
    WHERE lower(access.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      AND access.library_access = true
  )
);

DROP POLICY IF EXISTS "Verified patients can read patient-library objects" ON storage.objects;
CREATE POLICY "Verified patients can read patient-library objects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-library'
  AND name NOT LIKE 'infothek/%'
  AND public.is_verified_patient(auth.uid())
  AND (select public.is_current_session_two_factor_completed())
  AND EXISTS (
    SELECT 1
    FROM public.patient_access AS access
    WHERE lower(access.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      AND access.library_access = true
  )
);

-- The existing "Admins manage patient-library objects" and
-- "Admins manage patient_resources" policies remain unchanged.
