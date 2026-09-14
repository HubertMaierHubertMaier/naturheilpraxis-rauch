-- Recovery snapshots retain the complete clinical input. Existing rows are not rewritten.
CREATE OR REPLACE FUNCTION public.extract_patient_snapshot_fields(_input jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object(
      '_pseudonym_id', NULLIF(COALESCE(_input->>'_pseudonym_id', _input->>'pseudonymId', ''), ''),
      'pseudonymId', NULLIF(COALESCE(_input->>'pseudonymId', _input->>'_pseudonym_id', ''), '')
    ))
  FROM jsonb_each(CASE WHEN jsonb_typeof(_input) = 'object' THEN _input ELSE '{}'::jsonb END) AS entry
  WHERE entry.key = ANY(ARRAY[
    'alter','geschlecht','groesseCm','gewichtKg','schwanger',
    'symptome','erkrankung','medikamente','bisherigeMittel','budget','belastungen',
    'naturheilMittelHomoeopathie','naturheilMittelPflanzenheilkunde',
    'naturheilMittelVitamine','naturheilMittelMineralstoffe','naturheilMittelSpurenelemente',
    'anamnese','anamneseDatum','laborKomplett','laborErhoeht','laborErniedrigt','laborDatum',
    'stuhlbefund','arztbericht','arztberichtDatum','metatronHeel','metatronDatum',
    'sonstigeUntersuchungen','vievaPlus','vievaPlusDatum','perplexityAnalyse',
    'eigeneTherapieVorlage','apothekerRezept','zusatzTherapie',
    'manualDiagnosen','diagnosen','pathogens','pathogenBulkText',
    'manualMittel','mannayanOrders','selectedCategories','bevorzugteLinie','pinnedMittel',
    'startPlanExceptionReason','startPlanPhaseAllocation','noStartRemedyApproved','noStartRemedyReason',
    'useMapReduce','useProModel',
    'anamneseZusatz','anamnesisIntakeV1','originalArchiveReceiptsV1',
    'analysisProfile','safetyReview','autoSavedDraft'
  ]) AND entry.value <> 'null'::jsonb AND entry.value <> '""'::jsonb;
$function$;

-- History lists may still use short excerpts. Detail calls (12000) and recovery
-- snapshots must never use a truncated anamnesis as the full saved input.
CREATE OR REPLACE FUNCTION public.compact_therapy_session_input(_input jsonb, _max_chars integer DEFAULT 1200)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  WITH source AS (
    SELECT public.extract_patient_snapshot_fields(_input) AS data
  ), entries AS (
    SELECT entry.key, entry.value,
      CASE WHEN COALESCE(_max_chars, 1200) < 12000 AND jsonb_typeof(entry.value) = 'string'
        AND length(entry.value #>> '{}') > GREATEST(COALESCE(_max_chars, 1200), 1)
        AND entry.key NOT IN ('_pseudonym_id', 'pseudonymId')
      THEN true ELSE false END AS shortened
    FROM source, LATERAL jsonb_each(source.data) AS entry
  )
  SELECT COALESCE(jsonb_object_agg(key, CASE WHEN shortened
      THEN to_jsonb(left(value #>> '{}', GREATEST(COALESCE(_max_chars, 1200), 1)))
      ELSE value END), '{}'::jsonb)
    || CASE WHEN bool_or(shortened) THEN jsonb_build_object(
      '_inputTruncatedFields', jsonb_agg(key ORDER BY key) FILTER (WHERE shortened),
      '_inputCompleteness', 'history_excerpt_not_for_recovery'
    ) ELSE '{}'::jsonb END
  FROM entries;
$function$;