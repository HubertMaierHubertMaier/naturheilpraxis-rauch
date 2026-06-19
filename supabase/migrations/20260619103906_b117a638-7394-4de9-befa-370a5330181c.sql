-- 1. Restrict SECURITY DEFINER helper functions to authenticated callers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_verified_patient(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_audit_log(text, jsonb, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_mannayan_order_number() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_mannayan_order_number_for_pseudonym(text) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_verified_patient(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_audit_log(text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_mannayan_order_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_mannayan_order_number_for_pseudonym(text) TO authenticated;

-- 2. Safe RPC for visitors to read whitelisted public flags only
CREATE OR REPLACE FUNCTION public.get_public_app_setting(_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT value
  FROM public.app_settings
  WHERE key = _key
    AND _key IN (
      'anamnese_enabled',
      'anamnese_online_enabled',
      'anamnese_public',
      'patient_login_enabled'
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_app_setting(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_app_setting(text) TO anon, authenticated;

-- 3. Replace permissive anon SELECT policy on app_settings
DROP POLICY IF EXISTS "Public can read app settings (limited columns)" ON public.app_settings;

CREATE POLICY "Authenticated can read app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.app_settings FROM anon;