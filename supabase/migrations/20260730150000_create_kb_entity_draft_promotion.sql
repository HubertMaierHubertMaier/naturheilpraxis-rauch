BEGIN;

LOCK TABLE
  public.kb_import_batches,
  public.kb_entity_candidates,
  public.kb_entity_candidate_contracts,
  public.kb_review_decisions,
  public.kb_source_candidate_draft_promotions,
  public.kb_entities,
  public.kb_entity_revisions,
  public.kb_assertions
IN SHARE ROW EXCLUSIVE MODE;

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
  IF to_regprocedure('public.kb_entity_candidate_promotion_readiness(uuid)') IS NULL
     OR to_regprocedure('public.kb_entity_candidate_contract_hash(uuid,text,jsonb)') IS NULL
     OR to_regprocedure('public.kb_therapeutic_revision_hash(uuid,uuid)') IS NULL
     OR to_regprocedure('public.kb_source_candidate_promotion_is_valid(uuid)') IS NULL
  THEN
    RAISE EXCEPTION 'Entity draft promotion requires the complete Step 2A schema';
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
    RAISE EXCEPTION 'Entity draft promotion requires the exact 48-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.kb_entities entity
     WHERE entity.metadata ? 'entity_candidate_id'
    UNION ALL
    SELECT 1 FROM public.kb_entity_revisions revision
     WHERE revision.metadata ? 'entity_candidate_id'
    UNION ALL
    SELECT 1 FROM public.kb_assertions assertion
     WHERE assertion.metadata ? 'entity_candidate_id'
        OR assertion.metadata ? 'entity_candidate_assertion_id'
  ) THEN
    RAISE EXCEPTION 'Reserved entity candidate import provenance already exists';
  END IF;
END;
$$;

CREATE TABLE public.kb_entity_candidate_draft_promotions (
  entity_candidate_id uuid PRIMARY KEY,
  batch_id uuid NOT NULL,
  review_decision_id uuid NOT NULL UNIQUE
    REFERENCES public.kb_review_decisions(id) ON DELETE RESTRICT,
  entity_id uuid NOT NULL UNIQUE,
  entity_revision_id uuid NOT NULL UNIQUE,
  contract_hash text NOT NULL CHECK (contract_hash ~ '^[0-9a-f]{64}$'),
  input_manifest jsonb NOT NULL CHECK (jsonb_typeof(input_manifest) = 'object'),
  input_manifest_hash text NOT NULL CHECK (input_manifest_hash ~ '^[0-9a-f]{64}$'),
  candidate_owned_hash text NOT NULL CHECK (candidate_owned_hash ~ '^[0-9a-f]{64}$'),
  discarded_proposed_data_hash text NOT NULL
    CHECK (discarded_proposed_data_hash ~ '^[0-9a-f]{64}$'),
  resolution_manifest jsonb NOT NULL CHECK (jsonb_typeof(resolution_manifest) = 'object'),
  resolution_manifest_hash text NOT NULL CHECK (resolution_manifest_hash ~ '^[0-9a-f]{64}$'),
  initial_content_hash text NOT NULL CHECK (initial_content_hash ~ '^[0-9a-f]{64}$'),
  conversion_version integer NOT NULL DEFAULT 1 CHECK (conversion_version = 1),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  promoted_at timestamptz NOT NULL DEFAULT now(),
  promoted_by uuid NOT NULL,
  FOREIGN KEY (batch_id, entity_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (entity_id, entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE public.kb_entity_candidate_draft_promotion_assertions (
  entity_candidate_assertion_id uuid PRIMARY KEY,
  entity_candidate_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  assertion_id uuid NOT NULL UNIQUE
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  claim_key text NOT NULL
    CHECK (claim_key ~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'),
  initial_content_hash text NOT NULL CHECK (initial_content_hash ~ '^[0-9a-f]{64}$'),
  conversion_version integer NOT NULL DEFAULT 1 CHECK (conversion_version = 1),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  FOREIGN KEY (entity_candidate_id)
    REFERENCES public.kb_entity_candidate_draft_promotions(entity_candidate_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (batch_id, entity_candidate_id, entity_candidate_assertion_id)
    REFERENCES public.kb_entity_candidate_assertions(batch_id, entity_candidate_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX kb_entity_candidate_draft_promotion_assertions_candidate_idx
  ON public.kb_entity_candidate_draft_promotion_assertions(entity_candidate_id);

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_canonical_jsonb_v1(_value jsonb)
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
               public.kb_entity_candidate_canonical_jsonb_v1(item.value)
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
               public.kb_entity_candidate_canonical_jsonb_v1(item.value)
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

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_draft_promotion_input_manifest(
  _entity_candidate_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'manifest_version', 1,
    'candidate', (
      to_jsonb(candidate) - ARRAY['proposed_data', 'created_at', 'reviewed_at']
      || jsonb_build_object(
        'reviewed_at_epoch', extract(epoch FROM candidate.reviewed_at)::text
      )
    ),
    'contract', (
      to_jsonb(contract) - 'sealed_at'
      || jsonb_build_object('sealed_at_epoch', extract(epoch FROM contract.sealed_at)::text)
    ),
    'names', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(candidate_name) - 'created_at'
        ORDER BY candidate_name.name_order, candidate_name.id
      )
        FROM public.kb_entity_candidate_names candidate_name
       WHERE candidate_name.entity_candidate_id = _entity_candidate_id
    ), '[]'::jsonb),
    'assertions', COALESCE((
      SELECT jsonb_agg(to_jsonb(candidate_assertion) - 'created_at'
                       ORDER BY candidate_assertion.assertion_order, candidate_assertion.id)
        FROM public.kb_entity_candidate_assertions candidate_assertion
       WHERE candidate_assertion.entity_candidate_id = _entity_candidate_id
    ), '[]'::jsonb),
    'assertion_sources', COALESCE((
      SELECT jsonb_agg(to_jsonb(candidate_source) - 'created_at'
                       ORDER BY candidate_source.assertion_candidate_id,
                                candidate_source.source_order,
                                candidate_source.id)
        FROM public.kb_entity_candidate_assertion_sources candidate_source
       WHERE candidate_source.entity_candidate_id = _entity_candidate_id
    ), '[]'::jsonb),
    'preparation', (
      SELECT to_jsonb(detail) - 'created_at'
        FROM public.kb_entity_candidate_preparation_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
    ),
    'homeopathic', (
      SELECT to_jsonb(detail) - 'created_at'
        FROM public.kb_entity_candidate_homeopathic_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
    ),
    'botanical', (
      SELECT to_jsonb(detail) - 'created_at'
        FROM public.kb_entity_candidate_botanical_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
    ),
    'nutrient', (
      SELECT to_jsonb(detail) - 'created_at'
        FROM public.kb_entity_candidate_nutrient_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
    ),
    'product_variant', (
      SELECT to_jsonb(detail) - 'created_at'
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
    ),
    'components', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(component) - 'created_at'
        ORDER BY component.component_order, component.id
      )
        FROM public.kb_entity_candidate_components component
       WHERE component.entity_candidate_id = _entity_candidate_id
    ), '[]'::jsonb)
  )
    FROM public.kb_entity_candidates candidate
    JOIN public.kb_entity_candidate_contracts contract
      ON contract.entity_candidate_id = candidate.id
   WHERE candidate.id = _entity_candidate_id
$$;

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_draft_promotion_candidate_owned_hash(
  _entity_candidate_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object(
    'input_manifest', public.kb_entity_candidate_canonical_jsonb_v1(
      public.kb_entity_candidate_draft_promotion_input_manifest(candidate.id)
    ),
    'discarded_unstructured_payload_sha256', encode(
      sha256(convert_to(
        public.kb_entity_candidate_canonical_jsonb_v1(candidate.proposed_data)::text,
        'UTF8'
      )),
      'hex'
    )
  )::text, 'UTF8')), 'hex')
    FROM public.kb_entity_candidates candidate
   WHERE candidate.id = _entity_candidate_id
     AND public.kb_entity_candidate_draft_promotion_input_manifest(candidate.id) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_draft_assertion_hash(
  _entity_candidate_assertion_id uuid,
  _entity_candidate_id uuid,
  _batch_id uuid,
  _review_decision_id uuid,
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(public.kb_entity_candidate_canonical_jsonb_v1(jsonb_build_object(
    'canonical_key', candidate_assertion.claim_key,
    'version_no', 1,
    'assertion_kind', candidate_assertion.assertion_kind,
    'claim_text', candidate_assertion.claim_text,
    'origin_type', 'import',
    'evidence_basis', candidate_assertion.evidence_basis,
    'evidence_quality', candidate_assertion.evidence_quality,
    'valid_from', candidate_assertion.valid_from,
    'valid_until', candidate_assertion.valid_until,
    'supersedes_assertion_id', NULL,
    'metadata', candidate_assertion.assertion_metadata || jsonb_build_object(
      'origin_type', 'import',
      'entity_candidate_id', _entity_candidate_id::text,
      'entity_candidate_assertion_id', _entity_candidate_assertion_id::text,
      'import_batch_id', _batch_id::text,
      'review_decision_id', _review_decision_id::text,
      'promoted_entity_id', _entity_id::text,
      'promoted_entity_revision_id', _entity_revision_id::text,
      'conversion_version', 1
    )
  ))::text, 'UTF8')), 'hex')
    FROM public.kb_entity_candidate_assertions candidate_assertion
   WHERE candidate_assertion.id = _entity_candidate_assertion_id
     AND candidate_assertion.entity_candidate_id = _entity_candidate_id
     AND candidate_assertion.batch_id = _batch_id
$$;

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_current_assertion_hash(
  _assertion_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(public.kb_entity_candidate_canonical_jsonb_v1(jsonb_build_object(
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
    'metadata', assertion.metadata
  ))::text, 'UTF8')), 'hex')
    FROM public.kb_assertions assertion
   WHERE assertion.id = _assertion_id
