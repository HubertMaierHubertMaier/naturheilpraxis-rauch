BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure(
       'public.therapy_retrieval_v2_entity_resolution_preflight_v1(uuid,text,uuid,text,integer,integer)'
     ) IS NULL
     OR to_regprocedure(
       'public.therapy_retrieval_v2_entity_query_manifest_v1(uuid)'
     ) IS NULL
     OR to_regprocedure(
       'public.kb_homeopathic_repertory_lane_status_v1(uuid,uuid)'
     ) IS NULL
     OR to_regprocedure(
       'public.kb_homeopathic_repertorization_request_manifest_v1(uuid,uuid,jsonb)'
     ) IS NULL
     OR to_regprocedure(
       'public.kb_homeopathic_repertorize_single_v1(uuid,uuid,jsonb,integer)'
     ) IS NULL
     OR to_regclass('public.kb_homeopathic_repertory_remedies') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Split-track preflight requires the complete Step 5B-1 and Step 6B contracts';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 67 THEN
    RAISE EXCEPTION 'Split-track preflight requires the exact 67-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Split-track preflight cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_reference_track_v1(
  _knowledge_release_id uuid,
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN NOT EXISTS (
        SELECT 1
          FROM public.kb_release_items item
         WHERE item.release_id = _knowledge_release_id
           AND item.item_kind = 'entity_revision'
           AND item.entity_id = _entity_id
           AND item.entity_revision_id = _entity_revision_id
      ) THEN 'UNRESOLVED_REFERENCE'
      WHEN entity.entity_type_code IN (
        'homeopathic_repertory', 'homeopathic_remedy'
      ) THEN 'HOMEOPATHIC_REFERENCE'
      WHEN entity.entity_type_code = 'preparation' THEN CASE
        WHEN EXISTS (
          SELECT 1
            FROM public.kb_preparation_revision_details detail
           WHERE detail.entity_id = revision.entity_id
             AND detail.entity_revision_id = revision.id
             AND detail.preparation_kind IN (
               'homeopathic_single', 'homeopathic_complex', 'nosode',
               'sarcode', 'isode'
             )
        ) THEN 'HOMEOPATHIC_REFERENCE'
        WHEN EXISTS (
          SELECT 1
            FROM public.kb_preparation_revision_details detail
           WHERE detail.entity_id = revision.entity_id
             AND detail.entity_revision_id = revision.id
        ) THEN 'GENERAL_OR_NATUROPATHIC_REFERENCE'
        ELSE 'UNRESOLVED_REFERENCE'
      END
      WHEN entity.entity_type_code = 'product_variant' THEN CASE
        WHEN EXISTS (
          SELECT 1
            FROM public.kb_product_variant_revision_details variant
            JOIN public.kb_preparation_revision_details preparation
              ON preparation.entity_id = variant.preparation_entity_id
             AND preparation.entity_revision_id = variant.preparation_revision_id
           WHERE variant.entity_id = revision.entity_id
             AND variant.entity_revision_id = revision.id
             AND preparation.preparation_kind IN (
               'homeopathic_single', 'homeopathic_complex', 'nosode',
               'sarcode', 'isode'
             )
        ) THEN 'HOMEOPATHIC_REFERENCE'
        WHEN EXISTS (
          SELECT 1
            FROM public.kb_product_variant_revision_details variant
            JOIN public.kb_preparation_revision_details preparation
              ON preparation.entity_id = variant.preparation_entity_id
             AND preparation.entity_revision_id = variant.preparation_revision_id
           WHERE variant.entity_id = revision.entity_id
             AND variant.entity_revision_id = revision.id
        ) THEN 'GENERAL_OR_NATUROPATHIC_REFERENCE'
        ELSE 'UNRESOLVED_REFERENCE'
      END
      WHEN entity.entity_type_code = 'product' THEN 'UNRESOLVED_REFERENCE'
      ELSE 'GENERAL_OR_NATUROPATHIC_REFERENCE'
    END
      FROM public.kb_entity_revisions revision
      JOIN public.kb_entities entity ON entity.id = revision.entity_id
     WHERE revision.entity_id = _entity_id
       AND revision.id = _entity_revision_id
  ), 'UNRESOLVED_REFERENCE')
$$;

