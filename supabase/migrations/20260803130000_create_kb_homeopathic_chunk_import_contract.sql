BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure('public.kb_homeopathic_write_small_bundle_v1(jsonb)') IS NULL
     OR to_regprocedure(
       'public.kb_homeopathic_repertory_import_preflight_v1(uuid,uuid,text,jsonb)'
     ) IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure(
       'public.kb_release_jsonb_has_exact_keys_v1(jsonb,text[])'
     ) IS NULL
  THEN
    RAISE EXCEPTION 'Homeopathic chunk import requires the complete Step 5B-5 contract';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 65 THEN
    RAISE EXCEPTION 'Homeopathic chunk import requires the exact 65-table Wiki boundary';
  END IF;

  IF to_regclass('public.kb_homeopathic_chunk_import_batches') IS NOT NULL
     OR to_regclass('public.kb_homeopathic_chunk_import_chunks') IS NOT NULL
  THEN
    RAISE EXCEPTION 'Homeopathic chunk import staging tables must be absent';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Homeopathic chunk import cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_sha256_array_is_valid_v1(_values text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT cardinality(_values) BETWEEN 1 AND 64
     AND NOT EXISTS (
       SELECT 1 FROM unnest(_values) item(value)
        WHERE item.value !~ '^[0-9a-f]{64}$'
     )
     AND (SELECT count(*) FROM unnest(_values) item(value)) =
         (SELECT count(DISTINCT item.value) FROM unnest(_values) item(value))
$$;

CREATE FUNCTION public.kb_homeopathic_small_expected_counts_are_valid_v1(
  _expected_bundle_hash text,
  _expected_counts jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF public.kb_homeopathic_import_expectations_are_valid_v1(
       _expected_bundle_hash, _expected_counts
     ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  RETURN (_expected_counts ->> 'rubrics')::numeric <= 256
     AND (_expected_counts ->> 'grade_definitions')::numeric <= 64
     AND (_expected_counts ->> 'remedies')::numeric <= 256
     AND (_expected_counts ->> 'assignments')::numeric <= 2048;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_writer_repertory_binding_is_valid_v1(
  _repertory jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _repertory IS NULL
     OR jsonb_typeof(_repertory) <> 'object'
     OR public.kb_release_jsonb_has_exact_keys_v1(
          _repertory,
          ARRAY[
            'content_hash', 'entity_id', 'revision_id', 'source_content_hash',
            'source_id', 'source_language_code', 'source_locator',
            'source_repertory_code', 'source_revision_id', 'source_rights_status'
          ]::text[]
        ) IS DISTINCT FROM true
     OR EXISTS (
       SELECT 1
         FROM unnest(ARRAY[
           'content_hash', 'entity_id', 'revision_id', 'source_content_hash',
           'source_id', 'source_language_code', 'source_locator',
           'source_repertory_code', 'source_revision_id', 'source_rights_status'
         ]::text[]) required_field(key)
        WHERE jsonb_typeof(_repertory -> required_field.key) IS DISTINCT FROM 'string'
     )
     OR (_repertory ->> 'content_hash') !~ '^[0-9a-f]{64}$'
     OR (_repertory ->> 'source_content_hash') !~ '^[0-9a-f]{64}$'
     OR (_repertory ->> 'entity_id') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR (_repertory ->> 'revision_id') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR (_repertory ->> 'source_id') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR (_repertory ->> 'source_revision_id') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR _repertory ->> 'source_rights_status' NOT IN (
       'own_content', 'licensed', 'public_domain'
     )
     OR (_repertory ->> 'source_language_code') !~ '^[a-z]{2,3}(-[A-Z]{2})?$'
  THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_chunk_expectations_are_valid_v1(
  _expected_bundle_hash text,
  _expected_counts jsonb,
  _expected_chunk_hashes text[]
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF public.kb_homeopathic_small_expected_counts_are_valid_v1(
       _expected_bundle_hash, _expected_counts
     ) IS DISTINCT FROM true
     OR public.kb_homeopathic_sha256_array_is_valid_v1(_expected_chunk_hashes)
        IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  RETURN cardinality(_expected_chunk_hashes) <=
    (_expected_counts ->> 'rubrics')::integer
    + (_expected_counts ->> 'grade_definitions')::integer
    + (_expected_counts ->> 'remedies')::integer
    + (_expected_counts ->> 'assignments')::integer;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_chunk_payload_is_valid_v1(_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _payload IS NULL
     OR jsonb_typeof(_payload) <> 'object'
     OR octet_length(_payload::text) > 1048576
     OR public.kb_release_jsonb_has_exact_keys_v1(
          _payload,
          ARRAY['assignments', 'grade_definitions', 'remedies', 'rubrics']::text[]
        ) IS DISTINCT FROM true
     OR jsonb_typeof(_payload -> 'rubrics') IS DISTINCT FROM 'array'
     OR jsonb_typeof(_payload -> 'grade_definitions') IS DISTINCT FROM 'array'
     OR jsonb_typeof(_payload -> 'remedies') IS DISTINCT FROM 'array'
     OR jsonb_typeof(_payload -> 'assignments') IS DISTINCT FROM 'array'
  THEN
    RETURN false;
  END IF;

  IF jsonb_array_length(_payload -> 'rubrics') > 256
     OR jsonb_array_length(_payload -> 'grade_definitions') > 64
     OR jsonb_array_length(_payload -> 'remedies') > 256
     OR jsonb_array_length(_payload -> 'assignments') > 2048
     OR jsonb_array_length(_payload -> 'rubrics')
        + jsonb_array_length(_payload -> 'grade_definitions')
        + jsonb_array_length(_payload -> 'remedies')
        + jsonb_array_length(_payload -> 'assignments') < 1
  THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_payload -> 'rubrics') item(value)
     WHERE jsonb_typeof(item.value) <> 'object'
        OR public.kb_release_jsonb_has_exact_keys_v1(
             item.value,
             ARRAY[
               'content_hash', 'native_rubric_code', 'parent_rubric_id',
               'rubric_domain', 'rubric_id', 'rubric_revision_id',
               'rubric_text', 'sibling_order', 'source_locator'
             ]::text[]
           ) IS DISTINCT FROM true
        OR EXISTS (
          SELECT 1
            FROM unnest(ARRAY[
              'content_hash', 'native_rubric_code', 'rubric_domain',
              'rubric_id', 'rubric_revision_id', 'rubric_text', 'source_locator'
            ]::text[]) required_field(key)
           WHERE jsonb_typeof(item.value -> required_field.key) IS DISTINCT FROM 'string'
        )
        OR (item.value ->> 'content_hash') !~ '^[0-9a-f]{64}$'
        OR (item.value ->> 'rubric_id') !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (item.value ->> 'rubric_revision_id') !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR jsonb_typeof(item.value -> 'parent_rubric_id') NOT IN ('null', 'string')
        OR (
          jsonb_typeof(item.value -> 'parent_rubric_id') = 'string'
          AND (item.value ->> 'parent_rubric_id') !~
              '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
        OR jsonb_typeof(item.value -> 'sibling_order') IS DISTINCT FROM 'number'
        OR (item.value ->> 'sibling_order') !~ '^[1-9][0-9]{0,6}$'
        OR CASE
             WHEN (item.value ->> 'sibling_order') ~ '^[1-9][0-9]{0,6}$'
             THEN (item.value ->> 'sibling_order')::numeric > 1000000
             ELSE false
           END
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_payload -> 'grade_definitions') item(value)
     WHERE jsonb_typeof(item.value) <> 'object'
        OR public.kb_release_jsonb_has_exact_keys_v1(
             item.value,
             ARRAY[
               'content_hash', 'grade_definition_id', 'grade_order',
               'source_grade_code', 'source_grade_label', 'source_locator'
             ]::text[]
           ) IS DISTINCT FROM true
        OR EXISTS (
          SELECT 1
            FROM unnest(ARRAY[
              'content_hash', 'grade_definition_id', 'source_grade_code',
              'source_grade_label', 'source_locator'
            ]::text[]) required_field(key)
           WHERE jsonb_typeof(item.value -> required_field.key) IS DISTINCT FROM 'string'
        )
        OR (item.value ->> 'content_hash') !~ '^[0-9a-f]{64}$'
        OR (item.value ->> 'grade_definition_id') !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR jsonb_typeof(item.value -> 'grade_order') IS DISTINCT FROM 'number'
        OR (item.value ->> 'grade_order') !~ '^[1-9][0-9]{0,2}$'
        OR CASE
             WHEN (item.value ->> 'grade_order') ~ '^[1-9][0-9]{0,2}$'
             THEN (item.value ->> 'grade_order')::numeric > 256
             ELSE false
           END
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_payload -> 'remedies') item(value)
     WHERE jsonb_typeof(item.value) <> 'object'
        OR public.kb_release_jsonb_has_exact_keys_v1(
             item.value,
             ARRAY[
               'content_hash', 'remedy_entity_id', 'remedy_revision_id',
               'repertory_remedy_id', 'source_locator',
               'source_remedy_aliases', 'source_remedy_code',
               'source_remedy_name'
             ]::text[]
           ) IS DISTINCT FROM true
        OR EXISTS (
          SELECT 1
            FROM unnest(ARRAY[
              'content_hash', 'remedy_entity_id', 'remedy_revision_id',
              'repertory_remedy_id', 'source_locator', 'source_remedy_code',
              'source_remedy_name'
            ]::text[]) required_field(key)
           WHERE jsonb_typeof(item.value -> required_field.key) IS DISTINCT FROM 'string'
        )
        OR (item.value ->> 'content_hash') !~ '^[0-9a-f]{64}$'
        OR (item.value ->> 'remedy_entity_id') !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (item.value ->> 'remedy_revision_id') !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (item.value ->> 'repertory_remedy_id') !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR jsonb_typeof(item.value -> 'source_remedy_aliases') IS DISTINCT FROM 'array'
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_payload -> 'remedies') item(value)
      CROSS JOIN LATERAL jsonb_array_elements(item.value -> 'source_remedy_aliases') alias(value)
     WHERE jsonb_typeof(alias.value) IS DISTINCT FROM 'string'
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_payload -> 'assignments') item(value)
     WHERE jsonb_typeof(item.value) <> 'object'
        OR public.kb_release_jsonb_has_exact_keys_v1(
             item.value,
             ARRAY[
               'assignment_id', 'content_hash', 'grade_definition_id',
               'repertory_remedy_id', 'rubric_revision_id', 'source_locator'
             ]::text[]
           ) IS DISTINCT FROM true
        OR EXISTS (
          SELECT 1
            FROM unnest(ARRAY[
              'assignment_id', 'content_hash', 'grade_definition_id',
              'repertory_remedy_id', 'rubric_revision_id', 'source_locator'
            ]::text[]) required_field(key)
           WHERE jsonb_typeof(item.value -> required_field.key) IS DISTINCT FROM 'string'
        )
        OR (item.value ->> 'content_hash') !~ '^[0-9a-f]{64}$'
        OR (item.value ->> 'assignment_id') !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (item.value ->> 'grade_definition_id') !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (item.value ->> 'repertory_remedy_id') !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (item.value ->> 'rubric_revision_id') !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_chunk_batch_envelope_is_valid_v1(_batch jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  chunk_hashes text[];
BEGIN
  IF _batch IS NULL
     OR jsonb_typeof(_batch) <> 'object'
     OR octet_length(_batch::text) > 65536
     OR public.kb_release_jsonb_has_exact_keys_v1(
          _batch,
          ARRAY[
            'batch_id', 'contract_scope', 'contract_version',
            'data_classification', 'expected_bundle_hash',
            'expected_chunk_hashes', 'expected_counts', 'repertory'
          ]::text[]
        ) IS DISTINCT FROM true
     OR _batch -> 'contract_version' <> '1'::jsonb
     OR _batch -> 'contract_scope' <>
        '"HOMEOPATHIC_CHUNK_IMPORT_BATCH_ONLY"'::jsonb
     OR _batch -> 'data_classification' <> '"general_knowledge"'::jsonb
     OR jsonb_typeof(_batch -> 'batch_id') IS DISTINCT FROM 'string'
     OR (_batch ->> 'batch_id') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR jsonb_typeof(_batch -> 'expected_bundle_hash') IS DISTINCT FROM 'string'
     OR jsonb_typeof(_batch -> 'expected_chunk_hashes') IS DISTINCT FROM 'array'
     OR jsonb_typeof(_batch -> 'expected_counts') IS DISTINCT FROM 'object'
     OR public.kb_homeopathic_writer_repertory_binding_is_valid_v1(
          _batch -> 'repertory'
        ) IS DISTINCT FROM true
     OR public.kb_homeopathic_small_expected_counts_are_valid_v1(
          _batch ->> 'expected_bundle_hash', _batch -> 'expected_counts'
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_batch -> 'expected_chunk_hashes') item(value)
     WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'string'
  ) THEN
    RETURN false;
  END IF;

  chunk_hashes := ARRAY(
    SELECT item.value #>> '{}'
      FROM jsonb_array_elements(_batch -> 'expected_chunk_hashes')
           WITH ORDINALITY item(value, position)
     ORDER BY item.position
  );
  RETURN public.kb_homeopathic_chunk_expectations_are_valid_v1(
    _batch ->> 'expected_bundle_hash', _batch -> 'expected_counts', chunk_hashes
  );
END;
$$;

CREATE FUNCTION public.kb_homeopathic_chunk_envelope_is_valid_v1(_chunk jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _chunk IS NULL
     OR jsonb_typeof(_chunk) <> 'object'
     OR octet_length(_chunk::text) > 1100000
     OR public.kb_release_jsonb_has_exact_keys_v1(
          _chunk,
          ARRAY[
            'batch_id', 'chunk_hash', 'chunk_index', 'chunk_payload',
            'contract_scope', 'contract_version', 'data_classification'
          ]::text[]
        ) IS DISTINCT FROM true
     OR _chunk -> 'contract_version' <> '1'::jsonb
     OR _chunk -> 'contract_scope' <>
        '"HOMEOPATHIC_CHUNK_IMPORT_STAGE_ONLY"'::jsonb
     OR _chunk -> 'data_classification' <> '"general_knowledge"'::jsonb
     OR jsonb_typeof(_chunk -> 'batch_id') IS DISTINCT FROM 'string'
     OR (_chunk ->> 'batch_id') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR jsonb_typeof(_chunk -> 'chunk_index') IS DISTINCT FROM 'number'
     OR (_chunk ->> 'chunk_index') !~ '^(0|[1-9][0-9]?)$'
     OR (
       CASE
         WHEN (_chunk ->> 'chunk_index') ~ '^(0|[1-9][0-9]?)$'
         THEN (_chunk ->> 'chunk_index')::numeric > 63
         ELSE false
       END
     )
     OR jsonb_typeof(_chunk -> 'chunk_hash') IS DISTINCT FROM 'string'
     OR (_chunk ->> 'chunk_hash') !~ '^[0-9a-f]{64}$'
     OR public.kb_homeopathic_chunk_payload_is_valid_v1(
          _chunk -> 'chunk_payload'
        ) IS DISTINCT FROM true
     OR (_chunk ->> 'chunk_hash') IS DISTINCT FROM
        public.kb_release_manifest_hash_v1(_chunk -> 'chunk_payload')
  THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE TABLE public.kb_homeopathic_chunk_import_batches (
  id uuid PRIMARY KEY,
  repertory_entity_id uuid NOT NULL,
  repertory_revision_id uuid NOT NULL,
  repertory jsonb NOT NULL,
  expected_bundle_hash text NOT NULL CHECK (expected_bundle_hash ~ '^[0-9a-f]{64}$'),
  expected_counts jsonb NOT NULL,
  expected_chunk_hashes text[] NOT NULL,
  batch_status text NOT NULL DEFAULT 'open'
    CHECK (batch_status IN ('open', 'written', 'cancelled')),
  written_result_hash text CHECK (
    written_result_hash IS NULL OR written_result_hash ~ '^[0-9a-f]{64}$'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (public.kb_homeopathic_writer_repertory_binding_is_valid_v1(repertory)),
  CHECK (repertory ->> 'entity_id' = repertory_entity_id::text),
  CHECK (repertory ->> 'revision_id' = repertory_revision_id::text),
  CHECK (public.kb_homeopathic_chunk_expectations_are_valid_v1(
    expected_bundle_hash, expected_counts, expected_chunk_hashes
  )),
  CHECK (
    (batch_status = 'open' AND written_result_hash IS NULL AND completed_at IS NULL)
    OR
    (batch_status = 'written' AND written_result_hash IS NOT NULL AND completed_at IS NOT NULL)
    OR
    (batch_status = 'cancelled' AND written_result_hash IS NULL AND completed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX kb_homeopathic_chunk_import_batches_active_target_idx
  ON public.kb_homeopathic_chunk_import_batches(
    repertory_entity_id, repertory_revision_id
  ) WHERE batch_status IN ('open', 'written');

CREATE TABLE public.kb_homeopathic_chunk_import_chunks (
  batch_id uuid NOT NULL REFERENCES public.kb_homeopathic_chunk_import_batches(id)
    ON DELETE RESTRICT,
  chunk_index integer NOT NULL CHECK (chunk_index BETWEEN 0 AND 63),
  chunk_hash text NOT NULL CHECK (chunk_hash ~ '^[0-9a-f]{64}$'),
  chunk_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, chunk_index),
  UNIQUE (batch_id, chunk_hash),
  CHECK (public.kb_homeopathic_chunk_payload_is_valid_v1(chunk_payload)),
  CHECK (chunk_hash = public.kb_release_manifest_hash_v1(chunk_payload))
);

CREATE FUNCTION public.kb_protect_homeopathic_chunk_import_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  parent_batch public.kb_homeopathic_chunk_import_batches%ROWTYPE;
  staged_rubrics bigint;
  staged_grades bigint;
  staged_remedies bigint;
  staged_assignments bigint;
  staged_payload_bytes bigint;
BEGIN
  SELECT pg_get_userbyid(target.relowner)
    INTO STRICT table_owner
    FROM pg_class target
   WHERE target.oid = TG_RELID;
  IF current_user <> table_owner THEN
    RAISE EXCEPTION 'Homeopathic chunk import writes require the database table owner';
  END IF;

  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Homeopathic chunk import audit rows are immutable';
  END IF;

  IF TG_TABLE_NAME = 'kb_homeopathic_chunk_import_batches' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.batch_status <> 'open'
         OR NEW.written_result_hash IS NOT NULL
         OR NEW.completed_at IS NOT NULL
      THEN
        RAISE EXCEPTION 'Homeopathic chunk import batches must start open';
      END IF;
      RETURN NEW;
    END IF;

    IF (to_jsonb(NEW) - ARRAY['batch_status', 'written_result_hash', 'completed_at'])
         IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['batch_status', 'written_result_hash', 'completed_at'])
    THEN
      RAISE EXCEPTION 'Homeopathic chunk import batch identity is immutable';
    END IF;
    IF OLD.batch_status IN ('written', 'cancelled')
       AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD)
    THEN
      RAISE EXCEPTION 'Terminal homeopathic chunk import batches are immutable';
    END IF;
    IF OLD.batch_status <> NEW.batch_status
       AND NOT (
         OLD.batch_status = 'open' AND NEW.batch_status IN ('written', 'cancelled')
       )
    THEN
      RAISE EXCEPTION 'Invalid homeopathic chunk import batch transition';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Homeopathic import chunks are immutable';
  END IF;

  SELECT batch.*
    INTO parent_batch
    FROM public.kb_homeopathic_chunk_import_batches batch
   WHERE batch.id = NEW.batch_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Homeopathic chunk import batch is unavailable';
  END IF;
  IF parent_batch.batch_status <> 'open' THEN
    RAISE EXCEPTION 'Terminal homeopathic chunk import batches accept no new chunks';
  END IF;
  IF NEW.chunk_index >= cardinality(parent_batch.expected_chunk_hashes)
     OR NEW.chunk_hash IS DISTINCT FROM
        parent_batch.expected_chunk_hashes[NEW.chunk_index + 1]
  THEN
    RAISE EXCEPTION 'Homeopathic import chunk does not match the batch manifest';
  END IF;

  SELECT
    COALESCE(sum(jsonb_array_length(chunk.chunk_payload -> 'rubrics')), 0),
    COALESCE(sum(jsonb_array_length(chunk.chunk_payload -> 'grade_definitions')), 0),
    COALESCE(sum(jsonb_array_length(chunk.chunk_payload -> 'remedies')), 0),
    COALESCE(sum(jsonb_array_length(chunk.chunk_payload -> 'assignments')), 0),
    COALESCE(sum(octet_length(chunk.chunk_payload::text)), 0)
    INTO staged_rubrics, staged_grades, staged_remedies,
         staged_assignments, staged_payload_bytes
    FROM public.kb_homeopathic_chunk_import_chunks chunk
   WHERE chunk.batch_id = parent_batch.id;
  IF staged_rubrics + jsonb_array_length(NEW.chunk_payload -> 'rubrics') >
       (parent_batch.expected_counts ->> 'rubrics')::integer
     OR staged_grades + jsonb_array_length(NEW.chunk_payload -> 'grade_definitions') >
        (parent_batch.expected_counts ->> 'grade_definitions')::integer
     OR staged_remedies + jsonb_array_length(NEW.chunk_payload -> 'remedies') >
        (parent_batch.expected_counts ->> 'remedies')::integer
     OR staged_assignments + jsonb_array_length(NEW.chunk_payload -> 'assignments') >
        (parent_batch.expected_counts ->> 'assignments')::integer
     OR staged_payload_bytes + octet_length(NEW.chunk_payload::text) > 4000000
  THEN
    RAISE EXCEPTION 'Homeopathic import chunk exceeds the batch counts or 4000000-byte staging limit';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_homeopathic_chunk_import_batches_protect_write
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.kb_homeopathic_chunk_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_homeopathic_chunk_import_write();
CREATE TRIGGER kb_homeopathic_chunk_import_batches_prevent_truncate
  BEFORE TRUNCATE ON public.kb_homeopathic_chunk_import_batches
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_protect_homeopathic_chunk_import_write();
CREATE TRIGGER kb_homeopathic_chunk_import_chunks_protect_write
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.kb_homeopathic_chunk_import_chunks
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_homeopathic_chunk_import_write();
CREATE TRIGGER kb_homeopathic_chunk_import_chunks_prevent_truncate
  BEFORE TRUNCATE ON public.kb_homeopathic_chunk_import_chunks
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_protect_homeopathic_chunk_import_write();

CREATE FUNCTION public.kb_homeopathic_chunk_import_status_v1(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  target public.kb_homeopathic_chunk_import_batches%ROWTYPE;
  staged_chunk_count integer;
  staged_counts jsonb;
  staged_payload_bytes bigint;
  missing_chunk_indexes jsonb;
  result_status text;
  result_payload jsonb;
BEGIN
  SELECT batch.*
    INTO target
    FROM public.kb_homeopathic_chunk_import_batches batch
   WHERE batch.id = _batch_id;
  IF NOT FOUND THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'HOMEOPATHIC_CHUNK_IMPORT_STATUS_ONLY',
      'status', 'HOMEOPATHIC_CHUNK_IMPORT_BATCH_UNAVAILABLE',
      'batch_id', _batch_id
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  SELECT count(*)::integer,
         jsonb_build_object(
           'rubrics', COALESCE(sum(jsonb_array_length(chunk_payload -> 'rubrics')), 0)::integer,
           'grade_definitions', COALESCE(sum(jsonb_array_length(
             chunk_payload -> 'grade_definitions'
           )), 0)::integer,
           'remedies', COALESCE(sum(jsonb_array_length(chunk_payload -> 'remedies')), 0)::integer,
           'assignments', COALESCE(sum(jsonb_array_length(
             chunk_payload -> 'assignments'
           )), 0)::integer
         ),
         COALESCE(sum(octet_length(chunk_payload::text)), 0)
    INTO staged_chunk_count, staged_counts, staged_payload_bytes
    FROM public.kb_homeopathic_chunk_import_chunks chunk
   WHERE chunk.batch_id = target.id;

  SELECT COALESCE(jsonb_agg(expected_index ORDER BY expected_index), '[]'::jsonb)
    INTO missing_chunk_indexes
    FROM generate_series(0, cardinality(target.expected_chunk_hashes) - 1)
         expected(expected_index)
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.kb_homeopathic_chunk_import_chunks chunk
      WHERE chunk.batch_id = target.id
        AND chunk.chunk_index = expected.expected_index
   );

  result_status := CASE
    WHEN target.batch_status = 'written' THEN 'HOMEOPATHIC_CHUNK_IMPORT_BATCH_WRITTEN'
    WHEN target.batch_status = 'cancelled' THEN 'HOMEOPATHIC_CHUNK_IMPORT_BATCH_CANCELLED'
    WHEN missing_chunk_indexes = '[]'::jsonb
      THEN 'HOMEOPATHIC_CHUNK_IMPORT_BATCH_READY'
    ELSE 'HOMEOPATHIC_CHUNK_IMPORT_BATCH_OPEN'
  END;
  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'HOMEOPATHIC_CHUNK_IMPORT_STATUS_ONLY',
    'data_classification', 'general_knowledge',
    'status', result_status,
    'interpretation', 'CHUNK_IMPORT_REFERENCE_ONLY_NOT_RELEASE_OR_MEDICAL_USE',
    'batch_id', target.id,
    'repertory_entity_id', target.repertory_entity_id,
    'repertory_revision_id', target.repertory_revision_id,
    'expected_bundle_hash', target.expected_bundle_hash,
    'expected_counts', target.expected_counts,
    'expected_chunk_count', cardinality(target.expected_chunk_hashes),
    'staged_chunk_count', staged_chunk_count,
    'staged_counts', staged_counts,
    'staged_payload_bytes', staged_payload_bytes,
    'missing_chunk_indexes', missing_chunk_indexes,
    'written_result_hash', target.written_result_hash
  ));
  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

CREATE FUNCTION public.kb_homeopathic_begin_chunk_import_v1(_batch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  selected_batch_id uuid;
  repertory jsonb;
  chunk_hashes text[];
  stored public.kb_homeopathic_chunk_import_batches%ROWTYPE;
BEGIN
  SELECT pg_get_userbyid(target.relowner)
    INTO STRICT table_owner
    FROM pg_class target
   WHERE target.oid = 'public.kb_homeopathic_chunk_import_batches'::regclass;
  IF current_user <> table_owner THEN
    RAISE EXCEPTION 'Homeopathic chunk import writes require the database table owner';
  END IF;
  IF public.kb_homeopathic_chunk_batch_envelope_is_valid_v1(_batch)
       IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'Homeopathic chunk import batch envelope is invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.kb_releases WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Homeopathic chunk import is disabled while a knowledge release is active';
  END IF;

  selected_batch_id := (_batch ->> 'batch_id')::uuid;
  repertory := _batch -> 'repertory';
  chunk_hashes := ARRAY(
    SELECT item.value #>> '{}'
      FROM jsonb_array_elements(_batch -> 'expected_chunk_hashes')
           WITH ORDINALITY item(value, position)
     ORDER BY item.position
  );

  INSERT INTO public.kb_homeopathic_chunk_import_batches (
    id, repertory_entity_id, repertory_revision_id, repertory,
    expected_bundle_hash, expected_counts, expected_chunk_hashes
  ) VALUES (
    selected_batch_id,
    (repertory ->> 'entity_id')::uuid,
    (repertory ->> 'revision_id')::uuid,
    repertory,
    _batch ->> 'expected_bundle_hash',
    _batch -> 'expected_counts',
    chunk_hashes
  ) ON CONFLICT DO NOTHING;

  SELECT batch.*
    INTO stored
    FROM public.kb_homeopathic_chunk_import_batches batch
   WHERE batch.id = selected_batch_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Homeopathic chunk import repertory target is already bound to another active batch';
  END IF;
  IF stored.repertory_entity_id <> (repertory ->> 'entity_id')::uuid
     OR stored.repertory_revision_id <> (repertory ->> 'revision_id')::uuid
     OR stored.repertory IS DISTINCT FROM repertory
     OR stored.expected_bundle_hash <> (_batch ->> 'expected_bundle_hash')
     OR stored.expected_counts IS DISTINCT FROM _batch -> 'expected_counts'
     OR stored.expected_chunk_hashes IS DISTINCT FROM chunk_hashes
  THEN
    RAISE EXCEPTION 'Homeopathic chunk import batch replay differs from stored identity';
  END IF;

  RETURN public.kb_homeopathic_chunk_import_status_v1(selected_batch_id);
END;
$$;

CREATE FUNCTION public.kb_homeopathic_stage_import_chunk_v1(_chunk jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  selected_batch_id uuid;
  selected_chunk_index integer;
  target public.kb_homeopathic_chunk_import_batches%ROWTYPE;
  stored public.kb_homeopathic_chunk_import_chunks%ROWTYPE;
BEGIN
  SELECT pg_get_userbyid(table_class.relowner)
    INTO STRICT table_owner
    FROM pg_class table_class
   WHERE table_class.oid = 'public.kb_homeopathic_chunk_import_chunks'::regclass;
  IF current_user <> table_owner THEN
    RAISE EXCEPTION 'Homeopathic chunk import writes require the database table owner';
  END IF;
  IF public.kb_homeopathic_chunk_envelope_is_valid_v1(_chunk) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Homeopathic import chunk envelope is invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.kb_releases WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Homeopathic chunk import is disabled while a knowledge release is active';
  END IF;

  selected_batch_id := (_chunk ->> 'batch_id')::uuid;
  selected_chunk_index := (_chunk ->> 'chunk_index')::integer;
  SELECT batch.*
    INTO target
    FROM public.kb_homeopathic_chunk_import_batches batch
   WHERE batch.id = selected_batch_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Homeopathic chunk import batch is unavailable';
  END IF;
  IF selected_chunk_index >= cardinality(target.expected_chunk_hashes)
     OR (_chunk ->> 'chunk_hash') IS DISTINCT FROM
        target.expected_chunk_hashes[selected_chunk_index + 1]
  THEN
    RAISE EXCEPTION 'Homeopathic import chunk does not match the batch manifest';
  END IF;

  SELECT chunk.*
    INTO stored
    FROM public.kb_homeopathic_chunk_import_chunks chunk
   WHERE chunk.batch_id = selected_batch_id
     AND chunk.chunk_index = selected_chunk_index;
  IF FOUND THEN
    IF stored.chunk_hash IS DISTINCT FROM (_chunk ->> 'chunk_hash')
       OR stored.chunk_payload IS DISTINCT FROM _chunk -> 'chunk_payload'
    THEN
      RAISE EXCEPTION 'Homeopathic import chunk replay differs from stored content';
    END IF;
    RETURN public.kb_homeopathic_chunk_import_status_v1(selected_batch_id);
  END IF;
  IF target.batch_status <> 'open' THEN
    RAISE EXCEPTION 'Terminal homeopathic chunk import batches accept no new chunks';
  END IF;

  INSERT INTO public.kb_homeopathic_chunk_import_chunks (
    batch_id, chunk_index, chunk_hash, chunk_payload
  ) VALUES (
    selected_batch_id, selected_chunk_index,
    _chunk ->> 'chunk_hash', _chunk -> 'chunk_payload'
  );
  RETURN public.kb_homeopathic_chunk_import_status_v1(selected_batch_id);
END;
$$;

CREATE FUNCTION public.kb_homeopathic_cancel_chunk_import_v1(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  target public.kb_homeopathic_chunk_import_batches%ROWTYPE;
BEGIN
  SELECT pg_get_userbyid(table_class.relowner)
    INTO STRICT table_owner
    FROM pg_class table_class
   WHERE table_class.oid = 'public.kb_homeopathic_chunk_import_batches'::regclass;
  IF current_user <> table_owner THEN
    RAISE EXCEPTION 'Homeopathic chunk import writes require the database table owner';
  END IF;

  SELECT batch.*
    INTO target
    FROM public.kb_homeopathic_chunk_import_batches batch
   WHERE batch.id = _batch_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Homeopathic chunk import batch is unavailable';
  END IF;
  IF target.batch_status = 'written' THEN
    RAISE EXCEPTION 'Written homeopathic chunk import batches cannot be cancelled';
  END IF;
  IF target.batch_status = 'open' THEN
    UPDATE public.kb_homeopathic_chunk_import_batches batch
       SET batch_status = 'cancelled',
           completed_at = now()
     WHERE batch.id = target.id;
  END IF;

  RETURN public.kb_homeopathic_chunk_import_status_v1(target.id);
END;
$$;

CREATE FUNCTION public.kb_homeopathic_chunk_import_bundle_v1(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  target public.kb_homeopathic_chunk_import_batches%ROWTYPE;
  chunk_count integer;
  rubrics jsonb;
  grade_definitions jsonb;
  remedies jsonb;
  assignments jsonb;
  actual_counts jsonb;
BEGIN
  SELECT batch.*
    INTO target
    FROM public.kb_homeopathic_chunk_import_batches batch
   WHERE batch.id = _batch_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::integer
    INTO chunk_count
    FROM public.kb_homeopathic_chunk_import_chunks chunk
   WHERE chunk.batch_id = target.id;
  IF chunk_count <> cardinality(target.expected_chunk_hashes)
     OR EXISTS (
       SELECT 1
         FROM generate_series(0, cardinality(target.expected_chunk_hashes) - 1)
              expected(chunk_index)
        WHERE NOT EXISTS (
          SELECT 1
            FROM public.kb_homeopathic_chunk_import_chunks chunk
           WHERE chunk.batch_id = target.id
             AND chunk.chunk_index = expected.chunk_index
             AND chunk.chunk_hash = target.expected_chunk_hashes[expected.chunk_index + 1]
        )
     )
  THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(item.value ORDER BY chunk.chunk_index, item.position), '[]'::jsonb)
    INTO rubrics
    FROM public.kb_homeopathic_chunk_import_chunks chunk
    CROSS JOIN LATERAL jsonb_array_elements(chunk.chunk_payload -> 'rubrics')
         WITH ORDINALITY item(value, position)
   WHERE chunk.batch_id = target.id;
  SELECT COALESCE(jsonb_agg(item.value ORDER BY chunk.chunk_index, item.position), '[]'::jsonb)
    INTO grade_definitions
    FROM public.kb_homeopathic_chunk_import_chunks chunk
    CROSS JOIN LATERAL jsonb_array_elements(chunk.chunk_payload -> 'grade_definitions')
         WITH ORDINALITY item(value, position)
   WHERE chunk.batch_id = target.id;
  SELECT COALESCE(jsonb_agg(item.value ORDER BY chunk.chunk_index, item.position), '[]'::jsonb)
    INTO remedies
    FROM public.kb_homeopathic_chunk_import_chunks chunk
    CROSS JOIN LATERAL jsonb_array_elements(chunk.chunk_payload -> 'remedies')
         WITH ORDINALITY item(value, position)
   WHERE chunk.batch_id = target.id;
  SELECT COALESCE(jsonb_agg(item.value ORDER BY chunk.chunk_index, item.position), '[]'::jsonb)
    INTO assignments
    FROM public.kb_homeopathic_chunk_import_chunks chunk
    CROSS JOIN LATERAL jsonb_array_elements(chunk.chunk_payload -> 'assignments')
         WITH ORDINALITY item(value, position)
   WHERE chunk.batch_id = target.id;

  actual_counts := jsonb_build_object(
    'rubrics', jsonb_array_length(rubrics),
    'grade_definitions', jsonb_array_length(grade_definitions),
    'remedies', jsonb_array_length(remedies),
    'assignments', jsonb_array_length(assignments)
  );
  IF actual_counts IS DISTINCT FROM target.expected_counts THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'HOMEOPATHIC_SMALL_BUNDLE_WRITE_ONLY',
    'data_classification', 'general_knowledge',
    'expected_bundle_hash', target.expected_bundle_hash,
    'repertory', target.repertory,
    'rubrics', rubrics,
    'grade_definitions', grade_definitions,
    'remedies', remedies,
    'assignments', assignments
  );
END;
$$;

CREATE FUNCTION public.kb_homeopathic_chunk_import_write_result_v1(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  target public.kb_homeopathic_chunk_import_batches%ROWTYPE;
  staged_bundle jsonb;
  preflight jsonb;
  result_payload jsonb;
BEGIN
  SELECT batch.*
    INTO target
    FROM public.kb_homeopathic_chunk_import_batches batch
   WHERE batch.id = _batch_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  staged_bundle := public.kb_homeopathic_chunk_import_bundle_v1(_batch_id);
  IF staged_bundle IS NULL THEN
    RETURN NULL;
  END IF;

  preflight := public.kb_homeopathic_repertory_import_preflight_v1(
    target.repertory_entity_id,
    target.repertory_revision_id,
    target.expected_bundle_hash,
    target.expected_counts
  );
  IF preflight ->> 'status' <> 'HOMEOPATHIC_IMPORT_BUNDLE_READY' THEN
    RETURN NULL;
  END IF;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'HOMEOPATHIC_CHUNK_IMPORT_WRITE_ONLY',
    'data_classification', 'general_knowledge',
    'status', 'HOMEOPATHIC_CHUNK_IMPORT_BATCH_WRITTEN',
    'interpretation', 'CHUNK_IMPORT_REFERENCE_ONLY_NOT_RELEASE_OR_MEDICAL_USE',
    'batch_id', target.id,
    'repertory_entity_id', target.repertory_entity_id,
    'repertory_revision_id', target.repertory_revision_id,
    'expected_bundle_hash', target.expected_bundle_hash,
    'expected_counts', target.expected_counts,
    'expected_chunk_count', cardinality(target.expected_chunk_hashes),
    'preflight', preflight
  ));
  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

CREATE FUNCTION public.kb_homeopathic_finalize_chunk_import_v1(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  target public.kb_homeopathic_chunk_import_batches%ROWTYPE;
  staged_bundle jsonb;
  write_result jsonb;
BEGIN
  SELECT pg_get_userbyid(table_class.relowner)
    INTO STRICT table_owner
    FROM pg_class table_class
   WHERE table_class.oid = 'public.kb_homeopathic_chunk_import_batches'::regclass;
  IF current_user <> table_owner THEN
    RAISE EXCEPTION 'Homeopathic chunk import writes require the database table owner';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.kb_releases WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Homeopathic chunk import is disabled while a knowledge release is active';
  END IF;

  SELECT batch.*
    INTO target
    FROM public.kb_homeopathic_chunk_import_batches batch
   WHERE batch.id = _batch_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Homeopathic chunk import batch is unavailable';
  END IF;
  IF target.batch_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled homeopathic chunk import batches cannot be finalized';
  END IF;

  staged_bundle := public.kb_homeopathic_chunk_import_bundle_v1(_batch_id);
  IF staged_bundle IS NULL THEN
    RAISE EXCEPTION 'Homeopathic chunk import batch is incomplete or count-mismatched';
  END IF;
  PERFORM public.kb_homeopathic_write_small_bundle_v1(staged_bundle);
  write_result := public.kb_homeopathic_chunk_import_write_result_v1(_batch_id);
  IF write_result IS NULL THEN
    RAISE EXCEPTION 'Homeopathic chunk import final preflight failed';
  END IF;

  IF target.batch_status = 'open' THEN
    UPDATE public.kb_homeopathic_chunk_import_batches batch
       SET batch_status = 'written',
           written_result_hash = write_result ->> 'result_hash',
           completed_at = now()
     WHERE batch.id = target.id;
  ELSIF target.written_result_hash IS DISTINCT FROM write_result ->> 'result_hash' THEN
    RAISE EXCEPTION 'Homeopathic chunk import written replay differs from stored result';
  END IF;

  RETURN write_result;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_chunk_import_batch_is_valid_v1(_batch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  target public.kb_homeopathic_chunk_import_batches%ROWTYPE;
  write_result jsonb;
  staged_rubrics bigint;
  staged_grades bigint;
  staged_remedies bigint;
  staged_assignments bigint;
  staged_payload_bytes bigint;
BEGIN
  SELECT batch.*
    INTO target
    FROM public.kb_homeopathic_chunk_import_batches batch
   WHERE batch.id = _batch_id;
  IF NOT FOUND
     OR public.kb_homeopathic_writer_repertory_binding_is_valid_v1(target.repertory)
        IS DISTINCT FROM true
     OR public.kb_homeopathic_chunk_expectations_are_valid_v1(
          target.expected_bundle_hash,
          target.expected_counts,
          target.expected_chunk_hashes
        )
        IS DISTINCT FROM true
     OR EXISTS (
       SELECT 1
         FROM public.kb_homeopathic_chunk_import_chunks chunk
        WHERE chunk.batch_id = target.id
          AND (
            chunk.chunk_index >= cardinality(target.expected_chunk_hashes)
            OR chunk.chunk_hash IS DISTINCT FROM
               target.expected_chunk_hashes[chunk.chunk_index + 1]
            OR public.kb_homeopathic_chunk_payload_is_valid_v1(chunk.chunk_payload)
               IS DISTINCT FROM true
            OR chunk.chunk_hash IS DISTINCT FROM
               public.kb_release_manifest_hash_v1(chunk.chunk_payload)
          )
     )
  THEN
    RETURN false;
  END IF;

  SELECT
    COALESCE(sum(jsonb_array_length(chunk.chunk_payload -> 'rubrics')), 0),
    COALESCE(sum(jsonb_array_length(chunk.chunk_payload -> 'grade_definitions')), 0),
    COALESCE(sum(jsonb_array_length(chunk.chunk_payload -> 'remedies')), 0),
    COALESCE(sum(jsonb_array_length(chunk.chunk_payload -> 'assignments')), 0),
    COALESCE(sum(octet_length(chunk.chunk_payload::text)), 0)
    INTO staged_rubrics, staged_grades, staged_remedies,
         staged_assignments, staged_payload_bytes
    FROM public.kb_homeopathic_chunk_import_chunks chunk
   WHERE chunk.batch_id = target.id;
  IF staged_rubrics > (target.expected_counts ->> 'rubrics')::integer
     OR staged_grades > (target.expected_counts ->> 'grade_definitions')::integer
     OR staged_remedies > (target.expected_counts ->> 'remedies')::integer
     OR staged_assignments > (target.expected_counts ->> 'assignments')::integer
     OR staged_payload_bytes > 4000000
  THEN
    RETURN false;
  END IF;

  IF target.batch_status = 'open' THEN
    RETURN target.written_result_hash IS NULL AND target.completed_at IS NULL;
  END IF;
  IF target.batch_status = 'cancelled' THEN
    RETURN target.written_result_hash IS NULL AND target.completed_at IS NOT NULL;
  END IF;
  write_result := public.kb_homeopathic_chunk_import_write_result_v1(target.id);
  RETURN write_result IS NOT NULL
     AND target.completed_at IS NOT NULL
     AND target.written_result_hash = write_result ->> 'result_hash';
END;
$$;

CREATE FUNCTION public.kb_invalid_homeopathic_chunk_import_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)
    FROM public.kb_homeopathic_chunk_import_batches batch
   WHERE public.kb_homeopathic_chunk_import_batch_is_valid_v1(batch.id)
         IS DISTINCT FROM true
$$;

ALTER TABLE public.kb_homeopathic_chunk_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_homeopathic_chunk_import_chunks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.kb_homeopathic_chunk_import_batches,
  public.kb_homeopathic_chunk_import_chunks
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMENT ON TABLE public.kb_homeopathic_chunk_import_batches IS
  'Step 5B-6 owner-only, medically inactive batch identities for resumable synthetic chunk staging. No real source, release, or runtime use is approved.';
COMMENT ON TABLE public.kb_homeopathic_chunk_import_chunks IS
  'Step 5B-6 immutable prehashed chunks. Complete batches still finalize only through the Step 5B-5 atomic reference writer.';
COMMENT ON FUNCTION public.kb_homeopathic_finalize_chunk_import_v1(uuid) IS
  'Step 5B-6 owner-only atomic finalization of one complete synthetic staged batch. It is not a production bulk importer or medical release.';

REVOKE ALL ON FUNCTION public.kb_homeopathic_sha256_array_is_valid_v1(text[])
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_small_expected_counts_are_valid_v1(text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_writer_repertory_binding_is_valid_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_chunk_expectations_are_valid_v1(text, jsonb, text[])
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_chunk_payload_is_valid_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_chunk_batch_envelope_is_valid_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_chunk_envelope_is_valid_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_homeopathic_chunk_import_write()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_chunk_import_status_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_begin_chunk_import_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_stage_import_chunk_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_cancel_chunk_import_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_chunk_import_bundle_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_chunk_import_write_result_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_finalize_chunk_import_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_chunk_import_batch_is_valid_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_homeopathic_chunk_import_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');
  IF wiki_table_count <> 67 THEN
    RAISE EXCEPTION 'Homeopathic chunk import must extend the Wiki boundary to exactly 67 tables';
  END IF;
END;
$$;

ALTER FUNCTION public.kb_export_wiki_snapshot()
  RENAME TO kb_export_wiki_snapshot_5b5;
REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot_5b5()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

CREATE FUNCTION public.kb_export_wiki_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  snapshot jsonb;
BEGIN
  snapshot := public.kb_export_wiki_snapshot_5b5();
  RETURN jsonb_set(
    snapshot,
    '{validation}',
    (snapshot -> 'validation') || jsonb_build_object(
      'invalid_homeopathic_chunk_imports',
        public.kb_invalid_homeopathic_chunk_import_count()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT EXECUTE ON FUNCTION public.kb_export_wiki_snapshot()
  TO service_role;

COMMIT;
