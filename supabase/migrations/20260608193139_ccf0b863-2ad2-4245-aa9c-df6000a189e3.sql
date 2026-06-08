CREATE OR REPLACE FUNCTION public.prevent_therapy_session_patient_mismatch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  embedded_pid text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.pseudonym_id IS DISTINCT FROM NEW.pseudonym_id THEN
    RAISE EXCEPTION 'Patient safety block: therapy_sessions.pseudonym_id cannot be changed from % to %', OLD.pseudonym_id, NEW.pseudonym_id;
  END IF;

  embedded_pid := NULLIF(TRIM(COALESCE(NEW.eingabe_daten->>'_pseudonym_id', NEW.eingabe_daten->>'pseudonymId', '')), '');
  IF embedded_pid IS NOT NULL AND embedded_pid IS DISTINCT FROM NEW.pseudonym_id THEN
    RAISE EXCEPTION 'Patient safety block: embedded pseudonym % does not match row pseudonym %', embedded_pid, NEW.pseudonym_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS therapy_sessions_patient_mismatch_guard ON public.therapy_sessions;
CREATE TRIGGER therapy_sessions_patient_mismatch_guard
BEFORE INSERT OR UPDATE ON public.therapy_sessions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_therapy_session_patient_mismatch();