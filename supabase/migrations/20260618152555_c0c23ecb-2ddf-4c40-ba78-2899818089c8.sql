
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient');

  -- Stufe 1: Neupatient bekommt automatisch nur den Anamnesebogen freigeschaltet.
  -- Infothek-gesperrte Inhalte und Patienten-Bibliothek bleiben gesperrt,
  -- bis der Admin sie im PatientAccessManager selektiv freischaltet.
  INSERT INTO public.patient_access (email, anamnese_download, infothek_all, library_access, infothek_items, note)
  VALUES (lower(NEW.email), true, false, false, ARRAY[]::text[], 'Auto-Stufe-1 bei Registrierung')
  ON CONFLICT (email) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Bestehenden Datensatz auf Stufe 1 zurücksetzen
UPDATE public.patient_access
SET infothek_all = false,
    library_access = false,
    infothek_items = ARRAY[]::text[],
    anamnese_download = true,
    note = COALESCE(note, '') || ' [zurückgesetzt auf Stufe 1]',
    updated_at = now()
WHERE email = 'praxis_rauch@icloud.com';
