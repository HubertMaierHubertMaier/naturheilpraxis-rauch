ALTER FUNCTION public.upsert_therapy_autosave_draft(text, jsonb, text, text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.upsert_therapy_autosave_draft(text, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_therapy_autosave_draft(text, jsonb, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_therapy_autosave_draft(text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_therapy_autosave_draft(text, jsonb, text, text) TO service_role;