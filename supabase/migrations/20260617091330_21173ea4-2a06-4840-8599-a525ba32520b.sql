
REVOKE EXECUTE ON FUNCTION public.get_my_patient_access() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_patient_access() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_patient_access() TO authenticated;
