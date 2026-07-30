BEGIN;

DO $$
DECLARE
  importer_role pg_roles%ROWTYPE;
  runtime_role pg_roles%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kb_importer') THEN
    CREATE ROLE kb_importer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  SELECT * INTO STRICT importer_role FROM pg_roles WHERE rolname = 'kb_importer';
  IF importer_role.rolcanlogin
     OR importer_role.rolsuper
     OR importer_role.rolcreatedb
     OR importer_role.rolcreaterole
     OR importer_role.rolinherit
     OR importer_role.rolbypassrls
  THEN
    RAISE EXCEPTION 'Existing kb_importer role has unsafe attributes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kb_import_runtime') THEN
    CREATE ROLE kb_import_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  SELECT * INTO STRICT runtime_role FROM pg_roles WHERE rolname = 'kb_import_runtime';
  IF runtime_role.rolcanlogin
     OR runtime_role.rolsuper
     OR runtime_role.rolcreatedb
     OR runtime_role.rolcreaterole
     OR runtime_role.rolinherit
     OR runtime_role.rolbypassrls
  THEN
    RAISE EXCEPTION 'Existing kb_import_runtime role has unsafe attributes';
  END IF;
END;
$$;

GRANT kb_importer TO kb_import_runtime;

CREATE TABLE public.kb_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL
    CHECK (source_kind IN ('legacy_wiki', 'markdown', 'csv', 'json', 'manual', 'parser', 'ai')),
  source_label text NOT NULL CHECK (btrim(source_label) <> ''),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  parser_name text NOT NULL DEFAULT '',
  parser_version text NOT NULL DEFAULT '',
  model_name text NOT NULL DEFAULT '',
  prompt_hash text CHECK (prompt_hash IS NULL OR prompt_hash ~ '^[0-9a-f]{64}$'),
  batch_status text NOT NULL DEFAULT 'created'
    CHECK (batch_status IN ('created', 'processing', 'ready_for_review', 'reviewed', 'failed', 'cancelled')),
  candidate_count integer NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  completed_at timestamptz,
  CHECK (source_kind <> 'parser' OR (btrim(parser_name) <> '' AND btrim(parser_version) <> '')),
  CHECK (source_kind <> 'ai' OR (btrim(model_name) <> '' AND prompt_hash IS NOT NULL))
);

CREATE TABLE public.kb_source_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.kb_import_batches(id) ON DELETE CASCADE,
  candidate_key text NOT NULL,
  candidate_status text NOT NULL DEFAULT 'imported_unreviewed'
    CHECK (candidate_status IN ('imported_unreviewed', 'needs_clarification', 'accepted_as_draft', 'rejected', 'duplicate')),
  proposed_source_type text NOT NULL DEFAULT 'other'
    CHECK (proposed_source_type IN ('guideline', 'systematic_review', 'study', 'reference_work', 'manufacturer', 'regulatory', 'website', 'practice_document', 'other')),
  title text NOT NULL CHECK (btrim(title) <> ''),
  publisher text NOT NULL DEFAULT '',
  publication_date date,
  source_url text NOT NULL DEFAULT '',
  external_identifier text NOT NULL DEFAULT '',
  rights_status text NOT NULL DEFAULT 'unknown'
    CHECK (rights_status IN ('unknown', 'own_content', 'licensed', 'quoted', 'public_domain')),
  source_locator text NOT NULL DEFAULT '',
  original_excerpt text NOT NULL DEFAULT '',
  confidence smallint NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  ambiguity_notes text NOT NULL DEFAULT '',
  proposed_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(proposed_data) = 'object'),
  target_source_id uuid REFERENCES public.kb_sources(id) ON DELETE RESTRICT,
  data_classification text NOT NULL DEFAULT 'general_knowledge' CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  UNIQUE (batch_id, candidate_key)
);

