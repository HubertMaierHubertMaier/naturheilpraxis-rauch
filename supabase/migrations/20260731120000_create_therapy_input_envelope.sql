BEGIN;

-- Version 1 is immutable. Future PII rules must be introduced under a new
-- function and deidentification version so historical envelopes stay restorable.
CREATE FUNCTION public.therapy_input_pii_text_is_safe_v1(_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT
    _value !~* '[[:alnum:]_.+%-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
    AND _value !~* '\m(Telefon(nummer)?|Tel\.?|Mobil|Handy|Fon|Fax|Rufnummer|Rueckrufnummer|Rückrufnummer)\M[[:space:]]*[:.]?[[:space:]]*[+()[:digit:]][[:digit:][:space:]()/-]{5,}'
    AND _value !~* '(\+49|0049)[[:space:]]*\(?[[:digit:]]{2,5}\)?([[:space:]/-]*[[:digit:]]){5,}\M'
    AND _value !~* '\m0[[:digit:]]{2,5}([[:space:]/-][[:digit:]]{2,}){1,3}\M'
    AND _value !~* '\m(geb\.?|geboren|Geburtsdatum|Geb\.?-?Datum|Geb\.?-?Tag)\M[[:space:]]*[:.]?[[:space:]]*[[:digit:]]{1,2}[./-][[:digit:]]{1,2}[./-][[:digit:]]{2,4}'
    AND _value !~* '\m(Versicherten(nummer|-?Nr\.?)?|KV-?Nr\.?|Krankenkassen-?Nr\.?|Patienten-?Nr\.?|Patienten-?ID|Fall-?Nr\.?|Aktenzeichen|Mitgliedsnummer)\M[[:space:]]*[:.]?[[:space:]]*[[:alnum:]][[:alnum:][:space:]./-]{4,}'
    AND regexp_replace(
      _value,
      '\[(personenbezogene Angabe|Name|Kontaktdaten|Anschrift|Geburtsdatum|Identifikationsnummer|Code|Ort|Bankverbindung|E-Mail) entfernt\]',
      '',
      'gi'
    ) !~* '\m(Name|Nachname|Vorname|Patientenname|Patientname|Behandler|Behandlerin|Arzt|Aerztin|Ärztin)\M[[:space:]]*[:=-][[:space:]]*[^[:cntrl:]]{2,100}'
    AND regexp_replace(
      _value,
      '\[(personenbezogene Angabe|Name|Kontaktdaten|Anschrift|Geburtsdatum|Identifikationsnummer|Code|Ort|Bankverbindung|E-Mail) entfernt\]',
      '',
      'gi'
    ) !~* '\m(Patient|Patientin|Versicherter|Versicherte)\M[[:space:]]*[:=-][[:space:]]*(?!P-[[:digit:]]{4}-[[:digit:]]{4}\M|Maennlich\M|Männlich\M|Weiblich\M|Divers\M)[^[:cntrl:]]{2,100}'
    AND _value !~* '\m(Herr|Herrn|Frau)\M[[:space:]]+((Dr|Prof)\.?[[:space:]]+)?[[:upper:]][[:alpha:]''-]+([[:space:]]+[[:upper:]][[:alpha:]''-]+){0,2}'
    AND _value !~* '\m[[:alpha:]][[:alpha:][:space:].''-]{1,50}(strasse|straße|str\.|weg|platz|allee|gasse|ring|damm)[[:space:]]+[[:digit:]]+[[:alpha:]]?'
    AND _value !~* '\m[[:digit:]]{5}[[:space:]]+[[:upper:]][[:alpha:]''-]+([[:space:]]+[[:upper:]][[:alpha:]''-]+){0,2}\M'
    AND _value !~* '\mIBAN\M[[:space:]]*[:.]?[[:space:]]*[[:upper:]]{2}[[:digit:]]{2}([[:space:]]?[[:alnum:]]){10,30}\M'
    AND _value !~* '([A-Za-z]:[\\/](Users|Benutzer|Documents|Dokumente)[\\/]|/(home|Users)/[^/[:space:]]+/|/storage/v1/object/)'
    AND _value !~* '\m[^[:space:]/\\]+\.(pdf|jpe?g|png|docx?|txt)\M'
    AND _value !~ '\{[[:space:]]*"'
    AND _value !~ '\[[[:space:]]*[\{"]'
$$;

CREATE FUNCTION public.therapy_input_pii_jsonb_is_safe_v1(_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  value_type text := jsonb_typeof(_value);
  entry record;
  normalized_key text;
BEGIN
  IF value_type = 'object' THEN
    FOR entry IN SELECT item.key, item.value FROM jsonb_each(_value) item
    LOOP
      normalized_key := lower(regexp_replace(entry.key, '[^a-zA-Z0-9äöüß]', '', 'g'));
      IF normalized_key IN (
        'name', 'vorname', 'firstname', 'nachname', 'lastname', 'fullname',
        'nameindruckbuchstaben', 'signaturename', 'patientenname',
        'patientname', 'geburtsdatum', 'birthdate', 'dateofbirth', 'dob',
        'adresse', 'address', 'anschrift', 'strasse', 'straße', 'street',
        'plz', 'postleitzahl', 'postalcode', 'ort', 'city', 'telefon', 'phone',
        'phonenumber', 'mobil', 'mobile', 'email', 'emailaddress',
        'versichertennummer', 'insurancenumber', 'insuranceid', 'patientenid',
        'patientid', 'userid', 'authuserid', 'therapysessionid', 'sourcesessionid',
        'pseudonymid', 'fallnummer', 'casenumber', 'qrcode', 'barcode',
        'strichcode', 'archivepath', 'storagepath', 'filepath', 'filename',
        'dateiname', 'arbeitgeber', 'empfehlungvon', 'hausarzt', 'fachaerzte',
        'heilpraktiker', 'physiotherapeut', 'zahnarztname',
        'erziehungsberechtigter'
      )
      OR normalized_key ~ '(name|vorname|nachname)$'
      OR normalized_key ~ '(telefon|phone|mobil|handy|fax|festnetz|email)'
      OR normalized_key ~ '(geburtsdatum|birthdate|dateofbirth|dob)'
      OR normalized_key ~ '(versicher|insurance).*(nummer|number|nr|id)$'
      OR normalized_key ~ '(adresse|address|anschrift|strasse|straße|street|plz|postleitzahl|postalcode)'
      OR normalized_key IN ('wohnort', 'geburtsort')
      OR NOT public.therapy_input_pii_jsonb_is_safe_v1(entry.value) THEN
        RETURN false;
      END IF;
    END LOOP;
    RETURN true;
  ELSIF value_type = 'array' THEN
    FOR entry IN SELECT item.value FROM jsonb_array_elements(_value) item
    LOOP
      IF NOT public.therapy_input_pii_jsonb_is_safe_v1(entry.value) THEN
        RETURN false;
      END IF;
    END LOOP;
    RETURN true;
  ELSIF value_type = 'string' THEN
    RETURN public.therapy_input_pii_text_is_safe_v1(_value #>> '{}');
  END IF;

  RETURN true;
END;
$$;

CREATE FUNCTION public.therapy_input_envelope_shape_is_valid_v1(_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  context_value jsonb;
  key_count integer;
  entry record;
BEGIN
  IF jsonb_typeof(_value) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;

  SELECT count(*)::integer INTO key_count FROM jsonb_object_keys(_value);
  IF key_count <> 3
     OR NOT _value ?& ARRAY['format', 'clinical_text', 'context']
     OR _value ->> 'format' IS DISTINCT FROM 'therapy_input_envelope_v1'
     OR jsonb_typeof(_value -> 'clinical_text') IS DISTINCT FROM 'string'
     OR NOT public.therapy_input_pii_text_is_safe_v1(_value ->> 'clinical_text')
     OR jsonb_typeof(_value -> 'context') IS DISTINCT FROM 'object'
  THEN
    RETURN false;
  END IF;

  context_value := _value -> 'context';
  IF EXISTS (
    SELECT 1
      FROM jsonb_object_keys(context_value) context_key
     WHERE context_key NOT IN (
       'age_years',
       'sex',
       'pregnancy_status',
       'height_cm',
       'weight_kg',
       'budget_eur',
       'selected_categories',
       'preferred_lanes'
     )
  ) THEN
    RETURN false;
  END IF;

  IF context_value ? 'age_years' AND (
    jsonb_typeof(context_value -> 'age_years') IS DISTINCT FROM 'number'
    OR (context_value ->> 'age_years')::numeric NOT BETWEEN 0 AND 130
    OR trunc((context_value ->> 'age_years')::numeric) <> (context_value ->> 'age_years')::numeric
  ) THEN RETURN false; END IF;
  IF context_value ? 'height_cm' AND (
    jsonb_typeof(context_value -> 'height_cm') IS DISTINCT FROM 'number'
    OR (context_value ->> 'height_cm')::numeric NOT BETWEEN 20 AND 260
  ) THEN RETURN false; END IF;
  IF context_value ? 'weight_kg' AND (
    jsonb_typeof(context_value -> 'weight_kg') IS DISTINCT FROM 'number'
    OR (context_value ->> 'weight_kg')::numeric NOT BETWEEN 1 AND 500
  ) THEN RETURN false; END IF;
  IF context_value ? 'budget_eur' AND (
    jsonb_typeof(context_value -> 'budget_eur') IS DISTINCT FROM 'number'
    OR (context_value ->> 'budget_eur')::numeric NOT BETWEEN 0 AND 1000000
  ) THEN RETURN false; END IF;
  IF context_value ? 'sex' AND (
    jsonb_typeof(context_value -> 'sex') IS DISTINCT FROM 'string'
    OR context_value ->> 'sex' NOT IN ('female', 'male', 'diverse', 'unknown')
  ) THEN RETURN false; END IF;
  IF context_value ? 'pregnancy_status' AND (
    jsonb_typeof(context_value -> 'pregnancy_status') IS DISTINCT FROM 'string'
    OR context_value ->> 'pregnancy_status' NOT IN ('yes', 'no', 'unknown', 'not_applicable')
  ) THEN RETURN false; END IF;

  FOR entry IN
    SELECT context_key, context_value -> context_key AS value
      FROM unnest(ARRAY['selected_categories', 'preferred_lanes']) context_key
     WHERE context_value ? context_key
  LOOP
    IF jsonb_typeof(entry.value) IS DISTINCT FROM 'array'
       OR EXISTS (
         SELECT 1
           FROM jsonb_array_elements(entry.value) item
          WHERE jsonb_typeof(item) IS DISTINCT FROM 'string'
             OR NOT public.therapy_input_pii_text_is_safe_v1(item #>> '{}')
       )
    THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN public.therapy_input_pii_jsonb_is_safe_v1(_value);
END;
$$;

CREATE FUNCTION public.therapy_input_source_payload_shape_is_valid_v1(_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  key_count integer;
BEGIN
  IF jsonb_typeof(_value) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;

  SELECT count(*)::integer INTO key_count FROM jsonb_object_keys(_value);
  RETURN key_count = 3
    AND _value ?& ARRAY['format', 'text', 'language']
    AND _value ->> 'format' = 'text'
    AND jsonb_typeof(_value -> 'text') = 'string'
    AND public.therapy_input_pii_text_is_safe_v1(_value ->> 'text')
    AND jsonb_typeof(_value -> 'language') = 'string'
    AND _value ->> 'language' IN ('de', 'en', 'und')
    AND public.therapy_input_pii_jsonb_is_safe_v1(_value);
END;
$$;

CREATE TABLE public.therapy_input_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym_id text NOT NULL
    CHECK (pseudonym_id ~ '^P-[0-9]{4}-[0-9]{4}$'),
  envelope_schema_version integer NOT NULL DEFAULT 1
    CHECK (envelope_schema_version = 1),
  hash_schema_version integer NOT NULL DEFAULT 1
    CHECK (hash_schema_version = 1),
  deidentification_version text NOT NULL DEFAULT 'clinical-deidentification-v1'
    CHECK (deidentification_version = 'clinical-deidentification-v1'),
  data_classification text NOT NULL DEFAULT 'pseudonymized_health_data'
    CHECK (data_classification = 'pseudonymized_health_data'),
  input_envelope jsonb NOT NULL
    CHECK (
      jsonb_typeof(input_envelope) = 'object'
      AND octet_length(input_envelope::text) <= 8388608
      AND public.therapy_input_envelope_shape_is_valid_v1(input_envelope)
    ),
  source_count integer NOT NULL CHECK (source_count BETWEEN 1 AND 64),
  content_sha256 text NOT NULL
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  captured_at timestamptz NOT NULL DEFAULT now(),
  captured_by uuid NOT NULL
);

CREATE TABLE public.therapy_input_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapy_input_revision_id uuid NOT NULL,
  source_order integer NOT NULL CHECK (source_order BETWEEN 1 AND 64),
  neutral_source_id text NOT NULL,
  source_type text NOT NULL
    CHECK (source_type IN (
      'manual_input',
      'anamnesis',
      'laboratory',
      'doctor_report',
      'imaging',
      'stool_microbiome',
      'complementary_measurement',
      'vieva_plus',
      'external_research',
      'order'
    )),
  document_date date,
  source_locator text NOT NULL DEFAULT ''
    CHECK (
      octet_length(source_locator) <= 4096
      AND public.therapy_input_pii_text_is_safe_v1(source_locator)
      AND (
        source_locator = ''
        OR source_locator ~ '^(page|section|paragraph|time):[a-z0-9][a-z0-9_:+-]{0,127}$'
      )
    ),
  source_payload jsonb NOT NULL
    CHECK (
      jsonb_typeof(source_payload) = 'object'
      AND octet_length(source_payload::text) <= 8388608
      AND public.therapy_input_source_payload_shape_is_valid_v1(source_payload)
    ),
  content_sha256 text NOT NULL
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT therapy_input_sources_neutral_source_id_check
    CHECK (
      neutral_source_id ~ (
        '^' || source_type || ':artifact:[0-9a-f]{12,64}$'
      )
    ),
  CONSTRAINT therapy_input_sources_revision_fk
    FOREIGN KEY (therapy_input_revision_id)
    REFERENCES public.therapy_input_revisions(id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT therapy_input_sources_revision_order_key
    UNIQUE (therapy_input_revision_id, source_order),
  CONSTRAINT therapy_input_sources_revision_neutral_id_key
    UNIQUE (therapy_input_revision_id, neutral_source_id)
);

CREATE INDEX therapy_input_revisions_pseudonym_captured_idx
  ON public.therapy_input_revisions(pseudonym_id, captured_at DESC, id);

CREATE FUNCTION public.therapy_input_canonical_jsonb_v1(_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  normalized jsonb;
BEGIN
  IF jsonb_typeof(_value) = 'object' THEN
    SELECT COALESCE(
             jsonb_object_agg(
               item.key,
               public.therapy_input_canonical_jsonb_v1(item.value)
               ORDER BY item.key COLLATE "C"
             ),
             '{}'::jsonb
           )
      INTO normalized
      FROM jsonb_each(_value) item;
    RETURN normalized;
  ELSIF jsonb_typeof(_value) = 'array' THEN
    SELECT COALESCE(
             jsonb_agg(
               public.therapy_input_canonical_jsonb_v1(item.value)
               ORDER BY item.ordinality
             ),
             '[]'::jsonb
           )
      INTO normalized
      FROM jsonb_array_elements(_value) WITH ORDINALITY item(value, ordinality);
    RETURN normalized;
  ELSIF jsonb_typeof(_value) = 'number' THEN
    RETURN to_jsonb(trim_scale((_value #>> '{}')::numeric));
  END IF;

  RETURN _value;
END;
$$;

CREATE FUNCTION public.therapy_input_jsonb_sha256_v1(_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT encode(
    sha256(convert_to(public.therapy_input_canonical_jsonb_v1(_value)::text, 'UTF8')),
    'hex'
  )
$$;

CREATE FUNCTION public.therapy_input_source_manifest_v1(
  _therapy_input_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'source_order', source.source_order,
        'neutral_source_id', source.neutral_source_id,
        'source_type', source.source_type,
        'document_date', source.document_date,
        'source_locator', source.source_locator,
        'content_sha256', source.content_sha256
      ) ORDER BY source.source_order
    ),
    '[]'::jsonb
  )
    FROM public.therapy_input_sources source
   WHERE source.therapy_input_revision_id = _therapy_input_revision_id
$$;

CREATE FUNCTION public.therapy_input_envelope_sha256_v1(
  _therapy_input_revision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.therapy_input_jsonb_sha256_v1(jsonb_build_object(
    'envelope_schema_version', revision.envelope_schema_version,
    'hash_schema_version', revision.hash_schema_version,
    'deidentification_version', revision.deidentification_version,
    'data_classification', revision.data_classification,
    'pseudonym_id', revision.pseudonym_id,
    'input_envelope', revision.input_envelope,
    'source_count', revision.source_count,
    'sources', public.therapy_input_source_manifest_v1(revision.id)
  ))
    FROM public.therapy_input_revisions revision
   WHERE revision.id = _therapy_input_revision_id
$$;

CREATE FUNCTION public.therapy_input_revision_is_valid_v1(
  _therapy_input_revision_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT
      revision.pseudonym_id ~ '^P-[0-9]{4}-[0-9]{4}$'
      AND revision.envelope_schema_version = 1
      AND revision.hash_schema_version = 1
      AND revision.deidentification_version = 'clinical-deidentification-v1'
      AND revision.data_classification = 'pseudonymized_health_data'
      AND jsonb_typeof(revision.input_envelope) = 'object'
      AND octet_length(revision.input_envelope::text) <= 8388608
      AND public.therapy_input_envelope_shape_is_valid_v1(revision.input_envelope)
      AND revision.source_count BETWEEN 1 AND 64
      AND revision.content_sha256 ~ '^[0-9a-f]{64}$'
      AND revision.content_sha256 = public.therapy_input_envelope_sha256_v1(revision.id)
      AND revision.source_count = (
        SELECT count(*)::integer
          FROM public.therapy_input_sources source
         WHERE source.therapy_input_revision_id = revision.id
      )
      AND 1 = (
        SELECT min(source.source_order)
          FROM public.therapy_input_sources source
         WHERE source.therapy_input_revision_id = revision.id
      )
      AND revision.source_count = (
        SELECT max(source.source_order)
          FROM public.therapy_input_sources source
         WHERE source.therapy_input_revision_id = revision.id
      )
      AND octet_length(revision.input_envelope::text) + COALESCE((
        SELECT sum(
          octet_length(source.source_payload::text)
          + octet_length(source.source_locator)
          + octet_length(source.neutral_source_id)
        )
          FROM public.therapy_input_sources source
         WHERE source.therapy_input_revision_id = revision.id
      ), 0) <= 33554432
      AND NOT EXISTS (
        SELECT 1
          FROM public.therapy_input_sources source
         WHERE source.therapy_input_revision_id = revision.id
           AND (
             source.source_order NOT BETWEEN 1 AND 64
             OR source.source_type NOT IN (
               'manual_input',
               'anamnesis',
               'laboratory',
               'doctor_report',
               'imaging',
               'stool_microbiome',
               'complementary_measurement',
               'vieva_plus',
               'external_research',
               'order'
             )
             OR source.neutral_source_id !~ (
               '^' || source.source_type || ':artifact:[0-9a-f]{12,64}$'
             )
             OR octet_length(source.source_locator) > 4096
             OR NOT public.therapy_input_pii_text_is_safe_v1(source.source_locator)
             OR NOT (
               source.source_locator = ''
               OR source.source_locator ~ '^(page|section|paragraph|time):[a-z0-9][a-z0-9_:+-]{0,127}$'
             )
             OR jsonb_typeof(source.source_payload) IS DISTINCT FROM 'object'
             OR octet_length(source.source_payload::text) > 8388608
             OR NOT public.therapy_input_source_payload_shape_is_valid_v1(source.source_payload)
             OR source.content_sha256 !~ '^[0-9a-f]{64}$'
             OR source.content_sha256 IS DISTINCT FROM
               public.therapy_input_jsonb_sha256_v1(jsonb_build_object(
               'hash_schema_version', revision.hash_schema_version,
               'source_order', source.source_order,
               'neutral_source_id', source.neutral_source_id,
               'source_type', source.source_type,
               'document_date', source.document_date,
               'source_locator', source.source_locator,
               'source_payload', source.source_payload
               ))
           )
      )
      FROM public.therapy_input_revisions revision
     WHERE revision.id = _therapy_input_revision_id
  ), false)
$$;

CREATE FUNCTION public.therapy_input_invalid_revision_count_v1()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)
       FROM public.therapy_input_revisions revision
      WHERE NOT public.therapy_input_revision_is_valid_v1(revision.id))
    +
    (SELECT count(*)
       FROM public.therapy_input_sources source
      WHERE NOT EXISTS (
        SELECT 1
          FROM public.therapy_input_revisions revision
         WHERE revision.id = source.therapy_input_revision_id
      ))
$$;

CREATE FUNCTION public.therapy_input_export_snapshot_v1()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  revision_rows bigint;
  source_rows bigint;
  revision_rows_text text;
  source_rows_text text;
  revision_rows_sha256 text;
  source_rows_sha256 text;
  invalid_revisions bigint;
BEGIN
  SELECT count(*)::bigint,
         COALESCE(
           jsonb_agg(
             to_jsonb(revision)
             ORDER BY revision.pseudonym_id, revision.captured_at, revision.id
           ),
           '[]'::jsonb
         )::text
    INTO revision_rows, revision_rows_text
    FROM public.therapy_input_revisions revision;

  SELECT count(*)::bigint,
         COALESCE(
           jsonb_agg(
             to_jsonb(source)
             ORDER BY source.therapy_input_revision_id, source.source_order, source.id
           ),
           '[]'::jsonb
         )::text
    INTO source_rows, source_rows_text
    FROM public.therapy_input_sources source;

  revision_rows_sha256 := encode(
    sha256(convert_to(revision_rows_text, 'UTF8')),
    'hex'
  );
  source_rows_sha256 := encode(
    sha256(convert_to(source_rows_text, 'UTF8')),
    'hex'
  );
  invalid_revisions := public.therapy_input_invalid_revision_count_v1();

  RETURN jsonb_build_object(
    'snapshot_version', 1,
    'tables', jsonb_build_object(
      'therapy_input_revisions', revision_rows_text,
      'therapy_input_sources', source_rows_text
    ),
    'manifest', jsonb_build_object(
      'therapy_input_revisions', jsonb_build_object(
        'rows', revision_rows,
        'sha256', revision_rows_sha256
      ),
      'therapy_input_sources', jsonb_build_object(
        'rows', source_rows,
        'sha256', source_rows_sha256
      )
    ),
    'validation', jsonb_build_object(
      'invalid_revision_count', invalid_revisions
    )
  )::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.therapy_input_protect_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Therapy input envelope is append-only';
END;
$$;

CREATE FUNCTION public.therapy_input_validate_revision_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  revision_id uuid;
BEGIN
  revision_id := CASE
    WHEN TG_TABLE_NAME = 'therapy_input_revisions'
      THEN (to_jsonb(NEW) ->> 'id')::uuid
    ELSE (to_jsonb(NEW) ->> 'therapy_input_revision_id')::uuid
  END;

  IF NOT public.therapy_input_revision_is_valid_v1(revision_id) THEN
    RAISE EXCEPTION 'Therapy input revision integrity check failed';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER therapy_input_revisions_append_only
  BEFORE UPDATE OR DELETE ON public.therapy_input_revisions
  FOR EACH ROW EXECUTE FUNCTION public.therapy_input_protect_append_only();

CREATE TRIGGER therapy_input_sources_append_only
  BEFORE UPDATE OR DELETE ON public.therapy_input_sources
  FOR EACH ROW EXECUTE FUNCTION public.therapy_input_protect_append_only();

CREATE CONSTRAINT TRIGGER therapy_input_revisions_validate_insert
  AFTER INSERT ON public.therapy_input_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.therapy_input_validate_revision_v1();

CREATE CONSTRAINT TRIGGER therapy_input_sources_validate_insert
  AFTER INSERT ON public.therapy_input_sources
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.therapy_input_validate_revision_v1();

ALTER TABLE public.therapy_input_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_input_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY therapy_input_revisions_admin_read
  ON public.therapy_input_revisions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY therapy_input_sources_admin_read
  ON public.therapy_input_sources
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE
  public.therapy_input_revisions,
  public.therapy_input_sources
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

GRANT SELECT ON TABLE
  public.therapy_input_revisions,
  public.therapy_input_sources
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.therapy_input_canonical_jsonb_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_pii_text_is_safe_v1(text)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_pii_jsonb_is_safe_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_envelope_shape_is_valid_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_source_payload_shape_is_valid_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_jsonb_sha256_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_source_manifest_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_envelope_sha256_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_revision_is_valid_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_invalid_revision_count_v1()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_export_snapshot_v1()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_protect_append_only()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_validate_revision_v1()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

GRANT EXECUTE ON FUNCTION public.therapy_input_export_snapshot_v1()
  TO service_role;

COMMIT;
