-- Preserve confirmed anamnesis text without deleting or rewriting existing history.
CREATE TABLE IF NOT EXISTS public.therapy_anamnesis_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym_id text NOT NULL,
  source_session_id uuid,
  anamnese text NOT NULL CHECK (length(btrim(anamnese)) > 0),
  anamnese_datum text,
  content_sha256 text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT therapy_anamnesis_versions_content_unique UNIQUE (pseudonym_id, content_sha256)
);
ALTER TABLE public.therapy_anamnesis_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.therapy_anamnesis_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.therapy_anamnesis_versions TO authenticated;
GRANT ALL ON public.therapy_anamnesis_versions TO service_role;
CREATE POLICY therapy_anamnesis_versions_admin_read ON public.therapy_anamnesis_versions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_anamnesis_version(
  _pid text, _session uuid, _input jsonb, _author uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  value_text text := _input->>'anamnese';
  value_date text := _input->>'anamneseDatum';
BEGIN
  IF jsonb_typeof(_input->'anamnese') IS DISTINCT FROM 'string' OR nullif(btrim(value_text), '') IS NULL THEN RETURN; END IF;
  IF nullif(btrim(_pid), '') IS NULL
     OR (_input ? '_pseudonym_id' AND _input->>'_pseudonym_id' IS DISTINCT FROM _pid)
     OR (_input ? 'pseudonymId' AND _input->>'pseudonymId' IS DISTINCT FROM _pid) THEN
    RAISE EXCEPTION 'Patient safety block: version ownership mismatch';
  END IF;
  INSERT INTO public.therapy_anamnesis_versions
    (pseudonym_id, source_session_id, anamnese, anamnese_datum, content_sha256, created_by)
  VALUES
    (_pid, _session, value_text, value_date,
     encode(sha256(convert_to(jsonb_build_array(value_text, value_date)::text, 'UTF8')), 'hex'), _author)
  ON CONFLICT (pseudonym_id, content_sha256) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.record_anamnesis_version(text, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preserve_autosave_anamnesis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  incoming_owner text;
BEGIN
  IF NEW.notiz IS DISTINCT FROM 'Auto-Sicherung der Eingaben'
     OR NEW.empfehlung IS DISTINCT FROM 'Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.' THEN
    RETURN NEW;
  END IF;
  IF jsonb_typeof(NEW.eingabe_daten) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Patient safety block: input must be an object';
  END IF;
  IF NEW.eingabe_daten ? 'anamnese' AND jsonb_typeof(NEW.eingabe_daten->'anamnese') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'Patient safety block: anamnesis must be text';
  END IF;
  IF nullif(btrim(NEW.pseudonym_id), '') IS NULL THEN
    RAISE EXCEPTION 'Patient safety block: pseudonym missing';
  END IF;
  FOREACH incoming_owner IN ARRAY ARRAY[NEW.eingabe_daten->>'_pseudonym_id', NEW.eingabe_daten->>'pseudonymId'] LOOP
    IF incoming_owner IS NOT NULL AND incoming_owner IS DISTINCT FROM NEW.pseudonym_id THEN
      RAISE EXCEPTION 'Patient safety block: embedded pseudonym does not match row';
    END IF;
  END LOOP;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.pseudonym_id IS DISTINCT FROM NEW.pseudonym_id THEN
      RAISE EXCEPTION 'Patient safety block: cannot move an input draft to another pseudonym';
    END IF;
    PERFORM public.record_anamnesis_version(OLD.pseudonym_id, OLD.id, OLD.eingabe_daten, OLD.created_by);
    IF jsonb_typeof(OLD.eingabe_daten->'anamnese') = 'string' AND nullif(btrim(OLD.eingabe_daten->>'anamnese'), '') IS NOT NULL
       AND nullif(btrim(NEW.eingabe_daten->>'anamnese'), '') IS NULL THEN
      NEW.eingabe_daten := NEW.eingabe_daten || jsonb_build_object('anamnese', OLD.eingabe_daten->>'anamnese');
      IF OLD.eingabe_daten ? 'anamneseDatum' THEN
        NEW.eingabe_daten := NEW.eingabe_daten || jsonb_build_object('anamneseDatum', OLD.eingabe_daten->'anamneseDatum');
      ELSE
        NEW.eingabe_daten := NEW.eingabe_daten - 'anamneseDatum';
      END IF;
    END IF;
  END IF;
  PERFORM public.record_anamnesis_version(NEW.pseudonym_id, NEW.id, NEW.eingabe_daten, NEW.created_by);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.preserve_autosave_anamnesis() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER zz_preserve_autosave_anamnesis
BEFORE INSERT OR UPDATE ON public.therapy_sessions
FOR EACH ROW EXECUTE FUNCTION public.preserve_autosave_anamnesis();

-- Preserve ambiguous historical rows unchanged and make the hold discoverable to admins.
CREATE VIEW public.therapy_anamnesis_review_holds WITH (security_invoker = true) AS
SELECT id AS source_session_id, pseudonym_id,
  eingabe_daten->>'_pseudonym_id' AS embedded_owner,
  eingabe_daten->>'pseudonymId' AS alternate_owner,
  'Historical input ownership conflict; original row retained unchanged'::text AS review_reason
FROM public.therapy_sessions
WHERE notiz = 'Auto-Sicherung der Eingaben'
  AND empfehlung = 'Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.'
  AND nullif(btrim(eingabe_daten->>'anamnese'), '') IS NOT NULL
  AND ((eingabe_daten ? '_pseudonym_id' AND eingabe_daten->>'_pseudonym_id' IS DISTINCT FROM pseudonym_id)
    OR (eingabe_daten ? 'pseudonymId' AND eingabe_daten->>'pseudonymId' IS DISTINCT FROM pseudonym_id))
  AND (public.has_role(auth.uid(), 'admin') OR current_user = 'service_role');
REVOKE ALL ON public.therapy_anamnesis_review_holds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.therapy_anamnesis_review_holds TO authenticated, service_role;

-- Copy only unambiguous non-empty drafts. Never reinterpret a historical owner or reconstruct from analysis.
SELECT public.record_anamnesis_version(pseudonym_id, id, eingabe_daten, created_by)
FROM public.therapy_sessions
WHERE notiz = 'Auto-Sicherung der Eingaben'
  AND empfehlung = 'Automatische Eingabe-Sicherung – noch keine finale KI-Empfehlung.'
  AND nullif(btrim(eingabe_daten->>'anamnese'), '') IS NOT NULL
  AND nullif(btrim(pseudonym_id), '') IS NOT NULL
  AND NOT ((eingabe_daten ? '_pseudonym_id' AND eingabe_daten->>'_pseudonym_id' IS DISTINCT FROM pseudonym_id)
    OR (eingabe_daten ? 'pseudonymId' AND eingabe_daten->>'pseudonymId' IS DISTINCT FROM pseudonym_id));
