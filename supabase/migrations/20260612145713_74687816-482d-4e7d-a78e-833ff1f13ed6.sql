-- Index for fast pseudonym lookups ordered by date
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_pseudonym_created
  ON public.therapy_sessions (pseudonym_id, created_at DESC);

-- Rewrite snapshot: single pass over rows using FILTER aggregates
CREATE OR REPLACE FUNCTION public.get_therapy_patient_safe_snapshot(_pseudonym_id text, _max_rows integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH rows AS MATERIALIZED (
    SELECT ts.eingabe_daten, ts.created_at
    FROM public.therapy_sessions ts
    WHERE ts.pseudonym_id = _pseudonym_id
      AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung')
    ORDER BY ts.created_at DESC
    LIMIT LEAST(GREATEST(_max_rows, 1), 300)
  ),
  agg AS (
    SELECT
      (array_agg(left(eingabe_daten->>'alter',40) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'alter','')),'') IS NOT NULL))[1] AS alter_v,
      (array_agg(left(eingabe_daten->>'geschlecht',40) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'geschlecht','')),'') IS NOT NULL))[1] AS geschlecht_v,
      (array_agg(left(eingabe_daten->>'groesseCm',40) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'groesseCm','')),'') IS NOT NULL))[1] AS groesse_v,
      (array_agg(left(eingabe_daten->>'gewichtKg',40) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'gewichtKg','')),'') IS NOT NULL))[1] AS gewicht_v,
      (array_agg(left(eingabe_daten->>'schwanger',40) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'schwanger','')),'') IS NOT NULL))[1] AS schwanger_v,
      (array_agg(left(eingabe_daten->>'symptome',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'symptome','')),'') IS NOT NULL))[1] AS symptome_v,
      (array_agg(left(eingabe_daten->>'erkrankung',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'erkrankung','')),'') IS NOT NULL))[1] AS erkrankung_v,
      (array_agg(left(eingabe_daten->>'medikamente',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'medikamente','')),'') IS NOT NULL))[1] AS medikamente_v,
      (array_agg(left(eingabe_daten->>'bisherigeMittel',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'bisherigeMittel','')),'') IS NOT NULL))[1] AS bisherige_v,
      (array_agg(left(eingabe_daten->>'budget',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'budget','')),'') IS NOT NULL))[1] AS budget_v,
      (array_agg(left(eingabe_daten->>'belastungen',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'belastungen','')),'') IS NOT NULL))[1] AS belastungen_v,
      (array_agg(left(eingabe_daten->>'laborKomplett',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'laborKomplett','')),'') IS NOT NULL))[1] AS labork_v,
      (array_agg(left(eingabe_daten->>'laborErhoeht',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'laborErhoeht','')),'') IS NOT NULL))[1] AS laborh_v,
      (array_agg(left(eingabe_daten->>'laborErniedrigt',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'laborErniedrigt','')),'') IS NOT NULL))[1] AS labore_v,
      (array_agg(left(eingabe_daten->>'laborDatum',80) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'laborDatum','')),'') IS NOT NULL))[1] AS labordatum_v,
      (array_agg(left(eingabe_daten->>'stuhlbefund',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'stuhlbefund','')),'') IS NOT NULL))[1] AS stuhl_v,
      (array_agg(left(eingabe_daten->>'arztbericht',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'arztbericht','')),'') IS NOT NULL))[1] AS arzt_v,
      (array_agg(left(eingabe_daten->>'arztberichtDatum',80) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'arztberichtDatum','')),'') IS NOT NULL))[1] AS arztd_v,
      (array_agg(left(eingabe_daten->>'metatronHeel',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'metatronHeel','')),'') IS NOT NULL))[1] AS meta_v,
      (array_agg(left(eingabe_daten->>'sonstigeUntersuchungen',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'sonstigeUntersuchungen','')),'') IS NOT NULL))[1] AS sonst_v,
      (array_agg(left(eingabe_daten->>'perplexityAnalyse',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'perplexityAnalyse','')),'') IS NOT NULL))[1] AS perp_v,
      (array_agg(left(eingabe_daten->>'eigeneTherapieVorlage',2500) ORDER BY created_at DESC) FILTER (WHERE NULLIF(trim(COALESCE(eingabe_daten->>'eigeneTherapieVorlage','')),'') IS NOT NULL))[1] AS eigvorl_v,
      (array_agg(eingabe_daten->'manualDiagnosen' ORDER BY created_at DESC) FILTER (WHERE jsonb_typeof(eingabe_daten->'manualDiagnosen')='array' AND jsonb_array_length(eingabe_daten->'manualDiagnosen')>0))[1] AS manuald_v,
      (array_agg(eingabe_daten->'diagnosen' ORDER BY created_at DESC) FILTER (WHERE jsonb_typeof(eingabe_daten->'diagnosen')='array' AND jsonb_array_length(eingabe_daten->'diagnosen')>0))[1] AS diag_v,
      count(*) AS cnt
    FROM rows
  )
  SELECT jsonb_strip_nulls(jsonb_build_object(
    '_pseudonym_id', _pseudonym_id,
    'pseudonymId', _pseudonym_id,
    'alter', alter_v,
    'geschlecht', geschlecht_v,
    'groesseCm', groesse_v,
    'gewichtKg', gewicht_v,
    'schwanger', schwanger_v,
    'symptome', symptome_v,
    'erkrankung', erkrankung_v,
    'medikamente', medikamente_v,
    'bisherigeMittel', bisherige_v,
    'budget', budget_v,
    'belastungen', belastungen_v,
    'laborKomplett', labork_v,
    'laborErhoeht', laborh_v,
    'laborErniedrigt', labore_v,
    'laborDatum', labordatum_v,
    'stuhlbefund', stuhl_v,
    'arztbericht', arzt_v,
    'arztberichtDatum', arztd_v,
    'metatronHeel', meta_v,
    'sonstigeUntersuchungen', sonst_v,
    'perplexityAnalyse', perp_v,
    'eigeneTherapieVorlage', eigvorl_v,
    'manualDiagnosen', manuald_v,
    'diagnosen', diag_v,
    'sessionCount', cnt,
    'loadedAt', now()
  ))
  FROM agg;
$function$;