$$;

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_jsonb_has_exact_keys_v1(
  _value jsonb,
  _expected_keys text[]
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  actual_key_count integer;
BEGIN
  IF jsonb_typeof(_value) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;

  SELECT count(*)::int INTO actual_key_count FROM jsonb_object_keys(_value);
  RETURN _value ?& _expected_keys
    AND actual_key_count = cardinality(_expected_keys);
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_draft_initial_revision_hash(
  _entity_candidate_id uuid,
  _review_decision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object(
    'entity_type', candidate.proposed_entity_type_code,
    'revision', jsonb_build_object(
      'revision_no', 1,
      'display_name', candidate.display_name,
      'summary', contract.summary,
      'description_markdown', candidate.description_markdown,
      'origin_type', 'import',
      'metadata', jsonb_build_object(
        'origin_type', 'import',
        'entity_candidate_id', candidate.id::text,
        'import_batch_id', candidate.batch_id::text,
        'review_decision_id', _review_decision_id::text,
        'contract_hash', contract.contract_hash,
        'conversion_version', 1
      )
    ),
    'preparation', (
      SELECT jsonb_build_object(
        'preparation_kind', detail.preparation_kind,
        'dosage_form', detail.dosage_form,
        'administration_routes', detail.administration_routes,
        'standardization_status', detail.standardization_status,
        'basis_assertion_id', mapping.assertion_id,
        'technical_metadata', detail.technical_metadata
      )
        FROM public.kb_entity_candidate_preparation_details detail
        JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
          ON mapping.entity_candidate_assertion_id = detail.basis_assertion_candidate_id
         AND mapping.entity_candidate_id = detail.entity_candidate_id
       WHERE detail.entity_candidate_id = candidate.id
    ),
    'homeopathic', (
      SELECT jsonb_build_object(
        'remedy_kind', detail.remedy_kind,
        'potency_scale', detail.potency_scale,
        'potency_value', detail.potency_value,
        'potentization_method', detail.potentization_method,
        'basis_assertion_id', mapping.assertion_id
      )
        FROM public.kb_entity_candidate_homeopathic_details detail
        JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
          ON mapping.entity_candidate_assertion_id = detail.basis_assertion_candidate_id
         AND mapping.entity_candidate_id = detail.entity_candidate_id
       WHERE detail.entity_candidate_id = candidate.id
    ),
    'botanical', (
      SELECT jsonb_build_object(
        'plant_parts', detail.plant_parts,
        'source_material_state', detail.source_material_state,
        'extraction_type', detail.extraction_type,
        'drug_extract_ratio_from', detail.drug_extract_ratio_from,
        'drug_extract_ratio_to', detail.drug_extract_ratio_to,
        'extraction_solvents', detail.extraction_solvents,
        'alcohol_percent_from', detail.alcohol_percent_from,
        'alcohol_percent_to', detail.alcohol_percent_to,
        'basis_assertion_id', mapping.assertion_id
      )
        FROM public.kb_entity_candidate_botanical_details detail
        JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
          ON mapping.entity_candidate_assertion_id = detail.basis_assertion_candidate_id
         AND mapping.entity_candidate_id = detail.entity_candidate_id
       WHERE detail.entity_candidate_id = candidate.id
    ),
    'nutrient', (
      SELECT jsonb_build_object(
        'formulation_kind', detail.formulation_kind,
        'delivery_system', detail.delivery_system,
        'basis_assertion_id', mapping.assertion_id
      )
        FROM public.kb_entity_candidate_nutrient_details detail
        JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
          ON mapping.entity_candidate_assertion_id = detail.basis_assertion_candidate_id
         AND mapping.entity_candidate_id = detail.entity_candidate_id
       WHERE detail.entity_candidate_id = candidate.id
    ),
    'product_variant', (
      SELECT jsonb_build_object(
        'product_entity_id', product_revision.entity_id,
        'product_revision_id', product_revision.id,
        'preparation_entity_id', preparation_revision.entity_id,
        'preparation_revision_id', preparation_revision.id,
        'package_quantity', detail.package_quantity,
        'package_unit', detail.package_unit,
        'market_status', detail.market_status,
        'valid_from', detail.valid_from,
        'valid_until', detail.valid_until,
        'basis_assertion_id', mapping.assertion_id,
        'product_revision_hash', product_revision.content_hash,
        'preparation_revision_hash', preparation_revision.content_hash
      )
        FROM public.kb_entity_candidate_product_variant_details detail
        JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
          ON mapping.entity_candidate_assertion_id = detail.basis_assertion_candidate_id
         AND mapping.entity_candidate_id = detail.entity_candidate_id
        LEFT JOIN public.kb_entity_candidate_draft_promotions product_promotion
          ON product_promotion.entity_candidate_id = detail.product_candidate_id
        LEFT JOIN public.kb_entity_candidate_draft_promotions preparation_promotion
          ON preparation_promotion.entity_candidate_id = detail.preparation_candidate_id
        JOIN public.kb_entity_revisions product_revision
          ON product_revision.entity_id = COALESCE(
               detail.product_entity_id,
               product_promotion.entity_id
             )
         AND product_revision.id = COALESCE(
               detail.product_revision_id,
               product_promotion.entity_revision_id
             )
        JOIN public.kb_entity_revisions preparation_revision
          ON preparation_revision.entity_id = COALESCE(
               detail.preparation_entity_id,
               preparation_promotion.entity_id
             )
         AND preparation_revision.id = COALESCE(
               detail.preparation_revision_id,
               preparation_promotion.entity_revision_id
             )
       WHERE detail.entity_candidate_id = candidate.id
    ),
    'components', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'component_entity_id', component_revision.entity_id,
        'component_revision_id', component_revision.id,
        'component_role', component.component_role,
        'chemical_form', CASE WHEN component.chemical_form_status = 'specified'
          THEN component.chemical_form ELSE NULL END,
        'amount_min', CASE WHEN component.amount_status = 'specified'
          THEN component.amount_min ELSE NULL END,
        'amount_max', CASE WHEN component.amount_status = 'specified'
          THEN component.amount_max ELSE NULL END,
        'amount_unit', CASE WHEN component.amount_status = 'specified'
          THEN component.amount_unit ELSE NULL END,
        'reference_quantity', CASE WHEN component.amount_status = 'specified'
          THEN component.reference_quantity ELSE NULL END,
        'reference_unit', CASE WHEN component.amount_status = 'specified'
          THEN component.reference_unit ELSE NULL END,
        'elemental_amount', CASE WHEN component.amount_status = 'specified'
          THEN component.elemental_amount ELSE NULL END,
        'elemental_unit', CASE WHEN component.amount_status = 'specified'
          THEN component.elemental_unit ELSE NULL END,
        'component_order', component.component_order,
        'valid_from', component.valid_from,
        'valid_until', component.valid_until,
        'basis_assertion_id', mapping.assertion_id,
        'component_revision_hash', component_revision.content_hash
      ) ORDER BY component.component_order, component.id)
        FROM public.kb_entity_candidate_components component
        JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
          ON mapping.entity_candidate_assertion_id = component.basis_assertion_candidate_id
         AND mapping.entity_candidate_id = component.entity_candidate_id
        LEFT JOIN public.kb_entity_candidate_draft_promotions component_promotion
          ON component_promotion.entity_candidate_id = component.component_candidate_id
        JOIN public.kb_entity_revisions component_revision
          ON component_revision.entity_id = COALESCE(
               component.component_entity_id,
               component_promotion.entity_id
             )
         AND component_revision.id = COALESCE(
               component.component_revision_id,
               component_promotion.entity_revision_id
             )
       WHERE component.entity_candidate_id = candidate.id
    ), '[]'::jsonb)
  )::text, 'UTF8')), 'hex')
    FROM public.kb_entity_candidates candidate
    JOIN public.kb_entity_candidate_contracts contract
      ON contract.entity_candidate_id = candidate.id
   WHERE candidate.id = _entity_candidate_id
$$;

CREATE OR REPLACE FUNCTION public.kb_validate_promoted_entity_candidate_current_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'kb_entity_revisions' AND EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_draft_promotions promotion
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = promotion.entity_id
       AND revision.id = promotion.entity_revision_id
     WHERE revision.id = NEW.id
       AND revision.content_hash IS DISTINCT FROM
         public.kb_therapeutic_revision_hash(revision.entity_id, revision.id)
  ) THEN
    RAISE EXCEPTION 'Promoted entity revision requires its canonical current content hash';
  ELSIF TG_TABLE_NAME = 'kb_assertions' AND EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_draft_promotion_assertions mapping
      JOIN public.kb_assertions assertion ON assertion.id = mapping.assertion_id
     WHERE assertion.id = NEW.id
       AND assertion.content_hash IS DISTINCT FROM
         public.kb_entity_candidate_current_assertion_hash(assertion.id)
  ) THEN
    RAISE EXCEPTION 'Promoted entity assertion requires its canonical current content hash';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER kb_entity_revisions_validate_promoted_candidate_hash
  AFTER INSERT OR UPDATE ON public.kb_entity_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_promoted_entity_candidate_current_hash();

CREATE CONSTRAINT TRIGGER kb_assertions_validate_promoted_candidate_hash
  AFTER INSERT OR UPDATE ON public.kb_assertions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_promoted_entity_candidate_current_hash();

CREATE OR REPLACE FUNCTION public.kb_validate_entity_candidate_promotion_dependency_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_draft_promotions promotion
      CROSS JOIN LATERAL jsonb_array_elements(
        promotion.resolution_manifest -> 'entity_dependencies'
      ) dependency(value)
      JOIN public.kb_entity_revisions revision
        ON revision.id = (dependency.value ->> 'entity_revision_id')::uuid
     WHERE revision.id = NEW.id
       AND (
         revision.content_hash IS DISTINCT FROM
           public.kb_therapeutic_revision_hash(revision.entity_id, revision.id)
         OR dependency.value ->> 'frozen_revision_content_hash'
            IS DISTINCT FROM revision.content_hash
       )
  ) THEN
    RAISE EXCEPTION 'Referenced promotion dependency revision is frozen';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER kb_entity_revisions_validate_promotion_dependency_hash
  AFTER UPDATE ON public.kb_entity_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_entity_candidate_promotion_dependency_hash();

CREATE OR REPLACE FUNCTION public.kb_protect_entity_candidate_draft_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Entity candidate draft promotion provenance is append-only';
END;
$$;

CREATE TRIGGER kb_entity_candidate_draft_promotions_append_only
  BEFORE UPDATE OR DELETE ON public.kb_entity_candidate_draft_promotions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_entity_candidate_draft_promotion();

CREATE TRIGGER kb_entity_candidate_draft_promotion_assertions_append_only
  BEFORE UPDATE OR DELETE ON public.kb_entity_candidate_draft_promotion_assertions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_entity_candidate_draft_promotion();

