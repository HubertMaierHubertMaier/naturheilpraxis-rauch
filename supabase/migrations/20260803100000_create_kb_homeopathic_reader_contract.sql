BEGIN;

DO $$
DECLARE
  wiki_table_count integer;
BEGIN
  IF to_regclass('public.kb_homeopathic_repertory_revision_details') IS NULL
     OR to_regclass('public.kb_homeopathic_rubric_remedy_assignments') IS NULL
     OR to_regprocedure(
          'public.kb_homeopathic_repertory_revision_is_valid(uuid,uuid)'
        ) IS NULL
     OR to_regprocedure('public.kb_release_manifest_hash_v1(jsonb)') IS NULL
  THEN
    RAISE EXCEPTION 'Homeopathic reader contract requires the complete Step 5A contract';
  END IF;

  SELECT count(*)
    INTO wiki_table_count
    FROM jsonb_object_keys(public.kb_export_wiki_snapshot() -> 'tables');

  IF wiki_table_count <> 65 THEN
    RAISE EXCEPTION 'Homeopathic reader contract requires the exact 65-table Wiki boundary';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_releases
     WHERE retrieval_eligible OR is_active
  ) THEN
    RAISE EXCEPTION 'Homeopathic reader contract cannot activate a knowledge release';
  END IF;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_repertory_lane_status_v1(
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
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
        FROM public.kb_homeopathic_repertory_revision_details detail
        JOIN public.kb_entity_revisions repertory_revision
          ON repertory_revision.entity_id = detail.entity_id
         AND repertory_revision.id = detail.entity_revision_id
        JOIN public.kb_source_revisions source_revision
          ON source_revision.source_id = detail.source_id
         AND source_revision.id = detail.source_revision_id
       WHERE detail.entity_id = _repertory_entity_id
         AND detail.entity_revision_id = _repertory_revision_id
         AND repertory_revision.review_status IN ('approved', 'released')
         AND source_revision.review_status IN ('approved', 'released')
         AND source_revision.rights_status IN (
           'own_content', 'licensed', 'public_domain'
         )
         AND public.kb_homeopathic_repertory_revision_is_valid(
               detail.entity_id, detail.entity_revision_id
             ) IS TRUE
         AND EXISTS (
           SELECT 1
             FROM public.kb_homeopathic_rubric_remedy_assignments assignment
            WHERE assignment.repertory_entity_id = detail.entity_id
              AND assignment.repertory_revision_id = detail.entity_revision_id
         )
    ) THEN 'HOMEOPATHIC_LANE_READY'
    ELSE 'HOMEOPATHIC_LANE_UNAVAILABLE'
  END
$$;

