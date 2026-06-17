
-- 1. Tabelle
CREATE TABLE public.patient_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  anamnese_download boolean NOT NULL DEFAULT false,
  infothek_all boolean NOT NULL DEFAULT false,
  infothek_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  library_access boolean NOT NULL DEFAULT false,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_access TO authenticated;
GRANT ALL ON public.patient_access TO service_role;

-- 3. RLS
ALTER TABLE public.patient_access ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "Admins manage all access rows"
  ON public.patient_access
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own access row"
  ON public.patient_access
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(COALESCE((auth.jwt() ->> 'email')::text, '')));

-- 5. Normalisierung & Validierung
CREATE OR REPLACE FUNCTION public.patient_access_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  IF NEW.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Ungültiges E-Mail-Format: %', NEW.email;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patient_access_normalize
  BEFORE INSERT OR UPDATE ON public.patient_access
  FOR EACH ROW
  EXECUTE FUNCTION public.patient_access_normalize();

-- 6. SECURITY DEFINER: liefert die Freigaben des aktuell eingeloggten Users
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
    'note', row_data.note,
    'updated_at', row_data.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_patient_access() TO authenticated;
