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
    'kb_dosage_rules',
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
    'kb_safety_rule_conditions',
    'kb_safety_rules',
    'kb_search_documents',
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
  IF to_regprocedure('public.kb_release_canonical_jsonb_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_text_array_is_canonical(text[])') IS NULL
     OR to_regprocedure('public.kb_clinical_rule_dependency_status_is_valid_v1(text,text)') IS NULL
     OR to_regprocedure('public.kb_clinical_rule_sources_are_valid_v1(uuid,text)') IS NULL
     OR to_regprocedure('public.kb_invalid_search_document_count()') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Laboratory details require the complete 56-table Wiki contract';
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
    RAISE EXCEPTION 'Laboratory details require the exact 56-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_revisions revision
      JOIN public.kb_entities entity ON entity.id = revision.entity_id
     WHERE entity.entity_type_code IN ('lab_parameter', 'lab_finding_definition')
  ) THEN
    RAISE EXCEPTION 'Schema-only laboratory details require no pre-existing lab parameter or finding revisions';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_lab_unit_is_valid_v1(
  _unit_system text,
  _unit_code text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT (_unit_system = 'unitless' AND _unit_code = '1')
      OR (
        _unit_system = 'ucum'
        AND octet_length(_unit_code) BETWEEN 1 AND 64
        AND _unit_code ~ '^[A-Za-z0-9%*/.^_{}()[\]+-]{1,64}$'
        AND _unit_code ~ '[A-Za-z0-9%]'
        AND _unit_code !~ '^[/.*^_+-]|[/.*^_+-]$'
        AND _unit_code !~ '//|\.\.|\*\*|\^\^|__|\+\+|--'
      )
$$;

CREATE OR REPLACE FUNCTION public.kb_lab_qualitative_code_array_is_valid_v1(
  _values text[]
)
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

CREATE OR REPLACE FUNCTION public.kb_laboratory_entity_revision_payload_v1(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'entity_id', entity.id,
    'entity_revision_id', revision.id,
    'entity_type_code', entity.entity_type_code,
    'canonical_key', entity.canonical_key,
    'revision_no', revision.revision_no,
    'display_name', revision.display_name,
    'summary', revision.summary,
    'description_markdown', revision.description_markdown,
    'origin_type', revision.origin_type,
    'content_hash', revision.content_hash,
    'metadata_hash', public.kb_release_manifest_hash_v1(revision.metadata)
  ))
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = _entity_revision_id
   WHERE entity.id = _entity_id
$$;

CREATE OR REPLACE FUNCTION public.kb_laboratory_source_revision_payload_v1(
  _source_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'source_id', source.id,
    'source_revision_id', revision.id,
    'canonical_key', source.canonical_key,
    'revision_no', revision.revision_no,
    'source_type', revision.source_type,
    'title', revision.title,
    'authors', revision.authors,
    'publisher', revision.publisher,
    'edition', revision.edition,
    'published_on', revision.published_on,
    'url', revision.url,
    'doi', revision.doi,
    'pmid', revision.pmid,
    'isbn', revision.isbn,
    'retrieved_on', revision.retrieved_on,
    'file_sha256', revision.file_sha256,
    'rights_status', revision.rights_status,
    'archive_location', revision.archive_location,
    'content_hash', revision.content_hash,
    'metadata_hash', public.kb_release_manifest_hash_v1(revision.metadata)
  ))
    FROM public.kb_source_revisions revision
    JOIN public.kb_sources source ON source.id = revision.source_id
   WHERE revision.id = _source_revision_id
$$;

CREATE OR REPLACE FUNCTION public.kb_laboratory_assertion_payload_v1(
  _assertion_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
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
        'source', public.kb_laboratory_source_revision_payload_v1(
          binding.source_revision_id
        ),
        'source_role', binding.source_role,
        'locator', binding.locator,
        'original_quote', binding.original_quote,
        'is_primary', binding.is_primary
      ) ORDER BY
        binding.source_revision_id,
        binding.source_role COLLATE "C",
        binding.locator COLLATE "C")
        FROM public.kb_assertion_sources binding
       WHERE binding.assertion_id = assertion.id
    ), '[]'::jsonb)
  ))
    FROM public.kb_assertions assertion
   WHERE assertion.id = _assertion_id
$$;

CREATE TABLE public.kb_lab_parameter_revision_details (
  entity_id uuid NOT NULL,
  entity_revision_id uuid NOT NULL,
  parameter_schema_version integer NOT NULL DEFAULT 1
    CHECK (parameter_schema_version = 1),
  specimen_kind text NOT NULL
    CHECK (specimen_kind IN (
      'whole_blood', 'serum', 'plasma', 'urine', 'stool', 'saliva',
      'cerebrospinal_fluid', 'synovial_fluid', 'body_fluid', 'tissue',
      'swab', 'breath', 'unspecified', 'other'
    )),
  value_kind text NOT NULL
    CHECK (value_kind IN ('quantity', 'coded')),
  canonical_unit_system text NOT NULL
    CHECK (canonical_unit_system IN ('ucum', 'unitless')),
  canonical_unit_code text NOT NULL,
  basis_assertion_id uuid NOT NULL
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, entity_revision_id),
  FOREIGN KEY (entity_id, entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CHECK (public.kb_lab_unit_is_valid_v1(
    canonical_unit_system, canonical_unit_code
  )),
  CHECK (
    value_kind <> 'coded'
    OR (canonical_unit_system = 'unitless' AND canonical_unit_code = '1')
  )
);