CREATE FUNCTION public.therapy_retrieval_v2_homeopathic_request_manifest_v1(
  _therapy_input_revision_id uuid,
  _repertory_entity_id uuid,
  _repertory_revision_id uuid,
  _rubric_links jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  query_manifest jsonb;
  reader_request jsonb;
  reader_manifest jsonb;
  fact_links jsonb;
  item jsonb;
  fact_id uuid;
  fact_id_text text;
  rubric_revision_id uuid;
  rubric_revision_id_text text;
  seen_rubric_revision_ids uuid[] := ARRAY[]::uuid[];
  result jsonb;
BEGIN
  IF _therapy_input_revision_id IS NULL
     OR _repertory_entity_id IS NULL
     OR _repertory_revision_id IS NULL
     OR _rubric_links IS NULL
     OR jsonb_typeof(_rubric_links) <> 'array'
     OR octet_length(_rubric_links::text) > 131072
     OR jsonb_array_length(_rubric_links) NOT BETWEEN 1 AND 256
  THEN
    RETURN NULL;
  END IF;

  query_manifest := public.therapy_retrieval_v2_entity_query_manifest_v1(
    _therapy_input_revision_id
  );
  IF query_manifest IS NULL THEN
    RETURN NULL;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(_rubric_links)
  LOOP
    IF public.kb_release_jsonb_has_exact_keys_v1(
         item,
         ARRAY[
           'importance', 'polarity', 'rubric_revision_id',
           'therapy_input_fact_id'
         ]::text[]
       ) IS DISTINCT FROM true
       OR jsonb_typeof(item -> 'therapy_input_fact_id') <> 'string'
       OR jsonb_typeof(item -> 'rubric_revision_id') <> 'string'
       OR jsonb_typeof(item -> 'importance') <> 'number'
       OR jsonb_typeof(item -> 'polarity') <> 'string'
       OR (item ->> 'importance') !~ '^[1-5]$'
       OR (item ->> 'polarity') NOT IN ('include', 'exclude')
    THEN
      RETURN NULL;
    END IF;

    fact_id_text := item ->> 'therapy_input_fact_id';
    rubric_revision_id_text := item ->> 'rubric_revision_id';
    BEGIN
      fact_id := fact_id_text::uuid;
      rubric_revision_id := rubric_revision_id_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NULL;
    END;

    IF fact_id_text <> fact_id::text
       OR rubric_revision_id_text <> rubric_revision_id::text
       OR rubric_revision_id = ANY(seen_rubric_revision_ids)
       OR NOT EXISTS (
         SELECT 1
           FROM jsonb_array_elements(query_manifest -> 'facts') fact(value)
          WHERE fact.value ->> 'fact_id' = fact_id::text
       )
    THEN
      RETURN NULL;
    END IF;
    seen_rubric_revision_ids := array_append(
      seen_rubric_revision_ids, rubric_revision_id
    );
  END LOOP;

  SELECT jsonb_agg(
           jsonb_build_object(
             'rubric_revision_id', item.value ->> 'rubric_revision_id',
             'importance', (item.value ->> 'importance')::integer,
             'polarity', item.value ->> 'polarity'
           )
           ORDER BY item.value ->> 'rubric_revision_id' COLLATE "C"
         )
    INTO reader_request
    FROM jsonb_array_elements(_rubric_links) item(value);

  reader_manifest := public.kb_homeopathic_repertorization_request_manifest_v1(
    _repertory_entity_id,
    _repertory_revision_id,
    reader_request
  );
  IF reader_manifest IS NULL THEN
    RETURN NULL;
  END IF;

  WITH requested_links AS MATERIALIZED (
    SELECT
      (item.value ->> 'therapy_input_fact_id')::uuid AS fact_id,
      (item.value ->> 'rubric_revision_id')::uuid AS rubric_revision_id,
      (item.value ->> 'importance')::integer AS importance,
      item.value ->> 'polarity' AS polarity
      FROM jsonb_array_elements(_rubric_links) item(value)
  ), selected_facts AS MATERIALIZED (
    SELECT
      (fact.value ->> 'fact_id')::uuid AS fact_id,
      fact.value ->> 'fact_content_sha256' AS fact_content_sha256,
      fact.value ->> 'query_hash' AS query_hash,
      fact.value ->> 'review_status' AS review_status
      FROM jsonb_array_elements(query_manifest -> 'facts') fact(value)
  ), requested_rubrics AS MATERIALIZED (
    SELECT
      (rubric.value ->> 'rubric_revision_id')::uuid AS rubric_revision_id,
      rubric.value
      FROM jsonb_array_elements(
        reader_manifest -> 'requested_rubrics'
      ) rubric(value)
  )
  SELECT jsonb_agg(
           jsonb_build_object(
             'therapy_input_fact_id', link.fact_id,
             'fact_content_sha256', fact.fact_content_sha256,
             'fact_query_hash', fact.query_hash,
             'fact_review_status', fact.review_status,
             'rubric_revision_id', link.rubric_revision_id,
             'rubric_id', rubric.value ->> 'rubric_id',
             'rubric_content_hash', rubric.value ->> 'rubric_content_hash',
             'importance', link.importance,
             'polarity', link.polarity
           )
           ORDER BY link.rubric_revision_id::text COLLATE "C", link.fact_id
         )
    INTO fact_links
    FROM requested_links link
    JOIN selected_facts fact ON fact.fact_id = link.fact_id
    JOIN requested_rubrics rubric
      ON rubric.rubric_revision_id = link.rubric_revision_id;

  result := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_HOMEOPATHIC_REQUEST_PREFLIGHT_ONLY',
    'data_classification', 'pseudonymized_health_data',
    'therapy_input_revision_id', _therapy_input_revision_id,
    'input_manifest_hash', query_manifest ->> 'input_manifest_hash',
    'repertory_entity_id', _repertory_entity_id,
    'repertory_revision_id', _repertory_revision_id,
    'link_policy', jsonb_build_object(
      'policy_version', 1,
      'selected_facts_only', true,
      'maximum_link_count', 256,
      'one_fact_per_unique_rubric', true
    ),
    'fact_rubric_links', fact_links,
    'repertory_request_manifest', reader_manifest,
    'repertory_request_hash', public.kb_release_manifest_hash_v1(reader_manifest)
  ));

  IF result IS NULL OR octet_length(result::text) > 1048576 THEN
    RETURN NULL;
  END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_split_track_preflight_v1(
  _therapy_input_revision_id uuid,
  _expected_therapy_input_hash text,
  _knowledge_release_id uuid,
  _expected_release_manifest_hash text,
  _repertory_entity_id uuid,
  _repertory_revision_id uuid,
  _rubric_links jsonb,
  _expected_homeopathic_request_hash text,
  _direct_limit integer DEFAULT 8,
  _graph_limit integer DEFAULT 16,
  _homeopathic_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  entity_resolution jsonb;
  request_manifest jsonb;
  request_hash text;
  reader_request jsonb;
  reader_result jsonb;
  rubric_count integer;
  grade_count integer;
  remedy_count integer;
  assignment_count integer;
  general_facts jsonb;
  general_direct_count integer;
  general_graph_count integer;
  excluded_homeopathic_count integer;
  unresolved_count integer;
  general_payload jsonb;
  homeopathic_payload jsonb;
  result_payload jsonb;
BEGIN
  IF _expected_homeopathic_request_hash IS NULL
     OR _expected_homeopathic_request_hash !~ '^[0-9a-f]{64}$'
     OR _homeopathic_limit IS NULL
     OR _homeopathic_limit NOT BETWEEN 1 AND 200
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SPLIT_TRACK_PREFLIGHT_ONLY',
      'status', 'SPLIT_TRACK_EXPECTATION_INVALID',
      'interpretation', 'SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  entity_resolution := public.therapy_retrieval_v2_entity_resolution_preflight_v1(
    _therapy_input_revision_id,
    _expected_therapy_input_hash,
    _knowledge_release_id,
    _expected_release_manifest_hash,
    _direct_limit,
    _graph_limit
  );
  IF entity_resolution ->> 'status'
       <> 'ENTITY_RESOLUTION_PREFLIGHT_COMPLETE_INACTIVE'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SPLIT_TRACK_PREFLIGHT_ONLY',
      'status', 'SPLIT_TRACK_ENTITY_RESOLUTION_UNAVAILABLE',
      'interpretation', 'SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'entity_resolution_status', entity_resolution ->> 'status',
      'entity_resolution_result_hash', entity_resolution ->> 'result_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  -- Bound every repertory component before request validation can traverse it.
  SELECT count(*)::integer
    INTO rubric_count
    FROM (
      SELECT 1
        FROM public.kb_homeopathic_rubric_revisions rubric
       WHERE rubric.repertory_entity_id = _repertory_entity_id
         AND rubric.repertory_revision_id = _repertory_revision_id
       LIMIT 257
    ) bounded;
  IF rubric_count NOT BETWEEN 1 AND 256 THEN
    result_payload := NULL;
  ELSE
    SELECT count(*)::integer
      INTO grade_count
      FROM (
        SELECT 1
          FROM public.kb_homeopathic_grade_definitions grade
         WHERE grade.repertory_entity_id = _repertory_entity_id
           AND grade.repertory_revision_id = _repertory_revision_id
         LIMIT 65
      ) bounded;
    IF grade_count NOT BETWEEN 1 AND 64 THEN
      result_payload := NULL;
    ELSE
      SELECT count(*)::integer
        INTO remedy_count
        FROM (
          SELECT 1
            FROM public.kb_homeopathic_repertory_remedies remedy
           WHERE remedy.repertory_entity_id = _repertory_entity_id
             AND remedy.repertory_revision_id = _repertory_revision_id
           LIMIT 257
        ) bounded;
      IF remedy_count NOT BETWEEN 1 AND 256 THEN
        result_payload := NULL;
      ELSE
        SELECT count(*)::integer
          INTO assignment_count
          FROM (
            SELECT 1
              FROM public.kb_homeopathic_rubric_remedy_assignments assignment
             WHERE assignment.repertory_entity_id = _repertory_entity_id
               AND assignment.repertory_revision_id = _repertory_revision_id
             LIMIT 2049
          ) bounded;
        IF assignment_count NOT BETWEEN 1 AND 2048 THEN
          result_payload := NULL;
        ELSE
          result_payload := '{}'::jsonb;
        END IF;
      END IF;
    END IF;
  END IF;

  IF result_payload IS NULL THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SPLIT_TRACK_PREFLIGHT_ONLY',
      'status', 'SPLIT_TRACK_HOMEOPATHIC_SCOPE_UNAVAILABLE',
      'interpretation', 'SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  request_manifest := public.therapy_retrieval_v2_homeopathic_request_manifest_v1(
    _therapy_input_revision_id,
    _repertory_entity_id,
    _repertory_revision_id,
    _rubric_links
  );
  IF request_manifest IS NULL
     OR request_manifest ->> 'input_manifest_hash'
        IS DISTINCT FROM entity_resolution ->> 'therapy_input_manifest_hash'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SPLIT_TRACK_PREFLIGHT_ONLY',
      'status', 'SPLIT_TRACK_HOMEOPATHIC_REQUEST_UNAVAILABLE',
      'interpretation', 'SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'entity_resolution_result_hash', entity_resolution ->> 'result_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  request_hash := public.kb_release_manifest_hash_v1(request_manifest);
  IF request_hash <> _expected_homeopathic_request_hash THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SPLIT_TRACK_PREFLIGHT_ONLY',
      'status', 'SPLIT_TRACK_HOMEOPATHIC_REQUEST_MISMATCH',
      'interpretation', 'SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'actual_homeopathic_request_hash', request_hash
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF NOT EXISTS (
       SELECT 1
         FROM public.kb_homeopathic_repertory_revision_details detail
         JOIN public.kb_release_items repertory_item
           ON repertory_item.release_id = _knowledge_release_id
          AND repertory_item.item_kind = 'entity_revision'
          AND repertory_item.entity_id = detail.entity_id
          AND repertory_item.entity_revision_id = detail.entity_revision_id
         JOIN public.kb_release_items source_item
           ON source_item.release_id = _knowledge_release_id
          AND source_item.item_kind = 'source_revision'
          AND source_item.source_id = detail.source_id
          AND source_item.source_revision_id = detail.source_revision_id
        WHERE detail.entity_id = _repertory_entity_id
          AND detail.entity_revision_id = _repertory_revision_id
     )
     OR EXISTS (
       SELECT 1
         FROM public.kb_homeopathic_repertory_remedies remedy
        WHERE remedy.repertory_entity_id = _repertory_entity_id
          AND remedy.repertory_revision_id = _repertory_revision_id
          AND NOT EXISTS (
            SELECT 1
              FROM public.kb_release_items item
             WHERE item.release_id = _knowledge_release_id
               AND item.item_kind = 'entity_revision'
               AND item.entity_id = remedy.remedy_entity_id
               AND item.entity_revision_id = remedy.remedy_revision_id
          )
     )
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SPLIT_TRACK_PREFLIGHT_ONLY',
      'status', 'SPLIT_TRACK_HOMEOPATHIC_SCOPE_UNAVAILABLE',
      'interpretation', 'SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'homeopathic_request_hash', request_hash
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF public.kb_homeopathic_repertory_lane_status_v1(
       _repertory_entity_id, _repertory_revision_id
     ) <> 'HOMEOPATHIC_LANE_READY'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SPLIT_TRACK_PREFLIGHT_ONLY',
      'status', 'SPLIT_TRACK_HOMEOPATHIC_READER_UNAVAILABLE',
      'interpretation', 'SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'homeopathic_request_hash', request_hash
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  SELECT jsonb_agg(
           jsonb_build_object(
             'rubric_revision_id', link.value ->> 'rubric_revision_id',
             'importance', (link.value ->> 'importance')::integer,
             'polarity', link.value ->> 'polarity'
           )
           ORDER BY link.value ->> 'rubric_revision_id' COLLATE "C"
         )
    INTO reader_request
    FROM jsonb_array_elements(_rubric_links) link(value);
  reader_result := public.kb_homeopathic_repertorize_single_v1(
    _repertory_entity_id,
    _repertory_revision_id,
    reader_request,
    _homeopathic_limit
  );

  IF reader_result ->> 'status' NOT IN (
       'HOMEOPATHIC_NO_REPERTORY_MATCHES',
       'HOMEOPATHIC_REPERTORY_MATCHES_READY'
     )
     OR reader_result ->> 'request_hash' IS DISTINCT FROM
        request_manifest ->> 'repertory_request_hash'
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(reader_result -> 'candidates') candidate(value)
        WHERE public.therapy_retrieval_v2_reference_track_v1(
                _knowledge_release_id,
                (candidate.value ->> 'remedy_entity_id')::uuid,
                (candidate.value ->> 'remedy_revision_id')::uuid
              ) <> 'HOMEOPATHIC_REFERENCE'
     )
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SPLIT_TRACK_PREFLIGHT_ONLY',
      'status', 'SPLIT_TRACK_HOMEOPATHIC_READER_UNAVAILABLE',
      'interpretation', 'SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'homeopathic_request_hash', request_hash,
      'reader_status', reader_result ->> 'status',
      'reader_result_hash', reader_result ->> 'result_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  WITH facts AS MATERIALIZED (
    SELECT
      fact.value,
      (fact.value ->> 'fact_id')::uuid AS fact_id,
      (fact.value ->> 'fact_order')::integer AS fact_order
      FROM jsonb_array_elements(entity_resolution -> 'facts') fact(value)
  ), direct_references AS MATERIALIZED (
    SELECT
      fact.fact_id,
      candidate.value,
      (candidate.value ->> 'position')::integer AS position,
      public.therapy_retrieval_v2_reference_track_v1(
        _knowledge_release_id,
        (candidate.value ->> 'entity_id')::uuid,
        (candidate.value ->> 'entity_revision_id')::uuid
      ) AS reference_track
      FROM facts fact
      CROSS JOIN LATERAL jsonb_array_elements(
        fact.value -> 'direct_candidates'
      ) candidate(value)
  ), graph_references AS MATERIALIZED (
    SELECT
      fact.fact_id,
      candidate.value,
      (candidate.value ->> 'position')::integer AS position,
      CASE
        WHEN track.source_track = 'HOMEOPATHIC_REFERENCE'
          OR track.destination_track = 'HOMEOPATHIC_REFERENCE'
          THEN 'HOMEOPATHIC_REFERENCE'
        WHEN track.source_track = 'GENERAL_OR_NATUROPATHIC_REFERENCE'
          AND track.destination_track = 'GENERAL_OR_NATUROPATHIC_REFERENCE'
          THEN 'GENERAL_OR_NATUROPATHIC_REFERENCE'
        ELSE 'UNRESOLVED_REFERENCE'
      END AS reference_track
      FROM facts fact
      CROSS JOIN LATERAL jsonb_array_elements(
        fact.value -> 'graph_candidates'
      ) candidate(value)
      CROSS JOIN LATERAL (
        SELECT
          public.therapy_retrieval_v2_reference_track_v1(
            _knowledge_release_id,
            (candidate.value ->> 'source_entity_id')::uuid,
            (candidate.value ->> 'source_entity_revision_id')::uuid
          ) AS source_track,
          public.therapy_retrieval_v2_reference_track_v1(
            _knowledge_release_id,
            (candidate.value ->> 'entity_id')::uuid,
            (candidate.value ->> 'entity_revision_id')::uuid
          ) AS destination_track
      ) track
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'fact_id', fact.fact_id,
      'fact_order', fact.fact_order,
      'fact_content_sha256', fact.value ->> 'fact_content_sha256',
      'fact_query_hash', fact.value ->> 'query_hash',
      'direct_references', COALESCE((
        SELECT jsonb_agg(
                 direct.value || jsonb_build_object(
                   'track_status',
                   'GENERAL_REFERENCE_MATCH_ONLY_NOT_ELIGIBILITY'
                 )
                 ORDER BY direct.position
               )
          FROM direct_references direct
         WHERE direct.fact_id = fact.fact_id
           AND direct.reference_track = 'GENERAL_OR_NATUROPATHIC_REFERENCE'
      ), '[]'::jsonb),
      'graph_references', COALESCE((
        SELECT jsonb_agg(
                 graph.value || jsonb_build_object(
                   'track_status',
                   'GENERAL_GRAPH_MATCH_ONLY_NOT_ELIGIBILITY'
                 )
                 ORDER BY graph.position
               )
          FROM graph_references graph
         WHERE graph.fact_id = fact.fact_id
           AND graph.reference_track = 'GENERAL_OR_NATUROPATHIC_REFERENCE'
      ), '[]'::jsonb),
      'excluded_homeopathic_reference_count',
        (SELECT count(*)::integer
           FROM (
             SELECT reference_track FROM direct_references direct
              WHERE direct.fact_id = fact.fact_id
             UNION ALL
             SELECT reference_track FROM graph_references graph
              WHERE graph.fact_id = fact.fact_id
           ) reference
          WHERE reference.reference_track = 'HOMEOPATHIC_REFERENCE'),
      'unresolved_reference_count',
        (SELECT count(*)::integer
           FROM (
             SELECT reference_track FROM direct_references direct
              WHERE direct.fact_id = fact.fact_id
             UNION ALL
             SELECT reference_track FROM graph_references graph
              WHERE graph.fact_id = fact.fact_id
           ) reference
          WHERE reference.reference_track = 'UNRESOLVED_REFERENCE')
    ) ORDER BY fact.fact_order, fact.fact_id), '[]'::jsonb),
    (SELECT count(*)::integer FROM direct_references
      WHERE reference_track = 'GENERAL_OR_NATUROPATHIC_REFERENCE'),
    (SELECT count(*)::integer FROM graph_references
      WHERE reference_track = 'GENERAL_OR_NATUROPATHIC_REFERENCE'),
    (SELECT count(*)::integer
       FROM (
         SELECT reference_track FROM direct_references
         UNION ALL
         SELECT reference_track FROM graph_references
       ) reference
      WHERE reference.reference_track = 'HOMEOPATHIC_REFERENCE'),
    (SELECT count(*)::integer
       FROM (
         SELECT reference_track FROM direct_references
         UNION ALL
         SELECT reference_track FROM graph_references
       ) reference
      WHERE reference.reference_track = 'UNRESOLVED_REFERENCE')
    INTO general_facts,
         general_direct_count,
         general_graph_count,
         excluded_homeopathic_count,
         unresolved_count
    FROM facts fact;

  general_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'track', 'GENERAL_OR_NATUROPATHIC_REFERENCE_TRACK',
    'status', 'GENERAL_REFERENCE_MATCHES_READY_INACTIVE',
    'interpretation', 'ENTITY_REFERENCE_MATCH_NOT_ELIGIBILITY_OR_RECOMMENDATION',
    'candidate_eligibility_assessed', false,
    'entity_resolution_result_hash', entity_resolution ->> 'result_hash',
    'direct_reference_count', general_direct_count,
    'graph_reference_count', general_graph_count,
    'excluded_homeopathic_reference_count', excluded_homeopathic_count,
    'unresolved_reference_count', unresolved_count,
    'facts', general_facts
  ));
  general_payload := general_payload || jsonb_build_object(
    'track_result_hash', public.kb_release_manifest_hash_v1(general_payload)
  );

  homeopathic_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'track', 'HOMEOPATHIC_SOURCE_NATIVE_REPERTORY_TRACK',
    'status', CASE reader_result ->> 'status'
      WHEN 'HOMEOPATHIC_NO_REPERTORY_MATCHES'
        THEN 'HOMEOPATHIC_NO_REPERTORY_MATCHES_INACTIVE'
      ELSE 'HOMEOPATHIC_REPERTORY_MATCHES_READY_INACTIVE'
    END,
    'interpretation', 'SOURCE_NATIVE_REPERTORY_MATCH_NOT_EFFICACY_OR_RECOMMENDATION',
    'candidate_eligibility_assessed', false,
    'homeopathic_request_hash', request_hash,
    'reader_status', reader_result ->> 'status',
    'reader_result_hash', reader_result ->> 'result_hash',
    'candidate_count_before_limit',
      (reader_result ->> 'candidate_count_before_limit')::integer,
    'returned_candidate_count',
      (reader_result ->> 'returned_candidate_count')::integer,
    'candidates', reader_result -> 'candidates'
  ));
  homeopathic_payload := homeopathic_payload || jsonb_build_object(
    'track_result_hash', public.kb_release_manifest_hash_v1(homeopathic_payload)
  );

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_SPLIT_TRACK_PREFLIGHT_ONLY',
    'status', 'SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE',
    'interpretation', 'SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE',
    'medical_use_allowed', false,
    'retrieval_execution_allowed', false,
    'candidate_status_assignment_allowed', false,
    'therapy_input_revision_id', _therapy_input_revision_id,
    'therapy_input_manifest_hash', entity_resolution ->> 'therapy_input_manifest_hash',
    'knowledge_release_id', _knowledge_release_id,
    'release_manifest_hash', entity_resolution ->> 'release_manifest_hash',
    'binding_hash', entity_resolution ->> 'binding_hash',
    'entity_resolution_result_hash', entity_resolution ->> 'result_hash',
    'homeopathic_request_manifest', request_manifest,
    'homeopathic_request_hash', request_hash,
    'track_separation_policy', jsonb_build_object(
      'policy_version', 1,
      'cross_track_candidate_reuse_allowed', false,
      'general_track_excludes_homeopathic_references', true,
      'homeopathic_track_source', 'EXACT_SINGLE_REPERTORY_ONLY',
      'unresolved_product_family_references_excluded', true
    ),
    'general_track', general_payload,
    'homeopathic_track', homeopathic_payload
  ));

  IF octet_length(result_payload::text) > 8388608 THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SPLIT_TRACK_PREFLIGHT_ONLY',
      'status', 'SPLIT_TRACK_RESULT_LIMIT_EXCEEDED',
      'interpretation', 'SEPARATE_MATCH_TRACKS_NOT_ELIGIBILITY_EFFICACY_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'entity_resolution_result_hash', entity_resolution ->> 'result_hash',
      'homeopathic_request_hash', request_hash,
      'general_track_result_hash', general_payload ->> 'track_result_hash',
      'homeopathic_track_result_hash', homeopathic_payload ->> 'track_result_hash'
    ));
  END IF;

  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

