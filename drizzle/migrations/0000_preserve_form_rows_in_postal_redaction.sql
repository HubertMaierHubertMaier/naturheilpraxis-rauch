-- Do not interpret checkbox/OCR rows and the next question as a postal address.
-- Change only the known postal rule; retain all other deployed redaction rules,
-- function permissions, triggers and stored rows. Abort on an unexpected baseline.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.redact_therapy_pii_text(text)'::regprocedure);
  previous_rule text := $old$result := regexp_replace(result, '\m[[:digit:]]{5}[[:space:]]+[[:upper:]][[:alpha:]''-]+([[:space:]]+[[:upper:]][[:alpha:]''-]+){0,2}\M', '[Ort entfernt]', 'g');$old$;
  replacement_rules text := $new$-- An explicit address label also permits wrapped postal code/city values.
  result := regexp_replace(result, '\m(PLZ([[:blank:]]*/[[:blank:]]*Ort)?|Postleitzahl|Wohnort|Ort)\M[[:blank:]]*[:=][[:space:]]*(?!00000\M)[[:digit:]]{5}[[:space:]]+[[:upper:]][[:alpha:]''-]+([[:blank:]]+[[:upper:]][[:alpha:]''-]+){0,2}\M', '\1: [Ort entfernt]', 'g');
  -- Without a label, a wrapped address must occupy its own complete lines.
  -- A question ending in five digits followed by "Manuell pruefen (...)" is not one.
  result := regexp_replace(result, '(^|[\r\n])[[:blank:]]*(?!00000\M)[[:digit:]]{5}[[:blank:]]*[\r\n]+[[:blank:]]*[[:upper:]][[:alpha:]''-]+([[:blank:]]+[[:upper:]][[:alpha:]''-]+){0,2}(?=[[:blank:]]*([\r\n]|$))', '\1[Ort entfernt]', 'g');
  -- Ordinary postal addresses stay on one line. 00000 is a placeholder, not a PLZ.
  result := regexp_replace(result, '\m(?!00000\M)[[:digit:]]{5}[[:blank:]]+[[:upper:]][[:alpha:]''-]+([[:blank:]]+[[:upper:]][[:alpha:]''-]+){0,2}\M', '[Ort entfernt]', 'g');$new$;
BEGIN
  IF array_length(string_to_array(definition, previous_rule), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Postal redaction baseline differs; inspect before changing the privacy function';
  END IF;
  EXECUTE replace(definition, previous_rule, replacement_rules);
END;
$migration$;