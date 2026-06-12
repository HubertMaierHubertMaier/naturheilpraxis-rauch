CREATE INDEX IF NOT EXISTS idx_therapy_sessions_pseudonym_created_at
ON public.therapy_sessions (pseudonym_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_therapy_sessions_safe_list(_pseudonym_id text, _max_rows integer DEFAULT 200)
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
  WITH picked AS MATERIALIZED (
    SELECT
      ts.id,
      row_number() OVER (ORDER BY ts.created_at DESC) AS rn
    FROM public.therapy_sessions ts
    WHERE ts.pseudonym_id = _pseudonym_id
      AND COALESCE(ts.kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch')
    ORDER BY ts.created_at DESC
    LIMIT LEAST(GREATEST(_max_rows, 1), 200)
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
      WHEN COALESCE(ts.kind, '') <> 'event_log' AND p.rn <= 12
        THEN public.compact_therapy_session_input(ts.eingabe_daten, 700)
      ELSE '{}'::jsonb
    END AS eingabe_daten,
    ''::text AS empfehlung,
    COALESCE(length(ts.empfehlung) > 0, false) AS has_empfehlung,
    true AS is_truncated,
    ts.kind = 'befund_auswertung' AS has_befund_html
  FROM picked p
  JOIN public.therapy_sessions ts ON ts.id = p.id
  ORDER BY ts.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_therapy_sessions_safe_list(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_therapy_sessions_safe_list(text, integer) TO service_role;