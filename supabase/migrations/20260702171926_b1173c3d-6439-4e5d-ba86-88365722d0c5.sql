
CREATE OR REPLACE FUNCTION public._strip_doc_block(_text text, _filename text, _archive_path text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  tagged text;
  parts text[];
  keep text[] := ARRAY[]::text[];
  chunk text;
  marker_name text;
  target_norm text;
  path_needle text;
BEGIN
  IF _text IS NULL OR btrim(_text) = '' THEN
    RETURN _text;
  END IF;
  target_norm := lower(btrim(COALESCE(_filename, '')));
  path_needle := btrim(COALESCE(_archive_path, ''));

  tagged := regexp_replace(_text, E'(===\\s*(?:📄|📷)\\s*[^=\\n]+?===)', E'\x01\\1', 'g');
  parts := string_to_array(tagged, E'\x01');

  FOREACH chunk IN ARRAY parts LOOP
    IF btrim(chunk) = '' THEN
      CONTINUE;
    END IF;
    marker_name := (regexp_match(chunk, E'^===\\s*(?:📄|📷)\\s*([^=\\n]+?)\\s*==='))[1];
    IF marker_name IS NOT NULL AND target_norm <> '' AND lower(btrim(marker_name)) = target_norm THEN
      CONTINUE;
    END IF;
    IF path_needle <> '' AND position(path_needle IN chunk) > 0 THEN
      CONTINUE;
    END IF;
    keep := keep || btrim(chunk);
  END LOOP;

  RETURN btrim(array_to_string(keep, E'\n\n'));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_strip_document_from_patient_context(
  _pseudonym_id text,
  _filename text,
  _archive_path text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  field_keys text[] := ARRAY[
    'sonstigeUntersuchungen','arztbericht','metatronHeel',
    'laborKomplett','laborErhoeht','laborErniedrigt',
    'stuhlbefund','perplexityAnalyse'
  ];
  k text;
  snap_data jsonb;
  new_data jsonb;
  snap_updated int := 0;
  drafts_updated int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _pseudonym_id IS NULL OR btrim(_pseudonym_id) = '' THEN
    RAISE EXCEPTION 'pseudonym_id fehlt';
  END IF;

  SELECT data INTO snap_data FROM public.patient_snapshot WHERE pseudonym_id = _pseudonym_id;
  IF snap_data IS NOT NULL THEN
    new_data := snap_data;
    FOREACH k IN ARRAY field_keys LOOP
      IF new_data ? k AND jsonb_typeof(new_data->k) = 'string' THEN
        new_data := jsonb_set(
          new_data,
          ARRAY[k],
          to_jsonb(public._strip_doc_block(new_data->>k, _filename, _archive_path))
        );
      END IF;
    END LOOP;
    UPDATE public.patient_snapshot
      SET data = new_data, updated_at = now()
      WHERE pseudonym_id = _pseudonym_id;
    snap_updated := 1;
  END IF;

  UPDATE public.therapy_sessions ts
    SET eingabe_daten = (
      SELECT jsonb_object_agg(
        key,
        CASE
          WHEN key = ANY(field_keys) AND jsonb_typeof(value) = 'string'
            THEN to_jsonb(public._strip_doc_block(value #>> '{}', _filename, _archive_path))
          ELSE value
        END
      )
      FROM jsonb_each(ts.eingabe_daten)
    ),
    updated_at = now()
    WHERE ts.pseudonym_id = _pseudonym_id
      AND COALESCE((ts.eingabe_daten->>'autoSavedDraft')::boolean, false) = true;
  GET DIAGNOSTICS drafts_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'snapshot_updated', snap_updated,
    'drafts_updated', drafts_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_strip_document_from_patient_context(text,text,text) TO authenticated;
