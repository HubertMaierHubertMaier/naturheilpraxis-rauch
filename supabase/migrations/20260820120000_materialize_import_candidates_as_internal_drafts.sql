BEGIN;

CREATE TABLE public.kb_import_core_links (
  candidate_kind text NOT NULL
    CHECK (candidate_kind IN ('source', 'entity', 'relation', 'dosage', 'safety')),
  candidate_id uuid NOT NULL,
  batch_id uuid NOT NULL
    REFERENCES public.kb_import_batches(id) ON DELETE RESTRICT,
  core_record_kind text NOT NULL
    CHECK (core_record_kind IN ('source', 'entity', 'assertion', 'article')),
  core_source_id uuid REFERENCES public.kb_sources(id) ON DELETE RESTRICT,
  core_source_revision_id uuid REFERENCES public.kb_source_revisions(id) ON DELETE RESTRICT,
  core_entity_id uuid REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  core_entity_revision_id uuid REFERENCES public.kb_entity_revisions(id) ON DELETE RESTRICT,
  core_assertion_id uuid REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  core_article_id uuid REFERENCES public.kb_articles(id) ON DELETE RESTRICT,
  core_article_revision_id uuid REFERENCES public.kb_article_revisions(id) ON DELETE RESTRICT,
  materialization_status text NOT NULL DEFAULT 'internal_draft'
    CHECK (materialization_status = 'internal_draft'),
  visibility text NOT NULL DEFAULT 'admin_only'
    CHECK (visibility = 'admin_only'),
  patient_facing_allowed boolean NOT NULL DEFAULT false
    CHECK (NOT patient_facing_allowed),
  evidence_status text NOT NULL DEFAULT 'unreviewed'
    CHECK (evidence_status = 'unreviewed'),
  safety_status text NOT NULL DEFAULT 'unreviewed'
    CHECK (safety_status = 'unreviewed'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  materialized_at timestamptz NOT NULL DEFAULT now(),
  materialized_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (candidate_kind, candidate_id),
  CHECK (
    (candidate_kind = 'source' AND core_record_kind = 'source')
    OR (candidate_kind = 'entity' AND core_record_kind IN ('entity', 'article'))
    OR (candidate_kind IN ('relation', 'dosage', 'safety') AND core_record_kind = 'assertion')
  ),
  CHECK (
    (
      core_record_kind = 'source'
      AND core_source_id IS NOT NULL
      AND core_source_revision_id IS NOT NULL
      AND core_entity_id IS NULL
      AND core_entity_revision_id IS NULL
      AND core_assertion_id IS NULL
      AND core_article_id IS NULL
      AND core_article_revision_id IS NULL
    ) OR (
      core_record_kind = 'entity'
      AND core_source_id IS NULL
      AND core_source_revision_id IS NULL
      AND core_entity_id IS NOT NULL
      AND core_entity_revision_id IS NOT NULL
      AND core_assertion_id IS NULL
      AND core_article_id IS NULL
      AND core_article_revision_id IS NULL
    ) OR (
      core_record_kind = 'assertion'
      AND core_source_id IS NULL
      AND core_source_revision_id IS NULL
      AND core_entity_id IS NULL
      AND core_entity_revision_id IS NULL
      AND core_assertion_id IS NOT NULL
      AND core_article_id IS NULL
      AND core_article_revision_id IS NULL
    ) OR (
      core_record_kind = 'article'
      AND core_source_id IS NULL
      AND core_source_revision_id IS NULL
      AND core_entity_id IS NULL
      AND core_entity_revision_id IS NULL
      AND core_assertion_id IS NULL
      AND core_article_id IS NOT NULL
      AND core_article_revision_id IS NOT NULL
    )
  )
);

CREATE INDEX kb_import_core_links_batch_idx
  ON public.kb_import_core_links(batch_id, candidate_kind);
CREATE INDEX kb_import_core_links_source_idx
  ON public.kb_import_core_links(core_source_id)
  WHERE core_source_id IS NOT NULL;
CREATE INDEX kb_import_core_links_entity_idx
  ON public.kb_import_core_links(core_entity_id)
  WHERE core_entity_id IS NOT NULL;
CREATE INDEX kb_import_core_links_assertion_idx
  ON public.kb_import_core_links(core_assertion_id)
  WHERE core_assertion_id IS NOT NULL;
CREATE INDEX kb_import_core_links_article_idx
  ON public.kb_import_core_links(core_article_id)
  WHERE core_article_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.kb_protect_import_core_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Import-to-core links are append-only';
END;
$$;

CREATE TRIGGER kb_import_core_links_append_only
  BEFORE UPDATE OR DELETE ON public.kb_import_core_links
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_import_core_link();

CREATE OR REPLACE FUNCTION public._kb_materialize_import_candidates_as_internal_drafts(
  _batch_id uuid DEFAULT NULL,
  _actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  candidate record;
  core_id uuid;
  revision_id uuid;
  source_revision_id uuid;
  expected_key text;
  next_revision integer;
  was_new boolean;
  materialized_now integer := 0;
  total_linked integer;
BEGIN
  IF _batch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.kb_import_batches
     WHERE id = _batch_id
       AND data_classification = 'general_knowledge'
  ) THEN
    RAISE EXCEPTION 'General-knowledge import batch not found';
  END IF;

  FOR candidate IN
    SELECT source.*, batch.source_label, batch.metadata AS batch_metadata
      FROM public.kb_source_candidates source
      JOIN public.kb_import_batches batch ON batch.id = source.batch_id
     WHERE (_batch_id IS NULL OR source.batch_id = _batch_id)
       AND source.data_classification = 'general_knowledge'
     ORDER BY source.batch_id, source.id
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.kb_import_core_links
       WHERE candidate_kind = 'source' AND candidate_id = candidate.id
    );

    expected_key := 'import_source:' || replace(candidate.id::text, '-', '');
    core_id := candidate.target_source_id;
    was_new := false;

    IF core_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kb_sources WHERE id = core_id) THEN
      RAISE EXCEPTION 'Target source % for candidate % does not exist', core_id, candidate.id;
    END IF;

    IF core_id IS NULL THEN
      SELECT id INTO core_id FROM public.kb_sources WHERE canonical_key = expected_key;
    END IF;

    IF core_id IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.kb_sources WHERE id = candidate.id) THEN
        RAISE EXCEPTION 'Source UUID collision for import candidate %', candidate.id;
      END IF;
      core_id := candidate.id;
      was_new := true;
      INSERT INTO public.kb_sources (
        id, canonical_key, lifecycle_status, metadata, created_by
      ) VALUES (
        core_id,
        expected_key,
        'active',
        jsonb_build_object(
          'admin_only', true,
          'patient_facing_allowed', false,
          'internal_draft', true,
          'review_status', 'unreviewed',
          'import_candidate_kind', 'source',
          'import_candidate_id', candidate.id,
          'import_candidate_key', candidate.candidate_key
        ),
        _actor_id
      );
    END IF;

    revision_id := candidate.id;
    IF EXISTS (
      SELECT 1 FROM public.kb_source_revisions
       WHERE id = revision_id AND source_id <> core_id
    ) THEN
      RAISE EXCEPTION 'Source revision UUID collision for import candidate %', candidate.id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.kb_source_revisions WHERE id = revision_id) THEN
      SELECT COALESCE(max(revision_no), 0) + 1
        INTO next_revision
        FROM public.kb_source_revisions
       WHERE source_id = core_id;

      INSERT INTO public.kb_source_revisions (
        id,
        source_id,
        revision_no,
        source_type,
        title,
        publisher,
        published_on,
        url,
        rights_status,
        archive_location,
        review_status,
        content_hash,
        metadata,
        created_by
      ) VALUES (
        revision_id,
        core_id,
        next_revision,
        CASE candidate.proposed_source_type
          WHEN 'guideline' THEN 'guideline'
          WHEN 'systematic_review' THEN 'systematic_review'
          WHEN 'study' THEN 'clinical_study'
          WHEN 'reference_work' THEN 'book'
          WHEN 'manufacturer' THEN 'manufacturer_document'
          WHEN 'regulatory' THEN 'guideline'
          WHEN 'website' THEN 'website'
          WHEN 'practice_document' THEN 'practice_rule'
          ELSE 'other'
        END,
        candidate.title,
        NULLIF(candidate.publisher, ''),
        candidate.publication_date,
        NULLIF(candidate.source_url, ''),
        candidate.rights_status,
        NULLIF(candidate.source_locator, ''),
        'draft',
        encode(sha256(convert_to(to_jsonb(candidate)::text, 'UTF8')), 'hex'),
        jsonb_build_object(
          'admin_only', true,
          'patient_facing_allowed', false,
          'internal_draft', true,
          'review_status', 'unreviewed',
          'evidence_status', 'unreviewed',
          'safety_status', 'unreviewed',
          'original_statement', candidate.original_excerpt,
          'candidate_snapshot', to_jsonb(candidate),
          'source_claim_and_evaluation_separated', true
        ),
        _actor_id
      );
    END IF;

    IF was_new OR (SELECT current_revision_id IS NULL FROM public.kb_sources WHERE id = core_id) THEN
      UPDATE public.kb_sources
         SET current_revision_id = revision_id
       WHERE id = core_id AND current_revision_id IS NULL;
    END IF;

    INSERT INTO public.kb_import_core_links (
      candidate_kind,
      candidate_id,
      batch_id,
      core_record_kind,
      core_source_id,
      core_source_revision_id,
      materialized_by,
      metadata
    ) VALUES (
      'source',
      candidate.id,
      candidate.batch_id,
      'source',
      core_id,
      revision_id,
      _actor_id,
      jsonb_build_object(
        'candidate_status_at_materialization', candidate.candidate_status,
        'source_label', candidate.source_label,
        'semantic_review_still_required', true
      )
    );
    materialized_now := materialized_now + 1;
  END LOOP;

  FOR candidate IN
    SELECT entity.*, batch.source_label, batch.metadata AS batch_metadata
      FROM public.kb_entity_candidates entity
      JOIN public.kb_import_batches batch ON batch.id = entity.batch_id
     WHERE (_batch_id IS NULL OR entity.batch_id = _batch_id)
       AND entity.data_classification = 'general_knowledge'
       AND (
         entity.target_entity_id IS NOT NULL
         OR (
           entity.proposed_entity_type_code IS NOT NULL
           AND entity.proposed_canonical_key IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM public.kb_entity_types
              WHERE code = entity.proposed_entity_type_code
           )
         )
       )
     ORDER BY entity.batch_id, entity.id
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.kb_import_core_links
       WHERE candidate_kind = 'entity' AND candidate_id = candidate.id
    );

    core_id := candidate.target_entity_id;
    was_new := false;
    IF core_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kb_entities WHERE id = core_id) THEN
      RAISE EXCEPTION 'Target entity % for candidate % does not exist', core_id, candidate.id;
    END IF;

    IF core_id IS NULL THEN
      SELECT id INTO core_id
        FROM public.kb_entities
       WHERE canonical_key = candidate.proposed_canonical_key;
    END IF;

    IF core_id IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.kb_entities WHERE id = candidate.id) THEN
        RAISE EXCEPTION 'Entity UUID collision for import candidate %', candidate.id;
      END IF;
      core_id := candidate.id;
      was_new := true;
      INSERT INTO public.kb_entities (
        id,
        entity_type_code,
        canonical_key,
        lifecycle_status,
        metadata,
        created_by
      ) VALUES (
        core_id,
        candidate.proposed_entity_type_code,
        candidate.proposed_canonical_key,
        'active',
        jsonb_build_object(
          'admin_only', true,
          'patient_facing_allowed', false,
          'internal_draft', true,
          'review_status', 'unreviewed',
          'import_candidate_kind', 'entity',
          'import_candidate_id', candidate.id,
          'import_candidate_key', candidate.candidate_key
        ),
        _actor_id
      );
    END IF;

    revision_id := candidate.id;
    IF EXISTS (
      SELECT 1 FROM public.kb_entity_revisions
       WHERE id = revision_id AND entity_id <> core_id
    ) THEN
      RAISE EXCEPTION 'Entity revision UUID collision for import candidate %', candidate.id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.kb_entity_revisions WHERE id = revision_id) THEN
      SELECT COALESCE(max(revision_no), 0) + 1
        INTO next_revision
        FROM public.kb_entity_revisions
       WHERE entity_id = core_id;

      INSERT INTO public.kb_entity_revisions (
        id,
        entity_id,
        revision_no,
        display_name,
        summary,
        description_markdown,
        review_status,
        origin_type,
        content_hash,
        metadata,
        created_by
      ) VALUES (
        revision_id,
        core_id,
        next_revision,
        candidate.display_name,
        candidate.ambiguity_notes,
        candidate.description_markdown,
        'draft',
        'import',
        encode(sha256(convert_to(to_jsonb(candidate)::text, 'UTF8')), 'hex'),
        jsonb_build_object(
          'admin_only', true,
          'patient_facing_allowed', false,
          'internal_draft', true,
          'review_status', 'unreviewed',
          'evidence_status', 'unreviewed',
          'safety_status', 'unreviewed',
          'original_statement', candidate.original_excerpt,
          'candidate_snapshot', to_jsonb(candidate),
          'source_candidate_id', candidate.source_candidate_id
        ),
        _actor_id
      );
    END IF;

    IF was_new THEN
      INSERT INTO public.kb_entity_names (
        entity_id,
        name,
        normalized_name,
        name_kind,
        language_code,
        is_preferred,
        created_by
      ) VALUES (
        core_id,
        candidate.display_name,
        lower(btrim(candidate.display_name)),
        'preferred',
        'de',
        true,
        _actor_id
      ) ON CONFLICT DO NOTHING;
    END IF;

    IF was_new OR (SELECT current_revision_id IS NULL FROM public.kb_entities WHERE id = core_id) THEN
      UPDATE public.kb_entities
         SET current_revision_id = revision_id
       WHERE id = core_id AND current_revision_id IS NULL;
    END IF;

    INSERT INTO public.kb_import_core_links (
      candidate_kind,
      candidate_id,
      batch_id,
      core_record_kind,
      core_entity_id,
      core_entity_revision_id,
      materialized_by,
      metadata
    ) VALUES (
      'entity',
      candidate.id,
      candidate.batch_id,
      'entity',
      core_id,
      revision_id,
      _actor_id,
      jsonb_build_object(
        'candidate_status_at_materialization', candidate.candidate_status,
        'source_label', candidate.source_label,
        'semantic_review_still_required', true
      )
    );
    materialized_now := materialized_now + 1;
  END LOOP;

  FOR candidate IN
    SELECT entity.*, batch.source_label, batch.metadata AS batch_metadata
      FROM public.kb_entity_candidates entity
      JOIN public.kb_import_batches batch ON batch.id = entity.batch_id
     WHERE (_batch_id IS NULL OR entity.batch_id = _batch_id)
       AND entity.data_classification = 'general_knowledge'
       AND entity.target_entity_id IS NULL
       AND (
         entity.proposed_entity_type_code IS NULL
         OR entity.proposed_canonical_key IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM public.kb_entity_types
            WHERE code = entity.proposed_entity_type_code
         )
       )
     ORDER BY entity.batch_id, entity.id
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.kb_import_core_links
       WHERE candidate_kind = 'entity' AND candidate_id = candidate.id
    );

    expected_key := 'import_unresolved_entity:' || replace(candidate.id::text, '-', '');
    core_id := candidate.id;
    revision_id := candidate.id;

    IF EXISTS (
      SELECT 1 FROM public.kb_articles
       WHERE id = core_id AND canonical_key <> expected_key
    ) THEN
      RAISE EXCEPTION 'Article UUID collision for unresolved entity candidate %', candidate.id;
    END IF;

    INSERT INTO public.kb_articles (
      id,
      canonical_key,
      article_kind,
      lifecycle_status,
      metadata,
      created_by
    ) VALUES (
      core_id,
      expected_key,
      'reference',
      'active',
      jsonb_build_object(
        'admin_only', true,
        'patient_facing_allowed', false,
        'internal_draft', true,
        'review_status', 'unreviewed',
        'structure_status', 'pending',
        'import_candidate_kind', 'entity',
        'import_candidate_id', candidate.id,
        'import_candidate_key', candidate.candidate_key
      ),
      _actor_id
    ) ON CONFLICT (id) DO NOTHING;

    IF EXISTS (
      SELECT 1 FROM public.kb_article_revisions
       WHERE id = revision_id AND article_id <> core_id
    ) THEN
      RAISE EXCEPTION 'Article revision UUID collision for unresolved entity candidate %', candidate.id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.kb_article_revisions WHERE id = revision_id) THEN
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
        created_by
      ) VALUES (
        revision_id,
        core_id,
        1,
        candidate.display_name,
        'Interne Quellen > Importpruefung > ' || candidate.source_label,
        ARRAY['import', 'unreviewed', 'structure_pending', 'entity'],
        '## Interner ungepruefter Quellenstand' || E'\n\n'
          || 'Dieser Inhalt ist quellengetreu intern aufgenommen, aber noch nicht fachlich klassifiziert.' || E'\n\n'
          || '## Beschreibung' || E'\n\n'
          || COALESCE(NULLIF(candidate.description_markdown, ''), 'Noch keine strukturierte Beschreibung vorhanden.') || E'\n\n'
          || '## Originalaussage' || E'\n\n'
          || COALESCE(NULLIF(candidate.original_excerpt, ''), 'Originalaussage ist im strukturierten Kandidatendatensatz erhalten.') || E'\n\n'
          || '## Offene Strukturierung' || E'\n\n'
          || COALESCE(NULLIF(candidate.ambiguity_notes, ''), 'Entitaetstyp und kanonischer Schluessel muessen noch fachlich zugeordnet werden.'),
        'draft',
        'import',
        encode(sha256(convert_to(to_jsonb(candidate)::text, 'UTF8')), 'hex'),
        jsonb_build_object(
          'admin_only', true,
          'patient_facing_allowed', false,
          'internal_draft', true,
          'review_status', 'unreviewed',
          'evidence_level', 'unrated',
          'dosage_status', 'unverified',
          'structure_status', 'pending',
          'original_statement', candidate.original_excerpt,
          'candidate_snapshot', to_jsonb(candidate),
          'source_candidate_id', candidate.source_candidate_id
        ),
        _actor_id
      );
    END IF;

    UPDATE public.kb_articles
       SET current_revision_id = revision_id
     WHERE id = core_id AND current_revision_id IS NULL;

    INSERT INTO public.kb_import_core_links (
      candidate_kind,
      candidate_id,
      batch_id,
      core_record_kind,
      core_article_id,
      core_article_revision_id,
      materialized_by,
      metadata
    ) VALUES (
      'entity',
      candidate.id,
      candidate.batch_id,
      'article',
      core_id,
      revision_id,
      _actor_id,
      jsonb_build_object(
        'candidate_status_at_materialization', candidate.candidate_status,
        'source_label', candidate.source_label,
        'structure_status', 'pending',
        'semantic_review_still_required', true
      )
    );
    materialized_now := materialized_now + 1;
  END LOOP;

  FOR candidate IN
    SELECT
      'relation'::text AS candidate_kind,
      relation.id,
      relation.batch_id,
      relation.candidate_key,
      relation.candidate_status,
      'entity_relation'::text AS assertion_kind,
      COALESCE(
        NULLIF(relation.original_excerpt, ''),
        'Ungepruefte importierte Beziehung: ' || COALESCE(relation.proposed_relation_type_code, 'Typ offen')
      ) AS claim_text,
      relation.source_candidate_id,
      relation.source_locator,
      relation.original_excerpt,
      relation.confidence,
      relation.ambiguity_notes,
      relation.proposed_data,
      to_jsonb(relation) AS candidate_snapshot,
      batch.source_label
    FROM public.kb_relation_candidates relation
    JOIN public.kb_import_batches batch ON batch.id = relation.batch_id
    WHERE (_batch_id IS NULL OR relation.batch_id = _batch_id)
      AND relation.data_classification = 'general_knowledge'
    UNION ALL
    SELECT
      'dosage'::text,
      dosage.id,
      dosage.batch_id,
      dosage.candidate_key,
      dosage.candidate_status,
      'dosage'::text,
      COALESCE(NULLIF(dosage.application_text, ''), NULLIF(dosage.original_excerpt, ''), 'Ungepruefte importierte Dosierungsangabe'),
      dosage.source_candidate_id,
      dosage.source_locator,
      dosage.original_excerpt,
      dosage.confidence,
      dosage.ambiguity_notes,
      dosage.proposed_data,
      to_jsonb(dosage),
      batch.source_label
    FROM public.kb_dosage_candidates dosage
    JOIN public.kb_import_batches batch ON batch.id = dosage.batch_id
    WHERE (_batch_id IS NULL OR dosage.batch_id = _batch_id)
      AND dosage.data_classification = 'general_knowledge'
    UNION ALL
    SELECT
      'safety'::text,
      safety.id,
      safety.batch_id,
      safety.candidate_key,
      safety.candidate_status,
      'safety'::text,
      safety.action_text,
      safety.source_candidate_id,
      safety.source_locator,
      safety.original_excerpt,
      safety.confidence,
      safety.ambiguity_notes,
      safety.proposed_data,
      to_jsonb(safety),
      batch.source_label
    FROM public.kb_safety_candidates safety
    JOIN public.kb_import_batches batch ON batch.id = safety.batch_id
    WHERE (_batch_id IS NULL OR safety.batch_id = _batch_id)
      AND safety.data_classification = 'general_knowledge'
    ORDER BY batch_id, candidate_kind, id
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.kb_import_core_links
       WHERE candidate_kind = candidate.candidate_kind
         AND candidate_id = candidate.id
    );

    SELECT core_source_revision_id
      INTO source_revision_id
      FROM public.kb_import_core_links
     WHERE candidate_kind = 'source'
       AND candidate_id = candidate.source_candidate_id;
    IF source_revision_id IS NULL THEN
      RAISE EXCEPTION 'Core source revision missing for % candidate %', candidate.candidate_kind, candidate.id;
    END IF;

    expected_key := 'import_assertion:' || candidate.candidate_kind || ':' || replace(candidate.id::text, '-', '');
    core_id := candidate.id;
    IF EXISTS (
      SELECT 1 FROM public.kb_assertions
       WHERE id = core_id AND canonical_key <> expected_key
    ) THEN
      RAISE EXCEPTION 'Assertion UUID collision for import candidate %', candidate.id;
    END IF;

    INSERT INTO public.kb_assertions (
      id,
      canonical_key,
      version_no,
      assertion_kind,
      claim_text,
      review_status,
      origin_type,
      evidence_basis,
      evidence_quality,
      content_hash,
      metadata,
      created_by
    ) VALUES (
      core_id,
      expected_key,
      1,
      candidate.assertion_kind,
      candidate.claim_text,
      'draft',
      'import',
      'unrated',
      'unrated',
      encode(sha256(convert_to(candidate.candidate_snapshot::text, 'UTF8')), 'hex'),
      jsonb_build_object(
        'admin_only', true,
        'patient_facing_allowed', false,
        'internal_draft', true,
        'review_status', 'unreviewed',
        'evidence_status', 'unreviewed',
        'safety_status', 'unreviewed',
        'candidate_kind', candidate.candidate_kind,
        'candidate_id', candidate.id,
        'candidate_key', candidate.candidate_key,
        'candidate_status', candidate.candidate_status,
        'candidate_snapshot', candidate.candidate_snapshot,
        'source_candidate_id', candidate.source_candidate_id,
        'source_label', candidate.source_label,
        'confidence', candidate.confidence,
        'ambiguity_notes', candidate.ambiguity_notes,
        'proposed_data', candidate.proposed_data
      ),
      _actor_id
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.kb_assertion_sources (
      assertion_id,
      source_revision_id,
      source_role,
      locator,
      original_quote,
      is_primary,
      created_by
    ) VALUES (
      core_id,
      source_revision_id,
      'mentions',
      candidate.source_locator,
      candidate.original_excerpt,
      true,
      _actor_id
    ) ON CONFLICT DO NOTHING;

    INSERT INTO public.kb_import_core_links (
      candidate_kind,
      candidate_id,
      batch_id,
      core_record_kind,
      core_assertion_id,
      materialized_by,
      metadata
    ) VALUES (
      candidate.candidate_kind,
      candidate.id,
      candidate.batch_id,
      'assertion',
      core_id,
      _actor_id,
      jsonb_build_object(
        'candidate_status_at_materialization', candidate.candidate_status,
        'source_label', candidate.source_label,
        'source_revision_id', source_revision_id,
        'semantic_review_still_required', true
      )
    );
    materialized_now := materialized_now + 1;
  END LOOP;

  SELECT count(*)::int
    INTO total_linked
    FROM public.kb_import_core_links
   WHERE _batch_id IS NULL OR batch_id = _batch_id;

  RETURN jsonb_build_object(
    'materialized_now', materialized_now,
    'total_core_links', total_linked,
    'visibility', 'admin_only',
    'patient_facing_allowed', false,
    'semantic_review_still_required', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_materialize_import_candidates_as_internal_drafts(
  _batch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reviewer_id uuid := auth.uid();
  result jsonb;
BEGIN
  IF reviewer_id IS NULL OR NOT public.has_role(reviewer_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators may materialize import candidates as internal drafts';
  END IF;

  SELECT public._kb_materialize_import_candidates_as_internal_drafts(_batch_id, reviewer_id)
    INTO result;
  RETURN result;
END;
$$;

SELECT public._kb_materialize_import_candidates_as_internal_drafts(NULL, NULL);

DO $$
DECLARE
  candidate_count integer;
  linked_count integer;
BEGIN
  SELECT count(*)::int
    INTO candidate_count
    FROM (
      SELECT id FROM public.kb_source_candidates
      UNION ALL SELECT id FROM public.kb_entity_candidates
      UNION ALL SELECT id FROM public.kb_relation_candidates
      UNION ALL SELECT id FROM public.kb_dosage_candidates
      UNION ALL SELECT id FROM public.kb_safety_candidates
    ) candidates;
  SELECT count(*)::int INTO linked_count FROM public.kb_import_core_links;
  IF linked_count <> candidate_count THEN
    RAISE EXCEPTION 'Internal core materialization incomplete: % of % candidates linked', linked_count, candidate_count;
  END IF;
END;
$$;

ALTER TABLE public.kb_import_core_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_import_core_links_admin_read
  ON public.kb_import_core_links
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE public.kb_import_core_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.kb_import_core_links TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.kb_import_core_links TO service_role;

REVOKE ALL ON FUNCTION public.kb_protect_import_core_link()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._kb_materialize_import_candidates_as_internal_drafts(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_materialize_import_candidates_as_internal_drafts(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_materialize_import_candidates_as_internal_drafts(uuid)
  TO authenticated;

COMMIT;
