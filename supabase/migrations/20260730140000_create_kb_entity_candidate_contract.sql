BEGIN;

LOCK TABLE public.kb_entity_candidates IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.kb_entity_candidates
     WHERE candidate_status = 'accepted_as_draft'
  ) THEN
    RAISE EXCEPTION 'Typed entity candidate contracts require conversion of existing accepted candidates before migration';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_normalize_entity_candidate_name_v1(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(btrim(_value), '[[:space:]]+', ' ', 'g'))
$$;

CREATE TABLE public.kb_entity_candidate_contracts (
  entity_candidate_id uuid PRIMARY KEY,
  batch_id uuid NOT NULL,
  contract_version integer NOT NULL DEFAULT 1 CHECK (contract_version = 1),
  summary text NOT NULL DEFAULT '',
  contract_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(contract_metadata) = 'object'),
  contract_hash text NOT NULL CHECK (contract_hash ~ '^[0-9a-f]{64}$'),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  sealed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, entity_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.kb_entity_candidate_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  entity_candidate_id uuid NOT NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  normalized_name text NOT NULL CHECK (btrim(normalized_name) <> ''),
  normalization_version integer NOT NULL DEFAULT 1 CHECK (normalization_version = 1),
  name_kind text NOT NULL CHECK (name_kind IN (
    'preferred', 'abbreviation', 'scientific', 'trade', 'historical', 'spelling_variant'
  )),
  language_code text NOT NULL DEFAULT 'de'
    CHECK (language_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  is_preferred boolean NOT NULL DEFAULT false,
  name_order integer NOT NULL CHECK (name_order > 0),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, entity_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  UNIQUE (entity_candidate_id, normalized_name, name_kind, language_code),
  UNIQUE (entity_candidate_id, name_order),
  CHECK (normalized_name = public.kb_normalize_entity_candidate_name_v1(name)),
  CHECK (is_preferred = (name_kind = 'preferred'))
);

CREATE UNIQUE INDEX kb_entity_candidate_names_one_preferred_idx
  ON public.kb_entity_candidate_names(entity_candidate_id, language_code)
  WHERE is_preferred;

CREATE UNIQUE INDEX kb_entity_candidates_accepted_canonical_key_idx
  ON public.kb_entity_candidates(proposed_canonical_key)
  WHERE candidate_status = 'accepted_as_draft'
    AND target_entity_id IS NULL
    AND proposed_canonical_key IS NOT NULL;

CREATE TABLE public.kb_entity_candidate_assertions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  entity_candidate_id uuid NOT NULL,
  claim_key text NOT NULL
    CHECK (claim_key ~ '^[a-z0-9]+([._:-][a-z0-9]+)*$'),
  assertion_kind text NOT NULL CHECK (assertion_kind IN ('classification', 'narrative')),
  claim_text text NOT NULL CHECK (btrim(claim_text) <> ''),
  evidence_basis text NOT NULL DEFAULT 'unrated' CHECK (evidence_basis IN (
    'unrated', 'manufacturer_statement', 'traditional_use', 'experiential_medicine',
    'practice_rule', 'mechanistic', 'observational_study', 'clinical_study',
    'systematic_review', 'guideline'
  )),
  evidence_quality text NOT NULL DEFAULT 'unrated'
    CHECK (evidence_quality IN ('unrated', 'very_low', 'low', 'moderate', 'high')),
  valid_from date,
  valid_until date,
  assertion_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(assertion_metadata) = 'object'),
  assertion_order integer NOT NULL CHECK (assertion_order > 0),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, entity_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  UNIQUE (batch_id, entity_candidate_id, id),
  UNIQUE (entity_candidate_id, claim_key),
  UNIQUE (entity_candidate_id, assertion_order),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE public.kb_entity_candidate_assertion_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  entity_candidate_id uuid NOT NULL,
  assertion_candidate_id uuid NOT NULL,
  source_candidate_id uuid NOT NULL,
  source_role text NOT NULL CHECK (source_role IN ('supports', 'refutes', 'qualifies', 'mentions')),
  locator text NOT NULL CHECK (btrim(locator) <> ''),
  original_quote text NOT NULL DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false,
  source_order integer NOT NULL CHECK (source_order > 0),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, entity_candidate_id, assertion_candidate_id)
    REFERENCES public.kb_entity_candidate_assertions(batch_id, entity_candidate_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (batch_id, source_candidate_id)
    REFERENCES public.kb_source_candidates(batch_id, id) ON DELETE RESTRICT,
  UNIQUE (entity_candidate_id, assertion_candidate_id, source_order),
  UNIQUE (assertion_candidate_id, source_candidate_id, source_role, locator)
);

