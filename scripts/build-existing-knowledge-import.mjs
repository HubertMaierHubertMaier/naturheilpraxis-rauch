import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const docsRoot = resolve(repoRoot, "docs");
const inventoryRoot = resolve(docsRoot, "source-inventory");
const consolidatedResearchRoot = resolve(repoRoot, "..", "..", "..", "Strunz-Quelleninventur-2026-08-04");
const consolidatedSnapshotPath = resolve(docsRoot, "consolidated-research-artifacts-2026-08-12.json");
const outputJsonPath = resolve(docsRoot, "existing-knowledge-import-batches-2026-08-12.json");
const outputSqlPath = resolve(repoRoot, "supabase/migrations/20260812101000_import_existing_knowledge_candidates.sql");

const hash = (value) => createHash("sha256").update(value).digest("hex");

function stableUuid(key) {
  const bytes = Buffer.from(hash(key).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "unbenannt";
}

function asString(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function candidateBase(batchId, kind, key) {
  return {
    id: stableUuid(`${batchId}:${kind}:${key}`),
    batch_id: batchId,
    candidate_key: key,
    candidate_status: "imported_unreviewed",
    data_classification: "general_knowledge",
  };
}

function createBatch(key, details) {
  const id = stableUuid(`existing-knowledge-batch:${key}`);
  return {
    id,
    batch: {
      id,
      source_kind: "json",
      source_label: details.sourceLabel,
      source_hash: details.sourceHash,
      parser_name: "build-existing-knowledge-import",
      parser_version: "1.0.0",
      model_name: "",
      prompt_hash: null,
      batch_status: "created",
      candidate_count: 0,
      error_count: 0,
      data_classification: "general_knowledge",
      metadata: {
        admin_only: true,
        patient_facing_allowed: false,
        publication: "unpublished_internal_staging",
        import_scope: key,
        ...details.metadata,
      },
    },
    source_candidates: [],
    entity_candidates: [],
    dosage_candidates: [],
    safety_candidates: [],
  };
}

function finalizeBatch(batch) {
  batch.batch.candidate_count = [
    batch.source_candidates,
    batch.entity_candidates,
    batch.dosage_candidates,
    batch.safety_candidates,
  ].reduce((total, candidates) => total + candidates.length, 0);
  return batch;
}

function targetDetails(raw) {
  const targets = Array.isArray(raw.targets) ? raw.targets : [];
  const target = raw.target && typeof raw.target === "object" ? raw.target : {};
  const targetIds = [
    raw.targetUuid,
    raw.targetId,
    raw.target_uuid,
    target.id,
    target.uuid,
    ...targets.map((item) => item?.id || item?.uuid),
  ].map(asString).filter(Boolean);
  const targetTitles = [
    raw.title,
    target.title,
    ...targets.map((item) => item?.title),
  ].map(asString).filter(Boolean);
  return {
    targetIds: [...new Set(targetIds)],
    targetTitles: [...new Set(targetTitles)],
  };
}

function arrayCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

function claimCount(raw) {
  if (Array.isArray(raw.claims)) return raw.claims.length;
  if (raw.claims && typeof raw.claims === "object") {
    return Object.values(raw.claims).reduce((total, value) => total + arrayCount(value), 0);
  }
  return Array.isArray(raw.claimAssessment) ? raw.claimAssessment.length : 0;
}

function candidateCount(raw) {
  return arrayCount(raw.candidates) || arrayCount(raw.sources) || arrayCount(raw.bibliographicSources);
}

function isSafetyArtifact(file, raw) {
  return /SICHERHEITS|FREIGABE-SPERRMATRIX/.test(file)
    || /safety/i.test(asString(raw.auditType || raw.matrixType))
    || Boolean(raw.separateSafetyReviewFields);
}

function isDosageArtifact(raw) {
  return /dosage|dosing|dailyPortion|daily dose|Dosierung|Dosis|Einnahme|IU\/day|mg\/day|µg\/day/i.test(JSON.stringify(raw));
}

function readConsolidatedArtifacts() {
  if (existsSync(consolidatedSnapshotPath)) {
    const snapshot = readJson(consolidatedSnapshotPath);
    return snapshot.artifacts.map((artifact) => ({
      file: artifact.file,
      rawText: artifact.raw_text,
    }));
  }
  if (!existsSync(consolidatedResearchRoot)) {
    throw new Error("Konsolidierte Fachartefakte oder Repository-Snapshot fehlen.");
  }
  return readdirSync(consolidatedResearchRoot)
    .filter((name) => /^(?:WIKI|STRUNZ|N2)-.*\.json$/.test(name))
    .sort()
    .map((file) => ({ file, rawText: readFileSync(resolve(consolidatedResearchRoot, file), "utf8") }));
}

function consolidatedResearchBatch() {
  const artifacts = readConsolidatedArtifacts();
  const sourceBytes = artifacts.map(({ file, rawText }) => `${file}\n${rawText}`).join("\n");
  const batch = createBatch("consolidated-wiki-and-strunz-research-2026-08-04-05", {
    sourceLabel: "Konsolidierte Wiki-, Strunz-, Naehrstoff- und Sicherheitsartefakte 2026-08-04/05",
    sourceHash: hash(sourceBytes),
    metadata: {
      artifact_files: artifacts.length,
      source_family: "Bestehende Wiki- und Strunz-Fachrecherche",
      retention_mode: "lossless_artifact_plus_separated_review_candidates",
    },
  });

  for (const { file, rawText } of artifacts) {
    const raw = JSON.parse(rawText);
    const fileKey = slug(basename(file, ".json"));
    const { targetIds, targetTitles } = targetDetails(raw);
    const safetyArtifact = isSafetyArtifact(file, raw);
    const dosageArtifact = isDosageArtifact(raw);
    const sourceKey = `source:consolidated-research:${fileKey}`;
    const sourceLocator = `docs/consolidated-research-artifacts-2026-08-12.json#${file}`;
    const source = {
      ...candidateBase(batch.id, "source", sourceKey),
      proposed_source_type: "practice_document",
      title: targetTitles.length ? `${basename(file, ".json")}: ${targetTitles.join(" / ")}` : basename(file, ".json"),
      publisher: "Interne Quellen- und Sicherheitsrecherche",
      publication_date: null,
      source_url: "",
      external_identifier: targetIds.join(","),
      rights_status: "unknown",
      source_locator: sourceLocator,
      original_excerpt: rawText,
      confidence: 100,
      ambiguity_notes: "Das konsolidierte Originalartefakt bleibt vollstaendig erhalten. Quellenhinweise, Aussagen, Bewertungen und offene Luecken sind keine Freigabe.",
      proposed_data: {
        admin_only: true,
        patient_facing_allowed: false,
        review_status: "unreviewed",
        artifact_file: file,
        artifact_sha256: hash(rawText),
        target_ids: targetIds,
        target_titles: targetTitles,
        claim_count: claimCount(raw),
        source_candidate_count: candidateCount(raw),
        safety_artifact: safetyArtifact,
        dosage_artifact: dosageArtifact,
      },
    };
    batch.source_candidates.push(source);

    const entity = {
      ...candidateBase(batch.id, "entity", `entity:consolidated-research:${fileKey}`),
      proposed_entity_type_code: null,
      proposed_canonical_key: null,
      display_name: targetTitles.join(" / ") || basename(file, ".json"),
      aliases: targetIds,
      description_markdown: "Interner ungepruefter Bezug fuer das vollstaendig erhaltene Forschungsartefakt.",
      source_candidate_id: source.id,
      source_locator: sourceLocator,
      original_excerpt: JSON.stringify({ artifact_file: file, artifact_sha256: hash(rawText), target_ids: targetIds, target_titles: targetTitles }),
      confidence: 100,
      ambiguity_notes: "Der Bezug dient nur der getrennten Pruefung von Aussagen, Dosierungen und Sicherheit; keine kanonische Entitaet oder Freigabe.",
      proposed_data: {
        admin_only: true,
        patient_facing_allowed: false,
        review_status: "unreviewed",
        target_ids: targetIds,
        target_titles: targetTitles,
        artifact_file: file,
      },
    };
    batch.entity_candidates.push(entity);

    if (dosageArtifact) {
      batch.dosage_candidates.push({
        ...candidateBase(batch.id, "dosage", `dosage:consolidated-research:${fileKey}`),
        subject_candidate_id: entity.id,
        application_route: "",
        minimum_dose: null,
        maximum_dose: null,
        dose_unit: "",
        reference_period: "",
        frequency_text: "",
        duration_text: "",
        timing_text: "",
        application_text: "Dosierungs- und Anwendungsaussagen sind im unveraenderten Originalartefakt enthalten und muessen einzeln strukturiert sowie geprueft werden.",
        source_candidate_id: source.id,
        source_locator: sourceLocator,
        original_excerpt: JSON.stringify({ artifact_file: file, artifact_sha256: hash(rawText), target_ids: targetIds, target_titles: targetTitles }),
        confidence: 100,
        ambiguity_notes: "Keine Zahl, Einheit, Dauer oder Zielgruppe wurde automatisch als Praxisdosis interpretiert.",
        proposed_data: {
          admin_only: true,
          patient_facing_allowed: false,
          dosage_status: "unverified",
          target_ids: targetIds,
          target_titles: targetTitles,
          artifact_file: file,
        },
      });
    }

    if (safetyArtifact) {
      batch.safety_candidates.push({
        ...candidateBase(batch.id, "safety", `safety:consolidated-research:${fileKey}`),
        subject_candidate_id: entity.id,
        rule_type: "precaution",
        severity: "require_review",
        action_text: "Sicherheitsbewertung, Gegenanzeigen, Interaktionen und besondere Personengruppen aus diesem Artefakt vor jeder Verwendung einzeln pruefen.",
        source_candidate_id: source.id,
        source_locator: sourceLocator,
        original_excerpt: JSON.stringify({ artifact_file: file, artifact_sha256: hash(rawText), target_ids: targetIds, target_titles: targetTitles }),
        confidence: 100,
        ambiguity_notes: "Die interne Aufnahme bewahrt auch negative, widerspruechliche und offene Bewertungen; sie ist keine Sicherheits- oder Patientenfreigabe.",
        proposed_data: {
          admin_only: true,
          patient_facing_allowed: false,
          safety_review_required: true,
          target_ids: targetIds,
          target_titles: targetTitles,
          artifact_file: file,
        },
      });
    }
  }

  return finalizeBatch(batch);
}

function mannayanBatch() {
  const files = readdirSync(inventoryRoot)
    .filter((name) => name.endsWith(".json") && /mannayan/i.test(name))
    .sort();
  const sourceBytes = files.map((name) => `${name}\n${readFileSync(resolve(inventoryRoot, name), "utf8")}`).join("\n");
  const batch = createBatch("mannayan-source-inventories-2026-08-07", {
    sourceLabel: "Mannayan Produkt-, Inhaltsstoff- und Sicherheitsinventare 2026-08-07/08",
    sourceHash: hash(sourceBytes),
    metadata: { inventory_files: files.length, source_family: "Mannayan" },
  });

  for (const file of files) {
    const raw = readJson(resolve(inventoryRoot, file));
    const product = raw.product || {};
    const productNumber = asString(product.productNumber || product.manufacturerProductNumber);
    const title = asString(product.title || raw.inventory || basename(file, ".json"));
    const manufacturer = asString(product.manufacturer) || "Mannayan GmbH & Co. KG";
    const manufacturerSource = asString(product.manufacturerSource);
    const inventoryClaims = Array.isArray(raw.atomicStatements)
      ? raw.atomicStatements
      : Array.isArray(raw.claims) ? raw.claims : [];
    const sourceGaps = Array.isArray(raw.sourceGaps) ? raw.sourceGaps : [];
    const sourceCandidates = Array.isArray(raw.sourceCandidates) ? raw.sourceCandidates : [];
    const identityKey = productNumber || slug(title);
    const sourceKey = `source:mannayan-inventory:${identityKey}`;
    const entityKey = `entity:mannayan-product:${identityKey}`;
    const source = {
      ...candidateBase(batch.id, "source", sourceKey),
      proposed_source_type: "manufacturer",
      title: `Mannayan-Inventar: ${title}`,
      publisher: manufacturer,
      publication_date: null,
      source_url: manufacturerSource,
      external_identifier: productNumber,
      rights_status: "unknown",
      source_locator: `docs/source-inventory/${file}`,
      original_excerpt: JSON.stringify(raw),
      confidence: 100,
      ambiguity_notes: "Herstellerdeklaration und interne Pruefluecken bleiben getrennt; keine fachliche, Sicherheits- oder Dosierungsfreigabe.",
      proposed_data: {
        admin_only: true,
        patient_facing_allowed: false,
        review_status: "unreviewed",
        inventory_file: file,
        inventory: raw,
      },
    };
    batch.source_candidates.push(source);

    const entity = {
      ...candidateBase(batch.id, "entity", entityKey),
      proposed_entity_type_code: "product_variant",
      proposed_canonical_key: `product-variant:mannayan:${slug(identityKey)}`,
      display_name: title,
      aliases: [asString(raw.inventory)].filter(Boolean),
      description_markdown: `Interner ungepruefter Produktvarianten-Kandidat von ${manufacturer}.`,
      source_candidate_id: source.id,
      source_locator: source.source_locator,
      original_excerpt: JSON.stringify(product),
      confidence: 100,
      ambiguity_notes: "Produktidentitaet, Variante, Rezepturgueltigkeit und Katalogabgleich muessen vor einer Draft-Promotion manuell bestaetigt werden.",
      proposed_data: {
        admin_only: true,
        patient_facing_allowed: false,
        review_status: "unreviewed",
        dosage_status: "unverified",
        manufacturer,
        product,
        atomic_statements: inventoryClaims,
        source_gaps: sourceGaps,
        additional_source_candidates: sourceCandidates,
      },
    };
    batch.entity_candidates.push(entity);

    const dosageClaims = inventoryClaims.filter((claim) => /dose|dosage|intake|einnah|verzehr|recommended/i.test(`${claim.id || ""} ${claim.type || ""}`));
    if (dosageClaims.length) {
      const dosageKey = `dosage:mannayan-product:${identityKey}`;
      batch.dosage_candidates.push({
        ...candidateBase(batch.id, "dosage", dosageKey),
        subject_candidate_id: entity.id,
        application_route: "oral",
        minimum_dose: null,
        maximum_dose: null,
        dose_unit: "",
        reference_period: "",
        frequency_text: "",
        duration_text: "",
        timing_text: "",
        application_text: dosageClaims.map((claim) => `${claim.id || claim.type}: ${asString(claim.value)}`).join("; "),
        source_candidate_id: source.id,
        source_locator: source.source_locator,
        original_excerpt: JSON.stringify(dosageClaims),
        confidence: 100,
        ambiguity_notes: "Quellengetreue Herstellerangabe; Zahlen und Einheiten wurden nicht interpretiert und sind nicht als Praxisdosis freigegeben.",
        proposed_data: {
          admin_only: true,
          patient_facing_allowed: false,
          dosage_status: "unverified",
          manufacturer_dosage_claims: dosageClaims,
        },
      });
    }

    const safetyClaims = inventoryClaims.filter((claim) => /warning|contraindication|interaction|safety|pregnan|child|renal|hepatic|ulcer|liver|kidney/i.test(`${claim.id || ""} ${claim.type || ""}`));
    const safetyKey = `safety:mannayan-product:${identityKey}`;
    batch.safety_candidates.push({
      ...candidateBase(batch.id, "safety", safetyKey),
      subject_candidate_id: entity.id,
      rule_type: "precaution",
      severity: "require_review",
      action_text: "Produkt vor jeder fachlichen oder patientengerichteten Verwendung auf Rezeptur, Gegenanzeigen, Interaktionen, besondere Personengruppen und Organfunktion pruefen.",
      source_candidate_id: source.id,
      source_locator: source.source_locator,
      original_excerpt: JSON.stringify({ safetyClaims, sourceGaps, sourceCandidates }),
      confidence: 100,
      ambiguity_notes: "Herstellerwarnungen, unabhaengige Quellenkandidaten und offene Pruefluecken sind noch keine Sicherheitsfreigabe.",
      proposed_data: {
        admin_only: true,
        patient_facing_allowed: false,
        safety_review_required: true,
        manufacturer_safety_claims: safetyClaims,
        source_gaps: sourceGaps,
        independent_source_candidates: sourceCandidates,
      },
    });
  }

  return finalizeBatch(batch);
}

function klinghardtBatch() {
  const rawText = readFileSync(resolve(docsRoot, "klinghardt-talks-001-025-import-batch.json"), "utf8");
  const raw = JSON.parse(rawText);
  const batch = createBatch("klinghardt-talks-001-025", {
    sourceLabel: raw.batch.source_label,
    sourceHash: raw.batch.source_hash || hash(rawText),
    metadata: { ...raw.batch.metadata, source_family: "Klinghardt Talks" },
  });
  batch.source_candidates = raw.source_candidates.map((candidate) => ({
    ...candidateBase(batch.id, "source", candidate.candidate_key),
    ...candidate,
    id: stableUuid(`${batch.id}:source:${candidate.candidate_key}`),
    batch_id: batch.id,
    data_classification: "general_knowledge",
    proposed_data: {
      admin_only: true,
      patient_facing_allowed: false,
      review_status: "unreviewed",
      ...candidate.proposed_data,
    },
  }));
  return finalizeBatch(batch);
}

const supportingArtifactPattern = /^(?:claims-boundary|efsa-|eu-health-|nhs-|nutrient-reference|preflight-source|product-form|product-gate|product-preflight|release-block|source-access|source-recency|strunz-(?:b-complex|commercial|iodine|iron|magnesium|selenium|vitamin-c|vitamin-d3|vitamineral|zinc)|uk-|who-).*\.json$/;

function artifactTitle(file, raw) {
  return asString(raw.scope || raw.review_gate || raw.product_source_id || raw.source_type)
    ? `${basename(file, ".json")}: ${asString(raw.scope || raw.review_gate || raw.product_source_id || raw.source_type)}`
    : basename(file, ".json");
}

function strunzAndNutrientBatch() {
  const productBatchText = readFileSync(resolve(docsRoot, "strunz-public-product-import-batch-2026-08-04.json"), "utf8");
  const productBatch = JSON.parse(productBatchText);
  const artifactFiles = readdirSync(docsRoot).filter((name) => supportingArtifactPattern.test(name)).sort();
  const artifactBytes = artifactFiles.map((name) => `${name}\n${readFileSync(resolve(docsRoot, name), "utf8")}`).join("\n");
  const batch = createBatch("strunz-products-and-nutrient-reviews-2026-08-04-09", {
    sourceLabel: "Strunz Produktdeklarationen sowie Vitamin-, Mineralstoff- und Sicherheitspruefungen 2026-08-04 bis 09",
    sourceHash: hash(`${productBatchText}\n${artifactBytes}`),
    metadata: {
      product_source_cards: productBatch.source_candidates.length,
      review_and_reference_artifacts: artifactFiles.length,
      source_family: "Strunz und unabhaengige Naehrstoffquellen",
    },
  });
  const entityByProductSourceId = new Map();

  for (const candidate of productBatch.source_candidates) {
    const source = {
      ...candidateBase(batch.id, "source", candidate.candidate_key),
      ...candidate,
      id: stableUuid(`${batch.id}:source:${candidate.candidate_key}`),
      batch_id: batch.id,
      data_classification: "general_knowledge",
      proposed_data: {
        admin_only: true,
        patient_facing_allowed: false,
        review_status: "unreviewed",
        ...candidate.proposed_data,
      },
    };
    batch.source_candidates.push(source);
    const declaration = candidate.proposed_data.product_declaration || {};
    const entityKey = `entity:strunz-product:${candidate.external_identifier}`;
    const entity = {
      ...candidateBase(batch.id, "entity", entityKey),
      proposed_entity_type_code: "product_variant",
      proposed_canonical_key: `product-variant:strunz:${slug(declaration.ean || candidate.external_identifier)}`,
      display_name: [declaration.brand, declaration.name].filter(Boolean).join(" ") || candidate.title,
      aliases: Array.isArray(candidate.proposed_data.aliases) ? candidate.proposed_data.aliases : [],
      description_markdown: "Unveroeffentlichter Produktvarianten-Kandidat aus einer oeffentlichen Herstellerdeklaration.",
      source_candidate_id: source.id,
      source_locator: source.source_locator,
      original_excerpt: candidate.original_excerpt,
      confidence: candidate.confidence,
      ambiguity_notes: "Produktdeklaration, Nährstoffformen, Mengen, Warnungen und unabhaengige Bewertung bleiben getrennt.",
      proposed_data: {
        admin_only: true,
        patient_facing_allowed: false,
        review_status: "unreviewed",
        dosage_status: "unverified",
        product_declaration: declaration,
        nutrients: candidate.proposed_data.nutrients || [],
        declared_component_amounts: candidate.proposed_data.declared_component_amounts || [],
        manufacturer_warning_topics: candidate.proposed_data.manufacturer_warning_topics || [],
      },
    };
    batch.entity_candidates.push(entity);
    entityByProductSourceId.set(candidate.external_identifier, { entity, source });

    if (declaration.manufacturer_daily_use) {
      const dosageKey = `dosage:strunz-product:${candidate.external_identifier}`;
      batch.dosage_candidates.push({
        ...candidateBase(batch.id, "dosage", dosageKey),
        subject_candidate_id: entity.id,
        application_route: "oral",
        minimum_dose: null,
        maximum_dose: null,
        dose_unit: "",
        reference_period: "",
        frequency_text: asString(declaration.manufacturer_daily_use),
        duration_text: "",
        timing_text: "",
        application_text: `Herstellerangabe: ${asString(declaration.manufacturer_daily_use)}; Bezugsmenge: ${asString(declaration.serving)}`,
        source_candidate_id: source.id,
        source_locator: source.source_locator,
        original_excerpt: candidate.original_excerpt,
        confidence: candidate.confidence,
        ambiguity_notes: "Herstellerangabe; keine medizinische Dosierungsfreigabe.",
        proposed_data: {
          admin_only: true,
          patient_facing_allowed: false,
          dosage_status: "unverified",
          manufacturer_daily_use: declaration.manufacturer_daily_use,
          serving: declaration.serving,
        },
      });
    }
  }

  for (const file of artifactFiles) {
    const raw = readJson(resolve(docsRoot, file));
    const sourceKey = `source:internal-nutrient-review:${slug(basename(file, ".json"))}`;
    const directUrl = asString(raw.source_url);
    const isIndependentReference = Boolean(directUrl) && !raw.review_gate && !raw.product_source_id;
    const source = {
      ...candidateBase(batch.id, "source", sourceKey),
      proposed_source_type: isIndependentReference ? "website" : "practice_document",
      title: artifactTitle(file, raw),
      publisher: asString(raw.publisher) || (isIndependentReference ? "Externe Fachquelle" : "Interne Quellen- und Sicherheitspruefung"),
      publication_date: null,
      source_url: directUrl,
      external_identifier: asString(raw.product_source_id),
      rights_status: "unknown",
      source_locator: `docs/${file}`,
      original_excerpt: JSON.stringify(raw),
      confidence: 100,
      ambiguity_notes: "Der Original-Pruefstand bleibt vollstaendig erhalten; offene Evidenz oder Sicherheit verhindert keine interne Aufnahme, aber jede Freigabe.",
      proposed_data: {
        admin_only: true,
        patient_facing_allowed: false,
        review_status: "unreviewed",
        artifact_file: file,
        artifact: raw,
      },
    };
    batch.source_candidates.push(source);

    const productLink = entityByProductSourceId.get(asString(raw.product_source_id));
    if (productLink) {
      const records = [
        raw.interaction_review?.current_record,
        raw.safety_review?.current_record,
        raw.form_review?.current_record,
        raw.population_review?.current_record,
      ].filter(Boolean);
      const safetyKey = `safety:${raw.product_source_id}:${slug(raw.review_gate || file)}`;
      batch.safety_candidates.push({
        ...candidateBase(batch.id, "safety", safetyKey),
        subject_candidate_id: productLink.entity.id,
        rule_type: "precaution",
        severity: "require_review",
        action_text: records.join(" ") || `Pruefstatus ${asString(raw.status) || "offen"}; vor Freigabe manuell bewerten.`,
        source_candidate_id: source.id,
        source_locator: source.source_locator,
        original_excerpt: JSON.stringify(raw),
        confidence: 100,
        ambiguity_notes: "Interne Fachpruefung mit offenem Status; keine Produkt-, Interaktions-, Dosis- oder Patientenfreigabe.",
        proposed_data: {
          admin_only: true,
          patient_facing_allowed: false,
          safety_review_required: true,
          review_gate: raw.review_gate || "source_review",
          status: raw.status || "unreviewed",
          assessment: raw,
        },
      });
    }
  }

  return finalizeBatch(batch);
}

export function buildExistingKnowledgeImport() {
  const batches = [mannayanBatch(), klinghardtBatch(), strunzAndNutrientBatch(), consolidatedResearchBatch()];
  const totals = batches.reduce((sum, batch) => {
    sum.batches += 1;
    sum.sources += batch.source_candidates.length;
    sum.entities += batch.entity_candidates.length;
    sum.dosages += batch.dosage_candidates.length;
    sum.safety += batch.safety_candidates.length;
    sum.candidates += batch.batch.candidate_count;
    return sum;
  }, { batches: 0, sources: 0, entities: 0, dosages: 0, safety: 0, candidates: 0 });
  return {
    schema_version: 1,
    generated_at: "2026-08-12T00:00:00.000Z",
    publication: "unpublished_internal_staging",
    admin_only: true,
    patient_facing_allowed: false,
    totals,
    batches,
  };
}

const sqlText = (value) => value === null || value === undefined ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const sqlOriginalText = (value) => String(value || "").includes("\n")
  ? `convert_from(decode(${sqlText(Buffer.from(String(value), "utf8").toString("base64"))}, 'base64'), 'UTF8')`
  : sqlText(value);
const sqlJson = (value) => `${sqlText(JSON.stringify(value))}::jsonb`;
const sqlTextArray = (values) => `ARRAY[${(values || []).map(sqlText).join(", ")}]::text[]`;

function renderInsert(table, columns, rows, serializers = {}) {
  if (!rows.length) return "";
  const values = rows.map((row) => `  (${columns.map((column) => {
    if (serializers[column]) return serializers[column](row[column]);
    if (typeof row[column] === "number") return String(row[column]);
    return sqlText(row[column]);
  }).join(", ")})`).join(",\n");
  return `INSERT INTO public.${table} (${columns.join(", ")})\nVALUES\n${values};\n`;
}

function renderBatchSql(batch) {
  const sourceColumns = ["id", "batch_id", "candidate_key", "candidate_status", "proposed_source_type", "title", "publisher", "publication_date", "source_url", "external_identifier", "rights_status", "source_locator", "original_excerpt", "confidence", "ambiguity_notes", "proposed_data", "data_classification"];
  const entityColumns = ["id", "batch_id", "candidate_key", "candidate_status", "proposed_entity_type_code", "proposed_canonical_key", "display_name", "aliases", "description_markdown", "source_candidate_id", "source_locator", "original_excerpt", "confidence", "ambiguity_notes", "proposed_data", "data_classification"];
  const dosageColumns = ["id", "batch_id", "candidate_key", "candidate_status", "subject_candidate_id", "application_route", "minimum_dose", "maximum_dose", "dose_unit", "reference_period", "frequency_text", "duration_text", "timing_text", "application_text", "source_candidate_id", "source_locator", "original_excerpt", "confidence", "ambiguity_notes", "proposed_data", "data_classification"];
  const safetyColumns = ["id", "batch_id", "candidate_key", "candidate_status", "subject_candidate_id", "rule_type", "severity", "action_text", "source_candidate_id", "source_locator", "original_excerpt", "confidence", "ambiguity_notes", "proposed_data", "data_classification"];
  const expectedCount = batch.batch.candidate_count;
  const inserts = [
    `INSERT INTO public.kb_import_batches (id, source_kind, source_label, source_hash, parser_name, parser_version, model_name, prompt_hash, batch_status, candidate_count, error_count, data_classification, metadata)\nVALUES (${sqlText(batch.id)}, ${sqlText(batch.batch.source_kind)}, ${sqlText(batch.batch.source_label)}, ${sqlText(batch.batch.source_hash)}, ${sqlText(batch.batch.parser_name)}, ${sqlText(batch.batch.parser_version)}, '', NULL, 'created', ${expectedCount}, 0, 'general_knowledge', ${sqlJson(batch.batch.metadata)});\n`,
    renderInsert("kb_source_candidates", sourceColumns, batch.source_candidates, { original_excerpt: sqlOriginalText, proposed_data: sqlJson }),
    renderInsert("kb_entity_candidates", entityColumns, batch.entity_candidates, { aliases: sqlTextArray, original_excerpt: sqlOriginalText, proposed_data: sqlJson }),
    renderInsert("kb_dosage_candidates", dosageColumns, batch.dosage_candidates, { original_excerpt: sqlOriginalText, proposed_data: sqlJson }),
    renderInsert("kb_safety_candidates", safetyColumns, batch.safety_candidates, { original_excerpt: sqlOriginalText, proposed_data: sqlJson }),
    `UPDATE public.kb_import_batches SET batch_status = 'processing' WHERE id = ${sqlText(batch.id)};\n`,
    `UPDATE public.kb_import_batches SET batch_status = 'ready_for_review' WHERE id = ${sqlText(batch.id)};\n`,
  ].join("\n");
  const indentedInserts = inserts.split("\n").map((line) => line ? `    ${line}` : "").join("\n");
  return `DO $seed$\nBEGIN\n  IF EXISTS (SELECT 1 FROM public.kb_import_batches WHERE id = ${sqlText(batch.id)}) THEN\n    IF NOT EXISTS (SELECT 1 FROM public.kb_import_batches WHERE id = ${sqlText(batch.id)} AND source_hash = ${sqlText(batch.batch.source_hash)} AND candidate_count = ${expectedCount}) THEN\n      RAISE EXCEPTION 'Existing knowledge batch ${batch.id} does not match its immutable manifest';\n    END IF;\n  ELSE\n${indentedInserts}\n  END IF;\nEND;\n$seed$;\n`;
}

export function renderExistingKnowledgeImportSql(bundle) {
  return [
    "BEGIN;",
    "",
    "-- Internal source retention only. Every candidate remains admin-only and unreviewed.",
    "-- No row is promoted into released knowledge or patient-facing output by this migration.",
    "",
    ...bundle.batches.map(renderBatchSql),
    "COMMIT;",
    "",
  ].join("\n");
}

function verifyBundle(bundle) {
  if (bundle.batches.length !== 4) throw new Error("Vier getrennte Importgruppen erwartet.");
  for (const batch of bundle.batches) {
    const all = [...batch.source_candidates, ...batch.entity_candidates, ...batch.dosage_candidates, ...batch.safety_candidates];
    if (all.length !== batch.batch.candidate_count) throw new Error(`Kandidatenzaehlung stimmt nicht: ${batch.batch.source_label}`);
    if (all.some((candidate) => candidate.candidate_status !== "imported_unreviewed")) throw new Error("Nur imported_unreviewed ist zulaessig.");
    if (all.some((candidate) => candidate.data_classification !== "general_knowledge")) throw new Error("Nur allgemeines Wissen darf in das Staging.");
    if (all.some((candidate) => candidate.proposed_data?.patient_facing_allowed !== false)) throw new Error("Patientensichtbarkeit muss blockiert bleiben.");
  }
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const bundle = buildExistingKnowledgeImport();
  verifyBundle(bundle);
  const json = `${JSON.stringify(bundle, null, 2)}\n`;
  const sql = renderExistingKnowledgeImportSql(bundle);
  if (process.argv.includes("--verify")) {
    if (readFileSync(outputJsonPath, "utf8") !== json) throw new Error("Import-Bundle ist nicht aktuell.");
    if (readFileSync(outputSqlPath, "utf8") !== sql) throw new Error("Import-Migration ist nicht aktuell.");
  } else {
    writeFileSync(outputJsonPath, json);
    writeFileSync(outputSqlPath, sql);
  }
  process.stdout.write(`${JSON.stringify(bundle.totals)}\n`);
}
