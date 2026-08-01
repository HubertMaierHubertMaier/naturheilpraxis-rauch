BEGIN;

DO $$
DECLARE
  expected_wiki_tables text[] := ARRAY[
    'admin_knowledge_base',
    'faqs',
    'kb_article_entities',
    'kb_article_revisions',
    'kb_articles',
    'kb_assertion_sources',
    'kb_assertions',
    'kb_botanical_revision_details',
    'kb_change_proposals',
    'kb_composition_components',
    'kb_dosage_candidates',
    'kb_entities',
    'kb_entity_candidate_assertion_sources',
    'kb_entity_candidate_assertions',
    'kb_entity_candidate_botanical_details',
    'kb_entity_candidate_components',
    'kb_entity_candidate_contracts',
    'kb_entity_candidate_draft_promotion_assertions',
    'kb_entity_candidate_draft_promotions',
    'kb_entity_candidate_homeopathic_details',
    'kb_entity_candidate_names',
    'kb_entity_candidate_nutrient_details',
    'kb_entity_candidate_preparation_details',
    'kb_entity_candidate_product_variant_details',
    'kb_entity_candidates',
    'kb_entity_identifiers',
    'kb_entity_names',
    'kb_entity_relations',
    'kb_entity_revisions',
    'kb_entity_types',
    'kb_homeopathic_revision_details',
    'kb_identifier_schemes',
    'kb_import_batches',
    'kb_import_errors',
    'kb_nutrient_revision_details',
    'kb_preparation_revision_details',
    'kb_product_variant_revision_details',
    'kb_relation_candidates',
    'kb_relation_type_domains',
    'kb_relation_types',
    'kb_release_items',
    'kb_releases',
    'kb_review_decisions',
    'kb_safety_candidates',
    'kb_source_candidate_draft_promotions',
    'kb_source_candidates',
    'kb_source_revisions',
    'kb_sources',
    'knowledge_product_links',
    'mannayan_products',
    'practice_info',
    'practice_pricing'
  ]::text[];
  actual_wiki_tables text[];
