GRANT EXECUTE ON FUNCTION public.compact_therapy_session_input(jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_therapy_sessions_safe_list(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_therapy_session_safe_detail(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_therapy_patient_safe_snapshot(text, integer) TO service_role;