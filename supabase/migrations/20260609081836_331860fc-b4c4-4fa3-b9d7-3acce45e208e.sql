
-- 1. Spalten ergänzen
ALTER TABLE public.therapy_sessions
  ADD COLUMN IF NOT EXISTS version_number INTEGER,
  ADD COLUMN IF NOT EXISTS version_label TEXT,
  ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES public.therapy_sessions(id) ON DELETE SET NULL;

-- 2. Backfill: bestehende finalisierte / sichtbare Sessions chronologisch nummerieren
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY pseudonym_id ORDER BY created_at ASC) AS rn
  FROM public.therapy_sessions
  WHERE COALESCE(kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch')
    AND COALESCE((eingabe_daten->>'autoSavedDraft')::boolean, false) = false
)
UPDATE public.therapy_sessions t
SET version_number = ranked.rn
FROM ranked
WHERE t.id = ranked.id
  AND t.version_number IS NULL;

-- 3. Trigger: bei neuen finalisierten Inserts automatisch nächste Versionsnummer pro Pseudonym
CREATE OR REPLACE FUNCTION public.assign_therapy_session_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_draft BOOLEAN;
  is_special BOOLEAN;
  next_v INTEGER;
BEGIN
  IF NEW.version_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  is_draft := COALESCE((NEW.eingabe_daten->>'autoSavedDraft')::boolean, false);
  is_special := COALESCE(NEW.kind, '') IN ('befund_checkpoint', 'quarantine_patient_mismatch');

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
$$;

DROP TRIGGER IF EXISTS therapy_sessions_assign_version ON public.therapy_sessions;
CREATE TRIGGER therapy_sessions_assign_version
BEFORE INSERT ON public.therapy_sessions
FOR EACH ROW EXECUTE FUNCTION public.assign_therapy_session_version();
