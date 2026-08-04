BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure(
       'public.therapy_retrieval_v2_audit_envelope_preflight_v1(uuid,text,uuid,text,uuid,uuid,jsonb,text,text,text,text,text,integer,integer,integer)'
     ) IS NULL
     OR to_regprocedure('public.therapy_input_export_snapshot_v2()') IS NULL
     OR to_regprocedure('public.therapy_input_revision_is_valid_v1(uuid)') IS NULL
     OR to_regprocedure('public.therapy_input_timestamptz_utc_microseconds_v1(timestamptz)') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Retrieval audit persistence requires the complete Step 7A contract';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 67 THEN
    RAISE EXCEPTION 'Retrieval audit persistence requires the exact 67-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Retrieval audit persistence cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE TABLE public.therapy_retrieval_audit_runs (
  id uuid PRIMARY KEY,
  contract_version integer NOT NULL DEFAULT 1
    CHECK (contract_version = 1),
  data_classification text NOT NULL DEFAULT 'pseudonymized_health_data'
    CHECK (data_classification = 'pseudonymized_health_data'),
  persistence_status text NOT NULL DEFAULT 'RETRIEVAL_AUDIT_PERSISTED_INACTIVE'
    CHECK (persistence_status = 'RETRIEVAL_AUDIT_PERSISTED_INACTIVE'),
  therapy_input_revision_id uuid NOT NULL,
  knowledge_release_id uuid NOT NULL,
  repertory_entity_id uuid NOT NULL,
  repertory_revision_id uuid NOT NULL,
  audit_result jsonb NOT NULL
    CHECK (
      jsonb_typeof(audit_result) = 'object'
      AND octet_length(audit_result::text) <= 8388608
    ),
  audit_result_hash text NOT NULL
    CHECK (audit_result_hash ~ '^[0-9a-f]{64}$'),
  audit_envelope_hash text NOT NULL
    CHECK (audit_envelope_hash ~ '^[0-9a-f]{64}$'),
  dosage_rule_result_hash text NOT NULL
    CHECK (dosage_rule_result_hash ~ '^[0-9a-f]{64}$'),
  persisted_at timestamptz NOT NULL,
  persisted_by uuid NOT NULL,
  row_hash text NOT NULL CHECK (row_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT therapy_retrieval_audit_runs_result_key
    UNIQUE (audit_result_hash),
  CONSTRAINT therapy_retrieval_audit_runs_input_fk
    FOREIGN KEY (therapy_input_revision_id)
    REFERENCES public.therapy_input_revisions(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT therapy_retrieval_audit_runs_release_fk
    FOREIGN KEY (knowledge_release_id)
    REFERENCES public.kb_releases(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT therapy_retrieval_audit_runs_repertory_revision_fk
    FOREIGN KEY (repertory_entity_id, repertory_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX therapy_retrieval_audit_runs_input_idx
  ON public.therapy_retrieval_audit_runs(
    therapy_input_revision_id,
    persisted_at,
    id
  );

CREATE INDEX therapy_retrieval_audit_runs_release_idx
  ON public.therapy_retrieval_audit_runs(
    knowledge_release_id,
    persisted_at,
    id
  );

CREATE FUNCTION public.therapy_retrieval_v2_audit_run_row_hash_v1(
  _id uuid,
  _therapy_input_revision_id uuid,
  _knowledge_release_id uuid,
  _repertory_entity_id uuid,
  _repertory_revision_id uuid,
  _audit_result jsonb,
  _audit_result_hash text,
  _audit_envelope_hash text,
  _dosage_rule_result_hash text,
  _persisted_at timestamptz,
  _persisted_by uuid
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(jsonb_build_object(
    'id', _id,
    'contract_version', 1,
    'data_classification', 'pseudonymized_health_data',
    'persistence_status', 'RETRIEVAL_AUDIT_PERSISTED_INACTIVE',
    'therapy_input_revision_id', _therapy_input_revision_id,
    'knowledge_release_id', _knowledge_release_id,
    'repertory_entity_id', _repertory_entity_id,
    'repertory_revision_id', _repertory_revision_id,
    'audit_result', _audit_result,
    'audit_result_hash', _audit_result_hash,
    'audit_envelope_hash', _audit_envelope_hash,
    'dosage_rule_result_hash', _dosage_rule_result_hash,
    'persisted_at', public.therapy_input_timestamptz_utc_microseconds_v1(
      _persisted_at
    ),
    'persisted_by', _persisted_by
  ))
$$;

CREATE FUNCTION public.therapy_retrieval_v2_audit_run_is_valid_v1(
  _audit_run_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  audit_run public.therapy_retrieval_audit_runs%ROWTYPE;
  audit_envelope jsonb;
BEGIN
  SELECT run.*
    INTO audit_run
    FROM public.therapy_retrieval_audit_runs run
   WHERE run.id = _audit_run_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  audit_envelope := audit_run.audit_result -> 'audit_envelope';
  RETURN
    audit_run.contract_version = 1
    AND audit_run.data_classification = 'pseudonymized_health_data'
    AND audit_run.persistence_status = 'RETRIEVAL_AUDIT_PERSISTED_INACTIVE'
    AND jsonb_typeof(audit_run.audit_result) = 'object'
    AND octet_length(audit_run.audit_result::text) <= 8388608
    AND audit_run.audit_result ->> 'status'
        = 'RETRIEVAL_AUDIT_ENVELOPE_READY_INACTIVE'
    AND audit_run.audit_result ->> 'contract_scope'
        = 'THERAPY_RETRIEVAL_V2_AUDIT_ENVELOPE_PREFLIGHT_ONLY'
    AND audit_run.audit_result -> 'medical_use_allowed' = 'false'::jsonb
    AND audit_run.audit_result -> 'productive_candidate_use_allowed'
        = 'false'::jsonb
    AND audit_run.audit_result -> 'dosage_evaluation_allowed' = 'false'::jsonb
    AND audit_run.audit_result -> 'dosage_display_allowed' = 'false'::jsonb
    AND audit_run.audit_result -> 'audit_persistence_allowed' = 'false'::jsonb
    AND audit_run.audit_result -> 'replay_execution_allowed' = 'false'::jsonb
    AND audit_run.audit_result -> 'shadow_execution_allowed' = 'false'::jsonb
    AND audit_run.audit_result -> 'ai_use_allowed' = 'false'::jsonb
    AND audit_run.audit_result -> 'plan_selection_allowed' = 'false'::jsonb
    AND audit_run.audit_result -> 'activation_allowed' = 'false'::jsonb
    AND audit_run.audit_result -> 'inactive_audit_envelope_ready' = 'true'::jsonb
    AND jsonb_typeof(audit_envelope) = 'object'
    AND audit_envelope ->> 'data_classification'
        = 'pseudonymized_health_data'
    AND audit_envelope -> 'raw_source_locators_present' = 'false'::jsonb
    AND audit_envelope -> 'concrete_dosage_output_present' = 'false'::jsonb
    AND audit_envelope #> '{ai_provenance,execution_present}' = 'false'::jsonb
    AND audit_envelope #> '{plan_selection_provenance,selection_present}'
        = 'false'::jsonb
    AND audit_envelope #>> '{plan_selection_provenance,selected_position_count}'
        = '0'
    AND audit_envelope #> '{plan_selection_provenance,selected_positions}'
        = '[]'::jsonb
    AND audit_run.audit_result_hash = audit_run.audit_result ->> 'result_hash'
    AND audit_run.audit_result_hash = public.kb_release_manifest_hash_v1(
      audit_run.audit_result - 'result_hash'
    )
    AND audit_run.audit_envelope_hash
        = audit_run.audit_result ->> 'audit_envelope_hash'
    AND audit_run.audit_envelope_hash = audit_envelope ->> 'audit_envelope_hash'
    AND audit_run.audit_envelope_hash = public.kb_release_manifest_hash_v1(
      audit_envelope - 'audit_envelope_hash'
    )
    AND audit_run.dosage_rule_result_hash
        = audit_run.audit_result ->> 'dosage_rule_result_hash'
    AND audit_run.dosage_rule_result_hash
        = audit_envelope #>> '{stage_hashes,dosage_rule_result_hash}'
    AND audit_run.therapy_input_revision_id::text
        = audit_envelope #>> '{stage_identifiers,therapy_input_revision_id}'
    AND audit_run.knowledge_release_id::text
        = audit_envelope #>> '{stage_identifiers,knowledge_release_id}'
    AND audit_run.repertory_entity_id::text
        = audit_envelope #>> '{stage_identifiers,repertory_entity_id}'
    AND audit_run.repertory_revision_id::text
        = audit_envelope #>> '{stage_identifiers,repertory_revision_id}'
    AND public.therapy_input_revision_is_valid_v1(
      audit_run.therapy_input_revision_id
    )
    AND public.therapy_retrieval_v2_input_hash_v1(
      audit_run.therapy_input_revision_id
    ) = audit_envelope #>> '{stage_hashes,therapy_input_manifest_hash}'
    AND EXISTS (
      SELECT 1
        FROM public.kb_releases release
       WHERE release.id = audit_run.knowledge_release_id
         AND release.release_status = 'sealed'
         AND NOT release.retrieval_eligible
         AND NOT release.is_active
         AND release.release_manifest_hash
             = audit_envelope #>> '{stage_hashes,release_manifest_hash}'
         AND public.kb_release_is_valid(release.id, true)
    )
    AND EXISTS (
      SELECT 1
        FROM public.kb_release_items item
       WHERE item.release_id = audit_run.knowledge_release_id
         AND item.item_kind = 'entity_revision'
         AND item.entity_id = audit_run.repertory_entity_id
         AND item.entity_revision_id = audit_run.repertory_revision_id
    )
    AND audit_run.row_hash = public.therapy_retrieval_v2_audit_run_row_hash_v1(
      audit_run.id,
      audit_run.therapy_input_revision_id,
      audit_run.knowledge_release_id,
      audit_run.repertory_entity_id,
      audit_run.repertory_revision_id,
      audit_run.audit_result,
      audit_run.audit_result_hash,
      audit_run.audit_envelope_hash,
      audit_run.dosage_rule_result_hash,
      audit_run.persisted_at,
      audit_run.persisted_by
    );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_invalid_audit_run_count_v1()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)
    FROM public.therapy_retrieval_audit_runs run
   WHERE public.therapy_retrieval_v2_audit_run_is_valid_v1(run.id)
         IS DISTINCT FROM true
$$;

CREATE FUNCTION public.therapy_retrieval_v2_protect_audit_run_append_only_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Therapy retrieval audit runs are append-only';
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_gate_audit_run_insert_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_setting(
       'app.therapy_retrieval_audit_writer_v1',
       true
     ) IS DISTINCT FROM 'enabled'
  THEN
    RAISE EXCEPTION 'Therapy retrieval audit runs require the owner writer';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_validate_audit_run_insert_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.therapy_retrieval_v2_audit_run_is_valid_v1(NEW.id)
       IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'Therapy retrieval audit run integrity check failed';
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION public.therapy_retrieval_v2_persist_audit_envelope_v1(
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
  _expected_audit_result_hash text,
  _persisted_by uuid,
  _direct_limit integer DEFAULT 8,
  _graph_limit integer DEFAULT 16,
  _homeopathic_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  audit_result jsonb;
  audit_envelope jsonb;
  audit_run_id uuid;
  audit_run_hash text;
  persisted_at timestamptz;
  inserted_count integer;
  result_payload jsonb;
BEGIN
  IF _therapy_input_revision_id IS NULL
     OR _knowledge_release_id IS NULL
     OR _repertory_entity_id IS NULL
     OR _repertory_revision_id IS NULL
     OR _persisted_by IS NULL
     OR _expected_audit_result_hash IS NULL
     OR _expected_audit_result_hash !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Audit persistence requires complete identifiers and an expected Step 7A hash';
  END IF;

  audit_result := public.therapy_retrieval_v2_audit_envelope_preflight_v1(
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
    _expected_dosage_rule_result_hash,
    _direct_limit,
    _graph_limit,
    _homeopathic_limit
  );
  audit_envelope := audit_result -> 'audit_envelope';

  IF audit_result ->> 'status'
       IS DISTINCT FROM 'RETRIEVAL_AUDIT_ENVELOPE_READY_INACTIVE'
     OR audit_result ->> 'result_hash'
       IS DISTINCT FROM _expected_audit_result_hash
     OR audit_result ->> 'result_hash'
       IS DISTINCT FROM public.kb_release_manifest_hash_v1(
         audit_result - 'result_hash'
       )
     OR jsonb_typeof(audit_envelope) IS DISTINCT FROM 'object'
     OR audit_result ->> 'audit_envelope_hash'
       IS DISTINCT FROM public.kb_release_manifest_hash_v1(
         audit_envelope - 'audit_envelope_hash'
       )
  THEN
    RAISE EXCEPTION 'Audit persistence requires the exact ready Step 7A result';
  END IF;

  SELECT run.id, run.row_hash
    INTO audit_run_id, audit_run_hash
    FROM public.therapy_retrieval_audit_runs run
   WHERE run.audit_result_hash = _expected_audit_result_hash;

  IF FOUND THEN
    IF public.therapy_retrieval_v2_audit_run_is_valid_v1(audit_run_id)
         IS DISTINCT FROM true
    THEN
      RAISE EXCEPTION 'Existing therapy retrieval audit run is invalid';
    END IF;

    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_PERSISTENCE_ONLY',
      'status', 'RETRIEVAL_AUDIT_ALREADY_PERSISTED_INACTIVE',
      'interpretation', 'AUDIT_PERSISTENCE_ONLY_NO_REPLAY_SHADOW_OR_MEDICAL_USE',
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
      'audit_persistence_complete', true,
      'audit_run_id', audit_run_id,
      'audit_result_hash', _expected_audit_result_hash,
      'audit_run_row_hash', audit_run_hash
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  audit_run_id := gen_random_uuid();
  persisted_at := transaction_timestamp();
  audit_run_hash := public.therapy_retrieval_v2_audit_run_row_hash_v1(
    audit_run_id,
    _therapy_input_revision_id,
    _knowledge_release_id,
    _repertory_entity_id,
    _repertory_revision_id,
    audit_result,
    audit_result ->> 'result_hash',
    audit_result ->> 'audit_envelope_hash',
    audit_result ->> 'dosage_rule_result_hash',
    persisted_at,
    _persisted_by
  );

  PERFORM set_config(
    'app.therapy_retrieval_audit_writer_v1',
    'enabled',
    true
  );
  INSERT INTO public.therapy_retrieval_audit_runs (
    id,
    therapy_input_revision_id,
    knowledge_release_id,
    repertory_entity_id,
    repertory_revision_id,
    audit_result,
    audit_result_hash,
    audit_envelope_hash,
    dosage_rule_result_hash,
    persisted_at,
    persisted_by,
    row_hash
  ) VALUES (
    audit_run_id,
    _therapy_input_revision_id,
    _knowledge_release_id,
    _repertory_entity_id,
    _repertory_revision_id,
    audit_result,
    audit_result ->> 'result_hash',
    audit_result ->> 'audit_envelope_hash',
    audit_result ->> 'dosage_rule_result_hash',
    persisted_at,
    _persisted_by,
    audit_run_hash
  )
  ON CONFLICT (audit_result_hash) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  PERFORM set_config(
    'app.therapy_retrieval_audit_writer_v1',
    '',
    true
  );

  IF inserted_count = 0 THEN
    SELECT run.id, run.row_hash
      INTO STRICT audit_run_id, audit_run_hash
      FROM public.therapy_retrieval_audit_runs run
     WHERE run.audit_result_hash = _expected_audit_result_hash;
  END IF;

  IF public.therapy_retrieval_v2_audit_run_is_valid_v1(audit_run_id)
       IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'Persisted therapy retrieval audit run is invalid';
  END IF;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'THERAPY_RETRIEVAL_V2_AUDIT_PERSISTENCE_ONLY',
    'status', CASE WHEN inserted_count = 1
      THEN 'RETRIEVAL_AUDIT_PERSISTED_INACTIVE'
      ELSE 'RETRIEVAL_AUDIT_ALREADY_PERSISTED_INACTIVE' END,
    'interpretation', 'AUDIT_PERSISTENCE_ONLY_NO_REPLAY_SHADOW_OR_MEDICAL_USE',
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
    'audit_persistence_complete', true,
    'audit_run_id', audit_run_id,
    'audit_result_hash', _expected_audit_result_hash,
    'audit_run_row_hash', audit_run_hash
  ));
  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

CREATE FUNCTION public.therapy_input_export_snapshot_v3()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  snapshot_v2 jsonb;
  audit_rows bigint;
  audit_rows_text text;
  audit_rows_sha256 text;
BEGIN
  snapshot_v2 := public.therapy_input_export_snapshot_v2()::jsonb;

  SELECT count(*)::bigint,
         COALESCE(
           jsonb_agg(
             to_jsonb(run)
             ORDER BY run.persisted_at, run.id
           ),
           '[]'::jsonb
         )::text
    INTO audit_rows, audit_rows_text
    FROM public.therapy_retrieval_audit_runs run;

  audit_rows_sha256 := encode(
    sha256(convert_to(audit_rows_text, 'UTF8')),
    'hex'
  );

  RETURN jsonb_build_object(
    'snapshot_version', 3,
    'tables',
      (snapshot_v2 -> 'tables') || jsonb_build_object(
        'therapy_retrieval_audit_runs', audit_rows_text
      ),
    'manifest',
      (snapshot_v2 -> 'manifest') || jsonb_build_object(
        'therapy_retrieval_audit_runs', jsonb_build_object(
          'rows', audit_rows,
          'sha256', audit_rows_sha256
        )
      ),
    'validation', jsonb_build_object(
      'invalid_revision_count',
        (snapshot_v2 #>> '{validation,invalid_revision_count}')::bigint,
      'invalid_fact_count',
        (snapshot_v2 #>> '{validation,invalid_fact_count}')::bigint,
      'invalid_audit_run_count',
        public.therapy_retrieval_v2_invalid_audit_run_count_v1()
    )
  )::text;
END;
$$;

CREATE TRIGGER therapy_retrieval_audit_runs_gate_insert
  BEFORE INSERT ON public.therapy_retrieval_audit_runs
  FOR EACH ROW EXECUTE FUNCTION
    public.therapy_retrieval_v2_gate_audit_run_insert_v1();

CREATE TRIGGER therapy_retrieval_audit_runs_append_only
  BEFORE UPDATE OR DELETE ON public.therapy_retrieval_audit_runs
  FOR EACH ROW EXECUTE FUNCTION
    public.therapy_retrieval_v2_protect_audit_run_append_only_v1();

CREATE TRIGGER therapy_retrieval_audit_runs_no_truncate
  BEFORE TRUNCATE ON public.therapy_retrieval_audit_runs
  FOR EACH STATEMENT EXECUTE FUNCTION
    public.therapy_retrieval_v2_protect_audit_run_append_only_v1();

CREATE CONSTRAINT TRIGGER therapy_retrieval_audit_runs_validate_insert
  AFTER INSERT ON public.therapy_retrieval_audit_runs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION
    public.therapy_retrieval_v2_validate_audit_run_insert_v1();

ALTER TABLE public.therapy_retrieval_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY therapy_retrieval_audit_runs_admin_read
  ON public.therapy_retrieval_audit_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE public.therapy_retrieval_audit_runs
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT SELECT ON TABLE public.therapy_retrieval_audit_runs
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.therapy_retrieval_v2_audit_run_row_hash_v1(
  uuid, uuid, uuid, uuid, uuid, jsonb, text, text, text, timestamptz, uuid
) FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_retrieval_v2_audit_run_is_valid_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_retrieval_v2_invalid_audit_run_count_v1()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_retrieval_v2_protect_audit_run_append_only_v1()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_retrieval_v2_gate_audit_run_insert_v1()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_retrieval_v2_validate_audit_run_insert_v1()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_retrieval_v2_persist_audit_envelope_v1(
  uuid, text, uuid, text, uuid, uuid, jsonb, text, text, text, text, text,
  text, uuid, integer, integer, integer
) FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.therapy_input_export_snapshot_v3()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT EXECUTE ON FUNCTION public.therapy_input_export_snapshot_v3()
  TO service_role;

COMMENT ON TABLE public.therapy_retrieval_audit_runs IS
  'Step 7B append-only owner-persisted exact Step 7A audit results. Rows remain inactive and authorize no replay, shadow, AI, plan selection, dosage display, activation or medical use.';
COMMENT ON FUNCTION public.therapy_retrieval_v2_persist_audit_envelope_v1(
  uuid, text, uuid, text, uuid, uuid, jsonb, text, text, text, text, text,
  text, uuid, integer, integer, integer
) IS
  'Step 7B owner-only idempotent persistence of an exact expected ready Step 7A result. It creates no runtime, replay, shadow, AI, plan-selection or medical-use permission.';
COMMENT ON FUNCTION public.therapy_input_export_snapshot_v3() IS
  'Lossless five-table protected therapy snapshot: immutable input snapshot v2 plus append-only retrieval audit runs and their integrity count.';

COMMIT;
