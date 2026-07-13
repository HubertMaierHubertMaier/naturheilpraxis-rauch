-- Defense in depth: pseudonym-based therapy records must not persist direct identifiers.
-- Existing rows are intentionally not rewritten by this migration.

CREATE OR REPLACE FUNCTION public.redact_therapy_pii_text(_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  result text := COALESCE(_value, '');
BEGIN
  result := regexp_replace(result, '[[:alnum:]_.+%-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[E-Mail entfernt]', 'gi');
  result := regexp_replace(result, '\m(Telefon(nummer)?|Tel\.?|Mobil|Handy|Fon|Fax|Rufnummer|Rückrufnummer)\M[[:space:]]*[:.]?[[:space:]]*[+()[:digit:]][[:digit:][:space:]()/-]{5,}', '[Kontaktdaten entfernt]', 'gi');
  result := regexp_replace(result, '(\+49|0049)[[:space:]]*\(?[[:digit:]]{2,5}\)?([[:space:]/-]*[[:digit:]]){5,}\M', '[Kontaktdaten entfernt]', 'g');
  result := regexp_replace(result, '\m0[[:digit:]]{2,5}([[:space:]/-][[:digit:]]{2,}){1,3}\M', '[Kontaktdaten entfernt]', 'g');
  result := regexp_replace(result, '\m(geb\.?|geboren|Geburtsdatum|Geb\.?-?Datum|Geb\.?-?Tag)\M[[:space:]]*[:.]?[[:space:]]*[[:digit:]]{1,2}[./-][[:digit:]]{1,2}[./-][[:digit:]]{2,4}', '[Geburtsdatum entfernt]', 'gi');
  result := regexp_replace(result, '\m(Versicherten(nummer|-?Nr\.?)?|KV-?Nr\.?|Krankenkassen-?Nr\.?|Patienten-?Nr\.?|Patienten-?ID|Fall-?Nr\.?|Aktenzeichen|Mitgliedsnummer)\M[[:space:]]*[:.]?[[:space:]]*[[:alnum:]][[:alnum:][:space:]./-]{4,}', '[Identifikationsnummer entfernt]', 'gi');
  result := regexp_replace(result, '\m(QR-?Code|Barcode|Strichcode)\M[[:space:]]*[:.]?[[:space:]]*[^[:cntrl:]]{3,160}', '[Code entfernt]', 'gi');
  result := regexp_replace(result, '(Name|Nachname|Vorname|Patientenname|Patient|Patientin|Versicherter|Versicherte|Behandler|Behandlerin|Arzt|Ärztin)[[:space:]]*:?[[:space:]]*</(td|th|dt|span|strong|label)>[[:space:]]*<(td|th|dd|span|div|p)[^>]*>(?![[:space:]]*P-[[:digit:]]{4}-[[:digit:]]{1,4})[[:space:]]*[^<]{2,100}', '\1</\2><\3>[personenbezogene Angabe entfernt]', 'gi');
  result := regexp_replace(result, '(Name|Nachname|Vorname|Patientenname|Patient|Patientin|Versicherter|Versicherte|Behandler|Behandlerin|Arzt|Ärztin)[[:space:]]*:?[[:space:]]*</(strong|span|label)>(?![[:space:]]*P-[[:digit:]]{4}-[[:digit:]]{1,4})[[:space:]]*[^<]{2,100}(</(p|div|td)>)', '\1</\2> [personenbezogene Angabe entfernt]\3', 'gi');
  result := regexp_replace(result, '(Geburtsdatum|geb\.?|geboren|Telefon|Tel\.?|Mobil|E-Mail|Versicherten-?Nr\.?)\s*:?\s*</(td|th|span|strong|label)>\s*<(td|th|span|div|p)[^>]*>\s*[^<]{2,120}', '\1</\2><\3>[personenbezogene Angabe entfernt]', 'gi');
  result := regexp_replace(result, '\m(Name|Nachname|Vorname|Patientenname|Behandler|Behandlerin|Arzt|Ärztin)\M[[:space:]]*[:=-][[:space:]]*(?!P-[[:digit:]])((Dr|Prof)\.?[[:space:]]+)?[[:upper:]][[:alpha:]''-]+([[:space:]]+[[:upper:]][[:alpha:]''-]+){0,2}', '\1: [personenbezogene Angabe entfernt]', 'g');
  result := regexp_replace(result, '\m(Herr|Herrn|Frau)\M[[:space:]]+((Dr|Prof)\.?[[:space:]]+)?[[:upper:]][[:alpha:]''-]+([[:space:]]+[[:upper:]][[:alpha:]''-]+){0,2}([[:space:]]*,|[[:space:]]+(wohnhaft|geb\.?|Alter)\M)', '\1 [Name entfernt]\5', 'g');
  result := regexp_replace(result, '\m(Dr|Prof)\.?[[:space:]]+(med\.?[[:space:]]+)?[[:upper:]][[:alpha:]''-]+([[:space:]]+[[:upper:]][[:alpha:]''-]+){0,2}([[:space:]]*,|;|[[:space:]]*$)', '[Name entfernt]\4', 'g');
  result := regexp_replace(result, '\m[[:upper:]][[:alpha:]''-]+[[:space:]]+[[:upper:]][[:alpha:]''-]+(?=[[:space:]]*,?[[:space:]]+(geb\.?|geboren|Geburtsdatum)\M)', '[Name entfernt]', 'g');
  result := regexp_replace(result, '\m[[:alpha:]][[:alpha:][:space:].''-]{1,50}(straße|str\.|weg|platz|allee|gasse|ring|damm)[[:space:]]+[[:digit:]]+[[:alpha:]]?([[:space:]]*,?[[:space:]]*[[:digit:]]{5}[[:space:]]+[[:upper:]][[:alpha:][:space:].''-]{1,50})?', '[Anschrift entfernt]', 'gi');
  result := regexp_replace(result, '\m[[:digit:]]{5}[[:space:]]+[[:upper:]][[:alpha:]''-]+([[:space:]]+[[:upper:]][[:alpha:]''-]+){0,2}\M', '[Ort entfernt]', 'g');
  result := regexp_replace(result, '\m(IBAN)[[:space:]]*[:.]?[[:space:]]*[[:upper:]]{2}[[:digit:]]{2}([[:space:]]?[[:alnum:]]){10,30}\M', '[Bankverbindung entfernt]', 'gi');
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.redact_therapy_pii_jsonb(_value jsonb, _parent_key text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  value_type text := jsonb_typeof(_value);
BEGIN
  IF _value IS NULL THEN
    RETURN NULL;
  ELSIF value_type = 'object' THEN
    RETURN (
      SELECT COALESCE(jsonb_object_agg(entry.key, CASE
        WHEN lower(regexp_replace(entry.key, '[^a-zA-Z0-9äöüß]', '', 'g')) IN (
          'vorname', 'firstname', 'nachname', 'lastname', 'patientenname', 'patientname',
          'geburtsdatum', 'birthdate', 'dateofbirth', 'dob', 'adresse', 'address', 'anschrift',
          'strasse', 'straße', 'street', 'plz', 'postleitzahl', 'postalcode', 'ort', 'city',
          'telefon', 'phone', 'phonenumber', 'mobil', 'mobile', 'email', 'emailaddress',
          'versichertennummer', 'insurancenumber', 'insuranceid', 'patientenid', 'patientid',
          'fallnummer', 'casenumber', 'qrcode', 'barcode', 'strichcode',
          'archivepath', 'filename', 'file_name', 'dateiname'
        ) THEN to_jsonb('[personenbezogene Angabe entfernt]'::text)
        WHEN lower(entry.key) = 'name' AND lower(_parent_key) IN ('files', 'documents', 'document_inventory', 'documentinventory', 'uploads')
          THEN to_jsonb('Dokument'::text)
        ELSE public.redact_therapy_pii_jsonb(entry.value, entry.key)
      END), '{}'::jsonb)
      FROM jsonb_each(_value) AS entry
    );
  ELSIF value_type = 'array' THEN
    RETURN (
      SELECT COALESCE(jsonb_agg(public.redact_therapy_pii_jsonb(entry.value, _parent_key)), '[]'::jsonb)
      FROM jsonb_array_elements(_value) AS entry
    );
  ELSIF value_type = 'string' THEN
    RETURN to_jsonb(public.redact_therapy_pii_text(_value #>> '{}'));
  END IF;
  RETURN _value;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_therapy_session_deidentification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.eingabe_daten := public.redact_therapy_pii_jsonb(NEW.eingabe_daten);
  NEW.befund_meta := public.redact_therapy_pii_jsonb(NEW.befund_meta);
  NEW.befund_html := CASE WHEN NEW.befund_html IS NULL THEN NULL ELSE public.redact_therapy_pii_text(NEW.befund_html) END;
  NEW.empfehlung := public.redact_therapy_pii_text(NEW.empfehlung);
  NEW.notiz := CASE WHEN NEW.notiz IS NULL THEN NULL ELSE public.redact_therapy_pii_text(NEW.notiz) END;
  IF regexp_replace(concat_ws(' ', NEW.eingabe_daten::text, NEW.befund_meta::text, NEW.befund_html, NEW.empfehlung, NEW.notiz), '<[^>]+>', '', 'g')
    ~* '\m(Patient|Patientin|Versicherter|Versicherte)\M[[:space:]]*[:=-](?![[:space:]]*(P-[[:digit:]]{4}-[[:digit:]]{1,4}\M|Männlich\M|Maennlich\M|Weiblich\M|Divers\M|\[personenbezogene Angabe entfernt\]))'
  THEN
    RAISE EXCEPTION 'Datenschutz-Sicherheitsstopp: nicht eindeutig anonymisiertes Patientenfeld';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_therapy_session_deidentification ON public.therapy_sessions;
CREATE TRIGGER enforce_therapy_session_deidentification
BEFORE INSERT OR UPDATE ON public.therapy_sessions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_therapy_session_deidentification();

REVOKE ALL ON FUNCTION public.redact_therapy_pii_text(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redact_therapy_pii_jsonb(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_therapy_session_deidentification() FROM PUBLIC;
