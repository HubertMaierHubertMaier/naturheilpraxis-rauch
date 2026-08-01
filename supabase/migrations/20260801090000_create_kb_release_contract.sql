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
    'kb_nutrient_revision_details',
    'kb_preparation_revision_details',
    'kb_product_variant_revision_details',
    'kb_relation_candidates',
    'kb_relation_type_domains',
    'kb_relation_types',
    'kb_review_decisions',
    'kb_safety_candidates',
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
  IF to_regprocedure('public.kb_therapeutic_revision_is_valid(uuid,uuid)') IS NULL
     OR to_regprocedure('public.kb_invalid_entity_candidate_draft_promotion_count()') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Knowledge releases require the complete 50-table Wiki contract';
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
    RAISE EXCEPTION 'Knowledge releases require the exact 50-table Wiki boundary';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_release_canonical_jsonb_v1(_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  normalized jsonb;
BEGIN
  IF jsonb_typeof(_value) = 'object' THEN
    SELECT COALESCE(
             jsonb_object_agg(
               item.key,
               public.kb_release_canonical_jsonb_v1(item.value)
               ORDER BY item.key COLLATE "C"
             ),
             '{}'::jsonb
           )
      INTO normalized
      FROM jsonb_each(_value) item;
    RETURN normalized;
  ELSIF jsonb_typeof(_value) = 'array' THEN
    SELECT COALESCE(
             jsonb_agg(
               public.kb_release_canonical_jsonb_v1(item.value)
               ORDER BY item.ordinality
             ),
             '[]'::jsonb
           )
      INTO normalized
      FROM jsonb_array_elements(_value) WITH ORDINALITY item(value, ordinality);
    RETURN normalized;
  ELSIF jsonb_typeof(_value) = 'number' THEN
    RETURN to_jsonb(trim_scale((_value #>> '{}')::numeric));
  END IF;

  RETURN _value;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_release_manifest_hash_v1(_manifest jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT encode(
    sha256(convert_to(public.kb_release_canonical_jsonb_v1(_manifest)::text, 'UTF8')),
    'hex'
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_release_jsonb_has_exact_keys_v1(
  _value jsonb,
  _expected_keys text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT jsonb_typeof(_value) = 'object'
     AND _value ?& _expected_keys
     AND (SELECT count(*) FROM jsonb_object_keys(_value)) = cardinality(_expected_keys)
$$;

CREATE TABLE public.kb_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_key text NOT NULL UNIQUE
    CHECK (
      (release_key COLLATE "C") ~ '^release:[a-z0-9]+([._:-][a-z0-9]+)*$'
      AND length(release_key) <= 160
    ),
  contract_version integer NOT NULL DEFAULT 1 CHECK (contract_version = 1),
  release_status text NOT NULL DEFAULT 'build'
    CHECK (release_status IN ('build', 'sealed')),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  retrieval_eligible boolean NOT NULL DEFAULT false
    CHECK (NOT retrieval_eligible),
  is_active boolean NOT NULL DEFAULT false
    CHECK (NOT is_active),
  release_manifest jsonb NOT NULL
    CHECK (jsonb_typeof(release_manifest) = 'object'),
  release_manifest_hash text NOT NULL
    CHECK (release_manifest_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  sealed_at timestamptz,
  CHECK (
    (release_status = 'build' AND sealed_at IS NULL)
    OR (release_status = 'sealed' AND sealed_at IS NOT NULL)
  ),
  CHECK (
    release_manifest_hash = public.kb_release_manifest_hash_v1(release_manifest)
  )
);

CREATE TABLE public.kb_release_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL
    REFERENCES public.kb_releases(id) ON DELETE RESTRICT,
  item_order integer NOT NULL CHECK (item_order > 0),
  item_kind text NOT NULL CHECK (item_kind IN (
    'entity_revision', 'article_revision', 'assertion', 'source_revision'
  )),
  entity_id uuid,
  entity_revision_id uuid,
  article_id uuid,
  article_revision_id uuid,
  assertion_id uuid
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  source_id uuid,
  source_revision_id uuid,
  item_manifest jsonb NOT NULL
    CHECK (jsonb_typeof(item_manifest) = 'object'),
  item_manifest_hash text NOT NULL
    CHECK (item_manifest_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (entity_id, entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (article_id, article_revision_id)
    REFERENCES public.kb_article_revisions(article_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (source_id, source_revision_id)
    REFERENCES public.kb_source_revisions(source_id, id) ON DELETE RESTRICT,
  UNIQUE (release_id, item_order),
  CHECK ((entity_id IS NULL) = (entity_revision_id IS NULL)),
  CHECK ((article_id IS NULL) = (article_revision_id IS NULL)),
  CHECK ((source_id IS NULL) = (source_revision_id IS NULL)),
  CHECK (
    (entity_revision_id IS NOT NULL)::integer
    + (article_revision_id IS NOT NULL)::integer
    + (assertion_id IS NOT NULL)::integer
    + (source_revision_id IS NOT NULL)::integer = 1
  ),
  CHECK (
    (item_kind = 'entity_revision'
      AND entity_revision_id IS NOT NULL
      AND article_revision_id IS NULL
      AND assertion_id IS NULL
      AND source_revision_id IS NULL)
    OR (item_kind = 'article_revision'
      AND entity_revision_id IS NULL
      AND article_revision_id IS NOT NULL
      AND assertion_id IS NULL
      AND source_revision_id IS NULL)
    OR (item_kind = 'assertion'
      AND entity_revision_id IS NULL
      AND article_revision_id IS NULL
      AND assertion_id IS NOT NULL
      AND source_revision_id IS NULL)
    OR (item_kind = 'source_revision'
      AND entity_revision_id IS NULL
      AND article_revision_id IS NULL
      AND assertion_id IS NULL
      AND source_revision_id IS NOT NULL)
  ),
  CHECK (
    item_manifest_hash = public.kb_release_manifest_hash_v1(item_manifest)
  )
);

CREATE UNIQUE INDEX kb_release_items_entity_idx
  ON public.kb_release_items(release_id, entity_id)
  WHERE entity_revision_id IS NOT NULL;
CREATE UNIQUE INDEX kb_release_items_article_revision_idx
  ON public.kb_release_items(release_id, article_id, article_revision_id)
  WHERE article_revision_id IS NOT NULL;
CREATE UNIQUE INDEX kb_release_items_assertion_idx
  ON public.kb_release_items(release_id, assertion_id)
  WHERE assertion_id IS NOT NULL;
CREATE UNIQUE INDEX kb_release_items_source_revision_idx
  ON public.kb_release_items(release_id, source_id, source_revision_id)
  WHERE source_revision_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.kb_release_item_manifest_v1(
  _entity_id uuid,
  _entity_revision_id uuid,
  _article_id uuid,
  _article_revision_id uuid,
  _assertion_id uuid,
  _source_id uuid,
  _source_revision_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  reference_count integer :=
      (_entity_revision_id IS NOT NULL)::integer
    + (_article_revision_id IS NOT NULL)::integer
    + (_assertion_id IS NOT NULL)::integer
    + (_source_revision_id IS NOT NULL)::integer;
  manifest jsonb;
BEGIN
  IF reference_count <> 1
     OR (_entity_id IS NULL) <> (_entity_revision_id IS NULL)
     OR (_article_id IS NULL) <> (_article_revision_id IS NULL)
     OR (_source_id IS NULL) <> (_source_revision_id IS NULL)
  THEN
    RETURN NULL;
  END IF;

  IF _entity_revision_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'manifest_version', 1,
      'item_kind', 'entity_revision',
      'reference', jsonb_build_object(
        'entity_id', entity.id,
        'entity_revision_id', revision.id
      ),
      'entity', jsonb_build_object(
        'entity_type_code', entity.entity_type_code,
        'canonical_key', entity.canonical_key,
        'revision_no', revision.revision_no,
        'display_name', revision.display_name,
        'summary', revision.summary,
        'description_markdown', revision.description_markdown,
        'review_status', CASE
          WHEN revision.review_status IN ('released', 'superseded', 'withdrawn')
            THEN 'released'
          ELSE revision.review_status
        END,
        'origin_type', revision.origin_type,
        'content_hash', revision.content_hash,
        'revision_metadata_hash', public.kb_release_manifest_hash_v1(revision.metadata),
        'reviewed_at_epoch', CASE WHEN revision.reviewed_at IS NULL THEN NULL
          ELSE extract(epoch FROM revision.reviewed_at)::text END,
        'released_at_epoch', CASE WHEN revision.released_at IS NULL THEN NULL
          ELSE extract(epoch FROM revision.released_at)::text END,
        'review_due_at_epoch', CASE WHEN revision.review_due_at IS NULL THEN NULL
          ELSE extract(epoch FROM revision.review_due_at)::text END,
        'names', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', entity_name.name,
            'normalized_name', entity_name.normalized_name,
            'name_kind', entity_name.name_kind,
            'language_code', entity_name.language_code,
            'is_preferred', entity_name.is_preferred,
            'retired_at_epoch', CASE WHEN entity_name.retired_at IS NULL THEN NULL
              ELSE extract(epoch FROM entity_name.retired_at)::text END
          ) ORDER BY
            entity_name.language_code COLLATE "C",
            entity_name.normalized_name COLLATE "C",
            entity_name.name_kind COLLATE "C",
            entity_name.name COLLATE "C")
            FROM public.kb_entity_names entity_name
           WHERE entity_name.entity_id = entity.id
        ), '[]'::jsonb),
        'identifiers', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'scheme_code', identifier.scheme_code,
            'namespace', identifier.namespace,
            'value', identifier.value,
            'normalized_value', identifier.normalized_value,
            'is_primary', identifier.is_primary,
            'valid_from', identifier.valid_from,
            'valid_until', identifier.valid_until
          ) ORDER BY
            identifier.scheme_code COLLATE "C",
            identifier.namespace COLLATE "C" NULLS FIRST,
            identifier.normalized_value COLLATE "C",
            identifier.value COLLATE "C")
            FROM public.kb_entity_identifiers identifier
           WHERE identifier.entity_id = entity.id
        ), '[]'::jsonb)
      ),
      'therapeutic', jsonb_build_object(
        'computed_content_hash', CASE
          WHEN entity.entity_type_code IN ('preparation', 'product_variant')
            THEN public.kb_therapeutic_revision_hash(entity.id, revision.id)
          ELSE NULL
        END,
        'entity_dependencies', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'reference_role', dependency.reference_role,
            'reference_order', dependency.reference_order,
            'entity_id', dependency.entity_id,
            'entity_revision_id', dependency.entity_revision_id,
            'content_hash', dependency_revision.content_hash
          ) ORDER BY
            dependency.reference_order,
            dependency.reference_role COLLATE "C",
            dependency.entity_revision_id)
            FROM (
              SELECT 'product'::text AS reference_role, 1 AS reference_order,
                     detail.product_entity_id AS entity_id,
                     detail.product_revision_id AS entity_revision_id
                FROM public.kb_product_variant_revision_details detail
               WHERE detail.entity_id = entity.id
                 AND detail.entity_revision_id = revision.id
              UNION ALL
              SELECT 'preparation', 2,
                     detail.preparation_entity_id,
                     detail.preparation_revision_id
                FROM public.kb_product_variant_revision_details detail
               WHERE detail.entity_id = entity.id
                 AND detail.entity_revision_id = revision.id
              UNION ALL
              SELECT 'component:' || component.component_role,
                     1000 + component.component_order,
                     component.component_entity_id,
                     component.component_revision_id
                FROM public.kb_composition_components component
               WHERE component.owner_entity_id = entity.id
                 AND component.owner_revision_id = revision.id
            ) dependency
            JOIN public.kb_entity_revisions dependency_revision
              ON dependency_revision.entity_id = dependency.entity_id
             AND dependency_revision.id = dependency.entity_revision_id
        ), '[]'::jsonb),
        'basis_assertions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'basis_role', basis.basis_role,
            'basis_order', basis.basis_order,
            'assertion_id', basis.assertion_id,
            'content_hash', assertion.content_hash
          ) ORDER BY
            basis.basis_order,
            basis.basis_role COLLATE "C",
            basis.assertion_id)
            FROM (
              SELECT 'preparation'::text AS basis_role, 1 AS basis_order,
                     detail.basis_assertion_id AS assertion_id
                FROM public.kb_preparation_revision_details detail
               WHERE detail.entity_id = entity.id
                 AND detail.entity_revision_id = revision.id
              UNION ALL
              SELECT 'homeopathic', 2, detail.basis_assertion_id
                FROM public.kb_homeopathic_revision_details detail
               WHERE detail.entity_id = entity.id
                 AND detail.entity_revision_id = revision.id
              UNION ALL
              SELECT 'botanical', 3, detail.basis_assertion_id
                FROM public.kb_botanical_revision_details detail
               WHERE detail.entity_id = entity.id
                 AND detail.entity_revision_id = revision.id
              UNION ALL
              SELECT 'nutrient', 4, detail.basis_assertion_id
                FROM public.kb_nutrient_revision_details detail
               WHERE detail.entity_id = entity.id
                 AND detail.entity_revision_id = revision.id
              UNION ALL
              SELECT 'product_variant', 5, detail.basis_assertion_id
                FROM public.kb_product_variant_revision_details detail
               WHERE detail.entity_id = entity.id
                 AND detail.entity_revision_id = revision.id
              UNION ALL
              SELECT 'component:' || component.component_role,
                     1000 + component.component_order,
                     component.basis_assertion_id
                FROM public.kb_composition_components component
               WHERE component.owner_entity_id = entity.id
                 AND component.owner_revision_id = revision.id
            ) basis
            JOIN public.kb_assertions assertion ON assertion.id = basis.assertion_id
        ), '[]'::jsonb)
      )
    )
      INTO manifest
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = entity.id
       AND revision.id = _entity_revision_id
     WHERE entity.id = _entity_id;
  ELSIF _article_revision_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'manifest_version', 1,
      'item_kind', 'article_revision',
      'reference', jsonb_build_object(
        'article_id', article.id,
        'article_revision_id', revision.id
      ),
      'article', jsonb_build_object(
        'canonical_key', article.canonical_key,
        'article_kind', article.article_kind,
        'revision_no', revision.revision_no,
        'title', revision.title,
        'category_path', revision.category_path,
        'tags', revision.tags,
        'content_markdown', revision.content_markdown,
        'review_status', CASE
          WHEN revision.review_status IN ('released', 'superseded', 'withdrawn')
            THEN 'released'
          ELSE revision.review_status
        END,
        'origin_type', revision.origin_type,
        'content_hash', revision.content_hash,
        'revision_metadata_hash', public.kb_release_manifest_hash_v1(revision.metadata),
        'reviewed_at_epoch', CASE WHEN revision.reviewed_at IS NULL THEN NULL
          ELSE extract(epoch FROM revision.reviewed_at)::text END,
        'released_at_epoch', CASE WHEN revision.released_at IS NULL THEN NULL
          ELSE extract(epoch FROM revision.released_at)::text END,
        'review_due_at_epoch', CASE WHEN revision.review_due_at IS NULL THEN NULL
          ELSE extract(epoch FROM revision.review_due_at)::text END,
        'entity_links', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'entity_id', link.entity_id,
            'role', link.role,
            'rank', link.rank,
            'context_text', link.context_text
          ) ORDER BY link.role COLLATE "C", link.rank, link.entity_id)
            FROM public.kb_article_entities link
           WHERE link.article_revision_id = revision.id
        ), '[]'::jsonb)
      )
    )
      INTO manifest
      FROM public.kb_articles article
      JOIN public.kb_article_revisions revision
        ON revision.article_id = article.id
       AND revision.id = _article_revision_id
     WHERE article.id = _article_id;
  ELSIF _assertion_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'manifest_version', 1,
      'item_kind', 'assertion',
      'reference', jsonb_build_object('assertion_id', assertion.id),
      'assertion', jsonb_build_object(
        'canonical_key', assertion.canonical_key,
        'version_no', assertion.version_no,
        'assertion_kind', assertion.assertion_kind,
        'claim_text', assertion.claim_text,
        'review_status', CASE
          WHEN assertion.review_status IN ('released', 'superseded', 'withdrawn')
            THEN 'released'
          ELSE assertion.review_status
        END,
        'origin_type', assertion.origin_type,
        'evidence_basis', assertion.evidence_basis,
        'evidence_quality', assertion.evidence_quality,
        'valid_from', assertion.valid_from,
        'valid_until', assertion.valid_until,
        'supersedes_assertion_id', assertion.supersedes_assertion_id,
        'content_hash', assertion.content_hash,
        'metadata_hash', public.kb_release_manifest_hash_v1(assertion.metadata),
        'reviewed_at_epoch', CASE WHEN assertion.reviewed_at IS NULL THEN NULL
          ELSE extract(epoch FROM assertion.reviewed_at)::text END,
        'released_at_epoch', CASE WHEN assertion.released_at IS NULL THEN NULL
          ELSE extract(epoch FROM assertion.released_at)::text END,
        'review_due_at_epoch', CASE WHEN assertion.review_due_at IS NULL THEN NULL
          ELSE extract(epoch FROM assertion.review_due_at)::text END,
        'relation', (
          SELECT jsonb_build_object(
            'relation_id', relation.id,
            'subject_entity_id', relation.subject_entity_id,
            'relation_type_code', relation.relation_type_code,
            'object_entity_id', relation.object_entity_id,
            'assignment_strength', relation.assignment_strength,
            'rank', relation.rank,
            'context_text', relation.context_text
          )
            FROM public.kb_entity_relations relation
           WHERE relation.assertion_id = assertion.id
        ),
        'sources', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'source_id', source_revision.source_id,
            'source_revision_id', source_binding.source_revision_id,
            'source_content_hash', source_revision.content_hash,
            'source_role', source_binding.source_role,
            'locator', source_binding.locator,
            'original_quote', source_binding.original_quote,
            'is_primary', source_binding.is_primary
          ) ORDER BY
            source_binding.is_primary DESC,
            source_binding.source_role COLLATE "C",
            source_binding.source_revision_id,
            source_binding.locator COLLATE "C")
            FROM public.kb_assertion_sources source_binding
            JOIN public.kb_source_revisions source_revision
              ON source_revision.id = source_binding.source_revision_id
           WHERE source_binding.assertion_id = assertion.id
             AND source_binding.is_primary
             AND source_binding.source_role IN ('supports', 'qualifies')
        ), '[]'::jsonb)
      )
    )
      INTO manifest
      FROM public.kb_assertions assertion
     WHERE assertion.id = _assertion_id;
  ELSE
    SELECT jsonb_build_object(
      'manifest_version', 1,
      'item_kind', 'source_revision',
      'reference', jsonb_build_object(
        'source_id', source.id,
        'source_revision_id', revision.id
      ),
      'source', jsonb_build_object(
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
        'review_status', CASE
          WHEN revision.review_status IN ('released', 'superseded', 'withdrawn')
            THEN 'released'
          ELSE revision.review_status
        END,
        'content_hash', revision.content_hash,
        'revision_metadata_hash', public.kb_release_manifest_hash_v1(revision.metadata),
        'reviewed_at_epoch', CASE WHEN revision.reviewed_at IS NULL THEN NULL
          ELSE extract(epoch FROM revision.reviewed_at)::text END,
        'released_at_epoch', CASE WHEN revision.released_at IS NULL THEN NULL
          ELSE extract(epoch FROM revision.released_at)::text END,
        'review_due_at_epoch', CASE WHEN revision.review_due_at IS NULL THEN NULL
          ELSE extract(epoch FROM revision.review_due_at)::text END
      )
    )
      INTO manifest
      FROM public.kb_sources source
      JOIN public.kb_source_revisions revision
        ON revision.source_id = source.id
       AND revision.id = _source_revision_id
     WHERE source.id = _source_id;
  END IF;

  IF manifest IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN public.kb_release_canonical_jsonb_v1(manifest);
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_release_manifest_v1(
  _release_id uuid,
  _release_key text
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'manifest_version', 1,
    'release_id', _release_id,
    'release_key', _release_key,
    'contract_version', 1,
    'data_classification', 'general_knowledge',
    'retrieval_eligible', false,
    'is_active', false,
    'item_count', (SELECT count(*) FROM public.kb_release_items WHERE release_id = _release_id),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'item_id', item.id,
        'item_order', item.item_order,
        'item_kind', item.item_kind,
        'reference', CASE item.item_kind
          WHEN 'entity_revision' THEN jsonb_build_object(
            'entity_id', item.entity_id,
            'entity_revision_id', item.entity_revision_id
          )
          WHEN 'article_revision' THEN jsonb_build_object(
            'article_id', item.article_id,
            'article_revision_id', item.article_revision_id
          )
          WHEN 'assertion' THEN jsonb_build_object('assertion_id', item.assertion_id)
          WHEN 'source_revision' THEN jsonb_build_object(
            'source_id', item.source_id,
            'source_revision_id', item.source_revision_id
          )
        END,
        'item_manifest', item.item_manifest,
        'item_manifest_hash', item.item_manifest_hash
      ) ORDER BY item.item_order, item.id)
        FROM public.kb_release_items item
       WHERE item.release_id = _release_id
    ), '[]'::jsonb)
  ))
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_knowledge_release_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  parent_status text;
  expected_manifest jsonb;
