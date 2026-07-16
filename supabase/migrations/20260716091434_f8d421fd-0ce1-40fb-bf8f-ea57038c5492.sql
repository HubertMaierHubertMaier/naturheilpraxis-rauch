CREATE OR REPLACE FUNCTION public.get_therapy_sessions_safe_list(_pseudonym_id text, _max_rows integer DEFAULT 200)
 RETURNS TABLE(id uuid, pseudonym_id text, notiz text, created_at timestamp with time zone, updated_at timestamp with time zone, kind text, befund_meta jsonb, version_number integer, version_label text, parent_session_id uuid, eingabe_daten jsonb, empfehlung text, has_empfehlung boolean, is_truncated boolean, has_befund_html boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    ts.id,
    ts.pseudonym_id,
    ts.notiz,
    ts.created_at,
    ts.updated_at,
    ts.kind,
    CASE
      WHEN ts.kind = 'befund_auswertung' THEN
        (COALESCE(ts.befund_meta, '{}'::jsonb) - 'lab_values_v1' - 'lab_alerts_v1')
        || jsonb_build_object(
          'sources_fallback',
          COALESCE(ts.eingabe_daten->'sources', ts.eingabe_daten->'sourceSummary', '[]'::jsonb),
          'lab_value_count',
          CASE WHEN jsonb_typeof(ts.befund_meta->'lab_values_v1') = 'array'
            THEN jsonb_array_length(ts.befund_meta->'lab_values_v1')
            ELSE COALESCE((ts.befund_meta->>'lab_value_count')::integer, 0)
          END,
          'lab_alert_count',
          CASE WHEN jsonb_typeof(ts.befund_meta->'lab_alerts_v1') = 'array'
            THEN jsonb_array_length(ts.befund_meta->'lab_alerts_v1')
            ELSE COALESCE((ts.befund_meta->>'lab_alert_count')::integer, 0)
          END
        )
      ELSE ts.befund_meta
    END AS befund_meta,
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