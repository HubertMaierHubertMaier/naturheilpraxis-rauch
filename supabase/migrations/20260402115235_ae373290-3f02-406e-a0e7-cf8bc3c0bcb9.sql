
-- Drop the overly permissive insert policy on verification_codes
DROP POLICY IF EXISTS "Service can insert verification codes" ON public.verification_codes;

-- No replacement policy needed: edge functions use SERVICE_ROLE_KEY which bypasses RLS
