ALTER TABLE public.admin_knowledge_base
  ADD COLUMN entry_kind text NOT NULL DEFAULT 'reference',
  ADD COLUMN review_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN evidence_level text NOT NULL DEFAULT 'unrated',
  ADD COLUMN dosage_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN rights_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN source_citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN therapeutic_topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN contraindications text[] NOT NULL DEFAULT '{}',
  ADD COLUMN interaction_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN safety_notes text NOT NULL DEFAULT '',
  ADD COLUMN patient_facing_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN commercial_claims_reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN last_reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid;

ALTER TABLE public.admin_knowledge_base
  ADD CONSTRAINT admin_knowledge_base_entry_kind_check
    CHECK (entry_kind IN ('reference', 'remedy', 'protocol', 'diagnostic', 'product', 'equipment')),
  ADD CONSTRAINT admin_knowledge_base_review_status_check
    CHECK (review_status IN ('unreviewed', 'needs_review', 'reviewed', 'restricted')),
  ADD CONSTRAINT admin_knowledge_base_evidence_level_check
    CHECK (evidence_level IN ('unrated', 'traditional', 'mechanistic', 'observational', 'clinical', 'guideline')),
  ADD CONSTRAINT admin_knowledge_base_dosage_status_check
    CHECK (dosage_status IN ('not_applicable', 'missing', 'unverified', 'verified')),
  ADD CONSTRAINT admin_knowledge_base_rights_status_check
    CHECK (rights_status IN ('unknown', 'own_content', 'licensed', 'quoted', 'public_domain')),
  ADD CONSTRAINT admin_knowledge_base_source_citations_array_check
    CHECK (jsonb_typeof(source_citations) = 'array'),
  ADD CONSTRAINT admin_knowledge_base_patient_release_check
    CHECK (
      NOT patient_facing_allowed
      OR (
        review_status = 'reviewed'
        AND commercial_claims_reviewed
        AND reviewed_by IS NOT NULL
        AND last_reviewed_at IS NOT NULL
      )
    );

CREATE OR REPLACE FUNCTION public.enforce_knowledge_review_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.review_status = 'reviewed' THEN
    IF auth.uid() IS NULL THEN
      IF TG_OP = 'UPDATE' THEN
        IF OLD.review_status = 'reviewed'
          AND (to_jsonb(NEW) - 'tags' - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'tags' - 'updated_at')
        THEN
          NEW.reviewed_by := OLD.reviewed_by;
          NEW.last_reviewed_at := OLD.last_reviewed_at;
          NEW.patient_facing_allowed := OLD.patient_facing_allowed;
          NEW.commercial_claims_reviewed := OLD.commercial_claims_reviewed;
        ELSE
          RAISE EXCEPTION 'Service-role updates may only enrich tags on reviewed wiki entries';
        END IF;
      ELSE
        RAISE EXCEPTION 'Reviewed wiki entries require an authenticated reviewer';
      END IF;
    ELSE
      NEW.reviewed_by := auth.uid();
      NEW.last_reviewed_at := now();
    END IF;
  ELSE
    NEW.reviewed_by := NULL;
    NEW.last_reviewed_at := NULL;
    NEW.patient_facing_allowed := false;
  END IF;

  IF NEW.patient_facing_allowed AND NOT NEW.commercial_claims_reviewed THEN
    RAISE EXCEPTION 'Patient-facing wiki entries require reviewed commercial claims';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER enforce_admin_knowledge_base_review_metadata
  BEFORE INSERT OR UPDATE ON public.admin_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_knowledge_review_metadata();

CREATE INDEX admin_knowledge_base_review_status_idx
  ON public.admin_knowledge_base(review_status);

CREATE INDEX admin_knowledge_base_interaction_tags_idx
  ON public.admin_knowledge_base USING gin(interaction_tags);

