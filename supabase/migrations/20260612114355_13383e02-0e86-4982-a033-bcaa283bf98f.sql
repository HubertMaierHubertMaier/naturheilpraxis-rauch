CREATE OR REPLACE FUNCTION public.compact_therapy_session_input(_input jsonb, _max_chars integer DEFAULT 1200)
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
    'symptome', NULLIF(left(COALESCE(_input->>'symptome', ''), _max_chars), ''),
    'erkrankung', NULLIF(left(COALESCE(_input->>'erkrankung', ''), _max_chars), ''),
    'medikamente', NULLIF(left(COALESCE(_input->>'medikamente', ''), _max_chars), ''),
    'bisherigeMittel', NULLIF(left(COALESCE(_input->>'bisherigeMittel', ''), _max_chars), ''),
    'budget', NULLIF(left(COALESCE(_input->>'budget', ''), _max_chars), ''),
    'belastungen', NULLIF(left(COALESCE(_input->>'belastungen', ''), _max_chars), ''),
    'laborKomplett', NULLIF(left(COALESCE(_input->>'laborKomplett', ''), _max_chars), ''),
    'laborErhoeht', NULLIF(left(COALESCE(_input->>'laborErhoeht', ''), _max_chars), ''),
    'laborErniedrigt', NULLIF(left(COALESCE(_input->>'laborErniedrigt', ''), _max_chars), ''),
    'laborDatum', NULLIF(left(COALESCE(_input->>'laborDatum', ''), 80), ''),
    'stuhlbefund', NULLIF(left(COALESCE(_input->>'stuhlbefund', ''), _max_chars), ''),
    'arztbericht', NULLIF(left(COALESCE(_input->>'arztbericht', ''), _max_chars), ''),
    'arztberichtDatum', NULLIF(left(COALESCE(_input->>'arztberichtDatum', ''), 80), ''),
    'metatronHeel', NULLIF(left(COALESCE(_input->>'metatronHeel', ''), _max_chars), ''),
    'sonstigeUntersuchungen', NULLIF(left(COALESCE(_input->>'sonstigeUntersuchungen', ''), _max_chars), ''),
    'perplexityAnalyse', NULLIF(left(COALESCE(_input->>'perplexityAnalyse', ''), _max_chars), ''),
    'eigeneTherapieVorlage', NULLIF(left(COALESCE(_input->>'eigeneTherapieVorlage', ''), _max_chars), ''),
    'manualDiagnosen', CASE WHEN jsonb_typeof(_input->'manualDiagnosen') = 'array' THEN _input->'manualDiagnosen' ELSE NULL END,
    'diagnosen', CASE WHEN jsonb_typeof(_input->'diagnosen') = 'array' THEN _input->'diagnosen' ELSE NULL END,
    'autoSavedDraft', CASE WHEN COALESCE((_input->>'autoSavedDraft')::boolean, false) THEN true ELSE NULL END
  ));
$function$;

