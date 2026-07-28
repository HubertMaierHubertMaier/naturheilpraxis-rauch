BEGIN;

CREATE TABLE public.kb_entity_types (
  code text PRIMARY KEY
    CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kb_identifier_schemes (
  code text PRIMARY KEY
    CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_globally_unique boolean NOT NULL,
  value_pattern text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kb_relation_types (
  code text PRIMARY KEY
    CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_symmetric boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kb_relation_type_domains (
  relation_type_code text NOT NULL
    REFERENCES public.kb_relation_types(code) ON DELETE RESTRICT,
  subject_entity_type_code text NOT NULL
    REFERENCES public.kb_entity_types(code) ON DELETE RESTRICT,
  object_entity_type_code text NOT NULL
    REFERENCES public.kb_entity_types(code) ON DELETE RESTRICT,
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'approved')),
  PRIMARY KEY (
    relation_type_code,
    subject_entity_type_code,
    object_entity_type_code
  )
);

CREATE TABLE public.kb_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type_code text NOT NULL
    REFERENCES public.kb_entity_types(code) ON DELETE RESTRICT,
  canonical_key text NOT NULL UNIQUE
    CHECK (canonical_key ~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'),
  lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active', 'deprecated', 'withdrawn')),
  current_revision_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kb_entity_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL
    REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  summary text NOT NULL DEFAULT '',
  description_markdown text NOT NULL DEFAULT '',
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (
      review_status IN (
        'draft',
        'domain_review',
        'safety_review',
        'approved',
        'released',
        'superseded',
        'withdrawn'
      )
    ),
  origin_type text NOT NULL DEFAULT 'human'
    CHECK (origin_type IN ('human', 'legacy_snapshot', 'import', 'parser', 'ai')),
  content_hash text NOT NULL
    CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  released_at timestamptz,
  review_due_at timestamptz,
  UNIQUE (entity_id, revision_no),
  UNIQUE (entity_id, id),
  CHECK (
    review_status NOT IN ('approved', 'released')
    OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  ),
  CHECK (review_status <> 'released' OR released_at IS NOT NULL)
);

ALTER TABLE public.kb_entities
  ADD CONSTRAINT kb_entities_current_revision_fk
  FOREIGN KEY (id, current_revision_id)
  REFERENCES public.kb_entity_revisions(entity_id, id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.kb_entity_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL
    REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name) <> ''),
  normalized_name text NOT NULL CHECK (btrim(normalized_name) <> ''),
  name_kind text NOT NULL
    CHECK (
      name_kind IN (
        'preferred',
        'abbreviation',
        'scientific',
        'trade',
        'historical',
        'spelling_variant'
      )
    ),
  language_code text NOT NULL DEFAULT 'de'
    CHECK (language_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  is_preferred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  retired_at timestamptz,
  UNIQUE (entity_id, normalized_name, name_kind, language_code)
);

CREATE UNIQUE INDEX kb_entity_names_one_preferred_idx
  ON public.kb_entity_names(entity_id, language_code)
  WHERE is_preferred AND retired_at IS NULL;

CREATE TABLE public.kb_entity_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL
    REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  scheme_code text NOT NULL
    REFERENCES public.kb_identifier_schemes(code) ON DELETE RESTRICT,
  namespace text,
  value text NOT NULL CHECK (btrim(value) <> ''),
  normalized_value text NOT NULL CHECK (btrim(normalized_value) <> ''),
  is_primary boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  UNIQUE NULLS NOT DISTINCT (scheme_code, namespace, normalized_value),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE public.kb_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key text NOT NULL UNIQUE
    CHECK (canonical_key ~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'),
  lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active', 'deprecated', 'withdrawn')),
  current_revision_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kb_source_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL
    REFERENCES public.kb_sources(id) ON DELETE RESTRICT,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  source_type text NOT NULL
    CHECK (
      source_type IN (
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
      )
    ),
  title text NOT NULL CHECK (btrim(title) <> ''),
  authors text[] NOT NULL DEFAULT '{}',
  publisher text,
  edition text,
  published_on date,
  url text,
  doi text,
  pmid text,
  isbn text,
  retrieved_on date,
  file_sha256 text
    CHECK (file_sha256 IS NULL OR file_sha256 ~ '^[0-9a-f]{64}$'),
  rights_status text NOT NULL DEFAULT 'unknown'
    CHECK (
      rights_status IN (
        'unknown',
        'own_content',
        'licensed',
        'quoted',
        'public_domain'
      )
    ),
  archive_location text,
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (
      review_status IN (
        'draft',
        'domain_review',
        'approved',
        'released',
        'superseded',
        'withdrawn'
      )
    ),
  content_hash text NOT NULL
    CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  released_at timestamptz,
  review_due_at timestamptz,
  UNIQUE (source_id, revision_no),
  UNIQUE (source_id, id),
  CHECK (
    review_status NOT IN ('approved', 'released')
    OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  ),
  CHECK (review_status <> 'released' OR released_at IS NOT NULL)
);

