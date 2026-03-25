DROP POLICY IF EXISTS "Admins can do everything with knowledge base" ON public.admin_knowledge_base;

CREATE POLICY "Only owner can access knowledge base"
ON public.admin_knowledge_base
FOR ALL
TO authenticated
USING (auth.uid() = '42ff40ce-f7e8-42b9-89c2-a4fb76340502')
WITH CHECK (auth.uid() = '42ff40ce-f7e8-42b9-89c2-a4fb76340502');