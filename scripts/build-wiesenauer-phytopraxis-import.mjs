import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const inventoryRelativePath = "docs/source-inventory/2026-08-20-wiesenauer-phytopraxis-internal.json";
const inventoryPath = resolve(repoRoot, inventoryRelativePath);
const migrationPath = resolve(
  repoRoot,
  "supabase/migrations/20260820160000_import_wiesenauer_phytopraxis_internal.sql",
);

const inventoryText = readFileSync(inventoryPath, "utf8");
const inventory = JSON.parse(inventoryText);

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unbenannt";
}

function fail(message) {
  throw new Error(`Wiesenauer-Inventar ungültig: ${message}`);
}

if (inventory.visibility !== "admin_only") fail("visibility muss admin_only sein");
if (inventory.patientFacingAllowed !== false) fail("patientFacingAllowed muss false sein");
if (inventory.reviewStatus !== "unreviewed") fail("reviewStatus muss unreviewed sein");
if (!Array.isArray(inventory.sections) || inventory.sections.length === 0) fail("sections fehlen");

const categoriesByKey = new Map();
const mappings = [];

for (const section of inventory.sections) {
  if (!section.id || !section.title || !section.locator || !section.rawExcerpt) {
    fail(`Pflichtfeld in Abschnitt ${section.id || "<ohne ID>"} fehlt`);
  }
  if (!Array.isArray(section.categoryPaths) || section.categoryPaths.length === 0) {
    fail(`categoryPaths in Abschnitt ${section.id} fehlen`);
  }
  if (!Array.isArray(section.rows) || section.rows.length === 0) {
    fail(`rows in Abschnitt ${section.id} fehlen`);
  }

  const categoryKey = slug(section.categoryPaths.join("-"));
  const categoryName = section.categoryPaths.join(" > ");
  const category = categoriesByKey.get(categoryKey) || {
    category_key: categoryKey,
    display_name: categoryName,
    section_ids: [],
    locators: [],
    source_excerpts: [],
  };
  category.section_ids.push(section.id);
  category.locators.push(section.locator);
  category.source_excerpts.push(section.rawExcerpt);
  categoriesByKey.set(categoryKey, category);

  for (const row of section.rows) {
    if (!row.id) fail(`Zeilen-ID in Abschnitt ${section.id} fehlt`);
    const preparations = Array.isArray(row.praeparate)
      ? row.praeparate
      : [{
          name: row.praeparat,
          dosierung: row.dosierung,
          age: row.age || "",
          ageDetails: row.ageDetails || [],
        }];
    if (!preparations.length) fail(`Präparat in Zeile ${row.id} fehlt`);

    for (const preparation of preparations) {
      if (!preparation.name || !preparation.dosierung) {
        fail(`Präparat oder Dosierung in Zeile ${row.id} fehlt`);
      }
      const mappingKey = preparations.length === 1
        ? row.id
        : `${row.id}-${slug(preparation.name)}`;
      mappings.push({
        mapping_key: mappingKey,
        section_id: section.id,
        section_title: section.title,
        source_locator: section.locator,
        source_section_raw: section.rawExcerpt,
        category_key: categoryKey,
        category_name: categoryName,
        symptomatik: row.symptomatik || "",
        medicinal_drugs: Array.isArray(row.arzneidrogen) ? row.arzneidrogen : [],
        product_name: preparation.name,
        dosage: preparation.dosierung,
        route: row.route || "",
        age: preparation.age || "",
        age_details: preparation.ageDetails || [],
        raw_record: { sectionId: section.id, row, preparation },
      });
    }
  }
}

const mappingKeys = new Set();
for (const mapping of mappings) {
  if (mappingKeys.has(mapping.mapping_key)) fail(`doppelte Mapping-ID ${mapping.mapping_key}`);
  mappingKeys.add(mapping.mapping_key);
}

const payload = {
  source: inventory.source,
  retentionRule: inventory.retentionRule,
  sections: inventory.sections,
  transcriptionFlags: inventory.transcriptionFlags,
  separatedAssessment: inventory.separatedAssessment,
  categories: [...categoriesByKey.values()],
  mappings,
};
const payloadText = JSON.stringify(payload);
if (payloadText.includes("$inventory$")) fail("reservierter SQL-Dollar-Tag im Inventar");

