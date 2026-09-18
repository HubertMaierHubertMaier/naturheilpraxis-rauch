-- Match the clinical line contract used by the local privacy detector.
-- Device/food measurement rows must not become street addresses on persistence.
-- No stored records are rewritten. Explicit identity/address labels stay subject
-- to the existing privacy rules; so do integer house numbers and postal codes.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.redact_therapy_pii_text(text)'::regprocedure);
  declaration_anchor text := $anchor$result text := COALESCE(_value, '');$anchor$;
  first_rule text := $anchor$result := regexp_replace(result, '[[:alnum:]_.+%-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[E-Mail entfernt]', 'gi');$anchor$;
  declarations text := $code$
  clinical_lines text[];
  clinical_measurement_rows text[] := ARRAY[]::text[];
  clinical_tokens text[] := ARRAY[]::text[];
  clinical_prefix text := '__CLINICAL_DEVICE_ROW_';
  clinical_index integer;
  clinical_token text;
$code$;
  protect_rows text := $code$
  -- Use a prefix absent from the original, so literal source text cannot collide
  -- with temporary tokens. Split on LF only: retained CR characters restore CRLF
  -- byte-for-byte together with the exact original row.
  WHILE strpos(result, clinical_prefix) > 0 LOOP
    clinical_prefix := clinical_prefix || '_';
  END LOOP;
  clinical_lines := string_to_array(result, E'\n');
  FOR clinical_index IN 1..COALESCE(array_length(clinical_lines, 1), 0) LOOP
    IF clinical_lines[clinical_index] ~ '^[[:blank:]]*[[:upper:]][[:alnum:][:blank:]().,''’/–—-]*[[:blank:]]+[[:digit:]]{1,2}[[:blank:]]*[,.][[:blank:]]*[[:digit:]]{1,3}[[:space:]]*$'
      AND clinical_lines[clinical_index] !~* '^[[:blank:]]*(Name|Narne|Vorname|Vornarne|Nachname|Nachnarne|Patientenname|Patient(in)?|Patlent(in)?|Versicherte(r|n)?|Behandler(in)?|Arzt|Ärztin|Anschrift|Anschrlft|Adresse|Straße|Strasse|StraBe|PLZ|Postleitzahl|Ort|Praxisadresse|Laboradresse|Praxisname|Laborname|Klinikname|Institutsname|Einrichtungsname|Arztpraxis|Behandlerpraxis|Einsender|Absender|Unterschrift|Signatur|Stempel|LANR|BSNR|Arztnummer|IK|Institutionskennzeichen)([[:blank:]]|:|=|-)'
    THEN
      clinical_token := clinical_prefix || clinical_index::text || '__';
      clinical_measurement_rows := array_append(clinical_measurement_rows, clinical_lines[clinical_index]);
      clinical_tokens := array_append(clinical_tokens, clinical_token);
      clinical_lines[clinical_index] := clinical_token;
    END IF;
  END LOOP;
  result := COALESCE(array_to_string(clinical_lines, E'\n'), '');
$code$;
  restore_rows text := $code$
  FOR clinical_index IN 1..COALESCE(array_length(clinical_tokens, 1), 0) LOOP
    result := replace(result, clinical_tokens[clinical_index], clinical_measurement_rows[clinical_index]);
  END LOOP;
  RETURN result;
$code$;
BEGIN
  IF position('clinical_measurement_rows' IN definition) > 0
    OR array_length(string_to_array(definition, declaration_anchor), 1) IS DISTINCT FROM 2
    OR array_length(string_to_array(definition, first_rule), 1) IS DISTINCT FROM 2
    OR array_length(string_to_array(definition, 'RETURN result;'), 1) IS DISTINCT FROM 2
  THEN
    RAISE EXCEPTION 'Clinical row privacy baseline differs; inspect before changing the function';
  END IF;
  definition := replace(definition, declaration_anchor, declaration_anchor || declarations);
  definition := replace(definition, first_rule, protect_rows || first_rule);
  definition := replace(definition, 'RETURN result;', restore_rows);
  EXECUTE definition;
END;
$migration$;