CREATE TABLE public.kb_entity_candidate_preparation_details (
  entity_candidate_id uuid PRIMARY KEY,
  batch_id uuid NOT NULL,
  preparation_kind text NOT NULL CHECK (preparation_kind IN (
    'homeopathic_single', 'homeopathic_complex', 'nosode', 'sarcode', 'isode',
    'mother_tincture', 'herbal_tincture', 'fluid_extract', 'dry_extract',
    'essential_oil', 'herbal_tea', 'nutrient_single', 'nutrient_combination',
    'mineral', 'trace_element', 'amino_acid', 'probiotic', 'enzyme', 'supplement', 'other'
  )),
  dosage_form text NOT NULL CHECK (dosage_form IN (
    'unspecified', 'globules', 'tablets', 'capsules', 'drops', 'liquid',
    'powder', 'granules', 'tea', 'oil', 'spray', 'cream', 'ointment',
    'suppository', 'ampoule', 'other'
  )),
  administration_routes text[] NOT NULL CHECK (
    cardinality(administration_routes) > 0
    AND administration_routes <@ ARRAY[
      'oral', 'sublingual', 'buccal', 'topical', 'inhaled', 'nasal',
      'rectal', 'vaginal', 'parenteral', 'other'
    ]::text[]
    AND public.kb_text_array_is_canonical(administration_routes)
  ),
  standardization_status text NOT NULL DEFAULT 'not_applicable' CHECK (
    standardization_status IN (
      'not_applicable', 'not_standardized', 'partially_standardized',
      'standardized', 'manufacturer_specific', 'unknown'
    )
  ),
  basis_assertion_candidate_id uuid NOT NULL,
  technical_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(technical_metadata) = 'object'),
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, entity_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (batch_id, entity_candidate_id, basis_assertion_candidate_id)
    REFERENCES public.kb_entity_candidate_assertions(batch_id, entity_candidate_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE public.kb_entity_candidate_homeopathic_details (
  entity_candidate_id uuid PRIMARY KEY,
  batch_id uuid NOT NULL,
  remedy_kind text NOT NULL CHECK (remedy_kind IN ('single', 'complex', 'nosode', 'sarcode', 'isode')),
  potency_scale text CHECK (potency_scale IS NULL OR potency_scale IN ('D', 'C', 'Q', 'LM', 'K', 'X', 'other')),
  potency_value numeric(10, 3),
  potentization_method text NOT NULL DEFAULT 'unspecified' CHECK (potentization_method IN (
    'unspecified', 'hahnemannian', 'korsakovian', 'fifty_millesimal',
    'manufacturer_specific', 'other'
  )),
  basis_assertion_candidate_id uuid NOT NULL,
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, entity_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (batch_id, entity_candidate_id, basis_assertion_candidate_id)
    REFERENCES public.kb_entity_candidate_assertions(batch_id, entity_candidate_id, id)
    ON DELETE RESTRICT,
  CHECK ((potency_scale IS NULL) = (potency_value IS NULL)),
  CHECK (potency_value IS NULL OR (potency_value > 0 AND potency_value < 'Infinity'::numeric)),
  CHECK (remedy_kind = 'complex' OR potency_value IS NOT NULL)
);

CREATE TABLE public.kb_entity_candidate_botanical_details (
  entity_candidate_id uuid PRIMARY KEY,
  batch_id uuid NOT NULL,
  plant_parts text[] NOT NULL CHECK (
    cardinality(plant_parts) > 0 AND public.kb_text_array_is_canonical(plant_parts)
  ),
  source_material_state text NOT NULL
    CHECK (source_material_state IN ('fresh', 'dried', 'mixed', 'unspecified')),
  extraction_type text NOT NULL CHECK (extraction_type IN (
    'none', 'maceration', 'percolation', 'distillation', 'infusion',
    'decoction', 'fluid_extract', 'dry_extract', 'other'
  )),
  drug_extract_ratio_from numeric(12, 4),
  drug_extract_ratio_to numeric(12, 4),
  extraction_solvents text[] NOT NULL DEFAULT '{}'
    CHECK (public.kb_text_array_is_canonical(extraction_solvents)),
  alcohol_percent_from numeric(5, 2),
  alcohol_percent_to numeric(5, 2),
  basis_assertion_candidate_id uuid NOT NULL,
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, entity_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (batch_id, entity_candidate_id, basis_assertion_candidate_id)
    REFERENCES public.kb_entity_candidate_assertions(batch_id, entity_candidate_id, id)
    ON DELETE RESTRICT,
  CHECK ((drug_extract_ratio_from IS NULL) = (drug_extract_ratio_to IS NULL)),
  CHECK (drug_extract_ratio_from IS NULL OR (
    drug_extract_ratio_from > 0 AND drug_extract_ratio_from < 'Infinity'::numeric
  )),
  CHECK (drug_extract_ratio_to IS NULL OR (
    drug_extract_ratio_to >= drug_extract_ratio_from AND drug_extract_ratio_to < 'Infinity'::numeric
  )),
  CHECK ((alcohol_percent_from IS NULL) = (alcohol_percent_to IS NULL)),
  CHECK (alcohol_percent_from IS NULL OR alcohol_percent_from BETWEEN 0 AND 100),
  CHECK (alcohol_percent_to IS NULL OR alcohol_percent_to BETWEEN alcohol_percent_from AND 100)
);

CREATE TABLE public.kb_entity_candidate_nutrient_details (
  entity_candidate_id uuid PRIMARY KEY,
  batch_id uuid NOT NULL,
  formulation_kind text NOT NULL CHECK (formulation_kind IN ('single', 'combination')),
  delivery_system text NOT NULL DEFAULT 'standard' CHECK (delivery_system IN (
    'standard', 'chelated', 'liposomal', 'buffered', 'extended_release',
    'oil_based', 'water_based', 'enteric_coated', 'other'
  )),
  basis_assertion_candidate_id uuid NOT NULL,
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, entity_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (batch_id, entity_candidate_id, basis_assertion_candidate_id)
    REFERENCES public.kb_entity_candidate_assertions(batch_id, entity_candidate_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE public.kb_entity_candidate_product_variant_details (
  entity_candidate_id uuid PRIMARY KEY,
  batch_id uuid NOT NULL,
  product_entity_id uuid,
  product_revision_id uuid,
  product_candidate_id uuid,
  preparation_entity_id uuid,
  preparation_revision_id uuid,
  preparation_candidate_id uuid,
  package_quantity numeric(14, 4) NOT NULL
    CHECK (package_quantity > 0 AND package_quantity < 'Infinity'::numeric),
  package_unit text NOT NULL CHECK (package_unit IN (
    'piece', 'g', 'mg', 'kg', 'ml', 'l', 'dose', 'capsule', 'tablet',
    'ampoule', 'sachet', 'other'
  )),
  market_status text NOT NULL DEFAULT 'unknown' CHECK (
    market_status IN ('unknown', 'planned', 'available', 'temporarily_unavailable', 'discontinued')
  ),
  valid_from date,
  valid_until date,
  basis_assertion_candidate_id uuid NOT NULL,
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, entity_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (batch_id, entity_candidate_id, basis_assertion_candidate_id)
    REFERENCES public.kb_entity_candidate_assertions(batch_id, entity_candidate_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (product_entity_id, product_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (preparation_entity_id, preparation_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (batch_id, product_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (batch_id, preparation_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  CHECK (
    ((product_entity_id IS NOT NULL)::int + (product_revision_id IS NOT NULL)::int = 2
      AND product_candidate_id IS NULL)
    OR (product_entity_id IS NULL AND product_revision_id IS NULL AND product_candidate_id IS NOT NULL)
  ),
  CHECK (
    ((preparation_entity_id IS NOT NULL)::int + (preparation_revision_id IS NOT NULL)::int = 2
      AND preparation_candidate_id IS NULL)
    OR (preparation_entity_id IS NULL AND preparation_revision_id IS NULL AND preparation_candidate_id IS NOT NULL)
  ),
  CHECK (product_candidate_id IS NULL OR product_candidate_id <> entity_candidate_id),
  CHECK (preparation_candidate_id IS NULL OR preparation_candidate_id <> entity_candidate_id),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE public.kb_entity_candidate_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  entity_candidate_id uuid NOT NULL,
  component_entity_id uuid,
  component_revision_id uuid,
  component_candidate_id uuid,
  component_role text NOT NULL CHECK (component_role IN (
    'active', 'homeopathic_active', 'nutrient', 'extract', 'carrier',
    'excipient', 'coating', 'preservative', 'flavor', 'other'
  )),
  chemical_form_status text NOT NULL DEFAULT 'unknown'
    CHECK (chemical_form_status IN ('specified', 'not_applicable', 'unknown')),
  chemical_form text,
  amount_status text NOT NULL DEFAULT 'unknown'
    CHECK (amount_status IN ('specified', 'not_applicable', 'unknown')),
  amount_min numeric(18, 6),
  amount_max numeric(18, 6),
  amount_unit text,
  reference_quantity numeric(18, 6),
  reference_unit text,
  elemental_amount numeric(18, 6),
  elemental_unit text,
  component_order integer NOT NULL CHECK (component_order > 0),
  valid_from date,
  valid_until date,
  basis_assertion_candidate_id uuid NOT NULL,
  data_classification text NOT NULL DEFAULT 'general_knowledge'
    CHECK (data_classification = 'general_knowledge'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, entity_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (batch_id, entity_candidate_id, basis_assertion_candidate_id)
    REFERENCES public.kb_entity_candidate_assertions(batch_id, entity_candidate_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (component_entity_id, component_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (batch_id, component_candidate_id)
    REFERENCES public.kb_entity_candidates(batch_id, id) ON DELETE RESTRICT,
  UNIQUE (entity_candidate_id, component_order),
  UNIQUE NULLS NOT DISTINCT (
    entity_candidate_id,
    component_entity_id,
    component_revision_id,
    component_candidate_id,
    component_role,
    chemical_form
  ),
  CHECK (
    ((component_entity_id IS NOT NULL)::int + (component_revision_id IS NOT NULL)::int = 2
      AND component_candidate_id IS NULL)
    OR (component_entity_id IS NULL AND component_revision_id IS NULL AND component_candidate_id IS NOT NULL)
  ),
  CHECK (component_candidate_id IS NULL OR component_candidate_id <> entity_candidate_id),
  CHECK (
    (chemical_form_status = 'specified' AND chemical_form IS NOT NULL AND btrim(chemical_form) <> '')
    OR (chemical_form_status IN ('not_applicable', 'unknown') AND chemical_form IS NULL)
  ),
  CHECK (
    (amount_status = 'specified'
      AND amount_min IS NOT NULL
      AND amount_unit IS NOT NULL
      AND btrim(amount_unit) <> '')
    OR (amount_status IN ('not_applicable', 'unknown')
      AND amount_min IS NULL
      AND amount_max IS NULL
      AND amount_unit IS NULL
      AND reference_quantity IS NULL
      AND reference_unit IS NULL
      AND elemental_amount IS NULL
      AND elemental_unit IS NULL)
  ),
  CHECK ((amount_min IS NULL) = (amount_max IS NULL)),
  CHECK ((amount_min IS NULL) = (amount_unit IS NULL)),
  CHECK (amount_min IS NULL OR (amount_min > 0 AND amount_min < 'Infinity'::numeric)),
  CHECK (amount_max IS NULL OR (
    amount_max >= amount_min AND amount_max < 'Infinity'::numeric
  )),
  CHECK ((reference_quantity IS NULL) = (reference_unit IS NULL)),
  CHECK (reference_unit IS NULL OR btrim(reference_unit) <> ''),
  CHECK (reference_quantity IS NULL OR (
    reference_quantity > 0 AND reference_quantity < 'Infinity'::numeric
  )),
  CHECK ((elemental_amount IS NULL) = (elemental_unit IS NULL)),
  CHECK (elemental_unit IS NULL OR btrim(elemental_unit) <> ''),
  CHECK (elemental_amount IS NULL OR (
    elemental_amount > 0 AND elemental_amount < 'Infinity'::numeric
  )),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE INDEX kb_entity_candidate_assertions_candidate_idx
  ON public.kb_entity_candidate_assertions(entity_candidate_id, assertion_order);
CREATE INDEX kb_entity_candidate_sources_source_idx
  ON public.kb_entity_candidate_assertion_sources(source_candidate_id);
CREATE INDEX kb_entity_candidate_components_reference_idx
  ON public.kb_entity_candidate_components(component_entity_id, component_revision_id);
CREATE INDEX kb_entity_candidate_components_candidate_idx
  ON public.kb_entity_candidate_components(component_candidate_id);

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_contract_payload(
  _entity_candidate_id uuid,
  _summary text,
  _contract_metadata jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'contract_version', 1,
    'candidate', jsonb_build_object(
      'candidate_key', candidate.candidate_key,
      'entity_type_code', candidate.proposed_entity_type_code,
      'canonical_key', candidate.proposed_canonical_key,
      'display_name', candidate.display_name,
      'aliases', candidate.aliases,
      'summary', _summary,
      'description_markdown', candidate.description_markdown,
      'source_candidate_id', candidate.source_candidate_id,
      'source_locator', candidate.source_locator,
      'original_excerpt', candidate.original_excerpt,
      'confidence', candidate.confidence,
      'ambiguity_notes', candidate.ambiguity_notes,
      'proposed_data', candidate.proposed_data,
      'target_entity_id', candidate.target_entity_id,
      'data_classification', candidate.data_classification
    ),
    'contract_metadata', _contract_metadata,
    'names', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', candidate_name.name,
        'normalized_name', candidate_name.normalized_name,
        'normalization_version', candidate_name.normalization_version,
        'name_kind', candidate_name.name_kind,
        'language_code', candidate_name.language_code,
        'is_preferred', candidate_name.is_preferred,
        'name_order', candidate_name.name_order
      ) ORDER BY candidate_name.name_order, candidate_name.normalized_name COLLATE "C")
      FROM public.kb_entity_candidate_names candidate_name
      WHERE candidate_name.entity_candidate_id = _entity_candidate_id
    ), '[]'::jsonb),
    'assertions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'claim_key', assertion.claim_key,
        'assertion_kind', assertion.assertion_kind,
        'claim_text', assertion.claim_text,
        'evidence_basis', assertion.evidence_basis,
        'evidence_quality', assertion.evidence_quality,
        'valid_from', assertion.valid_from,
        'valid_until', assertion.valid_until,
        'assertion_metadata', assertion.assertion_metadata,
        'assertion_order', assertion.assertion_order,
        'sources', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'source_candidate_id', assertion_source.source_candidate_id,
            'source_role', assertion_source.source_role,
            'locator', assertion_source.locator,
            'original_quote', assertion_source.original_quote,
            'is_primary', assertion_source.is_primary,
            'source_order', assertion_source.source_order
          ) ORDER BY assertion_source.source_order, assertion_source.source_candidate_id)
          FROM public.kb_entity_candidate_assertion_sources assertion_source
          WHERE assertion_source.assertion_candidate_id = assertion.id
        ), '[]'::jsonb)
      ) ORDER BY assertion.assertion_order, assertion.claim_key COLLATE "C")
      FROM public.kb_entity_candidate_assertions assertion
      WHERE assertion.entity_candidate_id = _entity_candidate_id
    ), '[]'::jsonb),
    'preparation', (
      SELECT jsonb_build_object(
        'preparation_kind', detail.preparation_kind,
        'dosage_form', detail.dosage_form,
        'administration_routes', detail.administration_routes,
        'standardization_status', detail.standardization_status,
        'basis_claim_key', assertion.claim_key,
        'technical_metadata', detail.technical_metadata
      )
      FROM public.kb_entity_candidate_preparation_details detail
      JOIN public.kb_entity_candidate_assertions assertion
        ON assertion.id = detail.basis_assertion_candidate_id
      WHERE detail.entity_candidate_id = _entity_candidate_id
    ),
    'homeopathic', (
      SELECT jsonb_build_object(
        'remedy_kind', detail.remedy_kind,
        'potency_scale', detail.potency_scale,
        'potency_value', detail.potency_value,
        'potentization_method', detail.potentization_method,
        'basis_claim_key', assertion.claim_key
      )
      FROM public.kb_entity_candidate_homeopathic_details detail
      JOIN public.kb_entity_candidate_assertions assertion
        ON assertion.id = detail.basis_assertion_candidate_id
      WHERE detail.entity_candidate_id = _entity_candidate_id
    ),
    'botanical', (
      SELECT jsonb_build_object(
        'plant_parts', detail.plant_parts,
        'source_material_state', detail.source_material_state,
        'extraction_type', detail.extraction_type,
        'drug_extract_ratio_from', detail.drug_extract_ratio_from,
        'drug_extract_ratio_to', detail.drug_extract_ratio_to,
        'extraction_solvents', detail.extraction_solvents,
        'alcohol_percent_from', detail.alcohol_percent_from,
        'alcohol_percent_to', detail.alcohol_percent_to,
        'basis_claim_key', assertion.claim_key
      )
      FROM public.kb_entity_candidate_botanical_details detail
      JOIN public.kb_entity_candidate_assertions assertion
        ON assertion.id = detail.basis_assertion_candidate_id
      WHERE detail.entity_candidate_id = _entity_candidate_id
    ),
    'nutrient', (
      SELECT jsonb_build_object(
        'formulation_kind', detail.formulation_kind,
        'delivery_system', detail.delivery_system,
        'basis_claim_key', assertion.claim_key
      )
      FROM public.kb_entity_candidate_nutrient_details detail
      JOIN public.kb_entity_candidate_assertions assertion
        ON assertion.id = detail.basis_assertion_candidate_id
      WHERE detail.entity_candidate_id = _entity_candidate_id
    ),
    'product_variant', (
      SELECT jsonb_build_object(
        'product_reference', CASE
          WHEN detail.product_candidate_id IS NOT NULL THEN jsonb_build_object(
            'kind', 'candidate',
            'entity_candidate_id', detail.product_candidate_id,
            'contract_hash', product_contract.contract_hash
          )
          ELSE jsonb_build_object(
            'kind', 'revision',
            'entity_id', detail.product_entity_id,
            'revision_id', detail.product_revision_id,
            'revision_hash', product_revision.content_hash
          )
        END,
        'preparation_reference', CASE
          WHEN detail.preparation_candidate_id IS NOT NULL THEN jsonb_build_object(
            'kind', 'candidate',
            'entity_candidate_id', detail.preparation_candidate_id,
            'contract_hash', preparation_contract.contract_hash
          )
          ELSE jsonb_build_object(
            'kind', 'revision',
            'entity_id', detail.preparation_entity_id,
            'revision_id', detail.preparation_revision_id,
            'revision_hash', preparation_revision.content_hash
          )
        END,
        'package_quantity', detail.package_quantity,
        'package_unit', detail.package_unit,
        'market_status', detail.market_status,
        'valid_from', detail.valid_from,
        'valid_until', detail.valid_until,
        'basis_claim_key', assertion.claim_key
      )
      FROM public.kb_entity_candidate_product_variant_details detail
      JOIN public.kb_entity_candidate_assertions assertion
        ON assertion.id = detail.basis_assertion_candidate_id
      LEFT JOIN public.kb_entity_revisions product_revision
        ON product_revision.entity_id = detail.product_entity_id
       AND product_revision.id = detail.product_revision_id
      LEFT JOIN public.kb_entity_revisions preparation_revision
        ON preparation_revision.entity_id = detail.preparation_entity_id
       AND preparation_revision.id = detail.preparation_revision_id
      LEFT JOIN public.kb_entity_candidate_contracts product_contract
        ON product_contract.entity_candidate_id = detail.product_candidate_id
      LEFT JOIN public.kb_entity_candidate_contracts preparation_contract
        ON preparation_contract.entity_candidate_id = detail.preparation_candidate_id
      WHERE detail.entity_candidate_id = _entity_candidate_id
    ),
    'components', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'component_reference', CASE
          WHEN component.component_candidate_id IS NOT NULL THEN jsonb_build_object(
            'kind', 'candidate',
            'entity_candidate_id', component.component_candidate_id,
            'contract_hash', component_contract.contract_hash
          )
          ELSE jsonb_build_object(
            'kind', 'revision',
            'entity_id', component.component_entity_id,
            'revision_id', component.component_revision_id,
            'revision_hash', component_revision.content_hash
          )
        END,
        'component_role', component.component_role,
        'chemical_form_status', component.chemical_form_status,
        'chemical_form', component.chemical_form,
        'amount_status', component.amount_status,
        'amount_min', component.amount_min,
        'amount_max', component.amount_max,
        'amount_unit', component.amount_unit,
        'reference_quantity', component.reference_quantity,
        'reference_unit', component.reference_unit,
        'elemental_amount', component.elemental_amount,
        'elemental_unit', component.elemental_unit,
        'component_order', component.component_order,
        'valid_from', component.valid_from,
        'valid_until', component.valid_until,
        'basis_claim_key', assertion.claim_key
      ) ORDER BY component.component_order)
      FROM public.kb_entity_candidate_components component
      JOIN public.kb_entity_candidate_assertions assertion
        ON assertion.id = component.basis_assertion_candidate_id
      LEFT JOIN public.kb_entity_revisions component_revision
        ON component_revision.entity_id = component.component_entity_id
       AND component_revision.id = component.component_revision_id
      LEFT JOIN public.kb_entity_candidate_contracts component_contract
        ON component_contract.entity_candidate_id = component.component_candidate_id
      WHERE component.entity_candidate_id = _entity_candidate_id
    ), '[]'::jsonb)
  )
  FROM public.kb_entity_candidates candidate
  WHERE candidate.id = _entity_candidate_id
