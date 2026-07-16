CREATE TABLE IF NOT EXISTS public.therapy_deleted_document_markers (
  pseudonym_id text NOT NULL,
  marker_name text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid,
  PRIMARY KEY (pseudonym_id, marker_name)
);

ALTER TABLE public.therapy_deleted_document_markers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.therapy_deleted_document_markers FROM PUBLIC, anon, authenticated;

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
  old_text text;
  stripped_text text;
  draft_record record;
  snapshot_changed boolean := false;
  draft_changed boolean;
  has_document_match boolean;
  snap_updated int := 0;
  drafts_updated int := 0;
  removed_fields int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _pseudonym_id IS NULL OR btrim(_pseudonym_id) = '' THEN
    RAISE EXCEPTION 'pseudonym_id fehlt';
  END IF;
  IF COALESCE(btrim(_filename), '') = '' AND COALESCE(btrim(_archive_path), '') = '' THEN
    RAISE EXCEPTION 'Dokumentkennung fehlt';
  END IF;

  SELECT data INTO snap_data
  FROM public.patient_snapshot
  WHERE pseudonym_id = _pseudonym_id
  FOR UPDATE;

  IF snap_data IS NOT NULL THEN
    new_data := snap_data;
    FOREACH k IN ARRAY field_keys LOOP
      IF new_data ? k AND jsonb_typeof(new_data->k) = 'string' THEN
        old_text := new_data->>k;
        has_document_match :=
          (COALESCE(btrim(_filename), '') <> '' AND (
            position('=== 📄 ' || btrim(_filename) || ' ===' IN old_text) > 0 OR
            position('=== 📷 ' || btrim(_filename) || ' ===' IN old_text) > 0
          )) OR
          (COALESCE(btrim(_archive_path), '') <> '' AND position(btrim(_archive_path) IN old_text) > 0);
        IF has_document_match THEN
          stripped_text := public._strip_doc_block(old_text, _filename, _archive_path);
          new_data := jsonb_set(new_data, ARRAY[k], to_jsonb(stripped_text));
          snapshot_changed := true;
          removed_fields := removed_fields + 1;
        END IF;
      END IF;
    END LOOP;
    IF snapshot_changed THEN
      UPDATE public.patient_snapshot
      SET data = new_data, updated_at = now()
      WHERE pseudonym_id = _pseudonym_id;
      snap_updated := 1;
    END IF;
  END IF;

  FOR draft_record IN
    SELECT id, eingabe_daten
    FROM public.therapy_sessions
    WHERE pseudonym_id = _pseudonym_id
      AND COALESCE((eingabe_daten->>'autoSavedDraft')::boolean, false) = true
    FOR UPDATE
  LOOP
    new_data := draft_record.eingabe_daten;
    draft_changed := false;
    FOREACH k IN ARRAY field_keys LOOP
      IF new_data ? k AND jsonb_typeof(new_data->k) = 'string' THEN
        old_text := new_data->>k;
        has_document_match :=
          (COALESCE(btrim(_filename), '') <> '' AND (
            position('=== 📄 ' || btrim(_filename) || ' ===' IN old_text) > 0 OR
            position('=== 📷 ' || btrim(_filename) || ' ===' IN old_text) > 0
          )) OR
          (COALESCE(btrim(_archive_path), '') <> '' AND position(btrim(_archive_path) IN old_text) > 0);
        IF has_document_match THEN
          stripped_text := public._strip_doc_block(old_text, _filename, _archive_path);
          new_data := jsonb_set(new_data, ARRAY[k], to_jsonb(stripped_text));
          draft_changed := true;
          removed_fields := removed_fields + 1;
        END IF;
      END IF;
    END LOOP;
    IF draft_changed THEN
      UPDATE public.therapy_sessions
      SET eingabe_daten = new_data, updated_at = now()
      WHERE id = draft_record.id;
      drafts_updated := drafts_updated + 1;
    END IF;
  END LOOP;

  IF removed_fields > 0 AND COALESCE(btrim(_filename), '') <> '' THEN
    INSERT INTO public.therapy_deleted_document_markers (pseudonym_id, marker_name, deleted_at, deleted_by)
    VALUES (_pseudonym_id, btrim(_filename), now(), auth.uid())
    ON CONFLICT (pseudonym_id, marker_name) DO UPDATE
      SET deleted_at = EXCLUDED.deleted_at, deleted_by = EXCLUDED.deleted_by;
  END IF;

  RETURN jsonb_build_object(
    'snapshot_updated', snap_updated,
    'drafts_updated', drafts_updated,
    'removed_fields', removed_fields
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_strip_document_from_patient_context(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_strip_document_from_patient_context(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.strip_recently_deleted_document_markers(_pseudonym_id text, _data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
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
  marker_record record;
  result_data jsonb := COALESCE(_data, '{}'::jsonb);
  field_text text;
BEGIN
  IF COALESCE(btrim(_pseudonym_id), '') = '' THEN
    RETURN result_data;
  END IF;
  FOR marker_record IN
    SELECT marker_name
    FROM public.therapy_deleted_document_markers
    WHERE pseudonym_id = _pseudonym_id
      AND deleted_at > now() - interval '24 hours'
  LOOP
    FOREACH k IN ARRAY field_keys LOOP
      IF result_data ? k AND jsonb_typeof(result_data->k) = 'string' THEN
        field_text := result_data->>k;
        IF position('=== 📄 ' || marker_record.marker_name || ' ===' IN field_text) > 0
          OR position('=== 📷 ' || marker_record.marker_name || ' ===' IN field_text) > 0 THEN
          field_text := public._strip_doc_block(field_text, marker_record.marker_name, '');
          result_data := jsonb_set(result_data, ARRAY[k], to_jsonb(field_text));
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN result_data;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.strip_recently_deleted_document_markers(text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_deleted_document_replay_in_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.data := public.strip_recently_deleted_document_markers(NEW.pseudonym_id, NEW.data);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_deleted_document_replay_in_snapshot() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_deleted_document_replay_in_snapshot ON public.patient_snapshot;
CREATE TRIGGER prevent_deleted_document_replay_in_snapshot
BEFORE INSERT OR UPDATE OF data ON public.patient_snapshot
FOR EACH ROW EXECUTE FUNCTION public.prevent_deleted_document_replay_in_snapshot();

CREATE OR REPLACE FUNCTION public.prevent_deleted_document_replay_in_therapy_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.eingabe_daten := public.strip_recently_deleted_document_markers(NEW.pseudonym_id, NEW.eingabe_daten);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_deleted_document_replay_in_therapy_session() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_deleted_document_replay_in_therapy_session ON public.therapy_sessions;
CREATE TRIGGER prevent_deleted_document_replay_in_therapy_session
BEFORE INSERT OR UPDATE OF eingabe_daten ON public.therapy_sessions
FOR EACH ROW EXECUTE FUNCTION public.prevent_deleted_document_replay_in_therapy_session();