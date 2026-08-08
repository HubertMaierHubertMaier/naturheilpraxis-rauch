BEGIN;

INSERT INTO public.kb_entity_types (code, label, description)
VALUES (
  'preparation',
  'Preparation',
  'Therapeutically distinct preparation between source material and a product variant'
);

INSERT INTO public.kb_relation_types (code, label, description, is_symmetric) VALUES
  ('prepared_from', 'Prepared from', 'Preparation source material', false),
  ('realizes_preparation', 'Realizes preparation', 'Exact preparation represented by a product variant', false),
  ('variant_of', 'Variant of', 'Product family represented by a product variant', false),
  ('complementary_to', 'Complementary to', 'Complementary preparations', true),
  ('follows_well', 'Follows well', 'Directed preparation sequence', false),
  ('antidotes', 'Antidotes', 'Directed antidoting preparation relationship', false),
  ('inimical_with', 'Inimical with', 'Incompatible preparations', true);

INSERT INTO public.kb_relation_type_domains (
  relation_type_code,
  subject_entity_type_code,
  object_entity_type_code
)
SELECT relation_type_code, subject_entity_type_code, object_entity_type_code
FROM (
  VALUES
    ('prepared_from', 'preparation', 'plant'),
    ('prepared_from', 'preparation', 'substance'),
    ('prepared_from', 'preparation', 'nutrient'),
    ('prepared_from', 'preparation', 'pathogen'),
    ('realizes_preparation', 'product_variant', 'preparation'),
    ('variant_of', 'product_variant', 'product'),
    ('complementary_to', 'preparation', 'preparation'),
    ('follows_well', 'preparation', 'preparation'),
    ('antidotes', 'preparation', 'preparation'),
    ('inimical_with', 'preparation', 'preparation'),
    ('contains', 'preparation', 'substance'),
    ('contains', 'preparation', 'plant'),
    ('contains', 'preparation', 'nutrient'),
    ('contains', 'preparation', 'preparation'),
    ('contains', 'product', 'preparation'),
    ('contains', 'product_variant', 'preparation'),
    ('targets_pathogen', 'preparation', 'pathogen'),
    ('indicated_for', 'preparation', 'symptom'),
    ('indicated_for', 'preparation', 'disease'),
    ('indicated_for', 'preparation', 'lab_finding_definition'),
    ('may_support', 'preparation', 'symptom'),
    ('may_support', 'preparation', 'disease'),
    ('may_support', 'preparation', 'organ'),
    ('may_support', 'preparation', 'tissue'),
    ('part_of_protocol', 'preparation', 'protocol'),
    ('alternative_to', 'preparation', 'preparation'),
    ('contraindicated_for', 'preparation', 'population_group'),
    ('contraindicated_for', 'preparation', 'disease'),
    ('interacts_with', 'preparation', 'preparation')
) AS domain(relation_type_code, subject_entity_type_code, object_entity_type_code);

UPDATE public.kb_relation_type_domains
   SET review_status = 'approved'
 WHERE review_status = 'draft'
   AND (
     relation_type_code IN (
       'prepared_from',
       'realizes_preparation',
       'variant_of',
       'complementary_to',
       'follows_well',
       'antidotes',
       'inimical_with'
     )
     OR subject_entity_type_code = 'preparation'
     OR object_entity_type_code = 'preparation'
   );