CREATE TABLE public.kb_entity_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.kb_import_batches(id) ON DELETE CASCADE,
  candidate_key text NOT NULL,
  candidate_status text NOT NULL DEFAULT 'imported_unreviewed'
    CHECK (candidate_status IN ('imported_unreviewed', 'needs_clarification', 'accepted_as_draft', 'rejected', 'duplicate')),
  proposed_entity_type_code text REFERENCES public.kb_entity_types(code) ON DELETE RESTRICT,
  proposed_canonical_key text CHECK (proposed_canonical_key IS NULL OR proposed_canonical_key ~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'),
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  aliases text[] NOT NULL DEFAULT '{}',
  description_markdown text NOT NULL DEFAULT '',
  source_candidate_id uuid REFERENCES public.kb_source_candidates(id) ON DELETE RESTRICT,
  source_locator text NOT NULL DEFAULT '',
  original_excerpt text NOT NULL DEFAULT '',
  confidence smallint NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  ambiguity_notes text NOT NULL DEFAULT '',
  proposed_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(proposed_data) = 'object'),
  target_entity_id uuid REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  data_classification text NOT NULL DEFAULT 'general_knowledge' CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  UNIQUE (batch_id, candidate_key)
);

CREATE TABLE public.kb_relation_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.kb_import_batches(id) ON DELETE CASCADE,
  candidate_key text NOT NULL,
  candidate_status text NOT NULL DEFAULT 'imported_unreviewed'
    CHECK (candidate_status IN ('imported_unreviewed', 'needs_clarification', 'accepted_as_draft', 'rejected', 'duplicate')),
  subject_entity_id uuid REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  subject_candidate_id uuid REFERENCES public.kb_entity_candidates(id) ON DELETE RESTRICT,
  object_entity_id uuid REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  object_candidate_id uuid REFERENCES public.kb_entity_candidates(id) ON DELETE RESTRICT,
  proposed_relation_type_code text REFERENCES public.kb_relation_types(code) ON DELETE RESTRICT,
  assignment_strength text NOT NULL DEFAULT 'possible'
    CHECK (assignment_strength IN ('direct', 'indirect', 'possible', 'contextual', 'not_recommended')),
  source_candidate_id uuid NOT NULL REFERENCES public.kb_source_candidates(id) ON DELETE RESTRICT,
  source_locator text NOT NULL DEFAULT '',
  original_excerpt text NOT NULL DEFAULT '',
  confidence smallint NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  ambiguity_notes text NOT NULL DEFAULT '',
  proposed_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(proposed_data) = 'object'),
  data_classification text NOT NULL DEFAULT 'general_knowledge' CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  UNIQUE (batch_id, candidate_key),
  CHECK ((subject_entity_id IS NOT NULL)::int + (subject_candidate_id IS NOT NULL)::int = 1),
  CHECK ((object_entity_id IS NOT NULL)::int + (object_candidate_id IS NOT NULL)::int = 1)
);

CREATE TABLE public.kb_dosage_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.kb_import_batches(id) ON DELETE CASCADE,
  candidate_key text NOT NULL,
  candidate_status text NOT NULL DEFAULT 'imported_unreviewed'
    CHECK (candidate_status IN ('imported_unreviewed', 'needs_clarification', 'accepted_as_draft', 'rejected', 'duplicate')),
  subject_entity_id uuid REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  subject_candidate_id uuid REFERENCES public.kb_entity_candidates(id) ON DELETE RESTRICT,
  indication_entity_id uuid REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  indication_candidate_id uuid REFERENCES public.kb_entity_candidates(id) ON DELETE RESTRICT,
  application_route text NOT NULL DEFAULT '',
  minimum_dose numeric,
  maximum_dose numeric,
  dose_unit text NOT NULL DEFAULT '',
  reference_period text NOT NULL DEFAULT '',
  frequency_text text NOT NULL DEFAULT '',
  duration_text text NOT NULL DEFAULT '',
  timing_text text NOT NULL DEFAULT '',
  application_text text NOT NULL DEFAULT '',
  source_candidate_id uuid NOT NULL REFERENCES public.kb_source_candidates(id) ON DELETE RESTRICT,
  source_locator text NOT NULL DEFAULT '',
  original_excerpt text NOT NULL DEFAULT '',
  confidence smallint NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  ambiguity_notes text NOT NULL DEFAULT '',
  proposed_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(proposed_data) = 'object'),
  data_classification text NOT NULL DEFAULT 'general_knowledge' CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  UNIQUE (batch_id, candidate_key),
  CHECK ((subject_entity_id IS NOT NULL)::int + (subject_candidate_id IS NOT NULL)::int = 1),
  CHECK ((indication_entity_id IS NOT NULL)::int + (indication_candidate_id IS NOT NULL)::int <= 1),
  CHECK (minimum_dose IS NULL OR minimum_dose >= 0),
  CHECK (maximum_dose IS NULL OR maximum_dose >= 0),
  CHECK (minimum_dose IS NULL OR maximum_dose IS NULL OR maximum_dose >= minimum_dose)
);

