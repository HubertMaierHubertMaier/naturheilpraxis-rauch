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
  result := regexp_replace(result, '\m(Dr|Prof)\.?[[:blank:]]+(med\.?[[:blank:]]+)?([[:upper:]]\.[[:blank:]]+){0,3}[[:upper:]][[:alpha:]''-]+([[:blank:]]+[[:upper:]][[:alpha:]''-]+){0,2}', '[Name entfernt]', 'g');
  result := regexp_replace(result, '\m[[:upper:]][[:alpha:]''-]+[[:space:]]+[[:upper:]][[:alpha:]''-]+(?=[[:space:]]*,?[[:space:]]+(geb\.?|geboren|Geburtsdatum)\M)', '[Name entfernt]', 'g');
  result := regexp_replace(result, '\m[[:alpha:]][[:alpha:][:space:].''-]{1,50}(straße|str\.|weg|platz|allee|gasse|ring|damm)[[:space:]]+[[:digit:]]+[[:alpha:]]?([[:space:]]*,?[[:space:]]*[[:digit:]]{5}[[:space:]]+[[:upper:]][[:alpha:][:space:].''-]{1,50})?', '[Anschrift entfernt]', 'gi');
  result := regexp_replace(result, '\m[[:digit:]]{5}[[:space:]]+[[:upper:]][[:alpha:]''-]+([[:space:]]+[[:upper:]][[:alpha:]''-]+){0,2}\M', '[Ort entfernt]', 'g');
  result := regexp_replace(result, '\m(IBAN)[[:space:]]*[:.]?[[:space:]]*[[:upper:]]{2}[[:digit:]]{2}([[:space:]]?[[:alnum:]]){10,30}\M', '[Bankverbindung entfernt]', 'gi');
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.redact_therapy_pii_text(text) FROM PUBLIC;