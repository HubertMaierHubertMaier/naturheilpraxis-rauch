BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure(
       'public.kb_homeopathic_repertory_revision_is_valid(uuid,uuid)'
     ) IS NULL
     OR to_regprocedure(
       'public.kb_homeopathic_repertorize_single_v1(uuid,uuid,jsonb,integer)'
     ) IS NULL
     OR to_regprocedure('public.kb_release_canonical_jsonb_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure(
       'public.kb_release_jsonb_has_exact_keys_v1(jsonb,text[])'
     ) IS NULL
  THEN
    RAISE EXCEPTION 'Homeopathic import preflight requires the complete Step 5B-1 contract';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 65 THEN
    RAISE EXCEPTION 'Homeopathic import preflight requires the exact 65-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Homeopathic import preflight cannot activate a knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_repertory_bundle_manifest_v1(
  _repertory_entity_id uuid,
  _repertory_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  WITH valid_repertory AS MATERIALIZED (
    SELECT
      detail.entity_id,
      detail.entity_revision_id,
      detail.source_id,
      detail.source_revision_id,
      detail.source_repertory_code,
      detail.source_language_code,
      detail.source_locator,
      repertory_revision.content_hash AS repertory_content_hash,
      source_revision.content_hash AS source_content_hash,
      source_revision.rights_status AS source_rights_status
      FROM public.kb_homeopathic_repertory_revision_details detail
      JOIN public.kb_entity_revisions repertory_revision
        ON repertory_revision.entity_id = detail.entity_id
       AND repertory_revision.id = detail.entity_revision_id
      JOIN public.kb_source_revisions source_revision
        ON source_revision.source_id = detail.source_id
       AND source_revision.id = detail.source_revision_id
     WHERE detail.entity_id = _repertory_entity_id
       AND detail.entity_revision_id = _repertory_revision_id
       AND public.kb_homeopathic_repertory_revision_is_valid(
             detail.entity_id, detail.entity_revision_id
           ) IS TRUE
  ),
  rubric_component AS MATERIALIZED (
    SELECT
      count(*)::integer AS item_count,
      encode(sha256(convert_to(COALESCE(string_agg(
        rubric_revision.rubric_id::text || ':' ||
        rubric_revision.id::text || ':' ||
        rubric_revision.rubric_content_hash,
        E'\n' ORDER BY
          rubric_revision.rubric_id::text COLLATE "C",
          rubric_revision.id::text COLLATE "C"
      ), ''), 'UTF8')), 'hex') AS component_hash
      FROM public.kb_homeopathic_rubric_revisions rubric_revision
     WHERE rubric_revision.repertory_entity_id = _repertory_entity_id
       AND rubric_revision.repertory_revision_id = _repertory_revision_id
  ),
  grade_component AS MATERIALIZED (
    SELECT
      count(*)::integer AS item_count,
      encode(sha256(convert_to(COALESCE(string_agg(
        grade.id::text || ':' || grade.grade_content_hash,
        E'\n' ORDER BY grade.id::text COLLATE "C"
      ), ''), 'UTF8')), 'hex') AS component_hash
      FROM public.kb_homeopathic_grade_definitions grade
     WHERE grade.repertory_entity_id = _repertory_entity_id
       AND grade.repertory_revision_id = _repertory_revision_id
  ),
  remedy_component AS MATERIALIZED (
    SELECT
      count(*)::integer AS item_count,
      encode(sha256(convert_to(COALESCE(string_agg(
        remedy.id::text || ':' ||
        remedy.remedy_entity_id::text || ':' ||
        remedy.remedy_revision_id::text || ':' ||
        remedy.remedy_content_hash,
        E'\n' ORDER BY remedy.id::text COLLATE "C"
      ), ''), 'UTF8')), 'hex') AS component_hash
      FROM public.kb_homeopathic_repertory_remedies remedy
     WHERE remedy.repertory_entity_id = _repertory_entity_id
       AND remedy.repertory_revision_id = _repertory_revision_id
  ),
  assignment_component AS MATERIALIZED (
    SELECT
      count(*)::integer AS item_count,
      encode(sha256(convert_to(COALESCE(string_agg(
        assignment.id::text || ':' ||
        assignment.rubric_revision_id::text || ':' ||
        assignment.repertory_remedy_id::text || ':' ||
        assignment.grade_definition_id::text || ':' ||
        assignment.assignment_content_hash,
        E'\n' ORDER BY assignment.id::text COLLATE "C"
      ), ''), 'UTF8')), 'hex') AS component_hash
      FROM public.kb_homeopathic_rubric_remedy_assignments assignment
     WHERE assignment.repertory_entity_id = _repertory_entity_id
       AND assignment.repertory_revision_id = _repertory_revision_id
  )
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY',
    'data_classification', 'general_knowledge',
    'repertory', jsonb_build_object(
      'repertory_entity_id', valid.entity_id,
      'repertory_revision_id', valid.entity_revision_id,
      'repertory_content_hash', valid.repertory_content_hash,
      'source_id', valid.source_id,
      'source_revision_id', valid.source_revision_id,
      'source_content_hash', valid.source_content_hash,
      'source_rights_status', valid.source_rights_status,
      'source_repertory_code', valid.source_repertory_code,
      'source_language_code', valid.source_language_code,
      'source_locator', valid.source_locator
    ),
    'component_counts', jsonb_build_object(
      'rubrics', rubric.item_count,
      'grade_definitions', grade.item_count,
      'remedies', remedy.item_count,
      'assignments', assignment.item_count
    ),
    'component_hashes', jsonb_build_object(
      'rubrics', rubric.component_hash,
      'grade_definitions', grade.component_hash,
      'remedies', remedy.component_hash,
      'assignments', assignment.component_hash
    )
  ))
    FROM valid_repertory valid
    CROSS JOIN rubric_component rubric
    CROSS JOIN grade_component grade
    CROSS JOIN remedy_component remedy
    CROSS JOIN assignment_component assignment