CREATE OR REPLACE FUNCTION public.kb_protect_promoted_entity_candidate_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  table_owner name;
  is_mapped boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT pg_get_userbyid(relclass.relowner)
      INTO STRICT table_owner
      FROM pg_class relclass
      JOIN pg_namespace namespace ON namespace.oid = relclass.relnamespace
     WHERE namespace.nspname = TG_TABLE_SCHEMA
       AND relclass.relname = TG_TABLE_NAME;

    IF current_user <> table_owner AND (
      (TG_TABLE_NAME IN ('kb_entities', 'kb_entity_revisions')
        AND NEW.metadata ? 'entity_candidate_id')
      OR (TG_TABLE_NAME = 'kb_assertions'
        AND (
          NEW.metadata ? 'entity_candidate_id'
          OR NEW.metadata ? 'entity_candidate_assertion_id'
        ))
    ) THEN
      RAISE EXCEPTION 'Reserved entity candidate provenance requires the promotion function';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'kb_entities' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.kb_entity_candidate_draft_promotions promotion
         WHERE promotion.entity_id = OLD.id
      ) INTO is_mapped;
      IF NOT is_mapped
         AND NEW.metadata ? 'entity_candidate_id'
         AND (
        NEW.metadata -> 'origin_type' IS DISTINCT FROM OLD.metadata -> 'origin_type'
        OR NEW.metadata -> 'entity_candidate_id'
           IS DISTINCT FROM OLD.metadata -> 'entity_candidate_id'
        OR NEW.metadata -> 'import_batch_id'
           IS DISTINCT FROM OLD.metadata -> 'import_batch_id'
        OR NEW.metadata -> 'contract_hash'
           IS DISTINCT FROM OLD.metadata -> 'contract_hash'
        OR NEW.metadata -> 'conversion_version'
           IS DISTINCT FROM OLD.metadata -> 'conversion_version'
      ) THEN
        RAISE EXCEPTION 'Reserved entity candidate provenance cannot be added to unmapped rows';
      END IF;
    ELSIF TG_TABLE_NAME = 'kb_entity_revisions' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.kb_entity_candidate_draft_promotions promotion
         WHERE promotion.entity_revision_id = OLD.id
      ) INTO is_mapped;
      IF NOT is_mapped
         AND NEW.metadata ? 'entity_candidate_id'
         AND (
        NEW.metadata -> 'origin_type' IS DISTINCT FROM OLD.metadata -> 'origin_type'
        OR NEW.metadata -> 'entity_candidate_id'
           IS DISTINCT FROM OLD.metadata -> 'entity_candidate_id'
        OR NEW.metadata -> 'import_batch_id'
           IS DISTINCT FROM OLD.metadata -> 'import_batch_id'
        OR NEW.metadata -> 'review_decision_id'
           IS DISTINCT FROM OLD.metadata -> 'review_decision_id'
        OR NEW.metadata -> 'contract_hash'
           IS DISTINCT FROM OLD.metadata -> 'contract_hash'
        OR NEW.metadata -> 'conversion_version'
           IS DISTINCT FROM OLD.metadata -> 'conversion_version'
      ) THEN
        RAISE EXCEPTION 'Reserved entity candidate provenance cannot be added to unmapped rows';
      END IF;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.kb_entity_candidate_draft_promotion_assertions mapping
         WHERE mapping.assertion_id = OLD.id
      ) INTO is_mapped;
      IF NOT is_mapped
         AND (
           NEW.metadata ? 'entity_candidate_id'
           OR NEW.metadata ? 'entity_candidate_assertion_id'
         )
         AND (
        NEW.metadata -> 'origin_type' IS DISTINCT FROM OLD.metadata -> 'origin_type'
        OR NEW.metadata -> 'entity_candidate_id'
           IS DISTINCT FROM OLD.metadata -> 'entity_candidate_id'
        OR NEW.metadata -> 'entity_candidate_assertion_id'
           IS DISTINCT FROM OLD.metadata -> 'entity_candidate_assertion_id'
        OR NEW.metadata -> 'import_batch_id'
           IS DISTINCT FROM OLD.metadata -> 'import_batch_id'
        OR NEW.metadata -> 'review_decision_id'
           IS DISTINCT FROM OLD.metadata -> 'review_decision_id'
        OR NEW.metadata -> 'promoted_entity_id'
           IS DISTINCT FROM OLD.metadata -> 'promoted_entity_id'
        OR NEW.metadata -> 'promoted_entity_revision_id'
           IS DISTINCT FROM OLD.metadata -> 'promoted_entity_revision_id'
        OR NEW.metadata -> 'conversion_version'
           IS DISTINCT FROM OLD.metadata -> 'conversion_version'
      ) THEN
        RAISE EXCEPTION 'Reserved entity candidate provenance cannot be added to unmapped rows';
      END IF;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'kb_entities' AND EXISTS (
    SELECT 1 FROM public.kb_entity_candidate_draft_promotions promotion
     WHERE promotion.entity_id = OLD.id
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Promoted entity provenance cannot be deleted';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.entity_type_code IS DISTINCT FROM OLD.entity_type_code
       OR NEW.canonical_key IS DISTINCT FROM OLD.canonical_key
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.metadata -> 'origin_type' IS DISTINCT FROM OLD.metadata -> 'origin_type'
       OR NEW.metadata -> 'entity_candidate_id' IS DISTINCT FROM OLD.metadata -> 'entity_candidate_id'
       OR NEW.metadata -> 'import_batch_id' IS DISTINCT FROM OLD.metadata -> 'import_batch_id'
       OR NEW.metadata -> 'contract_hash' IS DISTINCT FROM OLD.metadata -> 'contract_hash'
       OR NEW.metadata -> 'conversion_version' IS DISTINCT FROM OLD.metadata -> 'conversion_version'
    THEN
      RAISE EXCEPTION 'Promoted entity technical provenance is immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'kb_entity_revisions' AND EXISTS (
    SELECT 1 FROM public.kb_entity_candidate_draft_promotions promotion
     WHERE promotion.entity_revision_id = OLD.id
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Promoted entity revision provenance cannot be deleted';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
       OR NEW.revision_no IS DISTINCT FROM OLD.revision_no
       OR NEW.origin_type IS DISTINCT FROM OLD.origin_type
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.metadata -> 'origin_type' IS DISTINCT FROM OLD.metadata -> 'origin_type'
       OR NEW.metadata -> 'entity_candidate_id' IS DISTINCT FROM OLD.metadata -> 'entity_candidate_id'
       OR NEW.metadata -> 'import_batch_id' IS DISTINCT FROM OLD.metadata -> 'import_batch_id'
       OR NEW.metadata -> 'review_decision_id' IS DISTINCT FROM OLD.metadata -> 'review_decision_id'
       OR NEW.metadata -> 'contract_hash' IS DISTINCT FROM OLD.metadata -> 'contract_hash'
       OR NEW.metadata -> 'conversion_version' IS DISTINCT FROM OLD.metadata -> 'conversion_version'
    THEN
      RAISE EXCEPTION 'Promoted entity revision technical provenance is immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'kb_assertions' AND EXISTS (
    SELECT 1 FROM public.kb_entity_candidate_draft_promotion_assertions mapping
     WHERE mapping.assertion_id = OLD.id
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Promoted entity assertion provenance cannot be deleted';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.canonical_key IS DISTINCT FROM OLD.canonical_key
       OR NEW.version_no IS DISTINCT FROM OLD.version_no
       OR NEW.assertion_kind IS DISTINCT FROM OLD.assertion_kind
       OR NEW.origin_type IS DISTINCT FROM OLD.origin_type
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.metadata -> 'origin_type' IS DISTINCT FROM OLD.metadata -> 'origin_type'
       OR NEW.metadata -> 'entity_candidate_id' IS DISTINCT FROM OLD.metadata -> 'entity_candidate_id'
       OR NEW.metadata -> 'entity_candidate_assertion_id' IS DISTINCT FROM OLD.metadata -> 'entity_candidate_assertion_id'
       OR NEW.metadata -> 'import_batch_id' IS DISTINCT FROM OLD.metadata -> 'import_batch_id'
       OR NEW.metadata -> 'review_decision_id' IS DISTINCT FROM OLD.metadata -> 'review_decision_id'
       OR NEW.metadata -> 'promoted_entity_id' IS DISTINCT FROM OLD.metadata -> 'promoted_entity_id'
       OR NEW.metadata -> 'promoted_entity_revision_id' IS DISTINCT FROM OLD.metadata -> 'promoted_entity_revision_id'
       OR NEW.metadata -> 'conversion_version' IS DISTINCT FROM OLD.metadata -> 'conversion_version'
    THEN
      RAISE EXCEPTION 'Promoted entity assertion technical provenance is immutable';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER kb_entities_promoted_candidate_provenance_protect
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_entities
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_promoted_entity_candidate_provenance();

CREATE TRIGGER kb_entity_revisions_promoted_candidate_provenance_protect
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_entity_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_promoted_entity_candidate_provenance();

CREATE TRIGGER kb_assertions_promoted_candidate_provenance_protect
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_assertions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_promoted_entity_candidate_provenance();

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_draft_promotion_is_valid_path(
  _entity_candidate_id uuid,
  _visited_entity_candidate_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  promotion public.kb_entity_candidate_draft_promotions%ROWTYPE;
  expected_count integer;
  manifest_count integer;
  visited_entity_candidate_ids uuid[];
BEGIN
  IF _entity_candidate_id = ANY(_visited_entity_candidate_ids) THEN
    RETURN false;
  END IF;
  visited_entity_candidate_ids := array_append(
    _visited_entity_candidate_ids,
    _entity_candidate_id
  );

  SELECT stored_promotion.*
    INTO promotion
    FROM public.kb_entity_candidate_draft_promotions stored_promotion
   WHERE stored_promotion.entity_candidate_id = _entity_candidate_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF promotion.conversion_version <> 1
     OR promotion.data_classification <> 'general_knowledge'
     OR promotion.input_manifest_hash IS DISTINCT FROM encode(
       sha256(convert_to(
         public.kb_entity_candidate_canonical_jsonb_v1(promotion.input_manifest)::text,
         'UTF8'
       )),
       'hex'
     )
     OR promotion.resolution_manifest_hash IS DISTINCT FROM encode(
       sha256(convert_to(promotion.resolution_manifest::text, 'UTF8')),
       'hex'
     )
     OR promotion.input_manifest IS DISTINCT FROM
       public.kb_entity_candidate_draft_promotion_input_manifest(_entity_candidate_id)
     OR promotion.candidate_owned_hash IS DISTINCT FROM
        public.kb_entity_candidate_draft_promotion_candidate_owned_hash(_entity_candidate_id)
      OR promotion.discarded_proposed_data_hash IS DISTINCT FROM (
        SELECT encode(sha256(convert_to(
          public.kb_entity_candidate_canonical_jsonb_v1(candidate.proposed_data)::text,
         'UTF8'
       )), 'hex')
         FROM public.kb_entity_candidates candidate
        WHERE candidate.id = _entity_candidate_id
     )
     OR jsonb_typeof(promotion.resolution_manifest -> 'sources') IS DISTINCT FROM 'array'
     OR jsonb_typeof(promotion.resolution_manifest -> 'entity_dependencies') IS DISTINCT FROM 'array'
     OR jsonb_typeof(promotion.resolution_manifest -> 'assertions') IS DISTINCT FROM 'array'
     OR promotion.resolution_manifest ->> 'manifest_version' IS DISTINCT FROM '1'
     OR promotion.resolution_manifest -> 'entity_candidate_id'
        IS DISTINCT FROM to_jsonb(promotion.entity_candidate_id)
     OR promotion.resolution_manifest -> 'batch_id'
        IS DISTINCT FROM to_jsonb(promotion.batch_id)
     OR promotion.resolution_manifest -> 'review_decision_id'
        IS DISTINCT FROM to_jsonb(promotion.review_decision_id)
     OR promotion.resolution_manifest -> 'entity_id'
        IS DISTINCT FROM to_jsonb(promotion.entity_id)
     OR promotion.resolution_manifest -> 'entity_revision_id'
        IS DISTINCT FROM to_jsonb(promotion.entity_revision_id)
     OR promotion.resolution_manifest -> 'promoted_at_epoch'
        IS DISTINCT FROM to_jsonb(extract(epoch FROM promotion.promoted_at)::text)
     OR promotion.resolution_manifest -> 'promoted_by'
        IS DISTINCT FROM to_jsonb(promotion.promoted_by)
     OR promotion.resolution_manifest -> 'conversion_version'
        IS DISTINCT FROM to_jsonb(promotion.conversion_version)
      OR promotion.resolution_manifest ->> 'entity_revision_content_hash'
         IS DISTINCT FROM promotion.initial_content_hash
      OR promotion.initial_content_hash IS DISTINCT FROM
         public.kb_entity_candidate_draft_initial_revision_hash(
           promotion.entity_candidate_id,
           promotion.review_decision_id
         )
  THEN
    RETURN false;
  END IF;

  IF NOT public.kb_entity_candidate_jsonb_has_exact_keys_v1(
       promotion.resolution_manifest,
       ARRAY[
         'manifest_version',
         'entity_candidate_id',
         'batch_id',
         'review_decision_id',
         'entity_id',
         'entity_revision_id',
         'promoted_at_epoch',
         'promoted_by',
         'conversion_version',
         'sources',
         'entity_dependencies',
         'assertions',
         'entity_revision_content_hash'
       ]::text[]
     )
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(promotion.resolution_manifest -> 'sources') item(value)
        WHERE NOT public.kb_entity_candidate_jsonb_has_exact_keys_v1(
          item.value,
          ARRAY[
            'source_candidate_id',
            'source_id',
            'source_revision_id',
            'initial_content_hash'
          ]::text[]
        )
     )
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(
           promotion.resolution_manifest -> 'entity_dependencies'
         ) item(value)
        WHERE NOT public.kb_entity_candidate_jsonb_has_exact_keys_v1(
          item.value,
          ARRAY[
            'reference_role',
            'reference_order',
            'reference_kind',
            'entity_candidate_id',
            'entity_id',
            'entity_revision_id',
            'frozen_revision_content_hash'
          ]::text[]
        )
     )
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(promotion.resolution_manifest -> 'assertions') item(value)
        WHERE NOT public.kb_entity_candidate_jsonb_has_exact_keys_v1(
          item.value,
          ARRAY[
            'entity_candidate_assertion_id',
            'assertion_id',
            'initial_content_hash'
          ]::text[]
        )
     )
  THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.kb_entity_candidates candidate
      JOIN public.kb_import_batches batch ON batch.id = candidate.batch_id
      JOIN public.kb_entity_candidate_contracts contract
        ON contract.entity_candidate_id = candidate.id
      JOIN public.kb_review_decisions decision
        ON decision.id = promotion.review_decision_id
     WHERE candidate.id = promotion.entity_candidate_id
       AND candidate.batch_id = promotion.batch_id
       AND candidate.candidate_status = 'accepted_as_draft'
       AND candidate.target_entity_id IS NULL
       AND candidate.data_classification = 'general_knowledge'
       AND batch.batch_status = 'reviewed'
        AND contract.batch_id = promotion.batch_id
        AND contract.contract_version = 1
        AND contract.contract_hash = promotion.contract_hash
        AND contract.contract_hash = public.kb_entity_candidate_contract_hash(
          contract.entity_candidate_id,
          contract.summary,
          contract.contract_metadata
        )
        AND contract.data_classification = 'general_knowledge'
       AND decision.candidate_kind = 'entity'
       AND decision.candidate_id = promotion.entity_candidate_id
       AND decision.decision = 'accept_as_draft'
       AND decision.status_before IN ('imported_unreviewed', 'needs_clarification')
       AND decision.status_after = 'accepted_as_draft'
       AND decision.decided_by = candidate.reviewed_by
       AND decision.decided_at = candidate.reviewed_at
       AND decision.data_classification = 'general_knowledge'
       AND (
         SELECT count(*) FROM public.kb_review_decisions counted_decision
          WHERE counted_decision.candidate_kind = 'entity'
            AND counted_decision.candidate_id = promotion.entity_candidate_id
            AND counted_decision.decision = 'accept_as_draft'
            AND counted_decision.status_after = 'accepted_as_draft'
       ) = 1
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = entity.id
       AND revision.id = promotion.entity_revision_id
     WHERE entity.id = promotion.entity_id
       AND entity.entity_type_code = (
         SELECT candidate.proposed_entity_type_code
           FROM public.kb_entity_candidates candidate
          WHERE candidate.id = promotion.entity_candidate_id
       )
       AND entity.canonical_key = (
         SELECT candidate.proposed_canonical_key
           FROM public.kb_entity_candidates candidate
          WHERE candidate.id = promotion.entity_candidate_id
       )
       AND entity.created_by = promotion.promoted_by
       AND entity.created_at = promotion.promoted_at
       AND entity.metadata -> 'origin_type' = to_jsonb('import'::text)
       AND entity.metadata -> 'entity_candidate_id' = to_jsonb(promotion.entity_candidate_id::text)
       AND entity.metadata -> 'import_batch_id' = to_jsonb(promotion.batch_id::text)
       AND entity.metadata -> 'contract_hash' = to_jsonb(promotion.contract_hash)
       AND entity.metadata -> 'conversion_version' = to_jsonb(promotion.conversion_version)
       AND revision.revision_no = 1
       AND revision.origin_type = 'import'
       AND revision.created_by = promotion.promoted_by
       AND revision.created_at = promotion.promoted_at
       AND revision.metadata -> 'origin_type' = to_jsonb('import'::text)
       AND revision.metadata -> 'entity_candidate_id' = to_jsonb(promotion.entity_candidate_id::text)
       AND revision.metadata -> 'import_batch_id' = to_jsonb(promotion.batch_id::text)
       AND revision.metadata -> 'review_decision_id' = to_jsonb(promotion.review_decision_id::text)
       AND revision.metadata -> 'contract_hash' = to_jsonb(promotion.contract_hash)
       AND revision.metadata -> 'conversion_version' = to_jsonb(promotion.conversion_version)
       AND revision.content_hash = public.kb_therapeutic_revision_hash(entity.id, revision.id)
  ) THEN
    RETURN false;
  END IF;

  SELECT count(*)::int
    INTO expected_count
    FROM public.kb_entity_candidate_assertions candidate_assertion
   WHERE candidate_assertion.entity_candidate_id = promotion.entity_candidate_id;
  SELECT count(*)::int
    INTO manifest_count
    FROM public.kb_entity_candidate_draft_promotion_assertions mapping
   WHERE mapping.entity_candidate_id = promotion.entity_candidate_id;
  IF expected_count <> manifest_count
     OR manifest_count <> jsonb_array_length(promotion.resolution_manifest -> 'assertions')
  THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_draft_promotion_assertions mapping
      LEFT JOIN public.kb_entity_candidate_assertions candidate_assertion
        ON candidate_assertion.id = mapping.entity_candidate_assertion_id
       AND candidate_assertion.entity_candidate_id = mapping.entity_candidate_id
       AND candidate_assertion.batch_id = mapping.batch_id
      LEFT JOIN public.kb_assertions assertion ON assertion.id = mapping.assertion_id
     WHERE mapping.entity_candidate_id = promotion.entity_candidate_id
       AND (
         candidate_assertion.id IS NULL
         OR assertion.id IS NULL
         OR mapping.batch_id IS DISTINCT FROM promotion.batch_id
         OR mapping.claim_key IS DISTINCT FROM candidate_assertion.claim_key
         OR mapping.conversion_version IS DISTINCT FROM promotion.conversion_version
         OR mapping.data_classification IS DISTINCT FROM 'general_knowledge'
         OR mapping.initial_content_hash IS DISTINCT FROM
           public.kb_entity_candidate_draft_assertion_hash(
             mapping.entity_candidate_assertion_id,
             promotion.entity_candidate_id,
             promotion.batch_id,
             promotion.review_decision_id,
             promotion.entity_id,
             promotion.entity_revision_id
           )
         OR assertion.canonical_key IS DISTINCT FROM mapping.claim_key
         OR assertion.version_no IS DISTINCT FROM 1
         OR assertion.assertion_kind IS DISTINCT FROM candidate_assertion.assertion_kind
         OR assertion.origin_type IS DISTINCT FROM 'import'
         OR assertion.created_by IS DISTINCT FROM promotion.promoted_by
         OR assertion.created_at IS DISTINCT FROM promotion.promoted_at
         OR assertion.metadata -> 'origin_type' IS DISTINCT FROM to_jsonb('import'::text)
         OR assertion.metadata -> 'entity_candidate_id'
            IS DISTINCT FROM to_jsonb(promotion.entity_candidate_id::text)
         OR assertion.metadata -> 'entity_candidate_assertion_id'
            IS DISTINCT FROM to_jsonb(mapping.entity_candidate_assertion_id::text)
         OR assertion.metadata -> 'import_batch_id'
            IS DISTINCT FROM to_jsonb(promotion.batch_id::text)
         OR assertion.metadata -> 'review_decision_id'
            IS DISTINCT FROM to_jsonb(promotion.review_decision_id::text)
         OR assertion.metadata -> 'promoted_entity_id'
            IS DISTINCT FROM to_jsonb(promotion.entity_id::text)
         OR assertion.metadata -> 'promoted_entity_revision_id'
            IS DISTINCT FROM to_jsonb(promotion.entity_revision_id::text)
         OR assertion.metadata -> 'conversion_version'
            IS DISTINCT FROM to_jsonb(promotion.conversion_version)
         OR assertion.content_hash IS DISTINCT FROM
            public.kb_entity_candidate_current_assertion_hash(assertion.id)
         OR NOT EXISTS (
           SELECT 1
             FROM jsonb_array_elements(promotion.resolution_manifest -> 'assertions') item(value)
            WHERE item.value ->> 'entity_candidate_assertion_id'
                    = mapping.entity_candidate_assertion_id::text
              AND item.value ->> 'assertion_id' = mapping.assertion_id::text
              AND item.value ->> 'initial_content_hash' = mapping.initial_content_hash
         )
       )
  ) THEN
    RETURN false;
  END IF;

  WITH required_sources AS (
    SELECT candidate.source_candidate_id
      FROM public.kb_entity_candidates candidate
     WHERE candidate.id = promotion.entity_candidate_id
    UNION
    SELECT assertion_source.source_candidate_id
      FROM public.kb_entity_candidate_assertion_sources assertion_source
     WHERE assertion_source.entity_candidate_id = promotion.entity_candidate_id
  )
  SELECT count(*)::int INTO expected_count FROM required_sources;
  IF expected_count <> jsonb_array_length(promotion.resolution_manifest -> 'sources') THEN
    RETURN false;
  END IF;

  IF EXISTS (
    WITH required_sources AS (
      SELECT candidate.source_candidate_id
        FROM public.kb_entity_candidates candidate
       WHERE candidate.id = promotion.entity_candidate_id
      UNION
      SELECT assertion_source.source_candidate_id
        FROM public.kb_entity_candidate_assertion_sources assertion_source
       WHERE assertion_source.entity_candidate_id = promotion.entity_candidate_id
    )
    SELECT 1
      FROM required_sources required_source
      LEFT JOIN public.kb_source_candidate_draft_promotions source_promotion
        ON source_promotion.source_candidate_id = required_source.source_candidate_id
     WHERE source_promotion.source_candidate_id IS NULL
        OR public.kb_source_candidate_promotion_is_valid(required_source.source_candidate_id)
           IS DISTINCT FROM true
        OR NOT EXISTS (
          SELECT 1
            FROM jsonb_array_elements(promotion.resolution_manifest -> 'sources') item(value)
           WHERE item.value ->> 'source_candidate_id' = required_source.source_candidate_id::text
             AND item.value ->> 'source_id' = source_promotion.source_id::text
             AND item.value ->> 'source_revision_id' = source_promotion.source_revision_id::text
             AND item.value ->> 'initial_content_hash' = source_promotion.initial_content_hash
        )
  ) THEN
    RETURN false;
  END IF;

  WITH dependency_references AS (
    SELECT
      'product'::text AS reference_role,
      1 AS reference_order,
      detail.product_candidate_id AS dependency_candidate_id,
      detail.product_entity_id AS direct_entity_id,
      detail.product_revision_id AS direct_revision_id
      FROM public.kb_entity_candidate_product_variant_details detail
     WHERE detail.entity_candidate_id = promotion.entity_candidate_id
    UNION ALL
    SELECT
      'preparation', 1, detail.preparation_candidate_id,
      detail.preparation_entity_id, detail.preparation_revision_id
      FROM public.kb_entity_candidate_product_variant_details detail
     WHERE detail.entity_candidate_id = promotion.entity_candidate_id
    UNION ALL
    SELECT
      'component', component.component_order, component.component_candidate_id,
      component.component_entity_id, component.component_revision_id
      FROM public.kb_entity_candidate_components component
     WHERE component.entity_candidate_id = promotion.entity_candidate_id
  )
  SELECT count(*)::int INTO expected_count FROM dependency_references;
  IF expected_count <> jsonb_array_length(promotion.resolution_manifest -> 'entity_dependencies') THEN
    RETURN false;
  END IF;

  IF EXISTS (
    WITH dependency_references AS (
      SELECT
        'product'::text AS reference_role,
        1 AS reference_order,
        detail.product_candidate_id AS dependency_candidate_id,
        detail.product_entity_id AS direct_entity_id,
        detail.product_revision_id AS direct_revision_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = promotion.entity_candidate_id
      UNION ALL
      SELECT
        'preparation', 1, detail.preparation_candidate_id,
        detail.preparation_entity_id, detail.preparation_revision_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = promotion.entity_candidate_id
      UNION ALL
      SELECT
        'component', component.component_order, component.component_candidate_id,
        component.component_entity_id, component.component_revision_id
        FROM public.kb_entity_candidate_components component
       WHERE component.entity_candidate_id = promotion.entity_candidate_id
    )
    SELECT 1
      FROM dependency_references reference
      LEFT JOIN public.kb_entity_candidate_draft_promotions dependency_promotion
        ON dependency_promotion.entity_candidate_id = reference.dependency_candidate_id
     WHERE (
       reference.dependency_candidate_id IS NOT NULL
       AND public.kb_entity_candidate_draft_promotion_is_valid_path(
             reference.dependency_candidate_id,
             visited_entity_candidate_ids
           )
           IS DISTINCT FROM true
     )
        OR NOT EXISTS (
          SELECT 1
            FROM public.kb_entity_revisions exact_revision
            JOIN public.kb_entities exact_entity
              ON exact_entity.id = exact_revision.entity_id
           WHERE exact_entity.lifecycle_status = 'active'
              AND exact_revision.content_hash =
                public.kb_therapeutic_revision_hash(
                  exact_revision.entity_id,
                  exact_revision.id
                )
              AND exact_revision.entity_id = COALESCE(
                   reference.direct_entity_id,
                   dependency_promotion.entity_id
                 )
             AND exact_revision.id = COALESCE(
                   reference.direct_revision_id,
                   dependency_promotion.entity_revision_id
                 )
        )
        OR NOT EXISTS (
          SELECT 1
            FROM jsonb_array_elements(
              promotion.resolution_manifest -> 'entity_dependencies'
            ) item(value)
           WHERE item.value ->> 'reference_role' = reference.reference_role
             AND item.value ->> 'reference_order' = reference.reference_order::text
             AND item.value ->> 'reference_kind' = CASE
               WHEN reference.dependency_candidate_id IS NULL THEN 'revision'
               ELSE 'candidate'
             END
             AND item.value ->> 'entity_candidate_id' IS NOT DISTINCT FROM
               reference.dependency_candidate_id::text
             AND item.value ->> 'entity_id' = COALESCE(
               reference.direct_entity_id,
               dependency_promotion.entity_id
             )::text
              AND item.value ->> 'entity_revision_id' = COALESCE(
                reference.direct_revision_id,
                dependency_promotion.entity_revision_id
              )::text
              AND item.value ->> 'frozen_revision_content_hash' ~ '^[0-9a-f]{64}$'
              AND item.value ->> 'frozen_revision_content_hash' = (
                SELECT exact_revision.content_hash
                  FROM public.kb_entity_revisions exact_revision
                 WHERE exact_revision.entity_id = COALESCE(
                         reference.direct_entity_id,
                         dependency_promotion.entity_id
                       )
                   AND exact_revision.id = COALESCE(
                         reference.direct_revision_id,
                         dependency_promotion.entity_revision_id
                       )
              )
         )
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_draft_promotion_is_valid(
  _entity_candidate_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_entity_candidate_draft_promotion_is_valid_path(
    _entity_candidate_id,
    ARRAY[]::uuid[]
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_promotion_readiness(
  _entity_candidate_id uuid
)
RETURNS TABLE (
  entity_candidate_id uuid,
  contract_version integer,
  contract_hash text,
  ready_for_promotion boolean,
  blocking_reason_codes text[],
  warning_reason_codes text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reviewer_id uuid := auth.uid();
  candidate public.kb_entity_candidates%ROWTYPE;
  contract public.kb_entity_candidate_contracts%ROWTYPE;
  parent_batch_status text;
  accept_decision_count integer;
  blocking_codes text[] := ARRAY[]::text[];
  warning_codes text[] := ARRAY[]::text[];
  promotion_exists boolean;
BEGIN
  IF reviewer_id IS NULL OR NOT public.has_role(reviewer_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators may inspect entity candidate promotion readiness';
  END IF;

  SELECT * INTO candidate
    FROM public.kb_entity_candidates
   WHERE id = _entity_candidate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entity candidate not found';
  END IF;
  SELECT stored_contract.* INTO contract
    FROM public.kb_entity_candidate_contracts stored_contract
   WHERE stored_contract.entity_candidate_id = _entity_candidate_id;

  IF candidate.proposed_data <> '{}'::jsonb THEN
    warning_codes := array_append(warning_codes, 'UNSTRUCTURED_PROPOSED_DATA_PRESENT');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.kb_entity_candidate_draft_promotions promotion
     WHERE promotion.entity_candidate_id = _entity_candidate_id
  ) INTO promotion_exists;
  IF promotion_exists THEN
    IF public.kb_entity_candidate_draft_promotion_is_valid(_entity_candidate_id) THEN
      RETURN QUERY SELECT
        _entity_candidate_id,
        contract.contract_version,
        contract.contract_hash,
        true,
        ARRAY[]::text[],
        warning_codes;
    ELSE
      RETURN QUERY SELECT
        _entity_candidate_id,
        contract.contract_version,
        contract.contract_hash,
        false,
        ARRAY['EXISTING_PROMOTION_INVALID']::text[],
        warning_codes;
    END IF;
    RETURN;
  END IF;

  blocking_codes := COALESCE(
    public.kb_entity_candidate_contract_error_codes(_entity_candidate_id),
    ARRAY[]::text[]
  );
  SELECT batch.batch_status INTO parent_batch_status
    FROM public.kb_import_batches batch
   WHERE batch.id = candidate.batch_id;
  IF parent_batch_status <> 'reviewed' THEN
    blocking_codes := array_append(blocking_codes, 'BATCH_NOT_REVIEWED');
  END IF;
  IF candidate.candidate_status <> 'accepted_as_draft' THEN
    blocking_codes := array_append(blocking_codes, 'CANDIDATE_NOT_ACCEPTED');
  END IF;

  SELECT count(*)::int INTO accept_decision_count
    FROM public.kb_review_decisions decision
   WHERE decision.candidate_kind = 'entity'
     AND decision.candidate_id = _entity_candidate_id
     AND decision.decision = 'accept_as_draft'
     AND decision.status_after = 'accepted_as_draft';
  IF accept_decision_count = 0 THEN
    blocking_codes := array_append(blocking_codes, 'ACCEPT_DECISION_MISSING');
  ELSIF accept_decision_count > 1 THEN
    blocking_codes := array_append(blocking_codes, 'ACCEPT_DECISION_AMBIGUOUS');
  ELSIF NOT EXISTS (
    SELECT 1
      FROM public.kb_review_decisions decision
     WHERE decision.candidate_kind = 'entity'
       AND decision.candidate_id = _entity_candidate_id
       AND decision.decision = 'accept_as_draft'
       AND decision.status_before IN ('imported_unreviewed', 'needs_clarification')
       AND decision.status_after = 'accepted_as_draft'
       AND decision.decided_by = candidate.reviewed_by
       AND decision.decided_at = candidate.reviewed_at
       AND decision.data_classification = 'general_knowledge'
  ) THEN
    blocking_codes := array_append(blocking_codes, 'ACCEPT_DECISION_INVALID');
  END IF;

  IF candidate.source_candidate_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.kb_source_candidate_draft_promotions promotion
     WHERE promotion.source_candidate_id = candidate.source_candidate_id
  ) THEN
    blocking_codes := array_append(blocking_codes, 'SOURCE_PROMOTION_MISSING');
  ELSIF candidate.source_candidate_id IS NOT NULL
        AND public.kb_source_candidate_promotion_is_valid(candidate.source_candidate_id)
            IS DISTINCT FROM true
  THEN
    blocking_codes := array_append(blocking_codes, 'SOURCE_PROMOTION_INVALID');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_assertion_sources assertion_source
      LEFT JOIN public.kb_source_candidate_draft_promotions promotion
        ON promotion.source_candidate_id = assertion_source.source_candidate_id
     WHERE assertion_source.entity_candidate_id = _entity_candidate_id
       AND promotion.source_candidate_id IS NULL
  ) THEN
    blocking_codes := array_append(blocking_codes, 'ASSERTION_SOURCE_PROMOTION_MISSING');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_assertion_sources assertion_source
      JOIN public.kb_source_candidate_draft_promotions promotion
        ON promotion.source_candidate_id = assertion_source.source_candidate_id
     WHERE assertion_source.entity_candidate_id = _entity_candidate_id
       AND public.kb_source_candidate_promotion_is_valid(assertion_source.source_candidate_id)
           IS DISTINCT FROM true
  ) THEN
    blocking_codes := array_append(blocking_codes, 'ASSERTION_SOURCE_PROMOTION_INVALID');
  END IF;

  IF EXISTS (
    WITH dependencies AS (
      SELECT detail.product_candidate_id AS dependency_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT detail.preparation_candidate_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT component.component_candidate_id
        FROM public.kb_entity_candidate_components component
       WHERE component.entity_candidate_id = _entity_candidate_id
    )
    SELECT 1
      FROM dependencies dependency
      LEFT JOIN public.kb_entity_candidate_draft_promotions promotion
        ON promotion.entity_candidate_id = dependency.dependency_id
     WHERE dependency.dependency_id IS NOT NULL
       AND promotion.entity_candidate_id IS NULL
  ) THEN
    blocking_codes := array_append(
      blocking_codes,
      'CANDIDATE_DEPENDENCY_PROMOTION_MISSING'
    );
  END IF;
  IF EXISTS (
    WITH dependencies AS (
      SELECT detail.product_candidate_id AS dependency_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT detail.preparation_candidate_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT component.component_candidate_id
        FROM public.kb_entity_candidate_components component
       WHERE component.entity_candidate_id = _entity_candidate_id
    )
    SELECT 1
      FROM dependencies dependency
      JOIN public.kb_entity_candidate_draft_promotions promotion
        ON promotion.entity_candidate_id = dependency.dependency_id
     WHERE dependency.dependency_id IS NOT NULL
       AND (
         public.kb_entity_candidate_draft_promotion_is_valid(dependency.dependency_id)
           IS DISTINCT FROM true
         OR NOT EXISTS (
           SELECT 1
             FROM public.kb_entities dependency_entity
            WHERE dependency_entity.id = promotion.entity_id
              AND dependency_entity.lifecycle_status = 'active'
         )
       )
  ) THEN
    blocking_codes := array_append(
      blocking_codes,
      'CANDIDATE_DEPENDENCY_PROMOTION_INVALID'
    );
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (
        SELECT detail.product_revision_id AS revision_id
          FROM public.kb_entity_candidate_product_variant_details detail
         WHERE detail.entity_candidate_id = _entity_candidate_id
        UNION
        SELECT detail.preparation_revision_id
          FROM public.kb_entity_candidate_product_variant_details detail
         WHERE detail.entity_candidate_id = _entity_candidate_id
        UNION
        SELECT component.component_revision_id
          FROM public.kb_entity_candidate_components component
         WHERE component.entity_candidate_id = _entity_candidate_id
      ) reference
      JOIN public.kb_entity_revisions revision ON revision.id = reference.revision_id
     WHERE reference.revision_id IS NOT NULL
       AND revision.content_hash IS DISTINCT FROM
         public.kb_therapeutic_revision_hash(revision.entity_id, revision.id)
  ) THEN
    blocking_codes := array_append(
      blocking_codes,
      'DIRECT_DEPENDENCY_REVISION_HASH_INVALID'
    );
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_assertions candidate_assertion
      JOIN public.kb_assertions assertion
        ON assertion.canonical_key = candidate_assertion.claim_key
     WHERE candidate_assertion.entity_candidate_id = _entity_candidate_id
  ) THEN
    blocking_codes := array_append(blocking_codes, 'ASSERTION_KEY_TAKEN');
  END IF;

  SELECT COALESCE(
           array_agg(DISTINCT code COLLATE "C" ORDER BY code COLLATE "C"),
           ARRAY[]::text[]
         )
    INTO blocking_codes
    FROM unnest(blocking_codes) AS listed(code);
  SELECT COALESCE(
           array_agg(DISTINCT code COLLATE "C" ORDER BY code COLLATE "C"),
           ARRAY[]::text[]
         )
    INTO warning_codes
    FROM unnest(warning_codes) AS listed(code);

  RETURN QUERY SELECT
    _entity_candidate_id,
    contract.contract_version,
    contract.contract_hash,
    cardinality(blocking_codes) = 0,
    blocking_codes,
    warning_codes;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_promote_entity_candidate_to_draft(
  _entity_candidate_id uuid
)
RETURNS TABLE (
  promoted_entity_id uuid,
  promoted_entity_revision_id uuid,
  was_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reviewer_id uuid := auth.uid();
  candidate_batch_id uuid;
  parent_batch_status text;
  locked_candidate public.kb_entity_candidates%ROWTYPE;
  locked_contract public.kb_entity_candidate_contracts%ROWTYPE;
  decision_row public.kb_review_decisions%ROWTYPE;
  accept_decision_id uuid;
  accept_decision_count integer := 0;
  existing_promotion public.kb_entity_candidate_draft_promotions%ROWTYPE;
  readiness record;
  new_entity_id uuid := gen_random_uuid();
  new_revision_id uuid := gen_random_uuid();
  new_assertion_id uuid;
  candidate_assertion public.kb_entity_candidate_assertions%ROWTYPE;
  assertion_content_hash text;
  input_manifest jsonb;
  input_manifest_hash text;
  candidate_owned_hash text;
  discarded_proposed_data_hash text;
  resolution_manifest jsonb;
  resolution_manifest_hash text;
  final_revision_hash text;
  promotion_time timestamptz := now();
BEGIN
  IF reviewer_id IS NULL OR NOT public.has_role(reviewer_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators may promote entity candidates';
  END IF;

  SELECT candidate.batch_id
    INTO candidate_batch_id
    FROM public.kb_entity_candidates candidate
   WHERE candidate.id = _entity_candidate_id;
  IF candidate_batch_id IS NULL THEN
    RAISE EXCEPTION 'Entity candidate not found';
  END IF;

  SELECT batch.batch_status
    INTO parent_batch_status
    FROM public.kb_import_batches batch
   WHERE batch.id = candidate_batch_id
   FOR UPDATE;

  SELECT candidate.*
    INTO STRICT locked_candidate
    FROM public.kb_entity_candidates candidate
   WHERE candidate.id = _entity_candidate_id
     AND candidate.batch_id = candidate_batch_id
   FOR UPDATE;

  SELECT contract.*
    INTO locked_contract
    FROM public.kb_entity_candidate_contracts contract
   WHERE contract.entity_candidate_id = _entity_candidate_id
   FOR SHARE;

  FOR decision_row IN
    SELECT decision.*
      FROM public.kb_review_decisions decision
     WHERE decision.candidate_kind = 'entity'
       AND decision.candidate_id = _entity_candidate_id
       AND decision.decision = 'accept_as_draft'
       AND decision.status_after = 'accepted_as_draft'
     ORDER BY decision.id
     FOR SHARE
  LOOP
    accept_decision_count := accept_decision_count + 1;
    accept_decision_id := decision_row.id;
  END LOOP;

  PERFORM source_promotion.source_candidate_id
    FROM (
      SELECT locked_candidate.source_candidate_id
      UNION
      SELECT assertion_source.source_candidate_id
        FROM public.kb_entity_candidate_assertion_sources assertion_source
       WHERE assertion_source.entity_candidate_id = _entity_candidate_id
    ) required_source
    JOIN public.kb_source_candidate_draft_promotions source_promotion
      ON source_promotion.source_candidate_id = required_source.source_candidate_id
    JOIN public.kb_sources source ON source.id = source_promotion.source_id
    JOIN public.kb_source_revisions source_revision
      ON source_revision.id = source_promotion.source_revision_id
     AND source_revision.source_id = source_promotion.source_id
   WHERE required_source.source_candidate_id IS NOT NULL
   ORDER BY source_promotion.source_candidate_id
   FOR SHARE OF source_promotion, source, source_revision;

  PERFORM dependency_candidate.id
    FROM (
      SELECT detail.product_candidate_id AS dependency_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT detail.preparation_candidate_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT component.component_candidate_id
        FROM public.kb_entity_candidate_components component
       WHERE component.entity_candidate_id = _entity_candidate_id
    ) reference
    JOIN public.kb_entity_candidates dependency_candidate
      ON dependency_candidate.id = reference.dependency_id
   WHERE reference.dependency_id IS NOT NULL
   ORDER BY dependency_candidate.id
   FOR SHARE OF dependency_candidate;

  PERFORM dependency_contract.entity_candidate_id
    FROM (
      SELECT detail.product_candidate_id AS dependency_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT detail.preparation_candidate_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT component.component_candidate_id
        FROM public.kb_entity_candidate_components component
       WHERE component.entity_candidate_id = _entity_candidate_id
    ) reference
    JOIN public.kb_entity_candidate_contracts dependency_contract
      ON dependency_contract.entity_candidate_id = reference.dependency_id
   WHERE reference.dependency_id IS NOT NULL
   ORDER BY dependency_contract.entity_candidate_id
   FOR SHARE OF dependency_contract;

  PERFORM dependency_promotion.entity_candidate_id
    FROM (
      SELECT detail.product_candidate_id AS dependency_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT detail.preparation_candidate_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT component.component_candidate_id
        FROM public.kb_entity_candidate_components component
       WHERE component.entity_candidate_id = _entity_candidate_id
    ) reference
    JOIN public.kb_entity_candidate_draft_promotions dependency_promotion
      ON dependency_promotion.entity_candidate_id = reference.dependency_id
    JOIN public.kb_entities dependency_entity
      ON dependency_entity.id = dependency_promotion.entity_id
    JOIN public.kb_entity_revisions dependency_revision
      ON dependency_revision.entity_id = dependency_promotion.entity_id
     AND dependency_revision.id = dependency_promotion.entity_revision_id
   WHERE reference.dependency_id IS NOT NULL
   ORDER BY dependency_promotion.entity_candidate_id
   FOR SHARE OF dependency_promotion, dependency_entity, dependency_revision;

  PERFORM exact_revision.id
    FROM (
      SELECT detail.product_revision_id AS revision_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT detail.preparation_revision_id
        FROM public.kb_entity_candidate_product_variant_details detail
       WHERE detail.entity_candidate_id = _entity_candidate_id
      UNION
      SELECT component.component_revision_id
        FROM public.kb_entity_candidate_components component
       WHERE component.entity_candidate_id = _entity_candidate_id
    ) reference
    JOIN public.kb_entity_revisions exact_revision ON exact_revision.id = reference.revision_id
    JOIN public.kb_entities exact_entity ON exact_entity.id = exact_revision.entity_id
   WHERE reference.revision_id IS NOT NULL
   ORDER BY exact_revision.id
   FOR SHARE OF exact_entity, exact_revision;

  SELECT promotion.*
    INTO existing_promotion
    FROM public.kb_entity_candidate_draft_promotions promotion
   WHERE promotion.entity_candidate_id = _entity_candidate_id
   FOR SHARE;
  IF FOUND THEN
    PERFORM entity.id
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = entity.id
       AND revision.id = existing_promotion.entity_revision_id
     WHERE entity.id = existing_promotion.entity_id
     FOR SHARE OF entity, revision;

    IF NOT public.kb_entity_candidate_draft_promotion_is_valid(_entity_candidate_id) THEN
      RAISE EXCEPTION 'Existing entity candidate promotion failed its integrity check';
    END IF;
    RETURN QUERY SELECT
      existing_promotion.entity_id,
      existing_promotion.entity_revision_id,
      false;
    RETURN;
  END IF;

  LOCK TABLE public.kb_assertions IN SHARE ROW EXCLUSIVE MODE;

  SELECT * INTO readiness
    FROM public.kb_entity_candidate_promotion_readiness(_entity_candidate_id);
  IF readiness.ready_for_promotion IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Entity candidate is not ready for promotion: %',
      array_to_string(readiness.blocking_reason_codes, ',');
  END IF;
  IF accept_decision_count <> 1 OR accept_decision_id IS NULL THEN
    RAISE EXCEPTION 'Entity candidate requires exactly one acceptance decision';
  END IF;

  input_manifest := public.kb_entity_candidate_canonical_jsonb_v1(
    public.kb_entity_candidate_draft_promotion_input_manifest(
      _entity_candidate_id
    )
  );
  input_manifest_hash := encode(
    sha256(convert_to(
      public.kb_entity_candidate_canonical_jsonb_v1(input_manifest)::text,
      'UTF8'
    )),
    'hex'
  );
  candidate_owned_hash :=
    public.kb_entity_candidate_draft_promotion_candidate_owned_hash(_entity_candidate_id);
  discarded_proposed_data_hash := encode(
    sha256(convert_to(
      public.kb_entity_candidate_canonical_jsonb_v1(locked_candidate.proposed_data)::text,
      'UTF8'
    )),
    'hex'
  );

  INSERT INTO public.kb_entities (
    id,
    entity_type_code,
    canonical_key,
    metadata,
    created_by
  ) VALUES (
    new_entity_id,
    locked_candidate.proposed_entity_type_code,
    locked_candidate.proposed_canonical_key,
    jsonb_build_object(
      'origin_type', 'import',
      'entity_candidate_id', _entity_candidate_id::text,
      'import_batch_id', candidate_batch_id::text,
      'contract_hash', locked_contract.contract_hash,
      'conversion_version', 1
    ),
    reviewer_id
  );

  INSERT INTO public.kb_entity_revisions (
    id,
    entity_id,
    revision_no,
    display_name,
    summary,
    description_markdown,
    review_status,
    origin_type,
    content_hash,
    metadata,
    created_by
  ) VALUES (
    new_revision_id,
    new_entity_id,
    1,
    locked_candidate.display_name,
    locked_contract.summary,
    locked_candidate.description_markdown,
    'draft',
    'import',
    repeat('0', 64),
    jsonb_build_object(
      'origin_type', 'import',
      'entity_candidate_id', _entity_candidate_id::text,
      'import_batch_id', candidate_batch_id::text,
      'review_decision_id', accept_decision_id::text,
      'contract_hash', locked_contract.contract_hash,
      'conversion_version', 1
    ),
    reviewer_id
  );

  INSERT INTO public.kb_entity_names (
    id,
    entity_id,
    name,
    normalized_name,
    name_kind,
    language_code,
    is_preferred,
    created_by
  )
  SELECT
    gen_random_uuid(),
    new_entity_id,
    candidate_name.name,
    candidate_name.normalized_name,
    candidate_name.name_kind,
    candidate_name.language_code,
    candidate_name.is_preferred,
    reviewer_id
    FROM public.kb_entity_candidate_names candidate_name
   WHERE candidate_name.entity_candidate_id = _entity_candidate_id
   ORDER BY candidate_name.name_order, candidate_name.id;

  FOR candidate_assertion IN
    SELECT assertion.*
      FROM public.kb_entity_candidate_assertions assertion
     WHERE assertion.entity_candidate_id = _entity_candidate_id
     ORDER BY assertion.assertion_order, assertion.id
  LOOP
    new_assertion_id := gen_random_uuid();
    assertion_content_hash := public.kb_entity_candidate_draft_assertion_hash(
      candidate_assertion.id,
      _entity_candidate_id,
      candidate_batch_id,
      accept_decision_id,
      new_entity_id,
      new_revision_id
    );

    INSERT INTO public.kb_assertions (
      id,
      canonical_key,
      version_no,
      assertion_kind,
      claim_text,
      review_status,
      origin_type,
      evidence_basis,
      evidence_quality,
      valid_from,
      valid_until,
      content_hash,
      metadata,
      created_by
    ) VALUES (
      new_assertion_id,
      candidate_assertion.claim_key,
      1,
      candidate_assertion.assertion_kind,
      candidate_assertion.claim_text,
      'draft',
      'import',
      candidate_assertion.evidence_basis,
      candidate_assertion.evidence_quality,
      candidate_assertion.valid_from,
      candidate_assertion.valid_until,
      assertion_content_hash,
      candidate_assertion.assertion_metadata || jsonb_build_object(
        'origin_type', 'import',
        'entity_candidate_id', _entity_candidate_id::text,
        'entity_candidate_assertion_id', candidate_assertion.id::text,
        'import_batch_id', candidate_batch_id::text,
        'review_decision_id', accept_decision_id::text,
        'promoted_entity_id', new_entity_id::text,
        'promoted_entity_revision_id', new_revision_id::text,
        'conversion_version', 1
      ),
      reviewer_id
    );

    INSERT INTO public.kb_entity_candidate_draft_promotion_assertions (
      entity_candidate_assertion_id,
      entity_candidate_id,
      batch_id,
      assertion_id,
      claim_key,
      initial_content_hash
    ) VALUES (
      candidate_assertion.id,
      _entity_candidate_id,
      candidate_batch_id,
      new_assertion_id,
      candidate_assertion.claim_key,
      assertion_content_hash
    );
  END LOOP;

  INSERT INTO public.kb_assertion_sources (
    assertion_id,
    source_revision_id,
    source_role,
    locator,
    original_quote,
    is_primary,
    created_by
  )
  SELECT
    mapping.assertion_id,
    source_promotion.source_revision_id,
    candidate_source.source_role,
    candidate_source.locator,
    candidate_source.original_quote,
    candidate_source.is_primary,
    reviewer_id
    FROM public.kb_entity_candidate_assertion_sources candidate_source
    JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
      ON mapping.entity_candidate_assertion_id = candidate_source.assertion_candidate_id
     AND mapping.entity_candidate_id = candidate_source.entity_candidate_id
    JOIN public.kb_source_candidate_draft_promotions source_promotion
      ON source_promotion.source_candidate_id = candidate_source.source_candidate_id
   WHERE candidate_source.entity_candidate_id = _entity_candidate_id
   ORDER BY candidate_source.assertion_candidate_id,
            candidate_source.source_order,
            candidate_source.id;

  INSERT INTO public.kb_preparation_revision_details (
    entity_id,
    entity_revision_id,
    preparation_kind,
    dosage_form,
    administration_routes,
    standardization_status,
    basis_assertion_id,
    technical_metadata,
    created_by
  )
  SELECT
    new_entity_id,
    new_revision_id,
    detail.preparation_kind,
    detail.dosage_form,
    detail.administration_routes,
    detail.standardization_status,
    mapping.assertion_id,
    detail.technical_metadata,
    reviewer_id
    FROM public.kb_entity_candidate_preparation_details detail
    JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
      ON mapping.entity_candidate_assertion_id = detail.basis_assertion_candidate_id
   WHERE detail.entity_candidate_id = _entity_candidate_id;

  INSERT INTO public.kb_homeopathic_revision_details (
    entity_id,
    entity_revision_id,
    remedy_kind,
    potency_scale,
    potency_value,
    potentization_method,
    basis_assertion_id,
    created_by
  )
  SELECT
    new_entity_id,
    new_revision_id,
    detail.remedy_kind,
    detail.potency_scale,
    detail.potency_value,
    detail.potentization_method,
    mapping.assertion_id,
    reviewer_id
    FROM public.kb_entity_candidate_homeopathic_details detail
    JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
      ON mapping.entity_candidate_assertion_id = detail.basis_assertion_candidate_id
   WHERE detail.entity_candidate_id = _entity_candidate_id;

  INSERT INTO public.kb_botanical_revision_details (
    entity_id,
    entity_revision_id,
    plant_parts,
    source_material_state,
    extraction_type,
    drug_extract_ratio_from,
    drug_extract_ratio_to,
    extraction_solvents,
    alcohol_percent_from,
    alcohol_percent_to,
    basis_assertion_id,
    created_by
  )
  SELECT
    new_entity_id,
    new_revision_id,
    detail.plant_parts,
    detail.source_material_state,
    detail.extraction_type,
    detail.drug_extract_ratio_from,
    detail.drug_extract_ratio_to,
    detail.extraction_solvents,
    detail.alcohol_percent_from,
    detail.alcohol_percent_to,
    mapping.assertion_id,
    reviewer_id
    FROM public.kb_entity_candidate_botanical_details detail
    JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
      ON mapping.entity_candidate_assertion_id = detail.basis_assertion_candidate_id
   WHERE detail.entity_candidate_id = _entity_candidate_id;

  INSERT INTO public.kb_nutrient_revision_details (
    entity_id,
    entity_revision_id,
    formulation_kind,
    delivery_system,
    basis_assertion_id,
    created_by
  )
  SELECT
    new_entity_id,
    new_revision_id,
    detail.formulation_kind,
    detail.delivery_system,
    mapping.assertion_id,
    reviewer_id
    FROM public.kb_entity_candidate_nutrient_details detail
    JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
      ON mapping.entity_candidate_assertion_id = detail.basis_assertion_candidate_id
   WHERE detail.entity_candidate_id = _entity_candidate_id;

  INSERT INTO public.kb_product_variant_revision_details (
    entity_id,
    entity_revision_id,
    product_entity_id,
    product_revision_id,
    preparation_entity_id,
    preparation_revision_id,
    package_quantity,
    package_unit,
    market_status,
    valid_from,
    valid_until,
    basis_assertion_id,
    created_by
  )
  SELECT
    new_entity_id,
    new_revision_id,
    COALESCE(detail.product_entity_id, product_promotion.entity_id),
    COALESCE(detail.product_revision_id, product_promotion.entity_revision_id),
    COALESCE(detail.preparation_entity_id, preparation_promotion.entity_id),
    COALESCE(detail.preparation_revision_id, preparation_promotion.entity_revision_id),
    detail.package_quantity,
    detail.package_unit,
    detail.market_status,
    detail.valid_from,
    detail.valid_until,
    mapping.assertion_id,
    reviewer_id
    FROM public.kb_entity_candidate_product_variant_details detail
    JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
      ON mapping.entity_candidate_assertion_id = detail.basis_assertion_candidate_id
    LEFT JOIN public.kb_entity_candidate_draft_promotions product_promotion
      ON product_promotion.entity_candidate_id = detail.product_candidate_id
    LEFT JOIN public.kb_entity_candidate_draft_promotions preparation_promotion
      ON preparation_promotion.entity_candidate_id = detail.preparation_candidate_id
   WHERE detail.entity_candidate_id = _entity_candidate_id;

  INSERT INTO public.kb_composition_components (
    id,
    owner_entity_id,
    owner_revision_id,
    component_entity_id,
    component_revision_id,
    component_role,
    chemical_form,
    amount_min,
    amount_max,
    amount_unit,
    reference_quantity,
    reference_unit,
    elemental_amount,
    elemental_unit,
    component_order,
    valid_from,
    valid_until,
    basis_assertion_id,
    created_by
  )
  SELECT
    gen_random_uuid(),
    new_entity_id,
    new_revision_id,
    COALESCE(component.component_entity_id, component_promotion.entity_id),
    COALESCE(component.component_revision_id, component_promotion.entity_revision_id),
    component.component_role,
    CASE WHEN component.chemical_form_status = 'specified'
      THEN component.chemical_form ELSE NULL END,
    CASE WHEN component.amount_status = 'specified' THEN component.amount_min ELSE NULL END,
    CASE WHEN component.amount_status = 'specified' THEN component.amount_max ELSE NULL END,
    CASE WHEN component.amount_status = 'specified' THEN component.amount_unit ELSE NULL END,
    CASE WHEN component.amount_status = 'specified'
      THEN component.reference_quantity ELSE NULL END,
    CASE WHEN component.amount_status = 'specified' THEN component.reference_unit ELSE NULL END,
    CASE WHEN component.amount_status = 'specified'
      THEN component.elemental_amount ELSE NULL END,
    CASE WHEN component.amount_status = 'specified' THEN component.elemental_unit ELSE NULL END,
    component.component_order,
    component.valid_from,
    component.valid_until,
    mapping.assertion_id,
    reviewer_id
    FROM public.kb_entity_candidate_components component
    JOIN public.kb_entity_candidate_draft_promotion_assertions mapping
      ON mapping.entity_candidate_assertion_id = component.basis_assertion_candidate_id
    LEFT JOIN public.kb_entity_candidate_draft_promotions component_promotion
      ON component_promotion.entity_candidate_id = component.component_candidate_id
   WHERE component.entity_candidate_id = _entity_candidate_id
   ORDER BY component.component_order, component.id;

  UPDATE public.kb_entity_revisions
     SET content_hash = public.kb_therapeutic_revision_hash(entity_id, id)
   WHERE id = new_revision_id
  RETURNING content_hash INTO final_revision_hash;

  IF final_revision_hash IS DISTINCT FROM
     public.kb_entity_candidate_draft_initial_revision_hash(
       _entity_candidate_id,
       accept_decision_id
     )
  THEN
    RAISE EXCEPTION 'Entity candidate initial revision hash reconstruction failed';
  END IF;

  UPDATE public.kb_entities
     SET current_revision_id = new_revision_id
   WHERE id = new_entity_id;

  SELECT jsonb_build_object(
    'manifest_version', 1,
    'entity_candidate_id', _entity_candidate_id,
    'batch_id', candidate_batch_id,
    'review_decision_id', accept_decision_id,
    'entity_id', new_entity_id,
    'entity_revision_id', new_revision_id,
    'promoted_at_epoch', extract(epoch FROM promotion_time)::text,
    'promoted_by', reviewer_id,
    'conversion_version', 1,
    'sources', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'source_candidate_id', source_promotion.source_candidate_id,
        'source_id', source_promotion.source_id,
        'source_revision_id', source_promotion.source_revision_id,
        'initial_content_hash', source_promotion.initial_content_hash
      ) ORDER BY source_promotion.source_candidate_id)
        FROM (
          SELECT locked_candidate.source_candidate_id
          UNION
          SELECT assertion_source.source_candidate_id
            FROM public.kb_entity_candidate_assertion_sources assertion_source
           WHERE assertion_source.entity_candidate_id = _entity_candidate_id
        ) required_source
        JOIN public.kb_source_candidate_draft_promotions source_promotion
          ON source_promotion.source_candidate_id = required_source.source_candidate_id
       WHERE required_source.source_candidate_id IS NOT NULL
    ), '[]'::jsonb),
    'entity_dependencies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'reference_role', reference.reference_role,
        'reference_order', reference.reference_order,
        'reference_kind', CASE
          WHEN reference.dependency_candidate_id IS NULL THEN 'revision'
          ELSE 'candidate'
        END,
        'entity_candidate_id', reference.dependency_candidate_id,
        'entity_id', COALESCE(reference.direct_entity_id, dependency_promotion.entity_id),
        'entity_revision_id', COALESCE(
          reference.direct_revision_id,
          dependency_promotion.entity_revision_id
        ),
        'frozen_revision_content_hash', exact_revision.content_hash
      ) ORDER BY reference.reference_sort, reference.reference_order)
        FROM (
          SELECT
            1 AS reference_sort,
            'product'::text AS reference_role,
            1 AS reference_order,
            detail.product_candidate_id AS dependency_candidate_id,
            detail.product_entity_id AS direct_entity_id,
            detail.product_revision_id AS direct_revision_id
            FROM public.kb_entity_candidate_product_variant_details detail
           WHERE detail.entity_candidate_id = _entity_candidate_id
          UNION ALL
          SELECT
            2, 'preparation', 1, detail.preparation_candidate_id,
            detail.preparation_entity_id, detail.preparation_revision_id
            FROM public.kb_entity_candidate_product_variant_details detail
           WHERE detail.entity_candidate_id = _entity_candidate_id
          UNION ALL
          SELECT
            3, 'component', component.component_order, component.component_candidate_id,
            component.component_entity_id, component.component_revision_id
            FROM public.kb_entity_candidate_components component
           WHERE component.entity_candidate_id = _entity_candidate_id
        ) reference
        LEFT JOIN public.kb_entity_candidate_draft_promotions dependency_promotion
          ON dependency_promotion.entity_candidate_id = reference.dependency_candidate_id
        JOIN public.kb_entity_revisions exact_revision
          ON exact_revision.id = COALESCE(
               reference.direct_revision_id,
               dependency_promotion.entity_revision_id
             )
         AND exact_revision.entity_id = COALESCE(
               reference.direct_entity_id,
               dependency_promotion.entity_id
             )
    ), '[]'::jsonb),
    'assertions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'entity_candidate_assertion_id', mapping.entity_candidate_assertion_id,
        'assertion_id', mapping.assertion_id,
        'initial_content_hash', mapping.initial_content_hash
      ) ORDER BY staged_assertion.assertion_order, mapping.entity_candidate_assertion_id)
        FROM public.kb_entity_candidate_draft_promotion_assertions mapping
        JOIN public.kb_entity_candidate_assertions staged_assertion
          ON staged_assertion.id = mapping.entity_candidate_assertion_id
       WHERE mapping.entity_candidate_id = _entity_candidate_id
    ), '[]'::jsonb),
    'entity_revision_content_hash', final_revision_hash
  ) INTO resolution_manifest;
  resolution_manifest_hash := encode(
    sha256(convert_to(resolution_manifest::text, 'UTF8')),
    'hex'
  );

  INSERT INTO public.kb_entity_candidate_draft_promotions (
    entity_candidate_id,
    batch_id,
    review_decision_id,
    entity_id,
    entity_revision_id,
    contract_hash,
    input_manifest,
    input_manifest_hash,
    candidate_owned_hash,
    discarded_proposed_data_hash,
    resolution_manifest,
    resolution_manifest_hash,
    initial_content_hash,
    promoted_at,
    promoted_by
  ) VALUES (
    _entity_candidate_id,
    candidate_batch_id,
    accept_decision_id,
    new_entity_id,
    new_revision_id,
    locked_contract.contract_hash,
    input_manifest,
    input_manifest_hash,
    candidate_owned_hash,
    discarded_proposed_data_hash,
    resolution_manifest,
    resolution_manifest_hash,
    final_revision_hash,
    promotion_time,
    reviewer_id
  );

  RETURN QUERY SELECT new_entity_id, new_revision_id, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_entity_candidate_draft_promotion_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH violations AS (
    SELECT 'promotion:' || promotion.entity_candidate_id::text AS violation_key
      FROM public.kb_entity_candidate_draft_promotions promotion
     WHERE NOT public.kb_entity_candidate_draft_promotion_is_valid(
       promotion.entity_candidate_id
     )
    UNION ALL
    SELECT 'orphan-entity:' || entity.id::text
      FROM public.kb_entities entity
     WHERE entity.metadata ? 'entity_candidate_id'
       AND NOT EXISTS (
         SELECT 1 FROM public.kb_entity_candidate_draft_promotions promotion
          WHERE promotion.entity_id = entity.id
            AND promotion.entity_candidate_id::text = entity.metadata ->> 'entity_candidate_id'
       )
    UNION ALL
    SELECT 'orphan-revision:' || revision.id::text
      FROM public.kb_entity_revisions revision
     WHERE revision.metadata ? 'entity_candidate_id'
       AND NOT EXISTS (
         SELECT 1 FROM public.kb_entity_candidate_draft_promotions promotion
          WHERE promotion.entity_revision_id = revision.id
            AND promotion.entity_id = revision.entity_id
            AND promotion.entity_candidate_id::text = revision.metadata ->> 'entity_candidate_id'
       )
    UNION ALL
    SELECT 'orphan-assertion:' || assertion.id::text
      FROM public.kb_assertions assertion
     WHERE (
       assertion.metadata ? 'entity_candidate_id'
       OR assertion.metadata ? 'entity_candidate_assertion_id'
     )
       AND NOT EXISTS (
         SELECT 1
           FROM public.kb_entity_candidate_draft_promotion_assertions mapping
           JOIN public.kb_entity_candidate_draft_promotions promotion
             ON promotion.entity_candidate_id = mapping.entity_candidate_id
           WHERE mapping.assertion_id = assertion.id
             AND promotion.entity_candidate_id::text
                 = assertion.metadata ->> 'entity_candidate_id'
            AND mapping.entity_candidate_assertion_id::text
                = assertion.metadata ->> 'entity_candidate_assertion_id'
            AND promotion.entity_id::text = assertion.metadata ->> 'promoted_entity_id'
            AND promotion.entity_revision_id::text
                = assertion.metadata ->> 'promoted_entity_revision_id'
       )
  )
  SELECT count(*) FROM violations
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_entity_candidate_contract_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH terminal_entity_decisions AS (
    SELECT decision.*
      FROM public.kb_review_decisions decision
     WHERE decision.candidate_kind = 'entity'
       AND decision.status_after IN ('accepted_as_draft', 'rejected', 'duplicate')
  ), promoted_contract_violations AS (
    SELECT promotion.entity_candidate_id
      FROM public.kb_entity_candidate_draft_promotions promotion
      LEFT JOIN public.kb_entity_candidates candidate
        ON candidate.id = promotion.entity_candidate_id
       AND candidate.batch_id = promotion.batch_id
      LEFT JOIN public.kb_entity_candidate_contracts contract
        ON contract.entity_candidate_id = promotion.entity_candidate_id
       AND contract.batch_id = promotion.batch_id
     WHERE candidate.id IS NULL
        OR contract.entity_candidate_id IS NULL
        OR contract.contract_version IS DISTINCT FROM 1
        OR contract.contract_hash IS DISTINCT FROM promotion.contract_hash
        OR contract.contract_hash IS DISTINCT FROM
           public.kb_entity_candidate_contract_hash(
             contract.entity_candidate_id,
             contract.summary,
             contract.contract_metadata
           )
        OR contract.data_classification IS DISTINCT FROM 'general_knowledge'
        OR promotion.conversion_version IS DISTINCT FROM 1
        OR promotion.data_classification IS DISTINCT FROM 'general_knowledge'
        OR promotion.input_manifest IS DISTINCT FROM
          public.kb_entity_candidate_draft_promotion_input_manifest(
            promotion.entity_candidate_id
          )
        OR promotion.input_manifest_hash IS DISTINCT FROM encode(
          sha256(convert_to(
            public.kb_entity_candidate_canonical_jsonb_v1(promotion.input_manifest)::text,
            'UTF8'
          )),
          'hex'
        )
        OR promotion.candidate_owned_hash IS DISTINCT FROM
          public.kb_entity_candidate_draft_promotion_candidate_owned_hash(
            promotion.entity_candidate_id
          )
        OR promotion.discarded_proposed_data_hash IS DISTINCT FROM encode(
          sha256(convert_to(
            public.kb_entity_candidate_canonical_jsonb_v1(candidate.proposed_data)::text,
            'UTF8'
          )),
          'hex'
        )
  ), invalid_candidates AS (
    SELECT violation.entity_candidate_id
      FROM promoted_contract_violations violation
    UNION
    SELECT contract.entity_candidate_id
      FROM public.kb_entity_candidate_contracts contract
     WHERE NOT EXISTS (
       SELECT 1 FROM public.kb_entity_candidate_draft_promotions promotion
        WHERE promotion.entity_candidate_id = contract.entity_candidate_id
     )
       AND contract.contract_hash IS DISTINCT FROM public.kb_entity_candidate_contract_hash(
         contract.entity_candidate_id,
         contract.summary,
         contract.contract_metadata
       )
    UNION
    SELECT candidate.id
      FROM public.kb_entity_candidates candidate
     WHERE candidate.candidate_status = 'accepted_as_draft'
       AND NOT EXISTS (
         SELECT 1 FROM public.kb_entity_candidate_draft_promotions promotion
          WHERE promotion.entity_candidate_id = candidate.id
       )
       AND cardinality(public.kb_entity_candidate_contract_error_codes(candidate.id)) > 0
    UNION
    SELECT candidate.id
      FROM public.kb_entity_candidates candidate
      LEFT JOIN terminal_entity_decisions terminal
        ON terminal.candidate_id = candidate.id
     WHERE candidate.candidate_status IN ('accepted_as_draft', 'rejected', 'duplicate')
       AND (
         terminal.candidate_id IS NULL
         OR terminal.status_after IS DISTINCT FROM candidate.candidate_status
         OR terminal.status_before NOT IN ('imported_unreviewed', 'needs_clarification')
         OR terminal.decision IS DISTINCT FROM CASE candidate.candidate_status
           WHEN 'accepted_as_draft' THEN 'accept_as_draft'
           WHEN 'rejected' THEN 'reject'
           WHEN 'duplicate' THEN 'mark_duplicate'
         END
         OR terminal.decided_by IS DISTINCT FROM candidate.reviewed_by
         OR terminal.decided_at IS DISTINCT FROM candidate.reviewed_at
         OR (
           SELECT count(*) FROM terminal_entity_decisions counted_terminal
            WHERE counted_terminal.candidate_id = candidate.id
         ) <> 1
       )
    UNION
    SELECT decision.candidate_id
      FROM public.kb_review_decisions decision
      LEFT JOIN public.kb_entity_candidates candidate ON candidate.id = decision.candidate_id
     WHERE decision.candidate_kind = 'entity'
       AND (
         candidate.id IS NULL
         OR decision.status_before NOT IN ('imported_unreviewed', 'needs_clarification')
         OR decision.status_after IS DISTINCT FROM CASE decision.decision
           WHEN 'accept_as_draft' THEN 'accepted_as_draft'
           WHEN 'reject' THEN 'rejected'
           WHEN 'needs_clarification' THEN 'needs_clarification'
           WHEN 'mark_duplicate' THEN 'duplicate'
         END
         OR (
           decision.status_after IN ('accepted_as_draft', 'rejected', 'duplicate')
           AND candidate.candidate_status IS DISTINCT FROM decision.status_after
         )
       )
  )
  SELECT count(*) FROM invalid_candidates
