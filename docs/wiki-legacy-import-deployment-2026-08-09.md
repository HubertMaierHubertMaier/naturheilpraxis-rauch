# Legacy Wiki Import Deployment

## Scope

Commit `5232438` adds `20260809214500_import_legacy_wiki_into_kb.sql`.
It imports every row from `public.admin_knowledge_base` into the structured
`kb_articles` and `kb_article_revisions` tables without modifying the legacy
table. Imported revisions are internal `draft` records with
`origin_type = 'legacy_snapshot'`.

The complete legacy row is retained in `kb_article_revisions.metadata` under
`legacy_record`. This includes source citations, safety notes, dosage and
review fields that are not yet normalized into separate knowledge entities.

## Preconditions

1. Apply the Phase 1 core schema migration
   `20260728090000_create_kb_phase1_core.sql` before the legacy import.
2. Use the authorized Supabase deployment path for project
   `jmebqjadlpltnqawoipb`; do not paste credentials into this repository.
3. Confirm the preserved legacy inventory before applying the import:

```sql
SELECT count(*) AS legacy_rows FROM public.admin_knowledge_base;
```

The verified baseline is 436 rows. A different value is valid only if it is
documented before migration; the post-import counts must match that value.

## Post-Deployment Verification

```sql
WITH expected AS (
  SELECT count(*) AS total FROM public.admin_knowledge_base
), imported AS (
  SELECT count(*) AS total
  FROM public.kb_articles
  WHERE canonical_key LIKE 'legacy-admin-knowledge:%'
), revisions AS (
  SELECT count(*) AS total
  FROM public.kb_article_revisions
  WHERE origin_type = 'legacy_snapshot'
), incomplete AS (
  SELECT count(*) AS total
  FROM public.kb_articles AS article
  LEFT JOIN public.kb_article_revisions AS revision
    ON revision.id = article.current_revision_id
  WHERE article.canonical_key LIKE 'legacy-admin-knowledge:%'
    AND (
      revision.id IS NULL
      OR revision.review_status <> 'draft'
      OR revision.metadata ->> 'import_origin' <> 'admin_knowledge_base'
      OR revision.metadata ->> 'source_citations_preserved' <> 'true'
    )
), mismatched_records AS (
  SELECT count(*) AS total
  FROM public.admin_knowledge_base AS legacy
  LEFT JOIN public.kb_articles AS article
    ON article.id = legacy.id
  LEFT JOIN public.kb_article_revisions AS revision
    ON revision.id = article.current_revision_id
  WHERE revision.metadata -> 'legacy_record' IS DISTINCT FROM to_jsonb(legacy)
)
SELECT
  expected.total AS expected_legacy_rows,
  imported.total AS imported_articles,
  revisions.total AS imported_revisions,
  incomplete.total AS incomplete_imports,
  mismatched_records.total AS field_mismatches
FROM expected, imported, revisions, incomplete, mismatched_records;
```

Acceptance criteria: `expected_legacy_rows = imported_articles =
imported_revisions`, `incomplete_imports = 0`, and `field_mismatches = 0`.

## Verified Deployment Result

The authorized deployment applied the Phase 1 core schema migration followed
by the legacy import. The final read-only aggregate check recorded 618 legacy
and internal-source rows, 618 imported articles, 618 imported draft revisions,
zero incomplete imports, and zero JSONB field mismatches. The count includes
the preserved 436 legacy Wiki entries and 182 existing internal source and
audit drafts. `public.admin_knowledge_base` was not updated or deleted.

All imported revisions remain `draft` records with
`origin_type = 'legacy_snapshot'`. RLS remains admin-only; neither anonymous
nor patient roles can read the structured Wiki tables.

## Safety Boundary

- Do not update or delete any `admin_knowledge_base` row during this rollout.
- Do not change an imported revision from `draft`.
- Do not enable patient-facing or public read access.
- The existing admin-only RLS policies on all `kb_*` tables remain required.
- Any entity, source, assertion or safety normalization happens later as an
  additive review workflow; it is not part of this import.
