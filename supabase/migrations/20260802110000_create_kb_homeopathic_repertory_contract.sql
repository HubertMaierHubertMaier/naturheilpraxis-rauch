BEGIN;

DO $$
DECLARE
  expected_wiki_tables text[] := ARRAY[
    'admin_knowledge_base',
    'faqs',
    'kb_article_entities',
    'kb_article_revisions',
    'kb_articles',
    'kb_assertion_sources',
    'kb_assertions',
    'kb_botanical_revision_details',
    'kb_change_proposals',
    'kb_composition_components',
    'kb_dosage_candidates',
    'kb_dosage_rules',
    'kb_entities',
    'kb_entity_candidate_assertion_sources',
    'kb_entity_candidate_assertions',
    'kb_entity_candidate_botanical_details',
    'kb_entity_candidate_components',
    'kb_entity_candidate_contracts',
    'kb_entity_candidate_draft_promotion_assertions',
    'kb_entity_candidate_draft_promotions',
    'kb_entity_candidate_homeopathic_details',
    'kb_entity_candidate_names',
    'kb_entity_candidate_nutrient_details',
    'kb_entity_candidate_preparation_details',
    'kb_entity_candidate_product_variant_details',
    'kb_entity_candidates',
    'kb_entity_identifiers',
    'kb_entity_names',
    'kb_entity_relations',
    'kb_entity_revisions',
    'kb_entity_types',
    'kb_homeopathic_revision_details',
    'kb_identifier_schemes',
    'kb_import_batches',
    'kb_import_errors',
    'kb_lab_finding_definition_revision_details',
    'kb_lab_parameter_revision_details',
    'kb_lab_reference_ranges',
    'kb_nutrient_revision_details',
    'kb_preparation_revision_details',
    'kb_product_variant_revision_details',
    'kb_relation_candidates',
    'kb_relation_type_domains',
    'kb_relation_types',
    'kb_release_items',
    'kb_releases',
    'kb_review_decisions',
    'kb_safety_candidates',
    'kb_safety_rule_conditions',
    'kb_safety_rules',
    'kb_search_documents',
    'kb_source_candidate_draft_promotions',
    'kb_source_candidates',
    'kb_source_revisions',
    'kb_sources',
    'knowledge_product_links',
    'mannayan_products',
    'practice_info',
    'practice_pricing'
  ]::text[];
  actual_wiki_tables text[];
BEGIN
  IF to_regprocedure('public.kb_release_canonical_jsonb_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
     OR to_regprocedure('public.kb_text_array_is_canonical(text[])') IS NULL
     OR to_regprocedure('public.kb_clinical_rule_dependency_status_is_valid_v1(text,text)') IS NULL
     OR to_regprocedure('public.kb_invalid_lab_parameter_revision_count()') IS NULL
     OR to_regprocedure('public.kb_invalid_lab_reference_range_count()') IS NULL
     OR to_regprocedure('public.kb_invalid_lab_finding_definition_revision_count()') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Homeopathic repertory details require the complete 59-table Wiki contract';
  END IF;

  SELECT array_agg(tables.tablename COLLATE "C" ORDER BY tables.tablename COLLATE "C")
    INTO actual_wiki_tables
    FROM pg_catalog.pg_tables tables
   WHERE tables.schemaname = 'public'
     AND (
       tables.tablename = ANY(ARRAY[
         'admin_knowledge_base',
         'mannayan_products',
         'knowledge_product_links',
         'faqs',
         'practice_pricing',
         'practice_info'
       ]::text[])
       OR tables.tablename LIKE 'kb\_%' ESCAPE '\'
     );

  IF actual_wiki_tables IS DISTINCT FROM expected_wiki_tables THEN
    RAISE EXCEPTION 'Homeopathic repertory details require the exact 59-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_types entity_type
     WHERE entity_type.code IN ('homeopathic_repertory', 'homeopathic_remedy')
  ) THEN
    RAISE EXCEPTION 'Schema-only homeopathic repertory details require absent controlled entity types';
  END IF;
END;
$$;

INSERT INTO public.kb_entity_types (code, label) VALUES
  ('homeopathic_repertory', 'Homeopathic repertory'),
  ('homeopathic_remedy', 'Homeopathic remedy');

