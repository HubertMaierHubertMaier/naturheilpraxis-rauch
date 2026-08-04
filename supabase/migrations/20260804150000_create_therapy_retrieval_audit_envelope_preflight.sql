BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure(
       'public.therapy_retrieval_v2_dosage_rule_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,text,integer,integer,integer)'
     ) IS NULL
     OR to_regprocedure(
       'public.therapy_retrieval_v2_candidate_status_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,integer,integer,integer)'
     ) IS NULL
     OR to_regprocedure(
       'public.therapy_retrieval_v2_safety_gate_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,integer,integer,integer)'
     ) IS NULL
     OR to_regprocedure('public.therapy_retrieval_v2_input_manifest_v1(uuid)') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Retrieval audit-envelope preflight requires the complete Step 6F contract';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 67 THEN
    RAISE EXCEPTION 'Retrieval audit-envelope preflight requires the exact 67-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Retrieval audit-envelope preflight cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_audit_envelope_preflight_v1(
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
  _expected_dosage_rule_result_hash text,
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
  dosage_rule_result jsonb;
  dosage_rule_hash_matches boolean;
  candidate_status_result jsonb;
  safety_gate_result jsonb;
  input_manifest jsonb;
  fact_source_binding_count integer;
  safety_source_binding_count integer;
  selected_fact_count integer;
  fact_provenance_rows jsonb;
  fact_provenance jsonb;
  comparator_manifest jsonb;
  candidate_decisions jsonb;
  safety_decisions jsonb;
  dosage_decisions jsonb;
  knowledge_source_provenance jsonb;
  knowledge_source_binding_count integer;
  audit_envelope jsonb;
  result_payload jsonb;