ALTER TABLE public.kb_sources
  ADD CONSTRAINT kb_sources_current_revision_fk
  FOREIGN KEY (id, current_revision_id)
  REFERENCES public.kb_source_revisions(source_id, id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.kb_assertions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key text NOT NULL
    CHECK (canonical_key ~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'),
  version_no integer NOT NULL CHECK (version_no > 0),
  assertion_kind text NOT NULL
    CHECK (
      assertion_kind IN (
        'entity_relation',
        'classification',
        'narrative',
        'dosage',
        'safety'
      )
    ),
  claim_text text NOT NULL CHECK (btrim(claim_text) <> ''),
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (
      review_status IN (
        'draft',
        'domain_review',
        'safety_review',
        'approved',
        'released',
        'superseded',
        'withdrawn'
      )
    ),
  origin_type text NOT NULL DEFAULT 'human'
    CHECK (origin_type IN ('human', 'import', 'parser', 'ai')),
  evidence_basis text NOT NULL DEFAULT 'unrated'
    CHECK (
      evidence_basis IN (
        'unrated',
        'manufacturer_statement',
        'traditional_use',
        'experiential_medicine',
        'practice_rule',
        'mechanistic',
        'observational_study',
        'clinical_study',
        'systematic_review',
        'guideline'
      )
    ),
  evidence_quality text NOT NULL DEFAULT 'unrated'
    CHECK (evidence_quality IN ('unrated', 'very_low', 'low', 'moderate', 'high')),
  valid_from date,
  valid_until date,
  supersedes_assertion_id uuid
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  content_hash text NOT NULL
    CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  released_at timestamptz,
  review_due_at timestamptz,
  UNIQUE (canonical_key, version_no),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
  CHECK (
    review_status NOT IN ('approved', 'released')
    OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  ),
  CHECK (review_status <> 'released' OR released_at IS NOT NULL)
);

CREATE TABLE public.kb_entity_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assertion_id uuid NOT NULL UNIQUE
    REFERENCES public.kb_assertions(id) ON DELETE CASCADE,
  subject_entity_id uuid NOT NULL
    REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  relation_type_code text NOT NULL
    REFERENCES public.kb_relation_types(code) ON DELETE RESTRICT,
  object_entity_id uuid NOT NULL
    REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  assignment_strength text NOT NULL DEFAULT 'direct'
    CHECK (
      assignment_strength IN (
        'direct',
        'indirect',
        'possible',
        'contextual',
        'not_recommended'
      )
    ),
  rank smallint NOT NULL DEFAULT 50 CHECK (rank BETWEEN 0 AND 100),
  context_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CHECK (subject_entity_id <> object_entity_id)
);

CREATE TABLE public.kb_assertion_sources (
  assertion_id uuid NOT NULL
    REFERENCES public.kb_assertions(id) ON DELETE CASCADE,
  source_revision_id uuid NOT NULL
    REFERENCES public.kb_source_revisions(id) ON DELETE RESTRICT,
  source_role text NOT NULL
    CHECK (source_role IN ('supports', 'refutes', 'qualifies', 'mentions')),
  locator text NOT NULL DEFAULT '',
  original_quote text NOT NULL DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (assertion_id, source_revision_id, source_role, locator)
);

CREATE INDEX kb_assertion_sources_primary_idx
  ON public.kb_assertion_sources(assertion_id)
  WHERE is_primary;

CREATE TABLE public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key text NOT NULL UNIQUE
    CHECK (canonical_key ~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'),
  article_kind text NOT NULL DEFAULT 'reference'
    CHECK (
      article_kind IN (
        'reference',
        'remedy',
        'protocol',
        'diagnostic',
        'product',
        'equipment'
      )
    ),
  lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active', 'deprecated', 'withdrawn')),
  current_revision_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kb_article_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL
    REFERENCES public.kb_articles(id) ON DELETE RESTRICT,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  title text NOT NULL CHECK (btrim(title) <> ''),
  category_path text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  content_markdown text NOT NULL DEFAULT '',
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (
      review_status IN (
        'draft',
        'domain_review',
        'safety_review',
        'approved',
        'released',
        'superseded',
        'withdrawn'
      )
    ),
  origin_type text NOT NULL DEFAULT 'human'
    CHECK (origin_type IN ('human', 'legacy_snapshot', 'import', 'parser', 'ai')),
  content_hash text NOT NULL
    CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  released_at timestamptz,
  review_due_at timestamptz,
  UNIQUE (article_id, revision_no),
  UNIQUE (article_id, id),
  CHECK (
    review_status NOT IN ('approved', 'released')
    OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  ),
  CHECK (review_status <> 'released' OR released_at IS NOT NULL)
);

ALTER TABLE public.kb_articles
  ADD CONSTRAINT kb_articles_current_revision_fk
  FOREIGN KEY (id, current_revision_id)
  REFERENCES public.kb_article_revisions(article_id, id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.kb_article_entities (
  article_revision_id uuid NOT NULL
    REFERENCES public.kb_article_revisions(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL
    REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  role text NOT NULL
    CHECK (role IN ('about', 'mentions', 'recommends', 'warns_about', 'source_for')),
  rank smallint NOT NULL DEFAULT 50 CHECK (rank BETWEEN 0 AND 100),
  context_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (article_revision_id, entity_id, role)
);

CREATE TABLE public.kb_change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_kind text NOT NULL
    CHECK (
      proposal_kind IN (
        'entity',
        'entity_revision',
        'entity_name',
        'entity_identifier',
        'source',
        'source_revision',
        'assertion',
        'entity_relation',
        'article',
        'article_revision'
      )
    ),
  operation text NOT NULL
    CHECK (operation IN ('create', 'update', 'retire')),
  target_id uuid,
  proposal jsonb NOT NULL
    CHECK (jsonb_typeof(proposal) = 'object'),
  origin_type text NOT NULL
    CHECK (origin_type IN ('human', 'import', 'parser', 'ai')),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'in_review', 'accepted', 'rejected', 'withdrawn')),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid DEFAULT auth.uid(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (operation = 'create' OR target_id IS NOT NULL),
  CHECK (
    status NOT IN ('accepted', 'rejected')
    OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  )
);

