ALTER TABLE public.mannayan_orders
  ADD COLUMN IF NOT EXISTS pseudonym_id text;

-- Backfill aus patient_label, wenn dort ein gültiges Pseudonym steht
UPDATE public.mannayan_orders
SET pseudonym_id = (regexp_match(patient_label, 'P-\d{4}-\d{4}'))[1]
WHERE pseudonym_id IS NULL
  AND patient_label ~ 'P-\d{4}-\d{4}';

-- Format-Check (nur P-YYYY-NNNN erlauben, NULL ok)
ALTER TABLE public.mannayan_orders
  DROP CONSTRAINT IF EXISTS mannayan_orders_pseudonym_format;
ALTER TABLE public.mannayan_orders
  ADD CONSTRAINT mannayan_orders_pseudonym_format
  CHECK (pseudonym_id IS NULL OR pseudonym_id ~ '^P-\d{4}-\d{4}$');

CREATE INDEX IF NOT EXISTS idx_mannayan_orders_pseudonym
  ON public.mannayan_orders (pseudonym_id);