CREATE TABLE public.kb_lab_reference_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  range_schema_version integer NOT NULL DEFAULT 1
    CHECK (range_schema_version = 1),
  assertion_id uuid NOT NULL UNIQUE
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  lab_parameter_entity_id uuid NOT NULL,
  lab_parameter_revision_id uuid NOT NULL,
  diagnostic_method_entity_id uuid NOT NULL,
  diagnostic_method_revision_id uuid NOT NULL,
  laboratory_entity_id uuid,
  laboratory_revision_id uuid,
  population_group_entity_id uuid,
  population_group_revision_id uuid,
  sex_scope text NOT NULL DEFAULT 'any'
    CHECK (sex_scope IN ('any', 'female', 'male', 'diverse', 'intersex')),
  age_min_years numeric,
  age_max_years numeric,
  range_kind text NOT NULL
    CHECK (range_kind IN ('numeric_interval', 'qualitative_set')),
  unit_system text NOT NULL
    CHECK (unit_system IN ('ucum', 'unitless')),
  unit_code text NOT NULL,
  lower_bound numeric,
  lower_inclusive boolean,
  upper_bound numeric,
  upper_inclusive boolean,
  qualitative_codes text[],
  range_content_hash text NOT NULL
    CHECK (range_content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, lab_parameter_entity_id, lab_parameter_revision_id),
  FOREIGN KEY (lab_parameter_entity_id, lab_parameter_revision_id)
    REFERENCES public.kb_lab_parameter_revision_details(entity_id, entity_revision_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (diagnostic_method_entity_id, diagnostic_method_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (laboratory_entity_id, laboratory_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (population_group_entity_id, population_group_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CHECK ((laboratory_entity_id IS NULL) = (laboratory_revision_id IS NULL)),
  CHECK ((population_group_entity_id IS NULL) = (population_group_revision_id IS NULL)),
  CHECK (age_min_years IS NULL OR age_min_years BETWEEN 0 AND 130),
  CHECK (age_max_years IS NULL OR age_max_years BETWEEN 0 AND 130),
  CHECK (age_min_years IS NULL OR octet_length(age_min_years::text) <= 32),
  CHECK (age_max_years IS NULL OR octet_length(age_max_years::text) <= 32),
  CHECK (age_min_years IS NULL OR age_max_years IS NULL OR age_max_years >= age_min_years),
  CHECK (public.kb_lab_unit_is_valid_v1(unit_system, unit_code)),
  CHECK (lower_bound IS NULL OR lower_bound BETWEEN '-1e100'::numeric AND '1e100'::numeric),
  CHECK (upper_bound IS NULL OR upper_bound BETWEEN '-1e100'::numeric AND '1e100'::numeric),
  CHECK (lower_bound IS NULL OR octet_length(lower_bound::text) <= 128),
  CHECK (upper_bound IS NULL OR octet_length(upper_bound::text) <= 128),
  CHECK (lower_bound IS NULL OR upper_bound IS NULL OR upper_bound >= lower_bound),
  CHECK (
    lower_bound IS NULL OR upper_bound IS NULL OR lower_bound < upper_bound
    OR (lower_inclusive AND upper_inclusive)
  ),
  CHECK ((lower_bound IS NULL) = (lower_inclusive IS NULL)),
  CHECK ((upper_bound IS NULL) = (upper_inclusive IS NULL)),
  CHECK (
    (range_kind = 'numeric_interval'
      AND (lower_bound IS NOT NULL OR upper_bound IS NOT NULL)
      AND qualitative_codes IS NULL)
    OR
    (range_kind = 'qualitative_set'
      AND lower_bound IS NULL AND upper_bound IS NULL
      AND lower_inclusive IS NULL AND upper_inclusive IS NULL
      AND qualitative_codes IS NOT NULL
      AND public.kb_lab_qualitative_code_array_is_valid_v1(qualitative_codes)
      AND unit_system = 'unitless' AND unit_code = '1')
  )
);

CREATE TABLE public.kb_lab_finding_definition_revision_details (
  entity_id uuid NOT NULL,
  entity_revision_id uuid NOT NULL,
  finding_schema_version integer NOT NULL DEFAULT 1
    CHECK (finding_schema_version = 1),
  lab_parameter_entity_id uuid NOT NULL,
  lab_parameter_revision_id uuid NOT NULL,
  reference_range_id uuid NOT NULL,
  interpretation_kind text NOT NULL
    CHECK (interpretation_kind IN (
      'below_range', 'within_range', 'above_range',
      'qualitative_in_set', 'qualitative_outside_set'
    )),
  basis_assertion_id uuid NOT NULL
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, entity_revision_id),
  FOREIGN KEY (entity_id, entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (lab_parameter_entity_id, lab_parameter_revision_id)
    REFERENCES public.kb_lab_parameter_revision_details(entity_id, entity_revision_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (
    reference_range_id, lab_parameter_entity_id, lab_parameter_revision_id
  ) REFERENCES public.kb_lab_reference_ranges(
    id, lab_parameter_entity_id, lab_parameter_revision_id
  ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX kb_lab_parameter_details_revision_idx
  ON public.kb_lab_parameter_revision_details(entity_revision_id);
CREATE INDEX kb_lab_parameter_details_basis_idx
  ON public.kb_lab_parameter_revision_details(basis_assertion_id);
CREATE INDEX kb_lab_reference_ranges_parameter_revision_idx
  ON public.kb_lab_reference_ranges(lab_parameter_revision_id);
CREATE INDEX kb_lab_reference_ranges_method_revision_idx
  ON public.kb_lab_reference_ranges(diagnostic_method_revision_id);
CREATE INDEX kb_lab_reference_ranges_laboratory_revision_idx
  ON public.kb_lab_reference_ranges(laboratory_revision_id)
  WHERE laboratory_revision_id IS NOT NULL;
CREATE INDEX kb_lab_reference_ranges_population_revision_idx
  ON public.kb_lab_reference_ranges(population_group_revision_id)
  WHERE population_group_revision_id IS NOT NULL;
CREATE INDEX kb_lab_finding_details_revision_idx
  ON public.kb_lab_finding_definition_revision_details(entity_revision_id);
CREATE INDEX kb_lab_finding_details_parameter_revision_idx
  ON public.kb_lab_finding_definition_revision_details(lab_parameter_revision_id);
CREATE INDEX kb_lab_finding_details_range_idx
  ON public.kb_lab_finding_definition_revision_details(reference_range_id);
CREATE INDEX kb_lab_finding_details_basis_idx
  ON public.kb_lab_finding_definition_revision_details(basis_assertion_id);

CREATE OR REPLACE FUNCTION public.kb_lab_parameter_revision_payload_v1(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'parameter_schema_version', detail.parameter_schema_version,
    'entity', jsonb_build_object(
      'entity_id', entity.id,
      'entity_revision_id', revision.id,
      'entity_type_code', entity.entity_type_code,
      'canonical_key', entity.canonical_key
    ),
    'revision', jsonb_build_object(
      'revision_no', revision.revision_no,
      'display_name', revision.display_name,
      'summary', revision.summary,
      'description_markdown', revision.description_markdown,
      'origin_type', revision.origin_type,
      'metadata', revision.metadata
    ),
    'identifiers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'identifier_id', identifier.id,
        'scheme_code', identifier.scheme_code,
        'namespace', identifier.namespace,
        'value', identifier.value,
        'normalized_value', identifier.normalized_value,
        'is_primary', identifier.is_primary,
        'valid_from', identifier.valid_from,
        'valid_until', identifier.valid_until
      ) ORDER BY
        identifier.scheme_code COLLATE "C",
        identifier.namespace COLLATE "C" NULLS FIRST,
        identifier.normalized_value COLLATE "C",
        identifier.value COLLATE "C")
        FROM public.kb_entity_identifiers identifier
       WHERE identifier.entity_id = entity.id
    ), '[]'::jsonb),
    'parameter', jsonb_build_object(
      'specimen_kind', detail.specimen_kind,
      'value_kind', detail.value_kind,
      'canonical_unit_system', detail.canonical_unit_system,
      'canonical_unit_code', detail.canonical_unit_code
    ),
    'basis_assertion', public.kb_laboratory_assertion_payload_v1(
      detail.basis_assertion_id
    )
  ))
    FROM public.kb_lab_parameter_revision_details detail
    JOIN public.kb_entities entity ON entity.id = detail.entity_id
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = detail.entity_id
     AND revision.id = detail.entity_revision_id
   WHERE detail.entity_id = _entity_id
     AND detail.entity_revision_id = _entity_revision_id
$$;

CREATE OR REPLACE FUNCTION public.kb_lab_parameter_revision_hash_v1(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(
    public.kb_lab_parameter_revision_payload_v1(_entity_id, _entity_revision_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_lab_reference_range_payload_v1(_range_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'range_schema_version', reference_range.range_schema_version,
    'assertion', public.kb_laboratory_assertion_payload_v1(
      reference_range.assertion_id
    ),
    'lab_parameter', jsonb_build_object(
      'payload', public.kb_lab_parameter_revision_payload_v1(
        reference_range.lab_parameter_entity_id,
        reference_range.lab_parameter_revision_id
      ),
      'content_hash', parameter_revision.content_hash
    ),
    'diagnostic_method', public.kb_laboratory_entity_revision_payload_v1(
      reference_range.diagnostic_method_entity_id,
      reference_range.diagnostic_method_revision_id
    ),
    'laboratory', CASE WHEN reference_range.laboratory_revision_id IS NULL THEN NULL
      ELSE public.kb_laboratory_entity_revision_payload_v1(
        reference_range.laboratory_entity_id,
        reference_range.laboratory_revision_id
      ) END,
    'population_group', CASE
      WHEN reference_range.population_group_revision_id IS NULL THEN NULL
      ELSE public.kb_laboratory_entity_revision_payload_v1(
        reference_range.population_group_entity_id,
        reference_range.population_group_revision_id
      ) END,
    'sex_scope', reference_range.sex_scope,
    'age_min_years', reference_range.age_min_years,
    'age_max_years', reference_range.age_max_years,
    'range_kind', reference_range.range_kind,
    'unit_system', reference_range.unit_system,
    'unit_code', reference_range.unit_code,
    'lower_bound', reference_range.lower_bound,
    'lower_inclusive', reference_range.lower_inclusive,
    'upper_bound', reference_range.upper_bound,
    'upper_inclusive', reference_range.upper_inclusive,
    'qualitative_codes', reference_range.qualitative_codes
  ))
    FROM public.kb_lab_reference_ranges reference_range
    JOIN public.kb_entity_revisions parameter_revision
      ON parameter_revision.entity_id = reference_range.lab_parameter_entity_id
     AND parameter_revision.id = reference_range.lab_parameter_revision_id
   WHERE reference_range.id = _range_id
$$;

CREATE OR REPLACE FUNCTION public.kb_lab_reference_range_hash_v1(_range_id uuid)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(
    public.kb_lab_reference_range_payload_v1(_range_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_lab_finding_definition_revision_payload_v1(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'finding_schema_version', detail.finding_schema_version,
    'entity', jsonb_build_object(
      'entity_id', entity.id,
      'entity_revision_id', revision.id,
      'entity_type_code', entity.entity_type_code,
      'canonical_key', entity.canonical_key
    ),
    'revision', jsonb_build_object(
      'revision_no', revision.revision_no,
      'display_name', revision.display_name,
      'summary', revision.summary,
      'description_markdown', revision.description_markdown,
      'origin_type', revision.origin_type,
      'metadata', revision.metadata
    ),
    'finding', jsonb_build_object(
      'lab_parameter', jsonb_build_object(
        'payload', public.kb_lab_parameter_revision_payload_v1(
          detail.lab_parameter_entity_id,
          detail.lab_parameter_revision_id
        ),
        'content_hash', parameter_revision.content_hash
      ),
      'reference_range', jsonb_build_object(
        'payload', public.kb_lab_reference_range_payload_v1(detail.reference_range_id),
        'range_content_hash', reference_range.range_content_hash
      ),
      'interpretation_kind', detail.interpretation_kind
    ),
    'basis_assertion', public.kb_laboratory_assertion_payload_v1(
      detail.basis_assertion_id
    )
  ))
    FROM public.kb_lab_finding_definition_revision_details detail
    JOIN public.kb_entities entity ON entity.id = detail.entity_id
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = detail.entity_id
     AND revision.id = detail.entity_revision_id
    JOIN public.kb_entity_revisions parameter_revision
      ON parameter_revision.entity_id = detail.lab_parameter_entity_id
     AND parameter_revision.id = detail.lab_parameter_revision_id
    JOIN public.kb_lab_reference_ranges reference_range
      ON reference_range.id = detail.reference_range_id
     AND reference_range.lab_parameter_entity_id = detail.lab_parameter_entity_id
     AND reference_range.lab_parameter_revision_id = detail.lab_parameter_revision_id
   WHERE detail.entity_id = _entity_id
     AND detail.entity_revision_id = _entity_revision_id
$$;

CREATE OR REPLACE FUNCTION public.kb_lab_finding_definition_revision_hash_v1(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(
    public.kb_lab_finding_definition_revision_payload_v1(
      _entity_id, _entity_revision_id
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_lab_parameter_revision_is_valid(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  entity_type text;
  revision_status text;
  stored_hash text;
  basis_assertion_id uuid;
  basis_kind text;
  basis_status text;
BEGIN
  SELECT entity.entity_type_code, revision.review_status, revision.content_hash,
         detail.basis_assertion_id, assertion.assertion_kind, assertion.review_status
    INTO entity_type, revision_status, stored_hash,
         basis_assertion_id, basis_kind, basis_status
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = _entity_revision_id
    JOIN public.kb_lab_parameter_revision_details detail
      ON detail.entity_id = entity.id
     AND detail.entity_revision_id = revision.id
    JOIN public.kb_assertions assertion ON assertion.id = detail.basis_assertion_id
   WHERE entity.id = _entity_id;

  IF NOT FOUND
     OR entity_type <> 'lab_parameter'
     OR basis_kind <> 'classification'
     OR public.kb_clinical_rule_dependency_status_is_valid_v1(
          revision_status, basis_status
        ) IS DISTINCT FROM true
     OR public.kb_clinical_rule_sources_are_valid_v1(
          basis_assertion_id, basis_status
        ) IS DISTINCT FROM true
     OR public.kb_lab_parameter_revision_payload_v1(
          _entity_id, _entity_revision_id
        ) IS NULL
  THEN
    RETURN false;
  END IF;

  RETURN stored_hash = public.kb_lab_parameter_revision_hash_v1(
    _entity_id, _entity_revision_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_lab_reference_range_is_valid(_range_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  reference_range public.kb_lab_reference_ranges%ROWTYPE;
  assertion_kind text;
  assertion_status text;
  parameter_type text;
  parameter_status text;
  parameter_value_kind text;
  method_type text;
  method_status text;
  laboratory_type text;
  laboratory_status text;
  population_type text;
  population_status text;
BEGIN
  SELECT stored_range.*
    INTO reference_range
    FROM public.kb_lab_reference_ranges stored_range
   WHERE stored_range.id = _range_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT assertion.assertion_kind, assertion.review_status
    INTO assertion_kind, assertion_status
    FROM public.kb_assertions assertion
   WHERE assertion.id = reference_range.assertion_id;
  IF NOT FOUND
     OR assertion_kind <> 'classification'
     OR public.kb_clinical_rule_sources_are_valid_v1(
          reference_range.assertion_id, assertion_status
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  SELECT entity.entity_type_code, revision.review_status, detail.value_kind
    INTO parameter_type, parameter_status, parameter_value_kind
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = reference_range.lab_parameter_revision_id
    JOIN public.kb_lab_parameter_revision_details detail
      ON detail.entity_id = entity.id
     AND detail.entity_revision_id = revision.id
   WHERE entity.id = reference_range.lab_parameter_entity_id;
  IF NOT FOUND
     OR parameter_type <> 'lab_parameter'
     OR public.kb_lab_parameter_revision_is_valid(
          reference_range.lab_parameter_entity_id,
          reference_range.lab_parameter_revision_id
        ) IS DISTINCT FROM true
     OR public.kb_clinical_rule_dependency_status_is_valid_v1(
          assertion_status, parameter_status
        ) IS DISTINCT FROM true
     OR (parameter_value_kind = 'quantity') IS DISTINCT FROM
        (reference_range.range_kind = 'numeric_interval')
  THEN
    RETURN false;
  END IF;

  SELECT entity.entity_type_code, revision.review_status
    INTO method_type, method_status
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = reference_range.diagnostic_method_revision_id
   WHERE entity.id = reference_range.diagnostic_method_entity_id;
  IF NOT FOUND
     OR method_type <> 'diagnostic_method'
     OR public.kb_clinical_rule_dependency_status_is_valid_v1(
          assertion_status, method_status
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  IF reference_range.laboratory_revision_id IS NOT NULL THEN
    SELECT entity.entity_type_code, revision.review_status
      INTO laboratory_type, laboratory_status
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = entity.id
       AND revision.id = reference_range.laboratory_revision_id
     WHERE entity.id = reference_range.laboratory_entity_id;
    IF NOT FOUND
       OR laboratory_type <> 'laboratory'
       OR public.kb_clinical_rule_dependency_status_is_valid_v1(
            assertion_status, laboratory_status
          ) IS DISTINCT FROM true
    THEN
      RETURN false;
    END IF;
  END IF;

  IF reference_range.population_group_revision_id IS NOT NULL THEN
    SELECT entity.entity_type_code, revision.review_status
      INTO population_type, population_status
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = entity.id
       AND revision.id = reference_range.population_group_revision_id
     WHERE entity.id = reference_range.population_group_entity_id;
    IF NOT FOUND
       OR population_type <> 'population_group'
       OR public.kb_clinical_rule_dependency_status_is_valid_v1(
            assertion_status, population_status
          ) IS DISTINCT FROM true
    THEN
      RETURN false;
    END IF;
  END IF;

  RETURN public.kb_lab_reference_range_payload_v1(reference_range.id) IS NOT NULL
     AND reference_range.range_content_hash =
         public.kb_lab_reference_range_hash_v1(reference_range.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_lab_finding_definition_revision_is_valid(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  entity_type text;
  revision_status text;
  stored_hash text;
  detail public.kb_lab_finding_definition_revision_details%ROWTYPE;
  basis_kind text;
  basis_status text;
  parameter_status text;
  range_kind text;
  range_lower_bound numeric;
  range_upper_bound numeric;
  range_assertion_status text;
BEGIN
  SELECT entity.entity_type_code, revision.review_status, revision.content_hash
    INTO entity_type, revision_status, stored_hash
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = _entity_revision_id
   WHERE entity.id = _entity_id;
  IF NOT FOUND OR entity_type <> 'lab_finding_definition' THEN
    RETURN false;
  END IF;

  SELECT stored_detail.*
    INTO detail
    FROM public.kb_lab_finding_definition_revision_details stored_detail
   WHERE stored_detail.entity_id = _entity_id
     AND stored_detail.entity_revision_id = _entity_revision_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT assertion.assertion_kind, assertion.review_status
    INTO basis_kind, basis_status
    FROM public.kb_assertions assertion
   WHERE assertion.id = detail.basis_assertion_id;
  IF NOT FOUND
     OR basis_kind <> 'classification'
     OR public.kb_clinical_rule_dependency_status_is_valid_v1(
          revision_status, basis_status
        ) IS DISTINCT FROM true
     OR public.kb_clinical_rule_sources_are_valid_v1(
          detail.basis_assertion_id, basis_status
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  SELECT revision.review_status
    INTO parameter_status
    FROM public.kb_entity_revisions revision
   WHERE revision.entity_id = detail.lab_parameter_entity_id
     AND revision.id = detail.lab_parameter_revision_id;
  IF NOT FOUND
     OR public.kb_lab_parameter_revision_is_valid(
          detail.lab_parameter_entity_id, detail.lab_parameter_revision_id
        ) IS DISTINCT FROM true
     OR public.kb_clinical_rule_dependency_status_is_valid_v1(
          revision_status, parameter_status
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  SELECT reference_range.range_kind, reference_range.lower_bound,
         reference_range.upper_bound, assertion.review_status
    INTO range_kind, range_lower_bound, range_upper_bound, range_assertion_status
    FROM public.kb_lab_reference_ranges reference_range
    JOIN public.kb_assertions assertion ON assertion.id = reference_range.assertion_id
   WHERE reference_range.id = detail.reference_range_id
     AND reference_range.lab_parameter_entity_id = detail.lab_parameter_entity_id
     AND reference_range.lab_parameter_revision_id = detail.lab_parameter_revision_id;
  IF NOT FOUND
     OR public.kb_lab_reference_range_is_valid(detail.reference_range_id)
        IS DISTINCT FROM true
     OR public.kb_clinical_rule_dependency_status_is_valid_v1(
          revision_status, range_assertion_status
        ) IS DISTINCT FROM true
      OR (range_kind = 'numeric_interval') IS DISTINCT FROM
         (detail.interpretation_kind IN ('below_range', 'within_range', 'above_range'))
      OR (detail.interpretation_kind = 'below_range' AND range_lower_bound IS NULL)
      OR (detail.interpretation_kind = 'above_range' AND range_upper_bound IS NULL)
  THEN
    RETURN false;
  END IF;

  RETURN public.kb_lab_finding_definition_revision_payload_v1(
           _entity_id, _entity_revision_id
         ) IS NOT NULL
     AND stored_hash = public.kb_lab_finding_definition_revision_hash_v1(
           _entity_id, _entity_revision_id
         );
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_lab_parameter_revision_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH candidate_revisions AS (
    SELECT entity.id AS entity_id, revision.id AS entity_revision_id
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision ON revision.entity_id = entity.id
     WHERE entity.entity_type_code = 'lab_parameter'
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_lab_parameter_revision_details detail
  )
  SELECT count(*)
    FROM candidate_revisions candidate
   WHERE public.kb_lab_parameter_revision_is_valid(
           candidate.entity_id, candidate.entity_revision_id
         ) IS DISTINCT FROM true
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_lab_reference_range_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(*)
    FROM public.kb_lab_reference_ranges reference_range
   WHERE public.kb_lab_reference_range_is_valid(reference_range.id)
         IS DISTINCT FROM true
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_lab_finding_definition_revision_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH candidate_revisions AS (
    SELECT entity.id AS entity_id, revision.id AS entity_revision_id
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision ON revision.entity_id = entity.id
     WHERE entity.entity_type_code = 'lab_finding_definition'
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_lab_finding_definition_revision_details detail
  )
  SELECT count(*)
    FROM candidate_revisions candidate
   WHERE public.kb_lab_finding_definition_revision_is_valid(
           candidate.entity_id, candidate.entity_revision_id
         ) IS DISTINCT FROM true
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_laboratory_identifier_dependency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  old_entity_id uuid;
  new_entity_id uuid;
  affected_entity_id uuid;
  locked_revision_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_entity_id := OLD.entity_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_entity_id := NEW.entity_id;
  END IF;

  FOR affected_entity_id IN
    SELECT DISTINCT entity.id
      FROM public.kb_entities entity
     WHERE entity.id IN (old_entity_id, new_entity_id)
       AND entity.entity_type_code = 'lab_parameter'
     ORDER BY entity.id
  LOOP
    SELECT pg_get_userbyid(relclass.relowner)
      INTO STRICT table_owner
      FROM pg_class relclass
     WHERE relclass.oid = TG_RELID;
    IF current_user <> table_owner THEN
      RAISE EXCEPTION 'Laboratory parameter identifier writes require the database table owner';
    END IF;

    FOR locked_revision_id IN
      SELECT revision.id
        FROM public.kb_entity_revisions revision
       WHERE revision.entity_id = affected_entity_id
       ORDER BY revision.id
    LOOP
      PERFORM 1
        FROM public.kb_entity_revisions revision
       WHERE revision.id = locked_revision_id
         FOR SHARE;
    END LOOP;

    IF EXISTS (
      SELECT 1
        FROM public.kb_entity_revisions revision
       WHERE revision.entity_id = affected_entity_id
         AND revision.review_status IN ('approved', 'released', 'superseded', 'withdrawn')
    ) THEN
      RAISE EXCEPTION 'Identifiers of approved, released or historical laboratory parameters are immutable';
    END IF;

    UPDATE public.kb_entities entity
       SET current_revision_id = entity.current_revision_id
     WHERE entity.id = affected_entity_id;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_laboratory_contract_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  changed_row jsonb;
  coordinating_revision_id uuid;
  coordinating_assertion_id uuid;
  coordinating_status text;
  direct_basis_assertion_id uuid;
  parameter_basis_assertion_id uuid;
  range_assertion_id uuid;
  target_parameter_entity_id uuid;
  target_parameter_revision_id uuid;
  diagnostic_method_revision_id uuid;
  laboratory_revision_id uuid;
  population_group_revision_id uuid;
  target_reference_range_id uuid;
  referenced_range public.kb_lab_reference_ranges%ROWTYPE;
  locked_revision_id uuid;
  locked_revision_ids uuid[];
  locked_entity_id uuid;
  locked_assertion_id uuid;
  locked_assertion_ids uuid[];
  locked_source_revision_id uuid;
  locked_source_id uuid;
BEGIN
  SELECT pg_get_userbyid(relclass.relowner)
    INTO STRICT table_owner
    FROM pg_class relclass
   WHERE relclass.oid = TG_RELID;
  IF current_user <> table_owner THEN
    RAISE EXCEPTION 'Laboratory contract writes require the database table owner';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'kb_lab_parameter_revision_details' AND (
      to_jsonb(NEW) -> 'entity_id' IS DISTINCT FROM to_jsonb(OLD) -> 'entity_id'
      OR to_jsonb(NEW) -> 'entity_revision_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'entity_revision_id'
      OR to_jsonb(NEW) -> 'parameter_schema_version'
         IS DISTINCT FROM to_jsonb(OLD) -> 'parameter_schema_version'
      OR to_jsonb(NEW) -> 'basis_assertion_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'basis_assertion_id'
      OR to_jsonb(NEW) -> 'created_at' IS DISTINCT FROM to_jsonb(OLD) -> 'created_at'
    ) THEN
      RAISE EXCEPTION 'Stable laboratory parameter fields are immutable';
    ELSIF TG_TABLE_NAME = 'kb_lab_reference_ranges' AND (
      to_jsonb(NEW) -> 'id' IS DISTINCT FROM to_jsonb(OLD) -> 'id'
      OR to_jsonb(NEW) -> 'range_schema_version'
         IS DISTINCT FROM to_jsonb(OLD) -> 'range_schema_version'
      OR to_jsonb(NEW) -> 'assertion_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'assertion_id'
      OR to_jsonb(NEW) -> 'created_at' IS DISTINCT FROM to_jsonb(OLD) -> 'created_at'
    ) THEN
      RAISE EXCEPTION 'Stable laboratory reference range fields are immutable';
    ELSIF TG_TABLE_NAME = 'kb_lab_finding_definition_revision_details' AND (
      to_jsonb(NEW) -> 'entity_id' IS DISTINCT FROM to_jsonb(OLD) -> 'entity_id'
      OR to_jsonb(NEW) -> 'entity_revision_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'entity_revision_id'
      OR to_jsonb(NEW) -> 'finding_schema_version'
         IS DISTINCT FROM to_jsonb(OLD) -> 'finding_schema_version'
      OR to_jsonb(NEW) -> 'basis_assertion_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'basis_assertion_id'
      OR to_jsonb(NEW) -> 'created_at' IS DISTINCT FROM to_jsonb(OLD) -> 'created_at'
    ) THEN
      RAISE EXCEPTION 'Stable laboratory finding fields are immutable';
    END IF;
  END IF;

  changed_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  IF TG_TABLE_NAME = 'kb_lab_parameter_revision_details' THEN
    coordinating_revision_id := (changed_row ->> 'entity_revision_id')::uuid;
    direct_basis_assertion_id := (changed_row ->> 'basis_assertion_id')::uuid;
    target_parameter_entity_id := (changed_row ->> 'entity_id')::uuid;
    target_parameter_revision_id := coordinating_revision_id;
  ELSIF TG_TABLE_NAME = 'kb_lab_reference_ranges' THEN
    coordinating_assertion_id := (changed_row ->> 'assertion_id')::uuid;
    target_parameter_entity_id := (changed_row ->> 'lab_parameter_entity_id')::uuid;
    target_parameter_revision_id := (changed_row ->> 'lab_parameter_revision_id')::uuid;
    diagnostic_method_revision_id := (changed_row ->> 'diagnostic_method_revision_id')::uuid;
    laboratory_revision_id := (changed_row ->> 'laboratory_revision_id')::uuid;
    population_group_revision_id := (changed_row ->> 'population_group_revision_id')::uuid;
  ELSE
    coordinating_revision_id := (changed_row ->> 'entity_revision_id')::uuid;
    direct_basis_assertion_id := (changed_row ->> 'basis_assertion_id')::uuid;
    target_parameter_entity_id := (changed_row ->> 'lab_parameter_entity_id')::uuid;
    target_parameter_revision_id := (changed_row ->> 'lab_parameter_revision_id')::uuid;
    target_reference_range_id := (changed_row ->> 'reference_range_id')::uuid;
    SELECT stored_range.*
      INTO referenced_range
      FROM public.kb_lab_reference_ranges stored_range
     WHERE stored_range.id = target_reference_range_id;
    IF FOUND THEN
      range_assertion_id := referenced_range.assertion_id;
      diagnostic_method_revision_id := referenced_range.diagnostic_method_revision_id;
      laboratory_revision_id := referenced_range.laboratory_revision_id;
      population_group_revision_id := referenced_range.population_group_revision_id;
    END IF;
  END IF;

  SELECT detail.basis_assertion_id
    INTO parameter_basis_assertion_id
    FROM public.kb_lab_parameter_revision_details detail
   WHERE detail.entity_id = target_parameter_entity_id
     AND detail.entity_revision_id = target_parameter_revision_id;

  SELECT array_agg(DISTINCT revision_id ORDER BY revision_id)
    INTO locked_revision_ids
    FROM unnest(ARRAY[
      coordinating_revision_id,
      target_parameter_revision_id,
      diagnostic_method_revision_id,
      laboratory_revision_id,
      population_group_revision_id
    ]) dependency(revision_id)
   WHERE revision_id IS NOT NULL;

  FOREACH locked_revision_id IN ARRAY COALESCE(locked_revision_ids, ARRAY[]::uuid[])
  LOOP
    PERFORM 1
      FROM public.kb_entity_revisions revision
     WHERE revision.id = locked_revision_id
       FOR SHARE;
  END LOOP;

  -- Child dependencies are locked before their coordinating entity rows. A
  -- parameter writer never requests a range lock, so this order cannot form a
  -- parameter-detail/range or range/finding cycle.
  IF TG_TABLE_NAME <> 'kb_lab_parameter_revision_details' THEN
    PERFORM 1
      FROM public.kb_lab_parameter_revision_details detail
     WHERE detail.entity_id = target_parameter_entity_id
       AND detail.entity_revision_id = target_parameter_revision_id
       FOR SHARE;
  END IF;
  IF target_reference_range_id IS NOT NULL THEN
    PERFORM 1
      FROM public.kb_lab_reference_ranges stored_range
     WHERE stored_range.id = target_reference_range_id
       FOR SHARE;
  END IF;

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

  SELECT array_agg(DISTINCT assertion_id ORDER BY assertion_id)
    INTO locked_assertion_ids
    FROM unnest(ARRAY[
      coordinating_assertion_id,
      direct_basis_assertion_id,
      parameter_basis_assertion_id,
      range_assertion_id
    ]) dependency(assertion_id)
   WHERE assertion_id IS NOT NULL;

  FOR locked_source_revision_id IN
    SELECT revision.id
      FROM public.kb_source_revisions revision
     WHERE revision.id IN (
       SELECT binding.source_revision_id
         FROM public.kb_assertion_sources binding
        WHERE binding.assertion_id = ANY(
          COALESCE(locked_assertion_ids, ARRAY[]::uuid[])
        )
     )
     ORDER BY revision.id
  LOOP
    PERFORM 1
      FROM public.kb_source_revisions revision
     WHERE revision.id = locked_source_revision_id
       FOR SHARE;
  END LOOP;

  FOR locked_source_id IN
    SELECT DISTINCT revision.source_id
      FROM public.kb_source_revisions revision
      JOIN public.kb_assertion_sources binding
        ON binding.source_revision_id = revision.id
     WHERE binding.assertion_id = ANY(
       COALESCE(locked_assertion_ids, ARRAY[]::uuid[])
     )
     ORDER BY revision.source_id
  LOOP
    UPDATE public.kb_sources source
       SET current_revision_id = source.current_revision_id
     WHERE source.id = locked_source_id;
  END LOOP;

  FOREACH locked_assertion_id IN ARRAY COALESCE(locked_assertion_ids, ARRAY[]::uuid[])
  LOOP
    UPDATE public.kb_assertions assertion
       SET content_hash = assertion.content_hash
     WHERE assertion.id = locked_assertion_id
       AND assertion.review_status NOT IN ('released', 'superseded', 'withdrawn');
    IF NOT FOUND THEN
      PERFORM 1
        FROM public.kb_assertions assertion
       WHERE assertion.id = locked_assertion_id
         FOR UPDATE;
    END IF;
  END LOOP;

  IF coordinating_revision_id IS NOT NULL THEN
    SELECT revision.review_status
      INTO coordinating_status
      FROM public.kb_entity_revisions revision
     WHERE revision.id = coordinating_revision_id;
  ELSE
    SELECT assertion.review_status
      INTO coordinating_status
      FROM public.kb_assertions assertion
     WHERE assertion.id = coordinating_assertion_id;
  END IF;
  IF coordinating_status IS NULL THEN
    RAISE EXCEPTION 'Laboratory details require an existing coordinating revision or assertion';
  END IF;
  IF coordinating_status IN ('approved', 'released', 'superseded', 'withdrawn') THEN
    RAISE EXCEPTION 'Approved, released or historical laboratory content is immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_lock_laboratory_assertion_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  old_assertion_id uuid;
  new_assertion_id uuid;
  affected_assertion_id uuid;
  affected_assertion_ids uuid[];
  participating_assertion_ids uuid[];
  locked_revision_id uuid;
  locked_source_id uuid;
  content_changed boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_assertion_id := OLD.assertion_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_assertion_id := NEW.assertion_id;
  END IF;

  SELECT array_agg(assertion.id ORDER BY assertion.id)
    INTO participating_assertion_ids
    FROM public.kb_assertions assertion
   WHERE assertion.id IN (old_assertion_id, new_assertion_id)
     AND (
       EXISTS (
         SELECT 1 FROM public.kb_lab_parameter_revision_details detail
          WHERE detail.basis_assertion_id = assertion.id
       )
       OR EXISTS (
         SELECT 1 FROM public.kb_lab_reference_ranges reference_range
          WHERE reference_range.assertion_id = assertion.id
       )
       OR EXISTS (
         SELECT 1 FROM public.kb_lab_finding_definition_revision_details detail
          WHERE detail.basis_assertion_id = assertion.id
        )
      );

  content_changed := TG_OP <> 'UPDATE'
    OR to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD);
  IF content_changed
     AND cardinality(COALESCE(participating_assertion_ids, ARRAY[]::uuid[])) > 0
  THEN
    SELECT pg_get_userbyid(relclass.relowner)
      INTO STRICT table_owner
      FROM pg_class relclass
     WHERE relclass.oid = TG_RELID;
    IF current_user <> table_owner THEN
      RAISE EXCEPTION 'Laboratory assertion-source writes require the database table owner';
    END IF;
  END IF;

  SELECT array_agg(assertion.id ORDER BY assertion.id)
    INTO affected_assertion_ids
    FROM public.kb_assertions assertion
   WHERE assertion.id IN (old_assertion_id, new_assertion_id)
     AND (
       -- Classification assertions must be version-locked before their first
       -- laboratory dependency can become visible in another transaction.
       assertion.assertion_kind = 'classification'
       OR assertion.id = ANY(
         COALESCE(participating_assertion_ids, ARRAY[]::uuid[])
       )
     );

  IF cardinality(COALESCE(affected_assertion_ids, ARRAY[]::uuid[])) = 0 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  FOR locked_revision_id IN
    SELECT revision.id
      FROM public.kb_source_revisions revision
     WHERE revision.id IN (
       CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.source_revision_id END,
       CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.source_revision_id END
     )
     ORDER BY revision.id
  LOOP
    PERFORM 1 FROM public.kb_source_revisions revision
     WHERE revision.id = locked_revision_id FOR SHARE;
  END LOOP;

  FOR locked_source_id IN
    SELECT DISTINCT revision.source_id
      FROM public.kb_source_revisions revision
     WHERE revision.id IN (
       CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.source_revision_id END,
       CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.source_revision_id END
     )
     ORDER BY revision.source_id
  LOOP
    UPDATE public.kb_sources source
       SET current_revision_id = source.current_revision_id
     WHERE source.id = locked_source_id;
  END LOOP;

  FOREACH affected_assertion_id IN ARRAY affected_assertion_ids
  LOOP
    UPDATE public.kb_assertions assertion
       SET content_hash = assertion.content_hash
     WHERE assertion.id = affected_assertion_id
       AND assertion.review_status NOT IN ('released', 'superseded', 'withdrawn');
    IF NOT FOUND THEN
      PERFORM 1
        FROM public.kb_assertions assertion
       WHERE assertion.id = affected_assertion_id
         FOR UPDATE;
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_lock_laboratory_revision_dependents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  old_revision_id uuid;
  new_revision_id uuid;
  old_parent_id uuid;
  new_parent_id uuid;
  locked_parent_id uuid;
  locked_assertion_id uuid;
  content_changed boolean;
  participates boolean;
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

  content_changed := TG_OP <> 'UPDATE'
    OR (
      to_jsonb(NEW)
        - 'review_status' - 'reviewed_at' - 'reviewed_by'
        - 'released_at' - 'review_due_at'
    ) IS DISTINCT FROM (
      to_jsonb(OLD)
        - 'review_status' - 'reviewed_at' - 'reviewed_by'
        - 'released_at' - 'review_due_at'
    );

  IF content_changed THEN
    IF TG_TABLE_NAME = 'kb_source_revisions' THEN
      SELECT EXISTS (
        SELECT 1
          FROM public.kb_assertion_sources binding
         WHERE binding.source_revision_id IN (old_revision_id, new_revision_id)
           AND (
             EXISTS (
               SELECT 1 FROM public.kb_lab_parameter_revision_details detail
                WHERE detail.basis_assertion_id = binding.assertion_id
             )
             OR EXISTS (
               SELECT 1 FROM public.kb_lab_reference_ranges reference_range
                WHERE reference_range.assertion_id = binding.assertion_id
             )
             OR EXISTS (
               SELECT 1 FROM public.kb_lab_finding_definition_revision_details detail
                WHERE detail.basis_assertion_id = binding.assertion_id
             )
           )
      ) INTO participates;
    ELSE
      SELECT
        EXISTS (
          SELECT 1 FROM public.kb_lab_parameter_revision_details detail
           WHERE detail.entity_revision_id IN (old_revision_id, new_revision_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.kb_lab_finding_definition_revision_details detail
           WHERE detail.entity_revision_id IN (old_revision_id, new_revision_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.kb_lab_reference_ranges reference_range
           WHERE reference_range.lab_parameter_revision_id IN (old_revision_id, new_revision_id)
              OR reference_range.diagnostic_method_revision_id IN (old_revision_id, new_revision_id)
              OR reference_range.laboratory_revision_id IN (old_revision_id, new_revision_id)
              OR reference_range.population_group_revision_id IN (old_revision_id, new_revision_id)
        )
        INTO participates;
    END IF;

    IF participates THEN
      SELECT pg_get_userbyid(relclass.relowner)
        INTO STRICT table_owner
        FROM pg_class relclass
       WHERE relclass.oid = TG_RELID;
      IF current_user <> table_owner THEN
        RAISE EXCEPTION 'Laboratory dependency content changes require the database table owner';
      END IF;
    END IF;
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
      SELECT reference_range.assertion_id
        FROM public.kb_lab_reference_ranges reference_range
       WHERE TG_TABLE_NAME = 'kb_entity_revisions'
         AND (
           reference_range.lab_parameter_revision_id IN (old_revision_id, new_revision_id)
           OR reference_range.diagnostic_method_revision_id IN (old_revision_id, new_revision_id)
           OR reference_range.laboratory_revision_id IN (old_revision_id, new_revision_id)
           OR reference_range.population_group_revision_id IN (old_revision_id, new_revision_id)
         )
    )
    SELECT assertion.id
      FROM public.kb_assertions assertion
     WHERE assertion.id IN (SELECT assertion_id FROM affected_assertions)
       AND (
         EXISTS (SELECT 1 FROM public.kb_lab_reference_ranges reference_range
                  WHERE reference_range.assertion_id = assertion.id)
         OR EXISTS (SELECT 1 FROM public.kb_lab_parameter_revision_details detail
                    WHERE detail.basis_assertion_id = assertion.id)
         OR EXISTS (SELECT 1 FROM public.kb_lab_finding_definition_revision_details detail
                    WHERE detail.basis_assertion_id = assertion.id)
       )
     ORDER BY assertion.id
  LOOP
    UPDATE public.kb_assertions assertion
       SET content_hash = assertion.content_hash
     WHERE assertion.id = locked_assertion_id
       AND assertion.review_status NOT IN ('released', 'superseded', 'withdrawn');
    IF NOT FOUND THEN
      PERFORM 1
        FROM public.kb_assertions assertion
       WHERE assertion.id = locked_assertion_id
         FOR UPDATE;
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_laboratory_assertion_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  old_assertion_id uuid;
  new_assertion_id uuid;
  content_changed boolean;
  participates boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_assertion_id := OLD.id; END IF;
  IF TG_OP <> 'DELETE' THEN new_assertion_id := NEW.id; END IF;

  content_changed := TG_OP <> 'UPDATE'
    OR (
      to_jsonb(NEW)
        - 'review_status' - 'reviewed_at' - 'reviewed_by'
        - 'released_at' - 'review_due_at'
    ) IS DISTINCT FROM (
      to_jsonb(OLD)
        - 'review_status' - 'reviewed_at' - 'reviewed_by'
        - 'released_at' - 'review_due_at'
    );

  SELECT
    EXISTS (
      SELECT 1 FROM public.kb_lab_parameter_revision_details detail
       WHERE detail.basis_assertion_id IN (old_assertion_id, new_assertion_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.kb_lab_reference_ranges reference_range
       WHERE reference_range.assertion_id IN (old_assertion_id, new_assertion_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.kb_lab_finding_definition_revision_details detail
       WHERE detail.basis_assertion_id IN (old_assertion_id, new_assertion_id)
    )
    INTO participates;

  IF content_changed AND participates THEN
    SELECT pg_get_userbyid(relclass.relowner)
      INTO STRICT table_owner
      FROM pg_class relclass
     WHERE relclass.oid = TG_RELID;
    IF current_user <> table_owner THEN
      RAISE EXCEPTION 'Laboratory assertion content changes require the database table owner';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.review_status = 'approved'
     AND NEW.review_status = 'draft'
     AND EXISTS (
       SELECT 1
         FROM public.kb_lab_reference_ranges reference_range
        WHERE reference_range.assertion_id = OLD.id
     )
  THEN
    RAISE EXCEPTION 'Approved laboratory range assertions cannot return to draft';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_laboratory_entity_revision_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.review_status = 'approved'
     AND NEW.review_status = 'draft'
     AND (
       EXISTS (
         SELECT 1 FROM public.kb_lab_parameter_revision_details detail
          WHERE detail.entity_revision_id = OLD.id
       )
       OR EXISTS (
         SELECT 1 FROM public.kb_lab_finding_definition_revision_details detail
          WHERE detail.entity_revision_id = OLD.id
       )
     )
  THEN
    RAISE EXCEPTION 'Approved laboratory entity revisions cannot return to draft';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_validate_laboratory_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  old_row jsonb := '{}'::jsonb;
  new_row jsonb := '{}'::jsonb;
  affected_entity_ids uuid[] := ARRAY[]::uuid[];
  affected_revision_ids uuid[] := ARRAY[]::uuid[];
  affected_parameter_revision_ids uuid[] := ARRAY[]::uuid[];
  affected_finding_revision_ids uuid[] := ARRAY[]::uuid[];
  affected_assertion_ids uuid[] := ARRAY[]::uuid[];
  affected_source_revision_ids uuid[] := ARRAY[]::uuid[];
  affected_range_ids uuid[] := ARRAY[]::uuid[];
  has_invalid boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;

  -- Lock-generated no-op updates do not create new validation work.
  IF TG_OP = 'UPDATE' AND old_row IS NOT DISTINCT FROM new_row THEN
    RETURN NULL;
  END IF;
  CASE TG_TABLE_NAME
    WHEN 'kb_lab_parameter_revision_details' THEN
      affected_parameter_revision_ids := array_remove(ARRAY[
        (old_row ->> 'entity_revision_id')::uuid,
        (new_row ->> 'entity_revision_id')::uuid
      ], NULL);
    WHEN 'kb_lab_reference_ranges' THEN
      affected_range_ids := array_remove(ARRAY[
        (old_row ->> 'id')::uuid,
        (new_row ->> 'id')::uuid
      ], NULL);
    WHEN 'kb_lab_finding_definition_revision_details' THEN
      affected_finding_revision_ids := array_remove(ARRAY[
        (old_row ->> 'entity_revision_id')::uuid,
        (new_row ->> 'entity_revision_id')::uuid
      ], NULL);
    WHEN 'kb_assertions' THEN
      affected_assertion_ids := array_remove(ARRAY[
        (old_row ->> 'id')::uuid,
        (new_row ->> 'id')::uuid
      ], NULL);
    WHEN 'kb_assertion_sources' THEN
      affected_assertion_ids := array_remove(ARRAY[
        (old_row ->> 'assertion_id')::uuid,
        (new_row ->> 'assertion_id')::uuid
      ], NULL);
      affected_source_revision_ids := array_remove(ARRAY[
        (old_row ->> 'source_revision_id')::uuid,
        (new_row ->> 'source_revision_id')::uuid
      ], NULL);
    WHEN 'kb_entity_revisions' THEN
      affected_revision_ids := array_remove(ARRAY[
        (old_row ->> 'id')::uuid,
        (new_row ->> 'id')::uuid
      ], NULL);
    WHEN 'kb_source_revisions' THEN
      affected_source_revision_ids := array_remove(ARRAY[
        (old_row ->> 'id')::uuid,
        (new_row ->> 'id')::uuid
      ], NULL);
    WHEN 'kb_entity_identifiers' THEN
      affected_entity_ids := array_remove(ARRAY[
        (old_row ->> 'entity_id')::uuid,
        (new_row ->> 'entity_id')::uuid
      ], NULL);
    ELSE
      RETURN NULL;
  END CASE;

  WITH affected_assertions AS MATERIALIZED (
    SELECT seed.assertion_id
      FROM unnest(affected_assertion_ids) seed(assertion_id)
    UNION
    SELECT binding.assertion_id
      FROM public.kb_assertion_sources binding
     WHERE binding.source_revision_id = ANY(affected_source_revision_ids)
  ),
  affected_parameters AS MATERIALIZED (
    SELECT entity.id AS entity_id, revision.id AS entity_revision_id
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision ON revision.entity_id = entity.id
     WHERE entity.entity_type_code = 'lab_parameter'
       AND entity.id = ANY(affected_entity_ids)
    UNION
    SELECT entity.id, revision.id
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision ON revision.entity_id = entity.id
     WHERE entity.entity_type_code = 'lab_parameter'
       AND revision.id = ANY(
         affected_revision_ids || affected_parameter_revision_ids
       )
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_lab_parameter_revision_details detail
     WHERE detail.entity_id = ANY(affected_entity_ids)
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_lab_parameter_revision_details detail
     WHERE detail.entity_revision_id = ANY(
       affected_revision_ids || affected_parameter_revision_ids
     )
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_lab_parameter_revision_details detail
     WHERE detail.basis_assertion_id IN (
       SELECT assertion_id FROM affected_assertions
     )
  ),
  affected_ranges AS MATERIALIZED (
    SELECT reference_range.id
      FROM public.kb_lab_reference_ranges reference_range
     WHERE reference_range.id = ANY(affected_range_ids)
    UNION
    SELECT reference_range.id
      FROM public.kb_lab_reference_ranges reference_range
     WHERE reference_range.assertion_id IN (
       SELECT assertion_id FROM affected_assertions
     )
    UNION
    SELECT reference_range.id
      FROM public.kb_lab_reference_ranges reference_range
     WHERE reference_range.lab_parameter_revision_id IN (
       SELECT entity_revision_id FROM affected_parameters
     )
    UNION
    SELECT reference_range.id
      FROM public.kb_lab_reference_ranges reference_range
     WHERE reference_range.lab_parameter_revision_id = ANY(affected_revision_ids)
    UNION
    SELECT reference_range.id
      FROM public.kb_lab_reference_ranges reference_range
     WHERE reference_range.diagnostic_method_revision_id = ANY(affected_revision_ids)
    UNION
    SELECT reference_range.id
      FROM public.kb_lab_reference_ranges reference_range
     WHERE reference_range.laboratory_revision_id = ANY(affected_revision_ids)
    UNION
    SELECT reference_range.id
      FROM public.kb_lab_reference_ranges reference_range
     WHERE reference_range.population_group_revision_id = ANY(affected_revision_ids)
  ),
  affected_findings AS MATERIALIZED (
    SELECT entity.id AS entity_id, revision.id AS entity_revision_id
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision ON revision.entity_id = entity.id
     WHERE entity.entity_type_code = 'lab_finding_definition'
       AND entity.id = ANY(affected_entity_ids)
    UNION
    SELECT entity.id, revision.id
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision ON revision.entity_id = entity.id
     WHERE entity.entity_type_code = 'lab_finding_definition'
       AND revision.id = ANY(
         affected_revision_ids || affected_finding_revision_ids
       )
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_lab_finding_definition_revision_details detail
     WHERE detail.entity_id = ANY(affected_entity_ids)
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_lab_finding_definition_revision_details detail
     WHERE detail.entity_revision_id = ANY(
       affected_revision_ids || affected_finding_revision_ids
     )
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_lab_finding_definition_revision_details detail
     WHERE detail.basis_assertion_id IN (
       SELECT assertion_id FROM affected_assertions
     )
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_lab_finding_definition_revision_details detail
     WHERE detail.lab_parameter_revision_id IN (
       SELECT entity_revision_id FROM affected_parameters
     )
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_lab_finding_definition_revision_details detail
     WHERE detail.reference_range_id IN (
       SELECT id FROM affected_ranges
     )
  ),
  invalid_targets AS (
    SELECT 1
      FROM affected_parameters target
     WHERE public.kb_lab_parameter_revision_is_valid(
             target.entity_id, target.entity_revision_id
           ) IS DISTINCT FROM true
    UNION ALL
    SELECT 1
      FROM affected_ranges target
     WHERE public.kb_lab_reference_range_is_valid(target.id)
           IS DISTINCT FROM true
    UNION ALL
    SELECT 1
      FROM affected_findings target
     WHERE public.kb_lab_finding_definition_revision_is_valid(
             target.entity_id, target.entity_revision_id
           ) IS DISTINCT FROM true
  )
  SELECT EXISTS (SELECT 1 FROM invalid_targets) INTO has_invalid;

  IF has_invalid THEN
    RAISE EXCEPTION 'Laboratory contract is incomplete, unreviewed, unsourced or has an invalid content hash';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_prevent_laboratory_contract_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Laboratory contract tables cannot be truncated';
END;
$$;

CREATE TRIGGER kb_lab_parameter_revision_details_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_lab_parameter_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_laboratory_contract_write();
CREATE TRIGGER kb_lab_reference_ranges_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_lab_reference_ranges
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_laboratory_contract_write();
CREATE TRIGGER kb_lab_finding_definition_revision_details_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_lab_finding_definition_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_laboratory_contract_write();
CREATE TRIGGER kb_entity_identifiers_protect_laboratory_contract
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_entity_identifiers
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_laboratory_identifier_dependency();

CREATE TRIGGER kb_assertion_sources_lock_laboratory_contract
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_assertion_sources
  FOR EACH ROW EXECUTE FUNCTION public.kb_lock_laboratory_assertion_source();
CREATE TRIGGER kb_entity_revisions_lock_laboratory_contract
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_entity_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_lock_laboratory_revision_dependents();
CREATE TRIGGER kb_source_revisions_lock_laboratory_contract
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_source_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_lock_laboratory_revision_dependents();
CREATE TRIGGER kb_assertions_protect_laboratory_status
  BEFORE UPDATE OR DELETE ON public.kb_assertions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_laboratory_assertion_status();
CREATE TRIGGER kb_entity_revisions_protect_laboratory_status
  BEFORE UPDATE ON public.kb_entity_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_laboratory_entity_revision_status();

CREATE TRIGGER kb_lab_parameter_revision_details_prevent_truncate
  BEFORE TRUNCATE ON public.kb_lab_parameter_revision_details
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_prevent_laboratory_contract_truncate();
CREATE TRIGGER kb_lab_reference_ranges_prevent_truncate
  BEFORE TRUNCATE ON public.kb_lab_reference_ranges
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_prevent_laboratory_contract_truncate();
CREATE TRIGGER kb_lab_finding_definition_revision_details_prevent_truncate
  BEFORE TRUNCATE ON public.kb_lab_finding_definition_revision_details
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_prevent_laboratory_contract_truncate();
CREATE TRIGGER kb_entity_identifiers_prevent_laboratory_contract_truncate
  BEFORE TRUNCATE ON public.kb_entity_identifiers
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_prevent_laboratory_contract_truncate();
CREATE TRIGGER kb_assertion_sources_prevent_laboratory_contract_truncate
  BEFORE TRUNCATE ON public.kb_assertion_sources
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_prevent_laboratory_contract_truncate();

CREATE CONSTRAINT TRIGGER kb_lab_parameter_revision_details_validate_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_lab_parameter_revision_details
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_laboratory_contract();
CREATE CONSTRAINT TRIGGER kb_lab_reference_ranges_validate_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_lab_reference_ranges
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_laboratory_contract();
CREATE CONSTRAINT TRIGGER kb_lab_finding_definition_revision_details_validate_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_lab_finding_definition_revision_details
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_laboratory_contract();
CREATE CONSTRAINT TRIGGER kb_assertions_validate_laboratory_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_assertions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_laboratory_contract();
CREATE CONSTRAINT TRIGGER kb_assertion_sources_validate_laboratory_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_assertion_sources
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_laboratory_contract();
CREATE CONSTRAINT TRIGGER kb_entity_revisions_validate_laboratory_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_entity_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_laboratory_contract();
CREATE CONSTRAINT TRIGGER kb_source_revisions_validate_laboratory_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_source_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_laboratory_contract();
CREATE CONSTRAINT TRIGGER kb_entity_identifiers_validate_laboratory_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_entity_identifiers
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_laboratory_contract();

ALTER TABLE public.kb_lab_parameter_revision_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_lab_reference_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_lab_finding_definition_revision_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_lab_parameter_revision_details_admin_read
  ON public.kb_lab_parameter_revision_details
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY kb_lab_reference_ranges_admin_read
  ON public.kb_lab_reference_ranges
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY kb_lab_finding_definition_revision_details_admin_read
  ON public.kb_lab_finding_definition_revision_details
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE
  public.kb_lab_parameter_revision_details,
  public.kb_lab_reference_ranges,
  public.kb_lab_finding_definition_revision_details
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT SELECT ON TABLE
  public.kb_lab_parameter_revision_details,
  public.kb_lab_reference_ranges,
  public.kb_lab_finding_definition_revision_details
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.kb_lab_unit_is_valid_v1(text, text)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lab_qualitative_code_array_is_valid_v1(text[])
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_laboratory_entity_revision_payload_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_laboratory_source_revision_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_laboratory_assertion_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lab_parameter_revision_payload_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lab_parameter_revision_hash_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lab_reference_range_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lab_reference_range_hash_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lab_finding_definition_revision_payload_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lab_finding_definition_revision_hash_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lab_parameter_revision_is_valid(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lab_reference_range_is_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lab_finding_definition_revision_is_valid(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_lab_parameter_revision_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_lab_reference_range_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_lab_finding_definition_revision_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_laboratory_identifier_dependency()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_laboratory_contract_write()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lock_laboratory_assertion_source()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lock_laboratory_revision_dependents()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_laboratory_assertion_status()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_laboratory_entity_revision_status()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_validate_laboratory_contract()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_prevent_laboratory_contract_truncate()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

ALTER FUNCTION public.kb_export_wiki_snapshot()
  RENAME TO kb_export_wiki_snapshot_4b2a;
REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot_4b2a()
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
  snapshot := public.kb_export_wiki_snapshot_4b2a();
  RETURN jsonb_set(
    snapshot,
    '{validation}',
    (snapshot -> 'validation') || jsonb_build_object(
      'invalid_lab_parameter_revisions',
        public.kb_invalid_lab_parameter_revision_count(),
      'invalid_lab_reference_ranges',
        public.kb_invalid_lab_reference_range_count(),
      'invalid_lab_finding_definition_revisions',
        public.kb_invalid_lab_finding_definition_revision_count()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT EXECUTE ON FUNCTION public.kb_export_wiki_snapshot()
  TO service_role;

COMMIT;
