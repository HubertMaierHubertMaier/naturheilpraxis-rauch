BEGIN;

CREATE TABLE public.kb_source_candidate_draft_promotions (
  source_candidate_id uuid PRIMARY KEY,
  batch_id uuid NOT NULL,
  review_decision_id uuid NOT NULL UNIQUE
    REFERENCES public.kb_review_decisions(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL UNIQUE,
  source_revision_id uuid NOT NULL UNIQUE,
  selected_canonical_key text NOT NULL
    CHECK (selected_canonical_key ~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'),
  selected_source_type text NOT NULL
    CHECK (selected_source_type IN (
      'manufacturer_document',
      'traditional_reference',
      'practice_rule',
      'book',
      'journal_article',
      'clinical_study',
      'systematic_review',
      'guideline',
      'website',
      'database',
      'other'
    )),
  initial_content_hash text NOT NULL
    CHECK (initial_content_hash ~ '^[0-9a-f]{64}$'),
  conversion_version integer NOT NULL DEFAULT 1 CHECK (conversion_version = 1),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  promoted_at timestamptz NOT NULL DEFAULT now(),
  promoted_by uuid NOT NULL,
  FOREIGN KEY (batch_id, source_candidate_id)
    REFERENCES public.kb_source_candidates(batch_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (source_id, source_revision_id)
    REFERENCES public.kb_source_revisions(source_id, id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION public.kb_protect_source_candidate_draft_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Source candidate draft promotions are append-only';
END;
$$;

CREATE TRIGGER kb_source_candidate_draft_promotions_append_only
  BEFORE UPDATE OR DELETE ON public.kb_source_candidate_draft_promotions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_source_candidate_draft_promotion();

CREATE OR REPLACE FUNCTION public.kb_protect_promoted_source_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'kb_sources' AND EXISTS (
    SELECT 1 FROM public.kb_source_candidate_draft_promotions promotion
     WHERE promotion.source_id = OLD.id
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Promoted source provenance cannot be deleted';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.canonical_key IS DISTINCT FROM OLD.canonical_key
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.metadata -> 'origin_type' IS DISTINCT FROM OLD.metadata -> 'origin_type'
       OR NEW.metadata -> 'source_candidate_id' IS DISTINCT FROM OLD.metadata -> 'source_candidate_id'
       OR NEW.metadata -> 'import_batch_id' IS DISTINCT FROM OLD.metadata -> 'import_batch_id'
       OR NEW.metadata -> 'conversion_version' IS DISTINCT FROM OLD.metadata -> 'conversion_version'
    THEN
      RAISE EXCEPTION 'Promoted source provenance fields are immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'kb_source_revisions' AND EXISTS (
    SELECT 1 FROM public.kb_source_candidate_draft_promotions promotion
     WHERE promotion.source_revision_id = OLD.id
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Promoted source revision provenance cannot be deleted';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.source_id IS DISTINCT FROM OLD.source_id
       OR NEW.revision_no IS DISTINCT FROM OLD.revision_no
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.metadata -> 'origin_type' IS DISTINCT FROM OLD.metadata -> 'origin_type'
       OR NEW.metadata -> 'source_candidate_id' IS DISTINCT FROM OLD.metadata -> 'source_candidate_id'
       OR NEW.metadata -> 'import_batch_id' IS DISTINCT FROM OLD.metadata -> 'import_batch_id'
       OR NEW.metadata -> 'review_decision_id' IS DISTINCT FROM OLD.metadata -> 'review_decision_id'
       OR NEW.metadata -> 'conversion_version' IS DISTINCT FROM OLD.metadata -> 'conversion_version'
    THEN
      RAISE EXCEPTION 'Promoted source revision provenance fields are immutable';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER kb_sources_promoted_provenance_protect
  BEFORE UPDATE OR DELETE ON public.kb_sources
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_promoted_source_provenance();

CREATE TRIGGER kb_source_revisions_promoted_provenance_protect
  BEFORE UPDATE OR DELETE ON public.kb_source_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_promoted_source_provenance();

CREATE OR REPLACE FUNCTION public.kb_promote_source_candidate_to_draft(
  _source_candidate_id uuid,
  _canonical_key text,
  _source_type text
)
RETURNS TABLE (
  promoted_source_id uuid,
  promoted_source_revision_id uuid,
  was_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reviewer_id uuid := auth.uid();
  candidate_batch_id uuid;
  locked_candidate public.kb_source_candidates%ROWTYPE;
  parent_batch_status text;
  accept_decision_id uuid;
  existing_promotion public.kb_source_candidate_draft_promotions%ROWTYPE;
  new_source_id uuid;
  new_revision_id uuid;
  draft_payload jsonb;
  draft_hash text;
BEGIN
  IF reviewer_id IS NULL OR NOT public.has_role(reviewer_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators may promote source candidates';
  END IF;
  IF _canonical_key IS NULL OR _canonical_key !~ '^[a-z0-9]+([._:-][a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Invalid source canonical key';
  END IF;
  IF _source_type IS NULL OR _source_type NOT IN (
    'manufacturer_document',
    'traditional_reference',
    'practice_rule',
    'book',
    'journal_article',
    'clinical_study',
    'systematic_review',
    'guideline',
    'website',
    'database',
    'other'
  ) THEN
    RAISE EXCEPTION 'Invalid core source type';
  END IF;

  SELECT candidate.batch_id
    INTO candidate_batch_id
    FROM public.kb_source_candidates candidate
   WHERE candidate.id = _source_candidate_id;
  IF candidate_batch_id IS NULL THEN
    RAISE EXCEPTION 'Source candidate not found';
  END IF;

  SELECT batch.batch_status
    INTO parent_batch_status
    FROM public.kb_import_batches batch
   WHERE batch.id = candidate_batch_id
   FOR UPDATE;
  IF parent_batch_status <> 'reviewed' THEN
    RAISE EXCEPTION 'Source candidate batch must be reviewed';
  END IF;

  SELECT candidate.*
    INTO STRICT locked_candidate
    FROM public.kb_source_candidates candidate
   WHERE candidate.id = _source_candidate_id
     AND candidate.batch_id = candidate_batch_id
   FOR UPDATE;

  IF locked_candidate.candidate_status <> 'accepted_as_draft' THEN
    RAISE EXCEPTION 'Source candidate must be accepted_as_draft';
  END IF;
  IF locked_candidate.target_source_id IS NOT NULL THEN
    RAISE EXCEPTION 'Existing-source candidates require a separate revision workflow';
  END IF;

  SELECT decision.id
    INTO accept_decision_id
    FROM public.kb_review_decisions decision
   WHERE decision.candidate_kind = 'source'
     AND decision.candidate_id = _source_candidate_id
     AND decision.decision = 'accept_as_draft'
     AND decision.status_after = 'accepted_as_draft'
   ORDER BY decision.decided_at DESC, decision.id DESC
   LIMIT 1;
  IF accept_decision_id IS NULL THEN
    RAISE EXCEPTION 'Accepted source candidate requires its review decision';
  END IF;

  draft_payload := jsonb_build_object(
    'source_type', _source_type,
    'title', locked_candidate.title,
    'publisher', NULLIF(btrim(locked_candidate.publisher), ''),
    'published_on', locked_candidate.publication_date,
    'url', NULLIF(btrim(locked_candidate.source_url), ''),
    'rights_status', locked_candidate.rights_status
  );
  draft_hash := encode(sha256(convert_to(draft_payload::text, 'UTF8')), 'hex');

  SELECT promotion.*
    INTO existing_promotion
    FROM public.kb_source_candidate_draft_promotions promotion
   WHERE promotion.source_candidate_id = _source_candidate_id;
  IF FOUND THEN
    IF existing_promotion.selected_canonical_key <> _canonical_key
       OR existing_promotion.selected_source_type <> _source_type
    THEN
      RAISE EXCEPTION 'Source candidate was already promoted with different parameters';
    END IF;
    IF existing_promotion.batch_id <> candidate_batch_id
       OR existing_promotion.review_decision_id <> accept_decision_id
       OR existing_promotion.initial_content_hash <> draft_hash
       OR existing_promotion.data_classification <> 'general_knowledge'
       OR existing_promotion.conversion_version <> 1
       OR NOT EXISTS (
         SELECT 1
           FROM public.kb_sources source
           JOIN public.kb_source_revisions revision
             ON revision.id = existing_promotion.source_revision_id
            AND revision.source_id = source.id
          WHERE source.id = existing_promotion.source_id
            AND source.canonical_key = existing_promotion.selected_canonical_key
            AND source.created_by = existing_promotion.promoted_by
            AND source.metadata -> 'origin_type' = to_jsonb('import'::text)
            AND source.metadata -> 'source_candidate_id' = to_jsonb(_source_candidate_id::text)
            AND source.metadata -> 'import_batch_id' = to_jsonb(candidate_batch_id::text)
            AND source.metadata -> 'conversion_version' = '1'::jsonb
            AND revision.revision_no = 1
            AND revision.created_by = existing_promotion.promoted_by
            AND revision.metadata -> 'origin_type' = to_jsonb('import'::text)
            AND revision.metadata -> 'source_candidate_id' = to_jsonb(_source_candidate_id::text)
            AND revision.metadata -> 'import_batch_id' = to_jsonb(candidate_batch_id::text)
            AND revision.metadata -> 'review_decision_id' = to_jsonb(accept_decision_id::text)
            AND revision.metadata -> 'conversion_version' = '1'::jsonb
       )
    THEN
      RAISE EXCEPTION 'Existing source promotion failed its integrity check';
    END IF;
    RETURN QUERY SELECT existing_promotion.source_id, existing_promotion.source_revision_id, false;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.kb_sources source WHERE source.canonical_key = _canonical_key) THEN
    RAISE EXCEPTION 'Source canonical key already exists';
  END IF;

  INSERT INTO public.kb_sources (
    canonical_key,
    metadata,
    created_by
  ) VALUES (
    _canonical_key,
    jsonb_build_object(
      'origin_type', 'import',
      'source_candidate_id', _source_candidate_id::text,
      'import_batch_id', candidate_batch_id::text,
      'conversion_version', 1
    ),
    reviewer_id
  ) RETURNING id INTO new_source_id;

  INSERT INTO public.kb_source_revisions (
    source_id,
    revision_no,
    source_type,
    title,
    publisher,
    published_on,
    url,
    rights_status,
    review_status,
    content_hash,
    metadata,
    created_by
  ) VALUES (
    new_source_id,
    1,
    _source_type,
    locked_candidate.title,
    NULLIF(btrim(locked_candidate.publisher), ''),
    locked_candidate.publication_date,
    NULLIF(btrim(locked_candidate.source_url), ''),
    locked_candidate.rights_status,
    'draft',
    draft_hash,
    jsonb_build_object(
      'origin_type', 'import',
      'source_candidate_id', _source_candidate_id::text,
      'import_batch_id', candidate_batch_id::text,
      'review_decision_id', accept_decision_id::text,
      'conversion_version', 1
    ),
    reviewer_id
  ) RETURNING id INTO new_revision_id;

  UPDATE public.kb_sources
     SET current_revision_id = new_revision_id
   WHERE id = new_source_id;

  INSERT INTO public.kb_source_candidate_draft_promotions (
    source_candidate_id,
    batch_id,
    review_decision_id,
    source_id,
    source_revision_id,
    selected_canonical_key,
    selected_source_type,
    initial_content_hash,
    promoted_by
  ) VALUES (
    _source_candidate_id,
    candidate_batch_id,
    accept_decision_id,
    new_source_id,
    new_revision_id,
    _canonical_key,
    _source_type,
    draft_hash,
    reviewer_id
  );

  RETURN QUERY SELECT new_source_id, new_revision_id, true;
END;
$$;

ALTER TABLE public.kb_source_candidate_draft_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_source_candidate_draft_promotions_admin_read
  ON public.kb_source_candidate_draft_promotions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE public.kb_source_candidate_draft_promotions
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
GRANT SELECT ON TABLE public.kb_source_candidate_draft_promotions
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.kb_protect_source_candidate_draft_promotion()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_promoted_source_provenance()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_promote_source_candidate_to_draft(uuid, text, text)
  FROM PUBLIC, anon, service_role, kb_importer, kb_import_runtime;
GRANT EXECUTE ON FUNCTION public.kb_promote_source_candidate_to_draft(uuid, text, text)
  TO authenticated;

COMMIT;
