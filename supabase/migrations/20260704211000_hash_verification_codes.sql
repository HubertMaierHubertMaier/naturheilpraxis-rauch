CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE public.verification_codes
SET code = encode(digest(code, 'sha256'), 'hex')
WHERE code IS NOT NULL
  AND code !~ '^[0-9a-f]{64}$';
