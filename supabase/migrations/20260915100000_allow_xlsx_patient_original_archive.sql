-- Extend only the supported original-file suffixes; preserve the existing function's
-- authentication, privacy, path, digest and size checks as well as its grants.
DO $migration$
DECLARE
  definition text;
  old_clause text := $old$_extension NOT IN ('pdf','docx','txt','md','html','htm','csv','json')$old$;
  new_clause text := $new$_extension NOT IN ('pdf','docx','xlsx','txt','md','html','htm','csv','json')$new$;
BEGIN
  SELECT pg_get_functiondef(to_regprocedure('public.prepare_therapy_document_archive(text,text,bigint,text,text,date)')) INTO definition;
  IF definition IS NULL THEN
    RAISE EXCEPTION 'Existing private original-archive function is required';
  END IF;
  IF strpos(definition, new_clause) > 0 THEN RETURN; END IF;
  IF (length(definition) - length(replace(definition, old_clause, ''))) <> length(old_clause) THEN
    RAISE EXCEPTION 'Original archive allowlist differs from expected source; review before changing';
  END IF;
  EXECUTE replace(definition, old_clause, new_clause);
END;
$migration$;
