BEGIN;

CREATE FUNCTION public.therapy_input_fact_value_shape_is_valid_v1(_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  value_type text;
  key_count integer;
  numeric_value numeric;
  reference_low numeric;
  reference_high numeric;
BEGIN
  IF jsonb_typeof(_value) IS DISTINCT FROM 'object'
     OR octet_length(_value::text) > 16384
     OR EXISTS (
       SELECT 1
         FROM jsonb_each(_value) item
        WHERE item.value = 'null'::jsonb
     )
  THEN
    RETURN false;
  END IF;

  SELECT count(*)::integer INTO key_count FROM jsonb_object_keys(_value);
  IF jsonb_typeof(_value -> 'type') IS DISTINCT FROM 'string' THEN
    RETURN false;
  END IF;
  value_type := _value ->> 'type';

  IF value_type = 'none' THEN
    RETURN key_count = 1;
  ELSIF value_type = 'text' THEN
    RETURN key_count = 2
      AND _value ?& ARRAY['type', 'value']
      AND jsonb_typeof(_value -> 'value') = 'string'
      AND btrim(_value ->> 'value') <> ''
      AND octet_length(_value ->> 'value') <= 4096
      AND public.therapy_input_pii_text_is_safe_v1(_value ->> 'value');
  ELSIF value_type = 'boolean' THEN
    RETURN key_count = 2
      AND _value ?& ARRAY['type', 'value']
      AND jsonb_typeof(_value -> 'value') = 'boolean';
  ELSIF value_type = 'coded' THEN
    IF key_count NOT IN (3, 4)
       OR NOT _value ?& ARRAY['type', 'system', 'code']
       OR EXISTS (
         SELECT 1
           FROM jsonb_object_keys(_value) item(key)
          WHERE item.key NOT IN ('type', 'system', 'code', 'display')
       )
       OR jsonb_typeof(_value -> 'system') IS DISTINCT FROM 'string'
       OR _value ->> 'system' NOT IN (
         'local_v1',
         'icd_10_gm',
         'atc',
         'loinc',
         'ncbi_taxonomy',
         'pzn',
         'gtin',
         'program_code'
       )
       OR jsonb_typeof(_value -> 'code') IS DISTINCT FROM 'string'
       OR octet_length(_value ->> 'code') NOT BETWEEN 1 AND 128
       OR _value ->> 'code' !~ '^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,127}$'
       OR NOT public.therapy_input_pii_text_is_safe_v1(_value ->> 'code')
    THEN
      RETURN false;
    END IF;

    RETURN NOT (_value ? 'display') OR (
      jsonb_typeof(_value -> 'display') = 'string'
      AND btrim(_value ->> 'display') <> ''
      AND octet_length(_value ->> 'display') <= 512
      AND public.therapy_input_pii_text_is_safe_v1(_value ->> 'display')
    );
  ELSIF value_type = 'quantity' THEN
    IF key_count NOT BETWEEN 5 AND 7
       OR NOT _value ?& ARRAY['type', 'value', 'comparator', 'unit_system', 'unit_code']
       OR EXISTS (
         SELECT 1
           FROM jsonb_object_keys(_value) item(key)
          WHERE item.key NOT IN (
            'type',
            'value',
            'comparator',
            'unit_system',
            'unit_code',
            'reference_low',
            'reference_high'
          )
       )
       OR jsonb_typeof(_value -> 'value') IS DISTINCT FROM 'number'
       OR jsonb_typeof(_value -> 'comparator') IS DISTINCT FROM 'string'
       OR _value ->> 'comparator' NOT IN ('eq', 'lt', 'le', 'gt', 'ge')
       OR jsonb_typeof(_value -> 'unit_system') IS DISTINCT FROM 'string'
       OR _value ->> 'unit_system' NOT IN ('ucum', 'unitless')
       OR jsonb_typeof(_value -> 'unit_code') IS DISTINCT FROM 'string'
       OR octet_length(_value ->> 'unit_code') NOT BETWEEN 1 AND 64
       OR _value ->> 'unit_code' !~ '^[A-Za-z0-9%*/.^_{}()[\]+-]{1,64}$'
       OR (
         _value ->> 'unit_system' = 'unitless'
         AND _value ->> 'unit_code' <> '1'
       )
       OR (
         _value ? 'reference_low'
         AND jsonb_typeof(_value -> 'reference_low') IS DISTINCT FROM 'number'
       )
       OR (
         _value ? 'reference_high'
         AND jsonb_typeof(_value -> 'reference_high') IS DISTINCT FROM 'number'
       )
    THEN
      RETURN false;
    END IF;

    numeric_value := (_value ->> 'value')::numeric;
    IF numeric_value NOT BETWEEN '-1e100'::numeric AND '1e100'::numeric
       OR octet_length(_value ->> 'value') > 128
    THEN
      RETURN false;
    END IF;

    IF _value ? 'reference_low' THEN
      reference_low := (_value ->> 'reference_low')::numeric;
      IF reference_low NOT BETWEEN '-1e100'::numeric AND '1e100'::numeric
         OR octet_length(_value ->> 'reference_low') > 128
      THEN
        RETURN false;
      END IF;
    END IF;

    IF _value ? 'reference_high' THEN
      reference_high := (_value ->> 'reference_high')::numeric;
      IF reference_high NOT BETWEEN '-1e100'::numeric AND '1e100'::numeric
         OR octet_length(_value ->> 'reference_high') > 128
      THEN
        RETURN false;
      END IF;
    END IF;

    RETURN reference_low IS NULL
      OR reference_high IS NULL
      OR reference_high >= reference_low;
  END IF;

  RETURN false;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

CREATE FUNCTION public.therapy_input_demographic_fact_is_valid_v1(
  _fact_key text,
  _fact_value jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  key_count integer;
  numeric_value numeric;
BEGIN
  IF NOT public.therapy_input_fact_value_shape_is_valid_v1(_fact_value) THEN
    RETURN false;
  END IF;
  SELECT count(*)::integer INTO key_count FROM jsonb_object_keys(_fact_value);

  IF _fact_key = 'demographic.age_years' THEN
    IF key_count <> 5
       OR _fact_value ->> 'type' <> 'quantity'
       OR _fact_value ->> 'comparator' <> 'eq'
       OR _fact_value ->> 'unit_system' <> 'ucum'
       OR _fact_value ->> 'unit_code' <> 'a'
    THEN
      RETURN false;
    END IF;
    numeric_value := (_fact_value ->> 'value')::numeric;
    RETURN numeric_value BETWEEN 0 AND 130;
  ELSIF _fact_key = 'demographic.age_range' THEN
    RETURN key_count IN (3, 4)
      AND _fact_value ->> 'type' = 'coded'
      AND _fact_value ->> 'system' = 'local_v1'
      AND _fact_value ->> 'code' IN (
        'infant', 'child', 'adolescent', 'adult', 'older_adult', 'unknown'
      );
  ELSIF _fact_key = 'demographic.sex' THEN
    RETURN key_count IN (3, 4)
      AND _fact_value ->> 'type' = 'coded'
      AND _fact_value ->> 'system' = 'local_v1'
      AND _fact_value ->> 'code' IN (
        'female', 'male', 'diverse', 'intersex', 'unknown', 'not_stated'
      );
  ELSIF _fact_key = 'demographic.gender_identity' THEN
    RETURN key_count IN (3, 4)
      AND _fact_value ->> 'type' = 'coded'
      AND _fact_value ->> 'system' = 'local_v1'
      AND _fact_value ->> 'code' IN (
        'female', 'male', 'nonbinary', 'diverse', 'unknown', 'not_stated'
      );
  ELSIF _fact_key = 'demographic.pregnancy_status' THEN
    RETURN key_count IN (3, 4)
      AND _fact_value ->> 'type' = 'coded'
      AND _fact_value ->> 'system' = 'local_v1'
      AND _fact_value ->> 'code' IN (
        'pregnant', 'not_pregnant', 'unknown', 'not_applicable'
      );
  ELSIF _fact_key = 'demographic.menopause_status' THEN
    RETURN key_count IN (3, 4)
      AND _fact_value ->> 'type' = 'coded'
      AND _fact_value ->> 'system' = 'local_v1'
      AND _fact_value ->> 'code' IN (
        'premenopause', 'perimenopause', 'postmenopause', 'unknown',
        'not_applicable'
      );
  END IF;

  RETURN false;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

CREATE FUNCTION public.therapy_input_fact_pii_is_safe_v1(
  _fact_type text,
  _fact_key text,
  _fact_label text,
  _fact_value jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT
    (
      _fact_type <> 'demographic'
      OR public.therapy_input_demographic_fact_is_valid_v1(_fact_key, _fact_value)
    )
    AND _fact_key !~ '(^|[._:-])(name|firstname|vorname|lastname|nachname|fullname|patient|user|auth|session|anamnesis|birthday|birthdate|dob|geburtsdatum|geburtstag|phone|telefon|mobile|mobil|email|address|adresse|anschrift|street|strasse|postalcode|postleitzahl|insurance|versicherung|member|mitglied|account|konto|iban|path|file|filename|storage|archive|casenumber|caseid|fallnummer)([._:-]|$)'
    AND lower(regexp_replace(_fact_key, '[^a-z0-9]', '', 'g')) !~ '(firstname|lastname|fullname|patientname|patientid|patientenid|patientennummer|patientnumber|userid|username|authuserid|therapysessionid|sourcesessionid|sessionid|anamnesisid|birthday|birthdate|dateofbirth|birthplace|geburtstag|geburtsdatum|geburtsort|phonenumber|telefonnummer|mobilnummer|mobiltelefon|emailaddress|postalcode|postleitzahl|insuranceid|insurancenumber|versichertenid|versichertennummer|memberid|membershipnumber|mitgliedsnummer|accountid|accountnumber|kontonummer|filepath|filename|storagepath|archivepath|casenumber|caseid|fallnummer)'
    AND public.therapy_input_pii_text_is_safe_v1(_fact_key)
    AND public.therapy_input_pii_text_is_safe_v1(_fact_label)
    AND public.therapy_input_pii_jsonb_is_safe_v1(_fact_value)
    AND public.therapy_input_pii_text_is_safe_v1(
      _fact_label || ': ' || concat_ws(
        ' ',
        _fact_value ->> 'value',
        _fact_value ->> 'code',
        _fact_value ->> 'display'
      )
    )
    AND (
      _fact_label || ': ' || concat_ws(
        ' ',
        _fact_value ->> 'value',
        _fact_value ->> 'code',
        _fact_value ->> 'display'
      )
    ) !~* '\m(birthday|birth[ -]?date|date[ -]?of[ -]?birth|geburtstag|geburtsdatum)\M[[:space:]]*[:.]?[[:space:]]*[[:digit:]]{1,4}[./-][[:digit:]]{1,2}[./-][[:digit:]]{1,4}'
    AND concat_ws(
      ' ',
      _fact_value ->> 'value',
      _fact_value ->> 'code',
      _fact_value ->> 'display'
    ) !~* '\m[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\M'
$$;

CREATE FUNCTION public.therapy_input_fact_locator_is_safe_v1(_locator text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT
    octet_length(_locator) BETWEEN 1 AND 4096
    AND _locator ~ '^(page|section|paragraph|time|table|field|line|cell):[a-z0-9][a-z0-9_:+-]{0,127}$'
    AND public.therapy_input_pii_text_is_safe_v1(_locator)
    AND _locator !~* '(^|[:._+-])(name|firstname|vorname|lastname|nachname|fullname|patient|user|auth|session|anamnesis|birthday|birthdate|dob|geburtsdatum|geburtstag|phone|telefon|mobile|mobil|email|address|adresse|anschrift|street|strasse|postalcode|postleitzahl|insurance|versicherung|member|mitglied|account|konto|iban|path|file|filename|storage|archive|casenumber|caseid|fallnummer)([:._+-]|$)'
    AND lower(regexp_replace(_locator, '[^a-z0-9]', '', 'g')) !~ '(firstname|lastname|fullname|patientname|patientid|patientenid|patientennummer|patientnumber|userid|username|authuserid|therapysessionid|sourcesessionid|sessionid|anamnesisid|birthday|birthdate|dateofbirth|birthplace|geburtstag|geburtsdatum|geburtsort|phonenumber|telefonnummer|mobilnummer|mobiltelefon|emailaddress|postalcode|postleitzahl|insuranceid|insurancenumber|versichertenid|versichertennummer|memberid|membershipnumber|mitgliedsnummer|accountid|accountnumber|kontonummer|filepath|filename|storagepath|archivepath|casenumber|caseid|fallnummer)'
    AND _locator !~ '[[:digit:]]{4}-[[:digit:]]{2}-[[:digit:]]{2}'
    AND _locator !~ '[[:digit:]]{1,2}[.][[:digit:]]{1,2}[.][[:digit:]]{2,4}'
    AND _locator !~* '\m[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\M'
$$;

CREATE TABLE public.therapy_input_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapy_input_revision_id uuid NOT NULL,
  fact_order integer NOT NULL CHECK (fact_order BETWEEN 1 AND 2048),
  fact_schema_version integer NOT NULL DEFAULT 1
    CHECK (fact_schema_version = 1),
  hash_schema_version integer NOT NULL DEFAULT 1
    CHECK (hash_schema_version = 1),
  fact_type text NOT NULL
    CHECK (fact_type IN (
      'demographic',
      'symptom',
      'condition',
      'medication',
      'allergy',
      'prior_treatment',
      'procedure',
      'laboratory_observation',
      'microbiome_observation',
      'examination_finding',
      'family_social_history',
      'lifestyle_exposure',
      'immunization',
      'therapy_goal',
      'safety_flag',
      'open_question'
    )),
  fact_key text NOT NULL
    CHECK (
      octet_length(fact_key) BETWEEN 1 AND 256
      AND fact_key ~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'
      AND fact_key !~ '(^|[._:-])(date_of_birth|birth_date|dob)([._:-]|$)'
      AND public.therapy_input_pii_text_is_safe_v1(fact_key)
    ),
  fact_label text NOT NULL
    CHECK (
      btrim(fact_label) <> ''
      AND octet_length(fact_label) <= 512
      AND public.therapy_input_pii_text_is_safe_v1(fact_label)
    ),
  fact_value jsonb NOT NULL
    CHECK (
      jsonb_typeof(fact_value) = 'object'
      AND octet_length(fact_value::text) <= 16384
      AND public.therapy_input_fact_value_shape_is_valid_v1(fact_value)
    ),
  is_negated boolean NOT NULL,
  clinical_status text NOT NULL
    CHECK (clinical_status IN (
      'current', 'historical', 'resolved', 'planned', 'unknown', 'not_applicable'
    )),
  certainty text NOT NULL
    CHECK (certainty IN (
      'confirmed', 'probable', 'possible', 'uncertain', 'not_applicable'
    )),
  extraction_confidence text NOT NULL
    CHECK (extraction_confidence IN ('high', 'medium', 'low', 'not_assessed')),
  extraction_method text NOT NULL
    CHECK (extraction_method IN ('manual', 'deterministic', 'ai_assisted')),
  review_status text NOT NULL DEFAULT 'unreviewed'
    CHECK (review_status IN ('unreviewed', 'review_only', 'verified', 'rejected')),
  evidence_scope text NOT NULL
    CHECK (evidence_scope IN (
      'patient_report',
      'practitioner_observation',
      'clinical_document',
      'conventional_measurement',
      'complementary_measurement',
      'administrative_record'
    )),
  effective_start_date date,
  effective_end_date date,
  effective_date_precision text NOT NULL DEFAULT 'unknown'
    CHECK (effective_date_precision IN ('unknown', 'day', 'month', 'year', 'range')),
  kb_entity_id uuid,
  source_count integer NOT NULL CHECK (source_count BETWEEN 1 AND 64),
  supersedes_fact_id uuid,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  extracted_by uuid NOT NULL,
  reviewed_at timestamptz,
  reviewed_by uuid,
  content_sha256 text NOT NULL
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT therapy_input_facts_revision_order_key
    UNIQUE (therapy_input_revision_id, fact_order),
  CONSTRAINT therapy_input_facts_revision_id_key
    UNIQUE (therapy_input_revision_id, id),
  CONSTRAINT therapy_input_facts_revision_fk
    FOREIGN KEY (therapy_input_revision_id)
    REFERENCES public.therapy_input_revisions(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT therapy_input_facts_kb_entity_fk
    FOREIGN KEY (kb_entity_id)
    REFERENCES public.kb_entities(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT therapy_input_facts_supersedes_fk
    FOREIGN KEY (therapy_input_revision_id, supersedes_fact_id)
    REFERENCES public.therapy_input_facts(therapy_input_revision_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT therapy_input_facts_effective_date_check
    CHECK (
      (effective_date_precision = 'unknown'
        AND effective_start_date IS NULL
        AND effective_end_date IS NULL)
      OR (effective_date_precision = 'day'
        AND effective_start_date IS NOT NULL
        AND effective_end_date IS NULL)
      OR (effective_date_precision = 'month'
        AND effective_start_date IS NOT NULL
        AND effective_end_date IS NULL
        AND extract(day FROM effective_start_date) = 1)
      OR (effective_date_precision = 'year'
        AND effective_start_date IS NOT NULL
        AND effective_end_date IS NULL
        AND extract(month FROM effective_start_date) = 1
        AND extract(day FROM effective_start_date) = 1)
      OR (effective_date_precision = 'range'
        AND effective_start_date IS NOT NULL
        AND effective_end_date IS NOT NULL
        AND effective_end_date >= effective_start_date)
    ),
  CONSTRAINT therapy_input_facts_reviewer_pair_check
    CHECK ((reviewed_at IS NULL) = (reviewed_by IS NULL)),
  CONSTRAINT therapy_input_facts_review_time_check
    CHECK (reviewed_at IS NULL OR reviewed_at >= extracted_at),
  CONSTRAINT therapy_input_facts_pii_check
    CHECK (public.therapy_input_fact_pii_is_safe_v1(
      fact_type,
      fact_key,
      fact_label,
      fact_value
    )),
  CONSTRAINT therapy_input_facts_verified_check
    CHECK (
      (
        review_status NOT IN ('verified', 'rejected')
        OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
      )
      AND (review_status <> 'verified' OR extraction_method = 'manual')
    )
);

CREATE TABLE public.therapy_input_fact_sources (
  therapy_input_revision_id uuid NOT NULL,
  therapy_input_fact_id uuid NOT NULL,
  link_order integer NOT NULL CHECK (link_order BETWEEN 1 AND 64),
  source_order integer NOT NULL CHECK (source_order BETWEEN 1 AND 64),
  fact_locator text NOT NULL
    CHECK (public.therapy_input_fact_locator_is_safe_v1(fact_locator)),
  source_role text NOT NULL
    CHECK (source_role IN ('primary', 'supporting', 'contradicting', 'context')),
  CONSTRAINT therapy_input_fact_sources_pkey
    PRIMARY KEY (therapy_input_revision_id, therapy_input_fact_id, link_order),
  CONSTRAINT therapy_input_fact_sources_fact_source_key
    UNIQUE (therapy_input_revision_id, therapy_input_fact_id, source_order),
  CONSTRAINT therapy_input_fact_sources_fact_fk
    FOREIGN KEY (therapy_input_revision_id, therapy_input_fact_id)
    REFERENCES public.therapy_input_facts(therapy_input_revision_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT therapy_input_fact_sources_source_fk
    FOREIGN KEY (therapy_input_revision_id, source_order)
    REFERENCES public.therapy_input_sources(therapy_input_revision_id, source_order)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX therapy_input_facts_one_successor_idx
  ON public.therapy_input_facts(supersedes_fact_id)
  WHERE supersedes_fact_id IS NOT NULL;

CREATE INDEX therapy_input_facts_revision_idx
  ON public.therapy_input_facts(therapy_input_revision_id, fact_order, id);

CREATE INDEX therapy_input_facts_kb_entity_idx
  ON public.therapy_input_facts(kb_entity_id)
  WHERE kb_entity_id IS NOT NULL;

CREATE INDEX therapy_input_fact_sources_source_idx
  ON public.therapy_input_fact_sources(therapy_input_revision_id, source_order);

COMMENT ON COLUMN public.therapy_input_facts.supersedes_fact_id IS
  'Extraction or review correction lineage only; clinical change over time is not modeled here.';

CREATE FUNCTION public.therapy_input_timestamptz_utc_microseconds_v1(
  _value timestamptz
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT to_char(
    _value AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  )
$$;

CREATE FUNCTION public.therapy_input_fact_source_manifest_v1(
  _therapy_input_fact_id uuid
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
        'link_order', fact_source.link_order,
        'source_order', source.source_order,
        'neutral_source_id', source.neutral_source_id,
        'source_type', source.source_type,
        'document_date', source.document_date,
        'source_locator', source.source_locator,
        'fact_locator', fact_source.fact_locator,
        'content_sha256', source.content_sha256,
        'source_role', fact_source.source_role
      ) ORDER BY fact_source.link_order, source.source_order
    ),
    '[]'::jsonb
  )
    FROM public.therapy_input_fact_sources fact_source
    JOIN public.therapy_input_sources source
      ON source.therapy_input_revision_id = fact_source.therapy_input_revision_id
     AND source.source_order = fact_source.source_order
   WHERE fact_source.therapy_input_fact_id = _therapy_input_fact_id
$$;

CREATE FUNCTION public.therapy_input_fact_hash_payload_v1(
  _therapy_input_fact_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'therapy_input_revision_id', fact.therapy_input_revision_id,
    'therapy_input_revision_sha256', revision.content_sha256,
    'envelope_schema_version', revision.envelope_schema_version,
    'revision_hash_schema_version', revision.hash_schema_version,
    'deidentification_version', revision.deidentification_version,
    'fact_schema_version', fact.fact_schema_version,
    'hash_schema_version', fact.hash_schema_version,
    'fact_id', fact.id,
    'fact_order', fact.fact_order,
    'fact_type', fact.fact_type,
    'fact_key', fact.fact_key,
    'fact_label', fact.fact_label,
    'fact_value', fact.fact_value,
    'is_negated', fact.is_negated,
    'clinical_status', fact.clinical_status,
    'certainty', fact.certainty,
    'extraction_confidence', fact.extraction_confidence,
    'extraction_method', fact.extraction_method,
    'review_status', fact.review_status,
    'evidence_scope', fact.evidence_scope,
    'effective_start_date', CASE
      WHEN fact.effective_start_date IS NULL THEN NULL
      ELSE to_char(fact.effective_start_date, 'YYYY-MM-DD')
    END,
    'effective_end_date', CASE
      WHEN fact.effective_end_date IS NULL THEN NULL
      ELSE to_char(fact.effective_end_date, 'YYYY-MM-DD')
    END,
    'effective_date_precision', fact.effective_date_precision,
    'kb_entity_id', fact.kb_entity_id,
    'source_count', fact.source_count,
    'supersedes_fact_id', fact.supersedes_fact_id,
    'extracted_at', public.therapy_input_timestamptz_utc_microseconds_v1(
      fact.extracted_at
    ),
    'extracted_by', fact.extracted_by,
    'reviewed_at', public.therapy_input_timestamptz_utc_microseconds_v1(
      fact.reviewed_at
    ),
    'reviewed_by', fact.reviewed_by,
    'sources', public.therapy_input_fact_source_manifest_v1(fact.id)
  )
    FROM public.therapy_input_facts fact
    JOIN public.therapy_input_revisions revision
      ON revision.id = fact.therapy_input_revision_id
   WHERE fact.id = _therapy_input_fact_id
$$;

CREATE FUNCTION public.therapy_input_fact_sha256_v1(
  _therapy_input_fact_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.therapy_input_jsonb_sha256_v1(
    public.therapy_input_fact_hash_payload_v1(_therapy_input_fact_id)
  )
$$;

CREATE FUNCTION public.therapy_input_fact_revision_bytes_v1(
  _therapy_input_revision_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT sum(octet_length(to_jsonb(fact)::text))
        FROM public.therapy_input_facts fact
       WHERE fact.therapy_input_revision_id = _therapy_input_revision_id
    ), 0)::bigint
    +
    COALESCE((
      SELECT sum(octet_length(to_jsonb(fact_source)::text))
        FROM public.therapy_input_fact_sources fact_source
       WHERE fact_source.therapy_input_revision_id = _therapy_input_revision_id
    ), 0)::bigint
$$;

CREATE FUNCTION public.therapy_input_fact_is_valid_v1(
  _therapy_input_fact_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  fact public.therapy_input_facts%ROWTYPE;
  predecessor public.therapy_input_facts%ROWTYPE;
  link_count integer;
  minimum_link_order integer;
  maximum_link_order integer;
  has_primary_link boolean;
  has_complementary_link boolean;
  has_external_research_link boolean;
BEGIN
  SELECT stored_fact.*
    INTO fact
    FROM public.therapy_input_facts stored_fact
   WHERE stored_fact.id = _therapy_input_fact_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
       SELECT 1
         FROM public.therapy_input_revisions revision
        WHERE revision.id = fact.therapy_input_revision_id
     )
     OR NOT public.therapy_input_revision_is_valid_v1(fact.therapy_input_revision_id)
     OR fact.fact_order NOT BETWEEN 1 AND 2048
     OR fact.fact_schema_version <> 1
     OR fact.hash_schema_version <> 1
     OR fact.fact_type NOT IN (
       'demographic',
       'symptom',
       'condition',
       'medication',
       'allergy',
       'prior_treatment',
       'procedure',
       'laboratory_observation',
       'microbiome_observation',
       'examination_finding',
       'family_social_history',
       'lifestyle_exposure',
       'immunization',
       'therapy_goal',
       'safety_flag',
       'open_question'
     )
     OR octet_length(fact.fact_key) NOT BETWEEN 1 AND 256
     OR fact.fact_key !~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'
     OR fact.fact_key ~ '(^|[._:-])(date_of_birth|birth_date|dob)([._:-]|$)'
     OR NOT public.therapy_input_pii_text_is_safe_v1(fact.fact_key)
     OR btrim(fact.fact_label) = ''
     OR octet_length(fact.fact_label) > 512
     OR NOT public.therapy_input_pii_text_is_safe_v1(fact.fact_label)
     OR jsonb_typeof(fact.fact_value) IS DISTINCT FROM 'object'
     OR octet_length(fact.fact_value::text) > 16384
      OR NOT public.therapy_input_fact_value_shape_is_valid_v1(fact.fact_value)
      OR NOT public.therapy_input_fact_pii_is_safe_v1(
        fact.fact_type,
        fact.fact_key,
        fact.fact_label,
        fact.fact_value
      )
     OR fact.clinical_status NOT IN (
       'current', 'historical', 'resolved', 'planned', 'unknown', 'not_applicable'
     )
     OR fact.certainty NOT IN (
       'confirmed', 'probable', 'possible', 'uncertain', 'not_applicable'
     )
     OR fact.extraction_confidence NOT IN ('high', 'medium', 'low', 'not_assessed')
     OR fact.extraction_method NOT IN ('manual', 'deterministic', 'ai_assisted')
     OR fact.review_status NOT IN ('unreviewed', 'review_only', 'verified', 'rejected')
     OR fact.evidence_scope NOT IN (
       'patient_report',
       'practitioner_observation',
       'clinical_document',
       'conventional_measurement',
       'complementary_measurement',
       'administrative_record'
     )
     OR fact.effective_date_precision NOT IN ('unknown', 'day', 'month', 'year', 'range')
     OR NOT (
       (fact.effective_date_precision = 'unknown'
         AND fact.effective_start_date IS NULL
         AND fact.effective_end_date IS NULL)
       OR (fact.effective_date_precision = 'day'
         AND fact.effective_start_date IS NOT NULL
         AND fact.effective_end_date IS NULL)
       OR (fact.effective_date_precision = 'month'
         AND fact.effective_start_date IS NOT NULL
         AND fact.effective_end_date IS NULL
         AND extract(day FROM fact.effective_start_date) = 1)
       OR (fact.effective_date_precision = 'year'
         AND fact.effective_start_date IS NOT NULL
         AND fact.effective_end_date IS NULL
         AND extract(month FROM fact.effective_start_date) = 1
         AND extract(day FROM fact.effective_start_date) = 1)
       OR (fact.effective_date_precision = 'range'
         AND fact.effective_start_date IS NOT NULL
         AND fact.effective_end_date IS NOT NULL
         AND fact.effective_end_date >= fact.effective_start_date)
     )
     OR fact.source_count NOT BETWEEN 1 AND 64
     OR fact.content_sha256 !~ '^[0-9a-f]{64}$'
     OR (fact.reviewed_at IS NULL) <> (fact.reviewed_by IS NULL)
     OR (fact.reviewed_at IS NOT NULL AND fact.reviewed_at < fact.extracted_at)
     OR (
       fact.review_status IN ('verified', 'rejected')
       AND (fact.reviewed_at IS NULL OR fact.reviewed_by IS NULL)
     )
     OR (
       fact.review_status = 'verified'
       AND fact.extraction_method <> 'manual'
     )
  THEN
    RETURN false;
  END IF;

  IF fact.kb_entity_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.kb_entities entity WHERE entity.id = fact.kb_entity_id
  ) THEN
    RETURN false;
  END IF;

  IF fact.supersedes_fact_id IS NOT NULL THEN
    SELECT stored_predecessor.*
      INTO predecessor
      FROM public.therapy_input_facts stored_predecessor
     WHERE stored_predecessor.id = fact.supersedes_fact_id;
    IF NOT FOUND
       OR predecessor.therapy_input_revision_id <> fact.therapy_input_revision_id
       OR predecessor.fact_order >= fact.fact_order
       OR predecessor.fact_type <> fact.fact_type
       OR predecessor.fact_key <> fact.fact_key
       OR predecessor.extracted_at > fact.extracted_at
       OR fact.review_status = 'rejected'
       OR (
         predecessor.review_status = 'verified'
         AND fact.review_status <> 'verified'
       )
       OR (
         predecessor.review_status = 'review_only'
         AND fact.review_status NOT IN ('review_only', 'verified')
       )
    THEN
      RETURN false;
    END IF;

    IF 1 < (
      SELECT count(*)
        FROM public.therapy_input_facts successor
       WHERE successor.supersedes_fact_id = fact.supersedes_fact_id
    ) THEN
      RETURN false;
    END IF;
  END IF;

  IF 1 < (
    SELECT count(*)
      FROM public.therapy_input_facts successor
     WHERE successor.supersedes_fact_id = fact.id
  ) THEN
    RETURN false;
  END IF;

  SELECT count(*)::integer,
         min(fact_source.link_order),
         max(fact_source.link_order),
         COALESCE(bool_or(fact_source.source_role = 'primary'), false),
         COALESCE(bool_or(source.source_type IN (
           'complementary_measurement', 'vieva_plus'
         )), false),
         COALESCE(bool_or(source.source_type = 'external_research'), false)
    INTO link_count,
         minimum_link_order,
         maximum_link_order,
         has_primary_link,
         has_complementary_link,
         has_external_research_link
    FROM public.therapy_input_fact_sources fact_source
    LEFT JOIN public.therapy_input_sources source
      ON source.therapy_input_revision_id = fact_source.therapy_input_revision_id
     AND source.source_order = fact_source.source_order
   WHERE fact_source.therapy_input_fact_id = fact.id;

  IF link_count <> fact.source_count
     OR minimum_link_order <> 1
     OR maximum_link_order <> fact.source_count
     OR NOT has_primary_link
     OR has_external_research_link
     OR has_complementary_link <> (
       fact.evidence_scope = 'complementary_measurement'
     )
     OR (
       has_complementary_link
       AND (
         fact.fact_type NOT IN ('examination_finding', 'open_question')
         OR fact.certainty NOT IN ('possible', 'uncertain', 'not_applicable')
          OR fact.review_status NOT IN ('review_only', 'rejected')
         OR fact.kb_entity_id IS NOT NULL
       )
     )
     OR EXISTS (
       SELECT 1
         FROM public.therapy_input_fact_sources fact_source
         LEFT JOIN public.therapy_input_sources source
           ON source.therapy_input_revision_id = fact_source.therapy_input_revision_id
          AND source.source_order = fact_source.source_order
         LEFT JOIN public.therapy_input_revisions revision
           ON revision.id = fact_source.therapy_input_revision_id
        WHERE fact_source.therapy_input_fact_id = fact.id
          AND (
            fact_source.therapy_input_revision_id <> fact.therapy_input_revision_id
            OR fact_source.link_order NOT BETWEEN 1 AND 64
            OR fact_source.source_order NOT BETWEEN 1 AND 64
            OR NOT public.therapy_input_fact_locator_is_safe_v1(
              fact_source.fact_locator
            )
            OR fact_source.source_role NOT IN (
              'primary', 'supporting', 'contradicting', 'context'
            )
            OR source.id IS NULL
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
  THEN
    RETURN false;
  END IF;

  IF 2048 < (
       SELECT count(*)
         FROM public.therapy_input_facts revision_fact
        WHERE revision_fact.therapy_input_revision_id = fact.therapy_input_revision_id
     )
     OR public.therapy_input_fact_revision_bytes_v1(fact.therapy_input_revision_id) > 8388608
     OR fact.content_sha256 IS DISTINCT FROM public.therapy_input_fact_sha256_v1(fact.id)
  THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE FUNCTION public.therapy_input_invalid_fact_count_v1()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)
       FROM public.therapy_input_facts fact
      WHERE NOT public.therapy_input_fact_is_valid_v1(fact.id))
    +
    (SELECT count(*)
       FROM public.therapy_input_fact_sources fact_source
      WHERE NOT EXISTS (
        SELECT 1
          FROM public.therapy_input_facts fact
         WHERE fact.id = fact_source.therapy_input_fact_id
           AND fact.therapy_input_revision_id = fact_source.therapy_input_revision_id
      ))
$$;

CREATE FUNCTION public.therapy_input_export_snapshot_v2()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  snapshot_v1 jsonb;
  fact_rows bigint;
  fact_source_rows bigint;
  fact_rows_text text;
  fact_source_rows_text text;
  fact_rows_sha256 text;
  fact_source_rows_sha256 text;
BEGIN
  snapshot_v1 := public.therapy_input_export_snapshot_v1()::jsonb;

  SELECT count(*)::bigint,
         COALESCE(
           jsonb_agg(
             to_jsonb(fact)
             ORDER BY fact.therapy_input_revision_id, fact.fact_order, fact.id
           ),
           '[]'::jsonb
         )::text
    INTO fact_rows, fact_rows_text
    FROM public.therapy_input_facts fact;

  SELECT count(*)::bigint,
         COALESCE(
           jsonb_agg(
             to_jsonb(fact_source)
             ORDER BY
               fact_source.therapy_input_revision_id,
               fact_source.therapy_input_fact_id,
               fact_source.link_order,
               fact_source.source_order
           ),
           '[]'::jsonb
         )::text
    INTO fact_source_rows, fact_source_rows_text
    FROM public.therapy_input_fact_sources fact_source;

  fact_rows_sha256 := encode(
    sha256(convert_to(fact_rows_text, 'UTF8')),
    'hex'
  );
  fact_source_rows_sha256 := encode(
    sha256(convert_to(fact_source_rows_text, 'UTF8')),
    'hex'
  );

  RETURN jsonb_build_object(
    'snapshot_version', 2,
    'tables',
      (snapshot_v1 -> 'tables') || jsonb_build_object(
        'therapy_input_facts', fact_rows_text,
        'therapy_input_fact_sources', fact_source_rows_text
      ),
    'manifest',
      (snapshot_v1 -> 'manifest') || jsonb_build_object(
        'therapy_input_facts', jsonb_build_object(
          'rows', fact_rows,
          'sha256', fact_rows_sha256
        ),
        'therapy_input_fact_sources', jsonb_build_object(
          'rows', fact_source_rows,
          'sha256', fact_source_rows_sha256
        )
      ),
    'validation', jsonb_build_object(
      'invalid_revision_count',
        (snapshot_v1 #>> '{validation,invalid_revision_count}')::bigint,
      'invalid_fact_count', public.therapy_input_invalid_fact_count_v1()
    )
  )::text;
END;
$$;

CREATE FUNCTION public.therapy_input_protect_fact_append_only_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Therapy input facts and source links are append-only';
END;
$$;

CREATE FUNCTION public.therapy_input_lock_fact_revision_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM 1
    FROM public.therapy_input_revisions revision
   WHERE revision.id = NEW.therapy_input_revision_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Therapy input fact revision does not exist';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.therapy_input_validate_fact_graph_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  fact_id uuid;
BEGIN
  fact_id := CASE
    WHEN TG_TABLE_NAME = 'therapy_input_facts'
      THEN (to_jsonb(NEW) ->> 'id')::uuid
    ELSE (to_jsonb(NEW) ->> 'therapy_input_fact_id')::uuid
  END;

  IF NOT public.therapy_input_fact_is_valid_v1(fact_id) THEN
    RAISE EXCEPTION 'Therapy input fact integrity check failed';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER therapy_input_facts_append_only
  BEFORE UPDATE OR DELETE ON public.therapy_input_facts
  FOR EACH ROW EXECUTE FUNCTION public.therapy_input_protect_fact_append_only_v1();

CREATE TRIGGER therapy_input_facts_lock_revision
  BEFORE INSERT ON public.therapy_input_facts
  FOR EACH ROW EXECUTE FUNCTION public.therapy_input_lock_fact_revision_v1();

CREATE TRIGGER therapy_input_fact_sources_lock_revision
  BEFORE INSERT ON public.therapy_input_fact_sources
  FOR EACH ROW EXECUTE FUNCTION public.therapy_input_lock_fact_revision_v1();

CREATE TRIGGER therapy_input_fact_sources_append_only
  BEFORE UPDATE OR DELETE ON public.therapy_input_fact_sources
  FOR EACH ROW EXECUTE FUNCTION public.therapy_input_protect_fact_append_only_v1();

CREATE TRIGGER therapy_input_facts_no_truncate
  BEFORE TRUNCATE ON public.therapy_input_facts
  FOR EACH STATEMENT EXECUTE FUNCTION public.therapy_input_protect_fact_append_only_v1();

CREATE TRIGGER therapy_input_fact_sources_no_truncate
  BEFORE TRUNCATE ON public.therapy_input_fact_sources
  FOR EACH STATEMENT EXECUTE FUNCTION public.therapy_input_protect_fact_append_only_v1();

CREATE CONSTRAINT TRIGGER therapy_input_facts_validate_insert
  AFTER INSERT ON public.therapy_input_facts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.therapy_input_validate_fact_graph_v1();

CREATE CONSTRAINT TRIGGER therapy_input_fact_sources_validate_insert
  AFTER INSERT ON public.therapy_input_fact_sources
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.therapy_input_validate_fact_graph_v1();

ALTER TABLE public.therapy_input_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_input_fact_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY therapy_input_facts_admin_read
  ON public.therapy_input_facts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY therapy_input_fact_sources_admin_read
  ON public.therapy_input_fact_sources
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE
  public.therapy_input_facts,
  public.therapy_input_fact_sources
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

GRANT SELECT ON TABLE
  public.therapy_input_facts,
  public.therapy_input_fact_sources
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.therapy_input_fact_value_shape_is_valid_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_demographic_fact_is_valid_v1(text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_fact_pii_is_safe_v1(text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_fact_locator_is_safe_v1(text)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_timestamptz_utc_microseconds_v1(timestamptz)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_fact_source_manifest_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_fact_hash_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_fact_sha256_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_fact_revision_bytes_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_fact_is_valid_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_invalid_fact_count_v1()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_export_snapshot_v2()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_protect_fact_append_only_v1()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_lock_fact_revision_v1()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_validate_fact_graph_v1()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

GRANT EXECUTE ON FUNCTION public.therapy_input_export_snapshot_v2()
  TO service_role;

COMMIT;
