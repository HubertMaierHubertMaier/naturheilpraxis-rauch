BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure(
       'public.therapy_retrieval_v2_candidate_status_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,integer,integer,integer)'
     ) IS NULL
     OR to_regprocedure('public.kb_dosage_rule_is_valid(uuid)') IS NULL
     OR to_regprocedure('public.kb_dosage_rule_hash_v1(uuid)') IS NULL
     OR to_regprocedure('public.kb_invalid_dosage_rule_count()') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Dosage-rule preflight requires the complete Step 6E contract';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 67 THEN
    RAISE EXCEPTION 'Dosage-rule preflight requires the exact 67-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Dosage-rule preflight cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_dosage_rule_scope_v1(
  _knowledge_release_id uuid,
  _candidate_status_result jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  release_manifest_hash text;
  allow_candidate_count integer;
  total_dosage_assertion_count integer;
  total_dosage_rule_count integer;
  total_dosage_source_binding_count integer;
  candidate_rule_count integer;
  candidate_source_binding_count integer;
  rules jsonb;
  result_payload jsonb;
BEGIN
  IF _knowledge_release_id IS NULL
     OR _candidate_status_result IS NULL
     OR jsonb_typeof(_candidate_status_result) IS DISTINCT FROM 'object'
     OR _candidate_status_result ->> 'status'
        IS DISTINCT FROM 'CANDIDATE_STATUS_PREFLIGHT_COMPLETE_INACTIVE'
     OR _candidate_status_result ->> 'knowledge_release_id'
        IS DISTINCT FROM _knowledge_release_id::text
     OR _candidate_status_result ->> 'result_hash'
        IS DISTINCT FROM public.kb_release_manifest_hash_v1(
          _candidate_status_result - 'result_hash'
        )
     OR jsonb_typeof(_candidate_status_result -> 'general_track')
        IS DISTINCT FROM 'object'
     OR _candidate_status_result #>> '{general_track,track_result_hash}'
        IS DISTINCT FROM public.kb_release_manifest_hash_v1(
          (_candidate_status_result -> 'general_track') - 'track_result_hash'
        )
     OR jsonb_typeof(_candidate_status_result #> '{general_track,candidates}')
        IS DISTINCT FROM 'array'
     OR jsonb_array_length(
          _candidate_status_result #> '{general_track,candidates}'
        ) > 512
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(
           _candidate_status_result #> '{general_track,candidates}'
        ) candidate(value)
        WHERE candidate.value ->> 'candidate_status' = 'ALLOW'
          AND (
            candidate.value ->> 'entity_type_code' IS NULL
            OR candidate.value ->> 'entity_type_code' NOT IN (
              'preparation', 'product_variant'
            )
          )
     )
  THEN
    RETURN NULL;
  END IF;

  SELECT release.release_manifest_hash
    INTO release_manifest_hash
    FROM public.kb_releases release
   WHERE release.id = _knowledge_release_id
     AND release.release_status = 'sealed'
     AND NOT release.retrieval_eligible
     AND NOT release.is_active
     AND public.kb_release_is_valid(release.id, true);

  IF NOT FOUND
     OR release_manifest_hash IS DISTINCT FROM
        _candidate_status_result ->> 'release_manifest_hash'
  THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::integer
    INTO total_dosage_assertion_count
    FROM (
      SELECT 1
        FROM public.kb_assertions assertion
       WHERE assertion.assertion_kind = 'dosage'
       LIMIT 4097
    ) bounded;
  IF total_dosage_assertion_count > 4096 THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::integer
    INTO total_dosage_rule_count
    FROM (
      SELECT 1
        FROM public.kb_dosage_rules rule
       LIMIT 4097
    ) bounded;
  IF total_dosage_rule_count > 4096
  THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::integer
    INTO total_dosage_source_binding_count
    FROM (
      SELECT 1
        FROM public.kb_assertion_sources binding
        JOIN public.kb_assertions assertion
          ON assertion.id = binding.assertion_id
         AND assertion.assertion_kind = 'dosage'
       LIMIT 16385
    ) bounded;
  IF total_dosage_source_binding_count > 16384
     OR public.kb_invalid_dosage_rule_count() <> 0
  THEN
    RETURN NULL;
  END IF;

  WITH allow_candidates AS MATERIALIZED (
    SELECT
      (candidate.value ->> 'entity_id')::uuid AS entity_id,
      (candidate.value ->> 'entity_revision_id')::uuid AS entity_revision_id,
      candidate.value ->> 'entity_type_code' AS entity_type_code,
      candidate.value ->> 'entity_content_hash' AS entity_content_hash
      FROM jsonb_array_elements(
        _candidate_status_result #> '{general_track,candidates}'
      ) candidate(value)
     WHERE candidate.value ->> 'candidate_status' = 'ALLOW'
       AND candidate.value ->> 'entity_type_code' IN (
         'preparation', 'product_variant'
       )
  ), candidate_rules AS MATERIALIZED (
    SELECT
      rule.*,
      assertion.content_hash AS assertion_content_hash,
      candidate.entity_type_code,
      candidate.entity_content_hash
      FROM allow_candidates candidate
      JOIN public.kb_dosage_rules rule
        ON rule.subject_entity_id = candidate.entity_id
       AND rule.subject_entity_revision_id = candidate.entity_revision_id
      JOIN public.kb_assertions assertion
        ON assertion.id = rule.assertion_id
       AND assertion.assertion_kind = 'dosage'
       AND assertion.review_status = 'released'
  )
  SELECT (SELECT count(*)::integer FROM allow_candidates),
         (SELECT count(*)::integer FROM candidate_rules)
    INTO allow_candidate_count, candidate_rule_count;

  IF candidate_rule_count > 2048 THEN
    RETURN NULL;
  END IF;

  WITH allow_candidates AS MATERIALIZED (
    SELECT
      (candidate.value ->> 'entity_id')::uuid AS entity_id,
      (candidate.value ->> 'entity_revision_id')::uuid AS entity_revision_id
      FROM jsonb_array_elements(
        _candidate_status_result #> '{general_track,candidates}'
      ) candidate(value)
     WHERE candidate.value ->> 'candidate_status' = 'ALLOW'
       AND candidate.value ->> 'entity_type_code' IN (
         'preparation', 'product_variant'
       )
  ), candidate_rules AS MATERIALIZED (
    SELECT rule.assertion_id
      FROM allow_candidates candidate
      JOIN public.kb_dosage_rules rule
        ON rule.subject_entity_id = candidate.entity_id
       AND rule.subject_entity_revision_id = candidate.entity_revision_id
      JOIN public.kb_assertions assertion
        ON assertion.id = rule.assertion_id
       AND assertion.assertion_kind = 'dosage'
       AND assertion.review_status = 'released'
  )
  SELECT count(*)::integer
    INTO candidate_source_binding_count
    FROM (
      SELECT 1
        FROM candidate_rules rule
        JOIN public.kb_assertion_sources binding
          ON binding.assertion_id = rule.assertion_id
       LIMIT 8193
    ) bounded;
  IF candidate_source_binding_count > 8192 THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    WITH allow_candidates AS MATERIALIZED (
      SELECT
        (candidate.value ->> 'entity_id')::uuid AS entity_id,
        (candidate.value ->> 'entity_revision_id')::uuid AS entity_revision_id
        FROM jsonb_array_elements(
          _candidate_status_result #> '{general_track,candidates}'
        ) candidate(value)
       WHERE candidate.value ->> 'candidate_status' = 'ALLOW'
         AND candidate.value ->> 'entity_type_code' IN (
           'preparation', 'product_variant'
         )
    ), candidate_rules AS MATERIALIZED (
      SELECT rule.*
        FROM allow_candidates candidate
        JOIN public.kb_dosage_rules rule
          ON rule.subject_entity_id = candidate.entity_id
         AND rule.subject_entity_revision_id = candidate.entity_revision_id
        JOIN public.kb_assertions assertion
          ON assertion.id = rule.assertion_id
         AND assertion.assertion_kind = 'dosage'
         AND assertion.review_status = 'released'
    )
    SELECT 1
      FROM candidate_rules rule
     WHERE public.kb_dosage_rule_is_valid(rule.id) IS DISTINCT FROM true
        OR NOT EXISTS (
          SELECT 1
            FROM public.kb_release_items item
           WHERE item.release_id = _knowledge_release_id
             AND item.item_kind = 'assertion'
             AND item.assertion_id = rule.assertion_id
        )
        OR NOT EXISTS (
          SELECT 1
            FROM public.kb_release_items item
           WHERE item.release_id = _knowledge_release_id
             AND item.item_kind = 'entity_revision'
             AND item.entity_id = rule.subject_entity_id
             AND item.entity_revision_id = rule.subject_entity_revision_id
        )
        OR (
          rule.indication_entity_revision_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
              FROM public.kb_release_items item
             WHERE item.release_id = _knowledge_release_id
               AND item.item_kind = 'entity_revision'
               AND item.entity_id = rule.indication_entity_id
               AND item.entity_revision_id = rule.indication_entity_revision_id
          )
        )
        OR (
          rule.population_entity_revision_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
              FROM public.kb_release_items item
             WHERE item.release_id = _knowledge_release_id
               AND item.item_kind = 'entity_revision'
               AND item.entity_id = rule.population_entity_id
               AND item.entity_revision_id = rule.population_entity_revision_id
          )
        )
        OR EXISTS (
          SELECT 1
            FROM public.kb_assertion_sources binding
            JOIN public.kb_source_revisions source_revision
              ON source_revision.id = binding.source_revision_id
           WHERE binding.assertion_id = rule.assertion_id
             AND NOT EXISTS (
               SELECT 1
                 FROM public.kb_release_items item
                WHERE item.release_id = _knowledge_release_id
                  AND item.item_kind = 'source_revision'
                  AND item.source_id = source_revision.source_id
                  AND item.source_revision_id = source_revision.id
             )
        )
  ) THEN
    RETURN NULL;
  END IF;

  WITH allow_candidates AS MATERIALIZED (
    SELECT
      (candidate.value ->> 'entity_id')::uuid AS entity_id,
      (candidate.value ->> 'entity_revision_id')::uuid AS entity_revision_id,
      candidate.value ->> 'entity_type_code' AS entity_type_code,
      candidate.value ->> 'entity_content_hash' AS entity_content_hash
      FROM jsonb_array_elements(
        _candidate_status_result #> '{general_track,candidates}'
      ) candidate(value)
     WHERE candidate.value ->> 'candidate_status' = 'ALLOW'
       AND candidate.value ->> 'entity_type_code' IN (
         'preparation', 'product_variant'
       )
  ), candidate_rules AS MATERIALIZED (
    SELECT
      rule.*,
      assertion.content_hash AS assertion_content_hash,
      candidate.entity_type_code,
      candidate.entity_content_hash
      FROM allow_candidates candidate
      JOIN public.kb_dosage_rules rule
        ON rule.subject_entity_id = candidate.entity_id
       AND rule.subject_entity_revision_id = candidate.entity_revision_id
      JOIN public.kb_assertions assertion
        ON assertion.id = rule.assertion_id
       AND assertion.assertion_kind = 'dosage'
       AND assertion.review_status = 'released'
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'dosage_rule_id', rule.id,
           'dosage_rule_content_hash', rule.rule_content_hash,
           'assertion_id', rule.assertion_id,
           'assertion_content_hash', rule.assertion_content_hash,
           'subject_entity_id', rule.subject_entity_id,
           'subject_entity_revision_id', rule.subject_entity_revision_id,
           'subject_entity_type_code', rule.entity_type_code,
           'subject_entity_content_hash', rule.entity_content_hash,
           'indication_entity_id', rule.indication_entity_id,
           'indication_entity_revision_id', rule.indication_entity_revision_id,
           'population_entity_id', rule.population_entity_id,
           'population_entity_revision_id', rule.population_entity_revision_id,
           'sources', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'source_id', source_revision.source_id,
               'source_revision_id', source_revision.id,
               'source_content_hash', source_revision.content_hash,
               'source_role', binding.source_role,
               'locator_hash', public.kb_release_manifest_hash_v1(
                 to_jsonb(binding.locator)
               ),
               'is_primary', binding.is_primary
             ) ORDER BY
               source_revision.id,
               binding.source_role COLLATE "C",
               binding.locator COLLATE "C")
               FROM public.kb_assertion_sources binding
               JOIN public.kb_source_revisions source_revision
                 ON source_revision.id = binding.source_revision_id
              WHERE binding.assertion_id = rule.assertion_id
           ), '[]'::jsonb)
         ) ORDER BY
           rule.subject_entity_id,
           rule.subject_entity_revision_id,
           rule.id), '[]'::jsonb)
    INTO rules
    FROM candidate_rules rule;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_DOSAGE_RULE_SCOPE_PREFLIGHT_ONLY',
    'status', CASE WHEN candidate_rule_count = 0
      THEN 'DOSAGE_RULE_SCOPE_EMPTY_INACTIVE'
      ELSE 'DOSAGE_RULE_SCOPE_READY_INACTIVE' END,
    'interpretation', 'RULE_IDENTITY_AND_APPLICABILITY_INPUT_ONLY_NO_DOSAGE_OUTPUT',
    'medical_use_allowed', false,
    'dosage_evaluation_allowed', false,
    'dosage_display_allowed', false,
    'ai_use_allowed', false,
    'knowledge_release_id', _knowledge_release_id,
    'release_manifest_hash', release_manifest_hash,
    'candidate_status_result_hash', _candidate_status_result ->> 'result_hash',
    'allow_candidate_count', allow_candidate_count,
    'released_dosage_rule_count', candidate_rule_count,
    'rules', rules
  ));
  RETURN result_payload || jsonb_build_object(
    'scope_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_dosage_rule_assessments_v1(
  _therapy_input_revision_id uuid,
  _knowledge_release_id uuid,
  _candidate_status_result jsonb,
  _dosage_rule_scope jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  input_manifest jsonb;
  allow_candidate_count integer;
  binding_ready_candidate_count integer;
  blocked_candidate_count integer;
  candidate_assessments jsonb;
  result_payload jsonb;
BEGIN
  IF _therapy_input_revision_id IS NULL
     OR _knowledge_release_id IS NULL
     OR _candidate_status_result IS NULL
     OR _dosage_rule_scope IS NULL
     OR jsonb_typeof(_candidate_status_result) IS DISTINCT FROM 'object'
     OR jsonb_typeof(_dosage_rule_scope) IS DISTINCT FROM 'object'
     OR _candidate_status_result ->> 'status'
        IS DISTINCT FROM 'CANDIDATE_STATUS_PREFLIGHT_COMPLETE_INACTIVE'
     OR _candidate_status_result ->> 'therapy_input_revision_id'
        IS DISTINCT FROM _therapy_input_revision_id::text
     OR _candidate_status_result ->> 'knowledge_release_id'
        IS DISTINCT FROM _knowledge_release_id::text
     OR _candidate_status_result ->> 'result_hash'
        IS DISTINCT FROM public.kb_release_manifest_hash_v1(
          _candidate_status_result - 'result_hash'
        )
     OR _dosage_rule_scope ->> 'candidate_status_result_hash'
        IS DISTINCT FROM _candidate_status_result ->> 'result_hash'
     OR _dosage_rule_scope ->> 'knowledge_release_id'
        IS DISTINCT FROM _knowledge_release_id::text
     OR _dosage_rule_scope ->> 'scope_hash'
        IS DISTINCT FROM public.kb_release_manifest_hash_v1(
          _dosage_rule_scope - 'scope_hash'
        )
     OR jsonb_typeof(_candidate_status_result #> '{general_track,candidates}')
        IS DISTINCT FROM 'array'
     OR jsonb_typeof(_dosage_rule_scope -> 'rules') IS DISTINCT FROM 'array'
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(
           _candidate_status_result #> '{general_track,candidates}'
        ) candidate(value)
        WHERE candidate.value ->> 'candidate_status' = 'ALLOW'
          AND (
            candidate.value ->> 'entity_type_code' IS NULL
            OR candidate.value ->> 'entity_type_code' NOT IN (
              'preparation', 'product_variant'
            )
          )
     )
  THEN
    RETURN NULL;
  END IF;

  input_manifest := public.therapy_retrieval_v2_input_manifest_v1(
    _therapy_input_revision_id
  );
  IF input_manifest IS NULL
     OR public.therapy_retrieval_v2_input_hash_v1(_therapy_input_revision_id)
        IS DISTINCT FROM _candidate_status_result ->> 'therapy_input_manifest_hash'
  THEN
    RETURN NULL;
  END IF;

  WITH selected_facts AS MATERIALIZED (
    SELECT
      (selected.value ->> 'fact_id')::uuid AS fact_id,
      selected.value ->> 'content_sha256' AS fact_content_sha256
      FROM jsonb_array_elements(input_manifest -> 'selected_facts') selected(value)
  ), eligible_facts AS MATERIALIZED (
    SELECT
      fact.id AS fact_id,
      fact.content_sha256 AS fact_content_sha256,
      fact.kb_entity_id
      FROM selected_facts selected
      JOIN public.therapy_input_facts fact
        ON fact.therapy_input_revision_id = _therapy_input_revision_id
       AND fact.id = selected.fact_id
       AND fact.content_sha256 = selected.fact_content_sha256
     WHERE NOT fact.is_negated
       AND fact.clinical_status = 'current'
       AND fact.certainty = 'confirmed'
       AND fact.review_status = 'verified'
       AND fact.kb_entity_id IS NOT NULL
  ), allow_candidates AS MATERIALIZED (
    SELECT
      (candidate.value ->> 'position')::integer AS position,
      (candidate.value ->> 'entity_id')::uuid AS entity_id,
      (candidate.value ->> 'entity_revision_id')::uuid AS entity_revision_id,
      candidate.value ->> 'entity_type_code' AS entity_type_code,
      candidate.value ->> 'entity_content_hash' AS entity_content_hash
      FROM jsonb_array_elements(
        _candidate_status_result #> '{general_track,candidates}'
      ) candidate(value)
     WHERE candidate.value ->> 'candidate_status' = 'ALLOW'
       AND candidate.value ->> 'entity_type_code' IN (
         'preparation', 'product_variant'
       )
  ), rules AS MATERIALIZED (
    SELECT
      (rule.value ->> 'dosage_rule_id')::uuid AS dosage_rule_id,
      rule.value ->> 'dosage_rule_content_hash' AS dosage_rule_content_hash,
      (rule.value ->> 'assertion_id')::uuid AS assertion_id,
      (rule.value ->> 'subject_entity_id')::uuid AS subject_entity_id,
      (rule.value ->> 'subject_entity_revision_id')::uuid
        AS subject_entity_revision_id,
      NULLIF(rule.value ->> 'indication_entity_id', '')::uuid
        AS indication_entity_id,
      NULLIF(rule.value ->> 'indication_entity_revision_id', '')::uuid
        AS indication_entity_revision_id,
      NULLIF(rule.value ->> 'population_entity_id', '')::uuid
        AS population_entity_id,
      NULLIF(rule.value ->> 'population_entity_revision_id', '')::uuid
        AS population_entity_revision_id
      FROM jsonb_array_elements(_dosage_rule_scope -> 'rules') rule(value)
  ), evaluated_rules AS MATERIALIZED (
    SELECT
      rule.*,
      rule.indication_entity_id IS NULL OR EXISTS (
        SELECT 1 FROM eligible_facts fact
         WHERE fact.kb_entity_id = rule.indication_entity_id
      ) AS indication_matches,
      rule.population_entity_id IS NULL OR EXISTS (
        SELECT 1 FROM eligible_facts fact
         WHERE fact.kb_entity_id = rule.population_entity_id
      ) AS population_matches
      FROM rules rule
  ), candidate_counts AS MATERIALIZED (
    SELECT
      candidate.*,
      count(rule.dosage_rule_id)::integer AS released_rule_count,
      count(rule.dosage_rule_id) FILTER (
        WHERE rule.indication_matches AND rule.population_matches
      )::integer AS applicable_rule_count
      FROM allow_candidates candidate
      LEFT JOIN evaluated_rules rule
        ON rule.subject_entity_id = candidate.entity_id
       AND rule.subject_entity_revision_id = candidate.entity_revision_id
     GROUP BY
       candidate.position,
       candidate.entity_id,
       candidate.entity_revision_id,
       candidate.entity_type_code,
       candidate.entity_content_hash
  ), candidate_rows AS MATERIALIZED (
    SELECT
      candidate.*,
      CASE
        WHEN candidate.released_rule_count = 0
          THEN 'DOSAGE_RULE_MISSING_INACTIVE'
        WHEN candidate.applicable_rule_count = 0
          THEN 'DOSAGE_RULE_NOT_APPLICABLE_INACTIVE'
        WHEN candidate.applicable_rule_count = 1
          THEN 'EXACT_DOSAGE_RULE_BINDING_READY_INACTIVE'
        ELSE 'DOSAGE_RULE_AMBIGUOUS_REVIEW_ONLY_INACTIVE'
      END AS assessment_status,
      candidate.applicable_rule_count = 1 AS inactive_rule_binding_ready
      FROM candidate_counts candidate
  )
  SELECT count(*)::integer,
         count(*) FILTER (WHERE inactive_rule_binding_ready)::integer,
         count(*) FILTER (WHERE NOT inactive_rule_binding_ready)::integer,
         COALESCE(jsonb_agg(jsonb_build_object(
           'candidate_position', candidate.position,
           'candidate_status', 'ALLOW',
           'subject_entity_id', candidate.entity_id,
           'subject_entity_revision_id', candidate.entity_revision_id,
           'subject_entity_type_code', candidate.entity_type_code,
           'subject_entity_content_hash', candidate.entity_content_hash,
           'assessment_status', candidate.assessment_status,
           'inactive_rule_binding_ready', candidate.inactive_rule_binding_ready,
           'dosage_display_allowed', false,
           'released_rule_count', candidate.released_rule_count,
           'applicable_rule_count', candidate.applicable_rule_count,
           'applicable_rule_identity', CASE
             WHEN candidate.applicable_rule_count = 1 THEN (
               SELECT jsonb_build_object(
                 'dosage_rule_id', rule.dosage_rule_id,
                 'dosage_rule_content_hash', rule.dosage_rule_content_hash,
                 'assertion_id', rule.assertion_id
               )
                 FROM evaluated_rules rule
                WHERE rule.subject_entity_id = candidate.entity_id
                  AND rule.subject_entity_revision_id = candidate.entity_revision_id
                  AND rule.indication_matches
                  AND rule.population_matches
             ) ELSE NULL END,
           'rule_assessments', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'dosage_rule_id', rule.dosage_rule_id,
               'dosage_rule_content_hash', rule.dosage_rule_content_hash,
               'assertion_id', rule.assertion_id,
               'indication_entity_id', rule.indication_entity_id,
               'indication_entity_revision_id', rule.indication_entity_revision_id,
               'indication_matches', rule.indication_matches,
               'indication_fact_matches', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object(
                   'therapy_input_fact_id', fact.fact_id,
                   'fact_content_sha256', fact.fact_content_sha256
                 ) ORDER BY fact.fact_id)
                   FROM eligible_facts fact
                  WHERE fact.kb_entity_id = rule.indication_entity_id
               ), '[]'::jsonb),
               'population_entity_id', rule.population_entity_id,
               'population_entity_revision_id', rule.population_entity_revision_id,
               'population_matches', rule.population_matches,
               'population_fact_matches', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object(
                   'therapy_input_fact_id', fact.fact_id,
                   'fact_content_sha256', fact.fact_content_sha256
                 ) ORDER BY fact.fact_id)
                   FROM eligible_facts fact
                  WHERE fact.kb_entity_id = rule.population_entity_id
               ), '[]'::jsonb),
               'applicability_status', CASE
                 WHEN rule.indication_matches AND rule.population_matches
                   THEN 'APPLICABLE_EXACT_FACT_BINDING'
                 WHEN NOT rule.indication_matches AND NOT rule.population_matches
                   THEN 'INDICATION_AND_POPULATION_FACTS_MISSING'
                 WHEN NOT rule.indication_matches
                   THEN 'INDICATION_FACT_MISSING'
                 ELSE 'POPULATION_FACT_MISSING'
               END
             ) ORDER BY rule.dosage_rule_id)
               FROM evaluated_rules rule
              WHERE rule.subject_entity_id = candidate.entity_id
                AND rule.subject_entity_revision_id = candidate.entity_revision_id
           ), '[]'::jsonb)
         ) ORDER BY candidate.position), '[]'::jsonb)
    INTO allow_candidate_count,
         binding_ready_candidate_count,
         blocked_candidate_count,
         candidate_assessments
    FROM candidate_rows candidate;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_DOSAGE_RULE_ASSESSMENTS_PREFLIGHT_ONLY',
    'status', 'DOSAGE_RULE_ASSESSMENTS_COMPLETE_INACTIVE',
    'interpretation', 'RULE_APPLICABILITY_ONLY_NO_DOSAGE_OR_MEDICAL_USE',
    'medical_use_allowed', false,
    'dosage_evaluation_allowed', false,
    'dosage_display_allowed', false,
    'ai_use_allowed', false,
    'therapy_input_revision_id', _therapy_input_revision_id,
    'therapy_input_manifest_hash',
      _candidate_status_result ->> 'therapy_input_manifest_hash',
    'knowledge_release_id', _knowledge_release_id,
    'candidate_status_result_hash', _candidate_status_result ->> 'result_hash',
    'dosage_rule_scope_hash', _dosage_rule_scope ->> 'scope_hash',
    'allow_candidate_count', allow_candidate_count,
    'binding_ready_candidate_count', binding_ready_candidate_count,
    'blocked_candidate_count', blocked_candidate_count,
    'candidate_assessments', candidate_assessments
  ));
  RETURN result_payload || jsonb_build_object(
    'assessments_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_dosage_rule_preflight_v1(
  _therapy_input_revision_id uuid,
  _expected_therapy_input_hash text,
  _knowledge_release_id uuid,
  _expected_release_manifest_hash text,
  _repertory_entity_id uuid,
  _repertory_revision_id uuid,
  _rubric_links jsonb,
  _expected_homeopathic_request_hash text,
  _expected_split_track_result_hash text,
  _expected_safety_gate_result_hash text,
  _expected_candidate_status_result_hash text,
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
  candidate_status_result jsonb;
  candidate_status_hash_matches boolean;
  dosage_rule_scope jsonb;
  dosage_rule_assessments jsonb;
  allow_candidate_count integer;
  binding_ready_candidate_count integer;
  result_payload jsonb;
BEGIN
  candidate_status_result :=
    public.therapy_retrieval_v2_candidate_status_preflight_v1(
      _therapy_input_revision_id,
      _expected_therapy_input_hash,
      _knowledge_release_id,
      _expected_release_manifest_hash,
      _repertory_entity_id,
      _repertory_revision_id,
      _rubric_links,
      _expected_homeopathic_request_hash,
      _expected_split_track_result_hash,
      _expected_safety_gate_result_hash,
      _direct_limit,
      _graph_limit,
      _homeopathic_limit
    );
  candidate_status_hash_matches := COALESCE(
    _expected_candidate_status_result_hash ~ '^[0-9a-f]{64}$'
    AND candidate_status_result ->> 'result_hash'
        = _expected_candidate_status_result_hash,
    false
  );

  IF candidate_status_result ->> 'status'
       = 'CANDIDATE_STATUS_ESCALATE_ONLY_INACTIVE'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_DOSAGE_RULE_PREFLIGHT_ONLY',
      'status', 'DOSAGE_RULE_ESCALATE_ONLY_INACTIVE',
      'interpretation', 'NO_DOSAGE_OUTPUT_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'ai_use_allowed', false,
      'global_candidate_status', 'ESCALATE_ONLY',
      'status_lock', 'UNOVERRIDABLE_BY_AI_CLIENT_PREFERENCE_OR_PIN',
      'candidate_status_result_hash', candidate_status_result ->> 'result_hash',
      'candidate_status_result_hash_matches', candidate_status_hash_matches,
      'dosage_rule_scope', NULL,
      'dosage_rule_assessments', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF candidate_status_result ->> 'status'
       = 'CANDIDATE_STATUS_REVIEW_ONLY_INACTIVE'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_DOSAGE_RULE_PREFLIGHT_ONLY',
      'status', 'DOSAGE_RULE_REVIEW_ONLY_INACTIVE',
      'interpretation', 'NO_DOSAGE_OUTPUT_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'ai_use_allowed', false,
      'global_candidate_status', 'REVIEW_ONLY',
      'status_lock', 'REQUIRES_HUMAN_REVIEW_NO_DOSAGE_RULE_BINDING',
      'candidate_status_result_hash', candidate_status_result ->> 'result_hash',
      'candidate_status_result_hash_matches', candidate_status_hash_matches,
      'dosage_rule_scope', NULL,
      'dosage_rule_assessments', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF candidate_status_result ->> 'status'
       <> 'CANDIDATE_STATUS_PREFLIGHT_COMPLETE_INACTIVE'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_DOSAGE_RULE_PREFLIGHT_ONLY',
      'status', 'DOSAGE_RULE_CANDIDATE_STATUS_UNAVAILABLE',
      'interpretation', 'NO_DOSAGE_OUTPUT_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'ai_use_allowed', false,
      'candidate_status', candidate_status_result ->> 'status',
      'candidate_status_result_hash', candidate_status_result ->> 'result_hash',
      'dosage_rule_scope', NULL,
      'dosage_rule_assessments', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF _expected_candidate_status_result_hash IS NULL
     OR _expected_candidate_status_result_hash !~ '^[0-9a-f]{64}$'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_DOSAGE_RULE_PREFLIGHT_ONLY',
      'status', 'DOSAGE_RULE_EXPECTATION_INVALID',
      'interpretation', 'NO_DOSAGE_OUTPUT_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'ai_use_allowed', false,
      'dosage_rule_scope', NULL,
      'dosage_rule_assessments', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF NOT candidate_status_hash_matches THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_DOSAGE_RULE_PREFLIGHT_ONLY',
      'status', 'DOSAGE_RULE_CANDIDATE_STATUS_MISMATCH',
      'interpretation', 'NO_DOSAGE_OUTPUT_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'ai_use_allowed', false,
      'candidate_status_result_hash', candidate_status_result ->> 'result_hash',
      'dosage_rule_scope', NULL,
      'dosage_rule_assessments', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  dosage_rule_scope := public.therapy_retrieval_v2_dosage_rule_scope_v1(
    _knowledge_release_id,
    candidate_status_result
  );
  IF dosage_rule_scope IS NULL THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_DOSAGE_RULE_PREFLIGHT_ONLY',
      'status', 'DOSAGE_RULE_SCOPE_UNAVAILABLE',
      'interpretation', 'NO_DOSAGE_OUTPUT_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'ai_use_allowed', false,
      'candidate_status_result_hash', candidate_status_result ->> 'result_hash',
      'dosage_rule_scope', NULL,
      'dosage_rule_assessments', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  dosage_rule_assessments :=
    public.therapy_retrieval_v2_dosage_rule_assessments_v1(
      _therapy_input_revision_id,
      _knowledge_release_id,
      candidate_status_result,
      dosage_rule_scope
    );
  IF dosage_rule_assessments IS NULL THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_DOSAGE_RULE_PREFLIGHT_ONLY',
      'status', 'DOSAGE_RULE_ASSESSMENTS_UNAVAILABLE',
      'interpretation', 'NO_DOSAGE_OUTPUT_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'ai_use_allowed', false,
      'candidate_status_result_hash', candidate_status_result ->> 'result_hash',
      'dosage_rule_scope_hash', dosage_rule_scope ->> 'scope_hash',
      'dosage_rule_scope', NULL,
      'dosage_rule_assessments', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  allow_candidate_count :=
    (dosage_rule_assessments ->> 'allow_candidate_count')::integer;
  binding_ready_candidate_count :=
    (dosage_rule_assessments ->> 'binding_ready_candidate_count')::integer;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_DOSAGE_RULE_PREFLIGHT_ONLY',
    'status', CASE
      WHEN allow_candidate_count = 0
        THEN 'DOSAGE_RULE_NO_ALLOW_CANDIDATES_INACTIVE'
      WHEN binding_ready_candidate_count = allow_candidate_count
        THEN 'DOSAGE_RULE_BINDINGS_READY_INACTIVE'
      ELSE 'DOSAGE_RULE_PREFLIGHT_BLOCKED_INACTIVE'
    END,
    'interpretation', 'RULE_BINDING_PREFLIGHT_ONLY_NO_DOSAGE_OUTPUT_OR_MEDICAL_USE',
    'medical_use_allowed', false,
    'productive_candidate_use_allowed', false,
    'dosage_evaluation_allowed', false,
    'dosage_display_allowed', false,
    'concrete_dosage_output_present', false,
    'ai_use_allowed', false,
    'inactive_dosage_rule_bindings_ready',
      allow_candidate_count > 0
      AND binding_ready_candidate_count = allow_candidate_count,
    'therapy_input_revision_id', _therapy_input_revision_id,
    'therapy_input_manifest_hash',
      candidate_status_result ->> 'therapy_input_manifest_hash',
    'knowledge_release_id', _knowledge_release_id,
    'release_manifest_hash', candidate_status_result ->> 'release_manifest_hash',
    'split_track_result_hash', candidate_status_result ->> 'split_track_result_hash',
    'safety_gate_result_hash', candidate_status_result ->> 'safety_gate_result_hash',
    'candidate_status_result_hash', candidate_status_result ->> 'result_hash',
    'candidate_status_result_hash_matches', candidate_status_hash_matches,
    'dosage_rule_scope_hash', dosage_rule_scope ->> 'scope_hash',
    'dosage_rule_assessments_hash',
      dosage_rule_assessments ->> 'assessments_hash',
    'allow_candidate_count', allow_candidate_count,
    'binding_ready_candidate_count', binding_ready_candidate_count,
    'blocked_candidate_count',
      (dosage_rule_assessments ->> 'blocked_candidate_count')::integer,
    'excluded_general_candidate_count',
      (candidate_status_result #>> '{general_track,status_counts,EXCLUDE}')::integer,
    'review_only_general_candidate_count',
      (candidate_status_result #>> '{general_track,status_counts,REVIEW_ONLY}')::integer,
    'homeopathic_candidate_count_excluded_from_dosage',
      (candidate_status_result #>> '{homeopathic_track,candidate_count}')::integer,
    'homeopathic_dosage_evaluation_allowed', false,
    'dosage_rule_scope', dosage_rule_scope,
    'dosage_rule_assessments', dosage_rule_assessments
  ));

  IF octet_length(result_payload::text) > 8388608 THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_DOSAGE_RULE_PREFLIGHT_ONLY',
      'status', 'DOSAGE_RULE_RESULT_LIMIT_EXCEEDED',
      'interpretation', 'NO_DOSAGE_OUTPUT_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'ai_use_allowed', false,
      'candidate_status_result_hash', candidate_status_result ->> 'result_hash',
      'dosage_rule_scope_hash', dosage_rule_scope ->> 'scope_hash',
      'dosage_rule_assessments_hash',
        dosage_rule_assessments ->> 'assessments_hash'
    ));
  END IF;

  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

