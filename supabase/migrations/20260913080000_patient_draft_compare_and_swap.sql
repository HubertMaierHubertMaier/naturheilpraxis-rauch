-- Add an opaque revision without deleting, merging or renaming existing patient rows.
ALTER TABLE public.therapy_sessions ADD COLUMN IF NOT EXISTS draft_revision uuid NOT NULL DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION public.rotate_therapy_draft_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.draft_revision := gen_random_uuid();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.rotate_therapy_draft_revision() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rotate_therapy_draft_revision BEFORE UPDATE ON public.therapy_sessions
FOR EACH ROW EXECUTE FUNCTION public.rotate_therapy_draft_revision();

CREATE OR REPLACE FUNCTION public.upsert_therapy_autosave_draft_checked(
  _pseudonym_id text, _eingabe_daten jsonb, _expected_revision uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  pid text := btrim(_pseudonym_id);
  owner_value text;
  payload jsonb := _eingabe_daten;
  saved public.therapy_sessions%ROWTYPE;
BEGIN
  IF actor IS NULL OR NOT public.has_role(actor, 'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF pid ~* '^P-[0-9]{4}-[0-9]{4}$' THEN pid := upper(pid); END IF;
  IF nullif(pid, '') IS NULL OR length(pid) < 6
     OR (pid ~* '^P-' AND pid !~ '^P-[0-9]{4}-[0-9]{4}$') THEN
    RAISE EXCEPTION 'Patient safety block: incomplete pseudonym';
  END IF;
  IF jsonb_typeof(payload) IS DISTINCT FROM 'object'
     OR jsonb_typeof(payload->'_pseudonym_id') IS DISTINCT FROM 'string'
     OR jsonb_typeof(payload->'pseudonymId') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Patient safety block: both input owners are required';
  END IF;
  FOREACH owner_value IN ARRAY ARRAY[payload->>'_pseudonym_id', payload->>'pseudonymId'] LOOP
    owner_value := btrim(owner_value);
    IF owner_value ~* '^P-[0-9]{4}-[0-9]{4}$' THEN owner_value := upper(owner_value); END IF;
    IF owner_value IS DISTINCT FROM pid THEN
      RAISE EXCEPTION 'Patient safety block: embedded pseudonym mismatch';
    END IF;
  END LOOP;
  payload := payload || jsonb_build_object('_pseudonym_id', pid, 'pseudonymId', pid);
  -- An older, differently cased row must be reviewed, never silently forked or renamed.
  IF pid ~ '^P-[0-9]{4}-[0-9]{4}$' AND EXISTS (
    SELECT 1 FROM public.therapy_sessions WHERE upper(btrim(pseudonym_id)) = pid AND pseudonym_id <> pid
  ) THEN
    RAISE EXCEPTION 'Patient safety block: legacy pseudonym spelling requires review';
  END IF;

  SELECT * INTO saved FROM public.therapy_sessions
  WHERE pseudonym_id = pid AND notiz = 'Auto-Sicherung der Eingaben'
    AND empfehlung = 'Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.'
  FOR UPDATE;
  IF FOUND THEN
    IF saved.draft_revision IS DISTINCT FROM _expected_revision THEN
      RAISE EXCEPTION 'PATIENT_DRAFT_CONFLICT: newer saved input exists' USING ERRCODE = '40001';
    END IF;
    UPDATE public.therapy_sessions SET eingabe_daten = payload, updated_at = now(), created_by = actor,
      kind = coalesce(kind, 'empfehlung') WHERE id = saved.id RETURNING * INTO saved;
  ELSE
    IF _expected_revision IS NOT NULL THEN
      RAISE EXCEPTION 'PATIENT_DRAFT_CONFLICT: previously loaded draft is absent' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.therapy_sessions (pseudonym_id, eingabe_daten, created_by, empfehlung, notiz, kind)
    VALUES (pid, payload, actor, 'Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.', 'Auto-Sicherung der Eingaben', 'empfehlung')
    ON CONFLICT DO NOTHING RETURNING * INTO saved;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PATIENT_DRAFT_CONFLICT: another window created the draft' USING ERRCODE = '40001';
    END IF;
  END IF;
  RETURN jsonb_build_object('id', saved.id, 'revision', saved.draft_revision, 'eingabe_daten', saved.eingabe_daten);
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_therapy_autosave_draft_checked(text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_therapy_autosave_draft_checked(text, jsonb, uuid) TO authenticated, service_role;

-- Older browser versions must refresh rather than bypass revision checks.
CREATE OR REPLACE FUNCTION public.upsert_therapy_autosave_draft(
  _pseudonym_id text, _eingabe_daten jsonb,
  _empfehlung text DEFAULT 'Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.',
  _notiz text DEFAULT 'Auto-Sicherung der Eingaben'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'PATIENT_DRAFT_REVISION_REQUIRED: reload the application before saving' USING ERRCODE = '40001';
END;
$$;