$$;

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_contract_hash(
  _entity_candidate_id uuid,
  _summary text,
  _contract_metadata jsonb
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT encode(
    sha256(convert_to(public.kb_entity_candidate_contract_payload(
      _entity_candidate_id,
      _summary,
      _contract_metadata
    )::text, 'UTF8')),
    'hex'
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_dependency_contracts_are_valid(
  _entity_candidate_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  WITH RECURSIVE candidate_graph(entity_candidate_id) AS (
    SELECT _entity_candidate_id
    UNION
    SELECT reference.dependency_id
      FROM candidate_graph owner_candidate
      CROSS JOIN LATERAL (
        SELECT detail.product_candidate_id AS dependency_id
          FROM public.kb_entity_candidate_product_variant_details detail
         WHERE detail.entity_candidate_id = owner_candidate.entity_candidate_id
        UNION
        SELECT detail.preparation_candidate_id
          FROM public.kb_entity_candidate_product_variant_details detail
         WHERE detail.entity_candidate_id = owner_candidate.entity_candidate_id
        UNION
        SELECT component.component_candidate_id
          FROM public.kb_entity_candidate_components component
         WHERE component.entity_candidate_id = owner_candidate.entity_candidate_id
      ) reference
     WHERE reference.dependency_id IS NOT NULL
  ), dependencies AS (
    SELECT graph.entity_candidate_id
      FROM candidate_graph graph
     WHERE graph.entity_candidate_id <> _entity_candidate_id
  )
  SELECT NOT EXISTS (
    SELECT 1
      FROM dependencies dependency
      LEFT JOIN public.kb_entity_candidate_contracts contract
        ON contract.entity_candidate_id = dependency.entity_candidate_id
     WHERE contract.entity_candidate_id IS NULL
        OR contract.contract_hash IS DISTINCT FROM public.kb_entity_candidate_contract_hash(
          contract.entity_candidate_id,
          contract.summary,
          contract.contract_metadata
        )
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_lock_entity_candidate_contract_revisions(
  _entity_candidate_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
STRICT
SET search_path = public
AS $$
BEGIN
  PERFORM revision.id
    FROM public.kb_entity_revisions revision
    JOIN (
      WITH RECURSIVE candidate_graph(entity_candidate_id) AS (
        SELECT _entity_candidate_id
        UNION
        SELECT candidate_reference.dependency_id
          FROM candidate_graph owner_candidate
          CROSS JOIN LATERAL (
            SELECT detail.product_candidate_id AS dependency_id
              FROM public.kb_entity_candidate_product_variant_details detail
             WHERE detail.entity_candidate_id = owner_candidate.entity_candidate_id
            UNION
            SELECT detail.preparation_candidate_id
              FROM public.kb_entity_candidate_product_variant_details detail
             WHERE detail.entity_candidate_id = owner_candidate.entity_candidate_id
            UNION
            SELECT component.component_candidate_id
              FROM public.kb_entity_candidate_components component
             WHERE component.entity_candidate_id = owner_candidate.entity_candidate_id
          ) candidate_reference
         WHERE candidate_reference.dependency_id IS NOT NULL
      )
      SELECT detail.product_revision_id AS revision_id
        FROM candidate_graph owner_candidate
        JOIN public.kb_entity_candidate_product_variant_details detail
          ON detail.entity_candidate_id = owner_candidate.entity_candidate_id
       WHERE detail.product_revision_id IS NOT NULL
      UNION
      SELECT detail.preparation_revision_id
        FROM candidate_graph owner_candidate
        JOIN public.kb_entity_candidate_product_variant_details detail
          ON detail.entity_candidate_id = owner_candidate.entity_candidate_id
       WHERE detail.preparation_revision_id IS NOT NULL
      UNION
      SELECT component.component_revision_id
        FROM candidate_graph owner_candidate
        JOIN public.kb_entity_candidate_components component
          ON component.entity_candidate_id = owner_candidate.entity_candidate_id
       WHERE component.component_revision_id IS NOT NULL
    ) reference ON reference.revision_id = revision.id
   ORDER BY revision.id
   FOR SHARE OF revision;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_source_candidate_promotion_is_valid(
  _source_candidate_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.kb_source_candidate_draft_promotions promotion
      JOIN public.kb_source_candidates candidate
        ON candidate.id = promotion.source_candidate_id
       AND candidate.batch_id = promotion.batch_id
      JOIN public.kb_import_batches batch ON batch.id = promotion.batch_id
      JOIN public.kb_review_decisions decision ON decision.id = promotion.review_decision_id
      JOIN public.kb_sources source ON source.id = promotion.source_id
      JOIN public.kb_source_revisions revision
        ON revision.id = promotion.source_revision_id
       AND revision.source_id = promotion.source_id
     WHERE promotion.source_candidate_id = _source_candidate_id
       AND candidate.candidate_status = 'accepted_as_draft'
       AND candidate.target_source_id IS NULL
       AND candidate.data_classification = 'general_knowledge'
       AND batch.batch_status = 'reviewed'
       AND decision.candidate_kind = 'source'
       AND decision.candidate_id = promotion.source_candidate_id
       AND decision.decision = 'accept_as_draft'
       AND decision.status_after = 'accepted_as_draft'
       AND decision.data_classification = 'general_knowledge'
       AND source.canonical_key = promotion.selected_canonical_key
       AND source.created_by = promotion.promoted_by
       AND source.metadata -> 'origin_type' = to_jsonb('import'::text)
       AND source.metadata -> 'source_candidate_id' = to_jsonb(promotion.source_candidate_id::text)
       AND source.metadata -> 'import_batch_id' = to_jsonb(promotion.batch_id::text)
       AND source.metadata -> 'conversion_version' = to_jsonb(promotion.conversion_version)
       AND revision.revision_no = 1
       AND revision.created_by = promotion.promoted_by
       AND revision.metadata -> 'origin_type' = to_jsonb('import'::text)
       AND revision.metadata -> 'source_candidate_id' = to_jsonb(promotion.source_candidate_id::text)
       AND revision.metadata -> 'import_batch_id' = to_jsonb(promotion.batch_id::text)
       AND revision.metadata -> 'review_decision_id' = to_jsonb(promotion.review_decision_id::text)
       AND revision.metadata -> 'conversion_version' = to_jsonb(promotion.conversion_version)
       AND promotion.data_classification = 'general_knowledge'
       AND promotion.initial_content_hash = encode(sha256(convert_to(jsonb_build_object(
         'source_type', promotion.selected_source_type,
         'title', candidate.title,
         'publisher', NULLIF(btrim(candidate.publisher), ''),
         'published_on', candidate.publication_date,
         'url', NULLIF(btrim(candidate.source_url), ''),
         'rights_status', candidate.rights_status
       )::text, 'UTF8')), 'hex')
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_contract_error_codes(
  _entity_candidate_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  candidate public.kb_entity_candidates%ROWTYPE;
  contract public.kb_entity_candidate_contracts%ROWTYPE;
  errors text[] := ARRAY[]::text[];
  typed_aliases text[];
  preparation_kind text;
  homeopathic_kind text;
  nutrient_kind text;
  preparation_count integer;
  homeopathic_count integer;
  botanical_count integer;
  nutrient_count integer;
  product_variant_count integer;
  component_count integer;
  composition_bearing_component_count integer;
  classification_count integer;
BEGIN
  SELECT * INTO candidate
    FROM public.kb_entity_candidates
   WHERE id = _entity_candidate_id;
  IF NOT FOUND THEN
    RETURN ARRAY['CANDIDATE_NOT_FOUND']::text[];
  END IF;

  SELECT stored_contract.* INTO contract
    FROM public.kb_entity_candidate_contracts stored_contract
   WHERE stored_contract.entity_candidate_id = _entity_candidate_id;
  IF NOT FOUND THEN
    errors := array_append(errors, 'CONTRACT_MISSING');
  ELSIF contract.contract_hash IS DISTINCT FROM public.kb_entity_candidate_contract_hash(
    _entity_candidate_id,
    contract.summary,
    contract.contract_metadata
  ) THEN
    errors := array_append(errors, 'CONTRACT_HASH_MISMATCH');
  END IF;

  IF candidate.proposed_entity_type_code IS NULL THEN
    errors := array_append(errors, 'ENTITY_TYPE_MISSING');
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.kb_entity_types entity_type
     WHERE entity_type.code = candidate.proposed_entity_type_code
       AND entity_type.is_active
  ) THEN
    errors := array_append(errors, 'ENTITY_TYPE_INACTIVE');
  END IF;

  IF candidate.proposed_canonical_key IS NULL THEN
    errors := array_append(errors, 'CANONICAL_KEY_MISSING');
  ELSIF EXISTS (
    SELECT 1 FROM public.kb_entities entity
     WHERE entity.canonical_key = candidate.proposed_canonical_key
  ) THEN
    errors := array_append(errors, 'CANONICAL_KEY_TAKEN');
  END IF;
  IF candidate.proposed_canonical_key IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.kb_entity_candidates conflicting_candidate
     WHERE conflicting_candidate.id <> _entity_candidate_id
       AND conflicting_candidate.target_entity_id IS NULL
       AND conflicting_candidate.proposed_canonical_key = candidate.proposed_canonical_key
       AND conflicting_candidate.candidate_status = 'accepted_as_draft'
  ) THEN
    errors := array_append(errors, 'CANONICAL_KEY_CANDIDATE_CONFLICT');
  END IF;

  IF candidate.target_entity_id IS NOT NULL THEN
    errors := array_append(errors, 'EXISTING_ENTITY_REQUIRES_REVISION_WORKFLOW');
  END IF;
  IF candidate.source_candidate_id IS NULL THEN
    errors := array_append(errors, 'SOURCE_CANDIDATE_MISSING');
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.kb_source_candidates source
     WHERE source.id = candidate.source_candidate_id
       AND source.candidate_status = 'accepted_as_draft'
  ) THEN
    errors := array_append(errors, 'SOURCE_CANDIDATE_NOT_ACCEPTED');
  END IF;
  IF btrim(candidate.source_locator) = '' THEN
    errors := array_append(errors, 'SOURCE_LOCATOR_MISSING');
  END IF;
  IF btrim(candidate.ambiguity_notes) <> '' THEN
    errors := array_append(errors, 'AMBIGUITY_UNRESOLVED');
  END IF;

  IF NOT public.kb_text_array_is_canonical(candidate.aliases) THEN
    errors := array_append(errors, 'ALIASES_NOT_CANONICAL');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kb_entity_candidate_names candidate_name
     WHERE candidate_name.entity_candidate_id = _entity_candidate_id
       AND candidate_name.language_code = 'de'
       AND candidate_name.is_preferred
  ) THEN
    errors := array_append(errors, 'PREFERRED_NAME_MISSING');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kb_entity_candidate_names candidate_name
     WHERE candidate_name.entity_candidate_id = _entity_candidate_id
       AND candidate_name.language_code = 'de'
       AND candidate_name.is_preferred
       AND candidate_name.name = candidate.display_name
       AND candidate_name.normalized_name = public.kb_normalize_entity_candidate_name_v1(candidate.display_name)
  ) THEN
    errors := array_append(errors, 'DISPLAY_NAME_NOT_PREFERRED');
  END IF;
  SELECT COALESCE(
           array_agg(DISTINCT candidate_name.name COLLATE "C" ORDER BY candidate_name.name COLLATE "C")
             FILTER (WHERE NOT candidate_name.is_preferred),
           ARRAY[]::text[]
         )
    INTO typed_aliases
    FROM public.kb_entity_candidate_names candidate_name
   WHERE candidate_name.entity_candidate_id = _entity_candidate_id;
  IF candidate.aliases IS DISTINCT FROM typed_aliases THEN
    errors := array_append(errors, 'ALIASES_MISMATCH');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kb_entity_candidate_assertions assertion
     WHERE assertion.entity_candidate_id = _entity_candidate_id
  ) THEN
    errors := array_append(errors, 'ASSERTION_MISSING');
  END IF;
  SELECT count(*)::int INTO classification_count
    FROM public.kb_entity_candidate_assertions assertion
   WHERE assertion.entity_candidate_id = _entity_candidate_id
     AND assertion.assertion_kind = 'classification';
  IF classification_count = 0 THEN
    errors := array_append(errors, 'CLASSIFICATION_ASSERTION_MISSING');
  ELSIF classification_count > 1 THEN
    errors := array_append(errors, 'CLASSIFICATION_ASSERTION_AMBIGUOUS');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_assertions assertion
     WHERE assertion.entity_candidate_id = _entity_candidate_id
       AND NOT EXISTS (
         SELECT 1
           FROM public.kb_entity_candidate_assertion_sources assertion_source
          WHERE assertion_source.assertion_candidate_id = assertion.id
            AND assertion_source.is_primary
            AND assertion_source.source_role IN ('supports', 'qualifies')
            AND btrim(assertion_source.locator) <> ''
       )
  ) THEN
    errors := array_append(errors, 'ASSERTION_PRIMARY_SOURCE_MISSING');
  END IF;
  IF candidate.source_candidate_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_assertions assertion
      JOIN public.kb_entity_candidate_assertion_sources assertion_source
        ON assertion_source.assertion_candidate_id = assertion.id
     WHERE assertion.entity_candidate_id = _entity_candidate_id
       AND assertion.assertion_kind = 'classification'
       AND assertion_source.source_candidate_id = candidate.source_candidate_id
       AND assertion_source.is_primary
       AND assertion_source.source_role IN ('supports', 'qualifies')
  ) THEN
    errors := array_append(errors, 'CLASSIFICATION_SOURCE_BINDING_MISSING');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_assertion_sources assertion_source
      JOIN public.kb_source_candidates source
        ON source.id = assertion_source.source_candidate_id
     WHERE assertion_source.entity_candidate_id = _entity_candidate_id
       AND source.candidate_status <> 'accepted_as_draft'
  ) THEN
    errors := array_append(errors, 'ASSERTION_SOURCE_NOT_ACCEPTED');
  END IF;

  SELECT count(*)::int, min(detail.preparation_kind)
    INTO preparation_count, preparation_kind
    FROM public.kb_entity_candidate_preparation_details detail
   WHERE detail.entity_candidate_id = _entity_candidate_id;
  SELECT count(*)::int, min(detail.remedy_kind)
    INTO homeopathic_count, homeopathic_kind
    FROM public.kb_entity_candidate_homeopathic_details detail
   WHERE detail.entity_candidate_id = _entity_candidate_id;
  SELECT count(*)::int INTO botanical_count
    FROM public.kb_entity_candidate_botanical_details detail
   WHERE detail.entity_candidate_id = _entity_candidate_id;
  SELECT count(*)::int, min(detail.formulation_kind)
    INTO nutrient_count, nutrient_kind
    FROM public.kb_entity_candidate_nutrient_details detail
   WHERE detail.entity_candidate_id = _entity_candidate_id;
  SELECT count(*)::int INTO product_variant_count
    FROM public.kb_entity_candidate_product_variant_details detail
   WHERE detail.entity_candidate_id = _entity_candidate_id;
  SELECT count(*)::int INTO component_count
    FROM public.kb_entity_candidate_components component
   WHERE component.entity_candidate_id = _entity_candidate_id;
  SELECT count(DISTINCT COALESCE(
           component.component_candidate_id::text,
           'entity:' || component.component_entity_id::text
         ))::int
    INTO composition_bearing_component_count
    FROM public.kb_entity_candidate_components component
   WHERE component.entity_candidate_id = _entity_candidate_id
     AND component.component_role IN ('active', 'homeopathic_active', 'nutrient', 'extract');

  IF candidate.proposed_entity_type_code = 'preparation' THEN
    IF preparation_count <> 1 THEN
      errors := array_append(errors, 'PREPARATION_DETAILS_MISSING');
    END IF;
    IF product_variant_count <> 0 THEN
      errors := array_append(errors, 'PRODUCT_VARIANT_DETAILS_UNEXPECTED');
    END IF;
    IF preparation_count = 1 AND (
      COALESCE(
        preparation_kind IN ('homeopathic_single', 'homeopathic_complex', 'nosode', 'sarcode', 'isode'),
        false
      ) IS DISTINCT FROM (homeopathic_count = 1)
    ) THEN
      errors := array_append(errors, 'HOMEOPATHIC_DETAILS_MISMATCH');
    END IF;
    IF preparation_count = 1
       AND preparation_kind IN ('homeopathic_single', 'homeopathic_complex', 'nosode', 'sarcode', 'isode')
       AND (
         (preparation_kind = 'homeopathic_single' AND homeopathic_kind <> 'single')
         OR (preparation_kind = 'homeopathic_complex' AND homeopathic_kind <> 'complex')
         OR (preparation_kind = 'nosode' AND homeopathic_kind <> 'nosode')
         OR (preparation_kind = 'sarcode' AND homeopathic_kind <> 'sarcode')
         OR (preparation_kind = 'isode' AND homeopathic_kind <> 'isode')
       )
    THEN
      errors := array_append(errors, 'HOMEOPATHIC_KIND_MISMATCH');
    END IF;
    IF preparation_count = 1 AND (
      COALESCE(preparation_kind IN (
        'mother_tincture', 'herbal_tincture', 'fluid_extract', 'dry_extract',
        'essential_oil', 'herbal_tea'
      ), false)
    ) IS DISTINCT FROM (botanical_count = 1) THEN
      errors := array_append(errors, 'BOTANICAL_DETAILS_MISMATCH');
    END IF;
    IF preparation_count = 1 AND (
      COALESCE(preparation_kind IN (
        'nutrient_single', 'nutrient_combination', 'mineral', 'trace_element',
        'amino_acid', 'probiotic', 'enzyme', 'supplement'
      ), false)
    ) IS DISTINCT FROM (nutrient_count = 1) THEN
      errors := array_append(errors, 'NUTRIENT_DETAILS_MISMATCH');
    END IF;
    IF preparation_count = 1
       AND preparation_kind IN ('nutrient_single', 'nutrient_combination')
       AND (
         (preparation_kind = 'nutrient_single' AND nutrient_kind <> 'single')
         OR (preparation_kind = 'nutrient_combination' AND nutrient_kind <> 'combination')
       )
    THEN
      errors := array_append(errors, 'NUTRIENT_KIND_MISMATCH');
    END IF;
    IF (
         preparation_kind = 'homeopathic_complex'
         OR nutrient_kind = 'combination'
       )
       AND composition_bearing_component_count < 2
    THEN
      errors := array_append(errors, 'COMBINATION_COMPONENTS_INCOMPLETE');
    END IF;
    IF preparation_kind = 'homeopathic_complex' THEN
      errors := array_append(errors, 'HOMEOPATHIC_COMPLEX_POTENCY_UNMODELED');
    END IF;
  ELSIF candidate.proposed_entity_type_code = 'product_variant' THEN
    IF product_variant_count <> 1 THEN
      errors := array_append(errors, 'PRODUCT_VARIANT_DETAILS_MISSING');
    END IF;
    IF preparation_count + homeopathic_count + botanical_count + nutrient_count <> 0 THEN
      errors := array_append(errors, 'PREPARATION_DETAILS_UNEXPECTED');
    END IF;
  ELSIF preparation_count + homeopathic_count + botanical_count + nutrient_count
        + product_variant_count + component_count <> 0 THEN
    errors := array_append(errors, 'THERAPEUTIC_DETAILS_UNEXPECTED');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_product_variant_details detail
      LEFT JOIN public.kb_entities product ON product.id = detail.product_entity_id
      LEFT JOIN public.kb_entity_revisions product_revision
        ON product_revision.entity_id = detail.product_entity_id
       AND product_revision.id = detail.product_revision_id
      LEFT JOIN public.kb_entity_candidates product_candidate
        ON product_candidate.id = detail.product_candidate_id
      LEFT JOIN public.kb_entity_candidate_contracts product_contract
        ON product_contract.entity_candidate_id = detail.product_candidate_id
     WHERE detail.entity_candidate_id = _entity_candidate_id
       AND (
         (detail.product_candidate_id IS NULL AND (
           product.entity_type_code IS DISTINCT FROM 'product'
           OR product.lifecycle_status <> 'active'
           OR product_revision.id IS NULL
         ))
         OR (detail.product_candidate_id IS NOT NULL AND (
           product_candidate.proposed_entity_type_code IS DISTINCT FROM 'product'
           OR product_contract.entity_candidate_id IS NULL
         ))
       )
  ) THEN
    errors := array_append(errors, 'PRODUCT_REFERENCE_INVALID');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_product_variant_details detail
      LEFT JOIN public.kb_entities preparation ON preparation.id = detail.preparation_entity_id
      LEFT JOIN public.kb_entity_revisions preparation_revision
        ON preparation_revision.entity_id = detail.preparation_entity_id
       AND preparation_revision.id = detail.preparation_revision_id
      LEFT JOIN public.kb_entity_candidates preparation_candidate
        ON preparation_candidate.id = detail.preparation_candidate_id
      LEFT JOIN public.kb_entity_candidate_contracts preparation_contract
        ON preparation_contract.entity_candidate_id = detail.preparation_candidate_id
     WHERE detail.entity_candidate_id = _entity_candidate_id
       AND (
         (detail.preparation_candidate_id IS NULL AND (
           preparation.entity_type_code IS DISTINCT FROM 'preparation'
           OR preparation.lifecycle_status <> 'active'
           OR preparation_revision.id IS NULL
         ))
         OR (detail.preparation_candidate_id IS NOT NULL AND (
           preparation_candidate.proposed_entity_type_code IS DISTINCT FROM 'preparation'
           OR preparation_contract.entity_candidate_id IS NULL
         ))
       )
  ) THEN
    errors := array_append(errors, 'PREPARATION_REFERENCE_INVALID');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_components component
      LEFT JOIN public.kb_entities component_entity ON component_entity.id = component.component_entity_id
      LEFT JOIN public.kb_entity_revisions component_revision
        ON component_revision.entity_id = component.component_entity_id
       AND component_revision.id = component.component_revision_id
      LEFT JOIN public.kb_entity_candidates component_candidate
        ON component_candidate.id = component.component_candidate_id
      LEFT JOIN public.kb_entity_candidate_contracts component_contract
        ON component_contract.entity_candidate_id = component.component_candidate_id
     WHERE component.entity_candidate_id = _entity_candidate_id
       AND (
         (component.component_candidate_id IS NULL AND (
           component_entity.entity_type_code NOT IN ('substance', 'plant', 'nutrient', 'preparation')
           OR component_entity.lifecycle_status <> 'active'
           OR component_revision.id IS NULL
         ))
         OR (component.component_candidate_id IS NOT NULL AND (
           component_candidate.proposed_entity_type_code NOT IN ('substance', 'plant', 'nutrient', 'preparation')
           OR component_contract.entity_candidate_id IS NULL
         ))
       )
  ) THEN
    errors := array_append(errors, 'COMPONENT_REFERENCE_INVALID');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM (
        SELECT product_candidate_id AS dependency_id
          FROM public.kb_entity_candidate_product_variant_details
         WHERE entity_candidate_id = _entity_candidate_id
        UNION ALL
        SELECT preparation_candidate_id
          FROM public.kb_entity_candidate_product_variant_details
         WHERE entity_candidate_id = _entity_candidate_id
        UNION ALL
        SELECT component_candidate_id
          FROM public.kb_entity_candidate_components
         WHERE entity_candidate_id = _entity_candidate_id
      ) dependency
      JOIN public.kb_entity_candidates dependency_candidate ON dependency_candidate.id = dependency.dependency_id
     WHERE dependency.dependency_id IS NOT NULL
       AND dependency_candidate.candidate_status <> 'accepted_as_draft'
  ) THEN
    errors := array_append(errors, 'CANDIDATE_DEPENDENCY_NOT_ACCEPTED');
  END IF;
  IF NOT public.kb_entity_candidate_dependency_contracts_are_valid(_entity_candidate_id) THEN
    errors := array_append(errors, 'CANDIDATE_DEPENDENCY_CONTRACT_INVALID');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.kb_entity_candidate_components component
     WHERE component.entity_candidate_id = _entity_candidate_id
       AND component.chemical_form_status = 'unknown'
  ) THEN
    errors := array_append(errors, 'COMPONENT_CHEMICAL_FORM_UNRESOLVED');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.kb_entity_candidate_components component
     WHERE component.entity_candidate_id = _entity_candidate_id
       AND component.amount_status = 'unknown'
  ) THEN
    errors := array_append(errors, 'COMPONENT_AMOUNT_UNRESOLVED');
  END IF;
  IF EXISTS (
    WITH basis_ids AS (
      SELECT basis_assertion_candidate_id AS assertion_id
        FROM public.kb_entity_candidate_preparation_details
       WHERE entity_candidate_id = _entity_candidate_id
      UNION SELECT basis_assertion_candidate_id FROM public.kb_entity_candidate_homeopathic_details
       WHERE entity_candidate_id = _entity_candidate_id
      UNION SELECT basis_assertion_candidate_id FROM public.kb_entity_candidate_botanical_details
       WHERE entity_candidate_id = _entity_candidate_id
      UNION SELECT basis_assertion_candidate_id FROM public.kb_entity_candidate_nutrient_details
       WHERE entity_candidate_id = _entity_candidate_id
      UNION SELECT basis_assertion_candidate_id FROM public.kb_entity_candidate_product_variant_details
       WHERE entity_candidate_id = _entity_candidate_id
      UNION SELECT basis_assertion_candidate_id FROM public.kb_entity_candidate_components
       WHERE entity_candidate_id = _entity_candidate_id
    )
    SELECT 1
      FROM basis_ids basis
      JOIN public.kb_entity_candidate_assertions assertion ON assertion.id = basis.assertion_id
     WHERE assertion.assertion_kind <> 'classification'
  ) THEN
    errors := array_append(errors, 'CATALOG_BASIS_ASSERTION_INVALID');
  END IF;

  SELECT COALESCE(
           array_agg(DISTINCT error_code COLLATE "C" ORDER BY error_code COLLATE "C"),
           ARRAY[]::text[]
         )
    INTO errors
    FROM unnest(errors) AS listed(error_code);
  RETURN errors;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_entity_candidate_contract_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  candidate_id uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'Entity candidate contract rows are append-only';
  END IF;
  candidate_id := (to_jsonb(NEW) ->> 'entity_candidate_id')::uuid;
  IF TG_TABLE_NAME <> 'kb_entity_candidate_contracts' AND EXISTS (
    SELECT 1 FROM public.kb_entity_candidate_contracts contract
     WHERE contract.entity_candidate_id = candidate_id
  ) THEN
    RAISE EXCEPTION 'Sealed entity candidate contracts cannot receive additional rows';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_validate_entity_candidate_contract_seal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  candidate_status text;
  candidate_batch_id uuid;
  expected_hash text;
