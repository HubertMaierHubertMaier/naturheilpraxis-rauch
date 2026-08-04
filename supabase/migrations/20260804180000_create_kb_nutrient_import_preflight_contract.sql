BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure('public.kb_therapeutic_revision_is_valid(uuid,uuid)') IS NULL
     OR to_regprocedure('public.kb_release_canonical_jsonb_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure(
       'public.kb_release_jsonb_has_exact_keys_v1(jsonb,text[])'
     ) IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Nutrient import preflight requires the complete therapeutic and release contracts';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 67 THEN
    RAISE EXCEPTION 'Nutrient import preflight requires the exact 67-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Nutrient import preflight cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.kb_nutrient_import_manifest_v1(
  _preparation_entity_id uuid,
  _preparation_revision_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  preparation_record record;
  component_count integer;
  component_set_hash text;
  assertion_count integer;
  source_binding_count integer;
  bound_assertion_count integer;
  source_binding_set_hash text;
BEGIN
  SELECT
    revision.content_hash AS preparation_content_hash,
    preparation.preparation_kind,
    nutrient.formulation_kind,
    nutrient.delivery_system
    INTO preparation_record
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = _preparation_revision_id
    JOIN public.kb_preparation_revision_details preparation
      ON preparation.entity_id = entity.id
     AND preparation.entity_revision_id = revision.id
    JOIN public.kb_nutrient_revision_details nutrient
      ON nutrient.entity_id = entity.id
     AND nutrient.entity_revision_id = revision.id
   WHERE entity.id = _preparation_entity_id
     AND entity.entity_type_code = 'preparation'
     AND preparation.preparation_kind IN (
       'nutrient_single', 'nutrient_combination', 'mineral', 'trace_element',
       'amino_acid', 'probiotic', 'enzyme', 'supplement'
     )
     AND public.kb_therapeutic_revision_is_valid(entity.id, revision.id) IS TRUE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    count(*)::integer,
    public.kb_release_manifest_hash_v1(COALESCE(jsonb_agg(
      jsonb_build_object(
        'component_id', component.id,
        'component_entity_id', component.component_entity_id,
        'component_revision_id', component.component_revision_id,
        'component_content_hash', component_revision.content_hash,
        'component_role', component.component_role,
        'chemical_form', component.chemical_form,
        'amount_min', component.amount_min,
        'amount_max', component.amount_max,
        'amount_unit', component.amount_unit,
        'reference_quantity', component.reference_quantity,
        'reference_unit', component.reference_unit,
        'elemental_amount', component.elemental_amount,
        'elemental_unit', component.elemental_unit,
        'component_order', component.component_order,
        'valid_from', component.valid_from,
        'valid_until', component.valid_until,
        'basis_assertion_id', component.basis_assertion_id
      ) ORDER BY component.component_order, component.id
    ), '[]'::jsonb))
    INTO component_count, component_set_hash
    FROM public.kb_composition_components component
    JOIN public.kb_entity_revisions component_revision
      ON component_revision.entity_id = component.component_entity_id
     AND component_revision.id = component.component_revision_id
   WHERE component.owner_entity_id = _preparation_entity_id
     AND component.owner_revision_id = _preparation_revision_id;

  IF component_count NOT BETWEEN 1 AND 4096 THEN
    RETURN NULL;
  END IF;

  WITH basis_assertions AS MATERIALIZED (
    SELECT preparation.basis_assertion_id AS assertion_id
      FROM public.kb_preparation_revision_details preparation
     WHERE preparation.entity_id = _preparation_entity_id
       AND preparation.entity_revision_id = _preparation_revision_id
    UNION
    SELECT nutrient.basis_assertion_id
      FROM public.kb_nutrient_revision_details nutrient
     WHERE nutrient.entity_id = _preparation_entity_id
       AND nutrient.entity_revision_id = _preparation_revision_id
    UNION
    SELECT component.basis_assertion_id
      FROM public.kb_composition_components component
     WHERE component.owner_entity_id = _preparation_entity_id
       AND component.owner_revision_id = _preparation_revision_id
  ), source_bindings AS MATERIALIZED (
    SELECT
      basis.assertion_id,
      assertion.content_hash AS assertion_content_hash,
      assertion_source.source_revision_id,
      source_revision.source_id,
      source_revision.content_hash AS source_content_hash,
      source_revision.rights_status,
      assertion_source.source_role,
      assertion_source.locator
      FROM basis_assertions basis
      JOIN public.kb_assertions assertion
        ON assertion.id = basis.assertion_id
      JOIN public.kb_assertion_sources assertion_source
        ON assertion_source.assertion_id = basis.assertion_id
       AND assertion_source.is_primary
       AND assertion_source.source_role IN ('supports', 'qualifies')
       AND btrim(assertion_source.locator) <> ''
      JOIN public.kb_source_revisions source_revision
        ON source_revision.id = assertion_source.source_revision_id
  )
  SELECT
    (SELECT count(*)::integer FROM basis_assertions),
    count(*)::integer,
    count(DISTINCT source_bindings.assertion_id)::integer,
    public.kb_release_manifest_hash_v1(COALESCE(jsonb_agg(
      jsonb_build_object(
        'assertion_id', source_bindings.assertion_id,
        'assertion_content_hash', source_bindings.assertion_content_hash,
        'source_id', source_bindings.source_id,
        'source_revision_id', source_bindings.source_revision_id,
        'source_content_hash', source_bindings.source_content_hash,
        'source_rights_status', source_bindings.rights_status,
        'source_role', source_bindings.source_role,
        'source_locator', source_bindings.locator
      ) ORDER BY
        source_bindings.assertion_id,
        source_bindings.source_revision_id,
        source_bindings.source_role COLLATE "C",
        source_bindings.locator COLLATE "C"
    ), '[]'::jsonb))
    INTO assertion_count,
         source_binding_count,
         bound_assertion_count,
         source_binding_set_hash
    FROM source_bindings;

  IF assertion_count NOT BETWEEN 1 AND 8192
     OR source_binding_count NOT BETWEEN 1 AND 16384
     OR bound_assertion_count <> assertion_count
  THEN
    RETURN NULL;
  END IF;

  RETURN public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'NUTRIENT_IMPORT_PREFLIGHT_ONLY',
    'data_classification', 'general_knowledge',
    'source_policy', jsonb_build_object(
      'contract_is_source_neutral', true,
      'primary_assertion_provenance_required', true,
      'source_rights_review_required', true,
      'real_source_data_loaded', false
    ),
    'preparation', jsonb_build_object(
      'preparation_entity_id', _preparation_entity_id,
      'preparation_revision_id', _preparation_revision_id,
      'preparation_content_hash', preparation_record.preparation_content_hash,
      'preparation_kind', preparation_record.preparation_kind,
      'formulation_kind', preparation_record.formulation_kind,
      'delivery_system', preparation_record.delivery_system
    ),
    'component_count', component_count,
    'component_set_hash', component_set_hash,
    'provenance', jsonb_build_object(
      'assertion_count', assertion_count,
      'source_binding_count', source_binding_count,
      'source_binding_set_hash', source_binding_set_hash
    ),
    'control_flags', jsonb_build_object(
      'deployment_allowed', false,
      'import_execution_allowed', false,
      'retention_allowed', false,
      'deletion_allowed', false,
      'replay_execution_allowed', false,
      'shadow_execution_allowed', false,
      'ai_use_allowed', false,
      'plan_selection_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'medical_use_allowed', false,
      'production_use_allowed', false,
      'activation_allowed', false
    )
  ));
