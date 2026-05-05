-- Tabelle für Patienten-Materialien
CREATE TABLE public.patient_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Allgemein',
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  file_size BIGINT DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_resources ENABLE ROW LEVEL SECURITY;

-- Helper: prüft, ob aktueller User verifizierter Patient ist
CREATE OR REPLACE FUNCTION public.is_verified_patient(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND is_verified_patient = true
  )
$$;

-- RLS: Admins voll, verifizierte Patienten lesend (nur veröffentlichte)
CREATE POLICY "Admins manage patient_resources"
ON public.patient_resources FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Verified patients can view published resources"
ON public.patient_resources FOR SELECT TO authenticated
USING (is_published = true AND public.is_verified_patient(auth.uid()));

-- updated_at Trigger
CREATE TRIGGER trg_patient_resources_updated
BEFORE UPDATE ON public.patient_resources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Privater Storage-Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-library', 'patient-library', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Admins voll, verifizierte Patienten dürfen lesen
CREATE POLICY "Admins manage patient-library objects"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'patient-library' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'patient-library' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Verified patients can read patient-library objects"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patient-library' AND public.is_verified_patient(auth.uid()));