BEGIN
  SELECT candidate.candidate_status, candidate.batch_id
    INTO candidate_status, candidate_batch_id
    FROM public.kb_entity_candidates candidate
   WHERE candidate.id = NEW.entity_candidate_id;
  IF candidate_status IS NULL OR candidate_batch_id IS DISTINCT FROM NEW.batch_id THEN
    RAISE EXCEPTION 'Entity candidate contract owner is invalid';
  END IF;
  IF candidate_status <> 'imported_unreviewed' THEN
    RAISE EXCEPTION 'Only imported_unreviewed entity candidates may be sealed';
  END IF;
  PERFORM public.kb_lock_entity_candidate_contract_revisions(NEW.entity_candidate_id);
  IF NOT public.kb_entity_candidate_dependency_contracts_are_valid(NEW.entity_candidate_id) THEN
    RAISE EXCEPTION 'Referenced entity candidate contracts are missing or invalid';
  END IF;

  expected_hash := public.kb_entity_candidate_contract_hash(
    NEW.entity_candidate_id,
    NEW.summary,
    NEW.contract_metadata
  );
  IF expected_hash IS NULL OR NEW.contract_hash IS DISTINCT FROM expected_hash THEN
    RAISE EXCEPTION 'Entity candidate contract hash is invalid';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_enforce_entity_candidate_contract_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  error_codes text[];