CREATE OR REPLACE FUNCTION public.kb_prevent_stable_value_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF (to_jsonb(NEW) ->> TG_ARGV[0])
       IS DISTINCT FROM
     (to_jsonb(OLD) ->> TG_ARGV[0])
  THEN
    RAISE EXCEPTION '% is immutable on %.%', TG_ARGV[0], TG_TABLE_SCHEMA, TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_entity_types_code_immutable
  BEFORE UPDATE ON public.kb_entity_types
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('code');

CREATE TRIGGER kb_entities_key_immutable
  BEFORE UPDATE ON public.kb_entities
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('canonical_key');

CREATE TRIGGER kb_entities_type_immutable
  BEFORE UPDATE ON public.kb_entities
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('entity_type_code');

CREATE TRIGGER kb_identifier_schemes_code_immutable
  BEFORE UPDATE ON public.kb_identifier_schemes
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('code');

CREATE TRIGGER kb_identifier_schemes_global_scope_immutable
  BEFORE UPDATE ON public.kb_identifier_schemes
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('is_globally_unique');

CREATE TRIGGER kb_identifier_schemes_pattern_immutable
  BEFORE UPDATE ON public.kb_identifier_schemes
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('value_pattern');

CREATE TRIGGER kb_relation_types_code_immutable
  BEFORE UPDATE ON public.kb_relation_types
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('code');

CREATE TRIGGER kb_relation_types_symmetry_immutable
  BEFORE UPDATE ON public.kb_relation_types
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('is_symmetric');

CREATE TRIGGER kb_sources_key_immutable
  BEFORE UPDATE ON public.kb_sources
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('canonical_key');

CREATE TRIGGER kb_assertions_key_immutable
  BEFORE UPDATE ON public.kb_assertions
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('canonical_key');

CREATE TRIGGER kb_assertions_kind_immutable
  BEFORE UPDATE ON public.kb_assertions
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('assertion_kind');

CREATE TRIGGER kb_articles_key_immutable
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.kb_prevent_stable_value_change('canonical_key');

CREATE OR REPLACE FUNCTION public.kb_validate_identifier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  identifier_scheme public.kb_identifier_schemes%ROWTYPE;
BEGIN
  SELECT *
    INTO STRICT identifier_scheme
    FROM public.kb_identifier_schemes
   WHERE code = NEW.scheme_code;

  IF identifier_scheme.is_globally_unique AND NEW.namespace IS NOT NULL THEN
    RAISE EXCEPTION 'Globally unique identifier scheme % must not use a namespace', NEW.scheme_code;
  END IF;

  IF NOT identifier_scheme.is_globally_unique AND NULLIF(btrim(NEW.namespace), '') IS NULL THEN
    RAISE EXCEPTION 'Identifier scheme % requires a namespace', NEW.scheme_code;
  END IF;

  IF identifier_scheme.value_pattern IS NOT NULL
     AND NEW.normalized_value !~ identifier_scheme.value_pattern
  THEN
    RAISE EXCEPTION 'Identifier does not match the pattern for scheme %', NEW.scheme_code;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_entity_identifiers_validate
  BEFORE INSERT OR UPDATE ON public.kb_entity_identifiers
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_identifier();