CREATE FUNCTION public.kb_homeopathic_repertorization_request_is_valid_v1(
  _repertory_entity_id uuid,
  _repertory_revision_id uuid,
  _requested_rubrics jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  rubric_revision_id uuid;
  rubric_revision_text text;
  seen_rubric_revision_ids uuid[] := ARRAY[]::uuid[];
  has_included_rubric boolean := false;
  belongs_to_repertory boolean;
BEGIN
  IF _repertory_entity_id IS NULL
     OR _repertory_revision_id IS NULL
     OR _requested_rubrics IS NULL
     OR jsonb_typeof(_requested_rubrics) <> 'array'
  THEN
    RETURN false;
  END IF;

  IF octet_length(_requested_rubrics::text) > 131072
     OR jsonb_array_length(_requested_rubrics) NOT BETWEEN 1 AND 256
  THEN
    RETURN false;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(_requested_rubrics)
  LOOP
    IF public.kb_release_jsonb_has_exact_keys_v1(
         item,
         ARRAY['importance', 'polarity', 'rubric_revision_id']::text[]
       ) IS DISTINCT FROM true
       OR jsonb_typeof(item -> 'rubric_revision_id') <> 'string'
       OR jsonb_typeof(item -> 'importance') <> 'number'
       OR jsonb_typeof(item -> 'polarity') <> 'string'
       OR (item ->> 'importance') !~ '^[1-5]$'
       OR (item ->> 'polarity') NOT IN ('include', 'exclude')
    THEN
      RETURN false;
    END IF;

    rubric_revision_text := item ->> 'rubric_revision_id';
    BEGIN
      rubric_revision_id := rubric_revision_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN false;
    END;

    IF rubric_revision_text <> rubric_revision_id::text
       OR rubric_revision_id = ANY(seen_rubric_revision_ids)
    THEN
      RETURN false;
    END IF;
    seen_rubric_revision_ids := array_append(
      seen_rubric_revision_ids, rubric_revision_id
    );

    SELECT EXISTS (
      SELECT 1
        FROM public.kb_homeopathic_rubric_revisions rubric_revision
       WHERE rubric_revision.id = rubric_revision_id
         AND rubric_revision.repertory_entity_id = _repertory_entity_id
         AND rubric_revision.repertory_revision_id = _repertory_revision_id
         AND public.kb_homeopathic_rubric_revision_is_valid(
               rubric_revision.id
             ) IS TRUE
    ) INTO belongs_to_repertory;

    IF belongs_to_repertory IS DISTINCT FROM true THEN
      RETURN false;
    END IF;

    IF item ->> 'polarity' = 'include' THEN
      has_included_rubric := true;
    END IF;
  END LOOP;

  RETURN has_included_rubric;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_repertorization_request_manifest_v1(
  _repertory_entity_id uuid,
  _repertory_revision_id uuid,
  _requested_rubrics jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF public.kb_homeopathic_repertorization_request_is_valid_v1(
       _repertory_entity_id,
       _repertory_revision_id,
       _requested_rubrics
     ) IS DISTINCT FROM true
  THEN
    RETURN NULL;
  END IF;

  SELECT public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'repertory', jsonb_build_object(
      'repertory_entity_id', detail.entity_id,
      'repertory_revision_id', detail.entity_revision_id,
      'repertory_content_hash', repertory_revision.content_hash,
      'source_id', detail.source_id,
      'source_revision_id', detail.source_revision_id,
      'source_content_hash', source_revision.content_hash,
      'source_repertory_code', detail.source_repertory_code,
      'source_language_code', detail.source_language_code,
      'rights_status', source_revision.rights_status
    ),
    'requested_rubrics', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'rubric_revision_id', rubric_revision.id,
          'rubric_id', rubric_revision.rubric_id,
          'native_rubric_code', rubric.native_rubric_code,
          'rubric_text', rubric_revision.rubric_text,
          'rubric_domain', rubric_revision.rubric_domain,
          'rubric_content_hash', rubric_revision.rubric_content_hash,
          'source_locator', rubric_revision.source_locator,
          'importance', (request_item.value ->> 'importance')::integer,
          'polarity', request_item.value ->> 'polarity'
        )
        ORDER BY rubric_revision.id::text COLLATE "C"
      )
        FROM jsonb_array_elements(_requested_rubrics) request_item(value)
        JOIN public.kb_homeopathic_rubric_revisions rubric_revision
          ON rubric_revision.id = (
            request_item.value ->> 'rubric_revision_id'
          )::uuid
        JOIN public.kb_homeopathic_rubrics rubric
          ON rubric.repertory_entity_id = rubric_revision.repertory_entity_id
         AND rubric.id = rubric_revision.rubric_id
    )
  ))
    INTO result
    FROM public.kb_homeopathic_repertory_revision_details detail
    JOIN public.kb_entity_revisions repertory_revision
      ON repertory_revision.entity_id = detail.entity_id
     AND repertory_revision.id = detail.entity_revision_id
    JOIN public.kb_source_revisions source_revision
      ON source_revision.source_id = detail.source_id
     AND source_revision.id = detail.source_revision_id
   WHERE detail.entity_id = _repertory_entity_id
     AND detail.entity_revision_id = _repertory_revision_id;

  RETURN result;
END;
$$;