const inventoryHash = createHash("sha256").update(inventoryText).digest("hex");
const sql = `BEGIN;

-- Additive, internal-only source-card import. The book statements remain
-- separate from evidence, safety, dosage clearance, and publication review.
DO $seed$
<<seed>>
DECLARE
  target_batch_id uuid := md5('wiesenauer-phytopraxis-2026-08-20:batch')::uuid;
  book_source_id uuid := md5('wiesenauer-phytopraxis-2026-08-20:source:book')::uuid;
  safety_source_id uuid := md5('wiesenauer-phytopraxis-2026-08-20:source:safety')::uuid;
  inventory_hash text := '${inventoryHash}';
  inventory jsonb := $inventory$${payloadText}$inventory$::jsonb;
  stored_hash text;
  stored_count integer;
  actual_count integer;
  linked_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.kb_import_batches WHERE id = target_batch_id) THEN
    SELECT source_hash, candidate_count
      INTO STRICT stored_hash, stored_count
      FROM public.kb_import_batches
     WHERE id = target_batch_id;

    SELECT
      (SELECT count(*) FROM public.kb_source_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_entity_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_relation_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_dosage_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_safety_candidates WHERE batch_id = target_batch_id)
      INTO actual_count;

    IF stored_hash <> inventory_hash OR stored_count <> actual_count THEN
      RAISE EXCEPTION 'Existing Wiesenauer import does not match its immutable source inventory';
    END IF;
  ELSE
    INSERT INTO public.kb_import_batches (
      id,
      source_kind,
      source_label,
      source_hash,
      parser_name,
      parser_version,
      batch_status,
      metadata
    ) VALUES (
      target_batch_id,
      'json',
      'Wiesenauer PhytoPraxis: interne Quellenkarten 2026-08-20',
      inventory_hash,
      'build-wiesenauer-phytopraxis-import',
      '1.0.0',
      'created',
      jsonb_build_object(
        'admin_only', true,
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'source_inventory', '${inventoryRelativePath}',
        'source_sections', jsonb_array_length(inventory->'sections'),
        'source_cards', jsonb_array_length(inventory->'mappings'),
        'source_claim_and_evaluation_separated', true,
        'medical_review_required', true,
        'pharmaceutical_review_required', true,
        'copyright_and_transcription_review_required', true
      )
    );

    UPDATE public.kb_import_batches
       SET batch_status = 'processing'
     WHERE id = target_batch_id;

    INSERT INTO public.kb_source_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      proposed_source_type,
      title,
      publisher,
      source_url,
      rights_status,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    ) VALUES
      (
        book_source_id,
        target_batch_id,
        'source:wiesenauer:phytopraxis-excerpts-2026-08-20',
        'imported_unreviewed',
        'reference_work',
        'PhytoPraxis – von Peter übermittelte Tabellen und Fundstellen',
        'Springer Berlin Heidelberg',
        '',
        'quoted',
        '${inventoryRelativePath}',
        inventory::text,
        100,
        'Die übermittelten Passagen und auffälligen OCR-/Fußnotenstellen bleiben vollständig erhalten. Produktidentität, aktuelle Verfügbarkeit, Evidenz und Dosierung sind nicht freigegeben.',
        jsonb_build_object(
          'visibility', 'admin_only',
          'patient_facing_allowed', false,
          'review_status', 'unreviewed',
          'source_claims_only', true,
          'inventory', inventory
        )
      ),
      (
        safety_source_id,
        target_batch_id,
        'source:internal-safety:wiesenauer-phytopraxis-2026-08-20',
        'imported_unreviewed',
        'practice_document',
        'Getrennte interne Sicherheits- und Freigabebewertung zu Wiesenauer PhytoPraxis',
        'Interne Admin-Prüfung',
        '',
        'own_content',
        'Getrennte Sicherheitsbewertung 20.08.2026',
        'Diese Sicherheits- und Freigabeschicht ist keine Aussage aus dem Buch. Sie verhindert eine automatische Therapie-, Patienten- oder Veröffentlichungsfreigabe.',
        100,
        'Evidenz- und produktbezogene Detailprüfung bleibt offen.',
        jsonb_build_object(
          'visibility', 'admin_only',
          'patient_facing_allowed', false,
          'review_status', 'unreviewed',
          'not_a_wiesenauer_claim', true,
          'safety_clearance', false,
          'dosage_clearance', false
        )
      );

    INSERT INTO public.kb_entity_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      proposed_entity_type_code,
      proposed_canonical_key,
      display_name,
      aliases,
      description_markdown,
      source_candidate_id,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    )
    SELECT
      md5('wiesenauer-phytopraxis-2026-08-20:entity:category:' || category.category_key)::uuid,
      target_batch_id,
      'entity:wiesenauer-category:' || category.category_key,
      'imported_unreviewed',
      'protocol',
      'protocol.wiesenauer.' || category.category_key,
      category.display_name,
      ARRAY[category.display_name]::text[],
      'Interner Quellenbereich für die von Peter übermittelten Wiesenauer-Fundstellen. Alle Quellenkarten bleiben ungeprüft und ausschließlich für Administratoren sichtbar.',
      book_source_id,
      COALESCE((SELECT string_agg(value, '; ') FROM jsonb_array_elements_text(category.locators)), '${inventoryRelativePath}'),
      category.source_excerpts::text,
      100,
      'Kategorienavigation für interne Quellenkarten; keine Therapie- oder Patientenfreigabe.',
      jsonb_build_object(
        'visibility', 'admin_only',
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'structure_status', 'source_category',
        'category', to_jsonb(category)
      )
    FROM jsonb_to_recordset(inventory->'categories') AS category(
      category_key text,
      display_name text,
      section_ids jsonb,
      locators jsonb,
      source_excerpts jsonb
    );

    INSERT INTO public.kb_entity_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      proposed_entity_type_code,
      proposed_canonical_key,
      display_name,
      aliases,
      description_markdown,
      source_candidate_id,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    )
    SELECT
      md5('wiesenauer-phytopraxis-2026-08-20:entity:source-card:' || mapping.mapping_key)::uuid,
      target_batch_id,
      'entity:wiesenauer-source-card:' || mapping.mapping_key,
      'imported_unreviewed',
      'protocol',
      'protocol.wiesenauer.source-card.' || mapping.mapping_key,
      mapping.product_name || CASE WHEN mapping.symptomatik <> '' THEN ' – ' || mapping.symptomatik ELSE '' END,
      ARRAY(
        SELECT DISTINCT alias_value
          FROM unnest(
            ARRAY[mapping.product_name, mapping.symptomatik]
            || ARRAY(SELECT jsonb_array_elements_text(COALESCE(mapping.medicinal_drugs, '[]'::jsonb)))
          ) AS alias_value
         WHERE btrim(alias_value) <> ''
      ),
      '## Interne Quellenkarte' || E'\n\n'
        || '**Kategorie:** ' || mapping.category_name || E'\n\n'
        || '**Symptomatik:** ' || COALESCE(NULLIF(mapping.symptomatik, ''), 'In der Fundstelle nicht angegeben') || E'\n\n'
        || '**Arzneidrogen:** ' || COALESCE(NULLIF((SELECT string_agg(value, ', ') FROM jsonb_array_elements_text(mapping.medicinal_drugs)), ''), 'In dieser Fundstelle nicht angegeben') || E'\n\n'
        || '**Präparat:** ' || mapping.product_name || E'\n\n'
        || '**Quellendosierung:** ' || mapping.dosage || E'\n\n'
        || '**Fundstelle:** ' || mapping.source_locator || E'\n\n'
        || 'Keine automatische Therapie-, Dosierungs- oder Patientenfreigabe.',
      book_source_id,
      mapping.source_locator,
      mapping.raw_record::text,
      100,
      'Quellenkarte mit noch offener Produkt-, Transkriptions-, Evidenz- und Sicherheitsprüfung.',
      jsonb_build_object(
        'visibility', 'admin_only',
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'structure_status', 'source_card',
        'source_claim_only', true,
        'mapping', to_jsonb(mapping)
      )
    FROM jsonb_to_recordset(inventory->'mappings') AS mapping(
      mapping_key text,
      section_id text,
      section_title text,
      source_locator text,
      source_section_raw text,
      category_key text,
      category_name text,
      symptomatik text,
      medicinal_drugs jsonb,
      product_name text,
      dosage text,
      route text,
      age text,
      age_details jsonb,
      raw_record jsonb
    );

    INSERT INTO public.kb_relation_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      subject_candidate_id,
      object_candidate_id,
      proposed_relation_type_code,
      assignment_strength,
      source_candidate_id,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    )
    SELECT
      md5('wiesenauer-phytopraxis-2026-08-20:relation:source-card:' || mapping.mapping_key)::uuid,
      target_batch_id,
      'relation:wiesenauer-source-card:' || mapping.mapping_key || ':category',
      'imported_unreviewed',
      md5('wiesenauer-phytopraxis-2026-08-20:entity:source-card:' || mapping.mapping_key)::uuid,
      md5('wiesenauer-phytopraxis-2026-08-20:entity:category:' || mapping.category_key)::uuid,
      'part_of_protocol',
      'contextual',
      book_source_id,
      mapping.source_locator,
      mapping.raw_record::text,
      100,
      'Die Beziehung bildet ausschließlich Peters gewünschte interne Kategoriezuordnung ab.',
      jsonb_build_object(
        'visibility', 'admin_only',
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'source_claim_only', true,
        'mapping', to_jsonb(mapping)
      )
    FROM jsonb_to_recordset(inventory->'mappings') AS mapping(
      mapping_key text,
      source_locator text,
      category_key text,
      raw_record jsonb
    );

    INSERT INTO public.kb_dosage_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      subject_candidate_id,
      indication_candidate_id,
      application_route,
      minimum_dose,
      maximum_dose,
      dose_unit,
      reference_period,
      frequency_text,
      duration_text,
      timing_text,
      application_text,
      source_candidate_id,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    )
    SELECT
      md5('wiesenauer-phytopraxis-2026-08-20:dosage:' || mapping.mapping_key)::uuid,
      target_batch_id,
      'dosage:wiesenauer-source-card:' || mapping.mapping_key,
      'imported_unreviewed',
      md5('wiesenauer-phytopraxis-2026-08-20:entity:source-card:' || mapping.mapping_key)::uuid,
      md5('wiesenauer-phytopraxis-2026-08-20:entity:category:' || mapping.category_key)::uuid,
      mapping.route,
      NULL,
      NULL,
      '',
      '',
      mapping.dosage,
      '',
      '',
      mapping.product_name || ': ' || mapping.dosage,
      book_source_id,
      mapping.source_locator,
      mapping.raw_record::text,
      100,
      'Das Einnahmeschema bleibt als Quellentext erhalten; Zahlen, Klammern, Intervalle, Alter und Einheiten wurden nicht zu einer freigegebenen Dosis interpretiert.',
      jsonb_build_object(
        'visibility', 'admin_only',
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'dosage_clearance', false,
        'source_schedule', mapping.dosage,
        'age', mapping.age,
        'age_details', mapping.age_details,
        'mapping', to_jsonb(mapping)
      )
    FROM jsonb_to_recordset(inventory->'mappings') AS mapping(
      mapping_key text,
      source_locator text,
      category_key text,
      product_name text,
      dosage text,
      route text,
      age text,
      age_details jsonb,
      raw_record jsonb
    );

    INSERT INTO public.kb_safety_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      subject_candidate_id,
      rule_type,
      severity,
      action_text,
      source_candidate_id,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    )
    SELECT
      md5('wiesenauer-phytopraxis-2026-08-20:safety:category:' || category.category_key)::uuid,
      target_batch_id,
      'safety:wiesenauer-category:' || category.category_key,
      'imported_unreviewed',
      md5('wiesenauer-phytopraxis-2026-08-20:entity:category:' || category.category_key)::uuid,
      'precaution',
      'require_review',
      CASE
        WHEN category.category_key = 'khk'
          THEN 'Akute Angina-pectoris-Anfälle sind laut übermittelter Quelle keine Indikation für Phytotherapie. Akute Brustschmerzen oder entsprechende Beschwerden unverzüglich medizinisch abklären; keine Quellendosis als Ersatz für kardiologische Behandlung verwenden.'
        WHEN category.category_key = 'pavk'
          THEN 'pAVK, insbesondere Stadium IV mit Ulzeration oder Gangrän, erfordert dringliche gefäß- und wundmedizinische Diagnostik. Äußerliche Quellenangaben nicht als Selbstbehandlung offener oder ischämischer Wunden verwenden.'
        WHEN category.category_key LIKE '%chronisch-venose%'
          THEN 'Schmerzhafter entzündeter Venenstrang, einseitige Schwellung oder Thrombophlebitis auf tiefe Venenthrombose und Embolierisiko abklären. Quellenangaben sind nur ungeprüfte Adjuvanzangaben.'
        WHEN category.category_key LIKE '%ulcus-cruris%'
          THEN 'Offenes Bein, Superinfektion, Entzündungsneigung und schlecht heilende Wundränder gefäß- und wundmedizinisch abklären. Keine Lösung oder Creme ohne Prüfung von Wundstatus, Allergien, Infektion und Produktanweisung anwenden.'
        WHEN category.category_key LIKE '%hamorrhoidal%'
          THEN 'Rektale Blutung, starke Schmerzen, Entzündung und Analfissuren diagnostisch abklären. Rektale und äußere Quellenangaben erst nach Produkt-, Interaktions- und Schleimhautprüfung verwenden.'
        WHEN category.category_key LIKE '%herzinsuffizienz%' OR category.category_key LIKE '%herzrhythmus%'
          THEN 'Herzinsuffizienz, Herzrhythmusstörungen, Hyperthyreosebezug und Digitalis-/Kardiaka-Aussagen vor jeder Verwendung kardiologisch und pharmazeutisch prüfen; notwendige Diagnostik oder Akutversorgung niemals verzögern.'
        WHEN category.category_key LIKE '%schilddrusen%'
          THEN 'Schilddrüsenfunktion, Diagnose, Schwangerschaft, Schilddrüsenmedikation, Herzsymptome und Produktidentität vor jeder Verwendung medizinisch und pharmazeutisch prüfen.'
        WHEN category.category_key LIKE '%hypotonie%' OR category.category_key LIKE '%hypertonie%'
          THEN 'Akute Kreislaufschwäche sowie zu niedrigen oder erhöhten Blutdruck ursächlich abklären. Quellendosierungen und Bedarfsschemata nicht ohne Produkt-, Medikamenten- und Sicherheitsprüfung anwenden.'
        WHEN category.category_key LIKE '%infekt%'
          THEN 'Rezidivierende Infekte, Herpes, Sinusitis, Urogenital- oder Darminfekte ursächlich abklären. Altersangaben, Intervalltherapie, Immunsituation und Arzneimittelinteraktionen streng prüfen.'
        ELSE 'Präparate, Dosierungen, Arzneimittelinteraktionen, Allergien, Schwangerschaft, Organfunktion sowie topische Haut- und Schleimhautrisiken vor jeder Verwendung einzeln prüfen.'
      END,
      safety_source_id,
      'Getrennte Sicherheitsbewertung 20.08.2026',
      'Diese Sicherheitsbewertung ist nicht Teil der Wiesenauer-Quellenaussage.',
      100,
      'Evidenz- und produktspezifische Detailprüfung bleibt offen.',
      jsonb_build_object(
        'visibility', 'admin_only',
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'safety_clearance', false,
        'not_a_wiesenauer_claim', true,
        'category', to_jsonb(category)
      )
    FROM jsonb_to_recordset(inventory->'categories') AS category(
      category_key text,
      display_name text,
      section_ids jsonb,
      locators jsonb,
      source_excerpts jsonb
    );

    SELECT
      (SELECT count(*) FROM public.kb_source_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_entity_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_relation_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_dosage_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_safety_candidates WHERE batch_id = target_batch_id)
      INTO actual_count;

    UPDATE public.kb_import_batches
       SET batch_status = 'ready_for_review',
           candidate_count = actual_count,
           error_count = 0,
           completed_at = now()
     WHERE id = target_batch_id;
  END IF;

  PERFORM public._kb_materialize_import_candidates_as_internal_drafts(target_batch_id, NULL);

  SELECT count(*)::int
    INTO linked_count
    FROM public.kb_import_core_links
   WHERE kb_import_core_links.batch_id = target_batch_id;

  SELECT
    (SELECT count(*) FROM public.kb_source_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_entity_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_relation_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_dosage_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_safety_candidates WHERE batch_id = target_batch_id)
    INTO actual_count;

  IF linked_count <> actual_count THEN
    RAISE EXCEPTION 'Wiesenauer internal materialization incomplete: % of % candidates linked', linked_count, actual_count;
  END IF;
END seed;
$seed$;

COMMIT;
`;

writeFileSync(migrationPath, sql, "utf8");

console.log(JSON.stringify({
  inventory: inventoryRelativePath,
  migration: "supabase/migrations/20260820160000_import_wiesenauer_phytopraxis_internal.sql",
  sourceSections: inventory.sections.length,
  categories: categoriesByKey.size,
  sourceCards: mappings.length,
  inventoryHash,
}, null, 2));
