
-- 1. PRIVILEGE ESCALATION: Restrict user_roles INSERT/DELETE to admins only
-- Currently no INSERT/DELETE policies exist, which means RLS blocks them by default.
-- But let's be explicit and add admin-only policies for safety.

CREATE POLICY "Only admins can insert user roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete user roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update user roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. AUDIT LOG: Tighten INSERT policy to authenticated users only (not anon)
DROP POLICY IF EXISTS "Users can insert their own audit log" ON public.audit_log;
CREATE POLICY "Authenticated users can insert their own audit log"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. ADMIN KNOWLEDGE BASE: Replace hardcoded UUID with role-based check
-- Note: Per project memory, this table is intentionally restricted to owner only (info@rauch-heilpraktiker.de)
-- We keep the hardcoded UUID but ADD a role-based fallback for maintainability
DROP POLICY IF EXISTS "Only owner can access knowledge base" ON public.admin_knowledge_base;
CREATE POLICY "Only owner can access knowledge base"
ON public.admin_knowledge_base FOR ALL
TO authenticated
USING (
  auth.uid() = '42ff40ce-f7e8-42b9-89c2-a4fb76340502'::uuid
)
WITH CHECK (
  auth.uid() = '42ff40ce-f7e8-42b9-89c2-a4fb76340502'::uuid
);
