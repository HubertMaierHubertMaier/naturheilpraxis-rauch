-- Keep only the newest automatic input draft per pseudonym to stop history growth/timeouts.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY pseudonym_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC) AS rn
  FROM public.therapy_sessions
  WHERE pseudonym_id IS NOT NULL
    AND notiz = 'Auto-Sicherung der Eingaben'
    AND empfehlung = 'Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.'
)
DELETE FROM public.therapy_sessions ts
USING ranked r
WHERE ts.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_therapy_sessions_one_auto_draft_per_pid
ON public.therapy_sessions (pseudonym_id)
WHERE notiz = 'Auto-Sicherung der Eingaben'
  AND empfehlung = 'Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.';

CREATE OR REPLACE FUNCTION public.upsert_therapy_autosave_draft(
  _pseudonym_id text,
  _eingabe_daten jsonb,
  _empfehlung text DEFAULT 'Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.',
  _notiz text DEFAULT 'Auto-Sicherung der Eingaben'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  draft_id uuid;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL OR NOT public.has_role(current_user_id, 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NULLIF(trim(_pseudonym_id), '') IS NULL THEN
    RAISE EXCEPTION 'Pseudonym-ID fehlt';
  END IF;

  IF NULLIF(trim(COALESCE(_eingabe_daten->>'_pseudonym_id', _eingabe_daten->>'pseudonymId', '')), '') IS DISTINCT FROM _pseudonym_id THEN
    RAISE EXCEPTION 'Patient safety block: embedded pseudonym does not match row pseudonym';
  END IF;

  SELECT id
    INTO draft_id
  FROM public.therapy_sessions
  WHERE pseudonym_id = _pseudonym_id
    AND notiz = _notiz
    AND empfehlung = _empfehlung
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF draft_id IS NOT NULL THEN
    UPDATE public.therapy_sessions
    SET
      eingabe_daten = _eingabe_daten,
      updated_at = now(),
      created_by = current_user_id,
      kind = COALESCE(kind, 'empfehlung')
    WHERE id = draft_id;

    RETURN draft_id;
  END IF;

  INSERT INTO public.therapy_sessions (
    pseudonym_id,
    created_by,
    eingabe_daten,
    empfehlung,
    notiz,
    kind
  )
  VALUES (
    _pseudonym_id,
    current_user_id,
    _eingabe_daten,
    _empfehlung,
    _notiz,
    'empfehlung'
  )
  RETURNING id INTO draft_id;

  RETURN draft_id;
EXCEPTION WHEN unique_violation THEN
  UPDATE public.therapy_sessions
  SET
    eingabe_daten = _eingabe_daten,
    updated_at = now(),
    created_by = current_user_id,
    kind = COALESCE(kind, 'empfehlung')
  WHERE pseudonym_id = _pseudonym_id
    AND notiz = _notiz
    AND empfehlung = _empfehlung
  RETURNING id INTO draft_id;

  RETURN draft_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_therapy_autosave_draft(text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_therapy_autosave_draft(text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_therapy_autosave_draft(text, jsonb, text, text) TO service_role;