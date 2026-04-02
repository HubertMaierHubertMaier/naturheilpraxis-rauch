
-- 1. verification_codes: Revoke all public access, only service_role should manage these
-- Drop any existing policies first
DROP POLICY IF EXISTS "Users can read their own verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Users can insert verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Users can delete verification codes" ON public.verification_codes;

-- No policies = RLS blocks all access from anon/authenticated, only service_role bypasses RLS

-- 2. profiles: Fix INSERT policy to authenticated only
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. audit_log: Move inserts to a SECURITY DEFINER function, remove direct INSERT
DROP POLICY IF EXISTS "Authenticated users can insert their own audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Users can insert their own audit log" ON public.audit_log;

-- Create a security definer function for audit log inserts
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  _action text,
  _details jsonb DEFAULT NULL,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.audit_log (user_id, action, details, ip_address, user_agent)
  VALUES (auth.uid(), _action, _details, _ip_address, _user_agent);
$$;

-- Allow authenticated users to read their own audit entries
CREATE POLICY "Users can read their own audit log"
ON public.audit_log FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 4. admin_knowledge_base: Replace hardcoded UUID with role-based check
DROP POLICY IF EXISTS "Only owner can access knowledge base" ON public.admin_knowledge_base;
CREATE POLICY "Only admins can access knowledge base"
ON public.admin_knowledge_base FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