BEGIN
  IF NEW.candidate_status = 'accepted_as_draft'
     AND OLD.candidate_status IS DISTINCT FROM NEW.candidate_status
  THEN
    error_codes := public.kb_entity_candidate_contract_error_codes(NEW.id);
    IF cardinality(error_codes) > 0 THEN
      RAISE EXCEPTION 'Entity candidate requires needs_clarification: %', array_to_string(error_codes, ',');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_seal_entity_candidate_contract(
  _entity_candidate_id uuid,
  _summary text DEFAULT '',
  _contract_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  sealed_contract_hash text,
  was_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  candidate public.kb_entity_candidates%ROWTYPE;
  candidate_batch_id uuid;
  batch_status text;
  existing_contract public.kb_entity_candidate_contracts%ROWTYPE;
  existing_contract_found boolean;
  calculated_hash text;
  normalized_summary text := COALESCE(_summary, '');
  normalized_metadata jsonb := COALESCE(_contract_metadata, '{}'::jsonb);
BEGIN
  IF jsonb_typeof(normalized_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Entity candidate contract metadata must be an object';
  END IF;

  SELECT candidate_row.batch_id INTO candidate_batch_id
    FROM public.kb_entity_candidates candidate_row
   WHERE candidate_row.id = _entity_candidate_id;
  IF candidate_batch_id IS NULL THEN
    RAISE EXCEPTION 'Entity candidate not found';
  END IF;

  SELECT batch.batch_status INTO batch_status
    FROM public.kb_import_batches batch
   WHERE batch.id = candidate_batch_id
   FOR UPDATE;
  SELECT candidate_row.* INTO STRICT candidate
    FROM public.kb_entity_candidates candidate_row
   WHERE candidate_row.id = _entity_candidate_id
     AND candidate_row.batch_id = candidate_batch_id
   FOR UPDATE;

  SELECT * INTO existing_contract
    FROM public.kb_entity_candidate_contracts
   WHERE entity_candidate_id = _entity_candidate_id;
  existing_contract_found := FOUND;
  PERFORM public.kb_lock_entity_candidate_contract_revisions(_entity_candidate_id);
  IF NOT public.kb_entity_candidate_dependency_contracts_are_valid(_entity_candidate_id) THEN
    RAISE EXCEPTION 'Referenced entity candidate contracts are missing or invalid';
  END IF;
  IF existing_contract_found THEN
    IF existing_contract.summary IS DISTINCT FROM normalized_summary
       OR existing_contract.contract_metadata IS DISTINCT FROM normalized_metadata
       OR existing_contract.contract_hash IS DISTINCT FROM public.kb_entity_candidate_contract_hash(
         _entity_candidate_id,
         existing_contract.summary,
         existing_contract.contract_metadata
       )
    THEN
      RAISE EXCEPTION 'Existing entity candidate contract failed its integrity check';
    END IF;
    RETURN QUERY SELECT existing_contract.contract_hash, false;
    RETURN;
  END IF;

  IF batch_status NOT IN ('created', 'processing') THEN
    RAISE EXCEPTION 'Entity candidate contracts require an open import batch';
  END IF;
  IF candidate.candidate_status <> 'imported_unreviewed' THEN
    RAISE EXCEPTION 'Only imported_unreviewed entity candidates may be sealed';
  END IF;

  calculated_hash := public.kb_entity_candidate_contract_hash(
    _entity_candidate_id,
    normalized_summary,
    normalized_metadata
  );
  INSERT INTO public.kb_entity_candidate_contracts (
    entity_candidate_id,
    batch_id,
    summary,
    contract_metadata,
    contract_hash
  ) VALUES (
    _entity_candidate_id,
    candidate.batch_id,
    normalized_summary,
    normalized_metadata,
    calculated_hash
  );

  RETURN QUERY SELECT calculated_hash, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_entity_candidate_promotion_readiness(
  _entity_candidate_id uuid
)
RETURNS TABLE (
  entity_candidate_id uuid,
  contract_version integer,
  contract_hash text,
  ready_for_promotion boolean,
  blocking_reason_codes text[],
  warning_reason_codes text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reviewer_id uuid := auth.uid();
  candidate public.kb_entity_candidates%ROWTYPE;
  contract public.kb_entity_candidate_contracts%ROWTYPE;
  parent_batch_status text;
  accept_decision_count integer;
  blocking_codes text[];
  warning_codes text[] := ARRAY[]::text[];
BEGIN
  IF reviewer_id IS NULL OR NOT public.has_role(reviewer_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators may inspect entity candidate promotion readiness';
  END IF;

  SELECT * INTO candidate
    FROM public.kb_entity_candidates
   WHERE id = _entity_candidate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entity candidate not found';
  END IF;
  SELECT stored_contract.* INTO contract
    FROM public.kb_entity_candidate_contracts stored_contract
   WHERE stored_contract.entity_candidate_id = _entity_candidate_id;
  SELECT batch.batch_status INTO parent_batch_status
    FROM public.kb_import_batches batch
   WHERE batch.id = candidate.batch_id;

  blocking_codes := public.kb_entity_candidate_contract_error_codes(_entity_candidate_id);
  IF parent_batch_status <> 'reviewed' THEN
    blocking_codes := array_append(blocking_codes, 'BATCH_NOT_REVIEWED');
  END IF;
  IF candidate.candidate_status <> 'accepted_as_draft' THEN
    blocking_codes := array_append(blocking_codes, 'CANDIDATE_NOT_ACCEPTED');
  END IF;
  SELECT count(*)::int INTO accept_decision_count
    FROM public.kb_review_decisions decision
   WHERE decision.candidate_kind = 'entity'
     AND decision.candidate_id = _entity_candidate_id
     AND decision.decision = 'accept_as_draft'
     AND decision.status_after = 'accepted_as_draft';
  IF accept_decision_count = 0 THEN
    blocking_codes := array_append(blocking_codes, 'ACCEPT_DECISION_MISSING');
  ELSIF accept_decision_count > 1 THEN
    blocking_codes := array_append(blocking_codes, 'ACCEPT_DECISION_AMBIGUOUS');
  END IF;

  IF candidate.source_candidate_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.kb_source_candidate_draft_promotions promotion
     WHERE promotion.source_candidate_id = candidate.source_candidate_id
  ) THEN
    blocking_codes := array_append(blocking_codes, 'SOURCE_PROMOTION_MISSING');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_assertion_sources assertion_source
      LEFT JOIN public.kb_source_candidate_draft_promotions promotion
        ON promotion.source_candidate_id = assertion_source.source_candidate_id
     WHERE assertion_source.entity_candidate_id = _entity_candidate_id
       AND promotion.source_candidate_id IS NULL
  ) THEN
    blocking_codes := array_append(blocking_codes, 'ASSERTION_SOURCE_PROMOTION_MISSING');
  END IF;
  IF candidate.source_candidate_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.kb_source_candidate_draft_promotions promotion
        WHERE promotion.source_candidate_id = candidate.source_candidate_id
     )
     AND NOT public.kb_source_candidate_promotion_is_valid(candidate.source_candidate_id)
  THEN
    blocking_codes := array_append(blocking_codes, 'SOURCE_PROMOTION_INVALID');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_candidate_assertion_sources assertion_source
     WHERE assertion_source.entity_candidate_id = _entity_candidate_id
       AND EXISTS (
         SELECT 1 FROM public.kb_source_candidate_draft_promotions promotion
          WHERE promotion.source_candidate_id = assertion_source.source_candidate_id
       )
       AND NOT public.kb_source_candidate_promotion_is_valid(assertion_source.source_candidate_id)
  ) THEN
    blocking_codes := array_append(blocking_codes, 'ASSERTION_SOURCE_PROMOTION_INVALID');
  END IF;
  IF EXISTS (
    SELECT 1
      FROM (
        SELECT product_detail.product_candidate_id AS dependency_id
          FROM public.kb_entity_candidate_product_variant_details product_detail
         WHERE product_detail.entity_candidate_id = _entity_candidate_id
        UNION ALL
        SELECT preparation_detail.preparation_candidate_id
          FROM public.kb_entity_candidate_product_variant_details preparation_detail
         WHERE preparation_detail.entity_candidate_id = _entity_candidate_id
        UNION ALL
        SELECT component.component_candidate_id
          FROM public.kb_entity_candidate_components component
         WHERE component.entity_candidate_id = _entity_candidate_id
      ) dependency
     WHERE dependency.dependency_id IS NOT NULL
  ) THEN
    blocking_codes := array_append(blocking_codes, 'CANDIDATE_DEPENDENCY_PROMOTION_PENDING');
  END IF;

  IF candidate.proposed_data <> '{}'::jsonb THEN
    warning_codes := array_append(warning_codes, 'UNSTRUCTURED_PROPOSED_DATA_PRESENT');
  END IF;

  SELECT COALESCE(
           array_agg(DISTINCT code COLLATE "C" ORDER BY code COLLATE "C"),
           ARRAY[]::text[]
         )
    INTO blocking_codes
    FROM unnest(blocking_codes) AS listed(code);
  SELECT COALESCE(
           array_agg(DISTINCT code COLLATE "C" ORDER BY code COLLATE "C"),
           ARRAY[]::text[]
         )
    INTO warning_codes
    FROM unnest(warning_codes) AS listed(code);

  RETURN QUERY SELECT
    _entity_candidate_id,
    contract.contract_version,
    contract.contract_hash,
    cardinality(blocking_codes) = 0,
    blocking_codes,
    warning_codes;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_entity_candidate_contract_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH terminal_entity_decisions AS (
    SELECT decision.*
      FROM public.kb_review_decisions decision
     WHERE decision.candidate_kind = 'entity'
       AND decision.status_after IN ('accepted_as_draft', 'rejected', 'duplicate')
  ), invalid_candidates AS (
    SELECT contract.entity_candidate_id
      FROM public.kb_entity_candidate_contracts contract
     WHERE contract.contract_hash IS DISTINCT FROM public.kb_entity_candidate_contract_hash(
       contract.entity_candidate_id,
       contract.summary,
       contract.contract_metadata
     )
    UNION
    SELECT candidate.id
      FROM public.kb_entity_candidates candidate
     WHERE candidate.candidate_status = 'accepted_as_draft'
       AND cardinality(public.kb_entity_candidate_contract_error_codes(candidate.id)) > 0
    UNION
    SELECT candidate.id
      FROM public.kb_entity_candidates candidate
      LEFT JOIN terminal_entity_decisions terminal
        ON terminal.candidate_id = candidate.id
     WHERE candidate.candidate_status IN ('accepted_as_draft', 'rejected', 'duplicate')
       AND (
         terminal.candidate_id IS NULL
         OR terminal.status_after IS DISTINCT FROM candidate.candidate_status
         OR terminal.status_before NOT IN ('imported_unreviewed', 'needs_clarification')
         OR terminal.decision IS DISTINCT FROM CASE candidate.candidate_status
           WHEN 'accepted_as_draft' THEN 'accept_as_draft'
           WHEN 'rejected' THEN 'reject'
           WHEN 'duplicate' THEN 'mark_duplicate'
         END
         OR terminal.decided_by IS DISTINCT FROM candidate.reviewed_by
         OR terminal.decided_at IS DISTINCT FROM candidate.reviewed_at
         OR (
           SELECT count(*) FROM terminal_entity_decisions counted_terminal
            WHERE counted_terminal.candidate_id = candidate.id
         ) <> 1
       )
    UNION
    SELECT decision.candidate_id
      FROM public.kb_review_decisions decision
      LEFT JOIN public.kb_entity_candidates candidate ON candidate.id = decision.candidate_id
     WHERE decision.candidate_kind = 'entity'
       AND (
         candidate.id IS NULL
         OR decision.status_before NOT IN ('imported_unreviewed', 'needs_clarification')
         OR decision.status_after IS DISTINCT FROM CASE decision.decision
           WHEN 'accept_as_draft' THEN 'accepted_as_draft'
           WHEN 'reject' THEN 'rejected'
           WHEN 'needs_clarification' THEN 'needs_clarification'
           WHEN 'mark_duplicate' THEN 'duplicate'
         END
         OR (
           decision.status_after IN ('accepted_as_draft', 'rejected', 'duplicate')
           AND candidate.candidate_status IS DISTINCT FROM decision.status_after
         )
       )
  )
  SELECT count(*) FROM invalid_candidates