BEGIN
  dosage_rule_result := public.therapy_retrieval_v2_dosage_rule_preflight_v1(
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
    _expected_candidate_status_result_hash,
    _direct_limit,
    _graph_limit,
    _homeopathic_limit
  );
  dosage_rule_hash_matches := COALESCE(
    _expected_dosage_rule_result_hash ~ '^[0-9a-f]{64}$'
    AND dosage_rule_result ->> 'result_hash'
        = _expected_dosage_rule_result_hash,
    false
  );

  -- A stale audit caller may not hide a newly discovered escalation or review.
  IF dosage_rule_result ->> 'status' = 'DOSAGE_RULE_ESCALATE_ONLY_INACTIVE' THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_AUDIT_ESCALATE_ONLY_INACTIVE',
      'interpretation', 'AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'audit_persistence_allowed', false,
      'replay_execution_allowed', false,
      'shadow_execution_allowed', false,
      'ai_use_allowed', false,
      'plan_selection_allowed', false,
      'activation_allowed', false,
      'global_candidate_status', 'ESCALATE_ONLY',
      'status_lock', 'UNOVERRIDABLE_BY_AI_CLIENT_PREFERENCE_OR_PIN',
      'dosage_rule_result_hash', dosage_rule_result ->> 'result_hash',
      'dosage_rule_result_hash_matches', dosage_rule_hash_matches,
      'audit_envelope', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF dosage_rule_result ->> 'status' = 'DOSAGE_RULE_REVIEW_ONLY_INACTIVE' THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_AUDIT_REVIEW_ONLY_INACTIVE',
      'interpretation', 'AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'audit_persistence_allowed', false,
      'replay_execution_allowed', false,
      'shadow_execution_allowed', false,
      'ai_use_allowed', false,
      'plan_selection_allowed', false,
      'activation_allowed', false,
      'global_candidate_status', 'REVIEW_ONLY',
      'status_lock', 'REQUIRES_HUMAN_REVIEW_NO_AUDIT_SHADOW_EXECUTION',
      'dosage_rule_result_hash', dosage_rule_result ->> 'result_hash',
      'dosage_rule_result_hash_matches', dosage_rule_hash_matches,
      'audit_envelope', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF dosage_rule_result ->> 'status' NOT IN (
       'DOSAGE_RULE_NO_ALLOW_CANDIDATES_INACTIVE',
       'DOSAGE_RULE_BINDINGS_READY_INACTIVE',
       'DOSAGE_RULE_PREFLIGHT_BLOCKED_INACTIVE'
     )
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_AUDIT_DOSAGE_PREFLIGHT_UNAVAILABLE',
      'interpretation', 'AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'audit_persistence_allowed', false,
      'replay_execution_allowed', false,
      'shadow_execution_allowed', false,
      'ai_use_allowed', false,
      'plan_selection_allowed', false,
      'activation_allowed', false,
      'dosage_rule_status', dosage_rule_result ->> 'status',
      'dosage_rule_result_hash', dosage_rule_result ->> 'result_hash',
      'audit_envelope', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF _expected_dosage_rule_result_hash IS NULL
     OR _expected_dosage_rule_result_hash !~ '^[0-9a-f]{64}$'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_AUDIT_EXPECTATION_INVALID',
      'interpretation', 'AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'audit_persistence_allowed', false,
      'replay_execution_allowed', false,
      'shadow_execution_allowed', false,
      'ai_use_allowed', false,
      'plan_selection_allowed', false,
      'activation_allowed', false,
      'audit_envelope', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF NOT dosage_rule_hash_matches
     OR dosage_rule_result ->> 'result_hash' IS DISTINCT FROM
        public.kb_release_manifest_hash_v1(dosage_rule_result - 'result_hash')
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_AUDIT_DOSAGE_RESULT_MISMATCH',
      'interpretation', 'AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'audit_persistence_allowed', false,
      'replay_execution_allowed', false,
      'shadow_execution_allowed', false,
      'ai_use_allowed', false,
      'plan_selection_allowed', false,
      'activation_allowed', false,
      'actual_dosage_rule_result_hash', dosage_rule_result ->> 'result_hash',
      'audit_envelope', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

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
  input_manifest := public.therapy_retrieval_v2_input_manifest_v1(
    _therapy_input_revision_id
  );

  IF candidate_status_result ->> 'status'
       IS DISTINCT FROM 'CANDIDATE_STATUS_PREFLIGHT_COMPLETE_INACTIVE'
     OR safety_gate_result ->> 'status'
       IS DISTINCT FROM 'SAFETY_GATE_PREFLIGHT_COMPLETE_INACTIVE'
     OR input_manifest IS NULL
     OR candidate_status_result ->> 'result_hash' IS DISTINCT FROM
        dosage_rule_result ->> 'candidate_status_result_hash'
     OR candidate_status_result ->> 'result_hash' IS DISTINCT FROM
        _expected_candidate_status_result_hash
     OR candidate_status_result ->> 'result_hash' IS DISTINCT FROM
        public.kb_release_manifest_hash_v1(
          candidate_status_result - 'result_hash'
        )
     OR safety_gate_result ->> 'result_hash' IS DISTINCT FROM
        candidate_status_result ->> 'safety_gate_result_hash'
     OR safety_gate_result ->> 'result_hash' IS DISTINCT FROM
        _expected_safety_gate_result_hash
     OR safety_gate_result ->> 'result_hash' IS DISTINCT FROM
        public.kb_release_manifest_hash_v1(safety_gate_result - 'result_hash')
     OR public.kb_release_manifest_hash_v1(input_manifest) IS DISTINCT FROM
        candidate_status_result ->> 'therapy_input_manifest_hash'
     OR candidate_status_result ->> 'release_manifest_hash' IS DISTINCT FROM
        _expected_release_manifest_hash
     OR jsonb_typeof(candidate_status_result #> '{general_track,candidates}')
        IS DISTINCT FROM 'array'
     OR jsonb_typeof(candidate_status_result #> '{homeopathic_track,candidates}')
        IS DISTINCT FROM 'array'
     OR jsonb_array_length(
          candidate_status_result #> '{general_track,candidates}'
        ) > 512
     OR jsonb_array_length(
          candidate_status_result #> '{homeopathic_track,candidates}'
        ) > 200
     OR candidate_status_result #>> '{general_track,track_result_hash}'
        IS DISTINCT FROM public.kb_release_manifest_hash_v1(
          (candidate_status_result -> 'general_track') - 'track_result_hash'
        )
     OR candidate_status_result #>> '{homeopathic_track,track_result_hash}'
        IS DISTINCT FROM public.kb_release_manifest_hash_v1(
          (candidate_status_result -> 'homeopathic_track') - 'track_result_hash'
        )
     OR jsonb_typeof(
          safety_gate_result #> '{safety_rule_assessments,subject_assessments}'
        ) IS DISTINCT FROM 'array'
     OR safety_gate_result ->> 'safety_rule_assessments_hash'
        IS DISTINCT FROM public.kb_release_manifest_hash_v1(
          safety_gate_result -> 'safety_rule_assessments'
        )
     OR jsonb_typeof(input_manifest -> 'selected_facts') IS DISTINCT FROM 'array'
     OR jsonb_array_length(input_manifest -> 'selected_facts') NOT BETWEEN 1 AND 2048
     OR jsonb_typeof(dosage_rule_result #> '{dosage_rule_scope,rules}')
        IS DISTINCT FROM 'array'
     OR jsonb_typeof(
          dosage_rule_result
            #> '{dosage_rule_assessments,candidate_assessments}'
        ) IS DISTINCT FROM 'array'
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_AUDIT_PROVENANCE_UNAVAILABLE',
      'interpretation', 'AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'audit_persistence_allowed', false,
      'replay_execution_allowed', false,
      'shadow_execution_allowed', false,
      'ai_use_allowed', false,
      'plan_selection_allowed', false,
      'activation_allowed', false,
      'dosage_rule_result_hash', dosage_rule_result ->> 'result_hash',
      'audit_envelope', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  SELECT count(*)::integer
    INTO fact_source_binding_count
    FROM (
      SELECT 1
        FROM jsonb_array_elements(input_manifest -> 'selected_facts') selected(value)
        JOIN public.therapy_input_fact_sources fact_source
          ON fact_source.therapy_input_revision_id = _therapy_input_revision_id
         AND fact_source.therapy_input_fact_id =
             (selected.value ->> 'fact_id')::uuid
       LIMIT 16385
    ) bounded;

  SELECT count(*)::integer
    INTO safety_source_binding_count
    FROM (
      SELECT 1
        FROM jsonb_array_elements(
          safety_gate_result #> '{safety_rule_assessments,subject_assessments}'
        ) subject(value)
        CROSS JOIN LATERAL jsonb_array_elements(subject.value -> 'rules') rule(value)
        JOIN public.kb_assertion_sources binding
          ON binding.assertion_id = (rule.value ->> 'assertion_id')::uuid
       LIMIT 16385
    ) bounded;

  IF fact_source_binding_count > 16384
     OR safety_source_binding_count > 16384
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_AUDIT_PROVENANCE_LIMIT_EXCEEDED',
      'interpretation', 'AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'audit_persistence_allowed', false,
      'replay_execution_allowed', false,
      'shadow_execution_allowed', false,
      'ai_use_allowed', false,
      'plan_selection_allowed', false,
      'activation_allowed', false,
      'dosage_rule_result_hash', dosage_rule_result ->> 'result_hash',
      'audit_envelope', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  SELECT count(*)::integer,
         COALESCE(jsonb_agg(jsonb_build_object(
           'therapy_input_fact_id', fact.id,
           'fact_order', fact.fact_order,
           'fact_type', fact.fact_type,
           'fact_key', fact.fact_key,
           'review_status', fact.review_status,
           'fact_content_sha256', fact.content_sha256,
           'kb_entity_id', fact.kb_entity_id,
           'supersedes_fact_id', fact.supersedes_fact_id,
           'sources', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'therapy_input_source_id', source.id,
               'source_order', source.source_order,
               'neutral_source_id', source.neutral_source_id,
               'source_type', source.source_type,
               'source_content_sha256', source.content_sha256,
               'source_locator_hash', public.kb_release_manifest_hash_v1(
                 to_jsonb(source.source_locator)
               ),
               'fact_locator_hash', public.kb_release_manifest_hash_v1(
                 to_jsonb(fact_source.fact_locator)
               ),
               'source_role', fact_source.source_role
             ) ORDER BY fact_source.link_order, source.source_order)
               FROM public.therapy_input_fact_sources fact_source
               JOIN public.therapy_input_sources source
                 ON source.therapy_input_revision_id =
                    fact_source.therapy_input_revision_id
                AND source.source_order = fact_source.source_order
              WHERE fact_source.therapy_input_revision_id =
                    _therapy_input_revision_id
                AND fact_source.therapy_input_fact_id = fact.id
           ), '[]'::jsonb)
         ) ORDER BY fact.fact_order, fact.id), '[]'::jsonb)
    INTO selected_fact_count, fact_provenance_rows
    FROM jsonb_array_elements(input_manifest -> 'selected_facts') selected(value)
    JOIN public.therapy_input_facts fact
      ON fact.therapy_input_revision_id = _therapy_input_revision_id
     AND fact.id = (selected.value ->> 'fact_id')::uuid
     AND fact.content_sha256 = selected.value ->> 'content_sha256';

  IF selected_fact_count IS DISTINCT FROM
       jsonb_array_length(input_manifest -> 'selected_facts')
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_AUDIT_PROVENANCE_UNAVAILABLE',
      'interpretation', 'AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'audit_persistence_allowed', false,
      'replay_execution_allowed', false,
      'shadow_execution_allowed', false,
      'ai_use_allowed', false,
      'plan_selection_allowed', false,
      'activation_allowed', false,
      'dosage_rule_result_hash', dosage_rule_result ->> 'result_hash',
      'audit_envelope', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  fact_provenance := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'therapy_input_revision_id', _therapy_input_revision_id,
    'therapy_input_manifest_hash', public.kb_release_manifest_hash_v1(
      input_manifest
    ),
    'selected_fact_count', selected_fact_count,
    'fact_source_binding_count', fact_source_binding_count,
    'raw_fact_values_present', false,
    'raw_source_locators_present', false,
    'facts', fact_provenance_rows
  ));
  fact_provenance := fact_provenance || jsonb_build_object(
    'fact_provenance_hash', public.kb_release_manifest_hash_v1(fact_provenance)
  );

  comparator_manifest := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'general_comparator_version', 'GENERAL_CANDIDATE_ORDER_V1',
    'general_ordering_dimensions',
      candidate_status_result #> '{general_track,ordering_dimensions}',
    'homeopathic_comparator_version',
      'HOMEOPATHIC_SOURCE_NATIVE_ORDER_V1',
    'homeopathic_ordering_dimensions',
      candidate_status_result #> '{homeopathic_track,ordering_dimensions}',
    'candidate_status_policy',
      candidate_status_result -> 'candidate_status_policy',
    'track_separation_policy',
      candidate_status_result -> 'track_separation_policy',
    'opaque_composite_score_used', false
  ));
  comparator_manifest := comparator_manifest || jsonb_build_object(
    'comparator_manifest_hash',
      public.kb_release_manifest_hash_v1(comparator_manifest)
  );

  candidate_decisions := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'general', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'track', 'GENERAL_OR_NATUROPATHIC_CANDIDATE_TRACK',
        'position', (candidate.value ->> 'position')::integer,
        'candidate_status', candidate.value ->> 'candidate_status',
        'status_lock', candidate.value ->> 'status_lock',
        'status_reasons', candidate.value -> 'status_reasons',
        'entity_id', candidate.value ->> 'entity_id',
        'entity_revision_id', candidate.value ->> 'entity_revision_id',
        'entity_type_code', candidate.value ->> 'entity_type_code',
        'entity_content_hash', candidate.value ->> 'entity_content_hash',
        'dimensions', candidate.value -> 'dimensions',
        'reference_provenance', candidate.value -> 'reference_provenance',
        'evidence_assertions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'assertion_id', evidence.value ->> 'assertion_id',
            'assertion_content_hash',
              evidence.value ->> 'assertion_content_hash'
          ) ORDER BY evidence.value ->> 'assertion_id')
            FROM jsonb_array_elements(
              candidate.value -> 'evidence_details'
            ) evidence(value)
        ), '[]'::jsonb),
        'candidate_payload_hash', public.kb_release_manifest_hash_v1(
          candidate.value
        )
      ) ORDER BY (candidate.value ->> 'position')::integer)
        FROM jsonb_array_elements(
          candidate_status_result #> '{general_track,candidates}'
        ) candidate(value)
    ), '[]'::jsonb),
    'homeopathic', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'track', 'HOMEOPATHIC_SOURCE_NATIVE_CANDIDATE_TRACK',
        'position', (candidate.value ->> 'position')::integer,
        'candidate_status', candidate.value ->> 'candidate_status',
        'status_lock', candidate.value ->> 'status_lock',
        'status_reasons', candidate.value -> 'status_reasons',
        'remedy_entity_id', candidate.value ->> 'remedy_entity_id',
        'remedy_revision_id', candidate.value ->> 'remedy_revision_id',
        'repertory_remedy_id', candidate.value ->> 'repertory_remedy_id',
        'remedy_content_hash', candidate.value ->> 'remedy_content_hash',
        'dimensions', candidate.value -> 'dimensions',
        'candidate_payload_hash', public.kb_release_manifest_hash_v1(
          candidate.value
        )
      ) ORDER BY (candidate.value ->> 'position')::integer)
        FROM jsonb_array_elements(
          candidate_status_result #> '{homeopathic_track,candidates}'
        ) candidate(value)
    ), '[]'::jsonb),
    'general_track_result_hash',
      candidate_status_result #>> '{general_track,track_result_hash}',
    'homeopathic_track_result_hash',
      candidate_status_result #>> '{homeopathic_track,track_result_hash}'
  ));
  candidate_decisions := candidate_decisions || jsonb_build_object(
    'candidate_decisions_hash',
      public.kb_release_manifest_hash_v1(candidate_decisions)
  );

  safety_decisions := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'safety_gate_result_hash', safety_gate_result ->> 'result_hash',
    'safety_input_manifest_hash',
      safety_gate_result ->> 'safety_input_manifest_hash',
    'safety_rule_assessments_hash',
      safety_gate_result ->> 'safety_rule_assessments_hash',
    'safety_disposition', safety_gate_result ->> 'safety_disposition',
    'subjects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'subject_entity_id', subject.value ->> 'subject_entity_id',
        'subject_entity_revision_id',
          subject.value ->> 'subject_entity_revision_id',
        'safety_effect', subject.value ->> 'safety_effect',
        'rules', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'safety_rule_id', rule.value ->> 'safety_rule_id',
            'assertion_id', rule.value ->> 'assertion_id',
            'rule_content_hash', rule.value ->> 'rule_content_hash',
            'rule_type', rule.value ->> 'rule_type',
            'severity', rule.value ->> 'severity',
            'effect', rule.value ->> 'effect',
            'assessment_status', rule.value ->> 'assessment_status',
            'conditions', rule.value -> 'conditions',
            'rule_payload_hash', public.kb_release_manifest_hash_v1(
              rule.value
            )
          ) ORDER BY rule.value ->> 'safety_rule_id')
            FROM jsonb_array_elements(subject.value -> 'rules') rule(value)
        ), '[]'::jsonb)
      ) ORDER BY
        subject.value ->> 'subject_entity_id',
        subject.value ->> 'subject_entity_revision_id')
        FROM jsonb_array_elements(
          safety_gate_result #> '{safety_rule_assessments,subject_assessments}'
        ) subject(value)
    ), '[]'::jsonb)
  ));
  safety_decisions := safety_decisions || jsonb_build_object(
    'safety_decisions_hash', public.kb_release_manifest_hash_v1(
      safety_decisions
    )
  );

  dosage_decisions := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'dosage_rule_result_status', dosage_rule_result ->> 'status',
    'dosage_rule_result_hash', dosage_rule_result ->> 'result_hash',
    'dosage_rule_scope_hash', dosage_rule_result ->> 'dosage_rule_scope_hash',
    'dosage_rule_assessments_hash',
      dosage_rule_result ->> 'dosage_rule_assessments_hash',
    'concrete_dosage_output_present', false,
    'rules', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'dosage_rule_id', rule.value ->> 'dosage_rule_id',
        'dosage_rule_content_hash',
          rule.value ->> 'dosage_rule_content_hash',
        'assertion_id', rule.value ->> 'assertion_id',
        'assertion_content_hash', rule.value ->> 'assertion_content_hash',
        'subject_entity_id', rule.value ->> 'subject_entity_id',
        'subject_entity_revision_id',
          rule.value ->> 'subject_entity_revision_id',
        'indication_entity_id', rule.value ->> 'indication_entity_id',
        'indication_entity_revision_id',
          rule.value ->> 'indication_entity_revision_id',
        'population_entity_id', rule.value ->> 'population_entity_id',
        'population_entity_revision_id',
          rule.value ->> 'population_entity_revision_id'
      ) ORDER BY
        rule.value ->> 'subject_entity_id',
        rule.value ->> 'subject_entity_revision_id',
        rule.value ->> 'dosage_rule_id')
        FROM jsonb_array_elements(
          dosage_rule_result #> '{dosage_rule_scope,rules}'
        ) rule(value)
    ), '[]'::jsonb),
    'candidate_assessments',
      dosage_rule_result
        #> '{dosage_rule_assessments,candidate_assessments}'
  ));
  dosage_decisions := dosage_decisions || jsonb_build_object(
    'dosage_decisions_hash', public.kb_release_manifest_hash_v1(
      dosage_decisions
    )
  );

  WITH source_rows AS (
    SELECT
      'candidate_evidence'::text AS usage,
      candidate.value ->> 'entity_id' AS subject_entity_id,
      candidate.value ->> 'entity_revision_id' AS subject_entity_revision_id,
      NULL::text AS rule_id,
      evidence.value ->> 'assertion_id' AS assertion_id,
      source.value ->> 'source_id' AS source_id,
      source.value ->> 'source_revision_id' AS source_revision_id,
      source.value ->> 'source_content_hash' AS source_content_hash,
      source.value ->> 'source_role' AS source_role,
      public.kb_release_manifest_hash_v1(
        to_jsonb(source.value ->> 'locator')
      ) AS locator_hash,
      (source.value ->> 'is_primary')::boolean AS is_primary
      FROM jsonb_array_elements(
        candidate_status_result #> '{general_track,candidates}'
      ) candidate(value)
      CROSS JOIN LATERAL jsonb_array_elements(
        candidate.value -> 'evidence_details'
      ) evidence(value)
      CROSS JOIN LATERAL jsonb_array_elements(
        evidence.value -> 'sources'
      ) source(value)
    UNION ALL
    SELECT
      'safety_rule'::text,
      subject.value ->> 'subject_entity_id',
      subject.value ->> 'subject_entity_revision_id',
      rule.value ->> 'safety_rule_id',
      rule.value ->> 'assertion_id',
      source_revision.source_id::text,
      source_revision.id::text,
      source_revision.content_hash,
      binding.source_role,
      public.kb_release_manifest_hash_v1(to_jsonb(binding.locator)),
      binding.is_primary
      FROM jsonb_array_elements(
        safety_gate_result #> '{safety_rule_assessments,subject_assessments}'
      ) subject(value)
      CROSS JOIN LATERAL jsonb_array_elements(subject.value -> 'rules') rule(value)
      JOIN public.kb_assertion_sources binding
        ON binding.assertion_id = (rule.value ->> 'assertion_id')::uuid
      JOIN public.kb_source_revisions source_revision
        ON source_revision.id = binding.source_revision_id
      JOIN public.kb_release_items source_item
        ON source_item.release_id = _knowledge_release_id
       AND source_item.item_kind = 'source_revision'
       AND source_item.source_id = source_revision.source_id
       AND source_item.source_revision_id = source_revision.id
    UNION ALL
    SELECT
      'dosage_rule'::text,
      rule.value ->> 'subject_entity_id',
      rule.value ->> 'subject_entity_revision_id',
      rule.value ->> 'dosage_rule_id',
      rule.value ->> 'assertion_id',
      source.value ->> 'source_id',
      source.value ->> 'source_revision_id',
      source.value ->> 'source_content_hash',
      source.value ->> 'source_role',
      source.value ->> 'locator_hash',
      (source.value ->> 'is_primary')::boolean
      FROM jsonb_array_elements(
        dosage_rule_result #> '{dosage_rule_scope,rules}'
      ) rule(value)
      CROSS JOIN LATERAL jsonb_array_elements(rule.value -> 'sources') source(value)
  )
  SELECT count(*)::integer,
         COALESCE(jsonb_agg(jsonb_build_object(
           'usage', source.usage,
           'subject_entity_id', source.subject_entity_id,
           'subject_entity_revision_id', source.subject_entity_revision_id,
           'rule_id', source.rule_id,
           'assertion_id', source.assertion_id,
           'source_id', source.source_id,
           'source_revision_id', source.source_revision_id,
           'source_content_hash', source.source_content_hash,
           'source_role', source.source_role,
           'locator_hash', source.locator_hash,
           'is_primary', source.is_primary
         ) ORDER BY
           source.usage COLLATE "C",
           COALESCE(source.subject_entity_id, '') COLLATE "C",
           COALESCE(source.rule_id, '') COLLATE "C",
           source.assertion_id COLLATE "C",
           source.source_revision_id COLLATE "C",
           source.source_role COLLATE "C",
           source.locator_hash COLLATE "C"), '[]'::jsonb)
    INTO knowledge_source_binding_count, knowledge_source_provenance
    FROM source_rows source;

  IF knowledge_source_binding_count > 32768 THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_AUDIT_PROVENANCE_LIMIT_EXCEEDED',
      'interpretation', 'AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'audit_persistence_allowed', false,
      'replay_execution_allowed', false,
      'shadow_execution_allowed', false,
      'ai_use_allowed', false,
      'plan_selection_allowed', false,
      'activation_allowed', false,
      'dosage_rule_result_hash', dosage_rule_result ->> 'result_hash',
      'audit_envelope', NULL
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  audit_envelope := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'audit_envelope_version', 1,
    'data_classification', 'pseudonymized_health_data',
    'contract_versions', jsonb_build_object(
      'input_manifest', 'therapy_retrieval_v2_input_manifest_v1',
      'release_manifest', 'kb_release_manifest_v1',
      'split_track', 'therapy_retrieval_v2_split_track_preflight_v1',
      'safety_gate', 'therapy_retrieval_v2_safety_gate_preflight_v1',
      'candidate_status', 'therapy_retrieval_v2_candidate_status_preflight_v1',
      'dosage_rule', 'therapy_retrieval_v2_dosage_rule_preflight_v1',
      'audit_envelope', 'therapy_retrieval_v2_audit_envelope_preflight_v1'
    ),
    'stage_identifiers', jsonb_build_object(
      'therapy_input_revision_id', _therapy_input_revision_id,
      'knowledge_release_id', _knowledge_release_id,
      'repertory_entity_id', _repertory_entity_id,
      'repertory_revision_id', _repertory_revision_id
    ),
    'stage_hashes', jsonb_build_object(
      'therapy_input_manifest_hash',
        candidate_status_result ->> 'therapy_input_manifest_hash',
      'release_manifest_hash', candidate_status_result ->> 'release_manifest_hash',
      'binding_hash', candidate_status_result ->> 'binding_hash',
      'homeopathic_request_hash', _expected_homeopathic_request_hash,
      'split_track_result_hash', candidate_status_result ->> 'split_track_result_hash',
      'safety_gate_result_hash', safety_gate_result ->> 'result_hash',
      'candidate_status_result_hash', candidate_status_result ->> 'result_hash',
      'dosage_rule_result_hash', dosage_rule_result ->> 'result_hash'
    ),
    'fact_provenance', fact_provenance,
    'comparator_manifest', comparator_manifest,
    'candidate_decisions', candidate_decisions,
    'safety_decisions', safety_decisions,
    'dosage_decisions', dosage_decisions,
    'knowledge_source_binding_count', knowledge_source_binding_count,
    'knowledge_source_provenance', knowledge_source_provenance,
    'raw_source_locators_present', false,
    'concrete_dosage_output_present', false,
    'ai_provenance', jsonb_build_object(
      'execution_present', false,
      'model', NULL,
      'prompt_hash', NULL,
      'raw_output_hash', NULL,
      'validated_output_hash', NULL
    ),
    'plan_selection_provenance', jsonb_build_object(
      'selection_present', false,
      'selected_position_count', 0,
      'selected_positions', jsonb_build_array()
    )
  ));
  audit_envelope := audit_envelope || jsonb_build_object(
    'audit_envelope_hash', public.kb_release_manifest_hash_v1(audit_envelope)
  );

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY',
    'status', 'RETRIEVAL_AUDIT_ENVELOPE_READY_INACTIVE',
    'interpretation', 'AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE',
    'medical_use_allowed', false,
    'productive_candidate_use_allowed', false,
    'dosage_evaluation_allowed', false,
    'dosage_display_allowed', false,
    'audit_persistence_allowed', false,
    'replay_execution_allowed', false,
    'shadow_execution_allowed', false,
    'ai_use_allowed', false,
    'plan_selection_allowed', false,
    'activation_allowed', false,
    'inactive_audit_envelope_ready', true,
    'dosage_rule_result_status', dosage_rule_result ->> 'status',
    'dosage_rule_result_hash', dosage_rule_result ->> 'result_hash',
    'dosage_rule_result_hash_matches', dosage_rule_hash_matches,
    'audit_envelope_hash', audit_envelope ->> 'audit_envelope_hash',
    'audit_envelope', audit_envelope
  ));

  IF octet_length(result_payload::text) > 8388608 THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY',
      'status', 'RETRIEVAL_AUDIT_RESULT_LIMIT_EXCEEDED',
      'interpretation', 'AUDIT_PREFLIGHT_ONLY_NO_PERSISTENCE_SHADOW_OR_MEDICAL_USE',
      'medical_use_allowed', false,
      'productive_candidate_use_allowed', false,
      'dosage_evaluation_allowed', false,
      'dosage_display_allowed', false,
      'audit_persistence_allowed', false,
      'replay_execution_allowed', false,
      'shadow_execution_allowed', false,
      'ai_use_allowed', false,
      'plan_selection_allowed', false,
      'activation_allowed', false,
      'dosage_rule_result_hash', dosage_rule_result ->> 'result_hash',
      'audit_envelope_hash', audit_envelope ->> 'audit_envelope_hash',
      'audit_envelope', NULL
    ));
  END IF;

  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

COMMENT ON FUNCTION public.therapy_retrieval_v2_audit_envelope_preflight_v1(
  uuid, text, uuid, text, uuid, uuid, jsonb, text, text, text, text, text,
  integer, integer, integer
) IS
  'Step 7A owner-only inactive retrieval audit-envelope preflight. It binds the exact Step 6F result, deterministic comparator, fact, rule, candidate and hashed source provenance without persistence, shadow execution, AI output, plan selection, dosage display, activation or medical use.';

REVOKE ALL ON FUNCTION
  public.therapy_retrieval_v2_audit_envelope_preflight_v1(
    uuid, text, uuid, text, uuid, uuid, jsonb, text, text, text, text, text,
    integer, integer, integer
  )
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMIT;
