BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure(
       'public.therapy_retrieval_v2_preflight_v1(uuid,text,uuid,text)'
     ) IS NULL
     OR to_regprocedure(
       'public.therapy_retrieval_v2_input_manifest_v1(uuid)'
     ) IS NULL
     OR to_regprocedure('public.kb_search_normalize_v1(text)') IS NULL
     OR to_regprocedure('public.kb_search_document_is_valid(uuid)') IS NULL
     OR to_regprocedure('public.kb_release_is_valid(uuid,boolean)') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regclass('public.kb_search_documents') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Entity resolution preflight requires the complete Step 6A and search contracts';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 67 THEN
    RAISE EXCEPTION 'Entity resolution preflight requires the exact 67-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Entity resolution preflight cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_entity_query_manifest_v1(
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
  input_manifest jsonb;
  selected_fact_count integer;
  result jsonb;
BEGIN
  input_manifest := public.therapy_retrieval_v2_input_manifest_v1(
    _therapy_input_revision_id
  );
  IF input_manifest IS NULL THEN
    RETURN NULL;
  END IF;

  selected_fact_count := (input_manifest #>> '{fact_counts,selected}')::integer;
  IF selected_fact_count NOT BETWEEN 1 AND 64 THEN
    RETURN NULL;
  END IF;

  -- Free-text fact values are never truncated. This bounded reference reader
  -- fails closed until a later chunked query contract handles larger values.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(input_manifest -> 'selected_facts') selected(value)
      JOIN public.therapy_input_facts fact
        ON fact.id = (selected.value ->> 'fact_id')::uuid
       AND fact.therapy_input_revision_id = _therapy_input_revision_id
     WHERE octet_length(public.kb_search_normalize_v1(fact.fact_label)) > 1024
        OR (
          fact.fact_value ->> 'type' = 'text'
          AND (
            octet_length(fact.fact_value ->> 'value') > 1024
            OR octet_length(public.kb_search_normalize_v1(
                 fact.fact_value ->> 'value'
               )) > 1024
          )
        )
        OR (
          fact.fact_value ->> 'type' = 'coded'
          AND fact.fact_value ? 'display'
          AND octet_length(public.kb_search_normalize_v1(
                fact.fact_value ->> 'display'
              )) > 1024
        )
        OR (
          fact.fact_value ->> 'type' = 'coded'
          AND octet_length(public.kb_search_normalize_v1(
                fact.fact_value ->> 'code'
              )) > 1024
        )
  ) THEN
    RETURN NULL;
  END IF;

  WITH selected AS MATERIALIZED (
    SELECT (item.value ->> 'fact_id')::uuid AS fact_id
      FROM jsonb_array_elements(input_manifest -> 'selected_facts') item(value)
  ), query_rows AS MATERIALIZED (
    SELECT
      fact.id AS fact_id,
      fact.fact_order,
      fact.fact_type,
      fact.fact_key,
      fact.is_negated,
      fact.clinical_status,
      fact.review_status,
      fact.kb_entity_id,
      fact.content_sha256,
      query_terms.values AS query_terms,
      identifier_terms.values AS identifier_terms
      FROM selected
      JOIN public.therapy_input_facts fact ON fact.id = selected.fact_id
      CROSS JOIN LATERAL (
        SELECT COALESCE(
                 jsonb_agg(term.value ORDER BY term.value COLLATE "C"),
                 '[]'::jsonb
               ) AS values
          FROM (
            SELECT DISTINCT public.kb_search_normalize_v1(raw.value) AS value
              FROM (VALUES
                (fact.fact_label),
                (CASE WHEN fact.fact_value ->> 'type' = 'text'
                  THEN fact.fact_value ->> 'value' END),
                (CASE WHEN fact.fact_value ->> 'type' = 'coded'
                  THEN fact.fact_value ->> 'display' END),
                (CASE WHEN fact.fact_value ->> 'type' = 'coded'
                  THEN fact.fact_value ->> 'code' END)
             ) raw(value)
             WHERE NULLIF(btrim(raw.value), '') IS NOT NULL
               AND octet_length(public.kb_search_normalize_v1(raw.value)) <= 1024
          ) term
      ) query_terms
      CROSS JOIN LATERAL (
        SELECT COALESCE(
                 jsonb_agg(term.value ORDER BY term.value COLLATE "C"),
                 '[]'::jsonb
               ) AS values
          FROM (
            SELECT 'identifier_value:'
                   || to_jsonb(fact.fact_value ->> 'code')::text AS value
             WHERE fact.fact_value ->> 'type' = 'coded'
               AND fact.fact_value ->> 'system' IN (
                 'pzn', 'gtin', 'loinc', 'icd_10_gm', 'atc',
                 'ncbi_taxonomy', 'program_code'
               )
            UNION
            SELECT 'identifier:' || jsonb_build_array(
                     fact.fact_value ->> 'system',
                     NULL,
                     fact.fact_value ->> 'code'
                   )::text
             WHERE fact.fact_value ->> 'type' = 'coded'
               AND fact.fact_value ->> 'system' IN (
                 'pzn', 'gtin', 'loinc', 'icd_10_gm', 'atc', 'ncbi_taxonomy'
               )
          ) term
      ) identifier_terms
  ), manifested AS (
    SELECT jsonb_build_object(
      'fact_id', query.fact_id,
      'fact_order', query.fact_order,
      'fact_type', query.fact_type,
      'fact_key', query.fact_key,
      'is_negated', query.is_negated,
      'clinical_status', query.clinical_status,
      'review_status', query.review_status,
      'kb_entity_id', query.kb_entity_id,
      'fact_content_sha256', query.content_sha256,
      'query_terms', query.query_terms,
      'identifier_terms', query.identifier_terms,
      'query_hash', public.kb_release_manifest_hash_v1(
        public.kb_release_canonical_jsonb_v1(jsonb_build_object(
          'fact_id', query.fact_id,
          'fact_content_sha256', query.content_sha256,
          'kb_entity_id', query.kb_entity_id,
          'query_terms', query.query_terms,
          'identifier_terms', query.identifier_terms
        ))
      )
    ) AS value,
    query.fact_order,
    query.fact_id
      FROM query_rows query
  )
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_ENTITY_QUERY_PREFLIGHT_ONLY',
    'data_classification', 'pseudonymized_health_data',
    'therapy_input_revision_id', _therapy_input_revision_id,
    'input_manifest_hash', public.kb_release_manifest_hash_v1(input_manifest),
    'query_policy', jsonb_build_object(
      'policy_version', 1,
      'maximum_selected_fact_count', 64,
      'maximum_query_term_bytes', 1024,
      'term_sources', jsonb_build_array(
        'fact_label', 'text_value', 'coded_display', 'coded_code'
      ),
      'identifier_policy', 'QUALIFIED_GLOBAL_OR_UNQUALIFIED_EXACT'
    ),
    'selected_fact_count', selected_fact_count,
    'facts', jsonb_agg(manifested.value ORDER BY manifested.fact_order, manifested.fact_id)
  ))
    INTO result
    FROM manifested;

  IF result IS NULL OR octet_length(result::text) > 1048576 THEN
    RETURN NULL;
  END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_entity_projection_is_complete_v1(
  _knowledge_release_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  release_item_count integer;
  entity_item_count integer;
  relation_item_count integer;
BEGIN
  SELECT count(*)::integer
    INTO release_item_count
    FROM (
      SELECT 1
        FROM public.kb_release_items item
       WHERE item.release_id = _knowledge_release_id
       LIMIT 4097
    ) bounded;
  IF release_item_count NOT BETWEEN 1 AND 4096 THEN
    RETURN false;
  END IF;

  SELECT count(*)::integer
    INTO entity_item_count
    FROM (
      SELECT 1
        FROM public.kb_release_items item
       WHERE item.release_id = _knowledge_release_id
         AND item.item_kind = 'entity_revision'
       LIMIT 1025
    ) bounded;
  IF entity_item_count NOT BETWEEN 1 AND 1024 THEN
    RETURN false;
  END IF;

  SELECT count(*)::integer
    INTO relation_item_count
    FROM (
      SELECT 1
        FROM public.kb_release_items item
       WHERE item.release_id = _knowledge_release_id
         AND item.item_kind = 'assertion'
         AND item.item_manifest #>> '{assertion,assertion_kind}' = 'entity_relation'
       LIMIT 2049
    ) bounded;
  IF relation_item_count > 2048 THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
           SELECT 1
             FROM public.kb_releases release
            WHERE release.id = _knowledge_release_id
              AND release.retrieval_eligible IS FALSE
              AND release.is_active IS FALSE
              AND public.kb_release_is_valid(release.id, true) IS TRUE
         )
     AND NOT EXISTS (
           SELECT 1
             FROM public.kb_release_items item
             LEFT JOIN public.kb_search_documents document
               ON document.release_id = item.release_id
              AND document.release_item_id = item.id
            WHERE item.release_id = _knowledge_release_id
              AND item.item_kind = 'entity_revision'
              AND (
                document.release_item_id IS NULL
                OR document.document_kind <> 'entity_revision'
                OR public.kb_search_document_is_valid(item.id) IS DISTINCT FROM true
              )
         );
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_entity_resolution_preflight_v1(
  _therapy_input_revision_id uuid,
  _expected_therapy_input_hash text,
  _knowledge_release_id uuid,
  _expected_release_manifest_hash text,
  _direct_limit integer DEFAULT 8,
  _graph_limit integer DEFAULT 16
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  binding_result jsonb;
  query_manifest jsonb;
  query_manifest_hash text;
  fact_results jsonb;
  direct_count_before_limit integer;
  returned_direct_count integer;
  graph_count_before_limit integer;
  returned_graph_count integer;
  missing_explicit_link_count integer;
  release_item_count integer;
  result_payload jsonb;
BEGIN
  IF _direct_limit IS NULL
     OR _direct_limit NOT BETWEEN 1 AND 16
     OR _graph_limit IS NULL
     OR _graph_limit NOT BETWEEN 1 AND 32
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_ENTITY_RESOLUTION_PREFLIGHT_ONLY',
      'status', 'ENTITY_RESOLUTION_LIMIT_INVALID',
      'interpretation', 'ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  -- Bound the release before the Step 6A validator can inspect its manifest.
  SELECT count(*)::integer
    INTO release_item_count
    FROM (
      SELECT 1
        FROM public.kb_release_items item
       WHERE item.release_id = _knowledge_release_id
       LIMIT 4097
    ) bounded;
  IF release_item_count NOT BETWEEN 1 AND 4096 THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_ENTITY_RESOLUTION_PREFLIGHT_ONLY',
      'status', 'ENTITY_RESOLUTION_PROJECTION_UNAVAILABLE',
      'interpretation', 'ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  binding_result := public.therapy_retrieval_v2_preflight_v1(
    _therapy_input_revision_id,
    _expected_therapy_input_hash,
    _knowledge_release_id,
    _expected_release_manifest_hash
  );
  IF binding_result ->> 'status' <> 'RETRIEVAL_V2_PREFLIGHT_BOUND_INACTIVE' THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_ENTITY_RESOLUTION_PREFLIGHT_ONLY',
      'status', 'ENTITY_RESOLUTION_BINDING_UNAVAILABLE',
      'interpretation', 'ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'binding_status', binding_result ->> 'status',
      'binding_result_hash', binding_result ->> 'result_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  query_manifest := public.therapy_retrieval_v2_entity_query_manifest_v1(
    _therapy_input_revision_id
  );
  IF query_manifest IS NULL
     OR query_manifest ->> 'input_manifest_hash'
        IS DISTINCT FROM binding_result ->> 'actual_therapy_input_hash'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_ENTITY_RESOLUTION_PREFLIGHT_ONLY',
      'status', 'ENTITY_RESOLUTION_QUERY_UNAVAILABLE',
      'interpretation', 'ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'binding_hash', binding_result ->> 'binding_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF public.therapy_retrieval_v2_entity_projection_is_complete_v1(
       _knowledge_release_id
     ) IS DISTINCT FROM true
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_ENTITY_RESOLUTION_PREFLIGHT_ONLY',
      'status', 'ENTITY_RESOLUTION_PROJECTION_UNAVAILABLE',
      'interpretation', 'ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'binding_hash', binding_result ->> 'binding_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  SELECT count(*)::integer
    INTO missing_explicit_link_count
    FROM jsonb_array_elements(query_manifest -> 'facts') fact(value)
   WHERE fact.value ->> 'kb_entity_id' IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.kb_release_items item
        WHERE item.release_id = _knowledge_release_id
          AND item.item_kind = 'entity_revision'
          AND item.entity_id = (fact.value ->> 'kb_entity_id')::uuid
     );
  IF missing_explicit_link_count > 0 THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_ENTITY_RESOLUTION_PREFLIGHT_ONLY',
      'status', 'ENTITY_RESOLUTION_EXPLICIT_LINK_UNAVAILABLE',
      'interpretation', 'ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'binding_hash', binding_result ->> 'binding_hash',
      'missing_explicit_link_count', missing_explicit_link_count
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  query_manifest_hash := public.kb_release_manifest_hash_v1(query_manifest);

  WITH fact_query AS MATERIALIZED (
    SELECT
      (item.value ->> 'fact_id')::uuid AS fact_id,
      (item.value ->> 'fact_order')::integer AS fact_order,
      item.value ->> 'fact_type' AS fact_type,
      item.value ->> 'fact_key' AS fact_key,
      (item.value ->> 'is_negated')::boolean AS is_negated,
      item.value ->> 'review_status' AS review_status,
      (item.value ->> 'kb_entity_id')::uuid AS kb_entity_id,
      item.value ->> 'fact_content_sha256' AS fact_content_sha256,
      item.value ->> 'query_hash' AS query_hash,
      item.value -> 'query_terms' AS query_terms,
      item.value -> 'identifier_terms' AS identifier_terms
      FROM jsonb_array_elements(query_manifest -> 'facts') item(value)
  ), release_entity AS MATERIALIZED (
    SELECT
      item.id AS release_item_id,
      item.item_order AS release_item_order,
      item.entity_id,
      item.entity_revision_id,
      item.item_manifest_hash,
      item.item_manifest #>> '{entity,entity_type_code}' AS entity_type_code,
      item.item_manifest #>> '{entity,display_name}' AS display_name,
      document.canonical_key,
      document.normalized_title,
      document.normalized_aliases,
      document.identifier_terms,
      document.search_vector_german,
      document.search_vector_simple,
      document.projection_hash
      FROM public.kb_release_items item
      JOIN public.kb_search_documents document
        ON document.release_id = item.release_id
       AND document.release_item_id = item.id
     WHERE item.release_id = _knowledge_release_id
       AND item.item_kind = 'entity_revision'
  ), channel_matches AS MATERIALIZED (
    SELECT fact.fact_id, item.id AS release_item_id,
           1 AS match_priority, 'exact_kb_entity_link'::text AS match_channel
      FROM fact_query fact
      JOIN public.kb_release_items item
        ON item.release_id = _knowledge_release_id
       AND item.item_kind = 'entity_revision'
       AND item.entity_id = fact.kb_entity_id
      JOIN public.kb_search_documents document
        ON document.release_id = item.release_id
       AND document.release_item_id = item.id
     WHERE fact.kb_entity_id IS NOT NULL
    UNION ALL
    SELECT fact.fact_id, item.id, 2, 'exact_qualified_identifier'
      FROM fact_query fact
      CROSS JOIN LATERAL jsonb_array_elements_text(
        fact.identifier_terms
      ) term(value)
      JOIN public.kb_search_documents document
        ON document.release_id = _knowledge_release_id
       AND document.document_kind = 'entity_revision'
       AND document.identifier_terms @> ARRAY[term.value]::text[]
      JOIN public.kb_release_items item
        ON item.release_id = document.release_id
       AND item.id = document.release_item_id
       AND item.item_kind = 'entity_revision'
     WHERE term.value LIKE 'identifier:[%'
    UNION ALL
    SELECT fact.fact_id, item.id, 3, 'exact_unqualified_identifier'
      FROM fact_query fact
      CROSS JOIN LATERAL jsonb_array_elements_text(
        fact.identifier_terms
      ) term(value)
      JOIN public.kb_search_documents document
        ON document.release_id = _knowledge_release_id
       AND document.document_kind = 'entity_revision'
       AND document.identifier_terms @> ARRAY[term.value]::text[]
      JOIN public.kb_release_items item
        ON item.release_id = document.release_id
       AND item.id = document.release_item_id
       AND item.item_kind = 'entity_revision'
     WHERE term.value LIKE 'identifier_value:%'
    UNION ALL
    SELECT fact.fact_id, item.id, 4, 'exact_normalized_title'
      FROM fact_query fact
      CROSS JOIN LATERAL jsonb_array_elements_text(fact.query_terms) term(value)
      JOIN public.kb_search_documents document
        ON document.release_id = _knowledge_release_id
       AND document.document_kind = 'entity_revision'
       AND document.normalized_title = term.value
      JOIN public.kb_release_items item
        ON item.release_id = document.release_id
       AND item.id = document.release_item_id
       AND item.item_kind = 'entity_revision'
    UNION ALL
    SELECT fact.fact_id, item.id, 5, 'exact_normalized_alias'
      FROM fact_query fact
      CROSS JOIN LATERAL jsonb_array_elements_text(fact.query_terms) term(value)
      JOIN public.kb_search_documents document
        ON document.release_id = _knowledge_release_id
       AND document.document_kind = 'entity_revision'
       AND document.normalized_aliases @> ARRAY[term.value]::text[]
      JOIN public.kb_release_items item
        ON item.release_id = document.release_id
       AND item.id = document.release_item_id
       AND item.item_kind = 'entity_revision'
    UNION ALL
    SELECT fact.fact_id, item.id, 6, 'exact_canonical_key'
      FROM fact_query fact
      CROSS JOIN LATERAL jsonb_array_elements_text(fact.query_terms) term(value)
      JOIN public.kb_search_documents document
        ON document.release_id = _knowledge_release_id
       AND document.document_kind = 'entity_revision'
       AND document.canonical_key = term.value
      JOIN public.kb_release_items item
        ON item.release_id = document.release_id
       AND item.id = document.release_item_id
       AND item.item_kind = 'entity_revision'
    UNION ALL
    SELECT fact.fact_id, item.id, 7, 'german_full_text'
      FROM fact_query fact
      CROSS JOIN LATERAL jsonb_array_elements_text(fact.query_terms) term(value)
      JOIN public.kb_search_documents document
        ON document.release_id = _knowledge_release_id
       AND document.document_kind = 'entity_revision'
       AND document.search_vector_german
           @@ plainto_tsquery('pg_catalog.german', term.value)
      JOIN public.kb_release_items item
        ON item.release_id = document.release_id
       AND item.id = document.release_item_id
       AND item.item_kind = 'entity_revision'
    UNION ALL
    SELECT fact.fact_id, item.id, 8, 'simple_full_text'
      FROM fact_query fact
      CROSS JOIN LATERAL jsonb_array_elements_text(fact.query_terms) term(value)
      JOIN public.kb_search_documents document
        ON document.release_id = _knowledge_release_id
       AND document.document_kind = 'entity_revision'
       AND document.search_vector_simple
           @@ plainto_tsquery('pg_catalog.simple', term.value)
      JOIN public.kb_release_items item
        ON item.release_id = document.release_id
       AND item.id = document.release_item_id
       AND item.item_kind = 'entity_revision'
  ), distinct_channels AS MATERIALIZED (
    SELECT DISTINCT fact_id, release_item_id, match_priority, match_channel
      FROM channel_matches
  ), grouped_channels AS MATERIALIZED (
    SELECT channel.fact_id,
           channel.release_item_id,
           min(channel.match_priority) AS match_priority,
           (array_agg(
             channel.match_channel ORDER BY channel.match_priority
           ))[1] AS best_match_channel,
           array_agg(
             channel.match_channel ORDER BY channel.match_priority
           ) AS matched_channels
      FROM distinct_channels channel
     GROUP BY channel.fact_id, channel.release_item_id
  ), direct_matches AS MATERIALIZED (
    SELECT fact.*, entity.*,
           channel.match_priority,
           channel.best_match_channel,
           channel.matched_channels
      FROM grouped_channels channel
      JOIN fact_query fact ON fact.fact_id = channel.fact_id
      JOIN release_entity entity
        ON entity.release_item_id = channel.release_item_id
  ), direct_ranked AS MATERIALIZED (
    SELECT direct.*,
           row_number() OVER (
             PARTITION BY direct.fact_id
             ORDER BY direct.match_priority,
                      direct.canonical_key COLLATE "C",
                      direct.entity_revision_id
           )::integer AS position,
           count(*) OVER (PARTITION BY direct.fact_id)::integer
             AS candidate_count_before_limit
      FROM direct_matches direct
  ), direct_limited AS MATERIALIZED (
    SELECT *
      FROM direct_ranked
     WHERE position <= _direct_limit
  ), release_relation AS MATERIALIZED (
    SELECT
      item.id AS release_item_id,
      item.item_order AS release_item_order,
      item.assertion_id,
      item.item_manifest_hash,
      (item.item_manifest #>> '{assertion,relation,subject_entity_id}')::uuid
        AS subject_entity_id,
      item.item_manifest #>> '{assertion,relation,relation_type_code}'
        AS relation_type_code,
      (item.item_manifest #>> '{assertion,relation,object_entity_id}')::uuid
        AS object_entity_id,
      item.item_manifest #>> '{assertion,relation,assignment_strength}'
        AS assignment_strength,
      (item.item_manifest #>> '{assertion,relation,rank}')::smallint AS relation_rank
      FROM public.kb_release_items item
     WHERE item.release_id = _knowledge_release_id
       AND item.item_kind = 'assertion'
       AND item.item_manifest #>> '{assertion,assertion_kind}' = 'entity_relation'
  ), graph_matches AS MATERIALIZED (
    SELECT
      direct.fact_id,
      direct.fact_order,
      direct.query_hash,
      direct.position AS direct_position,
      direct.entity_id AS source_entity_id,
      direct.entity_revision_id AS source_entity_revision_id,
      relation.release_item_id AS relation_release_item_id,
      relation.assertion_id,
      relation.item_manifest_hash AS assertion_item_manifest_hash,
      relation.relation_type_code,
      CASE WHEN relation.subject_entity_id = direct.entity_id
        THEN 'outbound' ELSE 'inbound' END AS graph_direction,
      relation.assignment_strength,
      relation.relation_rank,
      neighbor.release_item_id,
      neighbor.entity_id,
      neighbor.entity_revision_id,
      neighbor.item_manifest_hash,
      neighbor.entity_type_code,
      neighbor.display_name,
      neighbor.canonical_key,
      neighbor.projection_hash
      FROM direct_limited direct
      JOIN release_relation relation
        ON relation.subject_entity_id = direct.entity_id
        OR relation.object_entity_id = direct.entity_id
      JOIN release_entity neighbor
        ON neighbor.entity_id = CASE
          WHEN relation.subject_entity_id = direct.entity_id
            THEN relation.object_entity_id
          ELSE relation.subject_entity_id
        END
  ), graph_ranked AS MATERIALIZED (
    SELECT graph.*,
           row_number() OVER (
             PARTITION BY graph.fact_id
             ORDER BY graph.direct_position,
                      graph.relation_type_code COLLATE "C",
                      graph.assertion_id,
                      graph.canonical_key COLLATE "C",
                      graph.entity_revision_id
           )::integer AS position,
           count(*) OVER (PARTITION BY graph.fact_id)::integer
             AS candidate_count_before_limit
      FROM graph_matches graph
  ), graph_limited AS MATERIALIZED (
    SELECT *
      FROM graph_ranked
     WHERE position <= _graph_limit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'fact_id', fact.fact_id,
           'fact_order', fact.fact_order,
           'fact_type', fact.fact_type,
           'fact_key', fact.fact_key,
           'is_negated', fact.is_negated,
           'review_status', fact.review_status,
           'fact_content_sha256', fact.fact_content_sha256,
           'query_hash', fact.query_hash,
           'direct_candidate_count_before_limit', COALESCE((
             SELECT max(candidate.candidate_count_before_limit)
               FROM direct_ranked candidate
              WHERE candidate.fact_id = fact.fact_id
           ), 0),
           'returned_direct_candidate_count', (
             SELECT count(*)::integer
               FROM direct_limited candidate
              WHERE candidate.fact_id = fact.fact_id
           ),
           'direct_candidates', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'position', candidate.position,
               'candidate_status', 'ENTITY_REFERENCE_MATCH_ONLY',
               'release_item_id', candidate.release_item_id,
               'entity_id', candidate.entity_id,
               'entity_revision_id', candidate.entity_revision_id,
               'item_manifest_hash', candidate.item_manifest_hash,
               'entity_type_code', candidate.entity_type_code,
               'display_name', candidate.display_name,
               'canonical_key', candidate.canonical_key,
               'best_match_channel', candidate.best_match_channel,
               'matched_channels', to_jsonb(candidate.matched_channels),
               'projection_hash', candidate.projection_hash
             ) ORDER BY candidate.position)
               FROM direct_limited candidate
              WHERE candidate.fact_id = fact.fact_id
           ), '[]'::jsonb),
           'graph_candidate_count_before_limit', COALESCE((
             SELECT max(candidate.candidate_count_before_limit)
               FROM graph_ranked candidate
              WHERE candidate.fact_id = fact.fact_id
           ), 0),
           'returned_graph_candidate_count', (
             SELECT count(*)::integer
               FROM graph_limited candidate
              WHERE candidate.fact_id = fact.fact_id
           ),
           'graph_candidates', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'position', candidate.position,
               'candidate_status', 'GRAPH_EDGE_MATCH_ONLY_NOT_RECOMMENDATION',
               'source_direct_position', candidate.direct_position,
               'source_entity_id', candidate.source_entity_id,
               'source_entity_revision_id', candidate.source_entity_revision_id,
               'relation_release_item_id', candidate.relation_release_item_id,
               'assertion_id', candidate.assertion_id,
               'assertion_item_manifest_hash', candidate.assertion_item_manifest_hash,
               'relation_type_code', candidate.relation_type_code,
               'graph_direction', candidate.graph_direction,
               'assignment_strength', candidate.assignment_strength,
               'relation_rank', candidate.relation_rank,
               'release_item_id', candidate.release_item_id,
               'entity_id', candidate.entity_id,
               'entity_revision_id', candidate.entity_revision_id,
               'item_manifest_hash', candidate.item_manifest_hash,
               'entity_type_code', candidate.entity_type_code,
               'display_name', candidate.display_name,
               'canonical_key', candidate.canonical_key,
               'projection_hash', candidate.projection_hash
             ) ORDER BY candidate.position)
               FROM graph_limited candidate
              WHERE candidate.fact_id = fact.fact_id
           ), '[]'::jsonb)
         ) ORDER BY fact.fact_order, fact.fact_id), '[]'::jsonb),
         COALESCE(sum(COALESCE((
           SELECT max(candidate.candidate_count_before_limit)
             FROM direct_ranked candidate
            WHERE candidate.fact_id = fact.fact_id
         ), 0)), 0)::integer,
         COALESCE(sum((
           SELECT count(*)::integer
             FROM direct_limited candidate
            WHERE candidate.fact_id = fact.fact_id
         )), 0)::integer,
         COALESCE(sum(COALESCE((
           SELECT max(candidate.candidate_count_before_limit)
             FROM graph_ranked candidate
            WHERE candidate.fact_id = fact.fact_id
         ), 0)), 0)::integer,
         COALESCE(sum((
           SELECT count(*)::integer
             FROM graph_limited candidate
            WHERE candidate.fact_id = fact.fact_id
         )), 0)::integer
    INTO fact_results,
         direct_count_before_limit,
         returned_direct_count,
         graph_count_before_limit,
         returned_graph_count
    FROM fact_query fact;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_ENTITY_RESOLUTION_PREFLIGHT_ONLY',
    'status', 'ENTITY_RESOLUTION_PREFLIGHT_COMPLETE_INACTIVE',
    'interpretation', 'ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE',
    'medical_use_allowed', false,
    'retrieval_execution_allowed', false,
    'therapy_input_revision_id', _therapy_input_revision_id,
    'therapy_input_manifest_hash', binding_result ->> 'actual_therapy_input_hash',
    'knowledge_release_id', _knowledge_release_id,
    'release_manifest_hash', binding_result ->> 'actual_release_manifest_hash',
    'binding_hash', binding_result ->> 'binding_hash',
    'query_manifest_hash', query_manifest_hash,
    'direct_limit_per_fact', _direct_limit,
    'graph_limit_per_fact', _graph_limit,
    'graph_maximum_hops', 1,
    'direct_ordering_dimensions', jsonb_build_array(
      'exact_kb_entity_link',
      'exact_qualified_identifier',
      'exact_unqualified_identifier',
      'exact_normalized_title',
      'exact_normalized_alias',
      'exact_canonical_key',
      'german_full_text',
      'simple_full_text',
      'canonical_key_asc',
      'entity_revision_id_asc'
    ),
    'graph_ordering_dimensions', jsonb_build_array(
      'source_direct_position_asc',
      'relation_type_code_asc',
      'assertion_id_asc',
      'canonical_key_asc',
      'entity_revision_id_asc'
    ),
    'selected_fact_count', (query_manifest ->> 'selected_fact_count')::integer,
    'direct_candidate_count_before_limit', direct_count_before_limit,
    'returned_direct_candidate_count', returned_direct_count,
    'graph_candidate_count_before_limit', graph_count_before_limit,
    'returned_graph_candidate_count', returned_graph_count,
    'facts', fact_results
  ));

  IF octet_length(result_payload::text) > 8388608 THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_ENTITY_RESOLUTION_PREFLIGHT_ONLY',
      'status', 'ENTITY_RESOLUTION_RESULT_LIMIT_EXCEEDED',
      'interpretation', 'ENTITY_MATCH_ONLY_NOT_SAFETY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'therapy_input_manifest_hash', binding_result ->> 'actual_therapy_input_hash',
      'knowledge_release_id', _knowledge_release_id,
      'release_manifest_hash', binding_result ->> 'actual_release_manifest_hash',
      'binding_hash', binding_result ->> 'binding_hash',
      'query_manifest_hash', query_manifest_hash,
      'direct_limit_per_fact', _direct_limit,
      'graph_limit_per_fact', _graph_limit,
      'direct_candidate_count_before_limit', direct_count_before_limit,
      'graph_candidate_count_before_limit', graph_count_before_limit
    ));
  END IF;

  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

COMMENT ON FUNCTION public.therapy_retrieval_v2_entity_query_manifest_v1(uuid) IS
  'Step 6B owner-only bounded query projection from the exact Step 6A selected facts. It is pseudonymized health data and grants no retrieval or medical use.';
COMMENT ON FUNCTION public.therapy_retrieval_v2_entity_resolution_preflight_v1(uuid, text, uuid, text, integer, integer) IS
  'Step 6B owner-only deterministic identifier, name, alias, full-text and one-hop graph preflight against one inactive sealed release. Every result is match provenance, never safety, efficacy or a recommendation.';

REVOKE ALL ON FUNCTION
  public.therapy_retrieval_v2_entity_query_manifest_v1(uuid),
  public.therapy_retrieval_v2_entity_projection_is_complete_v1(uuid),
  public.therapy_retrieval_v2_entity_resolution_preflight_v1(
    uuid, text, uuid, text, integer, integer
  )
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMIT;
