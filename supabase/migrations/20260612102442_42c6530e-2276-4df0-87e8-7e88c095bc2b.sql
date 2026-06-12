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
    'autoSavedDraft', CASE WHEN COALESCE((_input->>'autoSavedDraft')::boolean, false) THEN true ELSE NULL END,
    'pathogens', CASE WHEN pg_column_size(_input->'pathogens') < 50000 THEN _input->'pathogens' ELSE NULL END,
    'selectedCategories', CASE WHEN pg_column_size(_input->'selectedCategories') < 50000 THEN _input->'selectedCategories' ELSE NULL END,
    'bevorzugteLinie', CASE WHEN pg_column_size(_input->'bevorzugteLinie') < 50000 THEN _input->'bevorzugteLinie' ELSE NULL END,
    'pinnedMittel', CASE WHEN pg_column_size(_input->'pinnedMittel') < 50000 THEN _input->'pinnedMittel' ELSE NULL END,
    'mannayanOrders', CASE WHEN pg_column_size(_input->'mannayanOrders') < 50000 THEN _input->'mannayanOrders' ELSE NULL END
  ));
$$;

REVOKE ALL ON FUNCTION public.compact_therapy_session_input(jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compact_therapy_session_input(jsonb, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.get_therapy_sessions_safe_list(_pseudonym_id text, _max_rows integer DEFAULT 500)
RETURNS TABLE (
  id uuid,
  pseudonym_id text,
  notiz text,
  created_at timestamptz,
  updated_at timestamptz,
  kind text,
  befund_meta jsonb,
  version_number integer,
  version_label text,
  parent_session_id uuid,
  eingabe_daten jsonb,
  empfehlung text,
  has_empfehlung boolean,
  is_truncated boolean,
  has_befund_html boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    public.compact_therapy_session_input(ts.eingabe_daten, 900) AS eingabe_daten,
    ''::text AS empfehlung,
    COALESCE(length(ts.empfehlung) > 0, false) AS has_empfehlung,
    true AS is_truncated,
    ts.kind = 'befund_auswertung' AS has_befund_html
  FROM public.therapy_sessions ts
  WHERE ts.pseudonym_id = _pseudonym_id
    AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch')
  ORDER BY ts.created_at DESC
  LIMIT LEAST(GREATEST(_max_rows, 1), 500);
$$;

REVOKE ALL ON FUNCTION public.get_therapy_sessions_safe_list(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_therapy_sessions_safe_list(text, integer) TO service_role;

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
      public.compact_therapy_session_input(ts.eingabe_daten, 12000) AS eingabe_daten,
      CASE WHEN pg_column_size(ts.empfehlung) < 1000000 THEN ts.empfehlung ELSE left(ts.empfehlung, 1000000) || E'\n\n[gekürzt]' END AS empfehlung,
      CASE WHEN _include_befund_html AND pg_column_size(ts.befund_html) < 2000000 THEN ts.befund_html ELSE NULL END AS befund_html,
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