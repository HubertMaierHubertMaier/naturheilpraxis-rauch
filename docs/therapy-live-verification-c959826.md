# Internal Therapy Live Verification: c959826

## Scope

Verify the internal-only `therapy-recommend` routine from commit `c959826`
against Supabase project `jmebqjadlpltnqawoipb`.

- Do not write to the database.
- Do not deploy, publish, or change function configuration.
- Do not submit patient data or make patient-facing output available.
- Keep structured Wiki content admin-only.

## Prerequisites

1. An authorized Supabase CLI session or `SUPABASE_ACCESS_TOKEN` is available
   in the running environment.
2. A separately authorized admin-browser session is available for the
   function's runtime check.
3. The checked branch resolves to `c959826896111c7ce12f921ed1921750961915b7`.

## Read-Only Database Checks

Run these in the authorized Supabase SQL editor. They do not modify data.

```sql
SELECT
  (SELECT count(*) FROM public.kb_articles) AS kb_articles,
  (SELECT count(*) FROM public.kb_article_revisions) AS kb_article_revisions,
  (SELECT count(*) FROM public.kb_article_revisions WHERE origin_type = 'legacy_snapshot') AS legacy_snapshot_revisions,
  (SELECT count(*) FROM public.kb_article_revisions WHERE review_status = 'draft') AS draft_revisions;
```

Expected baseline: `618` articles, `618` revisions, and no patient or public
read access. The `legacy_snapshot` revision metadata must retain the original
row under `legacy_record`.

```sql
SELECT
  count(*) FILTER (WHERE article.current_revision_id IS NULL) AS missing_current_revision,
  count(*) FILTER (WHERE revision.id IS NULL) AS unresolved_current_revision,
  count(*) FILTER (WHERE revision.metadata -> 'legacy_record' IS NULL) AS legacy_metadata_missing
FROM public.kb_articles AS article
LEFT JOIN public.kb_article_revisions AS revision
  ON revision.id = article.current_revision_id
WHERE article.canonical_key LIKE 'legacy-admin-knowledge:%';
```

Expected result: all three counts are `0` for imported legacy articles.

## Edge Function Checks

1. Run `npx supabase functions list --project-ref jmebqjadlpltnqawoipb` and
   confirm that `therapy-recommend` is listed.
2. Confirm unauthenticated POST requests receive `401` before application
   processing.
3. Confirm an untrusted browser origin receives no
   `Access-Control-Allow-Origin` response header.
4. In the authorized admin UI only, run one synthetic, non-patient request.
   Verify that the audit payload reports the structured Wiki count and that
   generated content is marked as an internal candidate draft, not a patient
   plan.
5. Confirm the audit data uses current `kb_articles`/
   `kb_article_revisions` records and never queries
   `admin_knowledge_base` directly.

## Stop Conditions

Stop the verification and do not publish or modify anything if:

- counts differ from the verified structured Wiki baseline;
- an anonymous or patient role can access `kb_*` records;
- the function is absent, does not require authentication, or serves a
  different deployment;
- the candidate output is not clearly internal-only.