$$;

CREATE FUNCTION public.kb_homeopathic_repertory_bundle_hash_v1(
  _repertory_entity_id uuid,
  _repertory_revision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(
    public.kb_homeopathic_repertory_bundle_manifest_v1(
      _repertory_entity_id, _repertory_revision_id
    )
  )
$$;

CREATE FUNCTION public.kb_homeopathic_import_expectations_are_valid_v1(
  _expected_bundle_hash text,
  _expected_counts jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  item record;
  numeric_text text;
BEGIN
  IF _expected_bundle_hash IS NULL
     OR _expected_bundle_hash !~ '^[0-9a-f]{64}$'
     OR _expected_counts IS NULL
     OR jsonb_typeof(_expected_counts) <> 'object'
     OR octet_length(_expected_counts::text) > 1024
     OR public.kb_release_jsonb_has_exact_keys_v1(
          _expected_counts,
          ARRAY[
            'assignments', 'grade_definitions', 'remedies', 'rubrics'
          ]::text[]
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  FOR item IN SELECT key, value FROM jsonb_each(_expected_counts)
  LOOP
    IF jsonb_typeof(item.value) <> 'number' THEN
      RETURN false;
    END IF;
    numeric_text := item.value #>> '{}';
    IF numeric_text !~ '^[1-9][0-9]{0,9}$'
       OR numeric_text::numeric > 2147483647
    THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_repertory_import_preflight_v1(
  _repertory_entity_id uuid,
  _repertory_revision_id uuid,
  _expected_bundle_hash text,
  _expected_counts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  bundle_manifest jsonb;
  bundle_hash text;
  actual_counts jsonb;
  hash_matches boolean;
  counts_match boolean;
  result_status text;
  result_payload jsonb;
BEGIN
  IF public.kb_homeopathic_import_expectations_are_valid_v1(
       _expected_bundle_hash, _expected_counts
     ) IS DISTINCT FROM true
  THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY',
      'status', 'HOMEOPATHIC_IMPORT_EXPECTATION_INVALID',
      'repertory_entity_id', _repertory_entity_id,
      'repertory_revision_id', _repertory_revision_id
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  bundle_manifest := public.kb_homeopathic_repertory_bundle_manifest_v1(
    _repertory_entity_id, _repertory_revision_id
  );
  IF bundle_manifest IS NULL THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'contract_scope', 'HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY',
      'status', 'HOMEOPATHIC_IMPORT_BUNDLE_UNAVAILABLE',
      'repertory_entity_id', _repertory_entity_id,
      'repertory_revision_id', _repertory_revision_id,
      'expected_bundle_hash', _expected_bundle_hash,
      'expected_counts', _expected_counts
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  bundle_hash := public.kb_release_manifest_hash_v1(bundle_manifest);
  actual_counts := bundle_manifest -> 'component_counts';
  hash_matches := bundle_hash = _expected_bundle_hash;
  counts_match := actual_counts = _expected_counts;
  result_status := CASE
    WHEN hash_matches AND counts_match THEN 'HOMEOPATHIC_IMPORT_BUNDLE_READY'
    ELSE 'HOMEOPATHIC_IMPORT_BUNDLE_MISMATCH'
  END;

  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'contract_scope', 'HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY',
    'status', result_status,
    'interpretation', 'IMPORT_PREFLIGHT_ONLY_NOT_RELEASE_OR_MEDICAL_USE',
    'repertory_entity_id', _repertory_entity_id,
    'repertory_revision_id', _repertory_revision_id,
    'expected_bundle_hash', _expected_bundle_hash,
    'actual_bundle_hash', bundle_hash,
    'hash_matches', hash_matches,
    'expected_counts', _expected_counts,
    'actual_counts', actual_counts,
    'counts_match', counts_match,
    'bundle_manifest', bundle_manifest
  ));
  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

COMMENT ON FUNCTION public.kb_homeopathic_repertory_bundle_manifest_v1(uuid, uuid) IS
  'Step 5B-2 deterministic post-load bundle digest for one synthetically tested repertory revision. It does not import, release, or recommend content.';
COMMENT ON FUNCTION public.kb_homeopathic_repertory_import_preflight_v1(uuid, uuid, text, jsonb) IS
  'Step 5B-2 fail-closed owner preflight comparing expected and stored bundle hashes and counts. It grants no writer or runtime access.';

REVOKE ALL ON FUNCTION
  public.kb_homeopathic_repertory_bundle_manifest_v1(uuid, uuid),
  public.kb_homeopathic_repertory_bundle_hash_v1(uuid, uuid),
  public.kb_homeopathic_import_expectations_are_valid_v1(text, jsonb),
  public.kb_homeopathic_repertory_import_preflight_v1(uuid, uuid, text, jsonb)
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMIT;