BEGIN
  SELECT pg_get_userbyid(relclass.relowner)
    INTO STRICT table_owner
    FROM pg_class relclass
   WHERE relclass.oid = TG_RELID;

  IF current_user <> table_owner THEN
    RAISE EXCEPTION 'Knowledge release writes require the database table owner';
  END IF;

  IF TG_TABLE_NAME = 'kb_releases' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Knowledge releases cannot be deleted';
    ELSIF TG_OP = 'INSERT' THEN
      IF NEW.release_status <> 'build' OR NEW.sealed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Knowledge releases must be inserted in build state';
      END IF;
      expected_manifest := public.kb_release_manifest_v1(NEW.id, NEW.release_key);
      IF NEW.release_manifest IS DISTINCT FROM expected_manifest THEN
        RAISE EXCEPTION 'Build release requires its canonical v1 manifest';
      END IF;
      RETURN NEW;
    END IF;

    IF OLD.release_status = 'sealed' THEN
      RAISE EXCEPTION 'Sealed knowledge releases are append-only';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.release_key IS DISTINCT FROM OLD.release_key
       OR NEW.contract_version IS DISTINCT FROM OLD.contract_version
       OR NEW.data_classification IS DISTINCT FROM OLD.data_classification
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Stable knowledge release fields are immutable';
    END IF;
    IF NEW.release_status NOT IN ('build', 'sealed') THEN
      RAISE EXCEPTION 'Invalid knowledge release transition';
    END IF;
    IF NEW.release_status = 'build' AND NEW.sealed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Build releases cannot have a seal timestamp';
    END IF;
    IF NEW.release_status = 'sealed' AND NEW.sealed_at IS NULL THEN
      RAISE EXCEPTION 'Sealing requires a seal timestamp';
    END IF;

    IF NEW.release_manifest IS DISTINCT FROM OLD.release_manifest
       OR NEW.release_manifest_hash IS DISTINCT FROM OLD.release_manifest_hash
       OR NEW.release_status = 'sealed'
    THEN
      expected_manifest := public.kb_release_manifest_v1(NEW.id, NEW.release_key);
      IF NEW.release_manifest IS DISTINCT FROM expected_manifest THEN
        RAISE EXCEPTION 'Knowledge release requires its canonical v1 manifest';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Knowledge release items cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.release_id IS DISTINCT FROM OLD.release_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Stable knowledge release item fields are immutable';
  END IF;

  -- Create a parent row version, not only a row lock. A concurrent seal that
  -- started with an older REPEATABLE READ snapshot must then serialize-fail
  -- instead of omitting this item from its manifest.
  UPDATE public.kb_releases release
     SET release_manifest = release.release_manifest
   WHERE release.id = NEW.release_id
  RETURNING release.release_status INTO STRICT parent_status;
  IF parent_status <> 'build' THEN
    RAISE EXCEPTION 'Items of sealed knowledge releases are append-only';
  END IF;

  expected_manifest := public.kb_release_item_manifest_v1(
    NEW.entity_id,
    NEW.entity_revision_id,
    NEW.article_id,
    NEW.article_revision_id,
    NEW.assertion_id,
    NEW.source_id,
    NEW.source_revision_id
  );
  IF expected_manifest IS NULL OR NEW.item_manifest IS DISTINCT FROM expected_manifest THEN
    RAISE EXCEPTION 'Knowledge release item requires its canonical v1 manifest';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_prevent_knowledge_release_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Knowledge release tables cannot be truncated';
