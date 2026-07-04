CREATE OR REPLACE FUNCTION public.enforce_is_verified_patient_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_verified_patient IS DISTINCT FROM OLD.is_verified_patient THEN
    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only admins may change is_verified_patient'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_is_verified_patient ON public.profiles;

CREATE TRIGGER trg_profiles_protect_is_verified_patient
BEFORE UPDATE OF is_verified_patient ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_is_verified_patient_admin_only();