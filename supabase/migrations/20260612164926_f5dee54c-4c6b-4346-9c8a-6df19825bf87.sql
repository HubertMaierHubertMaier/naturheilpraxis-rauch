CREATE OR REPLACE FUNCTION public.get_therapy_sessions_safe_list(_pseudonym_id text, _max_rows integer DEFAULT 200)
RETURNS TABLE(
  id uuid,
  pseudonym_id text,
  notiz text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
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
SET search_path TO 'public'
AS $function$
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
    '{}'::jsonb AS eingabe_daten,
    ''::text AS empfehlung,
    ts.empfehlung IS NOT NULL AS has_empfehlung,
    true AS is_truncated,
    ts.kind = 'befund_auswertung' AS has_befund_html
  FROM public.therapy_sessions ts
  WHERE ts.pseudonym_id = _pseudonym_id
    AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch')
  ORDER BY ts.created_at DESC
  LIMIT LEAST(GREATEST(_max_rows, 1), 500);
$function$;

CREATE OR REPLACE FUNCTION public.get_therapy_session_safe_detail(_session_id uuid, _include_befund_html boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      CASE
        WHEN pg_column_size(ts.eingabe_daten) <= 250000
          THEN public.compact_therapy_session_input(ts.eingabe_daten, 1500)
        ELSE jsonb_build_object('_pseudonym_id', ts.pseudonym_id, 'pseudonymId', ts.pseudonym_id, 'payloadTooLarge', true)
      END AS eingabe_daten,
      left(COALESCE(ts.empfehlung, ''), 250000) AS empfehlung,
      CASE WHEN _include_befund_html THEN left(COALESCE(ts.befund_html, ''), 1000000) ELSE NULL END AS befund_html,
      false AS is_truncated,
      ts.kind = 'befund_auswertung' AS has_befund_html,
      ts.empfehlung IS NOT NULL AS has_empfehlung
    FROM public.therapy_sessions ts
    WHERE ts.id = _session_id
    LIMIT 1
  ) row_data;
$function$;

REVOKE ALL ON FUNCTION public.get_therapy_sessions_safe_list(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_therapy_session_safe_detail(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_therapy_sessions_safe_list(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_therapy_session_safe_detail(uuid, boolean) TO service_role;