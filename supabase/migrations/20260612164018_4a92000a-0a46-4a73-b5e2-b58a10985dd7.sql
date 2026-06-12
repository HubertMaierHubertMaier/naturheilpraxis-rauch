REVOKE EXECUTE ON FUNCTION public.extract_patient_snapshot_fields(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_patient_snapshot_from_session() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_therapy_patient_safe_snapshot(text, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.extract_patient_snapshot_fields(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_patient_snapshot_from_session() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_therapy_patient_safe_snapshot(text, integer) TO service_role;