CREATE OR REPLACE FUNCTION public.kb_enforce_review_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  allows_safety_review boolean := TG_ARGV[0]::boolean;
  old_status text;
  new_status text := NEW.review_status;
  required_approval_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF new_status <> 'draft' THEN
      RAISE EXCEPTION 'Knowledge revisions must be inserted as draft';
    END IF;
    RETURN NEW;
  END IF;

  old_status := OLD.review_status;

  IF old_status = 'approved' THEN
    IF new_status = 'approved' THEN
      IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
        RAISE EXCEPTION 'Approved knowledge revisions are immutable';
      END IF;
    ELSIF new_status = 'draft' THEN
      IF NEW.reviewed_at IS NOT NULL
         OR NEW.reviewed_by IS NOT NULL
         OR NEW.released_at IS NOT NULL
         OR NEW.review_due_at IS NOT NULL
         OR (to_jsonb(NEW) - 'review_status' - 'reviewed_at' - 'reviewed_by' - 'released_at' - 'review_due_at')
            IS DISTINCT FROM
            (to_jsonb(OLD) - 'review_status' - 'reviewed_at' - 'reviewed_by' - 'released_at' - 'review_due_at')
      THEN
        RAISE EXCEPTION 'Resetting an approved revision must only clear review metadata';
      END IF;
    ELSIF new_status = 'released' THEN
      IF (to_jsonb(NEW) - 'review_status' - 'released_at')
           IS DISTINCT FROM
         (to_jsonb(OLD) - 'review_status' - 'released_at')
      THEN
        RAISE EXCEPTION 'Release may only set review_status and released_at';
      END IF;
    ELSE
      RAISE EXCEPTION 'Approved revisions may only transition to draft or released';
    END IF;
    RETURN NEW;
  END IF;

  IF old_status = 'released' THEN
    IF new_status NOT IN ('superseded', 'withdrawn') THEN
      RAISE EXCEPTION 'Released revisions may only become superseded or withdrawn';
    END IF;
    RETURN NEW;
  END IF;

  IF old_status IN ('superseded', 'withdrawn') THEN
    RAISE EXCEPTION 'Historical knowledge revisions cannot transition';
  END IF;

  IF new_status IN ('released', 'superseded', 'withdrawn') THEN
    RAISE EXCEPTION 'Release requires a separate approved to released transition';
  END IF;

  IF new_status = 'approved' THEN
    required_approval_status := CASE
      WHEN allows_safety_review THEN 'safety_review'
      ELSE 'domain_review'
    END;

    IF old_status <> required_approval_status
       OR NEW.released_at IS NOT NULL
       OR (to_jsonb(NEW) - 'review_status' - 'reviewed_at' - 'reviewed_by' - 'review_due_at')
          IS DISTINCT FROM
          (to_jsonb(OLD) - 'review_status' - 'reviewed_at' - 'reviewed_by' - 'review_due_at')
    THEN
      RAISE EXCEPTION
        'Approval requires % -> approved and may only set review metadata',
        required_approval_status;
    END IF;
    RETURN NEW;
  END IF;

  IF old_status = 'draft' AND new_status NOT IN ('draft', 'domain_review') THEN
    RAISE EXCEPTION 'Draft revisions must enter domain review before approval';
  ELSIF old_status = 'domain_review'
        AND new_status NOT IN ('draft', 'domain_review', 'safety_review')
  THEN
    RAISE EXCEPTION 'Invalid domain-review transition';
  ELSIF old_status = 'domain_review'
        AND new_status = 'safety_review'
        AND NOT allows_safety_review
  THEN
    RAISE EXCEPTION 'Source revisions do not use safety review';
  ELSIF old_status = 'safety_review'
        AND (
          NOT allows_safety_review
          OR new_status NOT IN ('draft', 'domain_review', 'safety_review')
        )
  THEN
    RAISE EXCEPTION 'Invalid safety-review transition';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_lock_source_assertions_after_status_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  locked_assertion_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM kb_old_source_revisions old_source
      JOIN kb_new_source_revisions new_source USING (id)
     WHERE old_source.review_status IS DISTINCT FROM new_source.review_status
  ) THEN
    RETURN NULL;
  END IF;

  FOR locked_assertion_id IN
    WITH changed_source_revisions AS (
      SELECT old_source.id
        FROM kb_old_source_revisions old_source
        JOIN kb_new_source_revisions new_source USING (id)
       WHERE old_source.review_status IS DISTINCT FROM new_source.review_status
    )
    SELECT assertion.id
      FROM public.kb_assertions assertion
     WHERE EXISTS (
         SELECT 1
           FROM public.kb_assertion_sources assertion_source
           JOIN changed_source_revisions changed_source
             ON changed_source.id = assertion_source.source_revision_id
          WHERE assertion_source.assertion_id = assertion.id
       )
     ORDER BY assertion.id
     FOR UPDATE OF assertion
  LOOP
    NULL;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE TRIGGER kb_entity_revisions_review_workflow
  BEFORE INSERT OR UPDATE ON public.kb_entity_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_enforce_review_workflow('true');

CREATE TRIGGER kb_source_revisions_review_workflow
  BEFORE INSERT OR UPDATE ON public.kb_source_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_enforce_review_workflow('false');

CREATE TRIGGER kb_source_revisions_lock_affected_assertions
  AFTER UPDATE ON public.kb_source_revisions
  REFERENCING
    OLD TABLE AS kb_old_source_revisions
    NEW TABLE AS kb_new_source_revisions
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.kb_lock_source_assertions_after_status_changes();

CREATE TRIGGER kb_assertions_review_workflow
  BEFORE INSERT OR UPDATE ON public.kb_assertions
  FOR EACH ROW EXECUTE FUNCTION public.kb_enforce_review_workflow('true');

CREATE TRIGGER kb_article_revisions_review_workflow
  BEFORE INSERT OR UPDATE ON public.kb_article_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_enforce_review_workflow('true');

CREATE OR REPLACE FUNCTION public.kb_protect_reviewed_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.review_status IN ('approved', 'released', 'superseded', 'withdrawn') THEN
      RAISE EXCEPTION 'Approved, released or historical knowledge revisions cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.review_status = 'released' THEN
    IF NEW.review_status NOT IN ('superseded', 'withdrawn')
       OR (to_jsonb(NEW) - 'review_status')
          IS DISTINCT FROM
          (to_jsonb(OLD) - 'review_status')
    THEN
      RAISE EXCEPTION 'Released knowledge revisions are immutable';
    END IF;
  ELSIF OLD.review_status IN ('superseded', 'withdrawn') THEN
    RAISE EXCEPTION 'Historical knowledge revisions are immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_entity_revisions_protect
  BEFORE UPDATE OR DELETE ON public.kb_entity_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_reviewed_record();

