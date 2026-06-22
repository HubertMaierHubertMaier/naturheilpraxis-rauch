
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

  -- Kein automatischer Stufe-1-Zugriff mehr.
  -- Neue Accounts sind nur registriert; alle Freischaltungen
  -- (Anamnesebogen, Infothek, Bibliothek) erfolgen ausschließlich
  -- manuell durch den Admin im PatientAccessManager.
  RETURN NEW;
END;
$function$;

-- Aufräumen: alle reinen Auto-Stufe-1-Einträge ohne Freischaltung entfernen
DELETE FROM public.patient_access
WHERE note = 'Auto-Stufe-1 bei Registrierung'
  AND infothek_all = false
  AND library_access = false
  AND (infothek_items IS NULL OR array_length(infothek_items, 1) IS NULL);
