-- Tabelle für pseudonymisierte Therapie-Sitzungen
CREATE TABLE public.therapy_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pseudonym_id TEXT NOT NULL,
  eingabe_daten JSONB NOT NULL DEFAULT '{}'::jsonb,
  empfehlung TEXT NOT NULL DEFAULT '',
  notiz TEXT DEFAULT '',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index für schnelle Suche nach Pseudonym
CREATE INDEX idx_therapy_sessions_pseudonym ON public.therapy_sessions(pseudonym_id);
CREATE INDEX idx_therapy_sessions_created_at ON public.therapy_sessions(created_at DESC);

-- Row Level Security aktivieren
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;

-- Nur Admins dürfen ALLES (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Only admins can manage therapy sessions"
ON public.therapy_sessions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger für updated_at
CREATE TRIGGER update_therapy_sessions_updated_at
BEFORE UPDATE ON public.therapy_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();