CREATE OR REPLACE FUNCTION public.get_therapy_patient_safe_snapshot(_pseudonym_id text, _max_rows integer DEFAULT 200)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH rows AS MATERIALIZED (
    SELECT
      ts.id,
      ts.updated_at,
      ts.created_at,
      public.compact_therapy_session_input(ts.eingabe_daten, 2500) AS e
    FROM public.therapy_sessions ts
    WHERE ts.pseudonym_id = _pseudonym_id
      AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung')
    ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC
    LIMIT LEAST(GREATEST(_max_rows, 1), 300)
  )
  SELECT jsonb_strip_nulls(jsonb_build_object(
    '_pseudonym_id', _pseudonym_id,
    'pseudonymId', _pseudonym_id,
    'alter', (SELECT e->>'alter' FROM rows WHERE NULLIF(trim(COALESCE(e->>'alter', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'geschlecht', (SELECT e->>'geschlecht' FROM rows WHERE NULLIF(trim(COALESCE(e->>'geschlecht', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'groesseCm', (SELECT e->>'groesseCm' FROM rows WHERE NULLIF(trim(COALESCE(e->>'groesseCm', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'gewichtKg', (SELECT e->>'gewichtKg' FROM rows WHERE NULLIF(trim(COALESCE(e->>'gewichtKg', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'schwanger', (SELECT e->>'schwanger' FROM rows WHERE NULLIF(trim(COALESCE(e->>'schwanger', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'symptome', (SELECT e->>'symptome' FROM rows WHERE NULLIF(trim(COALESCE(e->>'symptome', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'erkrankung', (SELECT e->>'erkrankung' FROM rows WHERE NULLIF(trim(COALESCE(e->>'erkrankung', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'medikamente', (SELECT e->>'medikamente' FROM rows WHERE NULLIF(trim(COALESCE(e->>'medikamente', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'bisherigeMittel', (SELECT e->>'bisherigeMittel' FROM rows WHERE NULLIF(trim(COALESCE(e->>'bisherigeMittel', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'budget', (SELECT e->>'budget' FROM rows WHERE NULLIF(trim(COALESCE(e->>'budget', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'belastungen', (SELECT e->>'belastungen' FROM rows WHERE NULLIF(trim(COALESCE(e->>'belastungen', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'laborKomplett', (SELECT e->>'laborKomplett' FROM rows WHERE NULLIF(trim(COALESCE(e->>'laborKomplett', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'laborErhoeht', (SELECT e->>'laborErhoeht' FROM rows WHERE NULLIF(trim(COALESCE(e->>'laborErhoeht', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'laborErniedrigt', (SELECT e->>'laborErniedrigt' FROM rows WHERE NULLIF(trim(COALESCE(e->>'laborErniedrigt', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'laborDatum', (SELECT e->>'laborDatum' FROM rows WHERE NULLIF(trim(COALESCE(e->>'laborDatum', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'stuhlbefund', (SELECT e->>'stuhlbefund' FROM rows WHERE NULLIF(trim(COALESCE(e->>'stuhlbefund', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'arztbericht', (SELECT e->>'arztbericht' FROM rows WHERE NULLIF(trim(COALESCE(e->>'arztbericht', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'arztberichtDatum', (SELECT e->>'arztberichtDatum' FROM rows WHERE NULLIF(trim(COALESCE(e->>'arztberichtDatum', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'metatronHeel', (SELECT e->>'metatronHeel' FROM rows WHERE NULLIF(trim(COALESCE(e->>'metatronHeel', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'sonstigeUntersuchungen', (SELECT e->>'sonstigeUntersuchungen' FROM rows WHERE NULLIF(trim(COALESCE(e->>'sonstigeUntersuchungen', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'perplexityAnalyse', (SELECT e->>'perplexityAnalyse' FROM rows WHERE NULLIF(trim(COALESCE(e->>'perplexityAnalyse', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'eigeneTherapieVorlage', (SELECT e->>'eigeneTherapieVorlage' FROM rows WHERE NULLIF(trim(COALESCE(e->>'eigeneTherapieVorlage', '')), '') IS NOT NULL ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'manualDiagnosen', (SELECT e->'manualDiagnosen' FROM rows WHERE jsonb_typeof(e->'manualDiagnosen') = 'array' AND jsonb_array_length(e->'manualDiagnosen') > 0 ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'diagnosen', (SELECT e->'diagnosen' FROM rows WHERE jsonb_typeof(e->'diagnosen') = 'array' AND jsonb_array_length(e->'diagnosen') > 0 ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    'sessionCount', (SELECT count(*) FROM rows),
    'loadedAt', now()
  ));
$function$;

CREATE OR REPLACE FUNCTION public.get_therapy_sessions_safe_list(_pseudonym_id text, _max_rows integer DEFAULT 200)
RETURNS TABLE(id uuid, pseudonym_id text, notiz text, created_at timestamp with time zone, updated_at timestamp with time zone, kind text, befund_meta jsonb, version_number integer, version_label text, parent_session_id uuid, eingabe_daten jsonb, empfehlung text, has_empfehlung boolean, is_truncated boolean, has_befund_html boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH picked AS MATERIALIZED (
    SELECT
      ts.id,
      row_number() OVER (ORDER BY ts.created_at DESC) AS rn,
      count(*) FILTER (WHERE (
        NULLIF(trim(COALESCE(ts.eingabe_daten->>'alter', '')), '') IS NOT NULL OR
        NULLIF(trim(COALESCE(ts.eingabe_daten->>'geschlecht', '')), '') IS NOT NULL OR
        NULLIF(trim(COALESCE(ts.eingabe_daten->>'symptome', '')), '') IS NOT NULL OR
        NULLIF(trim(COALESCE(ts.eingabe_daten->>'medikamente', '')), '') IS NOT NULL OR
        NULLIF(trim(COALESCE(ts.eingabe_daten->>'erkrankung', '')), '') IS NOT NULL OR
        NULLIF(trim(COALESCE(ts.eingabe_daten->>'laborKomplett', '')), '') IS NOT NULL OR
        NULLIF(trim(COALESCE(ts.eingabe_daten->>'laborErhoeht', '')), '') IS NOT NULL OR
        NULLIF(trim(COALESCE(ts.eingabe_daten->>'laborErniedrigt', '')), '') IS NOT NULL OR
        NULLIF(trim(COALESCE(ts.eingabe_daten->>'stuhlbefund', '')), '') IS NOT NULL OR
        NULLIF(trim(COALESCE(ts.eingabe_daten->>'arztbericht', '')), '') IS NOT NULL OR
        NULLIF(trim(COALESCE(ts.eingabe_daten->>'sonstigeUntersuchungen', '')), '') IS NOT NULL OR
        (CASE WHEN jsonb_typeof(ts.eingabe_daten->'manualDiagnosen') = 'array' THEN jsonb_array_length(ts.eingabe_daten->'manualDiagnosen') ELSE 0 END) > 0 OR
        (CASE WHEN jsonb_typeof(ts.eingabe_daten->'diagnosen') = 'array' THEN jsonb_array_length(ts.eingabe_daten->'diagnosen') ELSE 0 END) > 0
      )) OVER (ORDER BY ts.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS meaningful_rn
    FROM public.therapy_sessions ts
    WHERE ts.pseudonym_id = _pseudonym_id
      AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch')
    ORDER BY ts.created_at DESC
    LIMIT LEAST(GREATEST(_max_rows, 1), 500)
  )
  SELECT
    ts.id,
    ts.pseudonym_id,
    ts.notiz,
    ts.created_at,
    ts.updated_at,
    ts.kind,
    ts.befund_meta,
    ts.version_number,
    ts.version_label,
    ts.parent_session_id,
    CASE
      WHEN COALESCE(ts.kind, '') <> 'event_log' AND (p.rn <= 12 OR p.meaningful_rn <= 30)
        THEN public.compact_therapy_session_input(ts.eingabe_daten, 900)
      ELSE '{}'::jsonb
    END AS eingabe_daten,
    ''::text AS empfehlung,
    COALESCE(length(ts.empfehlung) > 0, false) AS has_empfehlung,
    true AS is_truncated,
    ts.kind = 'befund_auswertung' AS has_befund_html
  FROM picked p
  JOIN public.therapy_sessions ts ON ts.id = p.id
  ORDER BY ts.created_at DESC;
$function$;