BEGIN;

DO $seed$
DECLARE
  target_batch_id uuid := '68fd7bfa-f45c-58d2-8f72-802ff5986236'::uuid;
  actual_count integer;
  linked_count integer;
  unsafe_count integer;
BEGIN
  SELECT
    (SELECT count(*) FROM public.kb_source_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_entity_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_relation_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_dosage_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_safety_candidates WHERE batch_id = target_batch_id)
    INTO actual_count;
  IF actual_count <> 4049 THEN
    RAISE EXCEPTION 'SEG staging import incomplete: % of 4049 candidates present', actual_count;
  END IF;
  UPDATE public.kb_import_batches
     SET batch_status = 'ready_for_review', candidate_count = 4049, completed_at = now()
   WHERE id = target_batch_id AND batch_status = 'processing';
  PERFORM public._kb_materialize_import_candidates_as_internal_drafts(target_batch_id, NULL);
  SELECT count(*)::int INTO linked_count FROM public.kb_import_core_links WHERE batch_id = target_batch_id;
  SELECT count(*)::int INTO unsafe_count FROM public.kb_import_core_links
   WHERE batch_id = target_batch_id AND (visibility <> 'admin_only' OR materialization_status <> 'internal_draft'
     OR evidence_status <> 'unreviewed' OR safety_status <> 'unreviewed' OR patient_facing_allowed);
  IF linked_count <> 4049 OR unsafe_count <> 0 THEN
    RAISE EXCEPTION 'SEG protected materialization failed: % links, % unsafe', linked_count, unsafe_count;
  END IF;
END;
$seed$;

COMMIT;