CREATE TABLE public.knowledge_product_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_entry_id uuid NOT NULL REFERENCES public.admin_knowledge_base(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.mannayan_products(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'topic_match'
    CHECK (relation_type IN ('exact_product', 'ingredient_match', 'topic_match', 'alternative', 'do_not_combine')),
  clinical_topics text[] NOT NULL DEFAULT '{}',
  confidence smallint NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  safety_notes text NOT NULL DEFAULT '',
  review_status text NOT NULL DEFAULT 'needs_review'
    CHECK (review_status IN ('needs_review', 'reviewed', 'restricted')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  UNIQUE (knowledge_entry_id, product_id, relation_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_product_links TO authenticated;
GRANT ALL ON public.knowledge_product_links TO service_role;

ALTER TABLE public.knowledge_product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage knowledge product links"
  ON public.knowledge_product_links
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX knowledge_product_links_knowledge_idx
  ON public.knowledge_product_links(knowledge_entry_id);

CREATE INDEX knowledge_product_links_product_idx
  ON public.knowledge_product_links(product_id);

CREATE TRIGGER update_knowledge_product_links_updated_at
  BEFORE UPDATE ON public.knowledge_product_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_knowledge_product_link_review_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.review_status = 'reviewed' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Reviewed product links require an authenticated reviewer';
    ELSE
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
    END IF;
  ELSE
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER enforce_knowledge_product_link_review_metadata
  BEFORE INSERT OR UPDATE ON public.knowledge_product_links
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_knowledge_product_link_review_metadata();

CREATE OR REPLACE FUNCTION public.assign_therapy_session_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  is_draft boolean;
  is_special boolean;
  next_v integer;
BEGIN
  IF NEW.version_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  is_draft := COALESCE((NEW.eingabe_daten->>'autoSavedDraft')::boolean, false);
  is_special := COALESCE(NEW.kind, '') IN (
    'befund_checkpoint',
    'quarantine_patient_mismatch',
    'event_log',
    'befund_auswertung',
    'therapy_candidate_draft'
  );

  IF is_draft OR is_special THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_v
    FROM public.therapy_sessions
   WHERE pseudonym_id = NEW.pseudonym_id;

  NEW.version_number := next_v;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.compact_therapy_session_input(_input jsonb, _max_chars integer DEFAULT 1200)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    '_pseudonym_id', NULLIF(left(COALESCE(_input->>'_pseudonym_id', _input->>'pseudonymId', ''), 80), ''),
    'pseudonymId', NULLIF(left(COALESCE(_input->>'pseudonymId', _input->>'_pseudonym_id', ''), 80), ''),
    'alter', NULLIF(left(COALESCE(_input->>'alter', ''), 40), ''),
    'geschlecht', NULLIF(left(COALESCE(_input->>'geschlecht', ''), 40), ''),
    'groesseCm', NULLIF(left(COALESCE(_input->>'groesseCm', ''), 40), ''),
    'gewichtKg', NULLIF(left(COALESCE(_input->>'gewichtKg', ''), 40), ''),
    'schwanger', NULLIF(left(COALESCE(_input->>'schwanger', ''), 40), ''),
    'symptome', NULLIF(left(COALESCE(_input->>'symptome', ''), _max_chars), ''),
    'erkrankung', NULLIF(left(COALESCE(_input->>'erkrankung', ''), _max_chars), ''),
    'medikamente', NULLIF(left(COALESCE(_input->>'medikamente', ''), _max_chars), ''),
    'bisherigeMittel', NULLIF(left(COALESCE(_input->>'bisherigeMittel', ''), _max_chars), ''),
    'budget', NULLIF(left(COALESCE(_input->>'budget', ''), _max_chars), ''),
    'belastungen', NULLIF(left(COALESCE(_input->>'belastungen', ''), _max_chars), ''),
    'laborKomplett', NULLIF(left(COALESCE(_input->>'laborKomplett', ''), _max_chars), ''),
    'laborErhoeht', NULLIF(left(COALESCE(_input->>'laborErhoeht', ''), _max_chars), ''),
    'laborErniedrigt', NULLIF(left(COALESCE(_input->>'laborErniedrigt', ''), _max_chars), ''),
    'laborDatum', NULLIF(left(COALESCE(_input->>'laborDatum', ''), 80), ''),
    'stuhlbefund', NULLIF(left(COALESCE(_input->>'stuhlbefund', ''), _max_chars), ''),
    'arztbericht', NULLIF(left(COALESCE(_input->>'arztbericht', ''), _max_chars), ''),
    'arztberichtDatum', NULLIF(left(COALESCE(_input->>'arztberichtDatum', ''), 80), ''),
    'metatronHeel', NULLIF(left(COALESCE(_input->>'metatronHeel', ''), _max_chars), ''),
    'sonstigeUntersuchungen', NULLIF(left(COALESCE(_input->>'sonstigeUntersuchungen', ''), _max_chars), ''),
    'perplexityAnalyse', NULLIF(left(COALESCE(_input->>'perplexityAnalyse', ''), _max_chars), ''),
    'eigeneTherapieVorlage', NULLIF(left(COALESCE(_input->>'eigeneTherapieVorlage', ''), _max_chars), ''),
    'apothekerRezept', NULLIF(left(COALESCE(_input->>'apothekerRezept', ''), _max_chars), ''),
    'zusatzTherapie', NULLIF(left(COALESCE(_input->>'zusatzTherapie', ''), _max_chars), ''),
    'manualDiagnosen', CASE WHEN jsonb_typeof(_input->'manualDiagnosen') = 'array' THEN _input->'manualDiagnosen' ELSE NULL END,
    'diagnosen', CASE WHEN jsonb_typeof(_input->'diagnosen') = 'array' THEN _input->'diagnosen' ELSE NULL END,
    'autoSavedDraft', CASE WHEN COALESCE((_input->>'autoSavedDraft')::boolean, false) THEN true ELSE NULL END,
    'safetyReview', CASE
      WHEN jsonb_typeof(_input->'safetyReview') = 'object' AND length((_input->'safetyReview')::text) <= 20000 THEN _input->'safetyReview'
      WHEN _input ? 'safetyReview' THEN jsonb_build_object('truncated', true)
      ELSE NULL
    END
  ));
$function$;

INSERT INTO public.knowledge_product_links (
  knowledge_entry_id,
  product_id,
  relation_type,
  confidence,
  review_status,
  safety_notes
)
SELECT
  knowledge.id,
  product.id,
  'exact_product',
  100,
  'needs_review',
  'Automatisch nur anhand identischer Bezeichnung zugeordnet; fachliche Eignung und Produktstatus manuell pruefen.'
FROM public.admin_knowledge_base AS knowledge
JOIN public.mannayan_products AS product
  ON lower(trim(knowledge.title)) = lower(trim(product.name))
ON CONFLICT (knowledge_entry_id, product_id, relation_type) DO NOTHING;