CREATE TABLE public.kb_safety_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.kb_import_batches(id) ON DELETE CASCADE,
  candidate_key text NOT NULL,
  candidate_status text NOT NULL DEFAULT 'imported_unreviewed'
    CHECK (candidate_status IN ('imported_unreviewed', 'needs_clarification', 'accepted_as_draft', 'rejected', 'duplicate')),
  subject_entity_id uuid REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  subject_candidate_id uuid REFERENCES public.kb_entity_candidates(id) ON DELETE RESTRICT,
  related_entity_id uuid REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  related_candidate_id uuid REFERENCES public.kb_entity_candidates(id) ON DELETE RESTRICT,
  rule_type text NOT NULL
    CHECK (rule_type IN ('contraindication', 'interaction', 'precaution', 'dose_adjustment', 'adverse_effect', 'monitoring', 'pregnancy', 'breastfeeding', 'child', 'renal_function', 'hepatic_function')),
  severity text NOT NULL DEFAULT 'require_review'
    CHECK (severity IN ('information', 'caution', 'require_review', 'avoid')),
  action_text text NOT NULL CHECK (btrim(action_text) <> ''),
  source_candidate_id uuid NOT NULL REFERENCES public.kb_source_candidates(id) ON DELETE RESTRICT,
  source_locator text NOT NULL DEFAULT '',
  original_excerpt text NOT NULL DEFAULT '',
  confidence smallint NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  ambiguity_notes text NOT NULL DEFAULT '',
  proposed_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(proposed_data) = 'object'),
  data_classification text NOT NULL DEFAULT 'general_knowledge' CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  UNIQUE (batch_id, candidate_key),
  CHECK ((subject_entity_id IS NOT NULL)::int + (subject_candidate_id IS NOT NULL)::int = 1),
  CHECK ((related_entity_id IS NOT NULL)::int + (related_candidate_id IS NOT NULL)::int <= 1)
);

ALTER TABLE public.kb_source_candidates
  ADD CONSTRAINT kb_source_candidates_batch_id_id_unique UNIQUE (batch_id, id);
ALTER TABLE public.kb_entity_candidates
  ADD CONSTRAINT kb_entity_candidates_batch_id_id_unique UNIQUE (batch_id, id),
  ADD CONSTRAINT kb_entity_candidates_source_same_batch_fk
    FOREIGN KEY (batch_id, source_candidate_id)
    REFERENCES public.kb_source_candidates(batch_id, id) ON DELETE RESTRICT;