CREATE TRIGGER kb_source_revisions_protect
  BEFORE UPDATE OR DELETE ON public.kb_source_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_reviewed_record();

CREATE TRIGGER kb_assertions_protect
  BEFORE UPDATE OR DELETE ON public.kb_assertions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_reviewed_record();

CREATE TRIGGER kb_article_revisions_protect
  BEFORE UPDATE OR DELETE ON public.kb_article_revisions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_reviewed_record();

CREATE OR REPLACE FUNCTION public.kb_validate_assertion_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  previous_key text;
  previous_version integer;
BEGIN
  IF NEW.supersedes_assertion_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT canonical_key, version_no
    INTO STRICT previous_key, previous_version
    FROM public.kb_assertions
   WHERE id = NEW.supersedes_assertion_id;

  IF previous_key <> NEW.canonical_key OR previous_version >= NEW.version_no THEN
    RAISE EXCEPTION 'Superseded assertions must use the same key and a lower version';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_assertions_validate_version
  BEFORE INSERT OR UPDATE ON public.kb_assertions
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_assertion_version();

CREATE OR REPLACE FUNCTION public.kb_validate_entity_relation_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  subject_type text;
  object_type text;
  symmetric_relation boolean;
  relation_active boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.kb_assertions
     WHERE id = NEW.assertion_id
       AND assertion_kind = 'entity_relation'
  ) THEN
    RAISE EXCEPTION 'Entity relations require an entity_relation assertion';
  END IF;

  SELECT entity_type_code
    INTO STRICT subject_type
    FROM public.kb_entities
   WHERE id = NEW.subject_entity_id;

  SELECT entity_type_code
    INTO STRICT object_type
    FROM public.kb_entities
   WHERE id = NEW.object_entity_id;

  SELECT is_symmetric, is_active
    INTO STRICT symmetric_relation, relation_active
    FROM public.kb_relation_types
   WHERE code = NEW.relation_type_code;

  IF NOT relation_active THEN
    RAISE EXCEPTION 'Relation type % is inactive', NEW.relation_type_code;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.kb_relation_type_domains
     WHERE relation_type_code = NEW.relation_type_code
       AND subject_entity_type_code = subject_type
       AND object_entity_type_code = object_type
       AND review_status = 'approved'
  ) THEN
    RAISE EXCEPTION
      'Relation % does not allow domain % -> %',
      NEW.relation_type_code,
      subject_type,
      object_type;
  END IF;

  IF symmetric_relation
     AND NEW.subject_entity_id::text > NEW.object_entity_id::text
  THEN
    RAISE EXCEPTION 'Symmetric relations must use canonical UUID ordering';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_entity_relations_validate_domain
  BEFORE INSERT OR UPDATE ON public.kb_entity_relations
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_entity_relation_domain();

CREATE OR REPLACE FUNCTION public.kb_protect_used_relation_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_relations relation
      JOIN public.kb_entities subject
        ON subject.id = relation.subject_entity_id
      JOIN public.kb_entities object_entity
        ON object_entity.id = relation.object_entity_id
     WHERE relation.relation_type_code = OLD.relation_type_code
       AND subject.entity_type_code = OLD.subject_entity_type_code
       AND object_entity.entity_type_code = OLD.object_entity_type_code
  ) THEN
    RAISE EXCEPTION 'A relation domain already used by assertions cannot be changed';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_relation_type_domains_protect
  BEFORE UPDATE OR DELETE ON public.kb_relation_type_domains
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_used_relation_domain();

CREATE OR REPLACE FUNCTION public.kb_enforce_relation_domain_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.review_status <> 'draft' THEN
      RAISE EXCEPTION 'Relation domains must be inserted as draft';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.review_status = 'approved' THEN
      RAISE EXCEPTION 'Approved relation domains are immutable and cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.review_status = 'approved' THEN
    RAISE EXCEPTION 'Approved relation domains are immutable';
  END IF;

  IF NEW.review_status = 'approved' THEN
    IF NEW.relation_type_code IS DISTINCT FROM OLD.relation_type_code
       OR NEW.subject_entity_type_code IS DISTINCT FROM OLD.subject_entity_type_code
       OR NEW.object_entity_type_code IS DISTINCT FROM OLD.object_entity_type_code
    THEN
      RAISE EXCEPTION 'Relation domain approval cannot change domain keys';
    END IF;
  ELSIF NEW.review_status <> 'draft' THEN
    RAISE EXCEPTION 'Invalid relation domain review status';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_validate_active_relation_type_domains()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  old_relation_code text;
  new_relation_code text;
  affected_relation_code text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_relation_code := COALESCE(
      to_jsonb(OLD) ->> 'code',
      to_jsonb(OLD) ->> 'relation_type_code'
    );
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_relation_code := COALESCE(
      to_jsonb(NEW) ->> 'code',
      to_jsonb(NEW) ->> 'relation_type_code'
    );
  END IF;

  FOR affected_relation_code IN
    SELECT DISTINCT relation_code
      FROM unnest(ARRAY[old_relation_code, new_relation_code]) AS codes(relation_code)
     WHERE relation_code IS NOT NULL
     ORDER BY relation_code
  LOOP
    IF EXISTS (
      SELECT 1
        FROM public.kb_relation_types
       WHERE code = affected_relation_code
         AND is_active
    ) AND NOT EXISTS (
      SELECT 1
        FROM public.kb_relation_type_domains
       WHERE relation_type_code = affected_relation_code
         AND review_status = 'approved'
    ) THEN
      RAISE EXCEPTION
        'Active relation type % requires at least one approved domain',
        affected_relation_code;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_validate_assertion_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_assertion public.kb_assertions%ROWTYPE;
