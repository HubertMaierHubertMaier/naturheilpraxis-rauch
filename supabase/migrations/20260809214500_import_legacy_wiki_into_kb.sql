BEGIN;

-- Preserve every legacy field in the new internal article revision. The legacy
-- table remains untouched, so the parallel read-only rollout is reversible.
WITH legacy AS (
  SELECT
    legacy_entry.id,
    to_jsonb(legacy_entry) AS payload
  FROM public.admin_knowledge_base AS legacy_entry
)
INSERT INTO public.kb_articles (
  id,
  canonical_key,
  article_kind,
  metadata,
  created_at,
  updated_at
)
SELECT
  legacy.id,
  'legacy-admin-knowledge:' || legacy.id::text,
  CASE legacy.payload ->> 'entry_kind'
    WHEN 'remedy' THEN 'remedy'
    WHEN 'protocol' THEN 'protocol'
    WHEN 'diagnostic' THEN 'diagnostic'
    WHEN 'product' THEN 'product'
    WHEN 'equipment' THEN 'equipment'
    ELSE 'reference'
  END,
  jsonb_build_object(
    'import_origin', 'admin_knowledge_base',
    'legacy_id', legacy.id,
    'source_citations_preserved', true
  ),
  COALESCE((legacy.payload ->> 'created_at')::timestamptz, now()),
  COALESCE((legacy.payload ->> 'updated_at')::timestamptz, now())
FROM legacy
ON CONFLICT (canonical_key) DO NOTHING;

WITH legacy AS (
  SELECT
    legacy_entry.id,
    to_jsonb(legacy_entry) AS payload
  FROM public.admin_knowledge_base AS legacy_entry
)
INSERT INTO public.kb_article_revisions (
  id,
  article_id,
  revision_no,
  title,
  category_path,
  tags,
  content_markdown,
  review_status,
  origin_type,
  content_hash,
  metadata,
  created_at
)
SELECT
  legacy.id,
  legacy.id,
  1,
  COALESCE(NULLIF(legacy.payload ->> 'title', ''), 'Unbenannter Alt-Wiki-Eintrag'),
  COALESCE(legacy.payload ->> 'category', ''),
  CASE
    WHEN jsonb_typeof(legacy.payload -> 'tags') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(legacy.payload -> 'tags'))
    ELSE '{}'::text[]
  END,
  COALESCE(legacy.payload ->> 'content', ''),
  'draft',
  'legacy_snapshot',
  md5(legacy.payload::text || ':legacy-wiki:1')
    || md5(legacy.payload::text || ':legacy-wiki:2'),
  jsonb_build_object(
    'import_origin', 'admin_knowledge_base',
    'legacy_id', legacy.id,
    'legacy_record', legacy.payload,
    'source_citations_preserved', true
  ),
  COALESCE((legacy.payload ->> 'created_at')::timestamptz, now())
FROM legacy
ON CONFLICT (article_id, revision_no) DO NOTHING;

UPDATE public.kb_articles AS article
SET current_revision_id = legacy_entry.id
FROM public.admin_knowledge_base AS legacy_entry
WHERE article.id = legacy_entry.id
  AND article.current_revision_id IS NULL;

COMMIT;
