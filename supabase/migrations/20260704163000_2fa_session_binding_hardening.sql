CREATE TABLE IF NOT EXISTS public.two_factor_pending_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('login', 'registration')),
  binding_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_two_factor_pending_bindings_user_id
  ON public.two_factor_pending_bindings (user_id);

CREATE INDEX IF NOT EXISTS idx_two_factor_pending_bindings_expires_at
  ON public.two_factor_pending_bindings (expires_at);

ALTER TABLE public.two_factor_pending_bindings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.two_factor_verified_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('login', 'registration')),
  method text NOT NULL DEFAULT 'email_code',
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_two_factor_verified_sessions_user_id
  ON public.two_factor_verified_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_two_factor_verified_sessions_verified_at
  ON public.two_factor_verified_sessions (verified_at);

ALTER TABLE public.two_factor_verified_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_current_session_two_factor_verified(
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

  IF public.has_role(current_user_id, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  current_session_id := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
  IF current_session_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.two_factor_verified_sessions t
    WHERE t.session_id = current_session_id
      AND t.user_id = current_user_id
      AND t.verified_at > now() - _max_age
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_current_session_two_factor_verified(interval) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_two_factor_binding(_binding_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_session_id uuid := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
  pending_row public.two_factor_pending_bindings%ROWTYPE;
BEGIN
  IF current_user_id IS NULL OR current_session_id IS NULL OR _binding_token IS NULL OR trim(_binding_token) = '' THEN
    RETURN false;
  END IF;

  SELECT * INTO pending_row
  FROM public.two_factor_pending_bindings
  WHERE binding_token = trim(_binding_token)
    AND user_id = current_user_id
    AND used = false
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.two_factor_verified_sessions (session_id, user_id, purpose, method, verified_at)
  VALUES (current_session_id, current_user_id, pending_row.purpose, 'email_code', now())
  ON CONFLICT (session_id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      purpose = EXCLUDED.purpose,
      method = EXCLUDED.method,
      verified_at = EXCLUDED.verified_at;

  UPDATE public.two_factor_pending_bindings
  SET used = true
  WHERE id = pending_row.id;

  DELETE FROM public.two_factor_pending_bindings
  WHERE expires_at <= now() OR used = true;

  DELETE FROM public.two_factor_verified_sessions
  WHERE verified_at <= now() - interval '7 days';

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_two_factor_binding(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_current_two_factor_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_session_id uuid := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
BEGIN
  IF current_user_id IS NULL OR current_session_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.two_factor_verified_sessions
  WHERE user_id = current_user_id
    AND session_id = current_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_current_two_factor_session() TO authenticated;

DROP POLICY IF EXISTS "Users can view their own submissions" ON public.anamnesis_submissions;
CREATE POLICY "Users can view their own submissions"
ON public.anamnesis_submissions FOR SELECT
TO authenticated
USING ((select public.is_current_session_two_factor_verified()) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own submissions" ON public.anamnesis_submissions;
CREATE POLICY "Users can insert their own submissions"
ON public.anamnesis_submissions FOR INSERT
TO authenticated
WITH CHECK ((select public.is_current_session_two_factor_verified()) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own submissions" ON public.anamnesis_submissions;
CREATE POLICY "Users can update their own submissions"
ON public.anamnesis_submissions FOR UPDATE
TO authenticated
USING ((select public.is_current_session_two_factor_verified()) AND auth.uid() = user_id)
WITH CHECK ((select public.is_current_session_two_factor_verified()) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own submissions" ON public.anamnesis_submissions;
CREATE POLICY "Users can delete their own submissions"
ON public.anamnesis_submissions FOR DELETE
TO authenticated
USING ((select public.is_current_session_two_factor_verified()) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own IAA" ON public.iaa_submissions;
CREATE POLICY "Users can view their own IAA"
ON public.iaa_submissions FOR SELECT
TO authenticated
USING ((select public.is_current_session_two_factor_verified()) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own IAA" ON public.iaa_submissions;
CREATE POLICY "Users can insert their own IAA"
ON public.iaa_submissions FOR INSERT
TO authenticated
WITH CHECK ((select public.is_current_session_two_factor_verified()) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own IAA" ON public.iaa_submissions;
CREATE POLICY "Users can update their own IAA"
ON public.iaa_submissions FOR UPDATE
TO authenticated
USING ((select public.is_current_session_two_factor_verified()) AND auth.uid() = user_id)
WITH CHECK ((select public.is_current_session_two_factor_verified()) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Verified patients can view published resources" ON public.patient_resources;
CREATE POLICY "Verified patients can view published resources"
ON public.patient_resources FOR SELECT
TO authenticated
USING (
  is_published = true
  AND public.is_verified_patient(auth.uid())
  AND (select public.is_current_session_two_factor_verified())
);

DROP POLICY IF EXISTS "Verified patients can read patient-library objects" ON storage.objects;
CREATE POLICY "Verified patients can read patient-library objects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-library'
  AND public.is_verified_patient(auth.uid())
  AND (select public.is_current_session_two_factor_verified())
);

DROP POLICY IF EXISTS "Users can read own access row" ON public.patient_access;
CREATE POLICY "Users can read own access row"
  ON public.patient_access
  FOR SELECT
  TO authenticated
  USING (
    (select public.is_current_session_two_factor_verified())
    AND lower(email) = lower(COALESCE((auth.jwt() ->> 'email')::text, ''))
  );

CREATE OR REPLACE FUNCTION public.get_my_patient_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  row_data public.patient_access%ROWTYPE;
BEGIN
  user_email := lower(COALESCE((auth.jwt() ->> 'email')::text, ''));
  IF user_email = '' THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'anamnese_download', false,
      'infothek_all', false,
      'infothek_items', '[]'::jsonb,
      'library_access', false
    );
  END IF;

  IF NOT public.is_current_session_two_factor_verified() THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'anamnese_download', false,
      'infothek_all', false,
      'infothek_items', '[]'::jsonb,
      'library_access', false
    );
  END IF;

  SELECT * INTO row_data
  FROM public.patient_access
  WHERE email = user_email
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'anamnese_download', false,
      'infothek_all', false,
      'infothek_items', '[]'::jsonb,
      'library_access', false
    );
  END IF;

  RETURN jsonb_build_object(
    'has_access', true,
    'email', row_data.email,
    'anamnese_download', row_data.anamnese_download,
    'infothek_all', row_data.infothek_all,
    'infothek_items', to_jsonb(row_data.infothek_items),
    'library_access', row_data.library_access,
    'updated_at', row_data.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_patient_access() TO authenticated;
