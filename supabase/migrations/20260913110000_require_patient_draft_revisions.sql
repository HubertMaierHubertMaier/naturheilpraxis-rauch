-- Cutover phase: apply after the revision-aware UI has been verified and is available to users.
-- Old tabs must refresh rather than silently bypassing the new comparison-and-swap contract.
CREATE OR REPLACE FUNCTION public.upsert_therapy_autosave_draft(
  _pseudonym_id text, _eingabe_daten jsonb,
  _empfehlung text DEFAULT 'Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.',
  _notiz text DEFAULT 'Auto-Sicherung der Eingaben'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'PATIENT_DRAFT_REVISION_REQUIRED: reload the application before saving' USING ERRCODE = '40001';
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_therapy_autosave_draft(text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_therapy_autosave_draft(text, jsonb, text, text) TO authenticated, service_role;
