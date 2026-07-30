BEGIN;

ALTER TABLE public.kb_articles
  ADD COLUMN legacy_knowledge_entry_id uuid UNIQUE;

COMMENT ON COLUMN public.kb_articles.legacy_knowledge_entry_id IS
  'Immutable mapping to admin_knowledge_base.id. No foreign key by design so legacy deletion cannot remove revision history.';

CREATE OR REPLACE FUNCTION public.kb_protect_legacy_bridge_article()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
BEGIN
  SELECT pg_get_userbyid(relclass.relowner)
    INTO STRICT table_owner
    FROM pg_class relclass
    JOIN pg_namespace namespace ON namespace.oid = relclass.relnamespace
   WHERE namespace.nspname = TG_TABLE_SCHEMA
     AND relclass.relname = TG_TABLE_NAME;

  IF current_user <> table_owner AND (
    (TG_OP = 'INSERT' AND (NEW.legacy_knowledge_entry_id IS NOT NULL OR NEW.canonical_key LIKE 'legacy:%'))
    OR (TG_OP = 'UPDATE' AND (
      OLD.legacy_knowledge_entry_id IS NOT NULL
      OR NEW.legacy_knowledge_entry_id IS NOT NULL
      OR OLD.canonical_key LIKE 'legacy:%'
      OR NEW.canonical_key LIKE 'legacy:%'
    ))
    OR (TG_OP = 'DELETE' AND (OLD.legacy_knowledge_entry_id IS NOT NULL OR OLD.canonical_key LIKE 'legacy:%'))
  ) THEN
    RAISE EXCEPTION 'Legacy bridge articles may only be changed through admin_knowledge_base';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER kb_articles_bridge_rows_protect
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_legacy_bridge_article();

CREATE TRIGGER kb_articles_legacy_id_immutable
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('legacy_knowledge_entry_id');

