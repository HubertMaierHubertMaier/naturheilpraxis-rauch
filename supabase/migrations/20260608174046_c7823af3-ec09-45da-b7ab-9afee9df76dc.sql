ALTER TABLE public.therapy_sessions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'empfehlung',
  ADD COLUMN IF NOT EXISTS befund_html text,
  ADD COLUMN IF NOT EXISTS befund_meta jsonb;
ALTER TABLE public.therapy_sessions ALTER COLUMN empfehlung DROP NOT NULL;
ALTER TABLE public.therapy_sessions ALTER COLUMN empfehlung SET DEFAULT '';