BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure('public.therapy_input_revision_is_valid_v1(uuid)') IS NULL
     OR to_regprocedure('public.therapy_input_fact_is_valid_v1(uuid)') IS NULL
     OR to_regprocedure('public.kb_release_is_valid(uuid,boolean)') IS NULL
     OR to_regprocedure('public.kb_release_canonical_jsonb_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Retrieval v2 preflight requires the complete input and release contracts';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 67 THEN
    RAISE EXCEPTION 'Retrieval v2 preflight requires the exact 67-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Retrieval v2 preflight cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_input_manifest_v1(
  _therapy_input_revision_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  input_revision public.therapy_input_revisions%ROWTYPE;
  total_fact_count integer;
  terminal_fact_count integer;
  superseded_fact_count integer;
  selected_fact_count integer;
  verified_fact_count integer;
  review_only_fact_count integer;
  excluded_unreviewed_fact_count integer;
  excluded_rejected_fact_count integer;
  complete_fact_set_hash text;
  selected_facts jsonb;
BEGIN
  SELECT revision.*
    INTO input_revision
    FROM public.therapy_input_revisions revision
   WHERE revision.id = _therapy_input_revision_id;

  IF NOT FOUND
     OR public.therapy_input_revision_is_valid_v1(input_revision.id)
          IS DISTINCT FROM true
  THEN
    RETURN NULL;
  END IF;

  -- Excluded facts still belong to the bound input graph, so corruption in any
  -- fact invalidates the entire preflight rather than being silently ignored.
  IF EXISTS (
    SELECT 1
      FROM public.therapy_input_facts fact
     WHERE fact.therapy_input_revision_id = input_revision.id
       AND public.therapy_input_fact_is_valid_v1(fact.id) IS DISTINCT FROM true
  ) OR EXISTS (
    SELECT 1
      FROM public.therapy_input_fact_sources fact_source
     WHERE fact_source.therapy_input_revision_id = input_revision.id
       AND NOT EXISTS (
         SELECT 1
           FROM public.therapy_input_facts fact
          WHERE fact.therapy_input_revision_id = fact_source.therapy_input_revision_id
            AND fact.id = fact_source.therapy_input_fact_id
       )
  ) THEN
    RETURN NULL;
  END IF;

  WITH classified_facts AS MATERIALIZED (
    SELECT fact.*,
           NOT EXISTS (
             SELECT 1
               FROM public.therapy_input_facts successor
              WHERE successor.therapy_input_revision_id = fact.therapy_input_revision_id
                AND successor.supersedes_fact_id = fact.id
           ) AS is_terminal
      FROM public.therapy_input_facts fact
     WHERE fact.therapy_input_revision_id = input_revision.id
  )
  SELECT count(*)::integer,
         count(*) FILTER (WHERE is_terminal)::integer,
         count(*) FILTER (WHERE NOT is_terminal)::integer,
         count(*) FILTER (
           WHERE is_terminal AND review_status IN ('verified', 'review_only')
         )::integer,
         count(*) FILTER (
           WHERE is_terminal AND review_status = 'verified'
         )::integer,
         count(*) FILTER (
           WHERE is_terminal AND review_status = 'review_only'
         )::integer,
         count(*) FILTER (
           WHERE is_terminal AND review_status = 'unreviewed'
         )::integer,
         count(*) FILTER (
           WHERE is_terminal AND review_status = 'rejected'
         )::integer
    INTO total_fact_count,
         terminal_fact_count,
         superseded_fact_count,
         selected_fact_count,
         verified_fact_count,
         review_only_fact_count,
         excluded_unreviewed_fact_count,
         excluded_rejected_fact_count
    FROM classified_facts;

  IF selected_fact_count = 0 THEN
    RETURN NULL;
  END IF;

  SELECT public.kb_release_manifest_hash_v1(COALESCE(jsonb_agg(
           jsonb_build_object(
             'fact_id', fact.id,
             'fact_order', fact.fact_order,
             'review_status', fact.review_status,
             'content_sha256', fact.content_sha256,
             'supersedes_fact_id', fact.supersedes_fact_id
           ) ORDER BY fact.fact_order, fact.id
         ), '[]'::jsonb))
    INTO complete_fact_set_hash
    FROM public.therapy_input_facts fact
   WHERE fact.therapy_input_revision_id = input_revision.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'fact_id', fact.id,
           'fact_order', fact.fact_order,
           'fact_type', fact.fact_type,
           'fact_key', fact.fact_key,
           'review_status', fact.review_status,
           'content_sha256', fact.content_sha256,
           'source_count', fact.source_count,
           'kb_entity_id', fact.kb_entity_id,
           'supersedes_fact_id', fact.supersedes_fact_id
         ) ORDER BY fact.fact_order, fact.id), '[]'::jsonb)
    INTO selected_facts
    FROM public.therapy_input_facts fact
   WHERE fact.therapy_input_revision_id = input_revision.id
     AND fact.review_status IN ('verified', 'review_only')
     AND NOT EXISTS (
       SELECT 1
         FROM public.therapy_input_facts successor
        WHERE successor.therapy_input_revision_id = fact.therapy_input_revision_id
          AND successor.supersedes_fact_id = fact.id
     );

  RETURN public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_INPUT_PREFLIGHT_ONLY',
    'data_classification', 'pseudonymized_health_data',
    'therapy_input_revision', jsonb_build_object(
      'therapy_input_revision_id', input_revision.id,
      'content_sha256', input_revision.content_sha256,
      'envelope_schema_version', input_revision.envelope_schema_version,
      'hash_schema_version', input_revision.hash_schema_version,
      'deidentification_version', input_revision.deidentification_version,
      'data_classification', input_revision.data_classification,
      'source_count', input_revision.source_count
    ),
    'fact_selection_policy', jsonb_build_object(
      'policy_version', 1,
      'accepted_review_statuses', jsonb_build_array('verified', 'review_only'),
      'terminal_facts_only', true
    ),
    'fact_counts', jsonb_build_object(
      'total', total_fact_count,
      'terminal', terminal_fact_count,
      'superseded', superseded_fact_count,
      'selected', selected_fact_count,
      'verified', verified_fact_count,
      'review_only', review_only_fact_count,
      'excluded_unreviewed', excluded_unreviewed_fact_count,
      'excluded_rejected', excluded_rejected_fact_count
    ),
    'complete_fact_set_hash', complete_fact_set_hash,
    'selected_facts', selected_facts
  ));
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_input_hash_v1(
  _therapy_input_revision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(
    public.therapy_retrieval_v2_input_manifest_v1(_therapy_input_revision_id)
  )
$$;

CREATE FUNCTION public.therapy_retrieval_v2_expectations_are_valid_v1(
  _expected_therapy_input_hash text,
  _expected_release_manifest_hash text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    _expected_therapy_input_hash ~ '^[0-9a-f]{64}$'
    AND _expected_release_manifest_hash ~ '^[0-9a-f]{64}$',
    false
  )
$$;

CREATE FUNCTION public.therapy_retrieval_v2_preflight_v1(
  _therapy_input_revision_id uuid,
  _expected_therapy_input_hash text,
  _knowledge_release_id uuid,
  _expected_release_manifest_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  input_manifest jsonb;
  actual_input_hash text;
  knowledge_release public.kb_releases%ROWTYPE;
  actual_release_manifest_hash text;
  input_hash_matches boolean;
  release_hash_matches boolean;
  selected_fact_count integer;
  review_only_fact_count integer;
  binding_manifest jsonb;
  binding_hash text;
  result_status text;
  result_payload jsonb;
BEGIN
  IF public.therapy_retrieval_v2_expectations_are_valid_v1(
       _expected_therapy_input_hash,
       _expected_release_manifest_hash
     ) IS DISTINCT FROM true
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_V2_EXPECTATION_INVALID',
      'interpretation', 'PREFLIGHT_ONLY_NOT_RETRIEVAL_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  input_manifest := public.therapy_retrieval_v2_input_manifest_v1(
    _therapy_input_revision_id
  );
  IF input_manifest IS NULL THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_V2_INPUT_UNAVAILABLE',
      'interpretation', 'PREFLIGHT_ONLY_NOT_RETRIEVAL_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'expected_therapy_input_hash', _expected_therapy_input_hash,
      'knowledge_release_id', _knowledge_release_id,
      'expected_release_manifest_hash', _expected_release_manifest_hash
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  SELECT release.*
    INTO knowledge_release
    FROM public.kb_releases release
   WHERE release.id = _knowledge_release_id
     AND public.kb_release_is_valid(release.id, true) IS TRUE
     AND release.retrieval_eligible IS FALSE
     AND release.is_active IS FALSE;

  IF NOT FOUND THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_V2_RELEASE_UNAVAILABLE',
      'interpretation', 'PREFLIGHT_ONLY_NOT_RETRIEVAL_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'expected_therapy_input_hash', _expected_therapy_input_hash,
      'knowledge_release_id', _knowledge_release_id,
      'expected_release_manifest_hash', _expected_release_manifest_hash
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  actual_input_hash := public.kb_release_manifest_hash_v1(input_manifest);
  actual_release_manifest_hash := knowledge_release.release_manifest_hash;
  input_hash_matches := actual_input_hash = _expected_therapy_input_hash;
  release_hash_matches :=
    actual_release_manifest_hash = _expected_release_manifest_hash;
  selected_fact_count := (input_manifest #>> '{fact_counts,selected}')::integer;
  review_only_fact_count :=
    (input_manifest #>> '{fact_counts,review_only}')::integer;

  binding_manifest := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_PREFLIGHT_ONLY',
    'data_classification', 'pseudonymized_health_data',
    'medical_use_allowed', false,
    'retrieval_execution_allowed', false,
    'therapy_input', jsonb_build_object(
      'therapy_input_revision_id', _therapy_input_revision_id,
      'input_manifest_hash', actual_input_hash,
      'fact_selection_policy_version', 1,
      'selected_fact_count', selected_fact_count,
      'review_only_fact_count', review_only_fact_count
    ),
    'knowledge_release', jsonb_build_object(
      'knowledge_release_id', knowledge_release.id,
      'release_key', knowledge_release.release_key,
      'release_manifest_hash', actual_release_manifest_hash,
      'release_item_count', jsonb_array_length(
        knowledge_release.release_manifest -> 'items'
      ),
      'retrieval_eligible', knowledge_release.retrieval_eligible,
      'is_active', knowledge_release.is_active
    )
  ));
  binding_hash := public.kb_release_manifest_hash_v1(binding_manifest);
  result_status := CASE
    WHEN input_hash_matches AND release_hash_matches
      THEN 'RETRIEVAL_V2_PREFLIGHT_BOUND_INACTIVE'
    ELSE 'RETRIEVAL_V2_BINDING_MISMATCH'
  END;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_PREFLIGHT_ONLY',
    'status', result_status,
    'interpretation', 'PREFLIGHT_ONLY_NOT_RETRIEVAL_OR_MEDICAL_USE',
    'medical_use_allowed', false,
    'retrieval_execution_allowed', false,
    'therapy_input_revision_id', _therapy_input_revision_id,
    'expected_therapy_input_hash', _expected_therapy_input_hash,
    'actual_therapy_input_hash', actual_input_hash,
    'therapy_input_hash_matches', input_hash_matches,
    'knowledge_release_id', _knowledge_release_id,
    'expected_release_manifest_hash', _expected_release_manifest_hash,
    'actual_release_manifest_hash', actual_release_manifest_hash,
    'release_manifest_hash_matches', release_hash_matches,
    'selected_fact_count', selected_fact_count,
    'review_only_fact_count', review_only_fact_count,
    'requires_fact_review', review_only_fact_count > 0,
    'input_manifest', input_manifest,
    'binding_manifest', binding_manifest,
    'binding_hash', binding_hash
  ));
  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

COMMENT ON FUNCTION public.therapy_retrieval_v2_input_manifest_v1(uuid) IS
  'Step 6A owner-only manifest of one valid input revision and its terminal verified or review-only facts. It omits raw clinical values and grants no retrieval use.';
COMMENT ON FUNCTION public.therapy_retrieval_v2_preflight_v1(uuid, text, uuid, text) IS
  'Step 6A deterministic owner preflight binding one input manifest to one sealed but inactive knowledge release. It does not retrieve, rank, recommend, dose, or authorize medical use.';

REVOKE ALL ON FUNCTION
  public.therapy_retrieval_v2_input_manifest_v1(uuid),
  public.therapy_retrieval_v2_input_hash_v1(uuid),
  public.therapy_retrieval_v2_expectations_are_valid_v1(text, text),
  public.therapy_retrieval_v2_preflight_v1(uuid, text, uuid, text)
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMIT;