CREATE OR REPLACE FUNCTION public.kb_homeopathic_source_term_key_v1(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT lower(
    btrim(regexp_replace(normalize(_value, NFC), '[[:space:]]+', ' ', 'g'))
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_alias_array_is_valid_v1(_values text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT cardinality(_values) BETWEEN 0 AND 256
     AND public.kb_text_array_is_canonical(_values)
     AND NOT EXISTS (
       SELECT 1
         FROM unnest(_values) item(value)
        WHERE octet_length(item.value) NOT BETWEEN 1 AND 1024
            OR NULLIF(btrim(item.value), '') IS NULL
      )
     AND NOT EXISTS (
       SELECT 1
         FROM unnest(_values) item(value)
        GROUP BY public.kb_homeopathic_source_term_key_v1(item.value)
       HAVING count(*) > 1
     )
$$;

CREATE TABLE public.kb_homeopathic_repertory_revision_details (
  entity_id uuid NOT NULL,
  entity_revision_id uuid NOT NULL,
  repertory_schema_version integer NOT NULL DEFAULT 1
    CHECK (repertory_schema_version = 1),
  source_id uuid NOT NULL,
  source_revision_id uuid NOT NULL,
  source_repertory_code text NOT NULL
    CHECK (
      btrim(source_repertory_code) <> ''
       AND octet_length(source_repertory_code) <= 512
    ),
  source_language_code text NOT NULL
    CHECK (source_language_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  source_locator text NOT NULL
    CHECK (
      btrim(source_locator) <> ''
       AND octet_length(source_locator) <= 4096
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, entity_revision_id),
  UNIQUE (entity_revision_id),
  UNIQUE (entity_id, source_revision_id),
  FOREIGN KEY (entity_id, entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (source_id, source_revision_id)
    REFERENCES public.kb_source_revisions(source_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE public.kb_homeopathic_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repertory_entity_id uuid NOT NULL
    REFERENCES public.kb_entities(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  native_rubric_code text NOT NULL
    CHECK (
      btrim(native_rubric_code) <> ''
       AND octet_length(native_rubric_code) <= 512
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repertory_entity_id, id),
  UNIQUE (repertory_entity_id, native_rubric_code)
);

CREATE UNIQUE INDEX kb_homeopathic_repertory_details_source_code_idx
  ON public.kb_homeopathic_repertory_revision_details(
    source_revision_id,
    public.kb_homeopathic_source_term_key_v1(source_repertory_code)
  );

CREATE UNIQUE INDEX kb_homeopathic_rubrics_term_key_idx
  ON public.kb_homeopathic_rubrics(
    repertory_entity_id,
    public.kb_homeopathic_source_term_key_v1(native_rubric_code)
  );

CREATE TABLE public.kb_homeopathic_rubric_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repertory_entity_id uuid NOT NULL,
  repertory_revision_id uuid NOT NULL,
  rubric_id uuid NOT NULL,
  rubric_schema_version integer NOT NULL DEFAULT 1
    CHECK (rubric_schema_version = 1),
  parent_rubric_id uuid,
  rubric_text text NOT NULL
    CHECK (
      btrim(rubric_text) <> ''
       AND octet_length(rubric_text) <= 16384
    ),
  rubric_domain text NOT NULL
    CHECK (rubric_domain IN (
      'general', 'mind', 'modality', 'location', 'sensation',
      'concomitant', 'other_source_native'
    )),
  sibling_order integer NOT NULL CHECK (sibling_order BETWEEN 1 AND 1000000),
  source_locator text NOT NULL
    CHECK (
      btrim(source_locator) <> ''
       AND octet_length(source_locator) <= 4096
    ),
  rubric_content_hash text NOT NULL
    CHECK (rubric_content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repertory_entity_id, repertory_revision_id, id),
  UNIQUE (repertory_entity_id, repertory_revision_id, rubric_id),
  FOREIGN KEY (repertory_entity_id, repertory_revision_id)
    REFERENCES public.kb_homeopathic_repertory_revision_details(
      entity_id, entity_revision_id
    ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (repertory_entity_id, rubric_id)
    REFERENCES public.kb_homeopathic_rubrics(repertory_entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (
    repertory_entity_id, repertory_revision_id, parent_rubric_id
  ) REFERENCES public.kb_homeopathic_rubric_revisions(
    repertory_entity_id, repertory_revision_id, rubric_id
  ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CHECK (parent_rubric_id IS NULL OR parent_rubric_id <> rubric_id)
);

CREATE UNIQUE INDEX kb_homeopathic_rubric_revisions_sibling_order_idx
  ON public.kb_homeopathic_rubric_revisions(
    repertory_entity_id, repertory_revision_id, parent_rubric_id, sibling_order
  ) NULLS NOT DISTINCT;

CREATE TABLE public.kb_homeopathic_grade_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repertory_entity_id uuid NOT NULL,
  repertory_revision_id uuid NOT NULL,
  grade_schema_version integer NOT NULL DEFAULT 1
    CHECK (grade_schema_version = 1),
  source_grade_code text NOT NULL
    CHECK (
      btrim(source_grade_code) <> ''
       AND octet_length(source_grade_code) <= 512
    ),
  source_grade_label text NOT NULL
    CHECK (
      btrim(source_grade_label) <> ''
       AND octet_length(source_grade_label) <= 2048
    ),
  grade_order integer NOT NULL CHECK (grade_order BETWEEN 1 AND 256),
  source_locator text NOT NULL
    CHECK (
      btrim(source_locator) <> ''
       AND octet_length(source_locator) <= 4096
    ),
  grade_content_hash text NOT NULL
    CHECK (grade_content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repertory_entity_id, repertory_revision_id, id),
  UNIQUE (repertory_entity_id, repertory_revision_id, source_grade_code),
  UNIQUE (repertory_entity_id, repertory_revision_id, grade_order),
  FOREIGN KEY (repertory_entity_id, repertory_revision_id)
    REFERENCES public.kb_homeopathic_repertory_revision_details(
      entity_id, entity_revision_id
    ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX kb_homeopathic_grade_definitions_term_key_idx
  ON public.kb_homeopathic_grade_definitions(
    repertory_entity_id,
    repertory_revision_id,
    public.kb_homeopathic_source_term_key_v1(source_grade_code)
  );

CREATE TABLE public.kb_homeopathic_repertory_remedies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repertory_entity_id uuid NOT NULL,
  repertory_revision_id uuid NOT NULL,
  remedy_schema_version integer NOT NULL DEFAULT 1
    CHECK (remedy_schema_version = 1),
  remedy_entity_id uuid NOT NULL,
  remedy_revision_id uuid NOT NULL,
  source_remedy_code text NOT NULL
    CHECK (
      btrim(source_remedy_code) <> ''
       AND octet_length(source_remedy_code) <= 512
    ),
  source_remedy_name text NOT NULL
    CHECK (
      btrim(source_remedy_name) <> ''
       AND octet_length(source_remedy_name) <= 4096
    ),
  source_remedy_aliases text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (public.kb_homeopathic_alias_array_is_valid_v1(source_remedy_aliases)),
  source_locator text NOT NULL
    CHECK (
      btrim(source_locator) <> ''
       AND octet_length(source_locator) <= 4096
    ),
  remedy_content_hash text NOT NULL
    CHECK (remedy_content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repertory_entity_id, repertory_revision_id, id),
  UNIQUE (repertory_entity_id, repertory_revision_id, source_remedy_code),
  UNIQUE (
    repertory_entity_id, repertory_revision_id,
    remedy_entity_id
  ),
  FOREIGN KEY (repertory_entity_id, repertory_revision_id)
    REFERENCES public.kb_homeopathic_repertory_revision_details(
      entity_id, entity_revision_id
    ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (remedy_entity_id, remedy_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX kb_homeopathic_repertory_remedies_term_key_idx
  ON public.kb_homeopathic_repertory_remedies(
    repertory_entity_id,
    repertory_revision_id,
    public.kb_homeopathic_source_term_key_v1(source_remedy_code)
  );

CREATE TABLE public.kb_homeopathic_rubric_remedy_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repertory_entity_id uuid NOT NULL,
  repertory_revision_id uuid NOT NULL,
  assignment_schema_version integer NOT NULL DEFAULT 1
    CHECK (assignment_schema_version = 1),
  rubric_revision_id uuid NOT NULL,
  repertory_remedy_id uuid NOT NULL,
  grade_definition_id uuid NOT NULL,
  source_locator text NOT NULL
    CHECK (
      btrim(source_locator) <> ''
       AND octet_length(source_locator) <= 4096
    ),
  assignment_content_hash text NOT NULL
    CHECK (assignment_content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repertory_entity_id, repertory_revision_id, id),
  UNIQUE (
    repertory_entity_id, repertory_revision_id,
    rubric_revision_id, repertory_remedy_id
  ),
  FOREIGN KEY (repertory_entity_id, repertory_revision_id)
    REFERENCES public.kb_homeopathic_repertory_revision_details(
      entity_id, entity_revision_id
    ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (
    repertory_entity_id, repertory_revision_id, rubric_revision_id
  ) REFERENCES public.kb_homeopathic_rubric_revisions(
    repertory_entity_id, repertory_revision_id, id
  ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (
    repertory_entity_id, repertory_revision_id, repertory_remedy_id
  ) REFERENCES public.kb_homeopathic_repertory_remedies(
    repertory_entity_id, repertory_revision_id, id
  ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (
    repertory_entity_id, repertory_revision_id, grade_definition_id
  ) REFERENCES public.kb_homeopathic_grade_definitions(
    repertory_entity_id, repertory_revision_id, id
  ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX kb_homeopathic_repertory_details_source_revision_idx
  ON public.kb_homeopathic_repertory_revision_details(source_revision_id);
CREATE INDEX kb_homeopathic_rubrics_repertory_idx
  ON public.kb_homeopathic_rubrics(repertory_entity_id);
CREATE INDEX kb_homeopathic_rubric_revisions_repertory_idx
  ON public.kb_homeopathic_rubric_revisions(repertory_revision_id);
CREATE INDEX kb_homeopathic_rubric_revisions_rubric_idx
  ON public.kb_homeopathic_rubric_revisions(rubric_id);
CREATE INDEX kb_homeopathic_rubric_revisions_parent_idx
  ON public.kb_homeopathic_rubric_revisions(parent_rubric_id)
  WHERE parent_rubric_id IS NOT NULL;
CREATE INDEX kb_homeopathic_grade_definitions_repertory_idx
  ON public.kb_homeopathic_grade_definitions(repertory_revision_id);
CREATE INDEX kb_homeopathic_repertory_remedies_repertory_idx
  ON public.kb_homeopathic_repertory_remedies(repertory_revision_id);
CREATE INDEX kb_homeopathic_repertory_remedies_target_revision_idx
  ON public.kb_homeopathic_repertory_remedies(remedy_revision_id);
CREATE INDEX kb_homeopathic_assignments_repertory_idx
  ON public.kb_homeopathic_rubric_remedy_assignments(repertory_revision_id);
CREATE INDEX kb_homeopathic_assignments_rubric_idx
  ON public.kb_homeopathic_rubric_remedy_assignments(rubric_revision_id);
CREATE INDEX kb_homeopathic_assignments_remedy_idx
  ON public.kb_homeopathic_rubric_remedy_assignments(repertory_remedy_id);
CREATE INDEX kb_homeopathic_assignments_grade_idx
  ON public.kb_homeopathic_rubric_remedy_assignments(grade_definition_id);

CREATE OR REPLACE FUNCTION public.kb_homeopathic_source_revision_payload_v1(
  _source_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'source_id', source.id,
    'source_revision_id', revision.id,
    'canonical_key', source.canonical_key,
    'revision_no', revision.revision_no,
    'source_type', revision.source_type,
    'title', revision.title,
    'authors', revision.authors,
    'publisher', revision.publisher,
    'edition', revision.edition,
    'published_on', revision.published_on,
    'url', revision.url,
    'doi', revision.doi,
    'pmid', revision.pmid,
    'isbn', revision.isbn,
    'retrieved_on', revision.retrieved_on,
    'file_sha256', revision.file_sha256,
    'rights_status', revision.rights_status,
    'archive_location', revision.archive_location,
    'content_hash', revision.content_hash,
    'metadata_hash', public.kb_release_manifest_hash_v1(revision.metadata)
  ))
    FROM public.kb_source_revisions revision
    JOIN public.kb_sources source ON source.id = revision.source_id
   WHERE revision.id = _source_revision_id
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_remedy_entity_revision_payload_v1(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'entity_id', entity.id,
    'entity_revision_id', revision.id,
    'entity_type_code', entity.entity_type_code,
    'canonical_key', entity.canonical_key,
    'revision_no', revision.revision_no,
    'display_name', revision.display_name,
    'summary', revision.summary,
    'description_markdown', revision.description_markdown,
    'origin_type', revision.origin_type,
    'content_hash', revision.content_hash,
    'metadata_hash', public.kb_release_manifest_hash_v1(revision.metadata)
  ))
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = _entity_revision_id
   WHERE entity.id = _entity_id
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_repertory_revision_payload_v1(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'repertory_schema_version', detail.repertory_schema_version,
    'entity', jsonb_build_object(
      'entity_id', entity.id,
      'entity_revision_id', revision.id,
      'entity_type_code', entity.entity_type_code,
      'canonical_key', entity.canonical_key
    ),
    'revision', jsonb_build_object(
      'revision_no', revision.revision_no,
      'display_name', revision.display_name,
      'summary', revision.summary,
      'description_markdown', revision.description_markdown,
      'origin_type', revision.origin_type,
      'metadata_hash', public.kb_release_manifest_hash_v1(revision.metadata)
    ),
    'source', public.kb_homeopathic_source_revision_payload_v1(
      detail.source_revision_id
    ),
    'source_binding', jsonb_build_object(
      'source_id', detail.source_id,
      'source_revision_id', detail.source_revision_id,
      'source_repertory_code', detail.source_repertory_code,
      'source_language_code', detail.source_language_code,
      'source_locator', detail.source_locator
    )
  ))
    FROM public.kb_homeopathic_repertory_revision_details detail
    JOIN public.kb_entities entity ON entity.id = detail.entity_id
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = detail.entity_id
     AND revision.id = detail.entity_revision_id
   WHERE detail.entity_id = _entity_id
     AND detail.entity_revision_id = _entity_revision_id
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_repertory_revision_hash_v1(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(
    public.kb_homeopathic_repertory_revision_payload_v1(
      _entity_id, _entity_revision_id
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_rubric_revision_payload_v1(
  _rubric_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'rubric_schema_version', revision.rubric_schema_version,
    'repertory_entity_id', revision.repertory_entity_id,
    'repertory_revision_id', revision.repertory_revision_id,
    'repertory', jsonb_build_object(
      'payload', public.kb_homeopathic_repertory_revision_payload_v1(
        revision.repertory_entity_id, revision.repertory_revision_id
      ),
      'content_hash', repertory_revision.content_hash
    ),
    'rubric_id', rubric.id,
    'native_rubric_code', rubric.native_rubric_code,
    'parent_rubric_id', parent_rubric.id,
    'parent_native_rubric_code', parent_rubric.native_rubric_code,
    'parent_rubric_content_hash', parent_revision.rubric_content_hash,
    'rubric_text', revision.rubric_text,
    'rubric_domain', revision.rubric_domain,
    'sibling_order', revision.sibling_order,
    'source_locator', revision.source_locator
  ))
    FROM public.kb_homeopathic_rubric_revisions revision
    JOIN public.kb_homeopathic_repertory_revision_details detail
      ON detail.entity_id = revision.repertory_entity_id
     AND detail.entity_revision_id = revision.repertory_revision_id
    JOIN public.kb_entity_revisions repertory_revision
      ON repertory_revision.entity_id = revision.repertory_entity_id
     AND repertory_revision.id = revision.repertory_revision_id
    JOIN public.kb_homeopathic_rubrics rubric
      ON rubric.repertory_entity_id = revision.repertory_entity_id
     AND rubric.id = revision.rubric_id
    LEFT JOIN public.kb_homeopathic_rubrics parent_rubric
      ON parent_rubric.repertory_entity_id = revision.repertory_entity_id
     AND parent_rubric.id = revision.parent_rubric_id
    LEFT JOIN public.kb_homeopathic_rubric_revisions parent_revision
      ON parent_revision.repertory_entity_id = revision.repertory_entity_id
     AND parent_revision.repertory_revision_id = revision.repertory_revision_id
     AND parent_revision.rubric_id = revision.parent_rubric_id
   WHERE revision.id = _rubric_revision_id
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_rubric_revision_hash_v1(
  _rubric_revision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(
    public.kb_homeopathic_rubric_revision_payload_v1(_rubric_revision_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_grade_definition_payload_v1(
  _grade_definition_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'grade_schema_version', grade.grade_schema_version,
    'repertory_entity_id', grade.repertory_entity_id,
    'repertory_revision_id', grade.repertory_revision_id,
    'repertory', jsonb_build_object(
      'payload', public.kb_homeopathic_repertory_revision_payload_v1(
        grade.repertory_entity_id, grade.repertory_revision_id
      ),
      'content_hash', repertory_revision.content_hash
    ),
    'grade_definition_id', grade.id,
    'source_grade_code', grade.source_grade_code,
    'source_grade_label', grade.source_grade_label,
    'grade_order', grade.grade_order,
    'source_locator', grade.source_locator
  ))
    FROM public.kb_homeopathic_grade_definitions grade
    JOIN public.kb_homeopathic_repertory_revision_details detail
      ON detail.entity_id = grade.repertory_entity_id
     AND detail.entity_revision_id = grade.repertory_revision_id
    JOIN public.kb_entity_revisions repertory_revision
      ON repertory_revision.entity_id = grade.repertory_entity_id
     AND repertory_revision.id = grade.repertory_revision_id
   WHERE grade.id = _grade_definition_id
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_grade_definition_hash_v1(
  _grade_definition_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(
    public.kb_homeopathic_grade_definition_payload_v1(_grade_definition_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_repertory_remedy_payload_v1(
  _repertory_remedy_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'remedy_schema_version', remedy.remedy_schema_version,
    'repertory_entity_id', remedy.repertory_entity_id,
    'repertory_revision_id', remedy.repertory_revision_id,
    'repertory', jsonb_build_object(
      'payload', public.kb_homeopathic_repertory_revision_payload_v1(
        remedy.repertory_entity_id, remedy.repertory_revision_id
      ),
      'content_hash', repertory_revision.content_hash
    ),
    'repertory_remedy_id', remedy.id,
    'source_remedy_code', remedy.source_remedy_code,
    'source_remedy_name', remedy.source_remedy_name,
    'source_remedy_aliases', to_jsonb(remedy.source_remedy_aliases),
    'source_locator', remedy.source_locator,
    'remedy_entity_revision',
      public.kb_homeopathic_remedy_entity_revision_payload_v1(
        remedy.remedy_entity_id, remedy.remedy_revision_id
      )
  ))
    FROM public.kb_homeopathic_repertory_remedies remedy
    JOIN public.kb_homeopathic_repertory_revision_details detail
      ON detail.entity_id = remedy.repertory_entity_id
     AND detail.entity_revision_id = remedy.repertory_revision_id
    JOIN public.kb_entity_revisions repertory_revision
      ON repertory_revision.entity_id = remedy.repertory_entity_id
     AND repertory_revision.id = remedy.repertory_revision_id
   WHERE remedy.id = _repertory_remedy_id
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_repertory_remedy_hash_v1(
  _repertory_remedy_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(
    public.kb_homeopathic_repertory_remedy_payload_v1(_repertory_remedy_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_assignment_payload_v1(
  _assignment_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'assignment_schema_version', assignment.assignment_schema_version,
    'repertory_entity_id', assignment.repertory_entity_id,
    'repertory_revision_id', assignment.repertory_revision_id,
    'repertory', jsonb_build_object(
      'payload', public.kb_homeopathic_repertory_revision_payload_v1(
        assignment.repertory_entity_id, assignment.repertory_revision_id
      ),
      'content_hash', repertory_revision.content_hash
    ),
    'assignment_id', assignment.id,
    'rubric', jsonb_build_object(
      'payload', public.kb_homeopathic_rubric_revision_payload_v1(
        assignment.rubric_revision_id
      ),
      'content_hash', rubric.rubric_content_hash
    ),
    'remedy', jsonb_build_object(
      'payload', public.kb_homeopathic_repertory_remedy_payload_v1(
        assignment.repertory_remedy_id
      ),
      'content_hash', remedy.remedy_content_hash
    ),
    'grade', jsonb_build_object(
      'payload', public.kb_homeopathic_grade_definition_payload_v1(
        assignment.grade_definition_id
      ),
      'content_hash', grade.grade_content_hash
    ),
    'source_locator', assignment.source_locator
  ))
    FROM public.kb_homeopathic_rubric_remedy_assignments assignment
    JOIN public.kb_homeopathic_repertory_revision_details detail
      ON detail.entity_id = assignment.repertory_entity_id
     AND detail.entity_revision_id = assignment.repertory_revision_id
    JOIN public.kb_entity_revisions repertory_revision
      ON repertory_revision.entity_id = assignment.repertory_entity_id
     AND repertory_revision.id = assignment.repertory_revision_id
    JOIN public.kb_homeopathic_rubric_revisions rubric
      ON rubric.repertory_entity_id = assignment.repertory_entity_id
     AND rubric.repertory_revision_id = assignment.repertory_revision_id
     AND rubric.id = assignment.rubric_revision_id
    JOIN public.kb_homeopathic_repertory_remedies remedy
      ON remedy.repertory_entity_id = assignment.repertory_entity_id
     AND remedy.repertory_revision_id = assignment.repertory_revision_id
     AND remedy.id = assignment.repertory_remedy_id
    JOIN public.kb_homeopathic_grade_definitions grade
      ON grade.repertory_entity_id = assignment.repertory_entity_id
     AND grade.repertory_revision_id = assignment.repertory_revision_id
     AND grade.id = assignment.grade_definition_id
   WHERE assignment.id = _assignment_id
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_assignment_hash_v1(
  _assignment_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_manifest_hash_v1(
    public.kb_homeopathic_assignment_payload_v1(_assignment_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_repertory_revision_base_is_valid(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  entity_type text;
  entity_origin_type text;
  entity_metadata_origin text;
  repertory_status text;
  source_status text;
  source_rights_status text;
  stored_hash text;
BEGIN
  SELECT entity.entity_type_code, revision.review_status,
         source_revision.review_status, source_revision.rights_status,
         revision.content_hash,
         revision.origin_type, entity.metadata ->> 'origin_type'
    INTO entity_type, repertory_status, source_status, source_rights_status,
         stored_hash,
         entity_origin_type, entity_metadata_origin
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = _entity_revision_id
    JOIN public.kb_homeopathic_repertory_revision_details detail
      ON detail.entity_id = entity.id
     AND detail.entity_revision_id = revision.id
    JOIN public.kb_source_revisions source_revision
      ON source_revision.source_id = detail.source_id
     AND source_revision.id = detail.source_revision_id
   WHERE entity.id = _entity_id;

  IF NOT FOUND
     OR entity_type <> 'homeopathic_repertory'
     OR entity_origin_type IN ('import', 'parser', 'ai')
     OR COALESCE(entity_metadata_origin, '') IN ('import', 'parser', 'ai')
     OR source_rights_status NOT IN ('own_content', 'licensed', 'public_domain')
     OR public.kb_clinical_rule_dependency_status_is_valid_v1(
          repertory_status, source_status
        ) IS DISTINCT FROM true
     OR public.kb_homeopathic_repertory_revision_payload_v1(
          _entity_id, _entity_revision_id
        ) IS NULL
  THEN
    RETURN false;
  END IF;

  RETURN stored_hash = public.kb_homeopathic_repertory_revision_hash_v1(
    _entity_id, _entity_revision_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_rubric_is_valid(_rubric_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.kb_homeopathic_rubrics rubric
      JOIN public.kb_entities repertory
        ON repertory.id = rubric.repertory_entity_id
     WHERE rubric.id = _rubric_id
       AND repertory.entity_type_code = 'homeopathic_repertory'
       AND EXISTS (
         SELECT 1
           FROM public.kb_homeopathic_rubric_revisions revision
          WHERE revision.repertory_entity_id = rubric.repertory_entity_id
            AND revision.rubric_id = rubric.id
       )
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_rubric_revision_is_valid(
  _rubric_revision_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  target public.kb_homeopathic_rubric_revisions%ROWTYPE;
  order_is_contiguous boolean;
  hierarchy_has_cycle boolean;
BEGIN
  SELECT revision.*
    INTO target
    FROM public.kb_homeopathic_rubric_revisions revision
   WHERE revision.id = _rubric_revision_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF public.kb_homeopathic_repertory_revision_base_is_valid(
       target.repertory_entity_id, target.repertory_revision_id
     ) IS DISTINCT FROM true
     OR public.kb_homeopathic_rubric_is_valid(target.rubric_id)
        IS DISTINCT FROM true
     OR (
       target.parent_rubric_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
           FROM public.kb_homeopathic_rubric_revisions parent
          WHERE parent.repertory_entity_id = target.repertory_entity_id
            AND parent.repertory_revision_id = target.repertory_revision_id
            AND parent.rubric_id = target.parent_rubric_id
       )
     )
  THEN
    RETURN false;
  END IF;

  SELECT count(*) > 0
         AND min(revision.sibling_order) = 1
         AND max(revision.sibling_order) = count(*)
    INTO order_is_contiguous
    FROM public.kb_homeopathic_rubric_revisions revision
   WHERE revision.repertory_entity_id = target.repertory_entity_id
     AND revision.repertory_revision_id = target.repertory_revision_id
     AND revision.parent_rubric_id IS NOT DISTINCT FROM target.parent_rubric_id;
  IF order_is_contiguous IS DISTINCT FROM true THEN
    RETURN false;
  END IF;

  WITH RECURSIVE lineage AS (
    SELECT revision.rubric_id, revision.parent_rubric_id,
           ARRAY[revision.rubric_id]::uuid[] AS path,
           false AS has_cycle
      FROM public.kb_homeopathic_rubric_revisions revision
     WHERE revision.id = target.id
    UNION ALL
    SELECT parent.rubric_id, parent.parent_rubric_id,
           lineage.path || parent.rubric_id,
           parent.rubric_id = ANY(lineage.path)
      FROM lineage
      JOIN public.kb_homeopathic_rubric_revisions parent
        ON parent.repertory_entity_id = target.repertory_entity_id
       AND parent.repertory_revision_id = target.repertory_revision_id
       AND parent.rubric_id = lineage.parent_rubric_id
     WHERE NOT lineage.has_cycle
  )
  SELECT COALESCE(bool_or(lineage.has_cycle), false)
    INTO hierarchy_has_cycle
    FROM lineage;

  RETURN NOT hierarchy_has_cycle
     AND public.kb_homeopathic_rubric_revision_payload_v1(target.id) IS NOT NULL
     AND target.rubric_content_hash =
         public.kb_homeopathic_rubric_revision_hash_v1(target.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_grade_definition_is_valid(
  _grade_definition_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  target public.kb_homeopathic_grade_definitions%ROWTYPE;
  order_is_contiguous boolean;
BEGIN
  SELECT grade.*
    INTO target
    FROM public.kb_homeopathic_grade_definitions grade
   WHERE grade.id = _grade_definition_id;
  IF NOT FOUND
     OR public.kb_homeopathic_repertory_revision_base_is_valid(
          target.repertory_entity_id, target.repertory_revision_id
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  SELECT count(*) > 0
         AND min(grade.grade_order) = 1
         AND max(grade.grade_order) = count(*)
    INTO order_is_contiguous
    FROM public.kb_homeopathic_grade_definitions grade
   WHERE grade.repertory_entity_id = target.repertory_entity_id
     AND grade.repertory_revision_id = target.repertory_revision_id;

  RETURN order_is_contiguous IS TRUE
     AND public.kb_homeopathic_grade_definition_payload_v1(target.id) IS NOT NULL
     AND target.grade_content_hash =
         public.kb_homeopathic_grade_definition_hash_v1(target.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_remedy_terms_are_unique_v1(
  _repertory_entity_id uuid,
  _repertory_revision_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  WITH source_terms AS (
    SELECT remedy.id,
           public.kb_homeopathic_source_term_key_v1(term.value) AS term_key
      FROM public.kb_homeopathic_repertory_remedies remedy
      CROSS JOIN LATERAL unnest(
        ARRAY[remedy.source_remedy_code] || remedy.source_remedy_aliases
      ) term(value)
     WHERE remedy.repertory_entity_id = _repertory_entity_id
       AND remedy.repertory_revision_id = _repertory_revision_id
  )
  SELECT NOT EXISTS (
    SELECT 1
      FROM source_terms
     GROUP BY source_terms.term_key
    HAVING count(*) > 1
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_repertory_remedy_is_valid(
  _repertory_remedy_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  target public.kb_homeopathic_repertory_remedies%ROWTYPE;
  repertory_status text;
  remedy_type text;
  remedy_status text;
  remedy_origin_type text;
  remedy_entity_metadata_origin text;
BEGIN
  SELECT remedy.*
    INTO target
    FROM public.kb_homeopathic_repertory_remedies remedy
   WHERE remedy.id = _repertory_remedy_id;
  IF NOT FOUND
     OR public.kb_homeopathic_repertory_revision_base_is_valid(
          target.repertory_entity_id, target.repertory_revision_id
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  SELECT repertory_revision.review_status,
         remedy_entity.entity_type_code, remedy_revision.review_status,
         remedy_revision.origin_type, remedy_entity.metadata ->> 'origin_type'
    INTO repertory_status, remedy_type, remedy_status,
         remedy_origin_type, remedy_entity_metadata_origin
    FROM public.kb_entity_revisions repertory_revision
    JOIN public.kb_entities remedy_entity
      ON remedy_entity.id = target.remedy_entity_id
    JOIN public.kb_entity_revisions remedy_revision
      ON remedy_revision.entity_id = remedy_entity.id
     AND remedy_revision.id = target.remedy_revision_id
   WHERE repertory_revision.entity_id = target.repertory_entity_id
     AND repertory_revision.id = target.repertory_revision_id;

  IF NOT FOUND
     OR remedy_type <> 'homeopathic_remedy'
     OR remedy_origin_type IN ('import', 'parser', 'ai')
     OR COALESCE(remedy_entity_metadata_origin, '') IN ('import', 'parser', 'ai')
     OR public.kb_clinical_rule_dependency_status_is_valid_v1(
          repertory_status, remedy_status
        ) IS DISTINCT FROM true
     OR EXISTS (
       SELECT 1
         FROM public.kb_homeopathic_revision_details potency_detail
        WHERE potency_detail.entity_id = target.remedy_entity_id
          AND potency_detail.entity_revision_id = target.remedy_revision_id
     )
     OR public.kb_homeopathic_remedy_terms_are_unique_v1(
          target.repertory_entity_id, target.repertory_revision_id
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  RETURN public.kb_homeopathic_repertory_remedy_payload_v1(target.id) IS NOT NULL
     AND target.remedy_content_hash =
         public.kb_homeopathic_repertory_remedy_hash_v1(target.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_assignment_is_valid(
  _assignment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  target public.kb_homeopathic_rubric_remedy_assignments%ROWTYPE;
BEGIN
  SELECT assignment.*
    INTO target
    FROM public.kb_homeopathic_rubric_remedy_assignments assignment
   WHERE assignment.id = _assignment_id;
  IF NOT FOUND
     OR public.kb_homeopathic_repertory_revision_base_is_valid(
          target.repertory_entity_id, target.repertory_revision_id
        ) IS DISTINCT FROM true
     OR public.kb_homeopathic_rubric_revision_is_valid(
          target.rubric_revision_id
        ) IS DISTINCT FROM true
     OR public.kb_homeopathic_grade_definition_is_valid(
          target.grade_definition_id
        ) IS DISTINCT FROM true
     OR public.kb_homeopathic_repertory_remedy_is_valid(
          target.repertory_remedy_id
        ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  RETURN public.kb_homeopathic_assignment_payload_v1(target.id) IS NOT NULL
     AND target.assignment_content_hash =
         public.kb_homeopathic_assignment_hash_v1(target.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_homeopathic_repertory_revision_is_valid(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
BEGIN
  IF public.kb_homeopathic_repertory_revision_base_is_valid(
       _entity_id, _entity_revision_id
     ) IS DISTINCT FROM true
  THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
           SELECT 1 FROM public.kb_homeopathic_rubric_revisions revision
            WHERE revision.repertory_entity_id = _entity_id
              AND revision.repertory_revision_id = _entity_revision_id
         )
     AND EXISTS (
           SELECT 1 FROM public.kb_homeopathic_grade_definitions grade
            WHERE grade.repertory_entity_id = _entity_id
              AND grade.repertory_revision_id = _entity_revision_id
         )
     AND EXISTS (
           SELECT 1 FROM public.kb_homeopathic_repertory_remedies remedy
            WHERE remedy.repertory_entity_id = _entity_id
              AND remedy.repertory_revision_id = _entity_revision_id
         )
     AND EXISTS (
           SELECT 1 FROM public.kb_homeopathic_rubric_remedy_assignments assignment
            WHERE assignment.repertory_entity_id = _entity_id
              AND assignment.repertory_revision_id = _entity_revision_id
         )
     AND NOT EXISTS (
           SELECT 1 FROM public.kb_homeopathic_rubric_revisions revision
            WHERE revision.repertory_entity_id = _entity_id
              AND revision.repertory_revision_id = _entity_revision_id
              AND public.kb_homeopathic_rubric_revision_is_valid(revision.id)
                  IS DISTINCT FROM true
         )
     AND NOT EXISTS (
           SELECT 1 FROM public.kb_homeopathic_grade_definitions grade
            WHERE grade.repertory_entity_id = _entity_id
              AND grade.repertory_revision_id = _entity_revision_id
              AND public.kb_homeopathic_grade_definition_is_valid(grade.id)
                  IS DISTINCT FROM true
         )
     AND NOT EXISTS (
           SELECT 1 FROM public.kb_homeopathic_repertory_remedies remedy
            WHERE remedy.repertory_entity_id = _entity_id
              AND remedy.repertory_revision_id = _entity_revision_id
              AND public.kb_homeopathic_repertory_remedy_is_valid(remedy.id)
                  IS DISTINCT FROM true
         )
     AND NOT EXISTS (
           SELECT 1 FROM public.kb_homeopathic_rubric_remedy_assignments assignment
            WHERE assignment.repertory_entity_id = _entity_id
              AND assignment.repertory_revision_id = _entity_revision_id
              AND public.kb_homeopathic_assignment_is_valid(assignment.id)
                  IS DISTINCT FROM true
         );
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_homeopathic_repertory_revision_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH candidate_revisions AS (
    SELECT entity.id AS entity_id, revision.id AS entity_revision_id
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision ON revision.entity_id = entity.id
     WHERE entity.entity_type_code = 'homeopathic_repertory'
    UNION
    SELECT entity.id, NULL::uuid
      FROM public.kb_entities entity
     WHERE entity.entity_type_code = 'homeopathic_repertory'
       AND NOT EXISTS (
         SELECT 1
           FROM public.kb_entity_revisions revision
          WHERE revision.entity_id = entity.id
       )
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_homeopathic_repertory_revision_details detail
  )
  SELECT count(*)
    FROM candidate_revisions candidate
   WHERE public.kb_homeopathic_repertory_revision_is_valid(
           candidate.entity_id, candidate.entity_revision_id
         ) IS DISTINCT FROM true
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_homeopathic_rubric_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)
       FROM public.kb_homeopathic_rubrics rubric
      WHERE public.kb_homeopathic_rubric_is_valid(rubric.id)
            IS DISTINCT FROM true)
    +
    (SELECT count(*)
       FROM public.kb_homeopathic_rubric_revisions revision
      WHERE public.kb_homeopathic_rubric_revision_is_valid(revision.id)
            IS DISTINCT FROM true)
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_homeopathic_grade_definition_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(*)
    FROM public.kb_homeopathic_grade_definitions grade
   WHERE public.kb_homeopathic_grade_definition_is_valid(grade.id)
         IS DISTINCT FROM true
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_homeopathic_repertory_remedy_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)
       FROM public.kb_homeopathic_repertory_remedies remedy
      WHERE public.kb_homeopathic_repertory_remedy_is_valid(remedy.id)
            IS DISTINCT FROM true)
    +
    (SELECT count(*)
       FROM public.kb_entities entity
      WHERE entity.entity_type_code = 'homeopathic_remedy'
        AND COALESCE(entity.metadata ->> 'origin_type', '') IN (
          'import', 'parser', 'ai'
        ))
    +
    (SELECT count(*)
       FROM public.kb_entity_revisions revision
       JOIN public.kb_entities entity ON entity.id = revision.entity_id
      WHERE entity.entity_type_code = 'homeopathic_remedy'
        AND revision.origin_type IN ('import', 'parser', 'ai'))
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_homeopathic_assignment_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(*)
    FROM public.kb_homeopathic_rubric_remedy_assignments assignment
   WHERE public.kb_homeopathic_assignment_is_valid(assignment.id)
         IS DISTINCT FROM true
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_homeopathic_repertory_contract_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  changed_row jsonb;
  coordinating_revision_ids uuid[] := ARRAY[]::uuid[];
  dependency_revision_ids uuid[] := ARRAY[]::uuid[];
  source_revision_ids uuid[] := ARRAY[]::uuid[];
  locked_revision_id uuid;
  locked_source_revision_id uuid;
  locked_source_id uuid;
  locked_entity_id uuid;
  coordinating_status text;
BEGIN
  SELECT pg_get_userbyid(relclass.relowner)
    INTO STRICT table_owner
    FROM pg_class relclass
   WHERE relclass.oid = TG_RELID;
  IF current_user <> table_owner THEN
    RAISE EXCEPTION 'Homeopathic repertory contract writes require the database table owner';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'kb_homeopathic_repertory_revision_details' AND (
      to_jsonb(NEW) -> 'entity_id' IS DISTINCT FROM to_jsonb(OLD) -> 'entity_id'
      OR to_jsonb(NEW) -> 'entity_revision_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'entity_revision_id'
      OR to_jsonb(NEW) -> 'repertory_schema_version'
         IS DISTINCT FROM to_jsonb(OLD) -> 'repertory_schema_version'
      OR to_jsonb(NEW) -> 'source_id' IS DISTINCT FROM to_jsonb(OLD) -> 'source_id'
      OR to_jsonb(NEW) -> 'source_revision_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'source_revision_id'
      OR to_jsonb(NEW) -> 'created_at' IS DISTINCT FROM to_jsonb(OLD) -> 'created_at'
    ) THEN
      RAISE EXCEPTION 'Stable homeopathic repertory revision bindings are immutable';
    ELSIF TG_TABLE_NAME = 'kb_homeopathic_rubrics' AND (
      to_jsonb(NEW) -> 'id' IS DISTINCT FROM to_jsonb(OLD) -> 'id'
      OR to_jsonb(NEW) -> 'repertory_entity_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'repertory_entity_id'
      OR to_jsonb(NEW) -> 'native_rubric_code'
         IS DISTINCT FROM to_jsonb(OLD) -> 'native_rubric_code'
      OR to_jsonb(NEW) -> 'created_at' IS DISTINCT FROM to_jsonb(OLD) -> 'created_at'
    ) THEN
      RAISE EXCEPTION 'Stable homeopathic rubric identity fields are immutable';
    ELSIF TG_TABLE_NAME = 'kb_homeopathic_rubric_revisions' AND (
      to_jsonb(NEW) -> 'id' IS DISTINCT FROM to_jsonb(OLD) -> 'id'
      OR to_jsonb(NEW) -> 'repertory_entity_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'repertory_entity_id'
      OR to_jsonb(NEW) -> 'repertory_revision_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'repertory_revision_id'
      OR to_jsonb(NEW) -> 'rubric_id' IS DISTINCT FROM to_jsonb(OLD) -> 'rubric_id'
      OR to_jsonb(NEW) -> 'rubric_schema_version'
         IS DISTINCT FROM to_jsonb(OLD) -> 'rubric_schema_version'
      OR to_jsonb(NEW) -> 'created_at' IS DISTINCT FROM to_jsonb(OLD) -> 'created_at'
    ) THEN
      RAISE EXCEPTION 'Stable homeopathic rubric revision fields are immutable';
    ELSIF TG_TABLE_NAME = 'kb_homeopathic_grade_definitions' AND (
      to_jsonb(NEW) -> 'id' IS DISTINCT FROM to_jsonb(OLD) -> 'id'
      OR to_jsonb(NEW) -> 'repertory_entity_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'repertory_entity_id'
      OR to_jsonb(NEW) -> 'repertory_revision_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'repertory_revision_id'
      OR to_jsonb(NEW) -> 'grade_schema_version'
         IS DISTINCT FROM to_jsonb(OLD) -> 'grade_schema_version'
      OR to_jsonb(NEW) -> 'created_at' IS DISTINCT FROM to_jsonb(OLD) -> 'created_at'
    ) THEN
      RAISE EXCEPTION 'Stable homeopathic grade definition fields are immutable';
    ELSIF TG_TABLE_NAME = 'kb_homeopathic_repertory_remedies' AND (
      to_jsonb(NEW) -> 'id' IS DISTINCT FROM to_jsonb(OLD) -> 'id'
      OR to_jsonb(NEW) -> 'repertory_entity_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'repertory_entity_id'
      OR to_jsonb(NEW) -> 'repertory_revision_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'repertory_revision_id'
      OR to_jsonb(NEW) -> 'remedy_schema_version'
         IS DISTINCT FROM to_jsonb(OLD) -> 'remedy_schema_version'
      OR to_jsonb(NEW) -> 'remedy_entity_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'remedy_entity_id'
      OR to_jsonb(NEW) -> 'remedy_revision_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'remedy_revision_id'
      OR to_jsonb(NEW) -> 'created_at' IS DISTINCT FROM to_jsonb(OLD) -> 'created_at'
    ) THEN
      RAISE EXCEPTION 'Stable homeopathic remedy mapping fields are immutable';
    ELSIF TG_TABLE_NAME = 'kb_homeopathic_rubric_remedy_assignments' AND (
      to_jsonb(NEW) -> 'id' IS DISTINCT FROM to_jsonb(OLD) -> 'id'
      OR to_jsonb(NEW) -> 'repertory_entity_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'repertory_entity_id'
      OR to_jsonb(NEW) -> 'repertory_revision_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'repertory_revision_id'
      OR to_jsonb(NEW) -> 'assignment_schema_version'
         IS DISTINCT FROM to_jsonb(OLD) -> 'assignment_schema_version'
      OR to_jsonb(NEW) -> 'rubric_revision_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'rubric_revision_id'
      OR to_jsonb(NEW) -> 'repertory_remedy_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'repertory_remedy_id'
      OR to_jsonb(NEW) -> 'grade_definition_id'
         IS DISTINCT FROM to_jsonb(OLD) -> 'grade_definition_id'
      OR to_jsonb(NEW) -> 'created_at' IS DISTINCT FROM to_jsonb(OLD) -> 'created_at'
    ) THEN
      RAISE EXCEPTION 'Stable homeopathic assignment fields are immutable';
    END IF;
  END IF;

  changed_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  IF TG_TABLE_NAME = 'kb_homeopathic_rubrics' THEN
    SELECT COALESCE(array_agg(DISTINCT revision.repertory_revision_id
                              ORDER BY revision.repertory_revision_id), ARRAY[]::uuid[])
      INTO coordinating_revision_ids
      FROM public.kb_homeopathic_rubric_revisions revision
     WHERE revision.rubric_id IN (
       CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.id END,
       CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.id END
     );
  ELSE
    coordinating_revision_ids := array_remove(ARRAY[
      (changed_row ->> CASE
        WHEN TG_TABLE_NAME = 'kb_homeopathic_repertory_revision_details'
          THEN 'entity_revision_id'
        ELSE 'repertory_revision_id'
      END)::uuid
    ], NULL);
  END IF;

  SELECT COALESCE(array_agg(DISTINCT revision_id ORDER BY revision_id), ARRAY[]::uuid[])
    INTO dependency_revision_ids
    FROM unnest(
      coordinating_revision_ids
      || CASE WHEN TG_TABLE_NAME = 'kb_homeopathic_repertory_remedies'
           THEN ARRAY[(changed_row ->> 'remedy_revision_id')::uuid]
           ELSE ARRAY[]::uuid[]
         END
    ) dependency(revision_id)
   WHERE revision_id IS NOT NULL;

  SELECT COALESCE(array_agg(DISTINCT revision_id ORDER BY revision_id), ARRAY[]::uuid[])
    INTO source_revision_ids
    FROM (
      SELECT (changed_row ->> 'source_revision_id')::uuid AS revision_id
       WHERE TG_TABLE_NAME = 'kb_homeopathic_repertory_revision_details'
      UNION
      SELECT detail.source_revision_id
        FROM public.kb_homeopathic_repertory_revision_details detail
       WHERE detail.entity_revision_id = ANY(coordinating_revision_ids)
    ) source_dependencies
   WHERE revision_id IS NOT NULL;

  FOREACH locked_source_revision_id IN ARRAY source_revision_ids
  LOOP
    PERFORM 1
      FROM public.kb_source_revisions revision
     WHERE revision.id = locked_source_revision_id
       FOR SHARE;
  END LOOP;

  FOREACH locked_revision_id IN ARRAY dependency_revision_ids
  LOOP
    PERFORM 1
      FROM public.kb_entity_revisions revision
     WHERE revision.id = locked_revision_id
       FOR SHARE;
  END LOOP;

  FOR locked_source_id IN
    SELECT DISTINCT revision.source_id
      FROM public.kb_source_revisions revision
     WHERE revision.id = ANY(source_revision_ids)
     ORDER BY revision.source_id
  LOOP
    UPDATE public.kb_sources source
       SET current_revision_id = source.current_revision_id
     WHERE source.id = locked_source_id;
  END LOOP;

  FOR locked_entity_id IN
    SELECT entity_id
      FROM (
        SELECT DISTINCT revision.entity_id
          FROM public.kb_entity_revisions revision
         WHERE revision.id = ANY(dependency_revision_ids)
        UNION
        SELECT (changed_row ->> 'repertory_entity_id')::uuid
         WHERE TG_TABLE_NAME = 'kb_homeopathic_rubrics'
      ) affected_entities
     WHERE entity_id IS NOT NULL
     ORDER BY entity_id
  LOOP
    UPDATE public.kb_entities entity
       SET current_revision_id = entity.current_revision_id
     WHERE entity.id = locked_entity_id;
  END LOOP;

  FOREACH locked_revision_id IN ARRAY coordinating_revision_ids
  LOOP
    SELECT revision.review_status
      INTO coordinating_status
      FROM public.kb_entity_revisions revision
     WHERE revision.id = locked_revision_id;
    IF coordinating_status IS NULL THEN
      RAISE EXCEPTION 'Homeopathic repertory content requires an existing coordinating revision';
    END IF;
    IF coordinating_status IN ('approved', 'released', 'superseded', 'withdrawn') THEN
      RAISE EXCEPTION 'Approved, released or historical homeopathic repertory content is immutable';
    END IF;

    UPDATE public.kb_entity_revisions revision
       SET content_hash = revision.content_hash
     WHERE revision.id = locked_revision_id;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_homeopathic_repertory_core_entity_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  old_entity_type text;
  new_entity_type text;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_entity_type := OLD.entity_type_code; END IF;
  IF TG_OP <> 'DELETE' THEN new_entity_type := NEW.entity_type_code; END IF;

  IF COALESCE(old_entity_type, '') NOT IN (
       'homeopathic_repertory', 'homeopathic_remedy'
     )
     AND COALESCE(new_entity_type, '') NOT IN (
       'homeopathic_repertory', 'homeopathic_remedy'
     )
  THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT pg_get_userbyid(relclass.relowner)
    INTO STRICT table_owner
    FROM pg_class relclass
   WHERE relclass.oid = TG_RELID;
  IF current_user <> table_owner THEN
    -- Status-only revision review takes a nested no-op parent lock.
    IF TG_OP = 'UPDATE'
       AND pg_trigger_depth() > 1
       AND to_jsonb(NEW) IS NOT DISTINCT FROM to_jsonb(OLD)
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Schema-only homeopathic repertory core entity writes require the database table owner';
  END IF;
  IF TG_OP <> 'DELETE'
     AND COALESCE(NEW.metadata ->> 'origin_type', '') IN ('import', 'parser', 'ai')
  THEN
    RAISE EXCEPTION 'Schema-only homeopathic repertory entities cannot use import, parser or ai origins';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_lock_homeopathic_repertory_revision_dependency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  old_revision_id uuid;
  new_revision_id uuid;
  old_parent_id uuid;
  new_parent_id uuid;
  affected_revision_ids uuid[];
  coordinating_revision_id uuid;
  locked_parent_id uuid;
  content_changed boolean;
  participates boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_revision_id := OLD.id;
    old_parent_id := CASE TG_TABLE_NAME
      WHEN 'kb_source_revisions' THEN (to_jsonb(OLD) ->> 'source_id')::uuid
      ELSE (to_jsonb(OLD) ->> 'entity_id')::uuid
    END;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_revision_id := NEW.id;
    new_parent_id := CASE TG_TABLE_NAME
      WHEN 'kb_source_revisions' THEN (to_jsonb(NEW) ->> 'source_id')::uuid
      ELSE (to_jsonb(NEW) ->> 'entity_id')::uuid
    END;
  END IF;

  content_changed := TG_OP <> 'UPDATE'
    OR (
      to_jsonb(NEW)
        - 'review_status' - 'reviewed_at' - 'reviewed_by'
        - 'released_at' - 'review_due_at'
    ) IS DISTINCT FROM (
      to_jsonb(OLD)
        - 'review_status' - 'reviewed_at' - 'reviewed_by'
        - 'released_at' - 'review_due_at'
    );

  IF TG_TABLE_NAME = 'kb_source_revisions' THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.kb_homeopathic_repertory_revision_details detail
       WHERE detail.source_revision_id IN (old_revision_id, new_revision_id)
    ) INTO participates;

    SELECT COALESCE(array_agg(DISTINCT detail.entity_revision_id
                              ORDER BY detail.entity_revision_id), ARRAY[]::uuid[])
      INTO affected_revision_ids
      FROM public.kb_homeopathic_repertory_revision_details detail
     WHERE detail.source_revision_id IN (old_revision_id, new_revision_id);
  ELSE
    SELECT EXISTS (
      SELECT 1
        FROM public.kb_homeopathic_repertory_revision_details detail
       WHERE detail.entity_revision_id IN (old_revision_id, new_revision_id)
    ) OR EXISTS (
      SELECT 1
        FROM public.kb_homeopathic_repertory_remedies remedy
       WHERE remedy.remedy_revision_id IN (old_revision_id, new_revision_id)
    ) OR EXISTS (
      SELECT 1
        FROM public.kb_entities entity
       WHERE entity.id IN (old_parent_id, new_parent_id)
         AND entity.entity_type_code IN (
           'homeopathic_repertory', 'homeopathic_remedy'
         )
    ) INTO participates;

    IF TG_OP <> 'DELETE'
       AND NEW.origin_type IN ('import', 'parser', 'ai')
       AND EXISTS (
         SELECT 1
           FROM public.kb_entities entity
          WHERE entity.id = NEW.entity_id
            AND entity.entity_type_code IN (
              'homeopathic_repertory', 'homeopathic_remedy'
            )
       )
    THEN
      RAISE EXCEPTION 'Schema-only homeopathic repertory revisions cannot use import, parser or ai origins';
    END IF;

    SELECT COALESCE(array_agg(DISTINCT remedy.repertory_revision_id
                              ORDER BY remedy.repertory_revision_id), ARRAY[]::uuid[])
      INTO affected_revision_ids
      FROM public.kb_homeopathic_repertory_remedies remedy
     WHERE remedy.remedy_revision_id IN (old_revision_id, new_revision_id)
       AND remedy.repertory_revision_id NOT IN (old_revision_id, new_revision_id);
  END IF;

  IF content_changed AND participates THEN
    SELECT pg_get_userbyid(relclass.relowner)
      INTO STRICT table_owner
      FROM pg_class relclass
     WHERE relclass.oid = TG_RELID;
    IF current_user <> table_owner THEN
      RAISE EXCEPTION 'Homeopathic repertory dependency content changes require the database table owner';
    END IF;
  END IF;

  IF NOT participates THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  FOR locked_parent_id IN
    SELECT DISTINCT parent_id
      FROM unnest(ARRAY[old_parent_id, new_parent_id]) parent(parent_id)
     WHERE parent_id IS NOT NULL
     ORDER BY parent_id
  LOOP
    IF TG_TABLE_NAME = 'kb_source_revisions' THEN
      UPDATE public.kb_sources source
         SET current_revision_id = source.current_revision_id
       WHERE source.id = locked_parent_id;
    ELSE
      UPDATE public.kb_entities entity
         SET current_revision_id = entity.current_revision_id
       WHERE entity.id = locked_parent_id;
    END IF;
  END LOOP;

  FOREACH coordinating_revision_id IN ARRAY affected_revision_ids
  LOOP
    UPDATE public.kb_entity_revisions revision
       SET content_hash = revision.content_hash
     WHERE revision.id = coordinating_revision_id
       AND revision.review_status NOT IN (
         'approved', 'released', 'superseded', 'withdrawn'
       );
    IF NOT FOUND THEN
      PERFORM 1
        FROM public.kb_entity_revisions revision
       WHERE revision.id = coordinating_revision_id
         FOR UPDATE;
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_homeopathic_repertory_revision_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.review_status = 'approved'
     AND NEW.review_status = 'draft'
     AND EXISTS (
       SELECT 1
         FROM public.kb_homeopathic_repertory_revision_details detail
        WHERE detail.entity_revision_id = OLD.id
     )
  THEN
    RAISE EXCEPTION 'Approved homeopathic repertory revisions cannot return to draft';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_validate_homeopathic_repertory_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  old_row jsonb := '{}'::jsonb;
  new_row jsonb := '{}'::jsonb;
  affected_repertory_entity_ids uuid[] := ARRAY[]::uuid[];
  affected_repertory_revision_ids uuid[] := ARRAY[]::uuid[];
  affected_rubric_ids uuid[] := ARRAY[]::uuid[];
  affected_dependency_revision_ids uuid[] := ARRAY[]::uuid[];
  affected_source_revision_ids uuid[] := ARRAY[]::uuid[];
  has_invalid boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;

  IF TG_OP = 'UPDATE' AND old_row IS NOT DISTINCT FROM new_row THEN
    RETURN NULL;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'kb_entities' THEN
      affected_repertory_entity_ids := array_remove(ARRAY[
        (old_row ->> 'id')::uuid,
        (new_row ->> 'id')::uuid
      ], NULL);
    WHEN 'kb_homeopathic_repertory_revision_details' THEN
      affected_repertory_entity_ids := array_remove(ARRAY[
        (old_row ->> 'entity_id')::uuid,
        (new_row ->> 'entity_id')::uuid
      ], NULL);
      affected_repertory_revision_ids := array_remove(ARRAY[
        (old_row ->> 'entity_revision_id')::uuid,
        (new_row ->> 'entity_revision_id')::uuid
      ], NULL);
      affected_source_revision_ids := array_remove(ARRAY[
        (old_row ->> 'source_revision_id')::uuid,
        (new_row ->> 'source_revision_id')::uuid
      ], NULL);
    WHEN 'kb_homeopathic_rubrics' THEN
      affected_repertory_entity_ids := array_remove(ARRAY[
        (old_row ->> 'repertory_entity_id')::uuid,
        (new_row ->> 'repertory_entity_id')::uuid
      ], NULL);
      affected_rubric_ids := array_remove(ARRAY[
        (old_row ->> 'id')::uuid,
        (new_row ->> 'id')::uuid
      ], NULL);
    WHEN 'kb_homeopathic_rubric_revisions' THEN
      affected_repertory_entity_ids := array_remove(ARRAY[
        (old_row ->> 'repertory_entity_id')::uuid,
        (new_row ->> 'repertory_entity_id')::uuid
      ], NULL);
      affected_repertory_revision_ids := array_remove(ARRAY[
        (old_row ->> 'repertory_revision_id')::uuid,
        (new_row ->> 'repertory_revision_id')::uuid
      ], NULL);
      affected_rubric_ids := array_remove(ARRAY[
        (old_row ->> 'rubric_id')::uuid,
        (new_row ->> 'rubric_id')::uuid,
        (old_row ->> 'parent_rubric_id')::uuid,
        (new_row ->> 'parent_rubric_id')::uuid
      ], NULL);
    WHEN 'kb_homeopathic_grade_definitions' THEN
      affected_repertory_entity_ids := array_remove(ARRAY[
        (old_row ->> 'repertory_entity_id')::uuid,
        (new_row ->> 'repertory_entity_id')::uuid
      ], NULL);
      affected_repertory_revision_ids := array_remove(ARRAY[
        (old_row ->> 'repertory_revision_id')::uuid,
        (new_row ->> 'repertory_revision_id')::uuid
      ], NULL);
    WHEN 'kb_homeopathic_rubric_remedy_assignments' THEN
      affected_repertory_entity_ids := array_remove(ARRAY[
        (old_row ->> 'repertory_entity_id')::uuid,
        (new_row ->> 'repertory_entity_id')::uuid
      ], NULL);
      affected_repertory_revision_ids := array_remove(ARRAY[
        (old_row ->> 'repertory_revision_id')::uuid,
        (new_row ->> 'repertory_revision_id')::uuid
      ], NULL);
    WHEN 'kb_homeopathic_repertory_remedies' THEN
      affected_repertory_entity_ids := array_remove(ARRAY[
        (old_row ->> 'repertory_entity_id')::uuid,
        (new_row ->> 'repertory_entity_id')::uuid
      ], NULL);
      affected_repertory_revision_ids := array_remove(ARRAY[
        (old_row ->> 'repertory_revision_id')::uuid,
        (new_row ->> 'repertory_revision_id')::uuid
      ], NULL);
      affected_dependency_revision_ids := array_remove(ARRAY[
        (old_row ->> 'remedy_revision_id')::uuid,
        (new_row ->> 'remedy_revision_id')::uuid
      ], NULL);
    WHEN 'kb_entity_revisions' THEN
      affected_dependency_revision_ids := array_remove(ARRAY[
        (old_row ->> 'id')::uuid,
        (new_row ->> 'id')::uuid
      ], NULL);
      affected_repertory_entity_ids := array_remove(ARRAY[
        (old_row ->> 'entity_id')::uuid,
        (new_row ->> 'entity_id')::uuid
      ], NULL);
    WHEN 'kb_source_revisions' THEN
      affected_source_revision_ids := array_remove(ARRAY[
        (old_row ->> 'id')::uuid,
        (new_row ->> 'id')::uuid
      ], NULL);
    ELSE
      RETURN NULL;
  END CASE;

  WITH affected_repertories AS MATERIALIZED (
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_homeopathic_repertory_revision_details detail
     WHERE detail.entity_revision_id = ANY(affected_repertory_revision_ids)
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_homeopathic_repertory_revision_details detail
     WHERE detail.entity_id = ANY(affected_repertory_entity_ids)
    UNION
    SELECT entity.id, revision.id
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision ON revision.entity_id = entity.id
     WHERE entity.entity_type_code = 'homeopathic_repertory'
       AND (
         entity.id = ANY(affected_repertory_entity_ids)
          OR revision.id = ANY(affected_dependency_revision_ids)
        )
    UNION
    SELECT entity.id, NULL::uuid
      FROM public.kb_entities entity
     WHERE entity.entity_type_code = 'homeopathic_repertory'
       AND entity.id = ANY(affected_repertory_entity_ids)
       AND NOT EXISTS (
         SELECT 1
           FROM public.kb_entity_revisions revision
          WHERE revision.entity_id = entity.id
       )
    UNION
    SELECT detail.entity_id, detail.entity_revision_id
      FROM public.kb_homeopathic_repertory_revision_details detail
     WHERE detail.source_revision_id = ANY(affected_source_revision_ids)
    UNION
    SELECT remedy.repertory_entity_id, remedy.repertory_revision_id
      FROM public.kb_homeopathic_repertory_remedies remedy
     WHERE remedy.remedy_revision_id = ANY(affected_dependency_revision_ids)
    UNION
    SELECT revision.repertory_entity_id, revision.repertory_revision_id
      FROM public.kb_homeopathic_rubric_revisions revision
     WHERE revision.rubric_id = ANY(affected_rubric_ids)
  ),
  invalid_targets AS (
    SELECT 1
      FROM affected_repertories target
     WHERE public.kb_homeopathic_repertory_revision_is_valid(
             target.entity_id, target.entity_revision_id
           ) IS DISTINCT FROM true
    UNION ALL
    SELECT 1
      FROM public.kb_homeopathic_rubrics rubric
     WHERE rubric.id = ANY(affected_rubric_ids)
       AND public.kb_homeopathic_rubric_is_valid(rubric.id)
           IS DISTINCT FROM true
  )
  SELECT EXISTS (SELECT 1 FROM invalid_targets) INTO has_invalid;

  IF has_invalid THEN
    RAISE EXCEPTION 'Homeopathic repertory contract is incomplete, cross-bound, cyclic, noncontiguous or has an invalid content hash';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_prevent_homeopathic_repertory_contract_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Homeopathic repertory contract tables cannot be truncated';
END;
$$;

CREATE TRIGGER kb_homeopathic_repertory_revision_details_protect_write
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.kb_homeopathic_repertory_revision_details
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_protect_homeopathic_repertory_contract_write();
CREATE TRIGGER kb_homeopathic_rubrics_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_homeopathic_rubrics
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_protect_homeopathic_repertory_contract_write();
CREATE TRIGGER kb_homeopathic_rubric_revisions_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_homeopathic_rubric_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_protect_homeopathic_repertory_contract_write();
CREATE TRIGGER kb_homeopathic_grade_definitions_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_homeopathic_grade_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_protect_homeopathic_repertory_contract_write();
CREATE TRIGGER kb_homeopathic_repertory_remedies_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_homeopathic_repertory_remedies
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_protect_homeopathic_repertory_contract_write();
CREATE TRIGGER kb_homeopathic_rubric_remedy_assignments_protect_write
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.kb_homeopathic_rubric_remedy_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_protect_homeopathic_repertory_contract_write();

CREATE TRIGGER kb_entity_revisions_lock_homeopathic_repertory_contract
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_entity_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_lock_homeopathic_repertory_revision_dependency();
CREATE TRIGGER kb_entities_protect_homeopathic_repertory_core_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_protect_homeopathic_repertory_core_entity_write();
CREATE TRIGGER kb_source_revisions_lock_homeopathic_repertory_contract
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_source_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_lock_homeopathic_repertory_revision_dependency();
CREATE TRIGGER kb_entity_revisions_protect_homeopathic_repertory_status
  BEFORE UPDATE ON public.kb_entity_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_protect_homeopathic_repertory_revision_status();

CREATE TRIGGER kb_homeopathic_repertory_revision_details_prevent_truncate
  BEFORE TRUNCATE ON public.kb_homeopathic_repertory_revision_details
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.kb_prevent_homeopathic_repertory_contract_truncate();
CREATE TRIGGER kb_homeopathic_rubrics_prevent_truncate
  BEFORE TRUNCATE ON public.kb_homeopathic_rubrics
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.kb_prevent_homeopathic_repertory_contract_truncate();
CREATE TRIGGER kb_homeopathic_rubric_revisions_prevent_truncate
  BEFORE TRUNCATE ON public.kb_homeopathic_rubric_revisions
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.kb_prevent_homeopathic_repertory_contract_truncate();
CREATE TRIGGER kb_homeopathic_grade_definitions_prevent_truncate
  BEFORE TRUNCATE ON public.kb_homeopathic_grade_definitions
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.kb_prevent_homeopathic_repertory_contract_truncate();
CREATE TRIGGER kb_homeopathic_repertory_remedies_prevent_truncate
  BEFORE TRUNCATE ON public.kb_homeopathic_repertory_remedies
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.kb_prevent_homeopathic_repertory_contract_truncate();
CREATE TRIGGER kb_homeopathic_rubric_remedy_assignments_prevent_truncate
  BEFORE TRUNCATE ON public.kb_homeopathic_rubric_remedy_assignments
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.kb_prevent_homeopathic_repertory_contract_truncate();

CREATE CONSTRAINT TRIGGER kb_homeopathic_repertory_revision_details_validate_contract
  AFTER INSERT OR UPDATE OR DELETE
  ON public.kb_homeopathic_repertory_revision_details
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_validate_homeopathic_repertory_contract();
CREATE CONSTRAINT TRIGGER kb_homeopathic_rubrics_validate_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_homeopathic_rubrics
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_validate_homeopathic_repertory_contract();
CREATE CONSTRAINT TRIGGER kb_homeopathic_rubric_revisions_validate_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_homeopathic_rubric_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_validate_homeopathic_repertory_contract();
CREATE CONSTRAINT TRIGGER kb_homeopathic_grade_definitions_validate_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_homeopathic_grade_definitions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_validate_homeopathic_repertory_contract();
CREATE CONSTRAINT TRIGGER kb_homeopathic_repertory_remedies_validate_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_homeopathic_repertory_remedies
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_validate_homeopathic_repertory_contract();
CREATE CONSTRAINT TRIGGER kb_homeopathic_rubric_remedy_assignments_validate_contract
  AFTER INSERT OR UPDATE OR DELETE
  ON public.kb_homeopathic_rubric_remedy_assignments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_validate_homeopathic_repertory_contract();
CREATE CONSTRAINT TRIGGER kb_entity_revisions_validate_homeopathic_repertory_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_entity_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_validate_homeopathic_repertory_contract();
CREATE CONSTRAINT TRIGGER kb_entities_validate_homeopathic_repertory_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_entities
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_validate_homeopathic_repertory_contract();
CREATE CONSTRAINT TRIGGER kb_source_revisions_validate_homeopathic_repertory_contract
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_source_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.kb_validate_homeopathic_repertory_contract();

ALTER TABLE public.kb_homeopathic_repertory_revision_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_homeopathic_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_homeopathic_rubric_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_homeopathic_grade_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_homeopathic_repertory_remedies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_homeopathic_rubric_remedy_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_homeopathic_repertory_revision_details_admin_read
  ON public.kb_homeopathic_repertory_revision_details
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY kb_homeopathic_rubrics_admin_read
  ON public.kb_homeopathic_rubrics
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY kb_homeopathic_rubric_revisions_admin_read
  ON public.kb_homeopathic_rubric_revisions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY kb_homeopathic_grade_definitions_admin_read
  ON public.kb_homeopathic_grade_definitions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY kb_homeopathic_repertory_remedies_admin_read
  ON public.kb_homeopathic_repertory_remedies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY kb_homeopathic_rubric_remedy_assignments_admin_read
  ON public.kb_homeopathic_rubric_remedy_assignments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE
  public.kb_homeopathic_repertory_revision_details,
  public.kb_homeopathic_rubrics,
  public.kb_homeopathic_rubric_revisions,
  public.kb_homeopathic_grade_definitions,
  public.kb_homeopathic_repertory_remedies,
  public.kb_homeopathic_rubric_remedy_assignments
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT SELECT ON TABLE
  public.kb_homeopathic_repertory_revision_details,
  public.kb_homeopathic_rubrics,
  public.kb_homeopathic_rubric_revisions,
  public.kb_homeopathic_grade_definitions,
  public.kb_homeopathic_repertory_remedies,
  public.kb_homeopathic_rubric_remedy_assignments
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.kb_homeopathic_source_term_key_v1(text)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_alias_array_is_valid_v1(text[])
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_source_revision_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_remedy_entity_revision_payload_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_repertory_revision_payload_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_repertory_revision_hash_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_rubric_revision_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_rubric_revision_hash_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_grade_definition_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_grade_definition_hash_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_repertory_remedy_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_repertory_remedy_hash_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_assignment_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_assignment_hash_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_repertory_revision_base_is_valid(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_rubric_is_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_rubric_revision_is_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_grade_definition_is_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_remedy_terms_are_unique_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_repertory_remedy_is_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_assignment_is_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_homeopathic_repertory_revision_is_valid(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_homeopathic_repertory_revision_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_homeopathic_rubric_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_homeopathic_grade_definition_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_homeopathic_repertory_remedy_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_homeopathic_assignment_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_homeopathic_repertory_contract_write()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_homeopathic_repertory_core_entity_write()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lock_homeopathic_repertory_revision_dependency()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_homeopathic_repertory_revision_status()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_validate_homeopathic_repertory_contract()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_prevent_homeopathic_repertory_contract_truncate()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

ALTER FUNCTION public.kb_export_wiki_snapshot()
  RENAME TO kb_export_wiki_snapshot_4b2b;
REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot_4b2b()
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
  snapshot := public.kb_export_wiki_snapshot_4b2b();
  RETURN jsonb_set(
    snapshot,
    '{validation}',
    (snapshot -> 'validation') || jsonb_build_object(
      'invalid_homeopathic_repertory_revisions',
        public.kb_invalid_homeopathic_repertory_revision_count(),
      'invalid_homeopathic_rubrics',
        public.kb_invalid_homeopathic_rubric_count(),
      'invalid_homeopathic_grade_definitions',
        public.kb_invalid_homeopathic_grade_definition_count(),
      'invalid_homeopathic_repertory_remedies',
        public.kb_invalid_homeopathic_repertory_remedy_count(),
      'invalid_homeopathic_rubric_remedy_assignments',
        public.kb_invalid_homeopathic_assignment_count()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT EXECUTE ON FUNCTION public.kb_export_wiki_snapshot()
  TO service_role;

COMMIT;
