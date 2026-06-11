REVOKE ALL ON public.therapy_sessions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapy_sessions TO authenticated;
GRANT ALL ON public.therapy_sessions TO service_role;