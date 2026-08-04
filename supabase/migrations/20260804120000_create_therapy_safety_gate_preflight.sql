BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure(
       'public.therapy_retrieval_v2_split_track_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,integer,integer,integer)'
     ) IS NULL
     OR to_regprocedure('public.therapy_retrieval_v2_input_manifest_v1(uuid)') IS NULL
     OR to_regprocedure('public.kb_safety_rule_is_valid(uuid)') IS NULL
     OR to_regprocedure('public.kb_release_is_valid(uuid,boolean)') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Safety-gate preflight requires the complete Step 4B-1 and Step 6C contracts';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 67 THEN
    RAISE EXCEPTION 'Safety-gate preflight requires the exact 67-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Safety-gate preflight cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_safety_input_manifest_v1(
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
  input_manifest_hash text;
  selected_fact_count integer;
  review_only_fact_count integer;
  active_red_flag_count integer;
  medication_status_fact_count integer;
  active_medication_count integer;
  unresolved_active_medication_count integer;
  medication_status_fact public.therapy_input_facts%ROWTYPE;
  medication_status_code text;
  medication_status text;
  red_flags jsonb;
BEGIN
  input_manifest := public.therapy_retrieval_v2_input_manifest_v1(
    _therapy_input_revision_id
  );
  IF input_manifest IS NULL THEN
    RETURN NULL;
  END IF;
  input_manifest_hash := public.kb_release_manifest_hash_v1(input_manifest);

  WITH selected_facts AS MATERIALIZED (
    SELECT fact.*
      FROM public.therapy_input_facts fact
      JOIN LATERAL jsonb_array_elements(
        input_manifest -> 'selected_facts'
      ) selected(value)
        ON selected.value ->> 'fact_id' = fact.id::text
     WHERE fact.therapy_input_revision_id = _therapy_input_revision_id
  )
  SELECT count(*)::integer,
         count(*) FILTER (WHERE fact.review_status = 'review_only')::integer,
         count(*) FILTER (
           WHERE fact.fact_type = 'safety_flag'
             AND NOT fact.is_negated
             AND fact.clinical_status IN ('current', 'unknown')
         )::integer,
         count(*) FILTER (
           WHERE fact.fact_type = 'medication'
             AND fact.fact_key = 'medication.status'
         )::integer,
         count(*) FILTER (
           WHERE fact.fact_type = 'medication'
             AND fact.fact_key <> 'medication.status'
             AND NOT fact.is_negated
             AND fact.clinical_status IN ('current', 'unknown')
         )::integer,
         count(*) FILTER (
           WHERE fact.fact_type = 'medication'
             AND fact.fact_key <> 'medication.status'
             AND NOT fact.is_negated
             AND fact.clinical_status IN ('current', 'unknown')
             AND fact.kb_entity_id IS NULL
         )::integer
    INTO selected_fact_count,
         review_only_fact_count,
         active_red_flag_count,
         medication_status_fact_count,
         active_medication_count,
         unresolved_active_medication_count
    FROM selected_facts fact;

  IF selected_fact_count < 1
     OR selected_fact_count IS DISTINCT FROM
        (input_manifest #>> '{fact_counts,selected}')::integer
  THEN
    RETURN NULL;
  END IF;

  medication_status := CASE
    WHEN medication_status_fact_count = 0 THEN 'MISSING'
    WHEN medication_status_fact_count > 1 THEN 'AMBIGUOUS'
    ELSE NULL
  END;

  IF medication_status IS NULL THEN
    SELECT fact.*
      INTO STRICT medication_status_fact
      FROM public.therapy_input_facts fact
      JOIN LATERAL jsonb_array_elements(
        input_manifest -> 'selected_facts'
      ) selected(value)
        ON selected.value ->> 'fact_id' = fact.id::text
     WHERE fact.therapy_input_revision_id = _therapy_input_revision_id
       AND fact.fact_type = 'medication'
       AND fact.fact_key = 'medication.status';

    medication_status_code := medication_status_fact.fact_value ->> 'code';
    medication_status := CASE
      WHEN medication_status_fact.review_status IS DISTINCT FROM 'verified'
        OR medication_status_fact.is_negated
        OR medication_status_fact.clinical_status IS DISTINCT FROM 'current'
        OR medication_status_fact.certainty IS DISTINCT FROM 'confirmed'
        OR (medication_status_fact.fact_value ->> 'type' = 'coded')
           IS DISTINCT FROM true
        OR (medication_status_fact.fact_value ->> 'system' = 'local_v1')
           IS DISTINCT FROM true
        OR (medication_status_code IN ('complete', 'none_reported'))
           IS DISTINCT FROM true
        THEN 'UNCLEAR'
      WHEN medication_status_code = 'none_reported' AND active_medication_count > 0
        THEN 'CONTRADICTORY'
      WHEN unresolved_active_medication_count > 0
        THEN 'UNRESOLVED_ENTITY'
      WHEN medication_status_code = 'none_reported'
        THEN 'CLEAR_NONE_REPORTED'
      ELSE 'CLEAR_COMPLETE'
    END;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'fact_id', fact.id,
           'fact_order', fact.fact_order,
           'review_status', fact.review_status,
           'certainty', fact.certainty,
           'fact_content_sha256', fact.content_sha256
         ) ORDER BY fact.fact_order, fact.id), '[]'::jsonb)
    INTO red_flags
    FROM public.therapy_input_facts fact
    JOIN LATERAL jsonb_array_elements(
      input_manifest -> 'selected_facts'
    ) selected(value)
      ON selected.value ->> 'fact_id' = fact.id::text
   WHERE fact.therapy_input_revision_id = _therapy_input_revision_id
     AND fact.fact_type = 'safety_flag'
     AND NOT fact.is_negated
     AND fact.clinical_status IN ('current', 'unknown');

  RETURN public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_SAFETY_INPUT_PREFLIGHT_ONLY',
    'data_classification', 'pseudonymized_health_data',
    'therapy_input_revision_id', _therapy_input_revision_id,
    'therapy_input_manifest_hash', input_manifest_hash,
    'selected_fact_count', selected_fact_count,
    'review_only_fact_count', review_only_fact_count,
    'requires_input_review', review_only_fact_count > 0,
    'red_flag_policy', jsonb_build_object(
      'policy_version', 1,
      'active_statuses', jsonb_build_array('current', 'unknown'),
      'positive_non_negated_only', true,
      'only_disposition', 'ESCALATE_ONLY'
    ),
    'active_red_flag_count', active_red_flag_count,
    'red_flag_disposition', CASE WHEN active_red_flag_count > 0
      THEN 'ESCALATE_ONLY' ELSE 'NONE' END,
    'red_flags', red_flags,
    'medication_policy', jsonb_build_object(
      'policy_version', 1,
      'required_fact_type', 'medication',
      'required_fact_key', 'medication.status',
      'required_system', 'local_v1',
      'clear_codes', jsonb_build_array('complete', 'none_reported'),
      'verified_current_singleton_required', true,
      'active_medications_require_entity_resolution', true
    ),
    'medication_status', medication_status,
    'medication_review_required', medication_status NOT IN (
      'CLEAR_COMPLETE', 'CLEAR_NONE_REPORTED'
    ),
    'medication_status_fact_count', medication_status_fact_count,
    'active_medication_count', active_medication_count,
    'unresolved_active_medication_count', unresolved_active_medication_count
  ));
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_safety_rule_assessments_v1(
  _therapy_input_revision_id uuid,
  _knowledge_release_id uuid
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
  safety_input_manifest jsonb;
  subject_count integer;
  safety_rule_count integer;
  condition_count integer;
  subject_assessments jsonb;
  matched_hard_block_count integer;
BEGIN
  input_manifest := public.therapy_retrieval_v2_input_manifest_v1(
    _therapy_input_revision_id
  );
  safety_input_manifest := public.therapy_retrieval_v2_safety_input_manifest_v1(
    _therapy_input_revision_id
  );
  IF input_manifest IS NULL OR safety_input_manifest IS NULL THEN
    RETURN NULL;
  END IF;

  -- Bound each safety dimension before running release or rule validators.
  SELECT count(*)::integer
    INTO subject_count
    FROM (
      SELECT 1
        FROM public.kb_release_items item
        JOIN public.kb_entities entity ON entity.id = item.entity_id
       WHERE item.release_id = _knowledge_release_id
         AND item.item_kind = 'entity_revision'
         AND entity.entity_type_code IN ('preparation', 'product_variant')
       LIMIT 513
    ) bounded;
  IF subject_count NOT BETWEEN 1 AND 512 THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::integer
    INTO safety_rule_count
    FROM (
      SELECT 1
        FROM public.kb_release_items assertion_item
        JOIN public.kb_assertions assertion
          ON assertion.id = assertion_item.assertion_id
       WHERE assertion_item.release_id = _knowledge_release_id
         AND assertion_item.item_kind = 'assertion'
         AND assertion.assertion_kind = 'safety'
       LIMIT 2049
    ) bounded;
  IF safety_rule_count NOT BETWEEN 1 AND 2048 THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::integer
    INTO condition_count
    FROM (
      SELECT 1
        FROM public.kb_release_items assertion_item
        JOIN public.kb_assertions assertion
          ON assertion.id = assertion_item.assertion_id
         AND assertion.assertion_kind = 'safety'
        JOIN public.kb_safety_rules rule
          ON rule.assertion_id = assertion_item.assertion_id
        JOIN public.kb_safety_rule_conditions condition
          ON condition.safety_rule_id = rule.id
       WHERE assertion_item.release_id = _knowledge_release_id
         AND assertion_item.item_kind = 'assertion'
       LIMIT 8193
    ) bounded;
  IF condition_count NOT BETWEEN safety_rule_count AND 8192 THEN
    RETURN NULL;
  END IF;

  IF public.kb_release_is_valid(_knowledge_release_id, true) IS DISTINCT FROM true
     OR EXISTS (
       SELECT 1
         FROM public.kb_release_items subject_item
         JOIN public.kb_entities subject
           ON subject.id = subject_item.entity_id
        WHERE subject_item.release_id = _knowledge_release_id
          AND subject_item.item_kind = 'entity_revision'
          AND subject.entity_type_code IN ('preparation', 'product_variant')
          AND NOT EXISTS (
            SELECT 1
              FROM public.kb_safety_rules rule
              JOIN public.kb_assertions assertion ON assertion.id = rule.assertion_id
              JOIN public.kb_release_items assertion_item
                ON assertion_item.release_id = _knowledge_release_id
               AND assertion_item.item_kind = 'assertion'
               AND assertion_item.assertion_id = rule.assertion_id
             WHERE rule.subject_entity_id = subject_item.entity_id
               AND rule.subject_entity_revision_id = subject_item.entity_revision_id
               AND assertion.review_status = 'released'
          )
     )
     OR EXISTS (
       -- A release cannot cherry-pick only some released rules for a subject.
       SELECT 1
         FROM public.kb_release_items subject_item
         JOIN public.kb_entities subject
           ON subject.id = subject_item.entity_id
         JOIN public.kb_safety_rules rule
           ON rule.subject_entity_id = subject_item.entity_id
          AND rule.subject_entity_revision_id = subject_item.entity_revision_id
         JOIN public.kb_assertions assertion ON assertion.id = rule.assertion_id
        WHERE subject_item.release_id = _knowledge_release_id
          AND subject_item.item_kind = 'entity_revision'
          AND subject.entity_type_code IN ('preparation', 'product_variant')
          AND assertion.review_status = 'released'
          AND NOT EXISTS (
            SELECT 1
              FROM public.kb_release_items assertion_item
             WHERE assertion_item.release_id = _knowledge_release_id
               AND assertion_item.item_kind = 'assertion'
               AND assertion_item.assertion_id = rule.assertion_id
          )
     )
     OR EXISTS (
       SELECT 1
         FROM public.kb_release_items assertion_item
         JOIN public.kb_assertions assertion
           ON assertion.id = assertion_item.assertion_id
          AND assertion.assertion_kind = 'safety'
         LEFT JOIN public.kb_safety_rules rule
           ON rule.assertion_id = assertion_item.assertion_id
         LEFT JOIN public.kb_release_items subject_item
           ON subject_item.release_id = _knowledge_release_id
          AND subject_item.item_kind = 'entity_revision'
          AND subject_item.entity_id = rule.subject_entity_id
          AND subject_item.entity_revision_id = rule.subject_entity_revision_id
        WHERE assertion_item.release_id = _knowledge_release_id
          AND assertion_item.item_kind = 'assertion'
          AND (
            rule.id IS NULL
            OR subject_item.id IS NULL
            OR public.kb_safety_rule_is_valid(rule.id) IS DISTINCT FROM true
            OR (rule.related_entity_revision_id IS NOT NULL AND NOT EXISTS (
              SELECT 1
                FROM public.kb_release_items related_item
               WHERE related_item.release_id = _knowledge_release_id
                 AND related_item.item_kind = 'entity_revision'
                 AND related_item.entity_id = rule.related_entity_id
                 AND related_item.entity_revision_id = rule.related_entity_revision_id
            ))
            OR EXISTS (
              SELECT 1
                FROM public.kb_safety_rule_conditions condition
               WHERE condition.safety_rule_id = rule.id
                 AND condition.condition_entity_revision_id IS NOT NULL
                 AND NOT EXISTS (
                   SELECT 1
                     FROM public.kb_release_items condition_item
                    WHERE condition_item.release_id = _knowledge_release_id
                      AND condition_item.item_kind = 'entity_revision'
                      AND condition_item.entity_id = condition.condition_entity_id
                      AND condition_item.entity_revision_id = condition.condition_entity_revision_id
                 )
            )
            OR EXISTS (
              SELECT 1
                FROM public.kb_assertion_sources source_binding
                JOIN public.kb_source_revisions source_revision
                  ON source_revision.id = source_binding.source_revision_id
               WHERE source_binding.assertion_id = rule.assertion_id
                 AND NOT EXISTS (
                   SELECT 1
                     FROM public.kb_release_items source_item
                    WHERE source_item.release_id = _knowledge_release_id
                      AND source_item.item_kind = 'source_revision'
                      AND source_item.source_id = source_revision.source_id
                      AND source_item.source_revision_id = source_revision.id
                 )
            )
          )
     )
  THEN
    RETURN NULL;
  END IF;

  WITH selected_facts AS MATERIALIZED (
    SELECT fact.*
      FROM public.therapy_input_facts fact
      JOIN LATERAL jsonb_array_elements(
        input_manifest -> 'selected_facts'
      ) selected(value)
        ON selected.value ->> 'fact_id' = fact.id::text
     WHERE fact.therapy_input_revision_id = _therapy_input_revision_id
  ), release_subjects AS MATERIALIZED (
    SELECT item.entity_id, item.entity_revision_id
      FROM public.kb_release_items item
      JOIN public.kb_entities entity ON entity.id = item.entity_id
     WHERE item.release_id = _knowledge_release_id
       AND item.item_kind = 'entity_revision'
       AND entity.entity_type_code IN ('preparation', 'product_variant')
  ), release_rules AS MATERIALIZED (
    SELECT rule.*
      FROM public.kb_release_items assertion_item
      JOIN public.kb_assertions assertion
        ON assertion.id = assertion_item.assertion_id
       AND assertion.assertion_kind = 'safety'
      JOIN public.kb_safety_rules rule
        ON rule.assertion_id = assertion_item.assertion_id
     WHERE assertion_item.release_id = _knowledge_release_id
       AND assertion_item.item_kind = 'assertion'
  ), condition_results AS MATERIALIZED (
    SELECT condition.*,
           CASE condition.condition_kind
             WHEN 'always' THEN 'MATCHED'
             WHEN 'entity_present' THEN CASE WHEN EXISTS (
               SELECT 1
                 FROM selected_facts fact
                 JOIN public.kb_release_items entity_item
                   ON entity_item.release_id = _knowledge_release_id
                  AND entity_item.item_kind = 'entity_revision'
                  AND entity_item.entity_id = fact.kb_entity_id
                  AND entity_item.entity_id = condition.condition_entity_id
                  AND entity_item.entity_revision_id = condition.condition_entity_revision_id
                WHERE NOT fact.is_negated
                  AND fact.clinical_status IN ('current', 'unknown')
             ) THEN 'MATCHED' ELSE 'NOT_MATCHED' END
             WHEN 'fact_present' THEN CASE WHEN EXISTS (
               SELECT 1
                 FROM selected_facts fact
                WHERE fact.fact_type = condition.fact_type
                  AND fact.fact_key = condition.fact_key
                  AND NOT fact.is_negated
                  AND fact.clinical_status IN ('current', 'unknown')
             ) THEN 'MATCHED' ELSE 'NOT_MATCHED' END
             WHEN 'fact_missing' THEN CASE WHEN EXISTS (
               SELECT 1
                 FROM selected_facts fact
                WHERE fact.fact_type = condition.fact_type
                  AND fact.fact_key = condition.fact_key
                  AND NOT fact.is_negated
                  AND fact.clinical_status IN ('current', 'unknown')
             ) THEN 'NOT_MATCHED' ELSE 'MATCHED' END
             WHEN 'coded_value_in' THEN CASE
               WHEN (
                 SELECT count(*)
                   FROM selected_facts fact
                  WHERE fact.fact_type = condition.fact_type
                    AND fact.fact_key = condition.fact_key
                    AND NOT fact.is_negated
                    AND fact.clinical_status IN ('current', 'unknown')
               ) = 0 THEN 'NOT_MATCHED'
               WHEN (
                 SELECT count(*)
                   FROM selected_facts fact
                  WHERE fact.fact_type = condition.fact_type
                    AND fact.fact_key = condition.fact_key
                    AND NOT fact.is_negated
                    AND fact.clinical_status IN ('current', 'unknown')
               ) > 1 THEN 'INDETERMINATE'
               WHEN EXISTS (
                 SELECT 1
                   FROM selected_facts fact
                  WHERE fact.fact_type = condition.fact_type
                    AND fact.fact_key = condition.fact_key
                    AND NOT fact.is_negated
                    AND fact.clinical_status IN ('current', 'unknown')
                    AND fact.fact_value ->> 'type' = 'coded'
                    AND fact.fact_value ->> 'system' = condition.coded_system
                    AND fact.fact_value ->> 'code' = ANY(condition.coded_values)
               ) THEN 'MATCHED'
               WHEN EXISTS (
                 SELECT 1
                   FROM selected_facts fact
                  WHERE fact.fact_type = condition.fact_type
                    AND fact.fact_key = condition.fact_key
                    AND NOT fact.is_negated
                    AND fact.clinical_status IN ('current', 'unknown')
                    AND fact.fact_value ->> 'type' = 'coded'
                    AND fact.fact_value ->> 'system' = condition.coded_system
               ) THEN 'NOT_MATCHED'
               ELSE 'INDETERMINATE'
             END
             WHEN 'quantity_compare' THEN CASE
               WHEN (
                 SELECT count(*)
                   FROM selected_facts fact
                  WHERE fact.fact_type = condition.fact_type
                    AND fact.fact_key = condition.fact_key
                    AND NOT fact.is_negated
                    AND fact.clinical_status IN ('current', 'unknown')
               ) = 0 THEN 'NOT_MATCHED'
               WHEN (
                 SELECT count(*)
                   FROM selected_facts fact
                  WHERE fact.fact_type = condition.fact_type
                    AND fact.fact_key = condition.fact_key
                    AND NOT fact.is_negated
                    AND fact.clinical_status IN ('current', 'unknown')
               ) > 1 THEN 'INDETERMINATE'
               WHEN EXISTS (
                 SELECT 1
                   FROM selected_facts fact
                  WHERE fact.fact_type = condition.fact_type
                    AND fact.fact_key = condition.fact_key
                    AND NOT fact.is_negated
                    AND fact.clinical_status IN ('current', 'unknown')
                    AND fact.fact_value ->> 'type' = 'quantity'
                    AND fact.fact_value ->> 'comparator' = 'eq'
                    AND fact.fact_value ->> 'unit_system' = condition.quantity_unit_system
                    AND fact.fact_value ->> 'unit_code' = condition.quantity_unit_code
                    AND CASE condition.quantity_comparator
                      WHEN 'eq' THEN (fact.fact_value ->> 'value')::numeric = condition.quantity_value
                      WHEN 'lt' THEN (fact.fact_value ->> 'value')::numeric < condition.quantity_value
                      WHEN 'le' THEN (fact.fact_value ->> 'value')::numeric <= condition.quantity_value
                      WHEN 'gt' THEN (fact.fact_value ->> 'value')::numeric > condition.quantity_value
                      WHEN 'ge' THEN (fact.fact_value ->> 'value')::numeric >= condition.quantity_value
                      ELSE false
                    END
               ) THEN 'MATCHED'
               WHEN EXISTS (
                 SELECT 1
                   FROM selected_facts fact
                  WHERE fact.fact_type = condition.fact_type
                    AND fact.fact_key = condition.fact_key
                    AND NOT fact.is_negated
                    AND fact.clinical_status IN ('current', 'unknown')
                    AND fact.fact_value ->> 'type' = 'quantity'
                    AND fact.fact_value ->> 'comparator' = 'eq'
                    AND fact.fact_value ->> 'unit_system' = condition.quantity_unit_system
                    AND fact.fact_value ->> 'unit_code' = condition.quantity_unit_code
               ) THEN 'NOT_MATCHED'
               ELSE 'INDETERMINATE'
             END
             ELSE 'INDETERMINATE'
           END AS condition_status
      FROM release_rules rule
      JOIN public.kb_safety_rule_conditions condition
        ON condition.safety_rule_id = rule.id
  ), rule_results AS MATERIALIZED (
    SELECT rule.*,
           CASE
             WHEN rule.rule_type = 'interaction' AND NOT EXISTS (
               SELECT 1
                 FROM selected_facts fact
                 JOIN public.kb_release_items related_item
                   ON related_item.release_id = _knowledge_release_id
                  AND related_item.item_kind = 'entity_revision'
                  AND related_item.entity_id = fact.kb_entity_id
                  AND related_item.entity_id = rule.related_entity_id
                  AND related_item.entity_revision_id = rule.related_entity_revision_id
                WHERE NOT fact.is_negated
                  AND fact.clinical_status IN ('current', 'unknown')
             ) THEN 'NOT_MATCHED'
             WHEN EXISTS (
               SELECT 1 FROM condition_results condition
                WHERE condition.safety_rule_id = rule.id
                  AND condition.condition_status = 'NOT_MATCHED'
             ) THEN 'NOT_MATCHED'
             WHEN EXISTS (
               SELECT 1 FROM condition_results condition
                WHERE condition.safety_rule_id = rule.id
                  AND condition.condition_status = 'INDETERMINATE'
             ) THEN 'INDETERMINATE_REVIEW_REQUIRED'
             ELSE 'MATCHED'
           END AS assessment_status,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'condition_id', condition.id,
               'condition_order', condition.condition_order,
               'condition_kind', condition.condition_kind,
               'condition_status', condition.condition_status
             ) ORDER BY condition.condition_order, condition.id)
               FROM condition_results condition
              WHERE condition.safety_rule_id = rule.id
           ), '[]'::jsonb) AS condition_assessments
      FROM release_rules rule
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'subject_entity_id', subject.entity_id,
           'subject_entity_revision_id', subject.entity_revision_id,
           'safety_effect', CASE
             WHEN EXISTS (
               SELECT 1 FROM rule_results rule
                WHERE rule.subject_entity_id = subject.entity_id
                  AND rule.subject_entity_revision_id = subject.entity_revision_id
                  AND rule.assessment_status = 'MATCHED'
                  AND rule.effect = 'exclude'
             ) THEN 'EXCLUDE'
             WHEN EXISTS (
               SELECT 1 FROM rule_results rule
                WHERE rule.subject_entity_id = subject.entity_id
                  AND rule.subject_entity_revision_id = subject.entity_revision_id
                  AND (
                    rule.assessment_status = 'INDETERMINATE_REVIEW_REQUIRED'
                    OR (rule.assessment_status = 'MATCHED' AND rule.effect = 'review_only')
                  )
             ) THEN 'REVIEW_ONLY'
             WHEN EXISTS (
               SELECT 1 FROM rule_results rule
                WHERE rule.subject_entity_id = subject.entity_id
                  AND rule.subject_entity_revision_id = subject.entity_revision_id
                  AND rule.assessment_status = 'MATCHED'
                  AND rule.effect = 'allow_with_notice'
             ) THEN 'NOTICE_ONLY'
             ELSE 'NO_MATCHING_RULE_INACTIVE'
           END,
           'rules', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'safety_rule_id', rule.id,
               'assertion_id', rule.assertion_id,
               'rule_content_hash', rule.rule_content_hash,
               'rule_type', rule.rule_type,
               'severity', rule.severity,
               'effect', rule.effect,
               'notice_text', rule.notice_text,
               'assessment_status', rule.assessment_status,
               'interaction_related_entity_present', CASE
                 WHEN rule.rule_type <> 'interaction' THEN NULL
                 ELSE EXISTS (
                   SELECT 1
                     FROM selected_facts fact
                     JOIN public.kb_release_items related_item
                       ON related_item.release_id = _knowledge_release_id
                      AND related_item.item_kind = 'entity_revision'
                      AND related_item.entity_id = fact.kb_entity_id
                      AND related_item.entity_id = rule.related_entity_id
                      AND related_item.entity_revision_id = rule.related_entity_revision_id
                    WHERE NOT fact.is_negated
                      AND fact.clinical_status IN ('current', 'unknown')
                 )
               END,
               'conditions', rule.condition_assessments
             ) ORDER BY rule.id)
               FROM rule_results rule
              WHERE rule.subject_entity_id = subject.entity_id
                AND rule.subject_entity_revision_id = subject.entity_revision_id
           ), '[]'::jsonb)
         ) ORDER BY subject.entity_id, subject.entity_revision_id), '[]'::jsonb),
         (
           SELECT count(*)::integer
             FROM rule_results rule
            WHERE rule.assessment_status = 'MATCHED'
              AND rule.effect = 'exclude'
              AND rule.rule_type IN ('contraindication', 'interaction')
         )
    INTO subject_assessments, matched_hard_block_count
    FROM release_subjects subject;

  RETURN public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_RELEASE_SAFETY_RULE_ASSESSMENTS_ONLY',
    'interpretation', 'RULE_EFFECTS_ONLY_NOT_CANDIDATE_ELIGIBILITY_OR_MEDICAL_USE',
    'medical_use_allowed', false,
    'candidate_status_assignment_allowed', false,
    'therapy_input_revision_id', _therapy_input_revision_id,
    'safety_input_manifest_hash', public.kb_release_manifest_hash_v1(
      safety_input_manifest
    ),
    'knowledge_release_id', _knowledge_release_id,
    'subject_count', subject_count,
    'safety_rule_count', safety_rule_count,
    'condition_count', condition_count,
    'matched_hard_contraindication_or_interaction_count',
      matched_hard_block_count,
    'subject_assessments', subject_assessments
  ));
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_safety_gate_preflight_v1(
  _therapy_input_revision_id uuid,
  _expected_therapy_input_hash text,
  _knowledge_release_id uuid,
  _expected_release_manifest_hash text,
  _repertory_entity_id uuid,
  _repertory_revision_id uuid,
  _rubric_links jsonb,
  _expected_homeopathic_request_hash text,
  _expected_split_track_result_hash text,
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
  split_track_result jsonb;
  safety_input_manifest jsonb;
  safety_input_manifest_hash text;
  safety_rule_assessments jsonb;
  safety_rule_assessments_hash text;
  unresolved_release_medication_count integer;
  result_payload jsonb;
BEGIN
  IF _expected_split_track_result_hash IS NULL
     OR _expected_split_track_result_hash !~ '^[0-9a-f]{64}$'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SAFETY_GATE_PREFLIGHT_ONLY',
      'status', 'SAFETY_GATE_EXPECTATION_INVALID',
      'interpretation', 'SAFETY_PREFLIGHT_ONLY_NOT_CANDIDATE_FORMATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'candidate_formation_allowed', false,
      'candidate_status_assignment_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  split_track_result := public.therapy_retrieval_v2_split_track_preflight_v1(
    _therapy_input_revision_id,
    _expected_therapy_input_hash,
    _knowledge_release_id,
    _expected_release_manifest_hash,
    _repertory_entity_id,
    _repertory_revision_id,
    _rubric_links,
    _expected_homeopathic_request_hash,
    _direct_limit,
    _graph_limit,
    _homeopathic_limit
  );
  IF split_track_result ->> 'status' <> 'SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SAFETY_GATE_PREFLIGHT_ONLY',
      'status', 'SAFETY_GATE_SPLIT_TRACK_UNAVAILABLE',
      'interpretation', 'SAFETY_PREFLIGHT_ONLY_NOT_CANDIDATE_FORMATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'candidate_formation_allowed', false,
      'candidate_status_assignment_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'split_track_status', split_track_result ->> 'status',
      'split_track_result_hash', split_track_result ->> 'result_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF split_track_result ->> 'result_hash' <> _expected_split_track_result_hash THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SAFETY_GATE_PREFLIGHT_ONLY',
      'status', 'SAFETY_GATE_SPLIT_TRACK_MISMATCH',
      'interpretation', 'SAFETY_PREFLIGHT_ONLY_NOT_CANDIDATE_FORMATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'candidate_formation_allowed', false,
      'candidate_status_assignment_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'actual_split_track_result_hash', split_track_result ->> 'result_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  safety_input_manifest := public.therapy_retrieval_v2_safety_input_manifest_v1(
    _therapy_input_revision_id
  );
  IF safety_input_manifest IS NULL
     OR safety_input_manifest ->> 'therapy_input_manifest_hash'
        IS DISTINCT FROM split_track_result ->> 'therapy_input_manifest_hash'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SAFETY_GATE_PREFLIGHT_ONLY',
      'status', 'SAFETY_GATE_INPUT_UNAVAILABLE',
      'interpretation', 'SAFETY_PREFLIGHT_ONLY_NOT_CANDIDATE_FORMATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'candidate_formation_allowed', false,
      'candidate_status_assignment_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'split_track_result_hash', split_track_result ->> 'result_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;
  safety_input_manifest_hash := public.kb_release_manifest_hash_v1(
    safety_input_manifest
  );

  IF (safety_input_manifest ->> 'active_red_flag_count')::integer > 0 THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SAFETY_GATE_PREFLIGHT_ONLY',
      'status', 'SAFETY_GATE_ESCALATE_ONLY_INACTIVE',
      'interpretation', 'SAFETY_PREFLIGHT_ONLY_NOT_CANDIDATE_FORMATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'candidate_formation_allowed', false,
      'candidate_status_assignment_allowed', false,
      'inactive_candidate_preflight_ready', false,
      'safety_preconditions_complete', false,
      'safety_disposition', 'ESCALATE_ONLY',
      'rules_evaluated', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'split_track_result_hash', split_track_result ->> 'result_hash',
      'safety_input_manifest', safety_input_manifest,
      'safety_input_manifest_hash', safety_input_manifest_hash
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  SELECT count(*)::integer
    INTO unresolved_release_medication_count
    FROM public.therapy_input_facts fact
   WHERE fact.therapy_input_revision_id = _therapy_input_revision_id
     AND fact.fact_type = 'medication'
     AND fact.fact_key <> 'medication.status'
     AND fact.review_status IN ('verified', 'review_only')
     AND NOT fact.is_negated
     AND fact.clinical_status IN ('current', 'unknown')
     AND NOT EXISTS (
       SELECT 1
         FROM public.therapy_input_facts successor
        WHERE successor.therapy_input_revision_id = fact.therapy_input_revision_id
          AND successor.supersedes_fact_id = fact.id
     )
     AND (
       fact.kb_entity_id IS NULL
       OR NOT EXISTS (
         SELECT 1
           FROM public.kb_release_items item
          WHERE item.release_id = _knowledge_release_id
            AND item.item_kind = 'entity_revision'
            AND item.entity_id = fact.kb_entity_id
       )
     );

  IF (safety_input_manifest ->> 'medication_review_required')::boolean
     OR (safety_input_manifest ->> 'requires_input_review')::boolean
     OR unresolved_release_medication_count > 0
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SAFETY_GATE_PREFLIGHT_ONLY',
      'status', 'SAFETY_GATE_REVIEW_REQUIRED_INACTIVE',
      'interpretation', 'SAFETY_PREFLIGHT_ONLY_NOT_CANDIDATE_FORMATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'candidate_formation_allowed', false,
      'candidate_status_assignment_allowed', false,
      'inactive_candidate_preflight_ready', false,
      'safety_preconditions_complete', false,
      'safety_disposition', 'REVIEW_ONLY',
      'rules_evaluated', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'split_track_result_hash', split_track_result ->> 'result_hash',
      'safety_input_manifest', safety_input_manifest,
      'safety_input_manifest_hash', safety_input_manifest_hash,
      'unresolved_release_medication_count', unresolved_release_medication_count
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  safety_rule_assessments :=
    public.therapy_retrieval_v2_safety_rule_assessments_v1(
      _therapy_input_revision_id,
      _knowledge_release_id
    );
  IF safety_rule_assessments IS NULL THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SAFETY_GATE_PREFLIGHT_ONLY',
      'status', 'SAFETY_GATE_RULE_SCOPE_UNAVAILABLE',
      'interpretation', 'SAFETY_PREFLIGHT_ONLY_NOT_CANDIDATE_FORMATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'candidate_formation_allowed', false,
      'candidate_status_assignment_allowed', false,
      'inactive_candidate_preflight_ready', false,
      'safety_preconditions_complete', false,
      'safety_disposition', 'REVIEW_ONLY',
      'rules_evaluated', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'split_track_result_hash', split_track_result ->> 'result_hash',
      'safety_input_manifest_hash', safety_input_manifest_hash
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;
  safety_rule_assessments_hash := public.kb_release_manifest_hash_v1(
    safety_rule_assessments
  );

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_SAFETY_GATE_PREFLIGHT_ONLY',
    'status', 'SAFETY_GATE_PREFLIGHT_COMPLETE_INACTIVE',
    'interpretation', 'SAFETY_PREFLIGHT_ONLY_NOT_CANDIDATE_FORMATION_OR_MEDICAL_USE',
    'medical_use_allowed', false,
    'retrieval_execution_allowed', false,
    'candidate_formation_allowed', false,
    'candidate_status_assignment_allowed', false,
    'inactive_candidate_preflight_ready', true,
    'safety_preconditions_complete', true,
    'safety_disposition', 'RULE_EFFECTS_EVALUATED_INACTIVE',
    'rules_evaluated', true,
    'therapy_input_revision_id', _therapy_input_revision_id,
    'therapy_input_manifest_hash', split_track_result ->> 'therapy_input_manifest_hash',
    'knowledge_release_id', _knowledge_release_id,
    'release_manifest_hash', split_track_result ->> 'release_manifest_hash',
    'binding_hash', split_track_result ->> 'binding_hash',
    'split_track_result_hash', split_track_result ->> 'result_hash',
    'safety_input_manifest', safety_input_manifest,
    'safety_input_manifest_hash', safety_input_manifest_hash,
    'safety_rule_assessments', safety_rule_assessments,
    'safety_rule_assessments_hash', safety_rule_assessments_hash,
    'unresolved_release_medication_count', unresolved_release_medication_count
  ));

  IF octet_length(result_payload::text) > 8388608 THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_SAFETY_GATE_PREFLIGHT_ONLY',
      'status', 'SAFETY_GATE_RESULT_LIMIT_EXCEEDED',
      'interpretation', 'SAFETY_PREFLIGHT_ONLY_NOT_CANDIDATE_FORMATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'candidate_formation_allowed', false,
      'candidate_status_assignment_allowed', false,
      'inactive_candidate_preflight_ready', false,
      'safety_preconditions_complete', false,
      'rules_evaluated', true,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'split_track_result_hash', split_track_result ->> 'result_hash',
      'safety_input_manifest_hash', safety_input_manifest_hash,
      'safety_rule_assessments_hash', safety_rule_assessments_hash
    ));
  END IF;

  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