COMMENT ON FUNCTION public.therapy_retrieval_v2_reference_track_v1(uuid, uuid, uuid) IS
  'Step 6C owner-only release-bound reference classification. Unresolvable product families remain excluded; no classification is candidate eligibility.';
COMMENT ON FUNCTION public.therapy_retrieval_v2_homeopathic_request_manifest_v1(uuid, uuid, uuid, jsonb) IS
  'Step 6C owner-only binding of selected patient facts to exact source-native rubric revisions. It is pseudonymized health data and grants no medical use.';
COMMENT ON FUNCTION public.therapy_retrieval_v2_split_track_preflight_v1(uuid, text, uuid, text, uuid, uuid, jsonb, text, integer, integer, integer) IS
  'Step 6C owner-only inactive split-track preflight. General entity references and source-native homeopathic repertory matches remain separate and are never eligibility, efficacy or recommendations.';

REVOKE ALL ON FUNCTION
  public.therapy_retrieval_v2_reference_track_v1(uuid, uuid, uuid),
  public.therapy_retrieval_v2_homeopathic_request_manifest_v1(
    uuid, uuid, uuid, jsonb
  ),
  public.therapy_retrieval_v2_split_track_preflight_v1(
    uuid, text, uuid, text, uuid, uuid, jsonb, text,
    integer, integer, integer
  )
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMIT;
