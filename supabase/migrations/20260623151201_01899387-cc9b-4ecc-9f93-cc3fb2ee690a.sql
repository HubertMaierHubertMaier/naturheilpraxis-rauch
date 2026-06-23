
ALTER TABLE public.therapy_sessions DISABLE TRIGGER USER;

-- Alte Auto-Sicherung der 00005 verwerfen (0005 hat aktuellere)
DELETE FROM public.therapy_sessions
WHERE id = 'f52df3a9-5250-4ad8-911a-acee1f1b09b4';

-- Versionsnummern der beiden 00005-Empfehlungen auf 6 und 7 setzen
UPDATE public.therapy_sessions SET version_number = 6
WHERE id = '9391a9f2-da6b-4e07-a05a-7d135bda585c';

UPDATE public.therapy_sessions SET version_number = 7
WHERE id = 'e5dc9fcc-e49c-42d1-9857-d313887d91e9';

-- Pseudonym umziehen + eingebettete Felder anpassen
UPDATE public.therapy_sessions
SET
  pseudonym_id = 'P-2026-0005',
  eingabe_daten = CASE
    WHEN eingabe_daten IS NULL THEN eingabe_daten
    ELSE eingabe_daten
      || jsonb_build_object('_pseudonym_id', 'P-2026-0005', 'pseudonymId', 'P-2026-0005')
  END
WHERE pseudonym_id = 'P-2026-00005';

ALTER TABLE public.therapy_sessions ENABLE TRIGGER USER;

DELETE FROM public.patient_snapshot WHERE pseudonym_id = 'P-2026-00005';