BEGIN
  SELECT *
    INTO current_assertion
    FROM public.kb_assertions
   WHERE id = NEW.id;

  IF NOT FOUND OR current_assertion.review_status <> 'released' THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.kb_assertion_sources assertion_source
      JOIN public.kb_source_revisions source_revision
        ON source_revision.id = assertion_source.source_revision_id
     WHERE assertion_source.assertion_id = current_assertion.id
       AND assertion_source.is_primary
       AND assertion_source.source_role IN ('supports', 'qualifies')
       AND source_revision.review_status = 'released'
  ) THEN
    RAISE EXCEPTION 'Released assertions require a primary released supporting source revision';
  END IF;

  IF current_assertion.assertion_kind = 'entity_relation'
     AND NOT EXISTS (
       SELECT 1
         FROM public.kb_entity_relations
        WHERE assertion_id = current_assertion.id
     )
  THEN
    RAISE EXCEPTION 'Released entity-relation assertions require a graph edge';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER kb_assertions_validate_release
  AFTER INSERT OR UPDATE ON public.kb_assertions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_assertion_release();

CREATE OR REPLACE FUNCTION public.kb_preserve_released_assertion_sources()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.review_status <> 'released'
     OR NEW.review_status NOT IN ('superseded', 'withdrawn')
  THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_assertion_sources affected_source
      JOIN public.kb_assertions assertion
        ON assertion.id = affected_source.assertion_id
     WHERE affected_source.source_revision_id = NEW.id
       AND affected_source.is_primary
       AND affected_source.source_role IN ('supports', 'qualifies')
       AND assertion.review_status = 'released'
       AND NOT EXISTS (
         SELECT 1
           FROM public.kb_assertion_sources replacement_source
           JOIN public.kb_source_revisions replacement_revision
             ON replacement_revision.id = replacement_source.source_revision_id
          WHERE replacement_source.assertion_id = assertion.id
            AND replacement_source.source_revision_id <> NEW.id
            AND replacement_source.is_primary
            AND replacement_source.source_role IN ('supports', 'qualifies')
            AND replacement_revision.review_status = 'released'
       )
  ) THEN
    RAISE EXCEPTION 'A released assertion would lose its last released primary source';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER kb_source_revisions_preserve_released_assertions
  AFTER UPDATE ON public.kb_source_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_preserve_released_assertion_sources();

CREATE OR REPLACE FUNCTION public.kb_protect_assertion_dependency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  old_assertion_id uuid;
  new_assertion_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_assertion_id := OLD.assertion_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_assertion_id := NEW.assertion_id;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_assertions
     WHERE id IN (old_assertion_id, new_assertion_id)
       AND review_status IN ('approved', 'released', 'superseded', 'withdrawn')
  ) THEN
    RAISE EXCEPTION 'Dependencies of approved, released or historical assertions are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_entity_relations_protect_assertion
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_entity_relations
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_assertion_dependency();

CREATE TRIGGER kb_assertion_sources_protect_assertion
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_assertion_sources
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_assertion_dependency();

CREATE OR REPLACE FUNCTION public.kb_protect_article_entity_dependency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  old_revision_id uuid;
  new_revision_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_revision_id := OLD.article_revision_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_revision_id := NEW.article_revision_id;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_article_revisions
     WHERE id IN (old_revision_id, new_revision_id)
       AND review_status IN ('approved', 'released', 'superseded', 'withdrawn')
  ) THEN
    RAISE EXCEPTION 'Dependencies of approved, released or historical article revisions are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_article_entities_protect_revision
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_article_entities
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_article_entity_dependency();

CREATE TRIGGER kb_entities_updated_at
  BEFORE UPDATE ON public.kb_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER kb_sources_updated_at
  BEFORE UPDATE ON public.kb_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER kb_articles_updated_at
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER kb_change_proposals_updated_at
  BEFORE UPDATE ON public.kb_change_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.kb_entity_types (code, label) VALUES
  ('manufacturer', 'Manufacturer'),
  ('pharmacy', 'Pharmacy'),
  ('laboratory', 'Laboratory'),
  ('publisher', 'Publisher'),
  ('product', 'Product'),
  ('product_variant', 'Product variant'),
  ('substance', 'Substance'),
  ('plant', 'Plant'),
  ('nutrient', 'Nutrient'),
  ('symptom', 'Symptom'),
  ('disease', 'Disease'),
  ('cause', 'Cause'),
  ('pathogen', 'Pathogen'),
  ('organ', 'Organ'),
  ('tissue', 'Tissue'),
  ('lab_parameter', 'Laboratory parameter'),
  ('lab_finding_definition', 'Laboratory finding definition'),
  ('diagnostic_method', 'Diagnostic method'),
  ('therapy_method', 'Therapy method'),
  ('device', 'Device'),
  ('program', 'Program'),
  ('protocol', 'Protocol'),
  ('population_group', 'Population group');

