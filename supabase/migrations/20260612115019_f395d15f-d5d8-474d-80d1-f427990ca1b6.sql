CREATE OR REPLACE FUNCTION public.get_therapy_patient_safe_snapshot(_pseudonym_id text, _max_rows integer DEFAULT 200)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    '_pseudonym_id', _pseudonym_id,
    'pseudonymId', _pseudonym_id,
    'alter', (SELECT left(ts.eingabe_daten->>'alter', 40) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'alter', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'geschlecht', (SELECT left(ts.eingabe_daten->>'geschlecht', 40) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'geschlecht', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'groesseCm', (SELECT left(ts.eingabe_daten->>'groesseCm', 40) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'groesseCm', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'gewichtKg', (SELECT left(ts.eingabe_daten->>'gewichtKg', 40) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'gewichtKg', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'schwanger', (SELECT left(ts.eingabe_daten->>'schwanger', 40) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'schwanger', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'symptome', (SELECT left(ts.eingabe_daten->>'symptome', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'symptome', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'erkrankung', (SELECT left(ts.eingabe_daten->>'erkrankung', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'erkrankung', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'medikamente', (SELECT left(ts.eingabe_daten->>'medikamente', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'medikamente', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'bisherigeMittel', (SELECT left(ts.eingabe_daten->>'bisherigeMittel', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'bisherigeMittel', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'budget', (SELECT left(ts.eingabe_daten->>'budget', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'budget', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'belastungen', (SELECT left(ts.eingabe_daten->>'belastungen', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'belastungen', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'laborKomplett', (SELECT left(ts.eingabe_daten->>'laborKomplett', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'laborKomplett', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'laborErhoeht', (SELECT left(ts.eingabe_daten->>'laborErhoeht', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'laborErhoeht', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'laborErniedrigt', (SELECT left(ts.eingabe_daten->>'laborErniedrigt', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'laborErniedrigt', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'laborDatum', (SELECT left(ts.eingabe_daten->>'laborDatum', 80) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'laborDatum', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'stuhlbefund', (SELECT left(ts.eingabe_daten->>'stuhlbefund', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'stuhlbefund', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'arztbericht', (SELECT left(ts.eingabe_daten->>'arztbericht', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'arztbericht', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'arztberichtDatum', (SELECT left(ts.eingabe_daten->>'arztberichtDatum', 80) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'arztberichtDatum', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'metatronHeel', (SELECT left(ts.eingabe_daten->>'metatronHeel', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'metatronHeel', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'sonstigeUntersuchungen', (SELECT left(ts.eingabe_daten->>'sonstigeUntersuchungen', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'sonstigeUntersuchungen', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'perplexityAnalyse', (SELECT left(ts.eingabe_daten->>'perplexityAnalyse', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'perplexityAnalyse', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'eigeneTherapieVorlage', (SELECT left(ts.eingabe_daten->>'eigeneTherapieVorlage', 2500) FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND NULLIF(trim(COALESCE(ts.eingabe_daten->>'eigeneTherapieVorlage', '')), '') IS NOT NULL ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'manualDiagnosen', (SELECT ts.eingabe_daten->'manualDiagnosen' FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND jsonb_typeof(ts.eingabe_daten->'manualDiagnosen') = 'array' AND jsonb_array_length(ts.eingabe_daten->'manualDiagnosen') > 0 ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'diagnosen', (SELECT ts.eingabe_daten->'diagnosen' FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung') AND jsonb_typeof(ts.eingabe_daten->'diagnosen') = 'array' AND jsonb_array_length(ts.eingabe_daten->'diagnosen') > 0 ORDER BY ts.updated_at DESC NULLS LAST, ts.created_at DESC LIMIT 1),
    'sessionCount', (SELECT count(*) FROM (SELECT 1 FROM public.therapy_sessions ts WHERE ts.pseudonym_id = _pseudonym_id AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch') ORDER BY ts.created_at DESC LIMIT LEAST(GREATEST(_max_rows, 1), 300)) counted),
    'loadedAt', now()
  ));
$function$;

CREATE OR REPLACE FUNCTION public.get_therapy_sessions_safe_list(_pseudonym_id text, _max_rows integer DEFAULT 200)
RETURNS TABLE(id uuid, pseudonym_id text, notiz text, created_at timestamp with time zone, updated_at timestamp with time zone, kind text, befund_meta jsonb, version_number integer, version_label text, parent_session_id uuid, eingabe_daten jsonb, empfehlung text, has_empfehlung boolean, is_truncated boolean, has_befund_html boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS MATERIALIZED (
    SELECT
      ts.id,
      row_number() OVER (ORDER BY ts.created_at DESC) AS rn
    FROM public.therapy_sessions ts
    WHERE ts.pseudonym_id = _pseudonym_id
      AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch')
    ORDER BY ts.created_at DESC
    LIMIT LEAST(GREATEST(_max_rows, 1), 500)
  ),
  meaningful AS MATERIALIZED (
    SELECT ts.id
    FROM public.therapy_sessions ts
    WHERE ts.pseudonym_id = _pseudonym_id
      AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung')
      AND (
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
      )
    ORDER BY ts.created_at DESC
    LIMIT 40
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
      WHEN COALESCE(ts.kind, '') <> 'event_log' AND (b.rn <= 12 OR m.id IS NOT NULL)
        THEN public.compact_therapy_session_input(ts.eingabe_daten, 900)
      ELSE '{}'::jsonb
    END AS eingabe_daten,
    ''::text AS empfehlung,
    COALESCE(length(ts.empfehlung) > 0, false) AS has_empfehlung,
    true AS is_truncated,
    ts.kind = 'befund_auswertung' AS has_befund_html
  FROM base b
  JOIN public.therapy_sessions ts ON ts.id = b.id
  LEFT JOIN meaningful m ON m.id = ts.id
  ORDER BY ts.created_at DESC;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_therapy_patient_safe_snapshot(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_therapy_patient_safe_snapshot(text, integer) TO service_role;