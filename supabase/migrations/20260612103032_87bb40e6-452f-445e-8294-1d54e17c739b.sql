CREATE OR REPLACE FUNCTION public.compact_therapy_session_input(_input jsonb, _max_chars integer DEFAULT 1200)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
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
    'autoSavedDraft', CASE WHEN COALESCE((_input->>'autoSavedDraft')::boolean, false) THEN true ELSE NULL END
  ));
$$;

REVOKE ALL ON FUNCTION public.compact_therapy_session_input(jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compact_therapy_session_input(jsonb, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.get_therapy_session_safe_detail(_session_id uuid, _include_befund_html boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(row_data)
  FROM (
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
      public.compact_therapy_session_input(ts.eingabe_daten, 1500) AS eingabe_daten,
      left(COALESCE(ts.empfehlung, ''), 250000) AS empfehlung,
      CASE WHEN _include_befund_html THEN left(COALESCE(ts.befund_html, ''), 1000000) ELSE NULL END AS befund_html,
      false AS is_truncated,
      ts.kind = 'befund_auswertung' AS has_befund_html,
      COALESCE(length(ts.empfehlung) > 0, false) AS has_empfehlung
    FROM public.therapy_sessions ts
    WHERE ts.id = _session_id
    LIMIT 1
  ) row_data;
$$;

REVOKE ALL ON FUNCTION public.get_therapy_session_safe_detail(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_therapy_session_safe_detail(uuid, boolean) TO service_role;