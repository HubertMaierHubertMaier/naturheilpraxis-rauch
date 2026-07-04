CREATE OR REPLACE FUNCTION public.list_admin_accounts()
RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, admin_since timestamptz, profile_created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ur.user_id,
    p.email,
    p.first_name,
    p.last_name,
    ur.created_at AS admin_since,
    p.created_at AS profile_created_at
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'admin'
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY ur.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_admin_accounts() TO authenticated;