$$;

DO $$
DECLARE
  contract_table text;
BEGIN
  FOREACH contract_table IN ARRAY ARRAY[
    'kb_entity_candidate_contracts',
    'kb_entity_candidate_names',
    'kb_entity_candidate_assertions',
    'kb_entity_candidate_assertion_sources',
    'kb_entity_candidate_preparation_details',
    'kb_entity_candidate_homeopathic_details',
    'kb_entity_candidate_botanical_details',
    'kb_entity_candidate_nutrient_details',
    'kb_entity_candidate_product_variant_details',
    'kb_entity_candidate_components'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.kb_require_open_import_batch()',
      contract_table || '_open_batch',
      contract_table
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.kb_protect_entity_candidate_contract_row()',
      contract_table || '_protect_row',
      contract_table
    );
  END LOOP;
END;
$$;

CREATE TRIGGER kb_entity_candidate_contracts_validate_seal
  BEFORE INSERT ON public.kb_entity_candidate_contracts
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_entity_candidate_contract_seal();

CREATE TRIGGER kb_entity_candidates_validate_contract_acceptance
  BEFORE UPDATE ON public.kb_entity_candidates
  FOR EACH ROW EXECUTE FUNCTION public.kb_enforce_entity_candidate_contract_acceptance();

DO $$
DECLARE
  contract_table text;
