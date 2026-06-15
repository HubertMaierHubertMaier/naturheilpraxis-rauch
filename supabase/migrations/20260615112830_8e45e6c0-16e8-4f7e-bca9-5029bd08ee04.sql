
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
    'apothekerRezept', NULLIF(left(COALESCE(_input->>'apothekerRezept', ''), 2500), ''),
    'zusatzTherapie', NULLIF(left(COALESCE(_input->>'zusatzTherapie', ''), 2500), ''),
    'manualDiagnosen', CASE WHEN jsonb_typeof(_input->'manualDiagnosen') = 'array' AND jsonb_array_length(_input->'manualDiagnosen') > 0 THEN _input->'manualDiagnosen' ELSE NULL END,
    'diagnosen', CASE WHEN jsonb_typeof(_input->'diagnosen') = 'array' AND jsonb_array_length(_input->'diagnosen') > 0 THEN _input->'diagnosen' ELSE NULL END
  ));
$function$;

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
    'apothekerRezept', NULLIF(left(COALESCE(_input->>'apothekerRezept', ''), _max_chars), ''),
    'zusatzTherapie', NULLIF(left(COALESCE(_input->>'zusatzTherapie', ''), _max_chars), ''),
    'manualDiagnosen', CASE WHEN jsonb_typeof(_input->'manualDiagnosen') = 'array' THEN _input->'manualDiagnosen' ELSE NULL END,
    'diagnosen', CASE WHEN jsonb_typeof(_input->'diagnosen') = 'array' THEN _input->'diagnosen' ELSE NULL END,
    'autoSavedDraft', CASE WHEN COALESCE((_input->>'autoSavedDraft')::boolean, false) THEN true ELSE NULL END
  ));
$function$;
