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
  IF to_regprocedure('public.kb_release_is_valid(uuid,boolean)') IS NULL
     OR to_regprocedure('public.kb_invalid_dosage_rule_count()') IS NULL
     OR to_regprocedure('public.kb_invalid_safety_rule_count()') IS NULL
     OR to_regprocedure('public.kb_export_wiki_snapshot()') IS NULL
  THEN
    RAISE EXCEPTION 'Search documents require the complete 55-table Wiki contract';
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
    RAISE EXCEPTION 'Search documents require the exact 55-table Wiki boundary';
  END IF;
END;
$$;

ALTER TABLE public.kb_release_items
  ADD CONSTRAINT kb_release_items_release_id_id_key UNIQUE (release_id, id);

CREATE OR REPLACE FUNCTION public.kb_search_normalize_v1(_value text)
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

CREATE OR REPLACE FUNCTION public.kb_search_text_array_is_valid_v1(_values text[])
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
           OR NULLIF(public.kb_search_normalize_v1(item.value), '') IS NULL
      )
$$;

CREATE OR REPLACE FUNCTION public.kb_search_document_item_payload_v1(_release_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  item public.kb_release_items%ROWTYPE;
  document_kind text;
  canonical_key text;
  title text;
  normalized_title text;
  aliases text[] := ARRAY[]::text[];
  normalized_aliases text[] := ARRAY[]::text[];
  identifier_terms text[] := ARRAY[]::text[];
  facet_terms text[] := ARRAY[]::text[];
  source_titles text[] := ARRAY[]::text[];
  body_text text := '';
  release_sealed_at timestamptz;
  payload jsonb;
BEGIN
  SELECT stored_item.*
    INTO item
    FROM public.kb_release_items stored_item
    JOIN public.kb_releases release ON release.id = stored_item.release_id
   WHERE stored_item.id = _release_item_id
     AND release.release_status = 'sealed'
     AND stored_item.item_kind IN ('entity_revision', 'article_revision', 'assertion');
  IF NOT FOUND
     OR public.kb_release_item_is_valid(item.id, false) IS DISTINCT FROM true
  THEN
    RETURN NULL;
  END IF;

  SELECT release.sealed_at
    INTO STRICT release_sealed_at
    FROM public.kb_releases release
   WHERE release.id = item.release_id;

  document_kind := item.item_kind;

  IF item.item_kind = 'entity_revision' THEN
    canonical_key := item.item_manifest #>> '{entity,canonical_key}';
    title := item.item_manifest #>> '{entity,display_name}';
    body_text := concat_ws(
      E'\n',
      NULLIF(item.item_manifest #>> '{entity,summary}', ''),
      NULLIF(item.item_manifest #>> '{entity,description_markdown}', '')
    );

    SELECT COALESCE(
             array_agg(candidate.value ORDER BY candidate.value COLLATE "C"),
             ARRAY[]::text[]
           )
      INTO aliases
      FROM (
        SELECT DISTINCT name.value ->> 'name' AS value
          FROM jsonb_array_elements(item.item_manifest #> '{entity,names}') name(value)
         WHERE name.value ->> 'retired_at_epoch' IS NULL
           AND NULLIF(public.kb_search_normalize_v1(name.value ->> 'name'), '') IS NOT NULL
           AND public.kb_search_normalize_v1(name.value ->> 'name')
               IS DISTINCT FROM public.kb_search_normalize_v1(title)
      ) candidate;

    SELECT COALESCE(
             array_agg(candidate.value ORDER BY candidate.value COLLATE "C"),
             ARRAY[]::text[]
           )
      INTO normalized_aliases
      FROM (
        SELECT DISTINCT public.kb_search_normalize_v1(alias.value) AS value
          FROM unnest(aliases) alias(value)
      ) candidate;

    SELECT COALESCE(
             array_agg(candidate.value ORDER BY candidate.value COLLATE "C"),
             ARRAY[]::text[]
           )
      INTO identifier_terms
      FROM (
         SELECT DISTINCT term.value
           FROM jsonb_array_elements(item.item_manifest #> '{entity,identifiers}') identifier(value)
           CROSS JOIN LATERAL (
             SELECT 'identifier_value:'
                    || to_jsonb(identifier.value ->> 'normalized_value')::text AS value
             UNION
             SELECT 'identifier:' || jsonb_build_array(
               identifier.value ->> 'scheme_code',
               identifier.value ->> 'namespace',
               identifier.value ->> 'normalized_value'
             )::text
           ) term
          WHERE NULLIF(
            public.kb_search_normalize_v1(identifier.value ->> 'normalized_value'),
            ''
          ) IS NOT NULL
      ) candidate;

    facet_terms := ARRAY[
      'entity_type:' || public.kb_search_normalize_v1(
        item.item_manifest #>> '{entity,entity_type_code}'
      )
    ]::text[];
  ELSIF item.item_kind = 'article_revision' THEN
    canonical_key := item.item_manifest #>> '{article,canonical_key}';
    title := item.item_manifest #>> '{article,title}';
    body_text := COALESCE(item.item_manifest #>> '{article,content_markdown}', '');

    SELECT COALESCE(
             array_agg(candidate.value ORDER BY candidate.value COLLATE "C"),
             ARRAY[]::text[]
           )
      INTO facet_terms
      FROM (
        SELECT DISTINCT facet.value
          FROM (
            SELECT 'article_kind:' || public.kb_search_normalize_v1(
                     item.item_manifest #>> '{article,article_kind}'
                   ) AS value
            UNION ALL
            SELECT 'category:' || public.kb_search_normalize_v1(
                     item.item_manifest #>> '{article,category_path}'
                   )
             WHERE NULLIF(public.kb_search_normalize_v1(
               item.item_manifest #>> '{article,category_path}'
             ), '') IS NOT NULL
            UNION ALL
            SELECT 'tag:' || public.kb_search_normalize_v1(tag.value)
              FROM jsonb_array_elements_text(item.item_manifest #> '{article,tags}') tag(value)
              WHERE NULLIF(public.kb_search_normalize_v1(tag.value), '') IS NOT NULL
          ) facet
      ) candidate;
  ELSE
    canonical_key := item.item_manifest #>> '{assertion,canonical_key}';
    title := item.item_manifest #>> '{assertion,claim_text}';
    body_text := COALESCE(item.item_manifest #>> '{assertion,relation,context_text}', '');

    SELECT COALESCE(
             array_agg(candidate.value ORDER BY candidate.value COLLATE "C"),
             ARRAY[]::text[]
           )
      INTO facet_terms
      FROM (
        SELECT DISTINCT facet.value
          FROM (
            SELECT 'assertion_kind:' || public.kb_search_normalize_v1(
                     item.item_manifest #>> '{assertion,assertion_kind}'
                   ) AS value
            UNION ALL
            SELECT 'evidence_basis:' || public.kb_search_normalize_v1(
                     item.item_manifest #>> '{assertion,evidence_basis}'
                   )
            UNION ALL
            SELECT 'evidence_quality:' || public.kb_search_normalize_v1(
                     item.item_manifest #>> '{assertion,evidence_quality}'
                   )
            UNION ALL
            SELECT 'relation_type:' || public.kb_search_normalize_v1(
                     item.item_manifest #>> '{assertion,relation,relation_type_code}'
                   )
             WHERE NULLIF(
               btrim(item.item_manifest #>> '{assertion,relation,relation_type_code}'),
               ''
             ) IS NOT NULL
          ) facet
         WHERE NULLIF(btrim(facet.value), '') IS NOT NULL
      ) candidate;

    SELECT COALESCE(
             array_agg(candidate.value ORDER BY candidate.value COLLATE "C"),
             ARRAY[]::text[]
           )
      INTO source_titles
      FROM (
        SELECT DISTINCT source_item.item_manifest #>> '{source,title}' AS value
          FROM jsonb_array_elements(item.item_manifest #> '{assertion,sources}') source(value)
          JOIN public.kb_release_items source_item
            ON source_item.release_id = item.release_id
           AND source_item.item_kind = 'source_revision'
           AND source_item.source_revision_id = (source.value ->> 'source_revision_id')::uuid
          WHERE NULLIF(public.kb_search_normalize_v1(
            source_item.item_manifest #>> '{source,title}'
          ), '') IS NOT NULL
      ) candidate;
  END IF;

  normalized_title := public.kb_search_normalize_v1(title);
  payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'projection_schema_version', 1,
    'release_id', item.release_id,
    'release_item_id', item.id,
    'document_kind', document_kind,
    'canonical_key', canonical_key,
    'title', title,
    'normalized_title', normalized_title,
    'aliases', to_jsonb(aliases),
    'normalized_aliases', to_jsonb(normalized_aliases),
    'identifier_terms', to_jsonb(identifier_terms),
    'facet_terms', to_jsonb(facet_terms),
    'source_titles', to_jsonb(source_titles),
    'body_text', body_text,
    'release_sealed_at_epoch', extract(epoch FROM release_sealed_at)::text
  ));

  IF canonical_key IS NULL
     OR canonical_key !~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'
     OR octet_length(canonical_key) > 256
     OR NULLIF(btrim(title), '') IS NULL
     OR octet_length(title) > 8192
     OR NULLIF(btrim(normalized_title), '') IS NULL
     OR octet_length(normalized_title) > 8192
     OR octet_length(body_text) > 524288
     OR public.kb_search_text_array_is_valid_v1(aliases) IS DISTINCT FROM true
     OR public.kb_search_text_array_is_valid_v1(normalized_aliases) IS DISTINCT FROM true
     OR public.kb_search_text_array_is_valid_v1(identifier_terms) IS DISTINCT FROM true
     OR public.kb_search_text_array_is_valid_v1(facet_terms) IS DISTINCT FROM true
     OR public.kb_search_text_array_is_valid_v1(source_titles) IS DISTINCT FROM true
     OR octet_length(payload::text) > 786432
  THEN
    RETURN NULL;
  END IF;

  RETURN payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_search_document_payload_v1(_release_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  item_release_id uuid;
BEGIN
  SELECT item.release_id
    INTO item_release_id
    FROM public.kb_release_items item
   WHERE item.id = _release_item_id;
  IF NOT FOUND
     OR public.kb_release_is_valid(item_release_id, false) IS DISTINCT FROM true
  THEN
    RETURN NULL;
  END IF;

  RETURN public.kb_search_document_item_payload_v1(_release_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_search_vector_german_v1(_payload jsonb)
RETURNS tsvector
LANGUAGE sql
STABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT
    setweight(to_tsvector(
      'pg_catalog.german'::regconfig,
      concat_ws(' ',
        _payload ->> 'title',
        (SELECT string_agg(item.value, ' ' ORDER BY item.position)
           FROM jsonb_array_elements_text(_payload -> 'aliases')
                WITH ORDINALITY item(value, position))
      )
    ), 'A')
    || setweight(to_tsvector(
      'pg_catalog.german'::regconfig,
      COALESCE((
        SELECT string_agg(item.value, ' ' ORDER BY item.position)
          FROM jsonb_array_elements_text(_payload -> 'facet_terms')
               WITH ORDINALITY item(value, position)
      ), '')
    ), 'B')
    || setweight(to_tsvector(
      'pg_catalog.german'::regconfig,
      COALESCE((
        SELECT string_agg(item.value, ' ' ORDER BY item.position)
          FROM jsonb_array_elements_text(_payload -> 'source_titles')
               WITH ORDINALITY item(value, position)
      ), '')
    ), 'C')
    || setweight(to_tsvector(
      'pg_catalog.german'::regconfig,
      COALESCE(_payload ->> 'body_text', '')
    ), 'D')
$$;

CREATE OR REPLACE FUNCTION public.kb_search_vector_simple_v1(_payload jsonb)
RETURNS tsvector
LANGUAGE sql
STABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT
    setweight(to_tsvector(
      'pg_catalog.simple'::regconfig,
      concat_ws(' ',
        _payload ->> 'title',
        (SELECT string_agg(item.value, ' ' ORDER BY item.position)
           FROM jsonb_array_elements_text(_payload -> 'aliases')
                WITH ORDINALITY item(value, position))
      )
    ), 'A')
    || setweight(to_tsvector(
      'pg_catalog.simple'::regconfig,
      concat_ws(' ',
        _payload ->> 'canonical_key',
        (SELECT string_agg(item.value, ' ' ORDER BY item.position)
           FROM jsonb_array_elements_text(_payload -> 'identifier_terms')
                WITH ORDINALITY item(value, position)),
        (SELECT string_agg(item.value, ' ' ORDER BY item.position)
           FROM jsonb_array_elements_text(_payload -> 'facet_terms')
                WITH ORDINALITY item(value, position))
      )
    ), 'B')
    || setweight(to_tsvector(
      'pg_catalog.simple'::regconfig,
      COALESCE((
        SELECT string_agg(item.value, ' ' ORDER BY item.position)
          FROM jsonb_array_elements_text(_payload -> 'source_titles')
               WITH ORDINALITY item(value, position)
      ), '')
    ), 'C')
    || setweight(to_tsvector(
      'pg_catalog.simple'::regconfig,
      COALESCE(_payload ->> 'body_text', '')
    ), 'D')
$$;

CREATE TABLE public.kb_search_documents (
  release_item_id uuid PRIMARY KEY,
  release_id uuid NOT NULL,
  projection_schema_version integer NOT NULL DEFAULT 1
    CHECK (projection_schema_version = 1),
  document_kind text NOT NULL DEFAULT ''
    CHECK (document_kind IN ('entity_revision', 'article_revision', 'assertion')),
  canonical_key text NOT NULL DEFAULT ''
    CHECK (
      canonical_key ~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'
      AND octet_length(canonical_key) <= 256
    ),
  title text NOT NULL DEFAULT ''
    CHECK (btrim(title) <> '' AND octet_length(title) <= 8192),
  normalized_title text NOT NULL DEFAULT ''
    CHECK (btrim(normalized_title) <> '' AND octet_length(normalized_title) <= 8192),
  aliases text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (public.kb_search_text_array_is_valid_v1(aliases)),
  normalized_aliases text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (public.kb_search_text_array_is_valid_v1(normalized_aliases)),
  identifier_terms text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (public.kb_search_text_array_is_valid_v1(identifier_terms)),
  facet_terms text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (public.kb_search_text_array_is_valid_v1(facet_terms)),
  source_titles text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (public.kb_search_text_array_is_valid_v1(source_titles)),
  body_text text NOT NULL DEFAULT ''
    CHECK (octet_length(body_text) <= 524288),
  search_vector_german tsvector NOT NULL DEFAULT ''::tsvector,
  search_vector_simple tsvector NOT NULL DEFAULT ''::tsvector,
  projection_hash text NOT NULL DEFAULT repeat('0', 64)
    CHECK (projection_hash ~ '^[0-9a-f]{64}$'),
  release_sealed_at timestamptz NOT NULL,
  FOREIGN KEY (release_id, release_item_id)
    REFERENCES public.kb_release_items(release_id, id) ON DELETE RESTRICT
);

CREATE INDEX kb_search_documents_title_idx
  ON public.kb_search_documents(release_id, normalized_title COLLATE "C");
CREATE INDEX kb_search_documents_key_prefix_idx
  ON public.kb_search_documents(release_id, canonical_key text_pattern_ops);
CREATE INDEX kb_search_documents_aliases_idx
  ON public.kb_search_documents USING gin(normalized_aliases);
CREATE INDEX kb_search_documents_identifiers_idx
  ON public.kb_search_documents USING gin(identifier_terms);
CREATE INDEX kb_search_documents_facets_idx
  ON public.kb_search_documents USING gin(facet_terms);
CREATE INDEX kb_search_documents_german_fts_idx
  ON public.kb_search_documents USING gin(search_vector_german);
CREATE INDEX kb_search_documents_simple_fts_idx
  ON public.kb_search_documents USING gin(search_vector_simple);

CREATE OR REPLACE FUNCTION public.kb_protect_search_document_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  expected jsonb;
  expected_release_sealed_at timestamptz;
BEGIN
  SELECT pg_get_userbyid(relclass.relowner)
    INTO STRICT table_owner
    FROM pg_class relclass
   WHERE relclass.oid = TG_RELID;
  IF current_user <> table_owner THEN
    RAISE EXCEPTION 'Search document writes require the database table owner';
  END IF;
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Search documents are append-only';
  END IF;

  expected := public.kb_search_document_item_payload_v1(NEW.release_item_id);
  IF expected IS NULL THEN
    RAISE EXCEPTION 'Search documents require an eligible item from a valid sealed release';
  END IF;
  IF NEW.release_id IS DISTINCT FROM (expected ->> 'release_id')::uuid THEN
    RAISE EXCEPTION 'Search document release does not own the release item';
  END IF;

  NEW.projection_schema_version := (expected ->> 'projection_schema_version')::integer;
  NEW.document_kind := expected ->> 'document_kind';
  NEW.canonical_key := expected ->> 'canonical_key';
  NEW.title := expected ->> 'title';
  NEW.normalized_title := expected ->> 'normalized_title';
  NEW.aliases := ARRAY(
    SELECT item.value
      FROM jsonb_array_elements_text(expected -> 'aliases')
           WITH ORDINALITY item(value, position)
     ORDER BY item.position
  );
  NEW.normalized_aliases := ARRAY(
    SELECT item.value
      FROM jsonb_array_elements_text(expected -> 'normalized_aliases')
           WITH ORDINALITY item(value, position)
     ORDER BY item.position
  );
  NEW.identifier_terms := ARRAY(
    SELECT item.value
      FROM jsonb_array_elements_text(expected -> 'identifier_terms')
           WITH ORDINALITY item(value, position)
     ORDER BY item.position
  );
  NEW.facet_terms := ARRAY(
    SELECT item.value
      FROM jsonb_array_elements_text(expected -> 'facet_terms')
           WITH ORDINALITY item(value, position)
     ORDER BY item.position
  );
  NEW.source_titles := ARRAY(
    SELECT item.value
      FROM jsonb_array_elements_text(expected -> 'source_titles')
           WITH ORDINALITY item(value, position)
     ORDER BY item.position
  );
  NEW.body_text := expected ->> 'body_text';
  NEW.search_vector_german := public.kb_search_vector_german_v1(expected);
  NEW.search_vector_simple := public.kb_search_vector_simple_v1(expected);
  NEW.projection_hash := public.kb_release_manifest_hash_v1(expected);
  SELECT release.sealed_at
    INTO STRICT expected_release_sealed_at
    FROM public.kb_releases release
   WHERE release.id = NEW.release_id;
  NEW.release_sealed_at := expected_release_sealed_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_guard_search_document_release_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    WITH inserted_releases AS MATERIALIZED (
      SELECT DISTINCT document.release_id
        FROM inserted_search_documents document
    ),
    release_validity AS MATERIALIZED (
      SELECT inserted_release.release_id,
             public.kb_release_is_valid(inserted_release.release_id, false) AS is_valid
        FROM inserted_releases inserted_release
    )
    SELECT 1
      FROM release_validity
     WHERE release_validity.is_valid IS DISTINCT FROM true
  ) THEN
    RAISE EXCEPTION 'Search documents require eligible items from valid sealed releases';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_search_document_matches_item_v1(_release_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  document public.kb_search_documents%ROWTYPE;
  expected jsonb;
BEGIN
  SELECT stored_document.*
    INTO document
    FROM public.kb_search_documents stored_document
   WHERE stored_document.release_item_id = _release_item_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  expected := public.kb_search_document_item_payload_v1(_release_item_id);
  IF expected IS NULL THEN
    RETURN false;
  END IF;

  RETURN document.release_id IS NOT DISTINCT FROM (expected ->> 'release_id')::uuid
     AND document.projection_schema_version IS NOT DISTINCT FROM
         (expected ->> 'projection_schema_version')::integer
     AND document.document_kind IS NOT DISTINCT FROM expected ->> 'document_kind'
     AND document.canonical_key IS NOT DISTINCT FROM expected ->> 'canonical_key'
     AND document.title IS NOT DISTINCT FROM expected ->> 'title'
     AND document.normalized_title IS NOT DISTINCT FROM expected ->> 'normalized_title'
     AND to_jsonb(document.aliases) IS NOT DISTINCT FROM expected -> 'aliases'
     AND to_jsonb(document.normalized_aliases) IS NOT DISTINCT FROM expected -> 'normalized_aliases'
     AND to_jsonb(document.identifier_terms) IS NOT DISTINCT FROM expected -> 'identifier_terms'
     AND to_jsonb(document.facet_terms) IS NOT DISTINCT FROM expected -> 'facet_terms'
     AND to_jsonb(document.source_titles) IS NOT DISTINCT FROM expected -> 'source_titles'
     AND document.body_text IS NOT DISTINCT FROM expected ->> 'body_text'
      AND document.search_vector_german IS NOT DISTINCT FROM
          public.kb_search_vector_german_v1(expected)
      AND document.search_vector_simple IS NOT DISTINCT FROM
          public.kb_search_vector_simple_v1(expected)
      AND document.projection_hash IS NOT DISTINCT FROM
          public.kb_release_manifest_hash_v1(expected)
      AND extract(epoch FROM document.release_sealed_at) IS NOT DISTINCT FROM
          (expected ->> 'release_sealed_at_epoch')::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_search_document_is_valid(_release_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  document_release_id uuid;
BEGIN
  SELECT document.release_id
    INTO document_release_id
    FROM public.kb_search_documents document
   WHERE document.release_item_id = _release_item_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN public.kb_release_is_valid(document_release_id, false)
         IS NOT DISTINCT FROM true
     AND public.kb_search_document_matches_item_v1(_release_item_id)
         IS NOT DISTINCT FROM true;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_search_document_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH release_validity AS MATERIALIZED (
    SELECT projected_release.release_id,
           public.kb_release_is_valid(projected_release.release_id, false) AS is_valid
      FROM (
        SELECT DISTINCT document.release_id
          FROM public.kb_search_documents document
      ) projected_release
  )
  SELECT count(*)
    FROM public.kb_search_documents document
    JOIN release_validity
      ON release_validity.release_id = document.release_id
   WHERE release_validity.is_valid IS DISTINCT FROM true
      OR public.kb_search_document_matches_item_v1(document.release_item_id)
         IS DISTINCT FROM true
$$;

CREATE OR REPLACE FUNCTION public.kb_prevent_search_document_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Search documents cannot be truncated';
END;
$$;

CREATE TRIGGER kb_search_documents_protect_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_search_documents
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_search_document_write();
CREATE TRIGGER kb_search_documents_validate_release
  AFTER INSERT ON public.kb_search_documents
  REFERENCING NEW TABLE AS inserted_search_documents
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_guard_search_document_release_insert();
CREATE TRIGGER kb_search_documents_prevent_truncate
  BEFORE TRUNCATE ON public.kb_search_documents
  FOR EACH STATEMENT EXECUTE FUNCTION public.kb_prevent_search_document_truncate();

ALTER TABLE public.kb_search_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_search_documents_admin_read
  ON public.kb_search_documents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE public.kb_search_documents
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT SELECT ON TABLE public.kb_search_documents TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.kb_search_normalize_v1(text)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_search_text_array_is_valid_v1(text[])
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_search_document_item_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_search_document_payload_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_search_vector_german_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_search_vector_simple_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_search_document_write()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_guard_search_document_release_insert()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_search_document_matches_item_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_search_document_is_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_search_document_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_prevent_search_document_truncate()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

ALTER FUNCTION public.kb_export_wiki_snapshot()
  RENAME TO kb_export_wiki_snapshot_4b1;
REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot_4b1()
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
  snapshot := public.kb_export_wiki_snapshot_4b1();
  RETURN jsonb_set(
    snapshot,
    '{validation}',
    (snapshot -> 'validation') || jsonb_build_object(
      'invalid_search_documents', public.kb_invalid_search_document_count()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT EXECUTE ON FUNCTION public.kb_export_wiki_snapshot()
  TO service_role;

COMMIT;
