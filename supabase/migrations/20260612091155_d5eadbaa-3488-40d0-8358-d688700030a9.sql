CREATE OR REPLACE FUNCTION public.assign_therapy_session_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  is_draft BOOLEAN;
  is_special BOOLEAN;
  next_v INTEGER;
BEGIN
  IF NEW.version_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  is_draft := COALESCE((NEW.eingabe_daten->>'autoSavedDraft')::boolean, false);
  is_special := COALESCE(NEW.kind, '') IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log');

  IF is_draft OR is_special THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_v
    FROM public.therapy_sessions
   WHERE pseudonym_id = NEW.pseudonym_id;

  NEW.version_number := next_v;
  RETURN NEW;
END;
$function$;