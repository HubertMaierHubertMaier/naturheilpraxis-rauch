BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure(
       'public.therapy_retrieval_v2_safety_gate_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,integer,integer,integer)'
     ) IS NULL
     OR to_regprocedure(
       'public.therapy_retrieval_v2_split_track_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,integer,integer,integer)'
     ) IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Candidate-status preflight requires the complete Step 6D contract';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 67 THEN
    RAISE EXCEPTION 'Candidate-status preflight requires the exact 67-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Candidate-status preflight cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_general_candidate_track_v1(
  _therapy_input_revision_id uuid,
  _knowledge_release_id uuid,
  _split_track_result jsonb,
  _safety_gate_result jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  candidate_count integer;
  allow_count integer;
  review_count integer;
  exclude_count integer;
  candidates jsonb;
  result_payload jsonb;
BEGIN
  IF _therapy_input_revision_id IS NULL
     OR _knowledge_release_id IS NULL
     OR _split_track_result IS NULL
     OR _safety_gate_result IS NULL
     OR jsonb_typeof(_split_track_result) IS DISTINCT FROM 'object'
     OR jsonb_typeof(_safety_gate_result) IS DISTINCT FROM 'object'
     OR _split_track_result ->> 'status'
        IS DISTINCT FROM 'SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE'
     OR _safety_gate_result ->> 'status'
        IS DISTINCT FROM 'SAFETY_GATE_PREFLIGHT_COMPLETE_INACTIVE'
     OR _split_track_result ->> 'therapy_input_revision_id'
        IS DISTINCT FROM _therapy_input_revision_id::text
     OR _safety_gate_result ->> 'therapy_input_revision_id'
        IS DISTINCT FROM _therapy_input_revision_id::text
     OR _split_track_result ->> 'knowledge_release_id'
        IS DISTINCT FROM _knowledge_release_id::text
     OR _safety_gate_result ->> 'knowledge_release_id'
        IS DISTINCT FROM _knowledge_release_id::text
     OR _safety_gate_result ->> 'split_track_result_hash'
        IS DISTINCT FROM _split_track_result ->> 'result_hash'
     OR _split_track_result ->> 'result_hash'
        IS DISTINCT FROM public.kb_release_manifest_hash_v1(
          _split_track_result - 'result_hash'
        )
     OR _safety_gate_result ->> 'result_hash'
        IS DISTINCT FROM public.kb_release_manifest_hash_v1(
          _safety_gate_result - 'result_hash'
        )
     OR jsonb_typeof(_split_track_result #> '{general_track,facts}')
        IS DISTINCT FROM 'array'
     OR jsonb_typeof(
          _safety_gate_result #> '{safety_rule_assessments,subject_assessments}'
        ) IS DISTINCT FROM 'array'
     OR jsonb_array_length(
          _safety_gate_result #> '{safety_rule_assessments,subject_assessments}'
        ) NOT BETWEEN 1 AND 512
  THEN
    RETURN NULL;
  END IF;

  WITH split_facts AS MATERIALIZED (
    SELECT
      fact.value,
      (fact.value ->> 'fact_id')::uuid AS fact_id
      FROM jsonb_array_elements(
        _split_track_result #> '{general_track,facts}'
      ) fact(value)
  ), direct_references AS MATERIALIZED (
    SELECT
      fact.fact_id,
      reference.value,
      'direct'::text AS reference_kind
      FROM split_facts fact
      CROSS JOIN LATERAL jsonb_array_elements(
        fact.value -> 'direct_references'
      ) reference(value)
     WHERE reference.value ->> 'entity_type_code' IN (
       'preparation', 'product_variant'
     )
  ), graph_references AS MATERIALIZED (
    SELECT
      fact.fact_id,
      reference.value,
      'graph'::text AS reference_kind
      FROM split_facts fact
      CROSS JOIN LATERAL jsonb_array_elements(
        fact.value -> 'graph_references'
      ) reference(value)
     WHERE reference.value ->> 'entity_type_code' IN (
       'preparation', 'product_variant'
     )
  ), candidate_references AS MATERIALIZED (
    SELECT
      reference.fact_id,
      (reference.value ->> 'entity_id')::uuid AS entity_id,
      (reference.value ->> 'entity_revision_id')::uuid AS entity_revision_id,
      reference.value ->> 'entity_type_code' AS entity_type_code,
      reference.reference_kind,
      reference.value
      FROM (
        SELECT * FROM direct_references
        UNION ALL
        SELECT * FROM graph_references
      ) reference
  ), candidate_subjects AS MATERIALIZED (
    SELECT DISTINCT
      reference.entity_id,
      reference.entity_revision_id,
      reference.entity_type_code
      FROM candidate_references reference
  ), fact_stats AS MATERIALIZED (
    SELECT
      reference.entity_id,
      reference.entity_revision_id,
      count(DISTINCT reference.fact_id)::integer AS matched_fact_count,
      count(DISTINCT reference.fact_id) FILTER (
        WHERE fact.review_status = 'verified'
      )::integer AS verified_fact_count,
      count(DISTINCT reference.fact_id) FILTER (
        WHERE fact.review_status = 'review_only'
      )::integer AS review_only_fact_count,
      count(DISTINCT reference.fact_id) FILTER (
        WHERE NOT fact.is_negated
          AND fact.clinical_status = 'current'
          AND fact.certainty = 'confirmed'
          AND fact.review_status = 'verified'
      )::integer AS allow_eligible_fact_count,
      count(DISTINCT reference.fact_id) FILTER (
        WHERE fact.is_negated
           OR fact.clinical_status IS DISTINCT FROM 'current'
           OR fact.certainty IS DISTINCT FROM 'confirmed'
           OR fact.review_status IS DISTINCT FROM 'verified'
      )::integer AS review_required_fact_count,
      count(*) FILTER (
        WHERE reference.reference_kind = 'direct'
      )::integer AS direct_reference_count,
      count(*) FILTER (
        WHERE reference.reference_kind = 'graph'
      )::integer AS graph_reference_count
      FROM candidate_references reference
      JOIN public.therapy_input_facts fact
        ON fact.therapy_input_revision_id = _therapy_input_revision_id
       AND fact.id = reference.fact_id
     GROUP BY reference.entity_id, reference.entity_revision_id
  ), evidence_rows AS MATERIALIZED (
    SELECT
      reference.entity_id,
      reference.entity_revision_id,
      assertion.id AS assertion_id,
      reference.value ->> 'relation_type_code' AS relation_type_code,
      reference.value ->> 'graph_direction' AS graph_direction,
      reference.value ->> 'assignment_strength' AS assignment_strength,
      (reference.value ->> 'relation_rank')::integer AS relation_rank,
      assertion.content_hash AS assertion_content_hash,
      assertion.evidence_basis,
      assertion.evidence_quality,
      assertion.valid_from,
      assertion.valid_until,
      bool_or(
        NOT fact.is_negated
        AND fact.clinical_status = 'current'
        AND fact.certainty = 'confirmed'
        AND fact.review_status = 'verified'
      ) AS allow_eligible_fact_support
      FROM graph_references graph
      CROSS JOIN LATERAL (
        SELECT
          graph.fact_id,
          (graph.value ->> 'entity_id')::uuid AS entity_id,
          (graph.value ->> 'entity_revision_id')::uuid AS entity_revision_id,
          graph.value
      ) reference
      JOIN public.therapy_input_facts fact
        ON fact.therapy_input_revision_id = _therapy_input_revision_id
       AND fact.id = reference.fact_id
      JOIN public.kb_assertions assertion
        ON assertion.id = (reference.value ->> 'assertion_id')::uuid
       AND assertion.review_status = 'released'
      JOIN public.kb_release_items assertion_item
        ON assertion_item.release_id = _knowledge_release_id
       AND assertion_item.item_kind = 'assertion'
       AND assertion_item.assertion_id = assertion.id
      GROUP BY
        reference.entity_id,
        reference.entity_revision_id,
        assertion.id,
        reference.value ->> 'relation_type_code',
        reference.value ->> 'graph_direction',
        reference.value ->> 'assignment_strength',
        (reference.value ->> 'relation_rank')::integer,
        assertion.content_hash,
        assertion.evidence_basis,
        assertion.evidence_quality,
        assertion.valid_from,
        assertion.valid_until
  ), evidence_stats AS MATERIALIZED (
    SELECT
      evidence.entity_id,
      evidence.entity_revision_id,
      count(*)::integer AS released_support_assertion_count,
      count(*) FILTER (
        WHERE evidence.graph_direction = 'inbound'
          AND evidence.relation_type_code IN ('indicated_for', 'may_support')
          AND evidence.assignment_strength IN ('direct', 'indirect')
          AND evidence.evidence_basis <> 'unrated'
          AND evidence.evidence_quality <> 'unrated'
          AND evidence.allow_eligible_fact_support
      )::integer AS strong_support_assertion_count,
      count(*) FILTER (
        WHERE evidence.assignment_strength = 'not_recommended'
      )::integer AS not_recommended_assertion_count,
      count(*) FILTER (
        WHERE evidence.evidence_basis = 'manufacturer_statement'
      )::integer AS manufacturer_foundation_count,
      count(*) FILTER (
        WHERE evidence.evidence_basis = 'traditional_use'
      )::integer AS traditional_foundation_count,
      count(*) FILTER (
        WHERE evidence.evidence_basis IN (
          'experiential_medicine', 'practice_rule'
        )
      )::integer AS practice_foundation_count,
      count(*) FILTER (
        WHERE evidence.evidence_basis IN (
          'mechanistic', 'observational_study', 'clinical_study',
          'systematic_review', 'guideline'
        )
      )::integer AS scientific_foundation_count,
      count(*) FILTER (
        WHERE evidence.evidence_basis = 'unrated'
      )::integer AS unrated_foundation_count,
      count(*) FILTER (
        WHERE evidence.evidence_quality = 'unrated'
      )::integer AS quality_unrated_count,
      count(*) FILTER (
        WHERE evidence.evidence_quality = 'very_low'
      )::integer AS quality_very_low_count,
      count(*) FILTER (
        WHERE evidence.evidence_quality = 'low'
      )::integer AS quality_low_count,
      count(*) FILTER (
        WHERE evidence.evidence_quality = 'moderate'
      )::integer AS quality_moderate_count,
      count(*) FILTER (
        WHERE evidence.evidence_quality = 'high'
      )::integer AS quality_high_count
      FROM evidence_rows evidence
     GROUP BY evidence.entity_id, evidence.entity_revision_id
  ), source_stats AS MATERIALIZED (
    SELECT
      evidence.entity_id,
      evidence.entity_revision_id,
      count(DISTINCT source_binding.source_revision_id)::integer
        AS exact_source_revision_count,
      count(*) FILTER (
        WHERE NULLIF(btrim(source_binding.locator), '') IS NOT NULL
      )::integer AS exact_locator_count,
      max(source_revision.published_on) AS latest_published_on
      FROM evidence_rows evidence
      JOIN public.kb_assertion_sources source_binding
        ON source_binding.assertion_id = evidence.assertion_id
       AND source_binding.is_primary
       AND source_binding.source_role IN ('supports', 'qualifies')
      JOIN public.kb_source_revisions source_revision
        ON source_revision.id = source_binding.source_revision_id
      JOIN public.kb_release_items source_item
        ON source_item.release_id = _knowledge_release_id
       AND source_item.item_kind = 'source_revision'
       AND source_item.source_id = source_revision.source_id
       AND source_item.source_revision_id = source_revision.id
     GROUP BY evidence.entity_id, evidence.entity_revision_id
  ), candidate_base AS MATERIALIZED (
    SELECT
      subject.entity_id,
      subject.entity_revision_id,
      subject.entity_type_code,
      entity.canonical_key,
      revision.display_name,
      revision.content_hash AS entity_content_hash,
      stats.matched_fact_count,
      stats.verified_fact_count,
      stats.review_only_fact_count,
      stats.allow_eligible_fact_count,
      stats.review_required_fact_count,
      stats.direct_reference_count,
      stats.graph_reference_count,
      safety.value ->> 'safety_effect' AS safety_effect,
      jsonb_array_length(safety.value -> 'rules') AS safety_rule_count,
      COALESCE(evidence.released_support_assertion_count, 0)
        AS released_support_assertion_count,
      COALESCE(evidence.strong_support_assertion_count, 0)
        AS strong_support_assertion_count,
      COALESCE(evidence.not_recommended_assertion_count, 0)
        AS not_recommended_assertion_count,
      COALESCE(evidence.manufacturer_foundation_count, 0)
        AS manufacturer_foundation_count,
      COALESCE(evidence.traditional_foundation_count, 0)
        AS traditional_foundation_count,
      COALESCE(evidence.practice_foundation_count, 0)
        AS practice_foundation_count,
      COALESCE(evidence.scientific_foundation_count, 0)
        AS scientific_foundation_count,
      COALESCE(evidence.unrated_foundation_count, 0)
        AS unrated_foundation_count,
      COALESCE(evidence.quality_unrated_count, 0) AS quality_unrated_count,
      COALESCE(evidence.quality_very_low_count, 0) AS quality_very_low_count,
      COALESCE(evidence.quality_low_count, 0) AS quality_low_count,
      COALESCE(evidence.quality_moderate_count, 0) AS quality_moderate_count,
      COALESCE(evidence.quality_high_count, 0) AS quality_high_count,
      COALESCE(source.exact_source_revision_count, 0)
        AS exact_source_revision_count,
      COALESCE(source.exact_locator_count, 0) AS exact_locator_count,
      source.latest_published_on,
      (input_revision.input_envelope #> '{context}') ? 'budget_eur'
        AS budget_context_present,
      (input_revision.input_envelope #> '{context}') ? 'preferred_lanes'
        AS preference_context_present
      FROM candidate_subjects subject
      JOIN fact_stats stats
        ON stats.entity_id = subject.entity_id
       AND stats.entity_revision_id = subject.entity_revision_id
      JOIN public.kb_entities entity
        ON entity.id = subject.entity_id
       AND entity.entity_type_code = subject.entity_type_code
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = subject.entity_id
       AND revision.id = subject.entity_revision_id
      JOIN public.kb_release_items subject_item
        ON subject_item.release_id = _knowledge_release_id
       AND subject_item.item_kind = 'entity_revision'
       AND subject_item.entity_id = subject.entity_id
       AND subject_item.entity_revision_id = subject.entity_revision_id
      JOIN public.therapy_input_revisions input_revision
        ON input_revision.id = _therapy_input_revision_id
      LEFT JOIN evidence_stats evidence
        ON evidence.entity_id = subject.entity_id
       AND evidence.entity_revision_id = subject.entity_revision_id
      LEFT JOIN source_stats source
        ON source.entity_id = subject.entity_id
       AND source.entity_revision_id = subject.entity_revision_id
      LEFT JOIN LATERAL (
        SELECT assessment.value
          FROM jsonb_array_elements(
            _safety_gate_result
              #> '{safety_rule_assessments,subject_assessments}'
          ) assessment(value)
         WHERE assessment.value ->> 'subject_entity_id' = subject.entity_id::text
           AND assessment.value ->> 'subject_entity_revision_id'
               = subject.entity_revision_id::text
      ) safety ON true
  ), classified AS MATERIALIZED (
    SELECT candidate.*,
           CASE
             WHEN candidate.safety_effect = 'EXCLUDE' THEN 'EXCLUDE'
              WHEN candidate.safety_effect IS NULL
                OR candidate.safety_effect = 'REVIEW_ONLY'
                OR candidate.safety_effect NOT IN (
                  'NOTICE_ONLY', 'NO_MATCHING_RULE_INACTIVE'
                )
                OR candidate.allow_eligible_fact_count = 0
                OR candidate.review_required_fact_count > 0
                OR candidate.not_recommended_assertion_count > 0
               OR candidate.strong_support_assertion_count = 0
               THEN 'REVIEW_ONLY'
             ELSE 'ALLOW'
           END AS candidate_status
      FROM candidate_base candidate
  ), reasoned AS MATERIALIZED (
    SELECT candidate.*,
           to_jsonb(array_remove(ARRAY[
             CASE WHEN candidate.safety_effect = 'EXCLUDE'
               THEN 'SAFETY_RULE_EXCLUDE_UNOVERRIDABLE' END,
             CASE WHEN candidate.safety_effect IS NULL
               THEN 'SAFETY_SUBJECT_ASSESSMENT_MISSING' END,
              CASE WHEN candidate.safety_effect = 'REVIEW_ONLY'
                THEN 'SAFETY_RULE_REVIEW_REQUIRED' END,
              CASE WHEN candidate.safety_effect IS NOT NULL
                     AND candidate.safety_effect NOT IN (
                       'EXCLUDE', 'REVIEW_ONLY', 'NOTICE_ONLY',
                       'NO_MATCHING_RULE_INACTIVE'
                     )
                THEN 'UNRECOGNIZED_SAFETY_EFFECT_REQUIRES_REVIEW' END,
              CASE WHEN candidate.review_only_fact_count > 0
                THEN 'REVIEW_ONLY_FACT_MATCH' END,
              CASE WHEN candidate.allow_eligible_fact_count = 0
                THEN 'NO_ALLOW_ELIGIBLE_FACT_MATCH' END,
              CASE WHEN candidate.review_required_fact_count > 0
                THEN 'NEGATED_INACTIVE_UNCONFIRMED_OR_UNVERIFIED_FACT_MATCH' END,
             CASE WHEN candidate.not_recommended_assertion_count > 0
               THEN 'NOT_RECOMMENDED_RELATION_REQUIRES_REVIEW' END,
             CASE WHEN candidate.strong_support_assertion_count = 0
               THEN 'NO_RELEASED_STRONG_SUPPORT_ASSERTION' END,
             CASE WHEN candidate.candidate_status = 'ALLOW'
               THEN 'INACTIVE_ELIGIBILITY_CRITERIA_MET' END
           ]::text[], NULL)) AS status_reasons
      FROM classified candidate
  ), ordered AS MATERIALIZED (
    SELECT row_number() OVER (
             ORDER BY
               CASE candidate.candidate_status
                 WHEN 'ALLOW' THEN 0
                 WHEN 'REVIEW_ONLY' THEN 1
                 ELSE 2
               END,
               candidate.verified_fact_count DESC,
               candidate.strong_support_assertion_count DESC,
               CASE candidate.entity_type_code
                 WHEN 'product_variant' THEN 0 ELSE 1
               END,
               candidate.direct_reference_count DESC,
               candidate.canonical_key COLLATE "C",
               candidate.entity_revision_id
           )::integer AS position,
           candidate.*
      FROM reasoned candidate
  )
  SELECT count(*)::integer,
         count(*) FILTER (WHERE candidate_status = 'ALLOW')::integer,
         count(*) FILTER (WHERE candidate_status = 'REVIEW_ONLY')::integer,
         count(*) FILTER (WHERE candidate_status = 'EXCLUDE')::integer,
         COALESCE(jsonb_agg(jsonb_build_object(
           'position', candidate.position,
           'candidate_status', candidate.candidate_status,
           'status_lock', CASE candidate.candidate_status
             WHEN 'EXCLUDE' THEN 'UNOVERRIDABLE_BY_AI_CLIENT_PREFERENCE_OR_PIN'
             WHEN 'REVIEW_ONLY' THEN 'REQUIRES_HUMAN_REVIEW_NO_AUTOMATIC_ALLOW'
             ELSE 'INACTIVE_ONLY_NOT_MEDICAL_USE'
           END,
           'status_reasons', candidate.status_reasons,
           'entity_id', candidate.entity_id,
           'entity_revision_id', candidate.entity_revision_id,
           'entity_type_code', candidate.entity_type_code,
           'canonical_key', candidate.canonical_key,
           'display_name', candidate.display_name,
           'entity_content_hash', candidate.entity_content_hash,
           'safety', jsonb_build_object(
             'safety_effect', candidate.safety_effect,
             'safety_rule_count', candidate.safety_rule_count
           ),
           'dimensions', jsonb_build_object(
             'clinical_fact_coverage', jsonb_build_object(
               'matched_fact_count', candidate.matched_fact_count,
                'verified_fact_count', candidate.verified_fact_count,
                'review_only_fact_count', candidate.review_only_fact_count,
                'allow_eligible_fact_count', candidate.allow_eligible_fact_count,
                'review_required_fact_count', candidate.review_required_fact_count
             ),
             'exact_reference_precision', jsonb_build_object(
               'exact_entity_type', candidate.entity_type_code,
               'direct_reference_count', candidate.direct_reference_count,
               'graph_reference_count', candidate.graph_reference_count
             ),
             'clinical_relation_support', jsonb_build_object(
               'released_assertion_count',
                 candidate.released_support_assertion_count,
               'strong_support_assertion_count',
                 candidate.strong_support_assertion_count,
               'not_recommended_assertion_count',
                 candidate.not_recommended_assertion_count
             ),
             'evidence_foundations', jsonb_build_object(
               'manufacturer', candidate.manufacturer_foundation_count,
               'traditional', candidate.traditional_foundation_count,
               'practice_or_experiential', candidate.practice_foundation_count,
               'scientific', candidate.scientific_foundation_count,
               'unrated', candidate.unrated_foundation_count
             ),
             'evidence_quality', jsonb_build_object(
               'unrated', candidate.quality_unrated_count,
               'very_low', candidate.quality_very_low_count,
               'low', candidate.quality_low_count,
               'moderate', candidate.quality_moderate_count,
               'high', candidate.quality_high_count
             ),
             'practice_experience', jsonb_build_object(
               'released_assertion_count', candidate.practice_foundation_count
             ),
             'source_recency_and_specificity', jsonb_build_object(
               'exact_source_revision_count',
                 candidate.exact_source_revision_count,
               'exact_locator_count', candidate.exact_locator_count,
               'latest_published_on', candidate.latest_published_on
             ),
             'preference_and_budget', jsonb_build_object(
               'preference_context_present',
                 candidate.preference_context_present,
               'budget_context_present', candidate.budget_context_present,
               'used_for_candidate_status', false,
               'eligible_only_after_safety_and_fit', true
             )
           ),
           'reference_provenance', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'therapy_input_fact_id', reference.fact_id,
               'fact_content_sha256', fact.content_sha256,
               'fact_review_status', fact.review_status,
               'reference_kind', reference.reference_kind,
               'best_match_channel', CASE
                 WHEN reference.reference_kind = 'direct'
                   THEN reference.value ->> 'best_match_channel'
                 ELSE NULL
               END,
               'assertion_id', CASE
                 WHEN reference.reference_kind = 'graph'
                   THEN reference.value ->> 'assertion_id'
                 ELSE NULL
               END,
               'relation_type_code', CASE
                 WHEN reference.reference_kind = 'graph'
                   THEN reference.value ->> 'relation_type_code'
                 ELSE NULL
               END
              ) ORDER BY
                reference.fact_id,
                reference.reference_kind COLLATE "C",
                reference.value::text COLLATE "C")
               FROM candidate_references reference
               JOIN public.therapy_input_facts fact
                 ON fact.therapy_input_revision_id = _therapy_input_revision_id
                AND fact.id = reference.fact_id
              WHERE reference.entity_id = candidate.entity_id
                AND reference.entity_revision_id = candidate.entity_revision_id
           ), '[]'::jsonb),
           'evidence_details', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'assertion_id', evidence.assertion_id,
               'assertion_content_hash', evidence.assertion_content_hash,
               'relation_type_code', evidence.relation_type_code,
               'graph_direction', evidence.graph_direction,
               'assignment_strength', evidence.assignment_strength,
               'relation_rank', evidence.relation_rank,
               'evidence_basis', evidence.evidence_basis,
               'evidence_quality', evidence.evidence_quality,
               'valid_from', evidence.valid_from,
               'valid_until', evidence.valid_until,
               'sources', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object(
                   'source_id', source_revision.source_id,
                   'source_revision_id', source_revision.id,
                   'source_content_hash', source_revision.content_hash,
                   'source_type', source_revision.source_type,
                   'published_on', source_revision.published_on,
                   'source_role', source_binding.source_role,
                   'locator', source_binding.locator,
                   'is_primary', source_binding.is_primary
                 ) ORDER BY source_revision.id, source_binding.locator COLLATE "C")
                   FROM public.kb_assertion_sources source_binding
                   JOIN public.kb_source_revisions source_revision
                     ON source_revision.id = source_binding.source_revision_id
                   JOIN public.kb_release_items source_item
                     ON source_item.release_id = _knowledge_release_id
                    AND source_item.item_kind = 'source_revision'
                    AND source_item.source_id = source_revision.source_id
                    AND source_item.source_revision_id = source_revision.id
                  WHERE source_binding.assertion_id = evidence.assertion_id
                    AND source_binding.is_primary
                    AND source_binding.source_role IN ('supports', 'qualifies')
               ), '[]'::jsonb)
             ) ORDER BY evidence.assertion_id)
               FROM evidence_rows evidence
              WHERE evidence.entity_id = candidate.entity_id
                AND evidence.entity_revision_id = candidate.entity_revision_id
           ), '[]'::jsonb)
         ) ORDER BY candidate.position), '[]'::jsonb)
    INTO candidate_count, allow_count, review_count, exclude_count, candidates
    FROM ordered candidate;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_GENERAL_CANDIDATE_TRACK_PREFLIGHT_ONLY',
    'track', 'GENERAL_OR_NATUROPATHIC_CANDIDATE_TRACK',
    'status', CASE WHEN candidate_count = 0
      THEN 'GENERAL_NO_EXACT_CANDIDATES_INACTIVE'
      ELSE 'GENERAL_CANDIDATE_STATUSES_READY_INACTIVE' END,
    'interpretation', 'MULTIDIMENSIONAL_INACTIVE_CANDIDATE_STATUS_NOT_RECOMMENDATION',
    'medical_use_allowed', false,
    'dosage_evaluation_allowed', false,
    'ai_use_allowed', false,
    'split_track_result_hash', _split_track_result ->> 'result_hash',
    'safety_gate_result_hash', _safety_gate_result ->> 'result_hash',
    'candidate_count', candidate_count,
    'status_counts', jsonb_build_object(
      'ALLOW', allow_count,
      'REVIEW_ONLY', review_count,
      'EXCLUDE', exclude_count,
      'ESCALATE_ONLY', 0
    ),
    'ordering_dimensions', jsonb_build_array(
      'candidate_status_allow_review_exclude',
      'verified_fact_coverage_desc',
      'strong_support_assertions_desc',
      'product_variant_before_preparation',
      'direct_reference_count_desc',
      'canonical_key_asc',
      'entity_revision_id_asc'
    ),
    'opaque_composite_score_used', false,
    'candidates', candidates
  ));
  RETURN result_payload || jsonb_build_object(
    'track_result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_homeopathic_candidate_track_v1(
  _split_track_result jsonb,
  _safety_gate_result jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  candidate_count integer;
  candidates jsonb;
  result_payload jsonb;
BEGIN
  IF _split_track_result IS NULL
     OR _safety_gate_result IS NULL
     OR jsonb_typeof(_split_track_result) IS DISTINCT FROM 'object'
     OR jsonb_typeof(_safety_gate_result) IS DISTINCT FROM 'object'
     OR _split_track_result ->> 'status'
        IS DISTINCT FROM 'SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE'
     OR _safety_gate_result ->> 'status'
        IS DISTINCT FROM 'SAFETY_GATE_PREFLIGHT_COMPLETE_INACTIVE'
     OR _safety_gate_result ->> 'split_track_result_hash'
        IS DISTINCT FROM _split_track_result ->> 'result_hash'
     OR _split_track_result ->> 'result_hash'
        IS DISTINCT FROM public.kb_release_manifest_hash_v1(
          _split_track_result - 'result_hash'
        )
     OR _safety_gate_result ->> 'result_hash'
        IS DISTINCT FROM public.kb_release_manifest_hash_v1(
          _safety_gate_result - 'result_hash'
        )
     OR jsonb_typeof(_split_track_result #> '{homeopathic_track,candidates}')
        IS DISTINCT FROM 'array'
     OR jsonb_array_length(
          _split_track_result #> '{homeopathic_track,candidates}'
        ) > 200
  THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::integer,
         COALESCE(jsonb_agg(jsonb_build_object(
           'position', (candidate.value ->> 'position')::integer,
           'candidate_status', 'REVIEW_ONLY',
           'status_lock', 'EXACT_PREPARATION_POTENCY_AND_SAFETY_REVIEW_REQUIRED',
           'status_reasons', jsonb_build_array(
             'SOURCE_NATIVE_REPERTORY_MATCH_ONLY',
             'EXACT_HOMEOPATHIC_PREPARATION_UNRESOLVED',
             'SUBJECT_SAFETY_ASSESSMENT_NOT_APPLICABLE_YET'
           ),
           'remedy_entity_id', candidate.value ->> 'remedy_entity_id',
           'remedy_revision_id', candidate.value ->> 'remedy_revision_id',
           'repertory_remedy_id', candidate.value ->> 'repertory_remedy_id',
           'source_remedy_code', candidate.value ->> 'source_remedy_code',
           'source_remedy_name', candidate.value ->> 'source_remedy_name',
           'remedy_content_hash', candidate.value ->> 'remedy_content_hash',
           'dimensions', jsonb_build_object(
             'rubric_coverage', candidate.value -> 'rubric_coverage',
             'source_grade_profile', candidate.value -> 'source_grade_profile',
             'domain_coverage', candidate.value -> 'domain_coverage',
             'negative_rubric_conflicts',
               (candidate.value ->> 'excluded_rubric_conflicts')::integer,
             'materia_medica_alignment', 'NOT_ASSESSED',
             'practice_experience', 'NOT_ASSESSED',
             'stable_source_native_position',
               (candidate.value ->> 'position')::integer
           ),
           'source_native_matches', candidate.value -> 'source_native_matches'
         ) ORDER BY (candidate.value ->> 'position')::integer), '[]'::jsonb)
    INTO candidate_count, candidates
    FROM jsonb_array_elements(
      _split_track_result #> '{homeopathic_track,candidates}'
    ) candidate(value);

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_HOMEOPATHIC_CANDIDATE_TRACK_PREFLIGHT_ONLY',
    'track', 'HOMEOPATHIC_SOURCE_NATIVE_CANDIDATE_TRACK',
    'status', CASE WHEN candidate_count = 0
      THEN 'HOMEOPATHIC_NO_CANDIDATES_INACTIVE'
      ELSE 'HOMEOPATHIC_CANDIDATES_REVIEW_ONLY_INACTIVE' END,
    'interpretation', 'HOMEOPATHIC_DIMENSIONS_NOT_EFFICACY_OR_RECOMMENDATION',
    'medical_use_allowed', false,
    'dosage_evaluation_allowed', false,
    'ai_use_allowed', false,
    'cross_track_candidate_reuse_allowed', false,
    'split_track_result_hash', _split_track_result ->> 'result_hash',
    'safety_gate_result_hash', _safety_gate_result ->> 'result_hash',
    'candidate_count', candidate_count,
    'status_counts', jsonb_build_object(
      'ALLOW', 0,
      'REVIEW_ONLY', candidate_count,
      'EXCLUDE', 0,
      'ESCALATE_ONLY', 0
    ),
    'ordering_dimensions', jsonb_build_array(
      'source_native_repertory_position_asc',
      'no_cross_track_or_efficacy_score'
    ),
    'opaque_composite_score_used', false,
    'candidates', candidates
  ));
  RETURN result_payload || jsonb_build_object(
    'track_result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_candidate_status_preflight_v1(
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
  safety_gate_result jsonb;
  safety_gate_hash_matches boolean;
  split_track_result jsonb;
  general_track jsonb;
  homeopathic_track jsonb;
  result_payload jsonb;
BEGIN
  safety_gate_result := public.therapy_retrieval_v2_safety_gate_preflight_v1(
    _therapy_input_revision_id,
    _expected_therapy_input_hash,
    _knowledge_release_id,
    _expected_release_manifest_hash,
    _repertory_entity_id,
    _repertory_revision_id,
    _rubric_links,
    _expected_homeopathic_request_hash,
    _expected_split_track_result_hash,
    _direct_limit,
    _graph_limit,
    _homeopathic_limit
  );
  safety_gate_hash_matches := COALESCE(
    _expected_safety_gate_result_hash ~ '^[0-9a-f]{64}$'
    AND safety_gate_result ->> 'result_hash' = _expected_safety_gate_result_hash,
    false
  );

  -- Safety dispositions take precedence over caller hash expectations so a
  -- stale caller cannot hide an escalation or mandatory review.
  IF safety_gate_result ->> 'status' = 'SAFETY_GATE_ESCALATE_ONLY_INACTIVE' THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_CANDIDATE_STATUS_PREFLIGHT_ONLY',
      'status', 'CANDIDATE_STATUS_ESCALATE_ONLY_INACTIVE',
      'interpretation', 'INACTIVE_CANDIDATE_STATUS_NOT_RECOMMENDATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'productive_candidate_use_allowed', false,
      'candidate_status_assignment_allowed', false,
      'dosage_evaluation_allowed', false,
      'ai_use_allowed', false,
      'global_candidate_status', 'ESCALATE_ONLY',
      'status_lock', 'UNOVERRIDABLE_BY_AI_CLIENT_PREFERENCE_OR_PIN',
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'expected_safety_gate_result_hash', _expected_safety_gate_result_hash,
      'actual_safety_gate_result_hash', safety_gate_result ->> 'result_hash',
      'safety_gate_result_hash_matches', safety_gate_hash_matches,
      'candidate_count', 0,
      'general_track', NULL,
      'homeopathic_track', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF safety_gate_result ->> 'status' = 'SAFETY_GATE_REVIEW_REQUIRED_INACTIVE' THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_CANDIDATE_STATUS_PREFLIGHT_ONLY',
      'status', 'CANDIDATE_STATUS_REVIEW_ONLY_INACTIVE',
      'interpretation', 'INACTIVE_CANDIDATE_STATUS_NOT_RECOMMENDATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'productive_candidate_use_allowed', false,
      'candidate_status_assignment_allowed', false,
      'dosage_evaluation_allowed', false,
      'ai_use_allowed', false,
      'global_candidate_status', 'REVIEW_ONLY',
      'status_lock', 'REQUIRES_HUMAN_REVIEW_NO_AUTOMATIC_ALLOW',
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'expected_safety_gate_result_hash', _expected_safety_gate_result_hash,
      'actual_safety_gate_result_hash', safety_gate_result ->> 'result_hash',
      'safety_gate_result_hash_matches', safety_gate_hash_matches,
      'candidate_count', 0,
      'general_track', NULL,
      'homeopathic_track', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF safety_gate_result ->> 'status'
       <> 'SAFETY_GATE_PREFLIGHT_COMPLETE_INACTIVE'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_CANDIDATE_STATUS_PREFLIGHT_ONLY',
      'status', 'CANDIDATE_STATUS_SAFETY_GATE_UNAVAILABLE',
      'interpretation', 'INACTIVE_CANDIDATE_STATUS_NOT_RECOMMENDATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'productive_candidate_use_allowed', false,
      'candidate_status_assignment_allowed', false,
      'dosage_evaluation_allowed', false,
      'ai_use_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'safety_gate_status', safety_gate_result ->> 'status',
      'actual_safety_gate_result_hash', safety_gate_result ->> 'result_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF _expected_safety_gate_result_hash IS NULL
     OR _expected_safety_gate_result_hash !~ '^[0-9a-f]{64}$'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_CANDIDATE_STATUS_PREFLIGHT_ONLY',
      'status', 'CANDIDATE_STATUS_EXPECTATION_INVALID',
      'interpretation', 'INACTIVE_CANDIDATE_STATUS_NOT_RECOMMENDATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'productive_candidate_use_allowed', false,
      'candidate_status_assignment_allowed', false,
      'dosage_evaluation_allowed', false,
      'ai_use_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF NOT safety_gate_hash_matches THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_CANDIDATE_STATUS_PREFLIGHT_ONLY',
      'status', 'CANDIDATE_STATUS_SAFETY_GATE_MISMATCH',
      'interpretation', 'INACTIVE_CANDIDATE_STATUS_NOT_RECOMMENDATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'productive_candidate_use_allowed', false,
      'candidate_status_assignment_allowed', false,
      'dosage_evaluation_allowed', false,
      'ai_use_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'actual_safety_gate_result_hash', safety_gate_result ->> 'result_hash'
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
  IF split_track_result ->> 'status'
       <> 'SPLIT_TRACK_PREFLIGHT_COMPLETE_INACTIVE'
     OR split_track_result ->> 'result_hash'
        IS DISTINCT FROM _expected_split_track_result_hash
     OR split_track_result ->> 'result_hash'
        IS DISTINCT FROM safety_gate_result ->> 'split_track_result_hash'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_CANDIDATE_STATUS_PREFLIGHT_ONLY',
      'status', 'CANDIDATE_STATUS_SPLIT_TRACK_UNAVAILABLE',
      'interpretation', 'INACTIVE_CANDIDATE_STATUS_NOT_RECOMMENDATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'productive_candidate_use_allowed', false,
      'candidate_status_assignment_allowed', false,
      'dosage_evaluation_allowed', false,
      'ai_use_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'split_track_status', split_track_result ->> 'status',
      'actual_split_track_result_hash', split_track_result ->> 'result_hash',
      'safety_gate_result_hash', safety_gate_result ->> 'result_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  general_track := public.therapy_retrieval_v2_general_candidate_track_v1(
    _therapy_input_revision_id,
    _knowledge_release_id,
    split_track_result,
    safety_gate_result
  );
  homeopathic_track :=
    public.therapy_retrieval_v2_homeopathic_candidate_track_v1(
      split_track_result,
      safety_gate_result
    );
  IF general_track IS NULL OR homeopathic_track IS NULL THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_CANDIDATE_STATUS_PREFLIGHT_ONLY',
      'status', 'CANDIDATE_STATUS_TRACKS_UNAVAILABLE',
      'interpretation', 'INACTIVE_CANDIDATE_STATUS_NOT_RECOMMENDATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'productive_candidate_use_allowed', false,
      'candidate_status_assignment_allowed', false,
      'dosage_evaluation_allowed', false,
      'ai_use_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'split_track_result_hash', split_track_result ->> 'result_hash',
      'safety_gate_result_hash', safety_gate_result ->> 'result_hash'
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_CANDIDATE_STATUS_PREFLIGHT_ONLY',
    'status', 'CANDIDATE_STATUS_PREFLIGHT_COMPLETE_INACTIVE',
    'interpretation', 'INACTIVE_CANDIDATE_STATUS_NOT_RECOMMENDATION_OR_MEDICAL_USE',
    'medical_use_allowed', false,
    'retrieval_execution_allowed', false,
    'productive_candidate_use_allowed', false,
    'candidate_status_assignment_allowed', false,
    'inactive_candidate_statuses_materialized', true,
    'dosage_evaluation_allowed', false,
    'ai_use_allowed', false,
    'therapy_input_revision_id', _therapy_input_revision_id,
    'therapy_input_manifest_hash',
      safety_gate_result ->> 'therapy_input_manifest_hash',
    'knowledge_release_id', _knowledge_release_id,
    'release_manifest_hash', safety_gate_result ->> 'release_manifest_hash',
    'binding_hash', safety_gate_result ->> 'binding_hash',
    'split_track_result_hash', split_track_result ->> 'result_hash',
    'safety_gate_result_hash', safety_gate_result ->> 'result_hash',
    'candidate_status_policy', jsonb_build_object(
      'policy_version', 1,
      'statuses', jsonb_build_array(
        'ALLOW', 'REVIEW_ONLY', 'EXCLUDE', 'ESCALATE_ONLY'
      ),
      'precedence', jsonb_build_array(
        'ESCALATE_ONLY', 'EXCLUDE', 'REVIEW_ONLY', 'ALLOW'
      ),
      'exclude_and_escalate_overridable', false,
      'ai_client_preference_or_pin_can_change_status', false
    ),
    'track_separation_policy', jsonb_build_object(
      'general_and_homeopathic_dimensions_are_separate', true,
      'cross_track_score_or_candidate_reuse_allowed', false,
      'opaque_composite_score_used', false
    ),
    'candidate_count',
      (general_track ->> 'candidate_count')::integer
      + (homeopathic_track ->> 'candidate_count')::integer,
    'general_track', general_track,
    'homeopathic_track', homeopathic_track
  ));

  IF octet_length(result_payload::text) > 8388608 THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_CANDIDATE_STATUS_PREFLIGHT_ONLY',
      'status', 'CANDIDATE_STATUS_RESULT_LIMIT_EXCEEDED',
      'interpretation', 'INACTIVE_CANDIDATE_STATUS_NOT_RECOMMENDATION_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'retrieval_execution_allowed', false,
      'productive_candidate_use_allowed', false,
      'candidate_status_assignment_allowed', false,
      'dosage_evaluation_allowed', false,
      'ai_use_allowed', false,
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'split_track_result_hash', split_track_result ->> 'result_hash',
      'safety_gate_result_hash', safety_gate_result ->> 'result_hash',
      'general_track_result_hash', general_track ->> 'track_result_hash',
      'homeopathic_track_result_hash',
        homeopathic_track ->> 'track_result_hash'
    ));
  END IF;

  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

