BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regclass('public.therapy_retrieval_audit_runs') IS NULL
     OR to_regprocedure(
       'public.therapy_retrieval_v2_persist_audit_envelope_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,text,text,text,uuid,integer,integer,integer)'
     ) IS NULL
     OR to_regprocedure(
       'public.therapy_retrieval_v2_audit_run_is_valid_v1(uuid)'
     ) IS NULL
     OR to_regprocedure(
       'public.therapy_retrieval_v2_invalid_audit_run_count_v1()'
     ) IS NULL
     OR to_regprocedure('public.therapy_input_export_snapshot_v3()') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Audit retention and restore preflight requires the complete Step 7B contract';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 67 THEN
    RAISE EXCEPTION 'Audit retention and restore preflight requires the exact 67-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Audit retention and restore preflight cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_audit_retention_restore_preflight_v1(
  _max_audit_runs integer DEFAULT 10000,
  _max_audit_bytes bigint DEFAULT 67108864
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
SET timezone = 'UTC'
AS $$
DECLARE
  audit_run_count bigint := 0;
  audit_payload_bytes bigint;
  invalid_audit_run_count bigint;
  snapshot jsonb;
  snapshot_version integer;
  snapshot_table_count integer;
  snapshot_manifest_hash text;
  audit_inventory_hash text;
  snapshot_contract_valid boolean := false;
  append_only_contract_valid boolean := false;
  restore_fk_contract_valid boolean := false;
  access_contract_valid boolean := false;
  result_status text;
  result_payload jsonb;
