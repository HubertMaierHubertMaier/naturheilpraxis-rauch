BEGIN;

-- Additive internal import only. Apply after a verified live backup and read-only duplicate preflight.
-- All records remain admin-only, internal drafts, unreviewed, and unavailable for patient use.
DO $seed$
DECLARE
  target_batch_id uuid := '68fd7bfa-f45c-58d2-8f72-802ff5986236'::uuid;
  inventory_hash text := '7ff48a60d048b585ed179e898cb4695bea05fc653d9639c34692c8b864ed0e0f';
  stored_hash text;
  stored_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.kb_import_batches WHERE id = target_batch_id) THEN
    SELECT source_hash, candidate_count INTO STRICT stored_hash, stored_count
      FROM public.kb_import_batches WHERE id = target_batch_id;
    IF stored_hash <> inventory_hash OR stored_count <> 4049 THEN
      RAISE EXCEPTION 'Existing SEG health-knowledge import does not match its immutable manifest';
    END IF;
  ELSE
    INSERT INTO public.kb_import_batches (
      id, source_kind, source_label, source_hash, parser_name, parser_version, model_name, prompt_hash,
      batch_status, candidate_count, error_count, data_classification, metadata
    ) VALUES (
      target_batch_id, 'json', 'SchnellEinfachGesund: zusammengefuehrtes Gesundheitswissen-HTML mit erhaltenen PDF-, Seiten- und Web-Herkunftsverweisen', inventory_hash,
      'gesundheitswissen-datenbank-import-erzeugen', '1.0.0', '',
      NULL, 'created', 4049, 0, 'general_knowledge', '{"admin_only":true,"internal_draft":true,"patient_facing_allowed":false,"publication":"unpublished_internal_staging","review_status":"unreviewed","source_count":7,"html_primary_source_count":1,"embedded_pdf_provenance_source_count":33,"embedded_web_provenance_source_count":7,"supplemental_chipcard_web_source_count":5,"supplemental_laboratory_source_count":1,"expected_claim_count":1462,"source_claim_and_evaluation_separated":true,"database_access_executed":false,"source_bundle_sha256":"66d0fb40523d5d7ef29466ca2719826c88111dfb0f61ffaba52f496bd8894d5f","live_backup_required_before_apply":true,"live_deduplication_required_before_apply":true}'::jsonb
    );

    UPDATE public.kb_import_batches SET batch_status = 'processing' WHERE id = target_batch_id;

  END IF;

END;
$seed$;

COMMIT;
