
-- Restrict column-level SELECT on app_settings: hide updated_by from anon/authenticated
REVOKE SELECT ON public.app_settings FROM anon, authenticated;
GRANT SELECT (key, value, updated_at) ON public.app_settings TO anon, authenticated;
GRANT SELECT ON public.app_settings TO service_role;

-- Replace permissive policy: still allows row visibility, but column grants restrict columns
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;

CREATE POLICY "Public can read app settings (limited columns)"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can read full app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