BEGIN
  IF to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_therapeutic_revision_is_valid(uuid,uuid)') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Clinical rules require the complete 52-table Wiki contract';
  END IF;

  SELECT array_agg(tables.tablename COLLATE "C" ORDER BY tables.tablename COLLATE "C")
    INTO actual_wiki_tables
    FROM pg_catalog.pg_tables tables
   WHERE tables.schemaname = 'public'
     AND (
       tables.tablename = ANY(ARRAY[
         'admin_knowledge_base',
         'mannayan_products',
         'knowledge_product_links',
         'faqs',
         'practice_pricing',
         'practice_info'
       ]::text[])
       OR tables.tablename LIKE 'kb\_%' ESCAPE '\'
     );

  IF actual_wiki_tables IS DISTINCT FROM expected_wiki_tables THEN
    RAISE EXCEPTION 'Clinical rules require the exact 52-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_assertions assertion
     WHERE assertion.assertion_kind IN ('dosage', 'safety')
  ) THEN
    RAISE EXCEPTION 'Schema-only clinical rules require no pre-existing dosage or safety assertions';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_clinical_rule_code_array_is_valid_v1(_values text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT cardinality(_values) BETWEEN 1 AND 256
     AND public.kb_text_array_is_canonical(_values)
     AND NOT EXISTS (
       SELECT 1
         FROM unnest(_values) item(value)
        WHERE octet_length(item.value) NOT BETWEEN 1 AND 128
           OR item.value !~ '^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,127}$'
     )
$$;

CREATE TABLE public.kb_dosage_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_schema_version integer NOT NULL DEFAULT 1
    CHECK (rule_schema_version = 1),
  assertion_id uuid NOT NULL UNIQUE
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  subject_entity_id uuid NOT NULL,
  subject_entity_revision_id uuid NOT NULL,
  indication_entity_id uuid,
  indication_entity_revision_id uuid,
  population_entity_id uuid,
  population_entity_revision_id uuid,
  administration_route text NOT NULL
    CHECK (administration_route IN (
      'oral', 'sublingual', 'buccal', 'topical', 'inhaled', 'nasal',
      'rectal', 'vaginal', 'parenteral', 'other'
    )),
  dose_min numeric(18, 6) NOT NULL CHECK (dose_min > 0 AND dose_min < 1e12),
  dose_max numeric(18, 6) NOT NULL CHECK (dose_max >= dose_min AND dose_max < 1e12),
  dose_unit_system text NOT NULL
    CHECK (dose_unit_system IN ('ucum', 'local_v1')),
  dose_unit_code text NOT NULL
    CHECK (octet_length(dose_unit_code) BETWEEN 1 AND 64),
  frequency_min numeric(10, 4) NOT NULL
    CHECK (frequency_min > 0 AND frequency_min < 1e6),
  frequency_max numeric(10, 4) NOT NULL
    CHECK (frequency_max >= frequency_min AND frequency_max < 1e6),
  frequency_period text NOT NULL
    CHECK (frequency_period IN ('hour', 'day', 'week', 'month', 'course')),
  duration_min numeric(12, 4) NOT NULL
    CHECK (duration_min > 0 AND duration_min < 1e8),
  duration_max numeric(12, 4) NOT NULL
    CHECK (duration_max >= duration_min AND duration_max < 1e8),
  duration_unit text NOT NULL
    CHECK (duration_unit IN ('minute', 'hour', 'day', 'week', 'month')),
  timing text NOT NULL DEFAULT 'unspecified'
    CHECK (timing IN (
      'unspecified', 'before_meal', 'with_meal', 'after_meal',
      'between_meals', 'morning', 'midday', 'evening', 'bedtime'
    )),
  rule_content_hash text NOT NULL
    CHECK (rule_content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (subject_entity_id, subject_entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (indication_entity_id, indication_entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (population_entity_id, population_entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CHECK ((indication_entity_id IS NULL) = (indication_entity_revision_id IS NULL)),
  CHECK ((population_entity_id IS NULL) = (population_entity_revision_id IS NULL)),
  CHECK (
    (dose_unit_system = 'ucum'
      AND dose_unit_code ~ '^[A-Za-z0-9%*/.^_{}()[\]+-]{1,64}$')
    OR (dose_unit_system = 'local_v1' AND dose_unit_code IN (
      'drop', 'globule', 'tablet', 'capsule', 'dose', 'ampoule',
      'sachet', 'spray', 'application'
    ))
  )
);

CREATE TABLE public.kb_safety_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_schema_version integer NOT NULL DEFAULT 1
    CHECK (rule_schema_version = 1),
  assertion_id uuid NOT NULL UNIQUE
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  subject_entity_id uuid NOT NULL,
  subject_entity_revision_id uuid NOT NULL,
  related_entity_id uuid,
  related_entity_revision_id uuid,
  rule_type text NOT NULL
    CHECK (rule_type IN (
      'contraindication', 'interaction', 'precaution', 'dose_adjustment',
      'adverse_effect', 'monitoring', 'pregnancy', 'breastfeeding', 'child',
      'renal_function', 'hepatic_function'
    )),
  severity text NOT NULL
    CHECK (severity IN ('information', 'caution', 'require_review', 'avoid')),
  effect text NOT NULL
    CHECK (effect IN ('allow_with_notice', 'review_only', 'exclude')),
  notice_text text NOT NULL
    CHECK (btrim(notice_text) <> '' AND octet_length(notice_text) <= 4096),
  rule_content_hash text NOT NULL
    CHECK (rule_content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (subject_entity_id, subject_entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (related_entity_id, related_entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CHECK ((related_entity_id IS NULL) = (related_entity_revision_id IS NULL)),
  CHECK ((rule_type = 'interaction') = (related_entity_revision_id IS NOT NULL)),
  CHECK (related_entity_id IS NULL OR related_entity_id <> subject_entity_id),
  CHECK (
    (severity = 'information' AND effect = 'allow_with_notice')
    OR (severity IN ('caution', 'require_review') AND effect = 'review_only')
    OR (severity = 'avoid' AND effect = 'exclude')
  )
);

CREATE TABLE public.kb_safety_rule_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  safety_rule_id uuid NOT NULL
    REFERENCES public.kb_safety_rules(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  condition_order integer NOT NULL CHECK (condition_order BETWEEN 1 AND 256),
  condition_kind text NOT NULL
    CHECK (condition_kind IN (
      'always', 'entity_present', 'fact_present', 'fact_missing',
      'coded_value_in', 'quantity_compare'
    )),
  condition_entity_id uuid,
  condition_entity_revision_id uuid,
  fact_type text
    CHECK (fact_type IS NULL OR fact_type IN (
      'demographic', 'symptom', 'condition', 'medication', 'allergy',
      'prior_treatment', 'procedure', 'laboratory_observation',
      'microbiome_observation', 'examination_finding', 'family_social_history',
      'lifestyle_exposure', 'immunization', 'therapy_goal', 'safety_flag',
      'open_question'
    )),
  fact_key text
    CHECK (
      fact_key IS NULL OR (
        octet_length(fact_key) BETWEEN 1 AND 256
        AND fact_key ~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'
        AND fact_key !~ '(^|[._:-])(patient|user|session|pseudonym|anamnesis)([._:-]|$)'
      )
    ),
  coded_system text
    CHECK (coded_system IS NULL OR coded_system IN (
      'local_v1', 'icd_10_gm', 'atc', 'loinc', 'ncbi_taxonomy',
      'pzn', 'gtin', 'program_code'
    )),
  coded_values text[],
  quantity_comparator text
    CHECK (quantity_comparator IS NULL OR quantity_comparator IN ('eq', 'lt', 'le', 'gt', 'ge')),
  quantity_value numeric,
  quantity_unit_system text
    CHECK (quantity_unit_system IS NULL OR quantity_unit_system IN ('ucum', 'unitless')),
  quantity_unit_code text
    CHECK (
      quantity_unit_code IS NULL OR (
        octet_length(quantity_unit_code) BETWEEN 1 AND 64
        AND quantity_unit_code ~ '^[A-Za-z0-9%*/.^_{}()[\]+-]{1,64}$'
      )
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (safety_rule_id, condition_order),
  FOREIGN KEY (condition_entity_id, condition_entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CHECK ((condition_entity_id IS NULL) = (condition_entity_revision_id IS NULL)),
  CHECK (
    quantity_value IS NULL
    OR quantity_value BETWEEN '-1e100'::numeric AND '1e100'::numeric
  ),
  CHECK (
    (condition_kind = 'always'
      AND condition_entity_revision_id IS NULL
      AND fact_type IS NULL AND fact_key IS NULL
      AND coded_system IS NULL AND coded_values IS NULL
      AND quantity_comparator IS NULL AND quantity_value IS NULL
      AND quantity_unit_system IS NULL AND quantity_unit_code IS NULL)
    OR (condition_kind = 'entity_present'
      AND condition_entity_revision_id IS NOT NULL
      AND fact_type IS NULL AND fact_key IS NULL
      AND coded_system IS NULL AND coded_values IS NULL
      AND quantity_comparator IS NULL AND quantity_value IS NULL
      AND quantity_unit_system IS NULL AND quantity_unit_code IS NULL)
    OR (condition_kind IN ('fact_present', 'fact_missing')
      AND condition_entity_revision_id IS NULL
      AND fact_type IS NOT NULL AND fact_key IS NOT NULL
      AND coded_system IS NULL AND coded_values IS NULL
      AND quantity_comparator IS NULL AND quantity_value IS NULL
      AND quantity_unit_system IS NULL AND quantity_unit_code IS NULL)
    OR (condition_kind = 'coded_value_in'
      AND condition_entity_revision_id IS NULL
      AND fact_type IS NOT NULL AND fact_key IS NOT NULL
      AND coded_system IS NOT NULL AND coded_values IS NOT NULL
      AND public.kb_clinical_rule_code_array_is_valid_v1(coded_values)
      AND quantity_comparator IS NULL AND quantity_value IS NULL
      AND quantity_unit_system IS NULL AND quantity_unit_code IS NULL)
    OR (condition_kind = 'quantity_compare'
      AND condition_entity_revision_id IS NULL
      AND fact_type IS NOT NULL AND fact_key IS NOT NULL
      AND coded_system IS NULL AND coded_values IS NULL
      AND quantity_comparator IS NOT NULL AND quantity_value IS NOT NULL
      AND quantity_unit_system IS NOT NULL AND quantity_unit_code IS NOT NULL
      AND (quantity_unit_system <> 'unitless' OR quantity_unit_code = '1'))
  )
);

CREATE INDEX kb_dosage_rules_subject_idx
  ON public.kb_dosage_rules(subject_entity_id, subject_entity_revision_id);
CREATE INDEX kb_dosage_rules_indication_idx
  ON public.kb_dosage_rules(indication_entity_id, indication_entity_revision_id)
  WHERE indication_entity_revision_id IS NOT NULL;
CREATE INDEX kb_dosage_rules_population_idx
  ON public.kb_dosage_rules(population_entity_id, population_entity_revision_id)
  WHERE population_entity_revision_id IS NOT NULL;
CREATE INDEX kb_safety_rules_subject_idx
  ON public.kb_safety_rules(subject_entity_id, subject_entity_revision_id);
CREATE INDEX kb_safety_rules_related_idx
  ON public.kb_safety_rules(related_entity_id, related_entity_revision_id)
  WHERE related_entity_revision_id IS NOT NULL;
CREATE INDEX kb_safety_rule_conditions_entity_idx
  ON public.kb_safety_rule_conditions(condition_entity_id, condition_entity_revision_id)
  WHERE condition_entity_revision_id IS NOT NULL;
CREATE INDEX kb_dosage_rules_subject_revision_idx
  ON public.kb_dosage_rules(subject_entity_revision_id);
CREATE INDEX kb_dosage_rules_indication_revision_idx
  ON public.kb_dosage_rules(indication_entity_revision_id)
  WHERE indication_entity_revision_id IS NOT NULL;
CREATE INDEX kb_dosage_rules_population_revision_idx
  ON public.kb_dosage_rules(population_entity_revision_id)
  WHERE population_entity_revision_id IS NOT NULL;
CREATE INDEX kb_safety_rules_subject_revision_idx
  ON public.kb_safety_rules(subject_entity_revision_id);
CREATE INDEX kb_safety_rules_related_revision_idx
  ON public.kb_safety_rules(related_entity_revision_id)
  WHERE related_entity_revision_id IS NOT NULL;
CREATE INDEX kb_safety_rule_conditions_revision_idx
  ON public.kb_safety_rule_conditions(condition_entity_revision_id)
  WHERE condition_entity_revision_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.kb_clinical_rule_dependency_status_is_valid_v1(
  _assertion_status text,
  _dependency_status text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _assertion_status = 'approved'
      THEN _dependency_status IN ('approved', 'released')
    WHEN _assertion_status = 'released'
      THEN _dependency_status = 'released'
    WHEN _assertion_status IN ('superseded', 'withdrawn')
      THEN _dependency_status IN ('released', 'superseded', 'withdrawn')
    ELSE _dependency_status NOT IN ('superseded', 'withdrawn')
  END
$$;

CREATE OR REPLACE FUNCTION public.kb_clinical_rule_sources_are_valid_v1(
  _assertion_id uuid,
  _assertion_status text
)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.kb_assertion_sources binding
      JOIN public.kb_source_revisions revision
        ON revision.id = binding.source_revision_id
     WHERE binding.assertion_id = _assertion_id
       AND binding.is_primary
       AND binding.source_role IN ('supports', 'qualifies')
       AND NULLIF(btrim(binding.locator), '') IS NOT NULL
       AND public.kb_clinical_rule_dependency_status_is_valid_v1(
             _assertion_status, revision.review_status
           )
  ) AND NOT EXISTS (
    SELECT 1
      FROM public.kb_assertion_sources binding
      LEFT JOIN public.kb_source_revisions revision
        ON revision.id = binding.source_revision_id
     WHERE binding.assertion_id = _assertion_id
       AND (
         revision.id IS NULL
         OR public.kb_clinical_rule_dependency_status_is_valid_v1(
              _assertion_status, revision.review_status
            ) IS DISTINCT FROM true
         OR (binding.is_primary AND NULLIF(btrim(binding.locator), '') IS NULL)
       )
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_clinical_rule_entity_revision_payload_v1(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'entity_id', entity.id,
    'entity_revision_id', revision.id,
    'entity_type_code', entity.entity_type_code,
    'canonical_key', entity.canonical_key,
    'revision_no', revision.revision_no,
    'content_hash', revision.content_hash
  )
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = _entity_revision_id
   WHERE entity.id = _entity_id
$$;

CREATE OR REPLACE FUNCTION public.kb_clinical_rule_assertion_payload_v1(_assertion_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'assertion_id', assertion.id,
    'canonical_key', assertion.canonical_key,
    'version_no', assertion.version_no,
    'assertion_kind', assertion.assertion_kind,
    'claim_text', assertion.claim_text,
    'origin_type', assertion.origin_type,
    'evidence_basis', assertion.evidence_basis,
    'evidence_quality', assertion.evidence_quality,
    'valid_from', assertion.valid_from,
    'valid_until', assertion.valid_until,
    'supersedes_assertion_id', assertion.supersedes_assertion_id,
    'content_hash', assertion.content_hash,
    'metadata_hash', public.kb_release_manifest_hash_v1(assertion.metadata),
    'sources', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'source_id', source.id,
        'source_revision_id', revision.id,
        'canonical_key', source.canonical_key,
        'revision_no', revision.revision_no,
        'content_hash', revision.content_hash,
        'source_role', binding.source_role,
        'locator', binding.locator,
        'original_quote', binding.original_quote,
        'is_primary', binding.is_primary
      ) ORDER BY
        revision.id,
        binding.source_role COLLATE "C",
        binding.locator COLLATE "C")
        FROM public.kb_assertion_sources binding
        JOIN public.kb_source_revisions revision
          ON revision.id = binding.source_revision_id
        JOIN public.kb_sources source ON source.id = revision.source_id
       WHERE binding.assertion_id = assertion.id
    ), '[]'::jsonb)
  )
    FROM public.kb_assertions assertion
   WHERE assertion.id = _assertion_id
$$;

CREATE OR REPLACE FUNCTION public.kb_dosage_rule_payload_v1(_rule_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'rule_schema_version', rule.rule_schema_version,
    'assertion', public.kb_clinical_rule_assertion_payload_v1(rule.assertion_id),
    'subject', public.kb_clinical_rule_entity_revision_payload_v1(
      rule.subject_entity_id, rule.subject_entity_revision_id
    ),
    'indication', CASE WHEN rule.indication_entity_revision_id IS NULL THEN NULL
      ELSE public.kb_clinical_rule_entity_revision_payload_v1(
        rule.indication_entity_id, rule.indication_entity_revision_id
      ) END,
    'population', CASE WHEN rule.population_entity_revision_id IS NULL THEN NULL
      ELSE public.kb_clinical_rule_entity_revision_payload_v1(
        rule.population_entity_id, rule.population_entity_revision_id
      ) END,
    'dose', jsonb_build_object(
      'minimum', rule.dose_min,
      'maximum', rule.dose_max,
      'unit_system', rule.dose_unit_system,
      'unit_code', rule.dose_unit_code
    ),
    'frequency', jsonb_build_object(
      'minimum', rule.frequency_min,
      'maximum', rule.frequency_max,
      'period', rule.frequency_period
    ),
    'duration', jsonb_build_object(
      'minimum', rule.duration_min,
      'maximum', rule.duration_max,
      'unit', rule.duration_unit
    ),
    'timing', rule.timing,
    'administration_route', rule.administration_route
  ))
    FROM public.kb_dosage_rules rule
   WHERE rule.id = _rule_id
$$;

CREATE OR REPLACE FUNCTION public.kb_dosage_rule_hash_v1(_rule_id uuid)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(public.kb_dosage_rule_payload_v1(_rule_id))
$$;

CREATE OR REPLACE FUNCTION public.kb_safety_rule_payload_v1(_rule_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'rule_schema_version', rule.rule_schema_version,
    'assertion', public.kb_clinical_rule_assertion_payload_v1(rule.assertion_id),
    'subject', public.kb_clinical_rule_entity_revision_payload_v1(
      rule.subject_entity_id, rule.subject_entity_revision_id
    ),
    'related_entity', CASE WHEN rule.related_entity_revision_id IS NULL THEN NULL
      ELSE public.kb_clinical_rule_entity_revision_payload_v1(
        rule.related_entity_id, rule.related_entity_revision_id
      ) END,
    'rule_type', rule.rule_type,
    'severity', rule.severity,
    'effect', rule.effect,
    'notice_text', rule.notice_text,
    'conditions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'condition_order', condition.condition_order,
        'condition_kind', condition.condition_kind,
        'entity', CASE WHEN condition.condition_entity_revision_id IS NULL THEN NULL
          ELSE public.kb_clinical_rule_entity_revision_payload_v1(
            condition.condition_entity_id, condition.condition_entity_revision_id
          ) END,
        'fact_type', condition.fact_type,
        'fact_key', condition.fact_key,
        'coded_system', condition.coded_system,
        'coded_values', condition.coded_values,
        'quantity_comparator', condition.quantity_comparator,
        'quantity_value', condition.quantity_value,
        'quantity_unit_system', condition.quantity_unit_system,
        'quantity_unit_code', condition.quantity_unit_code
      ) ORDER BY condition.condition_order, condition.id)
        FROM public.kb_safety_rule_conditions condition
       WHERE condition.safety_rule_id = rule.id
    ), '[]'::jsonb)
  ))
    FROM public.kb_safety_rules rule
   WHERE rule.id = _rule_id