COMMENT ON FUNCTION public.therapy_retrieval_v2_general_candidate_track_v1(uuid, uuid, jsonb, jsonb) IS
  'Step 6E owner-only inactive general candidate projection. Exact preparation or product-variant references receive deterministic statuses and separate dimensions; no composite score, dosage, AI or medical use is enabled.';
COMMENT ON FUNCTION public.therapy_retrieval_v2_homeopathic_candidate_track_v1(jsonb, jsonb) IS
  'Step 6E owner-only inactive homeopathic candidate projection. Source-native dimensions remain separate and every remedy stays review-only until an exact preparation, potency and subject safety assessment exist.';
COMMENT ON FUNCTION public.therapy_retrieval_v2_candidate_status_preflight_v1(uuid, text, uuid, text, uuid, uuid, jsonb, text, text, text, integer, integer, integer) IS
  'Step 6E owner-only release-, split- and safety-hash-bound candidate-status preflight. ESCALATE_ONLY and EXCLUDE are not overridable; all productive use, dosage and AI remain disabled.';

REVOKE ALL ON FUNCTION
  public.therapy_retrieval_v2_general_candidate_track_v1(
    uuid, uuid, jsonb, jsonb
  ),
  public.therapy_retrieval_v2_homeopathic_candidate_track_v1(jsonb, jsonb),
  public.therapy_retrieval_v2_candidate_status_preflight_v1(
    uuid, text, uuid, text, uuid, uuid, jsonb, text, text, text,
    integer, integer, integer
  )
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMIT;
