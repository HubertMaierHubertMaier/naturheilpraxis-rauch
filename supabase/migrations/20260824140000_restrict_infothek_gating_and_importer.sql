DROP POLICY IF EXISTS "Anyone can read gating" ON public.infothek_gating;
DROP POLICY IF EXISTS "Admins can read gating" ON public.infothek_gating;

CREATE POLICY "Admins can read gating"
ON public.infothek_gating
FOR SELECT
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

REVOKE SELECT ON public.infothek_gating FROM anon, authenticated;
REVOKE SELECT (href, gated, visibility) ON public.infothek_gating FROM anon, authenticated;
GRANT SELECT ON public.infothek_gating TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_infothek_gating_for_routes(_hrefs text[])
RETURNS TABLE(href text, gated boolean, visibility text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gating.href, gating.gated, gating.visibility
  FROM public.infothek_gating AS gating
  JOIN (
    SELECT DISTINCT requested_href
    FROM unnest(COALESCE(_hrefs, ARRAY[]::text[])) AS requested(requested_href)
    WHERE requested_href ~ '^/[a-zA-Z0-9][a-zA-Z0-9._/-]*$'
  ) AS requested ON requested.requested_href = gating.href
  WHERE cardinality(COALESCE(_hrefs, ARRAY[]::text[])) BETWEEN 1 AND 100
$$;

REVOKE ALL ON FUNCTION public.get_infothek_gating_for_routes(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_infothek_gating_for_routes(text[])
TO anon, authenticated, service_role;

DO $$
DECLARE
  staging_table text;
BEGIN
  FOREACH staging_table IN ARRAY ARRAY[
    'kb_import_batches',
    'kb_source_candidates',
    'kb_entity_candidates',
    'kb_relation_candidates',
    'kb_dosage_candidates',
    'kb_safety_candidates',
    'kb_review_decisions',
    'kb_import_errors'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      staging_table || '_importer_read',
      staging_table
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS kb_import_batches_importer_insert ON public.kb_import_batches;
DROP POLICY IF EXISTS kb_import_batches_importer_update ON public.kb_import_batches;
DROP POLICY IF EXISTS kb_source_candidates_importer_insert ON public.kb_source_candidates;
DROP POLICY IF EXISTS kb_entity_candidates_importer_insert ON public.kb_entity_candidates;
DROP POLICY IF EXISTS kb_relation_candidates_importer_insert ON public.kb_relation_candidates;
DROP POLICY IF EXISTS kb_dosage_candidates_importer_insert ON public.kb_dosage_candidates;
DROP POLICY IF EXISTS kb_safety_candidates_importer_insert ON public.kb_safety_candidates;
DROP POLICY IF EXISTS kb_import_errors_importer_insert ON public.kb_import_errors;

REVOKE ALL ON TABLE
  public.kb_import_batches,
  public.kb_source_candidates,
  public.kb_entity_candidates,
  public.kb_relation_candidates,
  public.kb_dosage_candidates,
  public.kb_safety_candidates,
  public.kb_review_decisions,
  public.kb_import_errors
FROM kb_importer;

REVOKE kb_importer FROM kb_import_runtime;
