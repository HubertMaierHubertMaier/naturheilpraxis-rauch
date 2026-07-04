
DO $$
DECLARE
  _uid uuid := '8281090c-14e6-4327-a382-612ab5665ece';
  _email text := 'aktiv@webdesign-pur.de';
BEGIN
  DELETE FROM public.verification_codes WHERE user_id = _uid;
  DELETE FROM public.patient_access WHERE email = _email;
  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM public.anamnesis_submissions WHERE user_id = _uid;
  DELETE FROM public.iaa_submissions WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE user_id = _uid;
  DELETE FROM auth.users WHERE id = _uid;
END $$;
