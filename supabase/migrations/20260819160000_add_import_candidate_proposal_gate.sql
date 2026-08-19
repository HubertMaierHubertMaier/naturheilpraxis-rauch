BEGIN;

-- Accepted staging candidates enter a second admin review queue. This table
-- records lineage only; it never creates or releases a knowledge record.
CREATE TABLE public.kb_import_candidate_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_kind text NOT NULL
    CHECK (candidate_kind IN ('source', 'entity', 'relation', 'dosage', 'safety')),
  candidate_id uuid NOT NULL,
  batch_id uuid NOT NULL
    REFERENCES public.kb_import_batches(id) ON DELETE RESTRICT,
  proposal_id uuid NOT NULL UNIQUE
    REFERENCES public.kb_change_proposals(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  UNIQUE (candidate_kind, candidate_id)
);

CREATE INDEX kb_import_candidate_proposals_batch_idx
  ON public.kb_import_candidate_proposals(batch_id, created_at);

CREATE OR REPLACE FUNCTION public.kb_protect_import_candidate_proposal_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Import candidate proposal links are append-only';
END;
$$;

CREATE TRIGGER kb_import_candidate_proposals_append_only
  BEFORE UPDATE OR DELETE ON public.kb_import_candidate_proposals
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_import_candidate_proposal_link();

CREATE TABLE public.kb_import_proposal_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL
    REFERENCES public.kb_change_proposals(id) ON DELETE RESTRICT,
  review_action text NOT NULL
    CHECK (review_action IN ('start_review', 'accept', 'reject')),
  status_before text NOT NULL,
  status_after text NOT NULL,
  review_notes text NOT NULL DEFAULT '',
  acted_at timestamptz NOT NULL DEFAULT now(),
  acted_by uuid NOT NULL DEFAULT auth.uid(),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge')
);

CREATE INDEX kb_import_proposal_review_events_proposal_idx
  ON public.kb_import_proposal_review_events(proposal_id, acted_at);

CREATE OR REPLACE FUNCTION public.kb_protect_import_proposal_review_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Import proposal review events are append-only';
END;
$$;

CREATE TRIGGER kb_import_proposal_review_events_append_only
  BEFORE UPDATE OR DELETE ON public.kb_import_proposal_review_events
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_import_proposal_review_event();

