-- Business conflicts must return HTTP 409, not the retryable transaction SQLSTATE 40001.
-- Change only the previously reviewed function body; preserve all data, signatures and grants.
DO $patient_conflict_code_fix$
DECLARE
  original_sql text;
  expected_body text;
  current_body text;
  definition text;
  target regprocedure := to_regprocedure('public.upsert_therapy_autosave_draft_checked(text,jsonb,uuid)');
BEGIN
  SELECT statements[1] INTO original_sql FROM supabase_migrations.schema_migrations WHERE version='20260913080000';
  IF original_sql IS NULL OR encode(sha256(convert_to(original_sql, 'UTF8')), 'hex') IS DISTINCT FROM 'ff15c6fd497a06ce4f8e705a63091730018d4711217c64c1222c8a018fbac7fa' THEN
    RAISE EXCEPTION 'Reviewed revision-function source is not confirmed in migration history';
  END IF;
  expected_body := split_part(split_part(split_part(original_sql,
    'CREATE OR REPLACE FUNCTION public.upsert_therapy_autosave_draft_checked(', 2), 'AS $$', 2), '$$;', 1);
  SELECT prosrc INTO current_body FROM pg_proc WHERE oid=target;
  IF target IS NULL OR nullif(btrim(expected_body), '') IS NULL
    OR replace(current_body, E'\r\n', E'\n') IS DISTINCT FROM expected_body THEN
    RAISE EXCEPTION 'Revision function changed unexpectedly; no conflict-code replacement performed';
  END IF;
  IF (length(current_body)-length(replace(current_body, 'ERRCODE = ''40001''', ''))) / length('ERRCODE = ''40001''') <> 3 THEN
    RAISE EXCEPTION 'Unexpected number of revision conflict branches';
  END IF;
  definition := pg_get_functiondef(target);
  EXECUTE replace(definition, 'ERRCODE = ''40001''', 'ERRCODE = ''PT409''');
END;
$patient_conflict_code_fix$;