INSERT INTO public.kb_identifier_schemes (
  code,
  label,
  is_globally_unique,
  value_pattern
) VALUES
  ('pzn', 'PZN', true, '^[0-9]{8}$'),
  ('gtin', 'GTIN', true, '^[0-9]{8,14}$'),
  ('manufacturer_sku', 'Manufacturer SKU', false, NULL),
  ('loinc', 'LOINC', true, '^[0-9]+-[0-9]$'),
  ('icd_10_gm', 'ICD-10-GM', true, NULL),
  ('atc', 'ATC', true, NULL),
  ('ncbi_taxonomy', 'NCBI Taxonomy', true, '^[0-9]+$'),
  ('program_code', 'Program code', false, NULL);

INSERT INTO public.kb_relation_types (code, label, is_symmetric, is_active) VALUES
  ('manufactured_by', 'Manufactured by', false, true),
  ('contains', 'Contains', false, true),
  ('targets_pathogen', 'Targets pathogen', false, true),
  ('indicated_for', 'Indicated for', false, true),
  ('may_support', 'May support', false, true),
  ('may_be_associated_with', 'May be associated with', false, false),
  ('manifests_as', 'Manifests as', false, true),
  ('affects_organ', 'Affects organ or tissue', false, true),
  ('measured_by', 'Measured by', false, true),
  ('may_indicate', 'May indicate', false, true),
  ('part_of_protocol', 'Part of protocol', false, true),
  ('alternative_to', 'Alternative to', true, true),
  ('contraindicated_for', 'Contraindicated for', false, true),
  ('interacts_with', 'Interacts with', true, true);

INSERT INTO public.kb_relation_type_domains (
  relation_type_code,
  subject_entity_type_code,
  object_entity_type_code,
  review_status
) VALUES
  ('manufactured_by', 'product', 'manufacturer', 'approved'),
  ('manufactured_by', 'product_variant', 'manufacturer', 'approved'),
  ('manufactured_by', 'device', 'manufacturer', 'approved'),
  ('manufactured_by', 'program', 'manufacturer', 'approved'),
  ('contains', 'product', 'substance', 'approved'),
  ('contains', 'product', 'plant', 'approved'),
  ('contains', 'product', 'nutrient', 'approved'),
  ('contains', 'product_variant', 'substance', 'approved'),
  ('contains', 'product_variant', 'plant', 'approved'),
  ('contains', 'product_variant', 'nutrient', 'approved'),
  ('manifests_as', 'disease', 'symptom', 'approved'),
  ('manifests_as', 'pathogen', 'symptom', 'approved'),
  ('affects_organ', 'disease', 'organ', 'approved'),
  ('affects_organ', 'disease', 'tissue', 'approved'),
  ('affects_organ', 'pathogen', 'organ', 'approved'),
  ('affects_organ', 'pathogen', 'tissue', 'approved'),
  ('measured_by', 'lab_parameter', 'diagnostic_method', 'approved'),
  ('measured_by', 'pathogen', 'diagnostic_method', 'approved'),
  ('may_indicate', 'lab_finding_definition', 'disease', 'approved'),
  ('may_indicate', 'lab_finding_definition', 'cause', 'approved'),
  ('may_indicate', 'lab_finding_definition', 'pathogen', 'approved'),
  ('alternative_to', 'product', 'product', 'approved'),
  ('alternative_to', 'product_variant', 'product_variant', 'approved'),
  ('alternative_to', 'substance', 'substance', 'approved'),
  ('alternative_to', 'plant', 'plant', 'approved'),
  ('alternative_to', 'nutrient', 'nutrient', 'approved'),
  ('alternative_to', 'therapy_method', 'therapy_method', 'approved'),
  ('interacts_with', 'product', 'product', 'approved'),
  ('interacts_with', 'product_variant', 'product_variant', 'approved'),
  ('interacts_with', 'substance', 'substance', 'approved'),
  ('interacts_with', 'plant', 'plant', 'approved'),
  ('interacts_with', 'nutrient', 'nutrient', 'approved');

INSERT INTO public.kb_relation_type_domains (
  relation_type_code,
  subject_entity_type_code,
  object_entity_type_code,
  review_status
)
SELECT relation_code, subject_code, object_code, 'approved'
FROM (
  VALUES
    ('targets_pathogen'),
    ('indicated_for'),
    ('may_support'),
    ('part_of_protocol'),
    ('contraindicated_for')
) AS relation(relation_code)
CROSS JOIN (
  VALUES
    ('product'),
    ('product_variant'),
    ('substance'),
    ('plant'),
    ('nutrient'),
    ('therapy_method'),
    ('program')
) AS subject(subject_code)
CROSS JOIN LATERAL (
  SELECT object_code
  FROM (
    VALUES
      ('pathogen'),
      ('symptom'),
      ('disease'),
      ('lab_finding_definition'),
      ('organ'),
      ('tissue'),
      ('protocol'),
      ('population_group')
  ) AS candidate(object_code)
  WHERE
    (relation_code = 'targets_pathogen' AND object_code = 'pathogen')
    OR (
      relation_code = 'indicated_for'
      AND object_code IN ('symptom', 'disease', 'lab_finding_definition')
    )
    OR (
      relation_code = 'may_support'
      AND object_code IN ('symptom', 'disease', 'organ', 'tissue')
    )
    OR (relation_code = 'part_of_protocol' AND object_code = 'protocol')
    OR (
      relation_code = 'contraindicated_for'
      AND object_code IN ('population_group', 'disease')
    )
) AS object_domain;