$$;

CREATE OR REPLACE FUNCTION public.kb_safety_rule_hash_v1(_rule_id uuid)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(public.kb_safety_rule_payload_v1(_rule_id))
$$;

CREATE OR REPLACE FUNCTION public.kb_dosage_rule_is_valid(_rule_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  rule public.kb_dosage_rules%ROWTYPE;
  assertion_kind text;
  assertion_status text;
  subject_type text;
  subject_status text;
  indication_type text;
  indication_status text;
  population_type text;
  population_status text;
BEGIN
  SELECT stored_rule.* INTO rule
    FROM public.kb_dosage_rules stored_rule
   WHERE stored_rule.id = _rule_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT assertion.assertion_kind, assertion.review_status
    INTO assertion_kind, assertion_status
    FROM public.kb_assertions assertion
   WHERE assertion.id = rule.assertion_id;
  IF NOT FOUND OR assertion_kind <> 'dosage' THEN
    RETURN false;
  END IF;

  SELECT entity.entity_type_code, revision.review_status
    INTO subject_type, subject_status
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = rule.subject_entity_revision_id
   WHERE entity.id = rule.subject_entity_id;
  IF NOT FOUND
     OR subject_type NOT IN ('preparation', 'product_variant')
     OR public.kb_clinical_rule_dependency_status_is_valid_v1(
          assertion_status, subject_status
        ) IS DISTINCT FROM true
     OR public.kb_therapeutic_revision_is_valid(
          rule.subject_entity_id, rule.subject_entity_revision_id
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  IF subject_type = 'preparation' THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.kb_preparation_revision_details detail
       WHERE detail.entity_id = rule.subject_entity_id
         AND detail.entity_revision_id = rule.subject_entity_revision_id
         AND rule.administration_route = ANY(detail.administration_routes)
    ) THEN
      RETURN false;
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1
      FROM public.kb_product_variant_revision_details variant
      JOIN public.kb_preparation_revision_details preparation
        ON preparation.entity_id = variant.preparation_entity_id
       AND preparation.entity_revision_id = variant.preparation_revision_id
     WHERE variant.entity_id = rule.subject_entity_id
       AND variant.entity_revision_id = rule.subject_entity_revision_id
       AND rule.administration_route = ANY(preparation.administration_routes)
  ) THEN
    RETURN false;
  END IF;

  IF rule.indication_entity_revision_id IS NOT NULL THEN
    SELECT entity.entity_type_code, revision.review_status
      INTO indication_type, indication_status
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = entity.id
       AND revision.id = rule.indication_entity_revision_id
     WHERE entity.id = rule.indication_entity_id;
    IF NOT FOUND
       OR indication_type NOT IN ('symptom', 'disease', 'lab_finding_definition')
       OR public.kb_clinical_rule_dependency_status_is_valid_v1(
            assertion_status, indication_status
          ) IS DISTINCT FROM true
    THEN
      RETURN false;
    END IF;
  END IF;

  IF rule.population_entity_revision_id IS NOT NULL THEN
    SELECT entity.entity_type_code, revision.review_status
      INTO population_type, population_status
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = entity.id
       AND revision.id = rule.population_entity_revision_id
     WHERE entity.id = rule.population_entity_id;
    IF NOT FOUND
       OR population_type <> 'population_group'
       OR public.kb_clinical_rule_dependency_status_is_valid_v1(
            assertion_status, population_status
          ) IS DISTINCT FROM true
    THEN
      RETURN false;
    END IF;
  END IF;

  RETURN public.kb_clinical_rule_sources_are_valid_v1(
           rule.assertion_id, assertion_status
         )
     AND public.kb_dosage_rule_payload_v1(rule.id) IS NOT NULL
     AND rule.rule_content_hash = public.kb_dosage_rule_hash_v1(rule.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_safety_rule_is_valid(_rule_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  rule public.kb_safety_rules%ROWTYPE;
  assertion_kind text;
  assertion_status text;
  subject_type text;
  subject_status text;
  related_type text;
  related_status text;
  condition_count integer;
  first_condition integer;
  last_condition integer;
  always_count integer;
BEGIN
  SELECT stored_rule.* INTO rule
    FROM public.kb_safety_rules stored_rule
   WHERE stored_rule.id = _rule_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT assertion.assertion_kind, assertion.review_status
    INTO assertion_kind, assertion_status
    FROM public.kb_assertions assertion
   WHERE assertion.id = rule.assertion_id;
  IF NOT FOUND OR assertion_kind <> 'safety' THEN
    RETURN false;
  END IF;

  SELECT entity.entity_type_code, revision.review_status
    INTO subject_type, subject_status
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = rule.subject_entity_revision_id
   WHERE entity.id = rule.subject_entity_id;
  IF NOT FOUND
     OR subject_type NOT IN ('preparation', 'product_variant')
     OR public.kb_clinical_rule_dependency_status_is_valid_v1(
          assertion_status, subject_status
        ) IS DISTINCT FROM true
     OR public.kb_therapeutic_revision_is_valid(
          rule.subject_entity_id, rule.subject_entity_revision_id
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  IF rule.related_entity_revision_id IS NOT NULL THEN
    SELECT entity.entity_type_code, revision.review_status
      INTO related_type, related_status
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = entity.id
       AND revision.id = rule.related_entity_revision_id
     WHERE entity.id = rule.related_entity_id;
    IF NOT FOUND
       OR related_type NOT IN (
         'preparation', 'product_variant', 'product', 'substance', 'plant', 'nutrient'
       )
       OR public.kb_clinical_rule_dependency_status_is_valid_v1(
            assertion_status, related_status
          ) IS DISTINCT FROM true
       OR (
         related_type IN ('preparation', 'product_variant')
         AND public.kb_therapeutic_revision_is_valid(
               rule.related_entity_id, rule.related_entity_revision_id
             ) IS DISTINCT FROM true
       )
    THEN
      RETURN false;
    END IF;
  END IF;

  SELECT count(*)::integer,
         min(condition.condition_order),
         max(condition.condition_order),
         count(*) FILTER (WHERE condition.condition_kind = 'always')::integer
    INTO condition_count, first_condition, last_condition, always_count
    FROM public.kb_safety_rule_conditions condition
   WHERE condition.safety_rule_id = rule.id;
  IF condition_count = 0
     OR first_condition <> 1
     OR last_condition <> condition_count
     OR (always_count > 0 AND (always_count <> 1 OR condition_count <> 1))
  THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_safety_rule_conditions condition
      JOIN public.kb_entities entity ON entity.id = condition.condition_entity_id
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = condition.condition_entity_id
       AND revision.id = condition.condition_entity_revision_id
     WHERE condition.safety_rule_id = rule.id
       AND condition.condition_kind = 'entity_present'
       AND (
         entity.entity_type_code NOT IN (
           'preparation', 'product_variant', 'product', 'substance', 'plant',
           'nutrient', 'disease', 'population_group'
         )
         OR public.kb_clinical_rule_dependency_status_is_valid_v1(
              assertion_status, revision.review_status
            ) IS DISTINCT FROM true
         OR (
           entity.entity_type_code IN ('preparation', 'product_variant')
           AND public.kb_therapeutic_revision_is_valid(
                 condition.condition_entity_id,
                 condition.condition_entity_revision_id
               ) IS DISTINCT FROM true
         )
       )
  ) THEN
    RETURN false;
  END IF;

  RETURN public.kb_clinical_rule_sources_are_valid_v1(
           rule.assertion_id, assertion_status
         )
     AND public.kb_safety_rule_payload_v1(rule.id) IS NOT NULL
     AND rule.rule_content_hash = public.kb_safety_rule_hash_v1(rule.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_dosage_rule_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH violations AS (
    SELECT 'assertion:' || assertion.id::text AS violation_key
      FROM public.kb_assertions assertion
     WHERE assertion.assertion_kind = 'dosage'
       AND NOT EXISTS (
         SELECT 1
           FROM public.kb_dosage_rules rule
          WHERE rule.assertion_id = assertion.id
            AND public.kb_dosage_rule_is_valid(rule.id)
       )
    UNION ALL
    SELECT 'rule:' || rule.id::text
      FROM public.kb_dosage_rules rule
     WHERE public.kb_dosage_rule_is_valid(rule.id) IS DISTINCT FROM true
  )
  SELECT count(*) FROM violations
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_safety_rule_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH violations AS (
    SELECT 'assertion:' || assertion.id::text AS violation_key
      FROM public.kb_assertions assertion
     WHERE assertion.assertion_kind = 'safety'
       AND NOT EXISTS (
         SELECT 1
           FROM public.kb_safety_rules rule
          WHERE rule.assertion_id = assertion.id
            AND public.kb_safety_rule_is_valid(rule.id)
       )
    UNION ALL
    SELECT 'rule:' || rule.id::text
      FROM public.kb_safety_rules rule
     WHERE public.kb_safety_rule_is_valid(rule.id) IS DISTINCT FROM true
    UNION ALL
    SELECT 'orphan-condition:' || condition.id::text
      FROM public.kb_safety_rule_conditions condition
      LEFT JOIN public.kb_safety_rules rule ON rule.id = condition.safety_rule_id
     WHERE rule.id IS NULL
  )
  SELECT count(*) FROM violations
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_clinical_rule_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  locked_assertion_id uuid;
  locked_assertion_kind text;
  locked_assertion_status text;
  locked_revision_id uuid;
  locked_revision_ids uuid[];
  locked_entity_id uuid;
  locked_source_id uuid;
  subject_revision_id uuid;
  changed_row jsonb;
  parent_safety_rule public.kb_safety_rules%ROWTYPE;
BEGIN
  SELECT pg_get_userbyid(relclass.relowner)
    INTO STRICT table_owner
    FROM pg_class relclass
   WHERE relclass.oid = TG_RELID;
  IF current_user <> table_owner THEN
    RAISE EXCEPTION 'Clinical rule writes require the database table owner';
  END IF;

  IF TG_TABLE_NAME = 'kb_safety_rule_conditions' THEN
    IF TG_OP = 'UPDATE' AND (
      NEW.id IS DISTINCT FROM OLD.id
      OR NEW.safety_rule_id IS DISTINCT FROM OLD.safety_rule_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    ) THEN
      RAISE EXCEPTION 'Stable safety condition fields are immutable';
    END IF;
    SELECT rule.* INTO STRICT parent_safety_rule
      FROM public.kb_safety_rules rule
     WHERE rule.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.safety_rule_id ELSE NEW.safety_rule_id END;
    locked_assertion_id := parent_safety_rule.assertion_id;
  ELSE
    IF TG_OP = 'UPDATE' AND (
      NEW.id IS DISTINCT FROM OLD.id
      OR NEW.rule_schema_version IS DISTINCT FROM OLD.rule_schema_version
      OR NEW.assertion_id IS DISTINCT FROM OLD.assertion_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    ) THEN
      RAISE EXCEPTION 'Stable clinical rule fields are immutable';
    END IF;
    locked_assertion_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.assertion_id ELSE NEW.assertion_id END;
  END IF;

  changed_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  -- Lock exact graph inputs before the parent assertion. Concurrent dependency
  -- changes then either become visible or force a serialization/deadlock retry.
  SELECT array_agg(DISTINCT revision_id ORDER BY revision_id)
    INTO locked_revision_ids
    FROM unnest(CASE
        WHEN TG_TABLE_NAME = 'kb_dosage_rules' THEN ARRAY[
          (changed_row ->> 'subject_entity_revision_id')::uuid,
          (changed_row ->> 'indication_entity_revision_id')::uuid,
          (changed_row ->> 'population_entity_revision_id')::uuid
        ]
        WHEN TG_TABLE_NAME = 'kb_safety_rules' THEN ARRAY[
          (changed_row ->> 'subject_entity_revision_id')::uuid,
          (changed_row ->> 'related_entity_revision_id')::uuid
        ]
        ELSE ARRAY[
          parent_safety_rule.subject_entity_revision_id,
          parent_safety_rule.related_entity_revision_id,
          (changed_row ->> 'condition_entity_revision_id')::uuid
        ]
      END) dependency(revision_id)
   WHERE revision_id IS NOT NULL;
  FOREACH locked_revision_id IN ARRAY COALESCE(locked_revision_ids, ARRAY[]::uuid[])
  LOOP
    PERFORM 1
      FROM public.kb_entity_revisions revision
     WHERE revision.id = locked_revision_id
      FOR SHARE;
  END LOOP;

  FOR locked_entity_id IN
    SELECT DISTINCT revision.entity_id
      FROM public.kb_entity_revisions revision
     WHERE revision.id = ANY(COALESCE(locked_revision_ids, ARRAY[]::uuid[]))
     ORDER BY revision.entity_id
  LOOP
    UPDATE public.kb_entities entity
       SET current_revision_id = entity.current_revision_id
     WHERE entity.id = locked_entity_id;
  END LOOP;

  FOR locked_revision_id IN
    SELECT revision.id
      FROM public.kb_source_revisions revision
     WHERE revision.id IN (
       SELECT binding.source_revision_id
         FROM public.kb_assertion_sources binding
        WHERE binding.assertion_id = locked_assertion_id
     )
     ORDER BY revision.id
  LOOP
    PERFORM 1 FROM public.kb_source_revisions revision
     WHERE revision.id = locked_revision_id FOR SHARE;
  END LOOP;

  FOR locked_source_id IN
    SELECT DISTINCT revision.source_id
      FROM public.kb_source_revisions revision
      JOIN public.kb_assertion_sources binding
        ON binding.source_revision_id = revision.id
     WHERE binding.assertion_id = locked_assertion_id
     ORDER BY revision.source_id
  LOOP
    UPDATE public.kb_sources source
       SET current_revision_id = source.current_revision_id
     WHERE source.id = locked_source_id;
  END LOOP;

  -- A real row version, rather than a lock-only read, makes an older
  -- REPEATABLE READ writer serialize-fail after a concurrent graph change.
  UPDATE public.kb_assertions assertion
     SET content_hash = assertion.content_hash
   WHERE assertion.id = locked_assertion_id
  RETURNING assertion.assertion_kind, assertion.review_status
       INTO STRICT locked_assertion_kind, locked_assertion_status;

  IF TG_TABLE_NAME = 'kb_dosage_rules' AND locked_assertion_kind <> 'dosage' THEN
    RAISE EXCEPTION 'Dosage rules require a dosage assertion';
  ELSIF TG_TABLE_NAME IN ('kb_safety_rules', 'kb_safety_rule_conditions')
        AND locked_assertion_kind <> 'safety'
  THEN
    RAISE EXCEPTION 'Safety rules require a safety assertion';
  END IF;

  IF locked_assertion_status IN ('approved', 'released', 'superseded', 'withdrawn') THEN
    RAISE EXCEPTION 'Approved, released or historical clinical rules are immutable';
  END IF;

  IF TG_TABLE_NAME = 'kb_safety_rule_conditions' THEN
    PERFORM 1
      FROM public.kb_safety_rules rule
     WHERE rule.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.safety_rule_id ELSE NEW.safety_rule_id END
     FOR UPDATE;
  END IF;

  subject_revision_id := CASE
    WHEN TG_TABLE_NAME = 'kb_safety_rule_conditions'
      THEN parent_safety_rule.subject_entity_revision_id
    ELSE (changed_row ->> 'subject_entity_revision_id')::uuid
  END;
  PERFORM 1 FROM public.kb_preparation_revision_details
   WHERE entity_revision_id = subject_revision_id FOR SHARE;
  PERFORM 1 FROM public.kb_homeopathic_revision_details
   WHERE entity_revision_id = subject_revision_id FOR SHARE;
  PERFORM 1 FROM public.kb_botanical_revision_details
   WHERE entity_revision_id = subject_revision_id FOR SHARE;
  PERFORM 1 FROM public.kb_nutrient_revision_details
   WHERE entity_revision_id = subject_revision_id FOR SHARE;
  PERFORM 1 FROM public.kb_product_variant_revision_details
   WHERE entity_revision_id = subject_revision_id FOR SHARE;
  PERFORM 1 FROM public.kb_composition_components
   WHERE owner_revision_id = subject_revision_id FOR SHARE;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_lock_clinical_rule_assertion_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  old_assertion_id uuid;
  new_assertion_id uuid;
  locked_assertion_id uuid;
  locked_assertion_status text;
  locked_revision_id uuid;
  locked_revision_ids uuid[];
  locked_source_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_assertion_id := OLD.assertion_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_assertion_id := NEW.assertion_id;
  END IF;

  SELECT array_agg(DISTINCT revision_id ORDER BY revision_id)
    INTO locked_revision_ids
    FROM unnest(ARRAY[
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.source_revision_id END,
      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.source_revision_id END
    ]) dependency(revision_id)
   WHERE revision_id IS NOT NULL;

  FOREACH locked_revision_id IN ARRAY COALESCE(locked_revision_ids, ARRAY[]::uuid[])
  LOOP
    PERFORM 1 FROM public.kb_source_revisions revision
     WHERE revision.id = locked_revision_id FOR SHARE;
  END LOOP;

  FOR locked_source_id IN
    SELECT DISTINCT revision.source_id
      FROM public.kb_source_revisions revision
     WHERE revision.id = ANY(COALESCE(locked_revision_ids, ARRAY[]::uuid[]))
     ORDER BY revision.source_id
  LOOP
    UPDATE public.kb_sources source
       SET current_revision_id = source.current_revision_id
     WHERE source.id = locked_source_id;
  END LOOP;

  FOR locked_assertion_id IN
    SELECT assertion.id
      FROM public.kb_assertions assertion
     WHERE assertion.id IN (old_assertion_id, new_assertion_id)
       AND assertion.assertion_kind IN ('dosage', 'safety')
     ORDER BY assertion.id
  LOOP
    UPDATE public.kb_assertions assertion
       SET content_hash = assertion.content_hash
     WHERE assertion.id = locked_assertion_id
    RETURNING assertion.review_status INTO STRICT locked_assertion_status;
    IF locked_assertion_status IN ('approved', 'released', 'superseded', 'withdrawn') THEN
      RAISE EXCEPTION 'Sources of approved, released or historical clinical rules are immutable';
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_lock_clinical_rule_revision_dependents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  old_revision_id uuid;
  new_revision_id uuid;
  old_parent_id uuid;
  new_parent_id uuid;
  locked_parent_id uuid;
  locked_assertion_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_revision_id := OLD.id;
    old_parent_id := CASE TG_TABLE_NAME
      WHEN 'kb_source_revisions' THEN (to_jsonb(OLD) ->> 'source_id')::uuid
      ELSE (to_jsonb(OLD) ->> 'entity_id')::uuid
    END;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_revision_id := NEW.id;
    new_parent_id := CASE TG_TABLE_NAME
      WHEN 'kb_source_revisions' THEN (to_jsonb(NEW) ->> 'source_id')::uuid
      ELSE (to_jsonb(NEW) ->> 'entity_id')::uuid
    END;
  END IF;

  FOR locked_parent_id IN
    SELECT DISTINCT parent_id
      FROM unnest(ARRAY[old_parent_id, new_parent_id]) parent(parent_id)
     WHERE parent_id IS NOT NULL
     ORDER BY parent_id
  LOOP
    IF TG_TABLE_NAME = 'kb_source_revisions' THEN
      UPDATE public.kb_sources source
         SET current_revision_id = source.current_revision_id
       WHERE source.id = locked_parent_id;
    ELSE
      UPDATE public.kb_entities entity
         SET current_revision_id = entity.current_revision_id
       WHERE entity.id = locked_parent_id;
    END IF;
  END LOOP;

  FOR locked_assertion_id IN
    WITH affected_assertions AS (
      SELECT binding.assertion_id
        FROM public.kb_assertion_sources binding
       WHERE TG_TABLE_NAME = 'kb_source_revisions'
         AND binding.source_revision_id IN (old_revision_id, new_revision_id)
      UNION
      SELECT rule.assertion_id FROM public.kb_dosage_rules rule
       WHERE TG_TABLE_NAME = 'kb_entity_revisions'
         AND (
           rule.subject_entity_revision_id IN (old_revision_id, new_revision_id)
           OR rule.indication_entity_revision_id IN (old_revision_id, new_revision_id)
           OR rule.population_entity_revision_id IN (old_revision_id, new_revision_id)
         )
      UNION
      SELECT rule.assertion_id FROM public.kb_safety_rules rule
       WHERE TG_TABLE_NAME = 'kb_entity_revisions'
         AND (
           rule.subject_entity_revision_id IN (old_revision_id, new_revision_id)
           OR rule.related_entity_revision_id IN (old_revision_id, new_revision_id)
         )
      UNION
      SELECT rule.assertion_id
        FROM public.kb_safety_rule_conditions condition
        JOIN public.kb_safety_rules rule ON rule.id = condition.safety_rule_id
       WHERE TG_TABLE_NAME = 'kb_entity_revisions'
         AND condition.condition_entity_revision_id IN (old_revision_id, new_revision_id)
    )
    SELECT assertion.id
      FROM public.kb_assertions assertion
     WHERE assertion.id IN (SELECT affected.assertion_id FROM affected_assertions affected)
     ORDER BY assertion.id
  LOOP
    UPDATE public.kb_assertions assertion
       SET content_hash = assertion.content_hash
     WHERE assertion.id = locked_assertion_id
       AND assertion.review_status NOT IN ('released', 'superseded', 'withdrawn');
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_lock_clinical_rule_therapeutic_dependents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  old_revision_id uuid;
  new_revision_id uuid;
  old_entity_id uuid;
  new_entity_id uuid;
  locked_entity_id uuid;
  locked_assertion_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_revision_id := COALESCE(
      to_jsonb(OLD) ->> 'owner_revision_id',
      to_jsonb(OLD) ->> 'entity_revision_id'
    )::uuid;
    old_entity_id := COALESCE(
      to_jsonb(OLD) ->> 'owner_entity_id',
      to_jsonb(OLD) ->> 'entity_id'
    )::uuid;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_revision_id := COALESCE(
      to_jsonb(NEW) ->> 'owner_revision_id',
      to_jsonb(NEW) ->> 'entity_revision_id'
    )::uuid;
    new_entity_id := COALESCE(
      to_jsonb(NEW) ->> 'owner_entity_id',
      to_jsonb(NEW) ->> 'entity_id'
    )::uuid;
  END IF;

  FOR locked_entity_id IN
    SELECT DISTINCT entity_id
      FROM unnest(ARRAY[old_entity_id, new_entity_id]) entity(entity_id)
     WHERE entity_id IS NOT NULL
     ORDER BY entity_id
  LOOP
    UPDATE public.kb_entities entity
       SET current_revision_id = entity.current_revision_id
     WHERE entity.id = locked_entity_id;
  END LOOP;

  FOR locked_assertion_id IN
    SELECT assertion.id
      FROM public.kb_assertions assertion
     WHERE assertion.id IN (
       SELECT rule.assertion_id
         FROM public.kb_dosage_rules rule
        WHERE rule.subject_entity_revision_id IN (old_revision_id, new_revision_id)
       UNION
       SELECT rule.assertion_id
         FROM public.kb_safety_rules rule
        WHERE rule.subject_entity_revision_id IN (old_revision_id, new_revision_id)
     )
     ORDER BY assertion.id
  LOOP
    UPDATE public.kb_assertions assertion
       SET content_hash = assertion.content_hash
     WHERE assertion.id = locked_assertion_id
       AND assertion.review_status NOT IN ('released', 'superseded', 'withdrawn');
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_clinical_rule_assertion_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.review_status = 'approved'
     AND NEW.review_status = 'draft'
     AND (
       EXISTS (SELECT 1 FROM public.kb_dosage_rules rule WHERE rule.assertion_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.kb_safety_rules rule WHERE rule.assertion_id = OLD.id)
     )
  THEN
    RAISE EXCEPTION 'Approved clinical rule assertions cannot return to draft';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_validate_clinical_rule_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.kb_invalid_dosage_rule_count() <> 0
     OR public.kb_invalid_safety_rule_count() <> 0
  THEN
    RAISE EXCEPTION 'Clinical rule contract is incomplete, unreviewed, unsourced or has an invalid content hash';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_prevent_clinical_rule_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Clinical rule tables cannot be truncated';
END;
$$;

CREATE TRIGGER kb_dosage_rules_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_dosage_rules
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_clinical_rule_write();
CREATE TRIGGER kb_safety_rules_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_safety_rules
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_clinical_rule_write();
CREATE TRIGGER kb_safety_rule_conditions_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_safety_rule_conditions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_clinical_rule_write();

CREATE TRIGGER kb_assertion_sources_lock_clinical_rules
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_assertion_sources
  FOR EACH ROW EXECUTE FUNCTION public.kb_lock_clinical_rule_assertion_source();
CREATE TRIGGER kb_entity_revisions_lock_clinical_rules
  BEFORE UPDATE OR DELETE ON public.kb_entity_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_lock_clinical_rule_revision_dependents();
CREATE TRIGGER kb_source_revisions_lock_clinical_rules
  BEFORE UPDATE OR DELETE ON public.kb_source_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_lock_clinical_rule_revision_dependents();
CREATE TRIGGER kb_assertions_protect_clinical_rule_status
  BEFORE UPDATE ON public.kb_assertions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_clinical_rule_assertion_status();

DO $$
DECLARE
  therapeutic_table text;
BEGIN
  FOREACH therapeutic_table IN ARRAY ARRAY[
    'kb_preparation_revision_details',
    'kb_homeopathic_revision_details',
    'kb_botanical_revision_details',
    'kb_nutrient_revision_details',
    'kb_product_variant_revision_details',
    'kb_composition_components'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.kb_lock_clinical_rule_therapeutic_dependents()',
      therapeutic_table || '_lock_clinical_rules',
      therapeutic_table
    );
  END LOOP;
END;
$$;

CREATE TRIGGER kb_dosage_rules_prevent_truncate
  BEFORE TRUNCATE ON public.kb_dosage_rules
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_prevent_clinical_rule_truncate();
CREATE TRIGGER kb_safety_rules_prevent_truncate
  BEFORE TRUNCATE ON public.kb_safety_rules
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_prevent_clinical_rule_truncate();
CREATE TRIGGER kb_safety_rule_conditions_prevent_truncate
  BEFORE TRUNCATE ON public.kb_safety_rule_conditions
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_prevent_clinical_rule_truncate();

CREATE CONSTRAINT TRIGGER kb_dosage_rules_validate_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_dosage_rules
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_clinical_rule_contract();
CREATE CONSTRAINT TRIGGER kb_safety_rules_validate_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_safety_rules
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_clinical_rule_contract();
CREATE CONSTRAINT TRIGGER kb_safety_rule_conditions_validate_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_safety_rule_conditions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_clinical_rule_contract();
CREATE CONSTRAINT TRIGGER kb_assertions_validate_clinical_rules
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_assertions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_clinical_rule_contract();
CREATE CONSTRAINT TRIGGER kb_assertion_sources_validate_clinical_rules
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_assertion_sources
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_clinical_rule_contract();
CREATE CONSTRAINT TRIGGER kb_entity_revisions_validate_clinical_rules
  AFTER UPDATE OR DELETE ON public.kb_entity_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_clinical_rule_contract();
CREATE CONSTRAINT TRIGGER kb_source_revisions_validate_clinical_rules
  AFTER UPDATE OR DELETE ON public.kb_source_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_clinical_rule_contract();

DO $$
DECLARE
  therapeutic_table text;
BEGIN
  FOREACH therapeutic_table IN ARRAY ARRAY[
    'kb_preparation_revision_details',
    'kb_homeopathic_revision_details',
    'kb_botanical_revision_details',
    'kb_nutrient_revision_details',
    'kb_product_variant_revision_details',
    'kb_composition_components'
  ]
  LOOP
    EXECUTE format(
      'CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
         DEFERRABLE INITIALLY DEFERRED
         FOR EACH ROW EXECUTE FUNCTION public.kb_validate_clinical_rule_contract()',
      therapeutic_table || '_validate_clinical_rules',
      therapeutic_table
    );
  END LOOP;
END;
$$;

ALTER TABLE public.kb_dosage_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_safety_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_safety_rule_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_dosage_rules_admin_read
  ON public.kb_dosage_rules
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY kb_safety_rules_admin_read
  ON public.kb_safety_rules
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY kb_safety_rule_conditions_admin_read
  ON public.kb_safety_rule_conditions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE
  public.kb_dosage_rules,
  public.kb_safety_rules,
  public.kb_safety_rule_conditions
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT SELECT ON TABLE
  public.kb_dosage_rules,
  public.kb_safety_rules,
  public.kb_safety_rule_conditions
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.kb_clinical_rule_code_array_is_valid_v1(text[])
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_clinical_rule_dependency_status_is_valid_v1(text, text)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_clinical_rule_sources_are_valid_v1(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_clinical_rule_entity_revision_payload_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_clinical_rule_assertion_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_dosage_rule_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_dosage_rule_hash_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_safety_rule_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_safety_rule_hash_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_dosage_rule_is_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_safety_rule_is_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_dosage_rule_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_safety_rule_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_clinical_rule_write()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lock_clinical_rule_assertion_source()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lock_clinical_rule_revision_dependents()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lock_clinical_rule_therapeutic_dependents()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_clinical_rule_assertion_status()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_validate_clinical_rule_contract()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_prevent_clinical_rule_truncate()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

ALTER FUNCTION public.kb_export_wiki_snapshot()
  RENAME TO kb_export_wiki_snapshot_4a;
REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot_4a()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

CREATE FUNCTION public.kb_export_wiki_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  snapshot jsonb;
BEGIN
  snapshot := public.kb_export_wiki_snapshot_4a();
  RETURN jsonb_set(
    snapshot,
    '{validation}',
    (snapshot -> 'validation') || jsonb_build_object(
      'invalid_dosage_rules', public.kb_invalid_dosage_rule_count(),
      'invalid_safety_rules', public.kb_invalid_safety_rule_count()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT EXECUTE ON FUNCTION public.kb_export_wiki_snapshot()
  TO service_role;

COMMIT;