$$;

ALTER TABLE public.kb_entity_candidate_draft_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_entity_candidate_draft_promotion_assertions ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_entity_candidate_draft_promotions_admin_read
  ON public.kb_entity_candidate_draft_promotions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY kb_entity_candidate_draft_promotion_assertions_admin_read
  ON public.kb_entity_candidate_draft_promotion_assertions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE
  public.kb_entity_candidate_draft_promotions,
  public.kb_entity_candidate_draft_promotion_assertions
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

GRANT SELECT ON TABLE
  public.kb_entity_candidate_draft_promotions,
  public.kb_entity_candidate_draft_promotion_assertions
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.kb_entity_candidate_draft_promotion_input_manifest(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_canonical_jsonb_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_draft_promotion_candidate_owned_hash(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_draft_assertion_hash(uuid, uuid, uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_current_assertion_hash(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_jsonb_has_exact_keys_v1(jsonb, text[])
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_draft_initial_revision_hash(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_validate_promoted_entity_candidate_current_hash()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_validate_entity_candidate_promotion_dependency_hash()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_entity_candidate_draft_promotion()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_promoted_entity_candidate_provenance()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_draft_promotion_is_valid_path(uuid, uuid[])
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_draft_promotion_is_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_entity_candidate_draft_promotion_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_entity_candidate_contract_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_promote_entity_candidate_to_draft(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_promotion_readiness(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

GRANT EXECUTE ON FUNCTION public.kb_promote_entity_candidate_to_draft(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.kb_entity_candidate_promotion_readiness(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.kb_entity_candidate_canonical_jsonb_v1(jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.kb_entity_candidate_current_assertion_hash(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.kb_export_wiki_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  wiki_table text;
  table_rows jsonb;
  tables_json jsonb := '{}'::jsonb;
  manifest_json jsonb := '{}'::jsonb;
  validation_json jsonb;
  invalid_source_promotions bigint := 0;
  invalid_therapeutic_catalog_revisions bigint := 0;
  invalid_entity_candidate_contracts bigint := 0;
  invalid_entity_candidate_draft_promotions bigint := 0;
BEGIN
  FOR wiki_table IN
    SELECT listed_table.table_name
      FROM (
        SELECT unnest(ARRAY[
          'admin_knowledge_base',
          'mannayan_products',
          'knowledge_product_links',
          'faqs',
          'practice_pricing',
          'practice_info'
        ]) AS table_name
        UNION
        SELECT tables.tablename
          FROM pg_catalog.pg_tables tables
         WHERE tables.schemaname = 'public'
           AND tables.tablename LIKE 'kb\_%' ESCAPE '\'
      ) listed_table
     ORDER BY listed_table.table_name
  LOOP
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(table_row) ORDER BY to_jsonb(table_row)::text), ''[]''::jsonb) FROM public.%I table_row',
      wiki_table
    ) INTO table_rows;
    tables_json := tables_json || jsonb_build_object(wiki_table, table_rows);
    manifest_json := manifest_json || jsonb_build_object(
      wiki_table,
      jsonb_build_object(
        'rows', jsonb_array_length(table_rows),
        'sha256', public.kb_snapshot_rows_hash(table_rows)
      )
    );
  END LOOP;

  SELECT jsonb_build_object(
    'legacy_rows', (SELECT count(*) FROM public.admin_knowledge_base),
    'mapped_articles', (SELECT count(*) FROM public.kb_articles WHERE legacy_knowledge_entry_id IS NOT NULL),
    'legacy_snapshot_revisions', (SELECT count(*) FROM public.kb_article_revisions WHERE origin_type = 'legacy_snapshot'),
    'missing_articles', (
      SELECT count(*)
        FROM public.admin_knowledge_base legacy_row
        LEFT JOIN public.kb_articles article
          ON article.legacy_knowledge_entry_id = legacy_row.id
       WHERE article.id IS NULL
    ),
    'invalid_current_snapshots', (
      SELECT count(*)
        FROM public.admin_knowledge_base legacy_row
        JOIN public.kb_articles article
          ON article.legacy_knowledge_entry_id = legacy_row.id
        LEFT JOIN public.kb_article_revisions revision
          ON revision.id = article.current_revision_id
         AND revision.article_id = article.id
       WHERE article.canonical_key IS DISTINCT FROM 'legacy:' || legacy_row.id::text
          OR article.article_kind IS DISTINCT FROM legacy_row.entry_kind
          OR article.lifecycle_status IS DISTINCT FROM 'active'
          OR article.metadata ->> 'bridge_source' IS DISTINCT FROM 'public.admin_knowledge_base'
          OR article.metadata ->> 'bridge_version' IS DISTINCT FROM '1'
          OR article.metadata ->> 'legacy_knowledge_entry_id' IS DISTINCT FROM legacy_row.id::text
          OR revision.id IS NULL
          OR revision.origin_type IS DISTINCT FROM 'legacy_snapshot'
          OR revision.title IS DISTINCT FROM legacy_row.title
          OR revision.category_path IS DISTINCT FROM legacy_row.category
          OR revision.tags IS DISTINCT FROM legacy_row.tags
          OR revision.content_markdown IS DISTINCT FROM legacy_row.content
          OR (revision.metadata -> 'legacy_metadata') - 'updated_at'
             IS DISTINCT FROM (to_jsonb(legacy_row) - ARRAY['id', 'title', 'category', 'tags', 'content', 'updated_at'])
          OR revision.content_hash IS DISTINCT FROM public.kb_legacy_article_hash(to_jsonb(legacy_row))
    ),
    'orphaned_active_articles', (
      SELECT count(*)
        FROM public.kb_articles article
        LEFT JOIN public.admin_knowledge_base legacy_row
          ON legacy_row.id = article.legacy_knowledge_entry_id
       WHERE article.legacy_knowledge_entry_id IS NOT NULL
         AND article.lifecycle_status = 'active'
         AND legacy_row.id IS NULL
    )
  ) INTO validation_json;

  IF to_regclass('public.kb_source_candidate_draft_promotions') IS NOT NULL THEN
    EXECUTE $promotion_validation$
      SELECT count(*)
        FROM public.kb_source_candidate_draft_promotions promotion
        LEFT JOIN public.kb_source_candidates candidate
          ON candidate.id = promotion.source_candidate_id
         AND candidate.batch_id = promotion.batch_id
        LEFT JOIN public.kb_import_batches batch ON batch.id = promotion.batch_id
        LEFT JOIN public.kb_review_decisions decision ON decision.id = promotion.review_decision_id
        LEFT JOIN public.kb_sources source ON source.id = promotion.source_id
        LEFT JOIN public.kb_source_revisions revision
          ON revision.id = promotion.source_revision_id
         AND revision.source_id = promotion.source_id
       WHERE candidate.id IS NULL
          OR candidate.candidate_status IS DISTINCT FROM 'accepted_as_draft'
          OR candidate.target_source_id IS NOT NULL
          OR candidate.data_classification IS DISTINCT FROM 'general_knowledge'
          OR batch.batch_status IS DISTINCT FROM 'reviewed'
          OR decision.candidate_kind IS DISTINCT FROM 'source'
          OR decision.candidate_id IS DISTINCT FROM promotion.source_candidate_id
          OR decision.decision IS DISTINCT FROM 'accept_as_draft'
          OR decision.status_after IS DISTINCT FROM 'accepted_as_draft'
          OR decision.data_classification IS DISTINCT FROM 'general_knowledge'
          OR source.canonical_key IS DISTINCT FROM promotion.selected_canonical_key
          OR source.created_by IS DISTINCT FROM promotion.promoted_by
          OR source.metadata -> 'origin_type' IS DISTINCT FROM to_jsonb('import'::text)
          OR source.metadata -> 'source_candidate_id' IS DISTINCT FROM to_jsonb(promotion.source_candidate_id::text)
          OR source.metadata -> 'import_batch_id' IS DISTINCT FROM to_jsonb(promotion.batch_id::text)
          OR source.metadata -> 'conversion_version' IS DISTINCT FROM to_jsonb(promotion.conversion_version)
          OR revision.id IS NULL
          OR revision.revision_no IS DISTINCT FROM 1
          OR revision.created_by IS DISTINCT FROM promotion.promoted_by
          OR revision.metadata -> 'origin_type' IS DISTINCT FROM to_jsonb('import'::text)
          OR revision.metadata -> 'source_candidate_id' IS DISTINCT FROM to_jsonb(promotion.source_candidate_id::text)
          OR revision.metadata -> 'import_batch_id' IS DISTINCT FROM to_jsonb(promotion.batch_id::text)
          OR revision.metadata -> 'review_decision_id' IS DISTINCT FROM to_jsonb(promotion.review_decision_id::text)
          OR revision.metadata -> 'conversion_version' IS DISTINCT FROM to_jsonb(promotion.conversion_version)
          OR promotion.data_classification IS DISTINCT FROM 'general_knowledge'
          OR promotion.initial_content_hash IS DISTINCT FROM encode(sha256(convert_to(jsonb_build_object(
            'source_type', promotion.selected_source_type,
            'title', candidate.title,
            'publisher', NULLIF(btrim(candidate.publisher), ''),
            'published_on', candidate.publication_date,
            'url', NULLIF(btrim(candidate.source_url), ''),
            'rights_status', candidate.rights_status
          )::text, 'UTF8')), 'hex')
    $promotion_validation$ INTO invalid_source_promotions;
  END IF;

  IF to_regprocedure('public.kb_invalid_therapeutic_catalog_revision_count()') IS NOT NULL THEN
    EXECUTE 'SELECT public.kb_invalid_therapeutic_catalog_revision_count()'
      INTO invalid_therapeutic_catalog_revisions;
  END IF;
  SELECT public.kb_invalid_entity_candidate_contract_count()
    INTO invalid_entity_candidate_contracts;
  SELECT public.kb_invalid_entity_candidate_draft_promotion_count()
    INTO invalid_entity_candidate_draft_promotions;

  validation_json := validation_json || jsonb_build_object(
    'invalid_source_promotions', invalid_source_promotions,
    'invalid_therapeutic_catalog_revisions', invalid_therapeutic_catalog_revisions,
    'invalid_entity_candidate_contracts', invalid_entity_candidate_contracts,
    'invalid_entity_candidate_draft_promotions', invalid_entity_candidate_draft_promotions
  );

  RETURN jsonb_build_object(
    'tables', tables_json,
    'manifest', manifest_json,
    'validation', validation_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kb_export_wiki_snapshot()
  TO service_role;

COMMIT;