CREATE FUNCTION public.kb_homeopathic_repertorize_single_v1(
  _repertory_entity_id uuid,
  _repertory_revision_id uuid,
  _requested_rubrics jsonb,
  _limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  lane_status text;
  request_manifest jsonb;
  request_hash text;
  candidates jsonb := '[]'::jsonb;
  total_candidate_count integer := 0;
  returned_candidate_count integer := 0;
  result_status text;
  result_payload jsonb;
BEGIN
  lane_status := public.kb_homeopathic_repertory_lane_status_v1(
    _repertory_entity_id, _repertory_revision_id
  );

  IF lane_status IS DISTINCT FROM 'HOMEOPATHIC_LANE_READY' THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'status', 'HOMEOPATHIC_LANE_UNAVAILABLE',
      'interpretation', 'SOURCE_NATIVE_REPERTORY_MATCH_NOT_EFFICACY',
      'repertory_entity_id', _repertory_entity_id,
      'repertory_revision_id', _repertory_revision_id,
      'candidates', '[]'::jsonb
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 200 THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'status', 'HOMEOPATHIC_REQUEST_INVALID',
      'interpretation', 'SOURCE_NATIVE_REPERTORY_MATCH_NOT_EFFICACY',
      'repertory_entity_id', _repertory_entity_id,
      'repertory_revision_id', _repertory_revision_id,
      'candidates', '[]'::jsonb
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;

  request_manifest := public.kb_homeopathic_repertorization_request_manifest_v1(
    _repertory_entity_id, _repertory_revision_id, _requested_rubrics
  );
  IF request_manifest IS NULL THEN
    result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
      'contract_version', 1,
      'status', 'HOMEOPATHIC_REQUEST_INVALID',
      'interpretation', 'SOURCE_NATIVE_REPERTORY_MATCH_NOT_EFFICACY',
      'repertory_entity_id', _repertory_entity_id,
      'repertory_revision_id', _repertory_revision_id,
      'candidates', '[]'::jsonb
    ));
    RETURN result_payload || jsonb_build_object(
      'result_hash', public.kb_release_manifest_hash_v1(result_payload)
    );
  END IF;
  request_hash := public.kb_release_manifest_hash_v1(request_manifest);

  WITH requested AS MATERIALIZED (
    SELECT
      (item.value ->> 'rubric_revision_id')::uuid AS rubric_revision_id,
      (item.value ->> 'importance')::integer AS importance,
      item.value ->> 'polarity' AS polarity
      FROM jsonb_array_elements(_requested_rubrics) item(value)
  ),
  requested_totals AS MATERIALIZED (
    SELECT
      count(*) FILTER (WHERE polarity = 'include')::integer
        AS requested_include_count,
      COALESCE(sum(importance) FILTER (WHERE polarity = 'include'), 0)::integer
        AS requested_importance_total,
      count(DISTINCT rubric_revision.rubric_domain)
        FILTER (WHERE requested.polarity = 'include')::integer
        AS requested_domain_count
      FROM requested
      JOIN public.kb_homeopathic_rubric_revisions rubric_revision
        ON rubric_revision.id = requested.rubric_revision_id
  ),
  matches AS MATERIALIZED (
    SELECT
      remedy.id AS repertory_remedy_id,
      remedy.remedy_entity_id,
      remedy.remedy_revision_id,
      remedy.source_remedy_code,
      remedy.source_remedy_name,
      remedy.source_remedy_aliases,
      remedy.source_locator AS remedy_source_locator,
      remedy.remedy_content_hash,
      assignment.id AS assignment_id,
      assignment.assignment_content_hash,
      assignment.source_locator AS assignment_source_locator,
      rubric_revision.id AS rubric_revision_id,
      rubric_revision.rubric_id,
      rubric.native_rubric_code,
      rubric_revision.rubric_text,
      rubric_revision.rubric_domain,
      rubric_revision.rubric_content_hash,
      rubric_revision.source_locator AS rubric_source_locator,
      grade.id AS grade_definition_id,
      grade.source_grade_code,
      grade.source_grade_label,
      grade.grade_order,
      grade.grade_content_hash,
      grade.source_locator AS grade_source_locator,
      requested.importance,
      requested.polarity
      FROM requested
      JOIN public.kb_homeopathic_rubric_remedy_assignments assignment
        ON assignment.repertory_entity_id = _repertory_entity_id
       AND assignment.repertory_revision_id = _repertory_revision_id
       AND assignment.rubric_revision_id = requested.rubric_revision_id
      JOIN public.kb_homeopathic_repertory_remedies remedy
        ON remedy.repertory_entity_id = assignment.repertory_entity_id
       AND remedy.repertory_revision_id = assignment.repertory_revision_id
       AND remedy.id = assignment.repertory_remedy_id
      JOIN public.kb_homeopathic_rubric_revisions rubric_revision
        ON rubric_revision.repertory_entity_id = assignment.repertory_entity_id
       AND rubric_revision.repertory_revision_id = assignment.repertory_revision_id
       AND rubric_revision.id = assignment.rubric_revision_id
      JOIN public.kb_homeopathic_rubrics rubric
        ON rubric.repertory_entity_id = rubric_revision.repertory_entity_id
       AND rubric.id = rubric_revision.rubric_id
      JOIN public.kb_homeopathic_grade_definitions grade
        ON grade.repertory_entity_id = assignment.repertory_entity_id
       AND grade.repertory_revision_id = assignment.repertory_revision_id
       AND grade.id = assignment.grade_definition_id
  ),
  candidate_stats AS MATERIALIZED (
    SELECT
      match.repertory_remedy_id,
      match.remedy_entity_id,
      match.remedy_revision_id,
      match.source_remedy_code,
      match.source_remedy_name,
      match.source_remedy_aliases,
      match.remedy_source_locator,
      match.remedy_content_hash,
      count(*) FILTER (WHERE match.polarity = 'include')::integer
        AS matched_include_count,
      COALESCE(sum(match.importance) FILTER (
        WHERE match.polarity = 'include'
      ), 0)::integer AS included_importance_covered,
      count(DISTINCT match.rubric_domain) FILTER (
        WHERE match.polarity = 'include'
      )::integer AS included_domain_count,
      count(*) FILTER (WHERE match.polarity = 'exclude')::integer
        AS excluded_conflict_count,
      jsonb_agg(
        jsonb_build_object(
          'rubric_revision_id', match.rubric_revision_id,
          'rubric_id', match.rubric_id,
          'native_rubric_code', match.native_rubric_code,
          'rubric_text', match.rubric_text,
          'rubric_domain', match.rubric_domain,
          'rubric_content_hash', match.rubric_content_hash,
          'rubric_source_locator', match.rubric_source_locator,
          'importance', match.importance,
          'polarity', match.polarity,
          'assignment_id', match.assignment_id,
          'assignment_content_hash', match.assignment_content_hash,
          'assignment_source_locator', match.assignment_source_locator,
          'grade_definition_id', match.grade_definition_id,
          'source_grade_code', match.source_grade_code,
          'source_grade_label', match.source_grade_label,
          'grade_order', match.grade_order,
          'grade_content_hash', match.grade_content_hash,
          'grade_source_locator', match.grade_source_locator
        )
        ORDER BY
          CASE match.polarity WHEN 'include' THEN 0 ELSE 1 END,
          match.importance DESC,
          match.native_rubric_code COLLATE "C",
          match.assignment_id::text COLLATE "C"
      ) AS source_native_matches
      FROM matches match
     GROUP BY
       match.repertory_remedy_id,
       match.remedy_entity_id,
       match.remedy_revision_id,
       match.source_remedy_code,
       match.source_remedy_name,
       match.source_remedy_aliases,
       match.remedy_source_locator,
       match.remedy_content_hash
    HAVING count(*) FILTER (WHERE match.polarity = 'include') > 0
  ),
  source_grade_profiles AS MATERIALIZED (
    SELECT grouped.repertory_remedy_id,
           jsonb_agg(
             jsonb_build_object(
               'source_grade_code', grouped.source_grade_code,
               'source_grade_label', grouped.source_grade_label,
               'grade_order', grouped.grade_order,
               'matched_rubric_count', grouped.matched_rubric_count
             )
             ORDER BY grouped.grade_order,
                      grouped.source_grade_code COLLATE "C"
           ) AS source_grade_profile
      FROM (
        SELECT match.repertory_remedy_id,
               match.source_grade_code,
               match.source_grade_label,
               match.grade_order,
               count(*)::integer AS matched_rubric_count
          FROM matches match
         WHERE match.polarity = 'include'
         GROUP BY match.repertory_remedy_id,
                  match.source_grade_code,
                  match.source_grade_label,
                  match.grade_order
      ) grouped
     GROUP BY grouped.repertory_remedy_id
  ),
  ordered_candidates AS MATERIALIZED (
    SELECT
      row_number() OVER (
        ORDER BY
          stats.excluded_conflict_count ASC,
          stats.included_importance_covered DESC,
          stats.matched_include_count DESC,
          stats.included_domain_count DESC,
          public.kb_homeopathic_source_term_key_v1(
            stats.source_remedy_code
          ) COLLATE "C",
          stats.repertory_remedy_id::text COLLATE "C"
      )::integer AS position,
      stats.*,
      profile.source_grade_profile,
      totals.requested_include_count,
      totals.requested_importance_total,
      totals.requested_domain_count
      FROM candidate_stats stats
      JOIN source_grade_profiles profile
        ON profile.repertory_remedy_id = stats.repertory_remedy_id
      CROSS JOIN requested_totals totals
  ),
  limited_candidates AS MATERIALIZED (
    SELECT *
      FROM ordered_candidates
     WHERE position <= _limit
     ORDER BY position
  )
  SELECT
    (SELECT count(*)::integer FROM ordered_candidates),
    (SELECT count(*)::integer FROM limited_candidates),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'position', candidate.position,
          'candidate_status', 'REPERTORY_MATCH_ONLY',
          'repertory_remedy_id', candidate.repertory_remedy_id,
          'remedy_entity_id', candidate.remedy_entity_id,
          'remedy_revision_id', candidate.remedy_revision_id,
          'source_remedy_code', candidate.source_remedy_code,
          'source_remedy_name', candidate.source_remedy_name,
          'source_remedy_aliases', to_jsonb(candidate.source_remedy_aliases),
          'source_locator', candidate.remedy_source_locator,
          'remedy_content_hash', candidate.remedy_content_hash,
          'rubric_coverage', jsonb_build_object(
            'matched', candidate.matched_include_count,
            'requested', candidate.requested_include_count,
            'importance_covered', candidate.included_importance_covered,
            'importance_total', candidate.requested_importance_total
          ),
          'domain_coverage', jsonb_build_object(
            'matched', candidate.included_domain_count,
            'requested', candidate.requested_domain_count
          ),
          'excluded_rubric_conflicts', candidate.excluded_conflict_count,
          'source_grade_profile', candidate.source_grade_profile,
          'source_native_matches', candidate.source_native_matches
        )
        ORDER BY candidate.position
      )
        FROM limited_candidates candidate
    ), '[]'::jsonb)
    INTO total_candidate_count, returned_candidate_count, candidates;

  result_status := CASE
    WHEN total_candidate_count = 0 THEN 'HOMEOPATHIC_NO_REPERTORY_MATCHES'
    ELSE 'HOMEOPATHIC_REPERTORY_MATCHES_READY'
  END;
  result_payload := public.kb_release_canonical_jsonb_v1(jsonb_build_object(
    'contract_version', 1,
    'status', result_status,
    'interpretation', 'SOURCE_NATIVE_REPERTORY_MATCH_NOT_EFFICACY',
    'request_manifest', request_manifest,
    'request_hash', request_hash,
    'ordering_dimensions', jsonb_build_array(
      'excluded_rubric_conflicts_asc',
      'included_importance_covered_desc',
      'matched_include_rubrics_desc',
      'included_domains_desc',
      'normalized_source_remedy_code_asc',
      'repertory_remedy_id_asc'
    ),
    'candidate_count_before_limit', total_candidate_count,
    'returned_candidate_count', returned_candidate_count,
    'limit', _limit,
    'candidates', candidates
  ));
  RETURN result_payload || jsonb_build_object(
    'result_hash', public.kb_release_manifest_hash_v1(result_payload)
  );
END;
$$;

COMMENT ON FUNCTION public.kb_homeopathic_repertory_lane_status_v1(uuid, uuid) IS
  'Step 5B-1 owner-only readiness check. No licensed repertory content is bundled by this migration.';
COMMENT ON FUNCTION public.kb_homeopathic_repertorize_single_v1(uuid, uuid, jsonb, integer) IS
  'Step 5B-1 deterministic single-repertory projection. Results are source-native repertory matches, not efficacy or treatment recommendations.';

REVOKE ALL ON FUNCTION
  public.kb_homeopathic_repertory_lane_status_v1(uuid, uuid),
  public.kb_homeopathic_repertorization_request_is_valid_v1(uuid, uuid, jsonb),
  public.kb_homeopathic_repertorization_request_manifest_v1(uuid, uuid, jsonb),
  public.kb_homeopathic_repertorize_single_v1(uuid, uuid, jsonb, integer)
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

COMMIT;