BEGIN
  SELECT count(*)
    INTO audit_run_count
    FROM public.therapy_retrieval_audit_runs;

  IF _max_audit_runs IS NOT NULL
     AND _max_audit_runs BETWEEN 0 AND 100000
     AND _max_audit_bytes IS NOT NULL
     AND _max_audit_bytes BETWEEN 0 AND 1073741824
     AND audit_run_count <= _max_audit_runs
  THEN
    SELECT COALESCE(sum(
             octet_length(to_jsonb(run)::text)::bigint
           ), 0)
      INTO audit_payload_bytes
      FROM public.therapy_retrieval_audit_runs run;
  END IF;

  IF _max_audit_runs IS NULL
     OR _max_audit_runs < 0
     OR _max_audit_runs > 100000
     OR _max_audit_bytes IS NULL
     OR _max_audit_bytes < 0
     OR _max_audit_bytes > 1073741824
  THEN
    result_status := 'AUDIT_RETENTION_RESTORE_EXPECTATION_INVALID';
  ELSIF audit_run_count > _max_audit_runs THEN
    result_status := 'AUDIT_RETENTION_RESTORE_LIMIT_EXCEEDED';
  ELSIF audit_payload_bytes > _max_audit_bytes THEN
    result_status := 'AUDIT_RETENTION_RESTORE_BYTE_LIMIT_EXCEEDED';
  ELSE
    invalid_audit_run_count :=
      public.therapy_retrieval_v2_invalid_audit_run_count_v1();

    SELECT count(*) = 4
           AND bool_and(trigger_row.tgenabled = 'O')
           AND array_agg(trigger_row.tgname ORDER BY trigger_row.tgname) = ARRAY[
             'therapy_retrieval_audit_runs_append_only',
             'therapy_retrieval_audit_runs_gate_insert',
             'therapy_retrieval_audit_runs_no_truncate',
             'therapy_retrieval_audit_runs_validate_insert'
           ]::name[]
      INTO append_only_contract_valid
      FROM pg_trigger trigger_row
     WHERE trigger_row.tgrelid = 'public.therapy_retrieval_audit_runs'::regclass
       AND NOT trigger_row.tgisinternal;

    SELECT count(*) = 3
           AND bool_and(constraint_row.convalidated)
           AND bool_and(constraint_row.condeferrable)
           AND bool_and(constraint_row.confdeltype = 'a')
           AND bool_and(constraint_row.confrelid IN (
             'public.therapy_input_revisions'::regclass,
             'public.kb_releases'::regclass,
             'public.kb_entity_revisions'::regclass
           ))
           AND count(*) FILTER (
             WHERE constraint_row.confrelid =
               'public.therapy_input_revisions'::regclass
           ) = 1
           AND count(*) FILTER (
             WHERE constraint_row.confrelid = 'public.kb_releases'::regclass
           ) = 1
           AND count(*) FILTER (
             WHERE constraint_row.confrelid =
               'public.kb_entity_revisions'::regclass
           ) = 1
      INTO restore_fk_contract_valid
      FROM pg_constraint constraint_row
     WHERE constraint_row.conrelid =
             'public.therapy_retrieval_audit_runs'::regclass
       AND constraint_row.contype = 'f';

    SELECT COALESCE(table_row.relrowsecurity, false)
           AND (
             SELECT count(*) = 1
               FROM pg_policies policy_row
              WHERE policy_row.schemaname = 'public'
                AND policy_row.tablename = 'therapy_retrieval_audit_runs'
                AND policy_row.policyname =
                      'therapy_retrieval_audit_runs_admin_read'
                AND policy_row.cmd = 'SELECT'
                AND policy_row.roles = ARRAY['authenticated']::name[]
                AND policy_row.qual LIKE '%has_role%'
           )
           AND NOT has_table_privilege(
             'anon', 'public.therapy_retrieval_audit_runs', 'SELECT'
           )
           AND has_table_privilege(
             'authenticated', 'public.therapy_retrieval_audit_runs', 'SELECT'
           )
           AND has_table_privilege(
             'service_role', 'public.therapy_retrieval_audit_runs', 'SELECT'
           )
           AND NOT has_table_privilege(
             'kb_importer', 'public.therapy_retrieval_audit_runs', 'SELECT'
           )
           AND NOT has_table_privilege(
             'kb_import_runtime',
             'public.therapy_retrieval_audit_runs',
             'SELECT'
           )
           AND NOT has_table_privilege(
             'anon', 'public.therapy_retrieval_audit_runs', 'INSERT'
           )
           AND NOT has_table_privilege(
             'authenticated', 'public.therapy_retrieval_audit_runs', 'INSERT'
           )
           AND NOT has_table_privilege(
             'service_role', 'public.therapy_retrieval_audit_runs', 'INSERT'
           )
           AND NOT has_table_privilege(
             'kb_importer', 'public.therapy_retrieval_audit_runs', 'INSERT'
           )
           AND NOT has_table_privilege(
             'kb_import_runtime',
             'public.therapy_retrieval_audit_runs',
             'INSERT'
           )
           AND NOT has_table_privilege(
             'authenticated', 'public.therapy_retrieval_audit_runs', 'UPDATE'
           )
           AND NOT has_table_privilege(
             'service_role', 'public.therapy_retrieval_audit_runs', 'UPDATE'
           )
           AND NOT has_table_privilege(
             'anon', 'public.therapy_retrieval_audit_runs', 'UPDATE'
           )
           AND NOT has_table_privilege(
             'kb_importer', 'public.therapy_retrieval_audit_runs', 'UPDATE'
           )
           AND NOT has_table_privilege(
             'kb_import_runtime',
             'public.therapy_retrieval_audit_runs',
             'UPDATE'
           )
           AND NOT has_table_privilege(
             'authenticated', 'public.therapy_retrieval_audit_runs', 'DELETE'
           )
           AND NOT has_table_privilege(
             'service_role', 'public.therapy_retrieval_audit_runs', 'DELETE'
           )
           AND NOT has_table_privilege(
             'anon', 'public.therapy_retrieval_audit_runs', 'DELETE'
           )
           AND NOT has_table_privilege(
             'kb_importer', 'public.therapy_retrieval_audit_runs', 'DELETE'
           )
           AND NOT has_table_privilege(
             'kb_import_runtime',
             'public.therapy_retrieval_audit_runs',
             'DELETE'
           )
           AND has_function_privilege(
             'service_role',
             'public.therapy_input_export_snapshot_v3()',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'anon',
             'public.therapy_input_export_snapshot_v3()',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'authenticated',
             'public.therapy_input_export_snapshot_v3()',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'kb_importer',
             'public.therapy_input_export_snapshot_v3()',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'kb_import_runtime',
             'public.therapy_input_export_snapshot_v3()',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'anon',
             'public.therapy_retrieval_v2_persist_audit_envelope_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,text,text,text,uuid,integer,integer,integer)',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'authenticated',
             'public.therapy_retrieval_v2_persist_audit_envelope_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,text,text,text,uuid,integer,integer,integer)',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'service_role',
             'public.therapy_retrieval_v2_persist_audit_envelope_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,text,text,text,uuid,integer,integer,integer)',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'kb_importer',
             'public.therapy_retrieval_v2_persist_audit_envelope_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,text,text,text,uuid,integer,integer,integer)',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'kb_import_runtime',
             'public.therapy_retrieval_v2_persist_audit_envelope_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,text,text,text,uuid,integer,integer,integer)',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'anon',
             'public.therapy_retrieval_v2_audit_retention_restore_preflight_v1(integer,bigint)',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'authenticated',
             'public.therapy_retrieval_v2_audit_retention_restore_preflight_v1(integer,bigint)',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'service_role',
             'public.therapy_retrieval_v2_audit_retention_restore_preflight_v1(integer,bigint)',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'kb_importer',
             'public.therapy_retrieval_v2_audit_retention_restore_preflight_v1(integer,bigint)',
             'EXECUTE'
           )
           AND NOT has_function_privilege(
             'kb_import_runtime',
             'public.therapy_retrieval_v2_audit_retention_restore_preflight_v1(integer,bigint)',
             'EXECUTE'
           )
      INTO access_contract_valid
      FROM pg_class table_row
     WHERE table_row.oid = 'public.therapy_retrieval_audit_runs'::regclass;

    BEGIN
      snapshot := public.therapy_input_export_snapshot_v3()::jsonb;
      snapshot_version := (snapshot ->> 'snapshot_version')::integer;
      SELECT count(*)::integer
        INTO snapshot_table_count
        FROM jsonb_object_keys(snapshot -> 'tables');
      snapshot_manifest_hash := public.kb_release_manifest_hash_v1(
        snapshot -> 'manifest'
      );
      audit_inventory_hash := snapshot #>>
        '{manifest,therapy_retrieval_audit_runs,sha256}';

      SELECT snapshot_version = 3
             AND jsonb_typeof(snapshot -> 'tables') = 'object'
             AND snapshot_table_count = 5
             AND snapshot -> 'tables' ?& ARRAY[
               'therapy_input_revisions',
               'therapy_input_sources',
               'therapy_input_facts',
               'therapy_input_fact_sources',
               'therapy_retrieval_audit_runs'
             ]
             AND jsonb_typeof(snapshot -> 'manifest') = 'object'
             AND (
               SELECT count(*) = 5
                 FROM jsonb_object_keys(snapshot -> 'manifest')
             )
             AND snapshot -> 'manifest' ?& ARRAY[
               'therapy_input_revisions',
               'therapy_input_sources',
               'therapy_input_facts',
               'therapy_input_fact_sources',
               'therapy_retrieval_audit_runs'
             ]
             AND jsonb_typeof(snapshot -> 'validation') = 'object'
             AND (
               SELECT count(*) = 3
                 FROM jsonb_object_keys(snapshot -> 'validation')
             )
             AND snapshot -> 'validation' ?& ARRAY[
               'invalid_revision_count',
               'invalid_fact_count',
               'invalid_audit_run_count'
             ]
             AND (snapshot #>> '{validation,invalid_revision_count}')::bigint = 0
             AND (snapshot #>> '{validation,invalid_fact_count}')::bigint = 0
             AND (snapshot #>> '{validation,invalid_audit_run_count}')::bigint = 0
             AND (
               snapshot #>>
                 '{manifest,therapy_retrieval_audit_runs,rows}'
             )::bigint = audit_run_count
             AND audit_inventory_hash ~ '^[0-9a-f]{64}$'
             AND audit_inventory_hash = encode(
               sha256(convert_to(
                 snapshot #>> '{tables,therapy_retrieval_audit_runs}',
                 'UTF8'
               )),
               'hex'
             )
             AND (
               SELECT count(*) = 5
                      AND bool_and(
                        jsonb_typeof(table_entry.value::jsonb) = 'array'
                        AND jsonb_array_length(table_entry.value::jsonb) = (
                          snapshot -> 'manifest' -> table_entry.key ->> 'rows'
                        )::integer
                        AND (
                          snapshot -> 'manifest' -> table_entry.key ->> 'sha256'
                        ) ~ '^[0-9a-f]{64}$'
                        AND (
                          snapshot -> 'manifest' -> table_entry.key ->> 'sha256'
                        ) = encode(
                          sha256(convert_to(table_entry.value, 'UTF8')),
                          'hex'
                        )
                      )
                 FROM jsonb_each_text(snapshot -> 'tables') table_entry
             )
        INTO snapshot_contract_valid;
    EXCEPTION
      WHEN OTHERS THEN
        snapshot_contract_valid := false;
    END;

    result_status := CASE
      WHEN invalid_audit_run_count <> 0
        THEN 'AUDIT_RETENTION_RESTORE_INTEGRITY_BLOCKED'
      WHEN append_only_contract_valid IS DISTINCT FROM true
        OR restore_fk_contract_valid IS DISTINCT FROM true
        OR access_contract_valid IS DISTINCT FROM true
        OR snapshot_contract_valid IS DISTINCT FROM true
        THEN 'AUDIT_RETENTION_RESTORE_TECHNICAL_CONTRACT_BLOCKED'
      ELSE 'AUDIT_RETENTION_RESTORE_TECHNICAL_PREFLIGHT_READY_INACTIVE'
    END;
  END IF;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope',
      'THERAPY_RETRIEVAL_V2_AUDIT_RETENTION_RESTORE_PREFLIGHT_ONLY',
    'status', result_status,
    'interpretation',
      'TECHNICAL_GOVERNANCE_PREFLIGHT_ONLY_NO_RETENTION_APPROVAL_DELETE_REPLAY_SHADOW_OR_MEDICAL_USE',
    'data_classification', 'pseudonymized_health_data',
    'audit_run_count', audit_run_count,
    'max_audit_runs', _max_audit_runs,
    'audit_payload_bytes', audit_payload_bytes,
    'max_audit_bytes', _max_audit_bytes,
    'invalid_audit_run_count', invalid_audit_run_count,
    'snapshot_version', snapshot_version,
    'snapshot_table_count', snapshot_table_count,
    'snapshot_manifest_hash', snapshot_manifest_hash,
    'audit_inventory_hash', audit_inventory_hash,
    'snapshot_contract_valid', snapshot_contract_valid,
    'append_only_contract_valid', append_only_contract_valid,
    'restore_fk_contract_valid', restore_fk_contract_valid,
    'access_contract_valid', access_contract_valid,
    'retention_policy_status',
      'UNAPPROVED_REQUIRES_OWNER_LEGAL_DECISION',
    'retention_start_basis', null,
    'retention_period_years', null,
    'retention_policy_approved', false,
    'retention_deletion_allowed', false,
    'technical_readiness_complete',
      result_status =
        'AUDIT_RETENTION_RESTORE_TECHNICAL_PREFLIGHT_READY_INACTIVE',
    'operational_restore_drill_completed', false,
    'real_postgres_validation_completed', false,
    'medical_use_allowed', false,
    'productive_candidate_use_allowed', false,
    'dosage_evaluation_allowed', false,
    'dosage_display_allowed', false,
    'audit_persistence_allowed', false,
    'replay_execution_allowed', false,
    'shadow_execution_allowed', false,
    'ai_use_allowed', false,
    'plan_selection_allowed', false,
    'activation_allowed', false
  ));
  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.therapy_retrieval_v2_audit_retention_restore_preflight_v1(integer, bigint)
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMENT ON FUNCTION
  public.therapy_retrieval_v2_audit_retention_restore_preflight_v1(integer, bigint)
IS
  'Step 7C owner-only bounded technical audit-retention and restore-readiness preflight. It approves no retention policy or deletion and enables no replay, shadow, AI, plan selection, dosage display, activation or medical use.';

COMMIT;
