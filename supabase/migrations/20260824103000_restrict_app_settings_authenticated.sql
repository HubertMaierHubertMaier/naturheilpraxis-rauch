-- Authenticated patients may read public flags only through get_public_app_setting().
DROP POLICY IF EXISTS "Authenticated can read app settings" ON public.app_settings;

-- Keep table access available for the existing admin-only RLS policy.
REVOKE SELECT ON public.app_settings FROM anon;
GRANT SELECT ON public.app_settings TO authenticated, service_role;
