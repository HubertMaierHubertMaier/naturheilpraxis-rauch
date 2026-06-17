ALTER TABLE public.infothek_gating
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'patient';

ALTER TABLE public.infothek_gating
  DROP CONSTRAINT IF EXISTS infothek_gating_visibility_check;

ALTER TABLE public.infothek_gating
  ADD CONSTRAINT infothek_gating_visibility_check
  CHECK (visibility IN ('public','new_patient','patient'));

-- Backfill from existing gated boolean
UPDATE public.infothek_gating
  SET visibility = CASE WHEN gated THEN 'patient' ELSE 'public' END
  WHERE visibility = 'patient' AND gated = false;