COMMENT ON FUNCTION public.therapy_retrieval_v2_safety_input_manifest_v1(uuid) IS
  'Step 6D owner-only safety-input manifest. Red flags can only escalate, medication status is fail-closed, raw fact values are not returned, and no medical use is authorized.';
COMMENT ON FUNCTION public.therapy_retrieval_v2_safety_rule_assessments_v1(uuid, uuid) IS
  'Step 6D owner-only release-closed evaluation of bounded safety-rule AND conditions for every exact released preparation or product variant. Effects are not candidate eligibility.';
COMMENT ON FUNCTION public.therapy_retrieval_v2_safety_gate_preflight_v1(uuid, text, uuid, text, uuid, uuid, jsonb, text, text, integer, integer, integer) IS
  'Step 6D owner-only inactive pre-candidate safety gate. It binds Step 6C, escalates red flags, requires clear medication state, and evaluates release-closed interactions and contraindications without enabling candidate formation.';

REVOKE ALL ON FUNCTION
  public.therapy_retrieval_v2_safety_input_manifest_v1(uuid),
  public.therapy_retrieval_v2_safety_rule_assessments_v1(uuid, uuid),
  public.therapy_retrieval_v2_safety_gate_preflight_v1(
    uuid, text, uuid, text, uuid, uuid, jsonb, text, text,
    integer, integer, integer
  )
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMIT;