ALTER TABLE public.kb_relation_candidates
  ADD CONSTRAINT kb_relation_candidates_subject_same_batch_fk
    FOREIGN KEY (batch_id, subject_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT kb_relation_candidates_object_same_batch_fk
    FOREIGN KEY (batch_id, object_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT kb_relation_candidates_source_same_batch_fk
    FOREIGN KEY (batch_id, source_candidate_id)
    REFERENCES public.kb_source_candidates(batch_id, id) ON DELETE RESTRICT;
ALTER TABLE public.kb_dosage_candidates
  ADD CONSTRAINT kb_dosage_candidates_subject_same_batch_fk
    FOREIGN KEY (batch_id, subject_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT kb_dosage_candidates_indication_same_batch_fk
    FOREIGN KEY (batch_id, indication_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT kb_dosage_candidates_source_same_batch_fk
    FOREIGN KEY (batch_id, source_candidate_id)
    REFERENCES public.kb_source_candidates(batch_id, id) ON DELETE RESTRICT;
ALTER TABLE public.kb_safety_candidates
  ADD CONSTRAINT kb_safety_candidates_subject_same_batch_fk
    FOREIGN KEY (batch_id, subject_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT kb_safety_candidates_related_same_batch_fk
    FOREIGN KEY (batch_id, related_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT kb_safety_candidates_source_same_batch_fk
    FOREIGN KEY (batch_id, source_candidate_id)
    REFERENCES public.kb_source_candidates(batch_id, id) ON DELETE RESTRICT;

CREATE TABLE public.kb_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_kind text NOT NULL CHECK (candidate_kind IN ('source', 'entity', 'relation', 'dosage', 'safety')),
  candidate_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accept_as_draft', 'reject', 'needs_clarification', 'mark_duplicate')),
  status_before text NOT NULL,
  status_after text NOT NULL,
  decision_notes text NOT NULL DEFAULT '',
  decided_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid NOT NULL DEFAULT auth.uid(),
  data_classification text NOT NULL DEFAULT 'general_knowledge' CHECK (data_classification = 'general_knowledge')
);

CREATE TABLE public.kb_import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.kb_import_batches(id) ON DELETE CASCADE,
  candidate_kind text CHECK (candidate_kind IS NULL OR candidate_kind IN ('source', 'entity', 'relation', 'dosage', 'safety')),
  candidate_key text NOT NULL DEFAULT '',
  error_code text NOT NULL CHECK (btrim(error_code) <> ''),
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'fatal')),
  error_message text NOT NULL CHECK (btrim(error_message) <> ''),
  source_locator text NOT NULL DEFAULT '',
  original_excerpt text NOT NULL DEFAULT '',
  data_classification text NOT NULL DEFAULT 'general_knowledge' CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX kb_import_batches_status_idx ON public.kb_import_batches(batch_status, created_at);
CREATE INDEX kb_source_candidates_queue_idx ON public.kb_source_candidates(candidate_status, batch_id);
CREATE INDEX kb_entity_candidates_queue_idx ON public.kb_entity_candidates(candidate_status, batch_id);
CREATE INDEX kb_relation_candidates_queue_idx ON public.kb_relation_candidates(candidate_status, batch_id);
CREATE INDEX kb_dosage_candidates_queue_idx ON public.kb_dosage_candidates(candidate_status, batch_id);
CREATE INDEX kb_safety_candidates_queue_idx ON public.kb_safety_candidates(candidate_status, batch_id);
CREATE INDEX kb_review_decisions_candidate_idx ON public.kb_review_decisions(candidate_kind, candidate_id, decided_at);
CREATE INDEX kb_import_errors_batch_idx ON public.kb_import_errors(batch_id, severity);

CREATE OR REPLACE FUNCTION public.kb_require_open_import_batch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT batch_status
    INTO parent_status
    FROM public.kb_import_batches
   WHERE id = NEW.batch_id
   FOR UPDATE;
  IF parent_status IS NULL THEN
    RAISE EXCEPTION 'Import batch not found';
  END IF;
  IF parent_status NOT IN ('created', 'processing') THEN
    RAISE EXCEPTION 'Candidates and errors require an open import batch';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  import_table text;
BEGIN
  FOREACH import_table IN ARRAY ARRAY[
    'kb_source_candidates',
    'kb_entity_candidates',
    'kb_relation_candidates',
    'kb_dosage_candidates',
    'kb_safety_candidates',
    'kb_import_errors'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.kb_require_open_import_batch()',
      import_table || '_open_batch',
      import_table
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_enforce_import_batch_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Import batches cannot be deleted';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.batch_status <> 'created' THEN
      RAISE EXCEPTION 'Import batches must be inserted as created';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'batch_status' - 'candidate_count' - 'error_count' - 'completed_at')
       IS DISTINCT FROM
     (to_jsonb(OLD) - 'batch_status' - 'candidate_count' - 'error_count' - 'completed_at')
  THEN
    RAISE EXCEPTION 'Import batch provenance is immutable';
  END IF;
  IF OLD.batch_status IN ('reviewed', 'failed', 'cancelled') THEN
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      RAISE EXCEPTION 'Terminal import batches are immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF (OLD.batch_status = 'created' AND NEW.batch_status NOT IN ('created', 'processing', 'cancelled'))
     OR (OLD.batch_status = 'processing' AND NEW.batch_status NOT IN ('processing', 'ready_for_review', 'failed', 'cancelled'))
     OR (OLD.batch_status = 'ready_for_review' AND NEW.batch_status NOT IN ('ready_for_review', 'reviewed', 'failed'))
  THEN
    RAISE EXCEPTION 'Invalid import batch status transition';
  END IF;
  IF NEW.batch_status = 'reviewed' AND OLD.batch_status <> 'reviewed' THEN
    IF current_user <> pg_get_userbyid((
      SELECT relclass.relowner
        FROM pg_class relclass
        JOIN pg_namespace namespace ON namespace.oid = relclass.relnamespace
       WHERE namespace.nspname = TG_TABLE_SCHEMA
         AND relclass.relname = TG_TABLE_NAME
    )) THEN
      RAISE EXCEPTION 'Reviewed import batches require the controlled completion function';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_import_batches_workflow
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.kb_enforce_import_batch_workflow();

CREATE OR REPLACE FUNCTION public.kb_enforce_import_candidate_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
  terminal_statuses text[] := ARRAY['accepted_as_draft', 'rejected', 'duplicate'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Import candidates cannot be deleted';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.candidate_status <> 'imported_unreviewed' THEN
      RAISE EXCEPTION 'Import candidates must be inserted as imported_unreviewed';
    END IF;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'candidate_status' - 'reviewed_at' - 'reviewed_by')
       IS DISTINCT FROM
     (to_jsonb(OLD) - 'candidate_status' - 'reviewed_at' - 'reviewed_by')
  THEN
    RAISE EXCEPTION 'Imported candidate identity and payload are immutable';
  END IF;

  IF OLD.candidate_status = ANY(terminal_statuses) AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'Reviewed import candidates are immutable';
  END IF;

  IF OLD.candidate_status IS DISTINCT FROM NEW.candidate_status THEN
    SELECT pg_get_userbyid(relclass.relowner)
      INTO STRICT table_owner
      FROM pg_class relclass
      JOIN pg_namespace namespace ON namespace.oid = relclass.relnamespace
     WHERE namespace.nspname = TG_TABLE_SCHEMA
       AND relclass.relname = TG_TABLE_NAME;
    IF current_user <> table_owner THEN
      RAISE EXCEPTION 'Candidate status changes require the controlled review function';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  candidate_table text;
BEGIN
  FOREACH candidate_table IN ARRAY ARRAY[
    'kb_source_candidates',
    'kb_entity_candidates',
    'kb_relation_candidates',
    'kb_dosage_candidates',
    'kb_safety_candidates'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.kb_enforce_import_candidate_workflow()',
      candidate_table || '_workflow',
      candidate_table
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_import_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_owner name;
BEGIN
  IF TG_TABLE_NAME = 'kb_review_decisions' AND TG_OP = 'INSERT' THEN
    SELECT pg_get_userbyid(relclass.relowner)
      INTO STRICT table_owner
      FROM pg_class relclass
      JOIN pg_namespace namespace ON namespace.oid = relclass.relnamespace
     WHERE namespace.nspname = TG_TABLE_SCHEMA
       AND relclass.relname = TG_TABLE_NAME;
    IF current_user <> table_owner THEN
      RAISE EXCEPTION 'Review decisions require the controlled admin review function';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Import review decisions and errors are append-only';
END;
$$;

CREATE TRIGGER kb_review_decisions_append_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_review_decisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_import_audit_row();

CREATE TRIGGER kb_import_errors_append_only
  BEFORE UPDATE OR DELETE ON public.kb_import_errors
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_import_audit_row();

CREATE OR REPLACE FUNCTION public.kb_record_import_review_decision(
  _candidate_kind text,
  _candidate_id uuid,
  _decision text,
  _decision_notes text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  candidate_table text;
  current_status text;
  candidate_batch_id uuid;
  locked_candidate_batch_id uuid;
  parent_batch_status text;
  next_status text;
  decision_id uuid;
  reviewer_id uuid := auth.uid();
BEGIN
  IF reviewer_id IS NULL OR NOT public.has_role(reviewer_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators may review import candidates';
  END IF;

  candidate_table := CASE _candidate_kind
    WHEN 'source' THEN 'kb_source_candidates'
    WHEN 'entity' THEN 'kb_entity_candidates'
    WHEN 'relation' THEN 'kb_relation_candidates'
    WHEN 'dosage' THEN 'kb_dosage_candidates'
    WHEN 'safety' THEN 'kb_safety_candidates'
    ELSE NULL
  END;
  next_status := CASE _decision
    WHEN 'accept_as_draft' THEN 'accepted_as_draft'
    WHEN 'reject' THEN 'rejected'
    WHEN 'needs_clarification' THEN 'needs_clarification'
    WHEN 'mark_duplicate' THEN 'duplicate'
    ELSE NULL
  END;

  IF candidate_table IS NULL OR next_status IS NULL THEN
    RAISE EXCEPTION 'Invalid candidate kind or review decision';
  END IF;

  EXECUTE format('SELECT batch_id FROM public.%I WHERE id = $1', candidate_table)
    INTO candidate_batch_id
    USING _candidate_id;
  IF candidate_batch_id IS NULL THEN
    RAISE EXCEPTION 'Import candidate not found';
  END IF;

  SELECT batch_status
    INTO parent_batch_status
    FROM public.kb_import_batches
   WHERE id = candidate_batch_id
   FOR UPDATE;
  IF parent_batch_status <> 'ready_for_review' THEN
    RAISE EXCEPTION 'Import candidate batch must be ready_for_review';
  END IF;

  EXECUTE format('SELECT candidate_status, batch_id FROM public.%I WHERE id = $1 FOR UPDATE', candidate_table)
    INTO current_status, locked_candidate_batch_id
    USING _candidate_id;
  IF current_status IS NULL OR locked_candidate_batch_id IS DISTINCT FROM candidate_batch_id THEN
    RAISE EXCEPTION 'Import candidate changed while review was starting';
  END IF;
  IF current_status IN ('accepted_as_draft', 'rejected', 'duplicate') THEN
    RAISE EXCEPTION 'Import candidate already has a terminal decision';
  END IF;

  IF _decision = 'accept_as_draft' AND _candidate_kind = 'entity' AND EXISTS (
    SELECT 1
      FROM public.kb_entity_candidates candidate
      LEFT JOIN public.kb_source_candidates source ON source.id = candidate.source_candidate_id
     WHERE candidate.id = _candidate_id
       AND candidate.source_candidate_id IS NOT NULL
       AND source.candidate_status IS DISTINCT FROM 'accepted_as_draft'
  ) THEN
    RAISE EXCEPTION 'Entity candidate source must be accepted first';
  END IF;

  IF _decision = 'accept_as_draft' AND _candidate_kind IN ('relation', 'dosage', 'safety') THEN
    IF (_candidate_kind = 'relation' AND EXISTS (
      SELECT 1
        FROM public.kb_relation_candidates candidate
        JOIN public.kb_source_candidates source ON source.id = candidate.source_candidate_id
        LEFT JOIN public.kb_entity_candidates subject ON subject.id = candidate.subject_candidate_id
        LEFT JOIN public.kb_entity_candidates object_candidate ON object_candidate.id = candidate.object_candidate_id
       WHERE candidate.id = _candidate_id
         AND (
           source.candidate_status <> 'accepted_as_draft'
           OR (candidate.subject_candidate_id IS NOT NULL AND subject.candidate_status <> 'accepted_as_draft')
           OR (candidate.object_candidate_id IS NOT NULL AND object_candidate.candidate_status <> 'accepted_as_draft')
         )
    )) OR (_candidate_kind = 'dosage' AND EXISTS (
      SELECT 1
        FROM public.kb_dosage_candidates candidate
        JOIN public.kb_source_candidates source ON source.id = candidate.source_candidate_id
        LEFT JOIN public.kb_entity_candidates subject ON subject.id = candidate.subject_candidate_id
        LEFT JOIN public.kb_entity_candidates indication ON indication.id = candidate.indication_candidate_id
       WHERE candidate.id = _candidate_id
         AND (
           source.candidate_status <> 'accepted_as_draft'
           OR (candidate.subject_candidate_id IS NOT NULL AND subject.candidate_status <> 'accepted_as_draft')
           OR (candidate.indication_candidate_id IS NOT NULL AND indication.candidate_status <> 'accepted_as_draft')
         )
    )) OR (_candidate_kind = 'safety' AND EXISTS (
      SELECT 1
        FROM public.kb_safety_candidates candidate
        JOIN public.kb_source_candidates source ON source.id = candidate.source_candidate_id
        LEFT JOIN public.kb_entity_candidates subject ON subject.id = candidate.subject_candidate_id
        LEFT JOIN public.kb_entity_candidates related ON related.id = candidate.related_candidate_id
       WHERE candidate.id = _candidate_id
         AND (
           source.candidate_status <> 'accepted_as_draft'
           OR (candidate.subject_candidate_id IS NOT NULL AND subject.candidate_status <> 'accepted_as_draft')
           OR (candidate.related_candidate_id IS NOT NULL AND related.candidate_status <> 'accepted_as_draft')
         )
    )) THEN
      RAISE EXCEPTION 'Candidate sources and candidate entities must be accepted first';
    END IF;
  END IF;

  INSERT INTO public.kb_review_decisions (
    candidate_kind,
    candidate_id,
    decision,
    status_before,
    status_after,
    decision_notes,
    decided_by
  ) VALUES (
    _candidate_kind,
    _candidate_id,
    _decision,
    current_status,
    next_status,
    COALESCE(_decision_notes, ''),
    reviewer_id
  ) RETURNING id INTO decision_id;

  EXECUTE format(
    'UPDATE public.%I SET candidate_status = $1, reviewed_at = now(), reviewed_by = $2 WHERE id = $3',
    candidate_table
  ) USING next_status, reviewer_id, _candidate_id;

  RETURN decision_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_complete_import_batch_review(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reviewer_id uuid := auth.uid();
  current_status text;
  unresolved_count integer;
  total_candidates integer;
  total_errors integer;
BEGIN
  IF reviewer_id IS NULL OR NOT public.has_role(reviewer_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators may complete import reviews';
  END IF;

  SELECT batch_status
    INTO current_status
    FROM public.kb_import_batches
   WHERE id = _batch_id
   FOR UPDATE;
  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Import batch not found';
  END IF;
  IF current_status <> 'ready_for_review' THEN
    RAISE EXCEPTION 'Import batch must be ready_for_review';
  END IF;

  SELECT count(*)::int,
         count(*) FILTER (WHERE candidate_status NOT IN ('accepted_as_draft', 'rejected', 'duplicate'))::int
    INTO total_candidates, unresolved_count
    FROM (
      SELECT candidate_status FROM public.kb_source_candidates WHERE batch_id = _batch_id
      UNION ALL
      SELECT candidate_status FROM public.kb_entity_candidates WHERE batch_id = _batch_id
      UNION ALL
      SELECT candidate_status FROM public.kb_relation_candidates WHERE batch_id = _batch_id
      UNION ALL
      SELECT candidate_status FROM public.kb_dosage_candidates WHERE batch_id = _batch_id
      UNION ALL
      SELECT candidate_status FROM public.kb_safety_candidates WHERE batch_id = _batch_id
    ) candidates;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'Every import candidate requires a terminal review decision';
  END IF;
  SELECT count(*)::int INTO total_errors FROM public.kb_import_errors WHERE batch_id = _batch_id;

  UPDATE public.kb_import_batches
     SET batch_status = 'reviewed',
         candidate_count = total_candidates,
         error_count = total_errors,
         completed_at = now()
   WHERE id = _batch_id;
END;
$$;

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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', staging_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role))',
      staging_table || '_admin_read',
      staging_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO kb_importer USING (true)',
      staging_table || '_importer_read',
      staging_table
    );
  END LOOP;
END;
$$;

CREATE POLICY kb_import_batches_importer_insert
  ON public.kb_import_batches FOR INSERT TO kb_importer
  WITH CHECK (data_classification = 'general_knowledge' AND batch_status = 'created');
CREATE POLICY kb_import_batches_importer_update
  ON public.kb_import_batches FOR UPDATE TO kb_importer
  USING (true) WITH CHECK (data_classification = 'general_knowledge');

DO $$
DECLARE
  candidate_table text;
BEGIN
  FOREACH candidate_table IN ARRAY ARRAY[
    'kb_source_candidates',
    'kb_entity_candidates',
    'kb_relation_candidates',
    'kb_dosage_candidates',
    'kb_safety_candidates'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO kb_importer WITH CHECK (data_classification = ''general_knowledge'' AND candidate_status = ''imported_unreviewed'')',
      candidate_table || '_importer_insert',
      candidate_table
    );
  END LOOP;
END;
$$;

CREATE POLICY kb_import_errors_importer_insert
  ON public.kb_import_errors FOR INSERT TO kb_importer
  WITH CHECK (data_classification = 'general_knowledge');

REVOKE ALL ON TABLE
  public.kb_import_batches,
  public.kb_source_candidates,
  public.kb_entity_candidates,
  public.kb_relation_candidates,
  public.kb_dosage_candidates,
  public.kb_safety_candidates,
  public.kb_review_decisions,
  public.kb_import_errors
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.kb_import_batches,
  public.kb_source_candidates,
  public.kb_entity_candidates,
  public.kb_relation_candidates,
  public.kb_dosage_candidates,
  public.kb_safety_candidates,
  public.kb_review_decisions,
  public.kb_import_errors
TO authenticated;

REVOKE ALL ON TABLE
  public.kb_import_batches,
  public.kb_source_candidates,
  public.kb_entity_candidates,
  public.kb_relation_candidates,
  public.kb_dosage_candidates,
  public.kb_safety_candidates,
  public.kb_review_decisions,
  public.kb_import_errors
FROM service_role, kb_importer;

GRANT USAGE ON SCHEMA public TO kb_importer;

GRANT SELECT ON TABLE
  public.kb_import_batches,
  public.kb_source_candidates,
  public.kb_entity_candidates,
  public.kb_relation_candidates,
  public.kb_dosage_candidates,
  public.kb_safety_candidates,
  public.kb_review_decisions,
  public.kb_import_errors
TO service_role, kb_importer;

GRANT INSERT, UPDATE ON TABLE public.kb_import_batches TO kb_importer;
GRANT INSERT ON TABLE
  public.kb_source_candidates,
  public.kb_entity_candidates,
  public.kb_relation_candidates,
  public.kb_dosage_candidates,
  public.kb_safety_candidates,
  public.kb_import_errors
TO kb_importer;

REVOKE ALL ON TABLE
  public.kb_entity_types,
  public.kb_identifier_schemes,
  public.kb_relation_types,
  public.kb_relation_type_domains,
  public.kb_entities,
  public.kb_entity_revisions,
  public.kb_entity_names,
  public.kb_entity_identifiers,
  public.kb_sources,
  public.kb_source_revisions,
  public.kb_assertions,
  public.kb_entity_relations,
  public.kb_assertion_sources,
  public.kb_articles,
  public.kb_article_revisions,
  public.kb_article_entities,
  public.kb_change_proposals
FROM service_role;

GRANT SELECT ON TABLE
  public.kb_entity_types,
  public.kb_identifier_schemes,
  public.kb_relation_types,
  public.kb_relation_type_domains,
  public.kb_entities,
  public.kb_entity_revisions,
  public.kb_entity_names,
  public.kb_entity_identifiers,
  public.kb_sources,
  public.kb_source_revisions,
  public.kb_assertions,
  public.kb_entity_relations,
  public.kb_assertion_sources,
  public.kb_articles,
  public.kb_article_revisions,
  public.kb_article_entities,
  public.kb_change_proposals
TO service_role;

REVOKE ALL ON FUNCTION public.kb_enforce_import_candidate_workflow()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_require_open_import_batch()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_enforce_import_batch_workflow()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_protect_import_audit_row()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_record_import_review_decision(text, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_record_import_review_decision(text, uuid, text, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.kb_complete_import_batch_review(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_complete_import_batch_review(uuid)
  TO authenticated;

COMMIT;