END;
$$;

CREATE FUNCTION public.kb_nutrient_import_manifest_hash_v1(
  _preparation_entity_id uuid,
  _preparation_revision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(
    public.kb_nutrient_import_manifest_v1(
      _preparation_entity_id, _preparation_revision_id
    )
  )
$$;

CREATE FUNCTION public.kb_nutrient_import_expectations_are_valid_v1(
  _expected_manifest_hash text,
  _expected_counts jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  item record;
  numeric_text text;
BEGIN
  IF _expected_manifest_hash IS NULL
     OR _expected_manifest_hash !~ '^[0-9a-f]{64}$'
     OR _expected_counts IS NULL
     OR jsonb_typeof(_expected_counts) <> 'object'
     OR octet_length(_expected_counts::text) > 1024
     OR public.kb_release_jsonb_has_exact_keys_v1(
          _expected_counts,
          ARRAY['assertions', 'components', 'source_bindings']::text[]
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  FOR item IN SELECT key, value FROM jsonb_each(_expected_counts)
  LOOP
    IF jsonb_typeof(item.value) <> 'number' THEN
      RETURN false;
    END IF;
    numeric_text := item.value #>> '{}';
    IF numeric_text !~ '^[1-9][0-9]{0,9}$'
       OR numeric_text::numeric > 2147483647
    THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN (_expected_counts ->> 'components')::numeric <= 4096
     AND (_expected_counts ->> 'assertions')::numeric <= 8192
     AND (_expected_counts ->> 'source_bindings')::numeric <= 16384;
END;
$$;

CREATE FUNCTION public.kb_nutrient_import_preflight_v1(
  _preparation_entity_id uuid,
  _preparation_revision_id uuid,
  _expected_manifest_hash text,
  _expected_counts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  manifest jsonb;
  actual_manifest_hash text;
  actual_counts jsonb;
  manifest_hash_matches boolean;
  counts_match boolean;
  result_status text;
  result_payload jsonb;
BEGIN
  IF public.kb_nutrient_import_expectations_are_valid_v1(
       _expected_manifest_hash, _expected_counts
     ) IS DISTINCT FROM true
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'NUTRIENT_IMPORT_PREFLIGHT_ONLY',
      'status', 'NUTRIENT_IMPORT_EXPECTATION_INVALID',
      'interpretation', 'PREFLIGHT_ONLY_NOT_IMPORT_SOURCE_APPROVAL_OR_MEDICAL_USE',
      'preparation_entity_id', _preparation_entity_id,
      'preparation_revision_id', _preparation_revision_id,
      'control_flags', jsonb_build_object(
        'deployment_allowed', false,
        'import_execution_allowed', false,
        'retention_allowed', false,
        'deletion_allowed', false,
        'replay_execution_allowed', false,
        'shadow_execution_allowed', false,
        'ai_use_allowed', false,
        'plan_selection_allowed', false,
        'dosage_evaluation_allowed', false,
        'dosage_display_allowed', false,
        'medical_use_allowed', false,
        'production_use_allowed', false,
        'activation_allowed', false
      )
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  manifest := public.kb_nutrient_import_manifest_v1(
    _preparation_entity_id, _preparation_revision_id
  );
  IF manifest IS NULL THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'NUTRIENT_IMPORT_PREFLIGHT_ONLY',
      'status', 'NUTRIENT_IMPORT_BUNDLE_UNAVAILABLE',
      'interpretation', 'PREFLIGHT_ONLY_NOT_IMPORT_SOURCE_APPROVAL_OR_MEDICAL_USE',
      'preparation_entity_id', _preparation_entity_id,
      'preparation_revision_id', _preparation_revision_id,
      'expected_manifest_hash', _expected_manifest_hash,
      'expected_counts', _expected_counts,
      'control_flags', jsonb_build_object(
        'deployment_allowed', false,
        'import_execution_allowed', false,
        'retention_allowed', false,
        'deletion_allowed', false,
        'replay_execution_allowed', false,
        'shadow_execution_allowed', false,
        'ai_use_allowed', false,
        'plan_selection_allowed', false,
        'dosage_evaluation_allowed', false,
        'dosage_display_allowed', false,
        'medical_use_allowed', false,
        'production_use_allowed', false,
        'activation_allowed', false
      )
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  actual_manifest_hash := public.kb_release_manifest_hash_v1(manifest);
  actual_counts := jsonb_build_object(
    'components', manifest -> 'component_count',
    'assertions', manifest #> '{provenance,assertion_count}',
    'source_bindings', manifest #> '{provenance,source_binding_count}'
  );
  manifest_hash_matches := actual_manifest_hash = _expected_manifest_hash;
  counts_match := actual_counts = _expected_counts;
  result_status := CASE
    WHEN manifest_hash_matches AND counts_match
      THEN 'NUTRIENT_IMPORT_PREFLIGHT_READY_INACTIVE'
    ELSE 'NUTRIENT_IMPORT_BUNDLE_MISMATCH'
  END;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'NUTRIENT_IMPORT_PREFLIGHT_ONLY',
    'status', result_status,
    'interpretation', 'PREFLIGHT_ONLY_NOT_IMPORT_SOURCE_APPROVAL_OR_MEDICAL_USE',
    'preparation_entity_id', _preparation_entity_id,
    'preparation_revision_id', _preparation_revision_id,
    'expected_manifest_hash', _expected_manifest_hash,
    'actual_manifest_hash', actual_manifest_hash,
    'manifest_hash_matches', manifest_hash_matches,
    'expected_counts', _expected_counts,
    'actual_counts', actual_counts,
    'counts_match', counts_match,
    'manifest', manifest,
    'control_flags', manifest -> 'control_flags'
  ));
  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

COMMENT ON FUNCTION public.kb_nutrient_import_manifest_v1(uuid, uuid) IS
  'Step 8A source-neutral digest of one valid nutrient preparation, its bounded components, and generic assertion provenance. It loads no source content and grants no import or medical use.';
COMMENT ON FUNCTION public.kb_nutrient_import_preflight_v1(uuid, uuid, text, jsonb) IS
  'Step 8A fail-closed owner preflight comparing one expected synthetic nutrient manifest and its counts. It does not write, retain, delete, replay, activate, or authorize source or medical content.';

REVOKE ALL ON FUNCTION
  public.kb_nutrient_import_manifest_v1(uuid, uuid),
  public.kb_nutrient_import_manifest_hash_v1(uuid, uuid),
  public.kb_nutrient_import_expectations_are_valid_v1(text, jsonb),
  public.kb_nutrient_import_preflight_v1(uuid, uuid, text, jsonb)
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMIT;