BEGIN
  FOREACH contract_table IN ARRAY ARRAY[
    'kb_entity_candidate_contracts',
    'kb_entity_candidate_names',
    'kb_entity_candidate_assertions',
    'kb_entity_candidate_assertion_sources',
    'kb_entity_candidate_preparation_details',
    'kb_entity_candidate_homeopathic_details',
    'kb_entity_candidate_botanical_details',
    'kb_entity_candidate_nutrient_details',
    'kb_entity_candidate_product_variant_details',
    'kb_entity_candidate_components'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', contract_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role))',
      contract_table || '_admin_read',
      contract_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO kb_importer USING (true)',
      contract_table || '_importer_read',
      contract_table
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  child_table text;
BEGIN
  FOREACH child_table IN ARRAY ARRAY[
    'kb_entity_candidate_names',
    'kb_entity_candidate_assertions',
    'kb_entity_candidate_assertion_sources',
    'kb_entity_candidate_preparation_details',
    'kb_entity_candidate_homeopathic_details',
    'kb_entity_candidate_botanical_details',
    'kb_entity_candidate_nutrient_details',
    'kb_entity_candidate_product_variant_details',
    'kb_entity_candidate_components'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO kb_importer WITH CHECK (data_classification = ''general_knowledge'')',
      child_table || '_importer_insert',
      child_table
    );
  END LOOP;
END;
$$;

REVOKE ALL ON TABLE
  public.kb_entity_candidate_contracts,
  public.kb_entity_candidate_names,
  public.kb_entity_candidate_assertions,
  public.kb_entity_candidate_assertion_sources,
  public.kb_entity_candidate_preparation_details,
  public.kb_entity_candidate_homeopathic_details,
  public.kb_entity_candidate_botanical_details,
  public.kb_entity_candidate_nutrient_details,
  public.kb_entity_candidate_product_variant_details,
  public.kb_entity_candidate_components
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

GRANT SELECT ON TABLE
  public.kb_entity_candidate_contracts,
  public.kb_entity_candidate_names,
  public.kb_entity_candidate_assertions,
  public.kb_entity_candidate_assertion_sources,
  public.kb_entity_candidate_preparation_details,
  public.kb_entity_candidate_homeopathic_details,
  public.kb_entity_candidate_botanical_details,
  public.kb_entity_candidate_nutrient_details,
  public.kb_entity_candidate_product_variant_details,
  public.kb_entity_candidate_components
TO authenticated, service_role, kb_importer;

GRANT INSERT ON TABLE
  public.kb_entity_candidate_names,
  public.kb_entity_candidate_assertions,
  public.kb_entity_candidate_assertion_sources,
  public.kb_entity_candidate_preparation_details,
  public.kb_entity_candidate_homeopathic_details,
  public.kb_entity_candidate_botanical_details,
  public.kb_entity_candidate_nutrient_details,
  public.kb_entity_candidate_product_variant_details,
  public.kb_entity_candidate_components
TO kb_importer;

REVOKE ALL ON FUNCTION public.kb_normalize_entity_candidate_name_v1(text)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_contract_payload(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_contract_hash(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_dependency_contracts_are_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_lock_entity_candidate_contract_revisions(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_source_candidate_promotion_is_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_contract_error_codes(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_entity_candidate_contract_row()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_validate_entity_candidate_contract_seal()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_enforce_entity_candidate_contract_acceptance()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_seal_entity_candidate_contract(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_entity_candidate_promotion_readiness(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_entity_candidate_contract_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

GRANT EXECUTE ON FUNCTION public.kb_normalize_entity_candidate_name_v1(text)
  TO kb_importer;
GRANT EXECUTE ON FUNCTION public.kb_text_array_is_canonical(text[])
  TO kb_importer;
GRANT EXECUTE ON FUNCTION public.kb_seal_entity_candidate_contract(uuid, text, jsonb)
  TO kb_importer;
GRANT EXECUTE ON FUNCTION public.kb_entity_candidate_promotion_readiness(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.kb_export_wiki_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  wiki_table text;
  table_rows jsonb;
  tables_json jsonb := '{}'::jsonb;
  manifest_json jsonb := '{}'::jsonb;
  validation_json jsonb;
  invalid_source_promotions bigint := 0;
  invalid_therapeutic_catalog_revisions bigint := 0;
  invalid_entity_candidate_contracts bigint := 0;
BEGIN
  FOR wiki_table IN
    SELECT listed_table.table_name
      FROM (
        SELECT unnest(ARRAY[
          'admin_knowledge_base',
          'mannayan_products',
          'knowledge_product_links',
          'faqs',
          'practice_pricing',
          'practice_info'
        ]) AS table_name
        UNION
        SELECT tables.tablename
          FROM pg_catalog.pg_tables tables
         WHERE tables.schemaname = 'public'
           AND tables.tablename LIKE 'kb\_%' ESCAPE '\'
      ) listed_table
     ORDER BY listed_table.table_name
  LOOP
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(table_row) ORDER BY to_jsonb(table_row)::text), ''[]''::jsonb) FROM public.%I table_row',
      wiki_table
    ) INTO table_rows;
    tables_json := tables_json || jsonb_build_object(wiki_table, table_rows);
    manifest_json := manifest_json || jsonb_build_object(
      wiki_table,
      jsonb_build_object(
        'rows', jsonb_array_length(table_rows),
        'sha256', public.kb_snapshot_rows_hash(table_rows)
      )
    );
  END LOOP;

  SELECT jsonb_build_object(
    'legacy_rows', (SELECT count(*) FROM public.admin_knowledge_base),
    'mapped_articles', (SELECT count(*) FROM public.kb_articles WHERE legacy_knowledge_entry_id IS NOT NULL),
    'legacy_snapshot_revisions', (SELECT count(*) FROM public.kb_article_revisions WHERE origin_type = 'legacy_snapshot'),
    'missing_articles', (
      SELECT count(*)
        FROM public.admin_knowledge_base legacy_row
        LEFT JOIN public.kb_articles article
          ON article.legacy_knowledge_entry_id = legacy_row.id
       WHERE article.id IS NULL
    ),
    'invalid_current_snapshots', (
      SELECT count(*)
        FROM public.admin_knowledge_base legacy_row
        JOIN public.kb_articles article
          ON article.legacy_knowledge_entry_id = legacy_row.id
        LEFT JOIN public.kb_article_revisions revision
          ON revision.id = article.current_revision_id
         AND revision.article_id = article.id
       WHERE article.canonical_key IS DISTINCT FROM 'legacy:' || legacy_row.id::text
          OR article.article_kind IS DISTINCT FROM legacy_row.entry_kind
          OR article.lifecycle_status IS DISTINCT FROM 'active'
          OR article.metadata ->> 'bridge_source' IS DISTINCT FROM 'public.admin_knowledge_base'
          OR article.metadata ->> 'bridge_version' IS DISTINCT FROM '1'
          OR article.metadata ->> 'legacy_knowledge_entry_id' IS DISTINCT FROM legacy_row.id::text
          OR revision.id IS NULL
          OR revision.origin_type IS DISTINCT FROM 'legacy_snapshot'
          OR revision.title IS DISTINCT FROM legacy_row.title
          OR revision.category_path IS DISTINCT FROM legacy_row.category
          OR revision.tags IS DISTINCT FROM legacy_row.tags
          OR revision.content_markdown IS DISTINCT FROM legacy_row.content
          OR (revision.metadata -> 'legacy_metadata') - 'updated_at'
             IS DISTINCT FROM (to_jsonb(legacy_row) - ARRAY['id', 'title', 'category', 'tags', 'content', 'updated_at'])
          OR revision.content_hash IS DISTINCT FROM public.kb_legacy_article_hash(to_jsonb(legacy_row))
    ),
    'orphaned_active_articles', (
      SELECT count(*)
        FROM public.kb_articles article
        LEFT JOIN public.admin_knowledge_base legacy_row
          ON legacy_row.id = article.legacy_knowledge_entry_id
       WHERE article.legacy_knowledge_entry_id IS NOT NULL
         AND article.lifecycle_status = 'active'
         AND legacy_row.id IS NULL
    )
  ) INTO validation_json;

  IF to_regclass('public.kb_source_candidate_draft_promotions') IS NOT NULL THEN
    EXECUTE $promotion_validation$
      SELECT count(*)
        FROM public.kb_source_candidate_draft_promotions promotion
        LEFT JOIN public.kb_source_candidates candidate
          ON candidate.id = promotion.source_candidate_id
         AND candidate.batch_id = promotion.batch_id
        LEFT JOIN public.kb_import_batches batch ON batch.id = promotion.batch_id
        LEFT JOIN public.kb_review_decisions decision ON decision.id = promotion.review_decision_id
        LEFT JOIN public.kb_sources source ON source.id = promotion.source_id
        LEFT JOIN public.kb_source_revisions revision
          ON revision.id = promotion.source_revision_id
         AND revision.source_id = promotion.source_id
       WHERE candidate.id IS NULL
          OR candidate.candidate_status IS DISTINCT FROM 'accepted_as_draft'
          OR candidate.target_source_id IS NOT NULL
          OR candidate.data_classification IS DISTINCT FROM 'general_knowledge'
          OR batch.batch_status IS DISTINCT FROM 'reviewed'
          OR decision.candidate_kind IS DISTINCT FROM 'source'
          OR decision.candidate_id IS DISTINCT FROM promotion.source_candidate_id
          OR decision.decision IS DISTINCT FROM 'accept_as_draft'
          OR decision.status_after IS DISTINCT FROM 'accepted_as_draft'
          OR decision.data_classification IS DISTINCT FROM 'general_knowledge'
          OR source.canonical_key IS DISTINCT FROM promotion.selected_canonical_key
          OR source.created_by IS DISTINCT FROM promotion.promoted_by
          OR source.metadata -> 'origin_type' IS DISTINCT FROM to_jsonb('import'::text)
          OR source.metadata -> 'source_candidate_id' IS DISTINCT FROM to_jsonb(promotion.source_candidate_id::text)
          OR source.metadata -> 'import_batch_id' IS DISTINCT FROM to_jsonb(promotion.batch_id::text)
          OR source.metadata -> 'conversion_version' IS DISTINCT FROM to_jsonb(promotion.conversion_version)
          OR revision.id IS NULL
          OR revision.revision_no IS DISTINCT FROM 1
          OR revision.created_by IS DISTINCT FROM promotion.promoted_by
          OR revision.metadata -> 'origin_type' IS DISTINCT FROM to_jsonb('import'::text)
          OR revision.metadata -> 'source_candidate_id' IS DISTINCT FROM to_jsonb(promotion.source_candidate_id::text)
          OR revision.metadata -> 'import_batch_id' IS DISTINCT FROM to_jsonb(promotion.batch_id::text)
          OR revision.metadata -> 'review_decision_id' IS DISTINCT FROM to_jsonb(promotion.review_decision_id::text)
          OR revision.metadata -> 'conversion_version' IS DISTINCT FROM to_jsonb(promotion.conversion_version)
          OR promotion.data_classification IS DISTINCT FROM 'general_knowledge'
          OR promotion.initial_content_hash IS DISTINCT FROM encode(sha256(convert_to(jsonb_build_object(
            'source_type', promotion.selected_source_type,
            'title', candidate.title,
            'publisher', NULLIF(btrim(candidate.publisher), ''),
            'published_on', candidate.publication_date,
            'url', NULLIF(btrim(candidate.source_url), ''),
            'rights_status', candidate.rights_status
          )::text, 'UTF8')), 'hex')
    $promotion_validation$ INTO invalid_source_promotions;
  END IF;

  IF to_regprocedure('public.kb_invalid_therapeutic_catalog_revision_count()') IS NOT NULL THEN
    EXECUTE 'SELECT public.kb_invalid_therapeutic_catalog_revision_count()'
      INTO invalid_therapeutic_catalog_revisions;
  END IF;
  SELECT public.kb_invalid_entity_candidate_contract_count()
    INTO invalid_entity_candidate_contracts;

  validation_json := validation_json || jsonb_build_object(
    'invalid_source_promotions', invalid_source_promotions,
    'invalid_therapeutic_catalog_revisions', invalid_therapeutic_catalog_revisions,
    'invalid_entity_candidate_contracts', invalid_entity_candidate_contracts
  );

  RETURN jsonb_build_object(
    'tables', tables_json,
    'manifest', manifest_json,
    'validation', validation_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kb_export_wiki_snapshot()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kb_export_wiki_snapshot()
  TO service_role;

COMMIT;