CREATE TABLE public.kb_preparation_revision_details (
  entity_id uuid NOT NULL,
  entity_revision_id uuid NOT NULL,
  preparation_kind text NOT NULL
    CHECK (preparation_kind IN (
      'homeopathic_single', 'homeopathic_complex', 'nosode', 'sarcode', 'isode',
      'mother_tincture', 'herbal_tincture', 'fluid_extract', 'dry_extract',
      'essential_oil', 'herbal_tea', 'nutrient_single', 'nutrient_combination',
      'mineral', 'trace_element', 'amino_acid', 'probiotic', 'enzyme',
      'supplement', 'other'
    )),
  dosage_form text NOT NULL
    CHECK (dosage_form IN (
      'unspecified', 'globules', 'tablets', 'capsules', 'drops', 'liquid',
      'powder', 'granules', 'tea', 'oil', 'spray', 'cream', 'ointment',
      'suppository', 'ampoule', 'other'
    )),
  administration_routes text[] NOT NULL
    CHECK (
      cardinality(administration_routes) > 0
      AND administration_routes <@ ARRAY[
        'oral', 'sublingual', 'buccal', 'topical', 'inhaled', 'nasal',
        'rectal', 'vaginal', 'parenteral', 'other'
      ]::text[]
    ),
  standardization_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (standardization_status IN (
      'not_applicable', 'not_standardized', 'partially_standardized',
      'standardized', 'manufacturer_specific', 'unknown'
    )),
  basis_assertion_id uuid NOT NULL
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  technical_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(technical_metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (entity_id, entity_revision_id),
  FOREIGN KEY (entity_id, entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE public.kb_homeopathic_revision_details (
  entity_id uuid NOT NULL,
  entity_revision_id uuid NOT NULL,
  remedy_kind text NOT NULL
    CHECK (remedy_kind IN ('single', 'complex', 'nosode', 'sarcode', 'isode')),
  potency_scale text
    CHECK (potency_scale IS NULL OR potency_scale IN ('D', 'C', 'Q', 'LM', 'K', 'X', 'other')),
  potency_value numeric(10, 3),
  potentization_method text NOT NULL DEFAULT 'unspecified'
    CHECK (potentization_method IN (
      'unspecified', 'hahnemannian', 'korsakovian', 'fifty_millesimal', 'manufacturer_specific', 'other'
    )),
  basis_assertion_id uuid NOT NULL
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (entity_id, entity_revision_id),
  FOREIGN KEY (entity_id, entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CHECK ((potency_scale IS NULL) = (potency_value IS NULL)),
  CHECK (potency_value IS NULL OR potency_value > 0),
  CHECK (remedy_kind = 'complex' OR potency_value IS NOT NULL)
);

CREATE TABLE public.kb_botanical_revision_details (
  entity_id uuid NOT NULL,
  entity_revision_id uuid NOT NULL,
  plant_parts text[] NOT NULL
    CHECK (cardinality(plant_parts) > 0),
  source_material_state text NOT NULL
    CHECK (source_material_state IN ('fresh', 'dried', 'mixed', 'unspecified')),
  extraction_type text NOT NULL
    CHECK (extraction_type IN (
      'none', 'maceration', 'percolation', 'distillation', 'infusion',
      'decoction', 'fluid_extract', 'dry_extract', 'other'
    )),
  drug_extract_ratio_from numeric(12, 4),
  drug_extract_ratio_to numeric(12, 4),
  extraction_solvents text[] NOT NULL DEFAULT '{}',
  alcohol_percent_from numeric(5, 2),
  alcohol_percent_to numeric(5, 2),
  basis_assertion_id uuid NOT NULL
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (entity_id, entity_revision_id),
  FOREIGN KEY (entity_id, entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CHECK ((drug_extract_ratio_from IS NULL) = (drug_extract_ratio_to IS NULL)),
  CHECK (drug_extract_ratio_from IS NULL OR drug_extract_ratio_from > 0),
  CHECK (drug_extract_ratio_to IS NULL OR drug_extract_ratio_to >= drug_extract_ratio_from),
  CHECK ((alcohol_percent_from IS NULL) = (alcohol_percent_to IS NULL)),
  CHECK (alcohol_percent_from IS NULL OR alcohol_percent_from BETWEEN 0 AND 100),
  CHECK (alcohol_percent_to IS NULL OR alcohol_percent_to BETWEEN alcohol_percent_from AND 100)
);

CREATE TABLE public.kb_nutrient_revision_details (
  entity_id uuid NOT NULL,
  entity_revision_id uuid NOT NULL,
  formulation_kind text NOT NULL
    CHECK (formulation_kind IN ('single', 'combination')),
  delivery_system text NOT NULL DEFAULT 'standard'
    CHECK (delivery_system IN (
      'standard', 'chelated', 'liposomal', 'buffered', 'extended_release',
      'oil_based', 'water_based', 'enteric_coated', 'other'
    )),
  basis_assertion_id uuid NOT NULL
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (entity_id, entity_revision_id),
  FOREIGN KEY (entity_id, entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE public.kb_product_variant_revision_details (
  entity_id uuid NOT NULL,
  entity_revision_id uuid NOT NULL,
  product_entity_id uuid NOT NULL,
  product_revision_id uuid NOT NULL,
  preparation_entity_id uuid NOT NULL,
  preparation_revision_id uuid NOT NULL,
  package_quantity numeric(14, 4) NOT NULL CHECK (package_quantity > 0),
  package_unit text NOT NULL
    CHECK (package_unit IN (
      'piece', 'g', 'mg', 'kg', 'ml', 'l', 'dose', 'capsule', 'tablet',
      'ampoule', 'sachet', 'other'
    )),
  market_status text NOT NULL DEFAULT 'unknown'
    CHECK (market_status IN ('unknown', 'planned', 'available', 'temporarily_unavailable', 'discontinued')),
  valid_from date,
  valid_until date,
  basis_assertion_id uuid NOT NULL
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (entity_id, entity_revision_id),
  FOREIGN KEY (entity_id, entity_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (product_entity_id, product_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (preparation_entity_id, preparation_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE public.kb_composition_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_entity_id uuid NOT NULL,
  owner_revision_id uuid NOT NULL,
  component_entity_id uuid NOT NULL,
  component_revision_id uuid NOT NULL,
  component_role text NOT NULL
    CHECK (component_role IN (
      'active', 'homeopathic_active', 'nutrient', 'extract', 'carrier',
      'excipient', 'coating', 'preservative', 'flavor', 'other'
    )),
  chemical_form text,
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
  basis_assertion_id uuid NOT NULL
    REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  FOREIGN KEY (owner_entity_id, owner_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (component_entity_id, component_revision_id)
    REFERENCES public.kb_entity_revisions(entity_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (owner_entity_id, owner_revision_id, component_order),
  CHECK ((amount_min IS NULL) = (amount_max IS NULL)),
  CHECK ((amount_min IS NULL) = (amount_unit IS NULL)),
  CHECK (amount_min IS NULL OR amount_min > 0),
  CHECK (amount_max IS NULL OR amount_max >= amount_min),
  CHECK ((reference_quantity IS NULL) = (reference_unit IS NULL)),
  CHECK (reference_quantity IS NULL OR reference_quantity > 0),
  CHECK ((elemental_amount IS NULL) = (elemental_unit IS NULL)),
  CHECK (elemental_amount IS NULL OR elemental_amount > 0),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE OR REPLACE FUNCTION public.kb_text_array_is_canonical(_values text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT
    COALESCE(bool_and(value IS NOT NULL AND btrim(value) <> ''), true)
    AND _values = COALESCE(
      array_agg(DISTINCT value COLLATE "C" ORDER BY value COLLATE "C"),
      ARRAY[]::text[]
    )
  FROM unnest(_values) AS item(value)
$$;

ALTER TABLE public.kb_preparation_revision_details
  ADD CONSTRAINT kb_preparation_routes_canonical
  CHECK (public.kb_text_array_is_canonical(administration_routes));
ALTER TABLE public.kb_botanical_revision_details
  ADD CONSTRAINT kb_botanical_plant_parts_canonical
  CHECK (public.kb_text_array_is_canonical(plant_parts)),
  ADD CONSTRAINT kb_botanical_solvents_canonical
  CHECK (public.kb_text_array_is_canonical(extraction_solvents));

CREATE OR REPLACE FUNCTION public.kb_validate_therapeutic_row_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  owner_type text;
  referenced_type text;
BEGIN
  IF TG_TABLE_NAME = 'kb_composition_components' THEN
    owner_id := NEW.owner_entity_id;
  ELSE
    owner_id := NEW.entity_id;
  END IF;

  SELECT entity_type_code INTO owner_type
    FROM public.kb_entities
   WHERE id = owner_id;

  IF TG_TABLE_NAME = 'kb_product_variant_revision_details' THEN
    IF owner_type IS DISTINCT FROM 'product_variant' THEN
      RAISE EXCEPTION 'Product variant details require a product_variant entity';
    END IF;

    SELECT entity_type_code INTO referenced_type
      FROM public.kb_entities WHERE id = NEW.product_entity_id;
    IF referenced_type IS DISTINCT FROM 'product' THEN
      RAISE EXCEPTION 'Product variant details require an exact product revision';
    END IF;

    SELECT entity_type_code INTO referenced_type
      FROM public.kb_entities WHERE id = NEW.preparation_entity_id;
    IF referenced_type IS DISTINCT FROM 'preparation' THEN
      RAISE EXCEPTION 'Product variant details require an exact preparation revision';
    END IF;
  ELSIF TG_TABLE_NAME = 'kb_composition_components' THEN
    IF owner_type IS NULL OR owner_type NOT IN ('preparation', 'product_variant') THEN
      RAISE EXCEPTION 'Composition owners must be preparation or product_variant entities';
    END IF;

    SELECT entity_type_code INTO referenced_type
      FROM public.kb_entities WHERE id = NEW.component_entity_id;
    IF referenced_type IS NULL OR referenced_type NOT IN ('substance', 'plant', 'nutrient', 'preparation') THEN
      RAISE EXCEPTION 'Composition components must be substance, plant, nutrient or preparation entities';
    END IF;
  ELSIF owner_type IS DISTINCT FROM 'preparation' THEN
    RAISE EXCEPTION 'Preparation details require a preparation entity';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_therapeutic_revision_dependency()
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
    old_revision_id := (to_jsonb(OLD) ->> TG_ARGV[0])::uuid;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_revision_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_entity_revisions revision
     WHERE revision.id IN (old_revision_id, new_revision_id)
       AND revision.review_status IN ('approved', 'released', 'superseded', 'withdrawn')
  ) THEN
    RAISE EXCEPTION 'Dependencies of approved, released or historical therapeutic revisions are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_therapeutic_revision_payload(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'entity_type', entity.entity_type_code,
    'revision', jsonb_build_object(
      'revision_no', revision.revision_no,
      'display_name', revision.display_name,
      'summary', revision.summary,
      'description_markdown', revision.description_markdown,
      'origin_type', revision.origin_type,
      'metadata', revision.metadata
    ),
    'preparation', (
      SELECT to_jsonb(detail) - ARRAY['entity_id', 'entity_revision_id', 'created_at', 'created_by']
        FROM public.kb_preparation_revision_details detail
       WHERE detail.entity_id = _entity_id AND detail.entity_revision_id = _entity_revision_id
    ),
    'homeopathic', (
      SELECT to_jsonb(detail) - ARRAY['entity_id', 'entity_revision_id', 'created_at', 'created_by']
        FROM public.kb_homeopathic_revision_details detail
       WHERE detail.entity_id = _entity_id AND detail.entity_revision_id = _entity_revision_id
    ),
    'botanical', (
      SELECT to_jsonb(detail) - ARRAY['entity_id', 'entity_revision_id', 'created_at', 'created_by']
        FROM public.kb_botanical_revision_details detail
       WHERE detail.entity_id = _entity_id AND detail.entity_revision_id = _entity_revision_id
    ),
    'nutrient', (
      SELECT to_jsonb(detail) - ARRAY['entity_id', 'entity_revision_id', 'created_at', 'created_by']
        FROM public.kb_nutrient_revision_details detail
       WHERE detail.entity_id = _entity_id AND detail.entity_revision_id = _entity_revision_id
    ),
    'product_variant', (
      SELECT
        to_jsonb(detail) - ARRAY['entity_id', 'entity_revision_id', 'created_at', 'created_by']
        || jsonb_build_object(
          'product_revision_hash', product_revision.content_hash,
          'preparation_revision_hash', preparation_revision.content_hash
        )
        FROM public.kb_product_variant_revision_details detail
        JOIN public.kb_entity_revisions product_revision
          ON product_revision.entity_id = detail.product_entity_id
         AND product_revision.id = detail.product_revision_id
        JOIN public.kb_entity_revisions preparation_revision
          ON preparation_revision.entity_id = detail.preparation_entity_id
         AND preparation_revision.id = detail.preparation_revision_id
       WHERE detail.entity_id = _entity_id AND detail.entity_revision_id = _entity_revision_id
    ),
    'components', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(component) - ARRAY[
          'id', 'owner_entity_id', 'owner_revision_id', 'created_at', 'created_by'
        ] || jsonb_build_object('component_revision_hash', component_revision.content_hash)
        ORDER BY component.component_order, component.id
      )
        FROM public.kb_composition_components component
        JOIN public.kb_entity_revisions component_revision
          ON component_revision.entity_id = component.component_entity_id
         AND component_revision.id = component.component_revision_id
       WHERE component.owner_entity_id = _entity_id
         AND component.owner_revision_id = _entity_revision_id
    ), '[]'::jsonb)
  )
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = _entity_revision_id
   WHERE entity.id = _entity_id
$$;

CREATE OR REPLACE FUNCTION public.kb_therapeutic_revision_hash(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = public
AS $$
  SELECT encode(
    sha256(convert_to(public.kb_therapeutic_revision_payload(_entity_id, _entity_revision_id)::text, 'UTF8')),
    'hex'
  )
$$;

CREATE OR REPLACE FUNCTION public.kb_therapeutic_revision_is_valid(
  _entity_id uuid,
  _entity_revision_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = public
AS $$
DECLARE
  entity_type text;
  revision_status text;
  stored_hash text;
  preparation_kind text;
  homeopathic_kind text;
  nutrient_kind text;
BEGIN
  SELECT entity.entity_type_code, revision.review_status, revision.content_hash
    INTO entity_type, revision_status, stored_hash
    FROM public.kb_entities entity
    JOIN public.kb_entity_revisions revision
      ON revision.entity_id = entity.id
     AND revision.id = _entity_revision_id
   WHERE entity.id = _entity_id;

  IF NOT FOUND OR entity_type NOT IN ('preparation', 'product_variant') THEN
    RETURN true;
  END IF;

  IF entity_type = 'preparation' THEN
    IF EXISTS (
      SELECT 1 FROM public.kb_product_variant_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
    ) THEN
      RETURN false;
    END IF;

    SELECT detail.preparation_kind INTO preparation_kind
      FROM public.kb_preparation_revision_details detail
     WHERE detail.entity_id = _entity_id
       AND detail.entity_revision_id = _entity_revision_id;
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    IF (
      preparation_kind IN ('homeopathic_single', 'homeopathic_complex', 'nosode', 'sarcode', 'isode')
    ) IS DISTINCT FROM EXISTS (
      SELECT 1 FROM public.kb_homeopathic_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
    ) THEN
      RETURN false;
    END IF;

    IF preparation_kind IN ('homeopathic_single', 'homeopathic_complex', 'nosode', 'sarcode', 'isode') THEN
      SELECT remedy_kind INTO homeopathic_kind
        FROM public.kb_homeopathic_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id;
      IF (preparation_kind = 'homeopathic_single' AND homeopathic_kind <> 'single')
         OR (preparation_kind = 'homeopathic_complex' AND homeopathic_kind <> 'complex')
         OR (preparation_kind = 'nosode' AND homeopathic_kind <> 'nosode')
         OR (preparation_kind = 'sarcode' AND homeopathic_kind <> 'sarcode')
         OR (preparation_kind = 'isode' AND homeopathic_kind <> 'isode')
      THEN
        RETURN false;
      END IF;
    END IF;

    IF (
      preparation_kind IN (
        'mother_tincture', 'herbal_tincture', 'fluid_extract', 'dry_extract',
        'essential_oil', 'herbal_tea'
      )
    ) IS DISTINCT FROM EXISTS (
      SELECT 1 FROM public.kb_botanical_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
    ) THEN
      RETURN false;
    END IF;

    IF (
      preparation_kind IN (
        'nutrient_single', 'nutrient_combination', 'mineral', 'trace_element',
        'amino_acid', 'probiotic', 'enzyme', 'supplement'
      )
    ) IS DISTINCT FROM EXISTS (
      SELECT 1 FROM public.kb_nutrient_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
    ) THEN
      RETURN false;
    END IF;

    IF preparation_kind IN ('nutrient_single', 'nutrient_combination') THEN
      SELECT formulation_kind INTO nutrient_kind
        FROM public.kb_nutrient_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id;
      IF (preparation_kind = 'nutrient_single' AND nutrient_kind <> 'single')
         OR (preparation_kind = 'nutrient_combination' AND nutrient_kind <> 'combination')
      THEN
        RETURN false;
      END IF;
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.kb_product_variant_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
    ) OR EXISTS (
      SELECT 1 FROM public.kb_preparation_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
      UNION ALL
      SELECT 1 FROM public.kb_homeopathic_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
      UNION ALL
      SELECT 1 FROM public.kb_botanical_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
      UNION ALL
      SELECT 1 FROM public.kb_nutrient_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
    ) THEN
      RETURN false;
    END IF;
  END IF;

  IF entity_type = 'product_variant' AND EXISTS (
    SELECT 1
      FROM public.kb_product_variant_revision_details detail
      JOIN public.kb_entities product ON product.id = detail.product_entity_id
      JOIN public.kb_entities preparation ON preparation.id = detail.preparation_entity_id
     WHERE detail.entity_id = _entity_id
       AND detail.entity_revision_id = _entity_revision_id
       AND (
         product.entity_type_code <> 'product'
         OR preparation.entity_type_code <> 'preparation'
       )
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.kb_composition_components component
      JOIN public.kb_entities owner_entity ON owner_entity.id = component.owner_entity_id
      JOIN public.kb_entities component_entity ON component_entity.id = component.component_entity_id
     WHERE component.owner_entity_id = _entity_id
       AND component.owner_revision_id = _entity_revision_id
       AND (
         owner_entity.entity_type_code NOT IN ('preparation', 'product_variant')
         OR component_entity.entity_type_code NOT IN ('substance', 'plant', 'nutrient', 'preparation')
       )
  ) THEN
    RETURN false;
  END IF;

  IF revision_status IN ('approved', 'released') AND EXISTS (
    WITH referenced_revisions AS (
      SELECT product_revision_id AS revision_id
        FROM public.kb_product_variant_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
      UNION
      SELECT preparation_revision_id
        FROM public.kb_product_variant_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
      UNION
      SELECT component_revision_id
        FROM public.kb_composition_components
       WHERE owner_entity_id = _entity_id AND owner_revision_id = _entity_revision_id
    )
    SELECT 1
      FROM referenced_revisions reference
      JOIN public.kb_entity_revisions referenced ON referenced.id = reference.revision_id
     WHERE (revision_status = 'approved' AND referenced.review_status NOT IN ('approved', 'released'))
        OR (revision_status = 'released' AND referenced.review_status <> 'released')
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    WITH basis_assertions AS (
      SELECT basis_assertion_id FROM public.kb_preparation_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
      UNION
      SELECT basis_assertion_id FROM public.kb_homeopathic_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
      UNION
      SELECT basis_assertion_id FROM public.kb_botanical_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
      UNION
      SELECT basis_assertion_id FROM public.kb_nutrient_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
      UNION
      SELECT basis_assertion_id FROM public.kb_product_variant_revision_details
       WHERE entity_id = _entity_id AND entity_revision_id = _entity_revision_id
      UNION
      SELECT basis_assertion_id FROM public.kb_composition_components
       WHERE owner_entity_id = _entity_id AND owner_revision_id = _entity_revision_id
    )
    SELECT 1
      FROM basis_assertions basis
      JOIN public.kb_assertions assertion ON assertion.id = basis.basis_assertion_id
     WHERE (
           revision_status NOT IN ('superseded', 'withdrawn')
           AND assertion.review_status IN ('superseded', 'withdrawn')
         )
        OR (
          revision_status = 'approved'
          AND (
            assertion.review_status NOT IN ('approved', 'released')
            OR NOT EXISTS (
              SELECT 1
                FROM public.kb_assertion_sources assertion_source
                JOIN public.kb_source_revisions source_revision
                  ON source_revision.id = assertion_source.source_revision_id
               WHERE assertion_source.assertion_id = assertion.id
                 AND assertion_source.is_primary
                 AND assertion_source.source_role IN ('supports', 'qualifies')
                 AND btrim(assertion_source.locator) <> ''
                 AND source_revision.review_status IN ('approved', 'released')
            )
          )
        )
        OR (
          revision_status = 'released'
          AND (
            assertion.review_status <> 'released'
            OR NOT EXISTS (
              SELECT 1
                FROM public.kb_assertion_sources assertion_source
                JOIN public.kb_source_revisions source_revision
                  ON source_revision.id = assertion_source.source_revision_id
               WHERE assertion_source.assertion_id = assertion.id
                 AND assertion_source.is_primary
                 AND assertion_source.source_role IN ('supports', 'qualifies')
                 AND btrim(assertion_source.locator) <> ''
                 AND source_revision.review_status = 'released'
            )
          )
        )
        OR (
          revision_status IN ('superseded', 'withdrawn')
          AND (
            assertion.review_status NOT IN ('released', 'superseded', 'withdrawn')
            OR NOT EXISTS (
              SELECT 1
                FROM public.kb_assertion_sources assertion_source
                JOIN public.kb_source_revisions source_revision
                  ON source_revision.id = assertion_source.source_revision_id
               WHERE assertion_source.assertion_id = assertion.id
                 AND assertion_source.is_primary
                 AND assertion_source.source_role IN ('supports', 'qualifies')
                 AND btrim(assertion_source.locator) <> ''
                 AND source_revision.review_status IN ('released', 'superseded', 'withdrawn')
            )
          )
        )
  ) THEN
    RETURN false;
  END IF;

  RETURN stored_hash = public.kb_therapeutic_revision_hash(_entity_id, _entity_revision_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_validate_therapeutic_catalog_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  entity_id uuid;
  revision_id uuid;
  old_entity_id uuid;
  old_revision_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'kb_entity_revisions' THEN
    IF TG_OP = 'DELETE' THEN
      entity_id := OLD.entity_id;
      revision_id := OLD.id;
    ELSE
      entity_id := NEW.entity_id;
      revision_id := NEW.id;
    END IF;
  ELSIF TG_TABLE_NAME = 'kb_composition_components' THEN
    IF TG_OP = 'DELETE' THEN
      entity_id := OLD.owner_entity_id;
      revision_id := OLD.owner_revision_id;
    ELSE
      entity_id := NEW.owner_entity_id;
      revision_id := NEW.owner_revision_id;
      IF TG_OP = 'UPDATE' THEN
        old_entity_id := OLD.owner_entity_id;
        old_revision_id := OLD.owner_revision_id;
      END IF;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      entity_id := OLD.entity_id;
      revision_id := OLD.entity_revision_id;
    ELSE
      entity_id := NEW.entity_id;
      revision_id := NEW.entity_revision_id;
      IF TG_OP = 'UPDATE' THEN
        old_entity_id := OLD.entity_id;
        old_revision_id := OLD.entity_revision_id;
      END IF;
    END IF;
  END IF;

  IF old_revision_id IS NOT NULL
     AND (old_entity_id, old_revision_id) IS DISTINCT FROM (entity_id, revision_id)
     AND EXISTS (SELECT 1 FROM public.kb_entity_revisions WHERE id = old_revision_id)
     AND NOT public.kb_therapeutic_revision_is_valid(old_entity_id, old_revision_id)
  THEN
    RAISE EXCEPTION 'Previous therapeutic catalog revision became invalid after dependency move';
  END IF;

  IF EXISTS (SELECT 1 FROM public.kb_entity_revisions WHERE id = revision_id)
     AND NOT public.kb_therapeutic_revision_is_valid(entity_id, revision_id)
  THEN
    RAISE EXCEPTION 'Therapeutic catalog revision is incomplete, unreviewed, unsourced or has an invalid content hash';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_therapeutic_assertion_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.review_status IS NOT DISTINCT FROM OLD.review_status THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    WITH dependent_revisions AS (
      SELECT entity_revision_id AS revision_id FROM public.kb_preparation_revision_details WHERE basis_assertion_id = NEW.id
      UNION SELECT entity_revision_id FROM public.kb_homeopathic_revision_details WHERE basis_assertion_id = NEW.id
      UNION SELECT entity_revision_id FROM public.kb_botanical_revision_details WHERE basis_assertion_id = NEW.id
      UNION SELECT entity_revision_id FROM public.kb_nutrient_revision_details WHERE basis_assertion_id = NEW.id
      UNION SELECT entity_revision_id FROM public.kb_product_variant_revision_details WHERE basis_assertion_id = NEW.id
      UNION SELECT owner_revision_id FROM public.kb_composition_components WHERE basis_assertion_id = NEW.id
    )
    SELECT 1
      FROM dependent_revisions dependency
      JOIN public.kb_entity_revisions revision ON revision.id = dependency.revision_id
     WHERE (revision.review_status = 'approved' AND NEW.review_status NOT IN ('approved', 'released'))
        OR (revision.review_status = 'released' AND NEW.review_status <> 'released')
  ) THEN
    RAISE EXCEPTION 'Assertion status would invalidate an approved or released therapeutic revision';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_validate_therapeutic_dependents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  dependent record;
BEGIN
  IF TG_TABLE_NAME = 'kb_source_revisions' THEN
    FOR dependent IN
      WITH affected_assertions AS (
        SELECT DISTINCT assertion_id
          FROM public.kb_assertion_sources
         WHERE source_revision_id IN (OLD.id, NEW.id)
      ), dependent_revisions AS (
        SELECT entity_id, entity_revision_id AS revision_id
          FROM public.kb_preparation_revision_details
         WHERE basis_assertion_id IN (SELECT assertion_id FROM affected_assertions)
        UNION SELECT entity_id, entity_revision_id FROM public.kb_homeopathic_revision_details
         WHERE basis_assertion_id IN (SELECT assertion_id FROM affected_assertions)
        UNION SELECT entity_id, entity_revision_id FROM public.kb_botanical_revision_details
         WHERE basis_assertion_id IN (SELECT assertion_id FROM affected_assertions)
        UNION SELECT entity_id, entity_revision_id FROM public.kb_nutrient_revision_details
         WHERE basis_assertion_id IN (SELECT assertion_id FROM affected_assertions)
        UNION SELECT entity_id, entity_revision_id FROM public.kb_product_variant_revision_details
         WHERE basis_assertion_id IN (SELECT assertion_id FROM affected_assertions)
        UNION SELECT owner_entity_id, owner_revision_id FROM public.kb_composition_components
         WHERE basis_assertion_id IN (SELECT assertion_id FROM affected_assertions)
      )
      SELECT DISTINCT entity_id, revision_id FROM dependent_revisions
    LOOP
      IF NOT public.kb_therapeutic_revision_is_valid(dependent.entity_id, dependent.revision_id) THEN
        RAISE EXCEPTION 'Source revision change would invalidate a therapeutic catalog revision';
      END IF;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'kb_assertions' THEN
    FOR dependent IN
      WITH dependent_revisions AS (
        SELECT entity_id, entity_revision_id AS revision_id
          FROM public.kb_preparation_revision_details
         WHERE basis_assertion_id IN (OLD.id, NEW.id)
        UNION SELECT entity_id, entity_revision_id FROM public.kb_homeopathic_revision_details
         WHERE basis_assertion_id IN (OLD.id, NEW.id)
        UNION SELECT entity_id, entity_revision_id FROM public.kb_botanical_revision_details
         WHERE basis_assertion_id IN (OLD.id, NEW.id)
        UNION SELECT entity_id, entity_revision_id FROM public.kb_nutrient_revision_details
         WHERE basis_assertion_id IN (OLD.id, NEW.id)
        UNION SELECT entity_id, entity_revision_id FROM public.kb_product_variant_revision_details
         WHERE basis_assertion_id IN (OLD.id, NEW.id)
        UNION SELECT owner_entity_id, owner_revision_id FROM public.kb_composition_components
         WHERE basis_assertion_id IN (OLD.id, NEW.id)
      )
      SELECT DISTINCT entity_id, revision_id FROM dependent_revisions
    LOOP
      IF NOT public.kb_therapeutic_revision_is_valid(dependent.entity_id, dependent.revision_id) THEN
        RAISE EXCEPTION 'Assertion change would invalidate a therapeutic catalog revision';
      END IF;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'kb_entity_revisions' THEN
    FOR dependent IN
      WITH dependent_revisions AS (
        SELECT entity_id, entity_revision_id AS revision_id
          FROM public.kb_product_variant_revision_details
         WHERE product_revision_id IN (OLD.id, NEW.id)
            OR preparation_revision_id IN (OLD.id, NEW.id)
        UNION
        SELECT owner_entity_id, owner_revision_id
          FROM public.kb_composition_components
         WHERE component_revision_id IN (OLD.id, NEW.id)
      )
      SELECT DISTINCT entity_id, revision_id FROM dependent_revisions
    LOOP
      IF dependent.revision_id <> NEW.id
         AND NOT public.kb_therapeutic_revision_is_valid(dependent.entity_id, dependent.revision_id)
      THEN
        RAISE EXCEPTION 'Referenced revision change would invalidate a therapeutic catalog revision';
      END IF;
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.kb_invalid_therapeutic_catalog_revision_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH invalid_revisions AS (
    SELECT revision.id
      FROM public.kb_entity_revisions revision
      JOIN public.kb_entities entity ON entity.id = revision.entity_id
     WHERE entity.entity_type_code IN ('preparation', 'product_variant')
       AND NOT public.kb_therapeutic_revision_is_valid(entity.id, revision.id)
  ), semantic_type_violations AS (
    SELECT 'preparation:' || detail.entity_revision_id::text AS violation_key
      FROM public.kb_preparation_revision_details detail
      JOIN public.kb_entities entity ON entity.id = detail.entity_id
     WHERE entity.entity_type_code <> 'preparation'
    UNION
    SELECT 'homeopathic:' || detail.entity_revision_id::text
      FROM public.kb_homeopathic_revision_details detail
      JOIN public.kb_entities entity ON entity.id = detail.entity_id
     WHERE entity.entity_type_code <> 'preparation'
    UNION
    SELECT 'botanical:' || detail.entity_revision_id::text
      FROM public.kb_botanical_revision_details detail
      JOIN public.kb_entities entity ON entity.id = detail.entity_id
     WHERE entity.entity_type_code <> 'preparation'
    UNION
    SELECT 'nutrient:' || detail.entity_revision_id::text
      FROM public.kb_nutrient_revision_details detail
      JOIN public.kb_entities entity ON entity.id = detail.entity_id
     WHERE entity.entity_type_code <> 'preparation'
    UNION
    SELECT 'product_variant:' || detail.entity_revision_id::text
      FROM public.kb_product_variant_revision_details detail
      JOIN public.kb_entities owner_entity ON owner_entity.id = detail.entity_id
      JOIN public.kb_entities product ON product.id = detail.product_entity_id
      JOIN public.kb_entities preparation ON preparation.id = detail.preparation_entity_id
     WHERE owner_entity.entity_type_code <> 'product_variant'
        OR product.entity_type_code <> 'product'
        OR preparation.entity_type_code <> 'preparation'
    UNION
    SELECT 'component:' || component.id::text
      FROM public.kb_composition_components component
      JOIN public.kb_entities owner_entity ON owner_entity.id = component.owner_entity_id
      JOIN public.kb_entities component_entity ON component_entity.id = component.component_entity_id
     WHERE owner_entity.entity_type_code NOT IN ('preparation', 'product_variant')
        OR component_entity.entity_type_code NOT IN ('substance', 'plant', 'nutrient', 'preparation')
  )
  SELECT
    (SELECT count(*) FROM invalid_revisions)
    + (SELECT count(*) FROM semantic_type_violations)
$$;

CREATE TRIGGER kb_preparation_details_validate_types
  BEFORE INSERT OR UPDATE ON public.kb_preparation_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_row_types();
CREATE TRIGGER kb_homeopathic_details_validate_types
  BEFORE INSERT OR UPDATE ON public.kb_homeopathic_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_row_types();
CREATE TRIGGER kb_botanical_details_validate_types
  BEFORE INSERT OR UPDATE ON public.kb_botanical_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_row_types();
CREATE TRIGGER kb_nutrient_details_validate_types
  BEFORE INSERT OR UPDATE ON public.kb_nutrient_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_row_types();
CREATE TRIGGER kb_product_variant_details_validate_types
  BEFORE INSERT OR UPDATE ON public.kb_product_variant_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_row_types();
CREATE TRIGGER kb_composition_components_validate_types
  BEFORE INSERT OR UPDATE ON public.kb_composition_components
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_row_types();

CREATE TRIGGER kb_preparation_details_protect_revision
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_preparation_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_therapeutic_revision_dependency('entity_revision_id');
CREATE TRIGGER kb_homeopathic_details_protect_revision
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_homeopathic_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_therapeutic_revision_dependency('entity_revision_id');
CREATE TRIGGER kb_botanical_details_protect_revision
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_botanical_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_therapeutic_revision_dependency('entity_revision_id');
CREATE TRIGGER kb_nutrient_details_protect_revision
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_nutrient_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_therapeutic_revision_dependency('entity_revision_id');
CREATE TRIGGER kb_product_variant_details_protect_revision
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_product_variant_revision_details
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_therapeutic_revision_dependency('entity_revision_id');
CREATE TRIGGER kb_composition_components_protect_revision
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_composition_components
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_therapeutic_revision_dependency('owner_revision_id');

CREATE TRIGGER kb_assertions_protect_therapeutic_status
  BEFORE UPDATE ON public.kb_assertions
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_therapeutic_assertion_status();

CREATE CONSTRAINT TRIGGER kb_entity_revisions_validate_therapeutic_catalog
  AFTER INSERT OR UPDATE ON public.kb_entity_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_catalog_revision();
CREATE CONSTRAINT TRIGGER kb_entity_revisions_validate_therapeutic_dependents
  AFTER UPDATE ON public.kb_entity_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_dependents();
CREATE CONSTRAINT TRIGGER kb_source_revisions_validate_therapeutic_dependents
  AFTER UPDATE ON public.kb_source_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_dependents();
CREATE CONSTRAINT TRIGGER kb_assertions_validate_therapeutic_dependents
  AFTER UPDATE ON public.kb_assertions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_dependents();
CREATE CONSTRAINT TRIGGER kb_preparation_details_validate_catalog
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_preparation_revision_details
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_catalog_revision();
CREATE CONSTRAINT TRIGGER kb_homeopathic_details_validate_catalog
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_homeopathic_revision_details
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_catalog_revision();
CREATE CONSTRAINT TRIGGER kb_botanical_details_validate_catalog
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_botanical_revision_details
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_catalog_revision();
CREATE CONSTRAINT TRIGGER kb_nutrient_details_validate_catalog
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_nutrient_revision_details
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_catalog_revision();
CREATE CONSTRAINT TRIGGER kb_product_variant_details_validate_catalog
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_product_variant_revision_details
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_catalog_revision();
CREATE CONSTRAINT TRIGGER kb_composition_components_validate_catalog
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_composition_components
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.kb_validate_therapeutic_catalog_revision();

CREATE INDEX kb_preparation_details_assertion_idx
  ON public.kb_preparation_revision_details(basis_assertion_id);
CREATE INDEX kb_homeopathic_details_assertion_idx
  ON public.kb_homeopathic_revision_details(basis_assertion_id);
CREATE INDEX kb_botanical_details_assertion_idx
  ON public.kb_botanical_revision_details(basis_assertion_id);
CREATE INDEX kb_nutrient_details_assertion_idx
  ON public.kb_nutrient_revision_details(basis_assertion_id);
CREATE INDEX kb_product_variant_details_assertion_idx
  ON public.kb_product_variant_revision_details(basis_assertion_id);
CREATE INDEX kb_composition_components_owner_idx
  ON public.kb_composition_components(owner_entity_id, owner_revision_id);
CREATE INDEX kb_composition_components_component_idx
  ON public.kb_composition_components(component_entity_id, component_revision_id);
CREATE INDEX kb_composition_components_assertion_idx
  ON public.kb_composition_components(basis_assertion_id);

DO $$
DECLARE
  kb_table text;
BEGIN
  FOREACH kb_table IN ARRAY ARRAY[
    'kb_preparation_revision_details',
    'kb_homeopathic_revision_details',
    'kb_botanical_revision_details',
    'kb_nutrient_revision_details',
    'kb_product_variant_revision_details',
    'kb_composition_components'
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
  public.kb_preparation_revision_details,
  public.kb_homeopathic_revision_details,
  public.kb_botanical_revision_details,
  public.kb_nutrient_revision_details,
  public.kb_product_variant_revision_details,
  public.kb_composition_components
FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.kb_preparation_revision_details,
  public.kb_homeopathic_revision_details,
  public.kb_botanical_revision_details,
  public.kb_nutrient_revision_details,
  public.kb_product_variant_revision_details,
  public.kb_composition_components
TO authenticated;

GRANT SELECT ON TABLE
  public.kb_preparation_revision_details,
  public.kb_homeopathic_revision_details,
  public.kb_botanical_revision_details,
  public.kb_nutrient_revision_details,
  public.kb_product_variant_revision_details,
  public.kb_composition_components
TO service_role;

REVOKE ALL ON FUNCTION public.kb_validate_therapeutic_row_types()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_text_array_is_canonical(text[])
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_therapeutic_revision_dependency()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_therapeutic_revision_payload(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_therapeutic_revision_hash(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_therapeutic_revision_is_valid(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_validate_therapeutic_catalog_revision()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_protect_therapeutic_assertion_status()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_validate_therapeutic_dependents()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;
REVOKE ALL ON FUNCTION public.kb_invalid_therapeutic_catalog_revision_count()
  FROM PUBLIC, anon, authenticated, service_role, kb_importer, kb_import_runtime;

GRANT EXECUTE ON FUNCTION public.kb_therapeutic_revision_payload(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.kb_therapeutic_revision_hash(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.kb_therapeutic_revision_is_valid(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.kb_text_array_is_canonical(text[])
  TO authenticated;

COMMIT;