COMMENT ON FUNCTION public.therapy_retrieval_v2_dosage_rule_scope_v1(uuid, jsonb) IS
  'Step 6F owner-only inactive dosage-rule scope. It binds released exact rule identities and sources for general ALLOW candidates but exposes no dose, frequency, duration, timing or route.';
COMMENT ON FUNCTION public.therapy_retrieval_v2_dosage_rule_assessments_v1(uuid, uuid, jsonb, jsonb) IS
  'Step 6F owner-only inactive applicability assessment. Exactly one released rule may bind to confirmed exact indication and population facts; no dosage display or medical use is enabled.';
COMMENT ON FUNCTION public.therapy_retrieval_v2_dosage_rule_preflight_v1(uuid, text, uuid, text, uuid, uuid, jsonb, text, text, text, text, integer, integer, integer) IS
  'Step 6F owner-only release-, safety- and candidate-status-hash-bound dosage-rule preflight. Homeopathic, review-only, excluded and escalated candidates remain ineligible; concrete dosage, productive use and AI stay disabled.';

REVOKE ALL ON FUNCTION
  public.therapy_retrieval_v2_dosage_rule_scope_v1(uuid, jsonb),
  public.therapy_retrieval_v2_dosage_rule_assessments_v1(
    uuid, uuid, jsonb, jsonb
  ),
  public.therapy_retrieval_v2_dosage_rule_preflight_v1(
    uuid, text, uuid, text, uuid, uuid, jsonb, text, text, text, text,
    integer, integer, integer
  )
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMIT;