CREATE OR REPLACE FUNCTION public.kb_submit_import_candidate_proposal(
  _candidate_kind text,
  _candidate_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  submitter_id uuid := auth.uid();
  candidate_snapshot jsonb;
  dependency_snapshots jsonb := '{}'::jsonb;
  batch_snapshot jsonb;
  review_snapshot jsonb;
  candidate_batch_id uuid;
  current_candidate_status text;
  current_batch_status text;
  proposal_kind text;
  proposal_operation text := 'create';
  proposal_target_id uuid;
  proposal_origin_type text;
  created_proposal_id uuid;
  existing_proposal_id uuid;
BEGIN
  IF submitter_id IS NULL OR NOT public.has_role(submitter_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators may submit import candidates for core review';
  END IF;

  IF _candidate_kind IS NULL OR _candidate_kind NOT IN ('source', 'entity', 'relation', 'dosage', 'safety') THEN
    RAISE EXCEPTION 'Invalid import candidate kind';
  END IF;
  IF _candidate_id IS NULL THEN
    RAISE EXCEPTION 'Import candidate id is required';
  END IF;

  SELECT link.proposal_id
    INTO existing_proposal_id
    FROM public.kb_import_candidate_proposals AS link
   WHERE link.candidate_kind = _candidate_kind
     AND link.candidate_id = _candidate_id;
  IF existing_proposal_id IS NOT NULL THEN
    RETURN existing_proposal_id;
  END IF;

  CASE _candidate_kind
    WHEN 'source' THEN
      SELECT to_jsonb(candidate), candidate.batch_id, candidate.candidate_status, candidate.target_source_id
        INTO candidate_snapshot, candidate_batch_id, current_candidate_status, proposal_target_id
        FROM public.kb_source_candidates AS candidate
       WHERE candidate.id = _candidate_id
       FOR SHARE;
      proposal_kind := CASE WHEN proposal_target_id IS NULL THEN 'source' ELSE 'source_revision' END;
    WHEN 'entity' THEN
      SELECT to_jsonb(candidate), candidate.batch_id, candidate.candidate_status, candidate.target_entity_id
        INTO candidate_snapshot, candidate_batch_id, current_candidate_status, proposal_target_id
        FROM public.kb_entity_candidates AS candidate
       WHERE candidate.id = _candidate_id
       FOR SHARE;
      proposal_kind := CASE WHEN proposal_target_id IS NULL THEN 'entity' ELSE 'entity_revision' END;
    WHEN 'relation' THEN
      SELECT to_jsonb(candidate), candidate.batch_id, candidate.candidate_status
        INTO candidate_snapshot, candidate_batch_id, current_candidate_status
        FROM public.kb_relation_candidates AS candidate
       WHERE candidate.id = _candidate_id
       FOR SHARE;
      proposal_kind := 'entity_relation';
    WHEN 'dosage' THEN
      SELECT to_jsonb(candidate), candidate.batch_id, candidate.candidate_status
        INTO candidate_snapshot, candidate_batch_id, current_candidate_status
        FROM public.kb_dosage_candidates AS candidate
       WHERE candidate.id = _candidate_id
       FOR SHARE;
      proposal_kind := 'assertion';
    WHEN 'safety' THEN
      SELECT to_jsonb(candidate), candidate.batch_id, candidate.candidate_status
        INTO candidate_snapshot, candidate_batch_id, current_candidate_status
        FROM public.kb_safety_candidates AS candidate
       WHERE candidate.id = _candidate_id
       FOR SHARE;
      proposal_kind := 'assertion';
  END CASE;

  IF candidate_snapshot IS NULL THEN
    RAISE EXCEPTION 'Import candidate not found';
  END IF;
  IF current_candidate_status <> 'accepted_as_draft' THEN
    RAISE EXCEPTION 'Only accepted_as_draft candidates may enter core review';
  END IF;

  SELECT batch.batch_status,
         to_jsonb(batch),
         CASE batch.source_kind
           WHEN 'parser' THEN 'parser'
           WHEN 'ai' THEN 'ai'
           WHEN 'manual' THEN 'human'
           ELSE 'import'
         END
    INTO current_batch_status, batch_snapshot, proposal_origin_type
    FROM public.kb_import_batches AS batch
   WHERE batch.id = candidate_batch_id
   FOR SHARE;
  IF current_batch_status <> 'reviewed' THEN
    RAISE EXCEPTION 'The complete import batch must be reviewed first';
  END IF;

  SELECT to_jsonb(decision)
    INTO review_snapshot
    FROM public.kb_review_decisions AS decision
   WHERE decision.candidate_kind = _candidate_kind
     AND decision.candidate_id = _candidate_id
     AND decision.decision = 'accept_as_draft'
     AND decision.status_after = 'accepted_as_draft'
   ORDER BY decision.decided_at DESC
   LIMIT 1;
  IF review_snapshot IS NULL THEN
    RAISE EXCEPTION 'Accepted candidate has no matching review decision';
  END IF;

  IF _candidate_kind = 'entity' THEN
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'source_candidate', (
        SELECT to_jsonb(source)
          FROM public.kb_source_candidates AS source
         WHERE source.id = NULLIF(candidate_snapshot ->> 'source_candidate_id', '')::uuid
      )
    )) INTO dependency_snapshots;
  ELSIF _candidate_kind = 'relation' THEN
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'source_candidate', (
        SELECT to_jsonb(source)
          FROM public.kb_source_candidates AS source
         WHERE source.id = NULLIF(candidate_snapshot ->> 'source_candidate_id', '')::uuid
      ),
      'subject_candidate', (
        SELECT to_jsonb(entity)
          FROM public.kb_entity_candidates AS entity
         WHERE entity.id = NULLIF(candidate_snapshot ->> 'subject_candidate_id', '')::uuid
      ),
      'object_candidate', (
        SELECT to_jsonb(entity)
          FROM public.kb_entity_candidates AS entity
         WHERE entity.id = NULLIF(candidate_snapshot ->> 'object_candidate_id', '')::uuid
      )
    )) INTO dependency_snapshots;
  ELSIF _candidate_kind = 'dosage' THEN
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'source_candidate', (
        SELECT to_jsonb(source)
          FROM public.kb_source_candidates AS source
         WHERE source.id = NULLIF(candidate_snapshot ->> 'source_candidate_id', '')::uuid
      ),
      'subject_candidate', (
        SELECT to_jsonb(entity)
          FROM public.kb_entity_candidates AS entity
         WHERE entity.id = NULLIF(candidate_snapshot ->> 'subject_candidate_id', '')::uuid
      ),
      'indication_candidate', (
        SELECT to_jsonb(entity)
          FROM public.kb_entity_candidates AS entity
         WHERE entity.id = NULLIF(candidate_snapshot ->> 'indication_candidate_id', '')::uuid
      )
    )) INTO dependency_snapshots;
  ELSIF _candidate_kind = 'safety' THEN
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'source_candidate', (
        SELECT to_jsonb(source)
          FROM public.kb_source_candidates AS source
         WHERE source.id = NULLIF(candidate_snapshot ->> 'source_candidate_id', '')::uuid
      ),
      'subject_candidate', (
        SELECT to_jsonb(entity)
          FROM public.kb_entity_candidates AS entity
         WHERE entity.id = NULLIF(candidate_snapshot ->> 'subject_candidate_id', '')::uuid
      ),
      'related_candidate', (
        SELECT to_jsonb(entity)
          FROM public.kb_entity_candidates AS entity
         WHERE entity.id = NULLIF(candidate_snapshot ->> 'related_candidate_id', '')::uuid
      )
    )) INTO dependency_snapshots;
  END IF;

  IF _candidate_kind = 'entity'
     AND candidate_snapshot ->> 'source_candidate_id' IS NOT NULL
     AND COALESCE(dependency_snapshots -> 'source_candidate' ->> 'candidate_status', 'missing') <> 'accepted_as_draft'
  THEN
    RAISE EXCEPTION 'Entity proposal source dependency is not accepted';
  ELSIF _candidate_kind = 'relation'
     AND (
       COALESCE(dependency_snapshots -> 'source_candidate' ->> 'candidate_status', 'missing') <> 'accepted_as_draft'
       OR (candidate_snapshot ->> 'subject_candidate_id' IS NOT NULL AND COALESCE(dependency_snapshots -> 'subject_candidate' ->> 'candidate_status', 'missing') <> 'accepted_as_draft')
       OR (candidate_snapshot ->> 'object_candidate_id' IS NOT NULL AND COALESCE(dependency_snapshots -> 'object_candidate' ->> 'candidate_status', 'missing') <> 'accepted_as_draft')
     )
  THEN
    RAISE EXCEPTION 'Relation proposal dependencies are not accepted';
  ELSIF _candidate_kind = 'dosage'
     AND (
       COALESCE(dependency_snapshots -> 'source_candidate' ->> 'candidate_status', 'missing') <> 'accepted_as_draft'
       OR (candidate_snapshot ->> 'subject_candidate_id' IS NOT NULL AND COALESCE(dependency_snapshots -> 'subject_candidate' ->> 'candidate_status', 'missing') <> 'accepted_as_draft')
       OR (candidate_snapshot ->> 'indication_candidate_id' IS NOT NULL AND COALESCE(dependency_snapshots -> 'indication_candidate' ->> 'candidate_status', 'missing') <> 'accepted_as_draft')
     )
  THEN
    RAISE EXCEPTION 'Dosage proposal dependencies are not accepted';
  ELSIF _candidate_kind = 'safety'
     AND (
       COALESCE(dependency_snapshots -> 'source_candidate' ->> 'candidate_status', 'missing') <> 'accepted_as_draft'
       OR (candidate_snapshot ->> 'subject_candidate_id' IS NOT NULL AND COALESCE(dependency_snapshots -> 'subject_candidate' ->> 'candidate_status', 'missing') <> 'accepted_as_draft')
       OR (candidate_snapshot ->> 'related_candidate_id' IS NOT NULL AND COALESCE(dependency_snapshots -> 'related_candidate' ->> 'candidate_status', 'missing') <> 'accepted_as_draft')
     )
  THEN
    RAISE EXCEPTION 'Safety proposal dependencies are not accepted';
  END IF;

  IF proposal_target_id IS NOT NULL THEN
    proposal_operation := 'update';
  END IF;

  INSERT INTO public.kb_change_proposals (
    proposal_kind,
    operation,
    target_id,
    proposal,
    origin_type,
    status,
    submitted_by
  ) VALUES (
    proposal_kind,
    proposal_operation,
    proposal_target_id,
    jsonb_build_object(
      'schema_version', 1,
      'staging_candidate_kind', _candidate_kind,
      'staging_candidate_id', _candidate_id,
      'batch', batch_snapshot,
      'candidate', candidate_snapshot,
      'dependencies', dependency_snapshots,
      'review_decision', review_snapshot,
      'review_boundary', jsonb_build_object(
        'visibility', 'admin_only',
        'evidence_assessment_separate', true,
        'safety_assessment_separate', true,
        'automatically_applied_to_core', false,
        'released', false,
        'patient_use_approved', false
      )
    ),
    proposal_origin_type,
    'submitted',
    submitter_id
  ) RETURNING id INTO created_proposal_id;

  INSERT INTO public.kb_import_candidate_proposals (
    candidate_kind,
    candidate_id,
    batch_id,
    proposal_id,
    created_by
  ) VALUES (
    _candidate_kind,
    _candidate_id,
    candidate_batch_id,
    created_proposal_id,
    submitter_id
  );

  RETURN created_proposal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_review_import_candidate_proposal(
  _proposal_id uuid,
  _review_action text,
  _review_notes text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reviewer_id uuid := auth.uid();
  current_status text;
  next_status text;
  review_event_id uuid;
BEGIN
  IF reviewer_id IS NULL OR NOT public.has_role(reviewer_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators may review import candidate proposals';
  END IF;
  IF _proposal_id IS NULL THEN
    RAISE EXCEPTION 'Proposal id is required';
  END IF;

  next_status := CASE _review_action
    WHEN 'start_review' THEN 'in_review'
    WHEN 'accept' THEN 'accepted'
    WHEN 'reject' THEN 'rejected'
    ELSE NULL
  END;
  IF next_status IS NULL THEN
    RAISE EXCEPTION 'Invalid proposal review action';
  END IF;

  SELECT proposal.status
    INTO current_status
    FROM public.kb_change_proposals AS proposal
    JOIN public.kb_import_candidate_proposals AS link
      ON link.proposal_id = proposal.id
   WHERE proposal.id = _proposal_id
   FOR UPDATE OF proposal;
  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Linked import candidate proposal not found';
  END IF;

  IF _review_action = 'start_review' AND current_status <> 'submitted' THEN
    RAISE EXCEPTION 'Only submitted proposals may enter review';
  ELSIF _review_action IN ('accept', 'reject') AND current_status <> 'in_review' THEN
    RAISE EXCEPTION 'Only proposals in_review may receive a final decision';
  END IF;
  IF _review_action IN ('accept', 'reject') AND btrim(COALESCE(_review_notes, '')) = '' THEN
    RAISE EXCEPTION 'A final proposal decision requires review notes';
  END IF;

  IF _review_action = 'start_review' THEN
    UPDATE public.kb_change_proposals
       SET status = next_status
     WHERE id = _proposal_id;
  ELSE
    UPDATE public.kb_change_proposals
       SET status = next_status,
           review_notes = btrim(_review_notes),
           reviewed_at = now(),
           reviewed_by = reviewer_id
     WHERE id = _proposal_id;
  END IF;

  INSERT INTO public.kb_import_proposal_review_events (
    proposal_id,
    review_action,
    status_before,
    status_after,
    review_notes,
    acted_by
  ) VALUES (
    _proposal_id,
    _review_action,
    current_status,
    next_status,
    btrim(COALESCE(_review_notes, '')),
    reviewer_id
  ) RETURNING id INTO review_event_id;

  RETURN review_event_id;
END;
$$;

ALTER TABLE public.kb_import_candidate_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_import_proposal_review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_import_candidate_proposals_admin_select
  ON public.kb_import_candidate_proposals
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY kb_import_proposal_review_events_admin_select
  ON public.kb_import_proposal_review_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE public.kb_import_candidate_proposals
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.kb_import_candidate_proposals
  TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.kb_import_candidate_proposals
  TO service_role;

REVOKE ALL ON TABLE public.kb_import_proposal_review_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.kb_import_proposal_review_events
  TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.kb_import_proposal_review_events
  TO service_role;

REVOKE ALL ON FUNCTION public.kb_protect_import_candidate_proposal_link()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_protect_import_proposal_review_event()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_submit_import_candidate_proposal(text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_submit_import_candidate_proposal(text, uuid)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.kb_review_import_candidate_proposal(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_review_import_candidate_proposal(uuid, text, text)
  TO authenticated, service_role;

COMMIT;