CREATE OR REPLACE FUNCTION public.kb_legacy_article_hash(_legacy_row jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT encode(
    sha256(convert_to((_legacy_row - 'updated_at')::text, 'UTF8')),
    'hex'
  )
$$;

COMMENT ON FUNCTION public.kb_legacy_article_hash(jsonb) IS
  'SHA-256 over canonical JSONB for the complete legacy row except derived updated_at. Array order and all knowledge/review fields remain significant.';

CREATE OR REPLACE FUNCTION public.kb_sync_legacy_article_row(
  _legacy public.admin_knowledge_base
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_article_id uuid;
  target_current_revision_id uuid;
  target_current_hash text;
  target_canonical_key text;
  target_lifecycle_status text;
  target_metadata jsonb;
  next_revision_no integer;
  new_revision_id uuid;
  legacy_hash text := public.kb_legacy_article_hash(to_jsonb(_legacy));
  bridge_metadata jsonb := jsonb_build_object(
    'bridge_source', 'public.admin_knowledge_base',
    'bridge_version', 1,
    'legacy_knowledge_entry_id', _legacy.id::text
  );
  revision_metadata jsonb := jsonb_build_object(
    'bridge_source', 'public.admin_knowledge_base',
    'bridge_version', 1,
    'legacy_knowledge_entry_id', _legacy.id::text,
    'legacy_metadata', to_jsonb(_legacy) - ARRAY['id', 'title', 'category', 'tags', 'content']
  );
BEGIN
  INSERT INTO public.kb_articles (
    canonical_key,
    article_kind,
    legacy_knowledge_entry_id,
    metadata,
    created_at
  ) VALUES (
    'legacy:' || _legacy.id::text,
    _legacy.entry_kind,
    _legacy.id,
    bridge_metadata,
    _legacy.created_at
  )
  ON CONFLICT (legacy_knowledge_entry_id) DO NOTHING;

  SELECT article.id, article.current_revision_id, article.canonical_key, article.lifecycle_status, article.metadata
    INTO target_article_id, target_current_revision_id, target_canonical_key, target_lifecycle_status, target_metadata
    FROM public.kb_articles article
   WHERE article.legacy_knowledge_entry_id = _legacy.id
   FOR UPDATE;

  IF target_article_id IS NULL THEN
    RAISE EXCEPTION 'Legacy Wiki row % could not be mapped to a stable article', _legacy.id;
  END IF;

  IF target_canonical_key <> 'legacy:' || _legacy.id::text THEN
    RAISE EXCEPTION 'Legacy Wiki row % is mapped to an invalid canonical key', _legacy.id;
  END IF;

  IF target_current_revision_id IS NOT NULL THEN
    SELECT revision.content_hash
      INTO target_current_hash
      FROM public.kb_article_revisions revision
     WHERE revision.id = target_current_revision_id
       AND revision.article_id = target_article_id;
  END IF;

  IF target_current_hash IS NOT DISTINCT FROM legacy_hash
     AND target_lifecycle_status <> 'withdrawn'
  THEN
    UPDATE public.kb_articles
       SET article_kind = _legacy.entry_kind,
           lifecycle_status = 'active',
           metadata = (metadata - 'legacy_deleted_at') || bridge_metadata
     WHERE id = target_article_id;
    RETURN;
  END IF;

  SELECT COALESCE(max(revision.revision_no), 0) + 1
    INTO next_revision_no
    FROM public.kb_article_revisions revision
   WHERE revision.article_id = target_article_id;

  IF target_lifecycle_status = 'withdrawn' THEN
    revision_metadata := revision_metadata || jsonb_build_object(
      'reinstated_after_legacy_delete_at', target_metadata -> 'legacy_deleted_at'
    );
  END IF;

  INSERT INTO public.kb_article_revisions (
    article_id,
    revision_no,
    title,
    category_path,
    tags,
    content_markdown,
    origin_type,
    content_hash,
    metadata,
    created_at
  ) VALUES (
    target_article_id,
    next_revision_no,
    _legacy.title,
    _legacy.category,
    _legacy.tags,
    _legacy.content,
    'legacy_snapshot',
    legacy_hash,
    revision_metadata,
    CASE WHEN next_revision_no = 1 THEN _legacy.created_at ELSE now() END
  )
  RETURNING id INTO new_revision_id;

  UPDATE public.kb_articles
     SET article_kind = _legacy.entry_kind,
         lifecycle_status = 'active',
         current_revision_id = new_revision_id,
         metadata = (metadata - 'legacy_deleted_at') || bridge_metadata
   WHERE id = target_article_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_capture_legacy_article_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.kb_articles
       SET lifecycle_status = 'withdrawn',
           metadata = metadata || jsonb_build_object(
             'legacy_deleted_at', now(),
             'bridge_source', 'public.admin_knowledge_base',
             'bridge_version', 1
           )
     WHERE legacy_knowledge_entry_id = OLD.id;
    RETURN OLD;
  END IF;

  PERFORM public.kb_sync_legacy_article_row(NEW);
  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_admin_knowledge_base_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.kb_capture_legacy_article_change();

CREATE OR REPLACE FUNCTION public.kb_protect_legacy_article_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.origin_type = 'legacy_snapshot' THEN
    RAISE EXCEPTION 'Legacy article snapshots are immutable';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER kb_article_legacy_snapshots_immutable
  BEFORE UPDATE OR DELETE ON public.kb_article_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_legacy_article_snapshot();

CREATE OR REPLACE FUNCTION public.kb_protect_legacy_bridge_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  touches_legacy_article boolean;
BEGIN
  SELECT pg_get_userbyid(relclass.relowner)
    INTO STRICT table_owner
    FROM pg_class relclass
    JOIN pg_namespace namespace ON namespace.oid = relclass.relnamespace
   WHERE namespace.nspname = 'public'
     AND relclass.relname = 'kb_articles';

  SELECT EXISTS (
    SELECT 1
      FROM public.kb_articles article
     WHERE article.legacy_knowledge_entry_id IS NOT NULL
       AND article.id IN (
         CASE WHEN TG_OP <> 'INSERT' THEN OLD.article_id END,
         CASE WHEN TG_OP <> 'DELETE' THEN NEW.article_id END
       )
  ) INTO touches_legacy_article;

  IF touches_legacy_article AND current_user <> table_owner THEN
    RAISE EXCEPTION 'Legacy bridge revisions may only be created by the bridge';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER kb_article_revisions_bridge_rows_protect
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_article_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_legacy_bridge_revision();

CREATE OR REPLACE FUNCTION public.kb_protect_legacy_bridge_article_entity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  touches_legacy_article boolean;
BEGIN
  SELECT pg_get_userbyid(relclass.relowner)
    INTO STRICT table_owner
    FROM pg_class relclass
    JOIN pg_namespace namespace ON namespace.oid = relclass.relnamespace
   WHERE namespace.nspname = 'public'
     AND relclass.relname = 'kb_articles';

  SELECT EXISTS (
    SELECT 1
      FROM public.kb_article_revisions revision
      JOIN public.kb_articles article ON article.id = revision.article_id
     WHERE article.legacy_knowledge_entry_id IS NOT NULL
       AND revision.id IN (
         CASE WHEN TG_OP <> 'INSERT' THEN OLD.article_revision_id END,
         CASE WHEN TG_OP <> 'DELETE' THEN NEW.article_revision_id END
       )
  ) INTO touches_legacy_article;

  IF touches_legacy_article AND current_user <> table_owner THEN
    RAISE EXCEPTION 'Legacy bridge article entities may only be changed by the bridge';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER kb_article_entities_bridge_rows_protect
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_article_entities
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_legacy_bridge_article_entity();

DO $$
DECLARE
  table_owner name;
  sync_function_owner name;
BEGIN
  SELECT pg_get_userbyid(relclass.relowner)
    INTO STRICT table_owner
    FROM pg_class relclass
    JOIN pg_namespace namespace ON namespace.oid = relclass.relnamespace
   WHERE namespace.nspname = 'public'
     AND relclass.relname = 'kb_articles';

  SELECT pg_get_userbyid(procedure.proowner)
    INTO STRICT sync_function_owner
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
   WHERE namespace.nspname = 'public'
     AND procedure.proname = 'kb_sync_legacy_article_row';

  IF table_owner <> sync_function_owner THEN
    RAISE EXCEPTION 'Legacy bridge function owner must match kb_articles owner';
  END IF;
END;
$$;

DO $$
DECLARE
  legacy_row public.admin_knowledge_base%ROWTYPE;
BEGIN
  FOR legacy_row IN
    SELECT *
      FROM public.admin_knowledge_base
     ORDER BY id
  LOOP
    PERFORM public.kb_sync_legacy_article_row(legacy_row);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_snapshot_rows_hash(_rows jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(_rows::text, 'UTF8')), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.kb_export_wiki_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  wiki_table text;
  table_rows jsonb;
  tables_json jsonb := '{}'::jsonb;
  manifest_json jsonb := '{}'::jsonb;
  validation_json jsonb;
  invalid_source_promotions bigint := 0;
  invalid_therapeutic_catalog_revisions bigint := 0;
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
      'SELECT COALESCE(jsonb_agg(to_jsonb(table_row) ORDER BY to_jsonb(table_row)::text), ''[]''::jsonb) FROM public.%I table_row',
      wiki_table
    ) INTO table_rows;
    tables_json := tables_json || jsonb_build_object(wiki_table, table_rows);
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

  validation_json := validation_json || jsonb_build_object(
    'invalid_source_promotions', invalid_source_promotions,
    'invalid_therapeutic_catalog_revisions', invalid_therapeutic_catalog_revisions
  );

  RETURN jsonb_build_object(
    'tables', tables_json,
    'manifest', manifest_json,
    'validation', validation_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kb_sync_legacy_article_row(public.admin_knowledge_base)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_capture_legacy_article_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kb_export_wiki_snapshot()
  TO service_role;

COMMIT;