END;
$$;

CREATE TRIGGER kb_releases_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_releases
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_knowledge_release_write();
CREATE TRIGGER kb_release_items_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_release_items
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_knowledge_release_write();
CREATE TRIGGER kb_releases_prevent_truncate
  BEFORE TRUNCATE ON public.kb_releases
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_prevent_knowledge_release_truncate();
CREATE TRIGGER kb_release_items_prevent_truncate
  BEFORE TRUNCATE ON public.kb_release_items
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_prevent_knowledge_release_truncate();

CREATE OR REPLACE FUNCTION public.kb_release_item_is_valid(
  _release_item_id uuid,
  _require_released boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  item public.kb_release_items%ROWTYPE;
  expected_manifest jsonb;
  current_status text;
  current_entity_type text;
BEGIN
  SELECT stored_item.*
    INTO item
    FROM public.kb_release_items stored_item
   WHERE stored_item.id = _release_item_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  expected_manifest := public.kb_release_item_manifest_v1(
    item.entity_id,
    item.entity_revision_id,
    item.article_id,
    item.article_revision_id,
    item.assertion_id,
    item.source_id,
    item.source_revision_id
  );
  IF expected_manifest IS NULL
     OR item.item_manifest_hash IS DISTINCT FROM
        public.kb_release_manifest_hash_v1(item.item_manifest)
  THEN
    RETURN false;
  END IF;

  IF item.item_kind = 'entity_revision' AND NOT _require_released THEN
    IF jsonb_typeof(item.item_manifest #> '{entity,names}') IS DISTINCT FROM 'array'
       OR jsonb_typeof(item.item_manifest #> '{entity,identifiers}') IS DISTINCT FROM 'array'
       OR EXISTS (
         SELECT 1
           FROM jsonb_array_elements(item.item_manifest #> '{entity,names}') name(value)
          WHERE NOT public.kb_release_jsonb_has_exact_keys_v1(
            name.value,
            ARRAY[
              'name', 'normalized_name', 'name_kind', 'language_code',
              'is_preferred', 'retired_at_epoch'
            ]::text[]
          )
       )
       OR EXISTS (
         SELECT 1
           FROM jsonb_array_elements(item.item_manifest #> '{entity,identifiers}') identifier(value)
          WHERE NOT public.kb_release_jsonb_has_exact_keys_v1(
            identifier.value,
            ARRAY[
              'scheme_code', 'namespace', 'value', 'normalized_value',
              'is_primary', 'valid_from', 'valid_until'
            ]::text[]
          )
       )
       OR (item.item_manifest #- '{entity,names}' #- '{entity,identifiers}')
          IS DISTINCT FROM
          (expected_manifest #- '{entity,names}' #- '{entity,identifiers}')
    THEN
      RETURN false;
    END IF;
  ELSIF item.item_manifest IS DISTINCT FROM expected_manifest THEN
    RETURN false;
  END IF;

  IF item.item_kind = 'entity_revision' THEN
    SELECT revision.review_status, entity.entity_type_code
      INTO current_status, current_entity_type
      FROM public.kb_entities entity
      JOIN public.kb_entity_revisions revision
        ON revision.entity_id = entity.id
       AND revision.id = item.entity_revision_id
     WHERE entity.id = item.entity_id;
    IF NOT FOUND THEN
      RETURN false;
    END IF;
    IF current_entity_type IN ('preparation', 'product_variant')
       AND public.kb_therapeutic_revision_is_valid(item.entity_id, item.entity_revision_id)
           IS DISTINCT FROM true
    THEN
      RETURN false;
    END IF;
  ELSIF item.item_kind = 'article_revision' THEN
    SELECT revision.review_status
      INTO current_status
      FROM public.kb_article_revisions revision
     WHERE revision.article_id = item.article_id
       AND revision.id = item.article_revision_id;
  ELSIF item.item_kind = 'assertion' THEN
    SELECT assertion.review_status
      INTO current_status
      FROM public.kb_assertions assertion
     WHERE assertion.id = item.assertion_id;
  ELSE
    SELECT revision.review_status
      INTO current_status
      FROM public.kb_source_revisions revision
     WHERE revision.source_id = item.source_id
       AND revision.id = item.source_revision_id;
  END IF;

  IF current_status IS NULL THEN
    RETURN false;
  END IF;
  IF _require_released THEN
    RETURN current_status = 'released';
  END IF;
  RETURN current_status IN ('released', 'superseded', 'withdrawn');
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_release_is_valid(
  _release_id uuid,
  _require_released boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  release public.kb_releases%ROWTYPE;
BEGIN
  SELECT stored_release.*
    INTO release
    FROM public.kb_releases stored_release
   WHERE stored_release.id = _release_id;
  IF NOT FOUND
     OR release.release_status <> 'sealed'
     OR release.contract_version <> 1
     OR release.data_classification <> 'general_knowledge'
     OR release.retrieval_eligible
     OR release.is_active
     OR release.sealed_at IS NULL
     OR release.release_manifest_hash IS DISTINCT FROM
        public.kb_release_manifest_hash_v1(release.release_manifest)
     OR release.release_manifest IS DISTINCT FROM
        public.kb_release_manifest_v1(release.id, release.release_key)
     OR NOT EXISTS (
       SELECT 1 FROM public.kb_release_items item WHERE item.release_id = release.id
     )
     OR EXISTS (
       SELECT 1
         FROM public.kb_release_items item
        WHERE item.release_id = release.id
          AND public.kb_release_item_is_valid(item.id, _require_released)
              IS DISTINCT FROM true
     )
  THEN
    RETURN false;
  END IF;

  -- Every exact therapeutic entity dependency must itself be an exact item.
  IF EXISTS (
    WITH required_dependencies AS (
      SELECT detail.product_entity_id AS entity_id,
             detail.product_revision_id AS entity_revision_id
        FROM public.kb_release_items owner_item
        JOIN public.kb_product_variant_revision_details detail
          ON detail.entity_id = owner_item.entity_id
         AND detail.entity_revision_id = owner_item.entity_revision_id
       WHERE owner_item.release_id = release.id
         AND owner_item.item_kind = 'entity_revision'
      UNION
      SELECT detail.preparation_entity_id, detail.preparation_revision_id
        FROM public.kb_release_items owner_item
        JOIN public.kb_product_variant_revision_details detail
          ON detail.entity_id = owner_item.entity_id
         AND detail.entity_revision_id = owner_item.entity_revision_id
       WHERE owner_item.release_id = release.id
         AND owner_item.item_kind = 'entity_revision'
      UNION
      SELECT component.component_entity_id, component.component_revision_id
        FROM public.kb_release_items owner_item
        JOIN public.kb_composition_components component
          ON component.owner_entity_id = owner_item.entity_id
         AND component.owner_revision_id = owner_item.entity_revision_id
       WHERE owner_item.release_id = release.id
         AND owner_item.item_kind = 'entity_revision'
    )
    SELECT 1
      FROM required_dependencies dependency
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.kb_release_items dependency_item
        WHERE dependency_item.release_id = release.id
          AND dependency_item.entity_id = dependency.entity_id
          AND dependency_item.entity_revision_id = dependency.entity_revision_id
     )
  ) THEN
    RETURN false;
  END IF;

  -- Every therapeutic basis assertion must be sealed as its exact assertion item.
  IF EXISTS (
    WITH required_assertions AS (
      SELECT detail.basis_assertion_id AS assertion_id
        FROM public.kb_release_items owner_item
        JOIN public.kb_preparation_revision_details detail
          ON detail.entity_id = owner_item.entity_id
         AND detail.entity_revision_id = owner_item.entity_revision_id
       WHERE owner_item.release_id = release.id
         AND owner_item.item_kind = 'entity_revision'
      UNION
      SELECT detail.basis_assertion_id
        FROM public.kb_release_items owner_item
        JOIN public.kb_homeopathic_revision_details detail
          ON detail.entity_id = owner_item.entity_id
         AND detail.entity_revision_id = owner_item.entity_revision_id
       WHERE owner_item.release_id = release.id
         AND owner_item.item_kind = 'entity_revision'
      UNION
      SELECT detail.basis_assertion_id
        FROM public.kb_release_items owner_item
        JOIN public.kb_botanical_revision_details detail
          ON detail.entity_id = owner_item.entity_id
         AND detail.entity_revision_id = owner_item.entity_revision_id
       WHERE owner_item.release_id = release.id
         AND owner_item.item_kind = 'entity_revision'
      UNION
      SELECT detail.basis_assertion_id
        FROM public.kb_release_items owner_item
        JOIN public.kb_nutrient_revision_details detail
          ON detail.entity_id = owner_item.entity_id
         AND detail.entity_revision_id = owner_item.entity_revision_id
       WHERE owner_item.release_id = release.id
         AND owner_item.item_kind = 'entity_revision'
      UNION
      SELECT detail.basis_assertion_id
        FROM public.kb_release_items owner_item
        JOIN public.kb_product_variant_revision_details detail
          ON detail.entity_id = owner_item.entity_id
         AND detail.entity_revision_id = owner_item.entity_revision_id
       WHERE owner_item.release_id = release.id
         AND owner_item.item_kind = 'entity_revision'
      UNION
      SELECT component.basis_assertion_id
        FROM public.kb_release_items owner_item
        JOIN public.kb_composition_components component
          ON component.owner_entity_id = owner_item.entity_id
         AND component.owner_revision_id = owner_item.entity_revision_id
       WHERE owner_item.release_id = release.id
         AND owner_item.item_kind = 'entity_revision'
    )
    SELECT 1
      FROM required_assertions dependency
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.kb_release_items assertion_item
        WHERE assertion_item.release_id = release.id
          AND assertion_item.assertion_id = dependency.assertion_id
     )
  ) THEN
    RETURN false;
  END IF;

  -- Articles and relation assertions bind the concrete released entity revisions.
  IF EXISTS (
    SELECT 1
      FROM public.kb_release_items article_item
      JOIN public.kb_article_entities link
        ON link.article_revision_id = article_item.article_revision_id
     WHERE article_item.release_id = release.id
       AND article_item.item_kind = 'article_revision'
       AND NOT EXISTS (
         SELECT 1
           FROM public.kb_release_items entity_item
          WHERE entity_item.release_id = release.id
            AND entity_item.item_kind = 'entity_revision'
            AND entity_item.entity_id = link.entity_id
       )
  ) THEN
    RETURN false;
  END IF;

  -- A release binds exactly one semantically valid graph edge to relation assertions.
  IF EXISTS (
    SELECT 1
      FROM public.kb_release_items assertion_item
      JOIN public.kb_assertions assertion ON assertion.id = assertion_item.assertion_id
      LEFT JOIN public.kb_entity_relations relation ON relation.assertion_id = assertion.id
      LEFT JOIN public.kb_entities subject_entity ON subject_entity.id = relation.subject_entity_id
      LEFT JOIN public.kb_entities object_entity ON object_entity.id = relation.object_entity_id
      LEFT JOIN public.kb_relation_types relation_type
        ON relation_type.code = relation.relation_type_code
     WHERE assertion_item.release_id = release.id
       AND assertion_item.item_kind = 'assertion'
       AND (
         (assertion.assertion_kind = 'entity_relation')
           IS DISTINCT FROM (relation.id IS NOT NULL)
         OR (relation.id IS NOT NULL AND (
           relation_type.code IS NULL
           OR NOT relation_type.is_active
           OR subject_entity.id IS NULL
           OR object_entity.id IS NULL
           OR NOT EXISTS (
             SELECT 1
               FROM public.kb_relation_type_domains relation_domain
              WHERE relation_domain.relation_type_code = relation.relation_type_code
                AND relation_domain.subject_entity_type_code = subject_entity.entity_type_code
                AND relation_domain.object_entity_type_code = object_entity.entity_type_code
                AND relation_domain.review_status = 'approved'
           )
            OR (
              relation_type.is_symmetric
              AND relation.subject_entity_id > relation.object_entity_id
            )
         ))
       )
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_release_items assertion_item
      JOIN public.kb_assertions assertion ON assertion.id = assertion_item.assertion_id
     WHERE assertion_item.release_id = release.id
       AND assertion_item.item_kind = 'assertion'
       AND assertion.assertion_kind = 'entity_relation'
       AND NOT EXISTS (
         SELECT 1
           FROM public.kb_entity_relations relation
          WHERE relation.assertion_id = assertion.id
            AND EXISTS (
              SELECT 1 FROM public.kb_release_items subject_item
               WHERE subject_item.release_id = release.id
                 AND subject_item.item_kind = 'entity_revision'
                 AND subject_item.entity_id = relation.subject_entity_id
            )
            AND EXISTS (
              SELECT 1 FROM public.kb_release_items object_item
               WHERE object_item.release_id = release.id
                 AND object_item.item_kind = 'entity_revision'
                 AND object_item.entity_id = relation.object_entity_id
            )
       )
  ) THEN
    RETURN false;
  END IF;

  -- Every assertion carries all exact released primary supporting sources.
  IF EXISTS (
    SELECT 1
      FROM public.kb_release_items assertion_item
     WHERE assertion_item.release_id = release.id
       AND assertion_item.item_kind = 'assertion'
       AND NOT EXISTS (
         SELECT 1
           FROM public.kb_assertion_sources primary_source
          WHERE primary_source.assertion_id = assertion_item.assertion_id
            AND primary_source.is_primary
            AND primary_source.source_role IN ('supports', 'qualifies')
       )
  ) OR EXISTS (
    SELECT 1
      FROM public.kb_release_items assertion_item
      JOIN public.kb_assertion_sources primary_source
        ON primary_source.assertion_id = assertion_item.assertion_id
       AND primary_source.is_primary
       AND primary_source.source_role IN ('supports', 'qualifies')
     WHERE assertion_item.release_id = release.id
       AND assertion_item.item_kind = 'assertion'
       AND (
          NULLIF(btrim(primary_source.locator), '') IS NULL
         OR NOT EXISTS (
           SELECT 1
             FROM public.kb_release_items source_item
            WHERE source_item.release_id = release.id
              AND source_item.item_kind = 'source_revision'
              AND source_item.source_revision_id = primary_source.source_revision_id
         )
       )
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_validate_knowledge_release_seal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.release_status = 'sealed'
     AND public.kb_release_is_valid(NEW.id, true) IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'Knowledge release seal is incomplete, unreviewed or inconsistent';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER kb_releases_validate_seal
  AFTER INSERT OR UPDATE ON public.kb_releases
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_knowledge_release_seal();

CREATE OR REPLACE FUNCTION public.kb_invalid_knowledge_release_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH violations AS (
    SELECT 'release:' || release.id::text AS violation_key
      FROM public.kb_releases release
     WHERE release.release_status = 'sealed'
       AND public.kb_release_is_valid(release.id, false) IS DISTINCT FROM true
    UNION ALL
    SELECT 'orphan-item:' || item.id::text
      FROM public.kb_release_items item
      LEFT JOIN public.kb_releases release ON release.id = item.release_id
     WHERE release.id IS NULL
  )
  SELECT count(*) FROM violations
$$;

ALTER TABLE public.kb_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_release_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_releases_admin_read
  ON public.kb_releases
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY kb_release_items_admin_read
  ON public.kb_release_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE
  public.kb_releases,
  public.kb_release_items
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT SELECT ON TABLE
  public.kb_releases,
  public.kb_release_items
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.kb_release_canonical_jsonb_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_release_manifest_hash_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_release_jsonb_has_exact_keys_v1(jsonb, text[])
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_release_item_manifest_v1(uuid, uuid, uuid, uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_release_manifest_v1(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_knowledge_release_write()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_prevent_knowledge_release_truncate()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_release_item_is_valid(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_release_is_valid(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_validate_knowledge_release_seal()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_knowledge_release_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

CREATE OR REPLACE FUNCTION public.kb_export_wiki_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  wiki_table text;
  table_rows jsonb;
  tables_json jsonb := '{}'::jsonb;
  serialized_tables_json jsonb := '{}'::jsonb;
  manifest_json jsonb := '{}'::jsonb;
  validation_json jsonb;
  invalid_source_promotions bigint := 0;
  invalid_therapeutic_catalog_revisions bigint := 0;
  invalid_entity_candidate_contracts bigint := 0;
  invalid_entity_candidate_draft_promotions bigint := 0;
  invalid_knowledge_releases bigint := 0;
BEGIN
  FOR wiki_table IN
    SELECT listed_table.table_name
      FROM (
        SELECT unnest(ARRAY[
          'admin_knowledge_base',
          'mannayan_products',
          'knowledge_product_links',
          'faqs',
          'practice_pricing',
          'practice_info'
        ]) AS table_name
        UNION
        SELECT tables.tablename
          FROM pg_catalog.pg_tables tables
         WHERE tables.schemaname = 'public'
           AND tables.tablename LIKE 'kb\_%' ESCAPE '\'
      ) listed_table
     ORDER BY listed_table.table_name
  LOOP
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(table_row) ORDER BY to_jsonb(table_row)::text COLLATE "C"), ''[]''::jsonb) FROM public.%I table_row',
      wiki_table
    ) INTO table_rows;
    tables_json := tables_json || jsonb_build_object(wiki_table, table_rows);
    serialized_tables_json := serialized_tables_json
      || jsonb_build_object(wiki_table, table_rows::text);
    manifest_json := manifest_json || jsonb_build_object(
      wiki_table,
      jsonb_build_object(
        'rows', jsonb_array_length(table_rows),
        'sha256', public.kb_snapshot_rows_hash(table_rows)
      )
    );
  END LOOP;

  SELECT jsonb_build_object(
    'legacy_rows', (SELECT count(*) FROM public.admin_knowledge_base),
    'mapped_articles', (SELECT count(*) FROM public.kb_articles WHERE legacy_knowledge_entry_id IS NOT NULL),
    'legacy_snapshot_revisions', (SELECT count(*) FROM public.kb_article_revisions WHERE origin_type = 'legacy_snapshot'),
    'missing_articles', (
      SELECT count(*)
        FROM public.admin_knowledge_base legacy_row
        LEFT JOIN public.kb_articles article
          ON article.legacy_knowledge_entry_id = legacy_row.id
       WHERE article.id IS NULL
    ),
    'invalid_current_snapshots', (
      SELECT count(*)
        FROM public.admin_knowledge_base legacy_row
        JOIN public.kb_articles article
          ON article.legacy_knowledge_entry_id = legacy_row.id
        LEFT JOIN public.kb_article_revisions revision
          ON revision.id = article.current_revision_id
         AND revision.article_id = article.id
       WHERE article.canonical_key IS DISTINCT FROM 'legacy:' || legacy_row.id::text
          OR article.article_kind IS DISTINCT FROM legacy_row.entry_kind
          OR article.lifecycle_status IS DISTINCT FROM 'active'
          OR article.metadata ->> 'bridge_source' IS DISTINCT FROM 'public.admin_knowledge_base'
          OR article.metadata ->> 'bridge_version' IS DISTINCT FROM '1'
          OR article.metadata ->> 'legacy_knowledge_entry_id' IS DISTINCT FROM legacy_row.id::text
          OR revision.id IS NULL
          OR revision.origin_type IS DISTINCT FROM 'legacy_snapshot'
          OR revision.title IS DISTINCT FROM legacy_row.title
          OR revision.category_path IS DISTINCT FROM legacy_row.category
          OR revision.tags IS DISTINCT FROM legacy_row.tags
          OR revision.content_markdown IS DISTINCT FROM legacy_row.content
          OR (revision.metadata -> 'legacy_metadata') - 'updated_at'
             IS DISTINCT FROM (to_jsonb(legacy_row) - ARRAY['id', 'title', 'category', 'tags', 'content', 'updated_at'])
          OR revision.content_hash IS DISTINCT FROM public.kb_legacy_article_hash(to_jsonb(legacy_row))
    ),
    'orphaned_active_articles', (
      SELECT count(*)
        FROM public.kb_articles article
        LEFT JOIN public.admin_knowledge_base legacy_row
          ON legacy_row.id = article.legacy_knowledge_entry_id
       WHERE article.legacy_knowledge_entry_id IS NOT NULL
         AND article.lifecycle_status = 'active'
         AND legacy_row.id IS NULL
    )
  ) INTO validation_json;

  IF to_regclass('public.kb_source_candidate_draft_promotions') IS NOT NULL THEN
    EXECUTE $promotion_validation$
      SELECT count(*)
        FROM public.kb_source_candidate_draft_promotions promotion
        LEFT JOIN public.kb_source_candidates candidate
          ON candidate.id = promotion.source_candidate_id
         AND candidate.batch_id = promotion.batch_id
        LEFT JOIN public.kb_import_batches batch ON batch.id = promotion.batch_id
        LEFT JOIN public.kb_review_decisions decision ON decision.id = promotion.review_decision_id
        LEFT JOIN public.kb_sources source ON source.id = promotion.source_id
        LEFT JOIN public.kb_source_revisions revision
          ON revision.id = promotion.source_revision_id
         AND revision.source_id = promotion.source_id
       WHERE candidate.id IS NULL
          OR candidate.candidate_status IS DISTINCT FROM 'accepted_as_draft'
          OR candidate.target_source_id IS NOT NULL
          OR candidate.data_classification IS DISTINCT FROM 'general_knowledge'
          OR batch.batch_status IS DISTINCT FROM 'reviewed'
          OR decision.candidate_kind IS DISTINCT FROM 'source'
          OR decision.candidate_id IS DISTINCT FROM promotion.source_candidate_id
          OR decision.decision IS DISTINCT FROM 'accept_as_draft'
          OR decision.status_after IS DISTINCT FROM 'accepted_as_draft'
          OR decision.data_classification IS DISTINCT FROM 'general_knowledge'
          OR source.canonical_key IS DISTINCT FROM promotion.selected_canonical_key
          OR source.created_by IS DISTINCT FROM promotion.promoted_by
          OR source.metadata -> 'origin_type' IS DISTINCT FROM to_jsonb('import'::text)
          OR source.metadata -> 'source_candidate_id' IS DISTINCT FROM to_jsonb(promotion.source_candidate_id::text)
          OR source.metadata -> 'import_batch_id' IS DISTINCT FROM to_jsonb(promotion.batch_id::text)
          OR source.metadata -> 'conversion_version' IS DISTINCT FROM to_jsonb(promotion.conversion_version)
          OR revision.id IS NULL
          OR revision.revision_no IS DISTINCT FROM 1
          OR revision.created_by IS DISTINCT FROM promotion.promoted_by
          OR revision.metadata -> 'origin_type' IS DISTINCT FROM to_jsonb('import'::text)
          OR revision.metadata -> 'source_candidate_id' IS DISTINCT FROM to_jsonb(promotion.source_candidate_id::text)
          OR revision.metadata -> 'import_batch_id' IS DISTINCT FROM to_jsonb(promotion.batch_id::text)
          OR revision.metadata -> 'review_decision_id' IS DISTINCT FROM to_jsonb(promotion.review_decision_id::text)
          OR revision.metadata -> 'conversion_version' IS DISTINCT FROM to_jsonb(promotion.conversion_version)
          OR promotion.data_classification IS DISTINCT FROM 'general_knowledge'
          OR promotion.initial_content_hash IS DISTINCT FROM encode(sha256(convert_to(jsonb_build_object(
            'source_type', promotion.selected_source_type,
            'title', candidate.title,
            'publisher', NULLIF(btrim(candidate.publisher), ''),
            'published_on', candidate.publication_date,
            'url', NULLIF(btrim(candidate.source_url), ''),
            'rights_status', candidate.rights_status
          )::text, 'UTF8')), 'hex')
    $promotion_validation$ INTO invalid_source_promotions;
  END IF;

  IF to_regprocedure('public.kb_invalid_therapeutic_catalog_revision_count()') IS NOT NULL THEN
    EXECUTE 'SELECT public.kb_invalid_therapeutic_catalog_revision_count()'
      INTO invalid_therapeutic_catalog_revisions;
  END IF;
  SELECT public.kb_invalid_entity_candidate_contract_count()
    INTO invalid_entity_candidate_contracts;
  SELECT public.kb_invalid_entity_candidate_draft_promotion_count()
    INTO invalid_entity_candidate_draft_promotions;
  SELECT public.kb_invalid_knowledge_release_count()
    INTO invalid_knowledge_releases;

  validation_json := validation_json || jsonb_build_object(
    'invalid_source_promotions', invalid_source_promotions,
    'invalid_therapeutic_catalog_revisions', invalid_therapeutic_catalog_revisions,
    'invalid_entity_candidate_contracts', invalid_entity_candidate_contracts,
    'invalid_entity_candidate_draft_promotions', invalid_entity_candidate_draft_promotions,
    'invalid_knowledge_releases', invalid_knowledge_releases
  );

  RETURN jsonb_build_object(
    'tables', tables_json,
    'serialized_tables', serialized_tables_json,
    'manifest', manifest_json,
    'validation', validation_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT EXECUTE ON FUNCTION public.kb_export_wiki_snapshot()
  TO service_role;

COMMIT;