CREATE TRIGGER kb_relation_type_domains_review_workflow
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_relation_type_domains
  FOR EACH ROW EXECUTE FUNCTION public.kb_enforce_relation_domain_workflow();

CREATE INDEX kb_entities_type_idx
  ON public.kb_entities(entity_type_code);

CREATE INDEX kb_entities_lifecycle_idx
  ON public.kb_entities(lifecycle_status);

CREATE INDEX kb_entity_revisions_status_idx
  ON public.kb_entity_revisions(review_status);

CREATE INDEX kb_entity_revisions_review_due_idx
  ON public.kb_entity_revisions(review_due_at)
  WHERE review_due_at IS NOT NULL;

CREATE INDEX kb_entity_names_lookup_idx
  ON public.kb_entity_names(normalized_name);

CREATE INDEX kb_entity_names_entity_idx
  ON public.kb_entity_names(entity_id);

CREATE INDEX kb_entity_identifiers_entity_idx
  ON public.kb_entity_identifiers(entity_id);

CREATE INDEX kb_relation_type_domains_object_idx
  ON public.kb_relation_type_domains(object_entity_type_code);

CREATE INDEX kb_source_revisions_status_idx
  ON public.kb_source_revisions(review_status);

CREATE INDEX kb_assertions_status_idx
  ON public.kb_assertions(review_status);

CREATE INDEX kb_assertions_supersedes_idx
  ON public.kb_assertions(supersedes_assertion_id)
  WHERE supersedes_assertion_id IS NOT NULL;

CREATE INDEX kb_assertions_review_due_idx
  ON public.kb_assertions(review_due_at)
  WHERE review_due_at IS NOT NULL;

CREATE INDEX kb_entity_relations_subject_idx
  ON public.kb_entity_relations(subject_entity_id, relation_type_code);

CREATE INDEX kb_entity_relations_object_idx
  ON public.kb_entity_relations(object_entity_id, relation_type_code);

CREATE INDEX kb_assertion_sources_source_idx
  ON public.kb_assertion_sources(source_revision_id);

CREATE INDEX kb_article_revisions_status_idx
  ON public.kb_article_revisions(review_status);

CREATE INDEX kb_article_entities_entity_idx
  ON public.kb_article_entities(entity_id);

CREATE INDEX kb_change_proposals_queue_idx
  ON public.kb_change_proposals(status, submitted_at);

CREATE INDEX kb_change_proposals_target_idx
  ON public.kb_change_proposals(proposal_kind, target_id)
  WHERE target_id IS NOT NULL;

CREATE CONSTRAINT TRIGGER kb_relation_types_validate_approved_domains
  AFTER INSERT OR UPDATE ON public.kb_relation_types
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_active_relation_type_domains();

CREATE CONSTRAINT TRIGGER kb_relation_type_domains_validate_active_type
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_relation_type_domains
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_active_relation_type_domains();

DO $$
DECLARE
  kb_table text;
BEGIN
  FOREACH kb_table IN ARRAY ARRAY[
    'kb_entity_types',
    'kb_identifier_schemes',
    'kb_relation_types',
    'kb_relation_type_domains',
    'kb_entities',
    'kb_entity_revisions',
    'kb_entity_names',
    'kb_entity_identifiers',
    'kb_sources',
    'kb_source_revisions',
    'kb_assertions',
    'kb_entity_relations',
    'kb_assertion_sources',
    'kb_articles',
    'kb_article_revisions',
    'kb_article_entities',
    'kb_change_proposals'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', kb_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         FOR ALL
         TO authenticated
         USING (public.has_role(auth.uid(), ''admin''::public.app_role))
         WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))',
      kb_table || '_admin_all',
      kb_table
    );
  END LOOP;
END;
$$;

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
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
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
TO authenticated;

REVOKE INSERT, UPDATE ON TABLE public.kb_change_proposals
  FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.kb_entity_types,
  public.kb_identifier_schemes,
  public.kb_relation_types,
  public.kb_relation_type_domains
FROM authenticated;

GRANT ALL PRIVILEGES ON TABLE
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

REVOKE ALL ON FUNCTION public.kb_prevent_stable_value_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_validate_identifier()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_enforce_review_workflow()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_lock_source_assertions_after_status_changes()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_protect_reviewed_record()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_validate_assertion_version()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_validate_entity_relation_domain()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_protect_used_relation_domain()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_enforce_relation_domain_workflow()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_validate_active_relation_type_domains()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_validate_assertion_release()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_preserve_released_assertion_sources()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_protect_assertion_dependency()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_protect_article_entity_dependency()
  FROM PUBLIC, anon, authenticated;

COMMIT;
