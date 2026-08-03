BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regprocedure(
       'public.kb_homeopathic_repertory_import_preflight_v1(uuid,uuid,text,jsonb)'
     ) IS NULL
     OR to_regprocedure(
       'public.kb_homeopathic_repertory_revision_is_valid(uuid,uuid)'
     ) IS NULL
     OR to_regprocedure(
       'public.kb_release_jsonb_has_exact_keys_v1(jsonb,text[])'
     ) IS NULL
  THEN
    RAISE EXCEPTION 'Homeopathic small-bundle writer requires the complete Step 5B-2 contract';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 65 THEN
    RAISE EXCEPTION 'Homeopathic small-bundle writer requires the exact 65-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Homeopathic small-bundle writer cannot run with an active knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_write_small_bundle_v1(_bundle jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  repertory jsonb;
  expected_counts jsonb;
  preflight jsonb;
  table_owner name;
  existing_bundle boolean;
BEGIN
  SELECT pg_get_userbyid(target.relowner)
    INTO STRICT table_owner
    FROM pg_class target
   WHERE target.oid = 'public.kb_homeopathic_repertory_revision_details'::regclass;
  IF current_user <> table_owner THEN
    RAISE EXCEPTION 'Homeopathic small-bundle writes require the database table owner';
  END IF;

  IF _bundle IS NULL
     OR jsonb_typeof(_bundle) <> 'object'
     OR octet_length(_bundle::text) > 4194304
     OR public.kb_release_jsonb_has_exact_keys_v1(
          _bundle,
          ARRAY[
            'assignments', 'contract_scope', 'contract_version',
            'data_classification', 'expected_bundle_hash',
            'grade_definitions', 'remedies', 'repertory', 'rubrics'
          ]::text[]
         ) IS DISTINCT FROM true
     OR _bundle -> 'contract_version' <> '1'::jsonb
     OR _bundle -> 'contract_scope' <> '"HOMEOPATHIC_SMALL_BUNDLE_WRITE_ONLY"'::jsonb
     OR _bundle -> 'data_classification' <> '"general_knowledge"'::jsonb
     OR jsonb_typeof(_bundle -> 'expected_bundle_hash') IS DISTINCT FROM 'string'
     OR (_bundle ->> 'expected_bundle_hash') !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(_bundle -> 'repertory') IS DISTINCT FROM 'object'
     OR jsonb_typeof(_bundle -> 'rubrics') IS DISTINCT FROM 'array'
     OR jsonb_typeof(_bundle -> 'grade_definitions') IS DISTINCT FROM 'array'
     OR jsonb_typeof(_bundle -> 'remedies') IS DISTINCT FROM 'array'
     OR jsonb_typeof(_bundle -> 'assignments') IS DISTINCT FROM 'array'
     OR jsonb_array_length(_bundle -> 'rubrics') NOT BETWEEN 1 AND 256
     OR jsonb_array_length(_bundle -> 'grade_definitions') NOT BETWEEN 1 AND 64
     OR jsonb_array_length(_bundle -> 'remedies') NOT BETWEEN 1 AND 256
     OR jsonb_array_length(_bundle -> 'assignments') NOT BETWEEN 1 AND 2048
  THEN
    RAISE EXCEPTION 'Homeopathic small-bundle writer envelope is invalid or exceeds its reference limits';
  END IF;

  repertory := _bundle -> 'repertory';
  IF public.kb_release_jsonb_has_exact_keys_v1(
       repertory,
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
         WHERE jsonb_typeof(repertory -> required_field.key) IS DISTINCT FROM 'string'
      )
      OR (repertory ->> 'content_hash') !~ '^[0-9a-f]{64}$'
      OR (repertory ->> 'source_content_hash') !~ '^[0-9a-f]{64}$'
      OR (repertory ->> 'entity_id') !~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR (repertory ->> 'revision_id') !~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR (repertory ->> 'source_id') !~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR (repertory ->> 'source_revision_id') !~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR repertory ->> 'source_rights_status' NOT IN (
       'own_content', 'licensed', 'public_domain'
     )
     OR (repertory ->> 'source_language_code') !~ '^[a-z]{2,3}(-[A-Z]{2})?$'
  THEN
    RAISE EXCEPTION 'Homeopathic small-bundle writer repertory binding is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_bundle -> 'rubrics') item(value)
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
         OR (item.value ->> 'sibling_order')::numeric > 1000000
  ) OR EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_bundle -> 'grade_definitions') item(value)
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
         OR (item.value ->> 'grade_order')::numeric > 256
  ) OR EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_bundle -> 'remedies') item(value)
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
         OR EXISTS (
           SELECT 1
             FROM jsonb_array_elements(item.value -> 'source_remedy_aliases') alias(value)
            WHERE jsonb_typeof(alias.value) IS DISTINCT FROM 'string'
         )
  ) OR EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_bundle -> 'assignments') item(value)
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
    RAISE EXCEPTION 'Homeopathic small-bundle writer component shape is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Homeopathic small-bundle writes are disabled while a knowledge release is active';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.kb_sources source
      JOIN public.kb_source_revisions revision
        ON revision.source_id = source.id
       AND revision.id = (repertory ->> 'source_revision_id')::uuid
     WHERE source.id = (repertory ->> 'source_id')::uuid
       AND revision.content_hash = repertory ->> 'source_content_hash'
       AND revision.rights_status = repertory ->> 'source_rights_status'
       AND revision.rights_status IN ('own_content', 'licensed', 'public_domain')
  ) THEN
    RAISE EXCEPTION 'Homeopathic small-bundle source revision is unavailable or mismatched';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = entity.id
       AND revision.id = (repertory ->> 'revision_id')::uuid
     WHERE entity.id = (repertory ->> 'entity_id')::uuid
       AND entity.entity_type_code = 'homeopathic_repertory'
       AND revision.origin_type IN ('human', 'legacy_snapshot')
  ) THEN
    RAISE EXCEPTION 'Homeopathic small-bundle repertory revision is unavailable';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.kb_homeopathic_repertory_revision_details detail
     WHERE detail.entity_id = (repertory ->> 'entity_id')::uuid
       AND detail.entity_revision_id = (repertory ->> 'revision_id')::uuid
  ) INTO existing_bundle;

  IF NOT existing_bundle AND NOT EXISTS (
       SELECT 1
         FROM public.kb_entity_revisions revision
        WHERE revision.entity_id = (repertory ->> 'entity_id')::uuid
          AND revision.id = (repertory ->> 'revision_id')::uuid
          AND revision.review_status = 'draft'
     )
  THEN
    RAISE EXCEPTION 'New homeopathic small bundles require a draft repertory revision';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_bundle -> 'remedies') item(value)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.kb_entities entity
         JOIN public.kb_entity_revisions revision
           ON revision.entity_id = entity.id
          AND revision.id = (item.value ->> 'remedy_revision_id')::uuid
        WHERE entity.id = (item.value ->> 'remedy_entity_id')::uuid
          AND entity.entity_type_code = 'homeopathic_remedy'
          AND revision.origin_type IN ('human', 'legacy_snapshot')
     )
  ) THEN
    RAISE EXCEPTION 'Homeopathic small-bundle remedy revision is unavailable';
  END IF;

  IF NOT existing_bundle THEN
    UPDATE public.kb_entity_revisions revision
       SET content_hash = repertory ->> 'content_hash'
     WHERE revision.entity_id = (repertory ->> 'entity_id')::uuid
       AND revision.id = (repertory ->> 'revision_id')::uuid
       AND revision.content_hash IS DISTINCT FROM repertory ->> 'content_hash'
       AND revision.review_status = 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.kb_entity_revisions revision
     WHERE revision.entity_id = (repertory ->> 'entity_id')::uuid
       AND revision.id = (repertory ->> 'revision_id')::uuid
       AND revision.content_hash = repertory ->> 'content_hash'
  ) THEN
    RAISE EXCEPTION 'Homeopathic small-bundle repertory content hash is mismatched or frozen';
  END IF;

  IF NOT existing_bundle THEN
    INSERT INTO public.kb_homeopathic_repertory_revision_details (
      entity_id, entity_revision_id, source_id, source_revision_id,
      source_repertory_code, source_language_code, source_locator
    ) VALUES (
      (repertory ->> 'entity_id')::uuid,
      (repertory ->> 'revision_id')::uuid,
      (repertory ->> 'source_id')::uuid,
      (repertory ->> 'source_revision_id')::uuid,
      repertory ->> 'source_repertory_code',
      repertory ->> 'source_language_code',
      repertory ->> 'source_locator'
    ) ON CONFLICT DO NOTHING;

    INSERT INTO public.kb_homeopathic_rubrics (
      id, repertory_entity_id, native_rubric_code
    )
    SELECT (item.value ->> 'rubric_id')::uuid,
           (repertory ->> 'entity_id')::uuid,
           item.value ->> 'native_rubric_code'
      FROM jsonb_array_elements(_bundle -> 'rubrics') item(value)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.kb_homeopathic_rubric_revisions (
      id, repertory_entity_id, repertory_revision_id, rubric_id,
      parent_rubric_id, rubric_text, rubric_domain, sibling_order,
      source_locator, rubric_content_hash
    )
    SELECT (item.value ->> 'rubric_revision_id')::uuid,
           (repertory ->> 'entity_id')::uuid,
           (repertory ->> 'revision_id')::uuid,
           (item.value ->> 'rubric_id')::uuid,
           (item.value ->> 'parent_rubric_id')::uuid,
           item.value ->> 'rubric_text',
           item.value ->> 'rubric_domain',
           (item.value ->> 'sibling_order')::integer,
           item.value ->> 'source_locator',
           item.value ->> 'content_hash'
      FROM jsonb_array_elements(_bundle -> 'rubrics') item(value)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.kb_homeopathic_grade_definitions (
      id, repertory_entity_id, repertory_revision_id, source_grade_code,
      source_grade_label, grade_order, source_locator, grade_content_hash
    )
    SELECT (item.value ->> 'grade_definition_id')::uuid,
           (repertory ->> 'entity_id')::uuid,
           (repertory ->> 'revision_id')::uuid,
           item.value ->> 'source_grade_code',
           item.value ->> 'source_grade_label',
           (item.value ->> 'grade_order')::integer,
           item.value ->> 'source_locator',
           item.value ->> 'content_hash'
      FROM jsonb_array_elements(_bundle -> 'grade_definitions') item(value)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.kb_homeopathic_repertory_remedies (
      id, repertory_entity_id, repertory_revision_id,
      remedy_entity_id, remedy_revision_id,
      source_remedy_code, source_remedy_name, source_remedy_aliases,
      source_locator, remedy_content_hash
    )
    SELECT (item.value ->> 'repertory_remedy_id')::uuid,
           (repertory ->> 'entity_id')::uuid,
           (repertory ->> 'revision_id')::uuid,
           (item.value ->> 'remedy_entity_id')::uuid,
           (item.value ->> 'remedy_revision_id')::uuid,
           item.value ->> 'source_remedy_code',
           item.value ->> 'source_remedy_name',
           ARRAY(
             SELECT alias.value #>> '{}'
               FROM jsonb_array_elements(item.value -> 'source_remedy_aliases')
                    WITH ORDINALITY alias(value, position)
              ORDER BY alias.position
           ),
           item.value ->> 'source_locator',
           item.value ->> 'content_hash'
      FROM jsonb_array_elements(_bundle -> 'remedies') item(value)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.kb_homeopathic_rubric_remedy_assignments (
      id, repertory_entity_id, repertory_revision_id,
      rubric_revision_id, repertory_remedy_id, grade_definition_id,
      source_locator, assignment_content_hash
    )
    SELECT (item.value ->> 'assignment_id')::uuid,
           (repertory ->> 'entity_id')::uuid,
           (repertory ->> 'revision_id')::uuid,
           (item.value ->> 'rubric_revision_id')::uuid,
           (item.value ->> 'repertory_remedy_id')::uuid,
           (item.value ->> 'grade_definition_id')::uuid,
           item.value ->> 'source_locator',
           item.value ->> 'content_hash'
      FROM jsonb_array_elements(_bundle -> 'assignments') item(value)
    ON CONFLICT DO NOTHING;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.kb_homeopathic_repertory_revision_details detail
     WHERE detail.entity_id = (repertory ->> 'entity_id')::uuid
       AND detail.entity_revision_id = (repertory ->> 'revision_id')::uuid
       AND detail.source_id = (repertory ->> 'source_id')::uuid
       AND detail.source_revision_id = (repertory ->> 'source_revision_id')::uuid
       AND detail.source_repertory_code = repertory ->> 'source_repertory_code'
       AND detail.source_language_code = repertory ->> 'source_language_code'
       AND detail.source_locator = repertory ->> 'source_locator'
  ) THEN
    RAISE EXCEPTION 'Homeopathic small-bundle repertory replay differs from stored content';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_bundle -> 'rubrics') item(value)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.kb_homeopathic_rubrics rubric
         JOIN public.kb_homeopathic_rubric_revisions revision
           ON revision.repertory_entity_id = rubric.repertory_entity_id
          AND revision.rubric_id = rubric.id
          AND revision.id = (item.value ->> 'rubric_revision_id')::uuid
        WHERE rubric.id = (item.value ->> 'rubric_id')::uuid
          AND rubric.repertory_entity_id = (repertory ->> 'entity_id')::uuid
          AND rubric.native_rubric_code = item.value ->> 'native_rubric_code'
          AND revision.repertory_revision_id = (repertory ->> 'revision_id')::uuid
          AND revision.parent_rubric_id IS NOT DISTINCT FROM
              (item.value ->> 'parent_rubric_id')::uuid
          AND revision.rubric_text = item.value ->> 'rubric_text'
          AND revision.rubric_domain = item.value ->> 'rubric_domain'
          AND revision.sibling_order = (item.value ->> 'sibling_order')::integer
          AND revision.source_locator = item.value ->> 'source_locator'
          AND revision.rubric_content_hash = item.value ->> 'content_hash'
     )
  ) THEN
    RAISE EXCEPTION 'Homeopathic small-bundle rubric replay differs from stored content';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_bundle -> 'grade_definitions') item(value)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.kb_homeopathic_grade_definitions grade
        WHERE grade.id = (item.value ->> 'grade_definition_id')::uuid
          AND grade.repertory_entity_id = (repertory ->> 'entity_id')::uuid
          AND grade.repertory_revision_id = (repertory ->> 'revision_id')::uuid
          AND grade.source_grade_code = item.value ->> 'source_grade_code'
          AND grade.source_grade_label = item.value ->> 'source_grade_label'
          AND grade.grade_order = (item.value ->> 'grade_order')::integer
          AND grade.source_locator = item.value ->> 'source_locator'
          AND grade.grade_content_hash = item.value ->> 'content_hash'
     )
  ) THEN
    RAISE EXCEPTION 'Homeopathic small-bundle grade replay differs from stored content';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_bundle -> 'remedies') item(value)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.kb_homeopathic_repertory_remedies remedy
        WHERE remedy.id = (item.value ->> 'repertory_remedy_id')::uuid
          AND remedy.repertory_entity_id = (repertory ->> 'entity_id')::uuid
          AND remedy.repertory_revision_id = (repertory ->> 'revision_id')::uuid
          AND remedy.remedy_entity_id = (item.value ->> 'remedy_entity_id')::uuid
          AND remedy.remedy_revision_id = (item.value ->> 'remedy_revision_id')::uuid
          AND remedy.source_remedy_code = item.value ->> 'source_remedy_code'
          AND remedy.source_remedy_name = item.value ->> 'source_remedy_name'
          AND to_jsonb(remedy.source_remedy_aliases) = item.value -> 'source_remedy_aliases'
          AND remedy.source_locator = item.value ->> 'source_locator'
          AND remedy.remedy_content_hash = item.value ->> 'content_hash'
     )
  ) THEN
    RAISE EXCEPTION 'Homeopathic small-bundle remedy replay differs from stored content';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_bundle -> 'assignments') item(value)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.kb_homeopathic_rubric_remedy_assignments assignment
        WHERE assignment.id = (item.value ->> 'assignment_id')::uuid
          AND assignment.repertory_entity_id = (repertory ->> 'entity_id')::uuid
          AND assignment.repertory_revision_id = (repertory ->> 'revision_id')::uuid
          AND assignment.rubric_revision_id = (item.value ->> 'rubric_revision_id')::uuid
          AND assignment.repertory_remedy_id = (item.value ->> 'repertory_remedy_id')::uuid
          AND assignment.grade_definition_id = (item.value ->> 'grade_definition_id')::uuid
          AND assignment.source_locator = item.value ->> 'source_locator'
          AND assignment.assignment_content_hash = item.value ->> 'content_hash'
     )
  ) THEN
    RAISE EXCEPTION 'Homeopathic small-bundle assignment replay differs from stored content';
  END IF;

  IF public.kb_homeopathic_repertory_revision_is_valid(
       (repertory ->> 'entity_id')::uuid,
       (repertory ->> 'revision_id')::uuid
     ) IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'Homeopathic small-bundle content is semantically invalid';
  END IF;

  expected_counts := jsonb_build_object(
    'rubrics', jsonb_array_length(_bundle -> 'rubrics'),
    'grade_definitions', jsonb_array_length(_bundle -> 'grade_definitions'),
    'remedies', jsonb_array_length(_bundle -> 'remedies'),
    'assignments', jsonb_array_length(_bundle -> 'assignments')
  );
  preflight := public.kb_homeopathic_repertory_import_preflight_v1(
    (repertory ->> 'entity_id')::uuid,
    (repertory ->> 'revision_id')::uuid,
    _bundle ->> 'expected_bundle_hash',
    expected_counts
  );
  IF preflight ->> 'status' <> 'HOMEOPATHIC_IMPORT_BUNDLE_READY' THEN
    RAISE EXCEPTION 'Homeopathic small-bundle preflight failed with status %',
      preflight ->> 'status';
  END IF;

  RETURN preflight;
END;
$$;

COMMENT ON FUNCTION public.kb_homeopathic_write_small_bundle_v1(jsonb) IS
  'Step 5B-5 owner-only atomic reference writer for one prehashed normalized small repertory bundle. It grants no runtime access and is not approved for real source data or bulk import.';

REVOKE ALL ON FUNCTION public.kb_homeopathic_write_small_bundle_v1(jsonb)
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMIT;
