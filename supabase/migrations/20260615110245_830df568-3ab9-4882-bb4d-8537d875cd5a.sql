
DROP TRIGGER IF EXISTS trg_therapy_sessions_update_snapshot ON public.therapy_sessions;
CREATE TRIGGER trg_therapy_sessions_update_snapshot
AFTER INSERT OR UPDATE ON public.therapy_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_patient_snapshot_from_session();

DROP TRIGGER IF EXISTS trg_therapy_sessions_assign_version ON public.therapy_sessions;
CREATE TRIGGER trg_therapy_sessions_assign_version
BEFORE INSERT ON public.therapy_sessions
FOR EACH ROW EXECUTE FUNCTION public.assign_therapy_session_version();

DROP TRIGGER IF EXISTS trg_therapy_sessions_prevent_patient_mismatch ON public.therapy_sessions;
CREATE TRIGGER trg_therapy_sessions_prevent_patient_mismatch
BEFORE INSERT OR UPDATE ON public.therapy_sessions
FOR EACH ROW EXECUTE FUNCTION public.prevent_therapy_session_patient_mismatch();

-- Einmalig: Snapshots aus dem letzten nicht-speziellen Therapy-Session-Eintrag pro Pseudonym nachziehen,
-- damit bereits eingegebene Daten (Alter, Geschlecht, Metatron etc.) sofort wieder erscheinen.
WITH latest AS (
  SELECT DISTINCT ON (pseudonym_id)
    pseudonym_id, id, created_at, eingabe_daten
  FROM public.therapy_sessions
  WHERE pseudonym_id IS NOT NULL
    AND COALESCE(kind, '') NOT IN ('befund_checkpoint', 'quarantine_patient_mismatch', 'event_log', 'befund_auswertung')
    AND eingabe_daten IS NOT NULL
    AND pg_column_size(eingabe_daten) <= 250000
  ORDER BY pseudonym_id, created_at DESC
)
INSERT INTO public.patient_snapshot (pseudonym_id, data, source_session_id, source_created_at, updated_at)
SELECT
  l.pseudonym_id,
  public.extract_patient_snapshot_fields(l.eingabe_daten)
    || jsonb_build_object('_pseudonym_id', l.pseudonym_id, 'pseudonymId', l.pseudonym_id),
  l.id,
  l.created_at,
  now()
FROM latest l
WHERE public.extract_patient_snapshot_fields(l.eingabe_daten) <> '{}'::jsonb
ON CONFLICT (pseudonym_id) DO UPDATE SET
  data = public.patient_snapshot.data || EXCLUDED.data,
  source_session_id = EXCLUDED.source_session_id,
  source_created_at = EXCLUDED.source_created_at,
  updated_at = now();
