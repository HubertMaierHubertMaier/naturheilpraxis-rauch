CREATE TABLE IF NOT EXISTS public.patient_snapshot (
  pseudonym_id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_session_id uuid,
  source_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_snapshot TO authenticated;
GRANT ALL ON public.patient_snapshot TO service_role;

ALTER TABLE public.patient_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage patient snapshots" ON public.patient_snapshot;
CREATE POLICY "Admins can manage patient snapshots"
ON public.patient_snapshot
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_patient_snapshot_updated_at
  ON public.patient_snapshot (updated_at DESC);

CREATE OR REPLACE FUNCTION public.extract_patient_snapshot_fields(_input jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    '_pseudonym_id', NULLIF(left(COALESCE(_input->>'_pseudonym_id', _input->>'pseudonymId', ''), 80), ''),
    'pseudonymId', NULLIF(left(COALESCE(_input->>'pseudonymId', _input->>'_pseudonym_id', ''), 80), ''),
    'alter', NULLIF(left(COALESCE(_input->>'alter', ''), 40), ''),
    'geschlecht', NULLIF(left(COALESCE(_input->>'geschlecht', ''), 40), ''),
    'groesseCm', NULLIF(left(COALESCE(_input->>'groesseCm', ''), 40), ''),
    'gewichtKg', NULLIF(left(COALESCE(_input->>'gewichtKg', ''), 40), ''),
    'schwanger', NULLIF(left(COALESCE(_input->>'schwanger', ''), 40), ''),
    'symptome', NULLIF(left(COALESCE(_input->>'symptome', ''), 2500), ''),
    'erkrankung', NULLIF(left(COALESCE(_input->>'erkrankung', ''), 2500), ''),
    'medikamente', NULLIF(left(COALESCE(_input->>'medikamente', ''), 2500), ''),
    'bisherigeMittel', NULLIF(left(COALESCE(_input->>'bisherigeMittel', ''), 2500), ''),
    'budget', NULLIF(left(COALESCE(_input->>'budget', ''), 2500), ''),
    'belastungen', NULLIF(left(COALESCE(_input->>'belastungen', ''), 2500), ''),
    'laborKomplett', NULLIF(left(COALESCE(_input->>'laborKomplett', ''), 2500), ''),
    'laborErhoeht', NULLIF(left(COALESCE(_input->>'laborErhoeht', ''), 2500), ''),
    'laborErniedrigt', NULLIF(left(COALESCE(_input->>'laborErniedrigt', ''), 2500), ''),
    'laborDatum', NULLIF(left(COALESCE(_input->>'laborDatum', ''), 80), ''),
    'stuhlbefund', NULLIF(left(COALESCE(_input->>'stuhlbefund', ''), 2500), ''),
    'arztbericht', NULLIF(left(COALESCE(_input->>'arztbericht', ''), 2500), ''),
    'arztberichtDatum', NULLIF(left(COALESCE(_input->>'arztberichtDatum', ''), 80), ''),
    'metatronHeel', NULLIF(left(COALESCE(_input->>'metatronHeel', ''), 2500), ''),
    'sonstigeUntersuchungen', NULLIF(left(COALESCE(_input->>'sonstigeUntersuchungen', ''), 2500), ''),
    'perplexityAnalyse', NULLIF(left(COALESCE(_input->>'perplexityAnalyse', ''), 2500), ''),
    'eigeneTherapieVorlage', NULLIF(left(COALESCE(_input->>'eigeneTherapieVorlage', ''), 2500), ''),
    'manualDiagnosen', CASE WHEN jsonb_typeof(_input->'manualDiagnosen') = 'array' AND jsonb_array_length(_input->'manualDiagnosen') > 0 THEN _input->'manualDiagnosen' ELSE NULL END,
    'diagnosen', CASE WHEN jsonb_typeof(_input->'diagnosen') = 'array' AND jsonb_array_length(_input->'diagnosen') > 0 THEN _input->'diagnosen' ELSE NULL END
  ));
$function$;

CREATE OR REPLACE FUNCTION public.update_patient_snapshot_from_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  snapshot_data jsonb;
BEGIN
  IF NEW.pseudonym_id IS NULL OR trim(NEW.pseudonym_id) = '' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.kind, '') IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') THEN
    RETURN NEW;
  END IF;

  IF NEW.eingabe_daten IS NULL OR pg_column_size(NEW.eingabe_daten) > 250000 THEN
    RETURN NEW;
  END IF;

  snapshot_data := public.extract_patient_snapshot_fields(NEW.eingabe_daten);

  IF snapshot_data = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.patient_snapshot (pseudonym_id, data, source_session_id, source_created_at, updated_at)
  VALUES (
    NEW.pseudonym_id,
    snapshot_data || jsonb_build_object('_pseudonym_id', NEW.pseudonym_id, 'pseudonymId', NEW.pseudonym_id),
    NEW.id,
    NEW.created_at,
    now()
  )
  ON CONFLICT (pseudonym_id) DO UPDATE SET
    data = public.patient_snapshot.data || EXCLUDED.data,
    source_session_id = EXCLUDED.source_session_id,
    source_created_at = EXCLUDED.source_created_at,
    updated_at = now();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS therapy_sessions_update_patient_snapshot ON public.therapy_sessions;
CREATE TRIGGER therapy_sessions_update_patient_snapshot
AFTER INSERT OR UPDATE OF eingabe_daten, pseudonym_id, kind
ON public.therapy_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_patient_snapshot_from_session();

CREATE OR REPLACE FUNCTION public.get_therapy_patient_safe_snapshot(_pseudonym_id text, _max_rows integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT jsonb_strip_nulls(
        ps.data || jsonb_build_object(
          '_pseudonym_id', ps.pseudonym_id,
          'pseudonymId', ps.pseudonym_id,
          'loadedAt', now(),
          'snapshotUpdatedAt', ps.updated_at
        )
      )
      FROM public.patient_snapshot ps
      WHERE ps.pseudonym_id = _pseudonym_id
      LIMIT 1
    ),
    jsonb_build_object('_pseudonym_id', _pseudonym_id, 'pseudonymId', _pseudonym_id, 'loadedAt', now())
  );
$function$;