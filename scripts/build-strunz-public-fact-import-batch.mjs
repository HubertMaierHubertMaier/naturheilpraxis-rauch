import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const parserName = "build-strunz-public-fact-import-batch";
const parserVersion = "1.0.0";

function requiredString(value, field, sourceID) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Strunz-Faktenkarte ${sourceID}: ${field} fehlt.`);
  }
  return value.trim();
}

function normalizedContent(card) {
  const nutrientLines = card.nutrients.map((nutrient) => {
    const form = nutrient.form ? ` (${nutrient.form})` : "";
    return `- ${nutrient.name}${form}: ${nutrient.amount} ${nutrient.unit}; ${nutrient.nrv_percent}% NRV.`;
  });
  const warningLines = card.manufacturer_warning_topics.length > 0
    ? card.manufacturer_warning_topics.map((topic) => `- ${topic}.`)
    : ["- No product-specific warning topic was normalized from this snapshot."];

  return [
    "**Status:** Public manufacturer product declaration, normalized as an unpublished source candidate. This is neither a therapeutic recommendation nor patient-facing content.",
    "",
    "## Product declaration",
    `- ${card.product.brand} ${card.product.name}; EAN ${card.product.ean}.`,
    `- Declared serving: ${card.product.serving}.`,
    `- Manufacturer-declared daily use: ${card.product.manufacturer_daily_use}; unreviewed and not approved as a dosage recommendation.`,
    "",
    "## Declared vitamins and minerals",
    ...nutrientLines,
    "",
    "## Manufacturer warning topics",
    ...warningLines,
    "",
    "## Review boundary",
    "Evidence, safety, dosage, and medical-use review remain open. The card makes no condition, symptom, prevention, or treatment claim.",
  ].join("\n");
}

export function buildStrunzPublicFactImportBatch(sourceText) {
  const sourceHash = createHash("sha256").update(sourceText).digest("hex");
  const source = JSON.parse(sourceText);
  if (source?.publication?.wiki_writes !== false || source?.publication?.database_writes !== false) {
    throw new Error("Strunz-Faktenkarten duerfen keine Wiki- oder Datenbankschreibfreigabe enthalten.");
  }
  if (!Array.isArray(source?.source_cards) || source.source_cards.length === 0) {
    throw new Error("Die Strunz-Faktenkarten muessen als nicht leeres source_cards-Array vorliegen.");
  }
  if (source.coverage?.condition_or_symptom_cards !== 0) {
    throw new Error("Strunz-Faktenbatch akzeptiert keine Krankheits- oder Symptomkarten.");
  }

  const seenKeys = new Set();
  const sourceCandidates = source.source_cards.map((card) => {
    const sourceID = requiredString(card.source_id, "source_id", "unbekannt");
    const candidateKey = `source:${sourceID}`;
    if (seenKeys.has(candidateKey)) {
      throw new Error(`Doppelte Strunz-Faktenkarte: ${sourceID}`);
    }
    seenKeys.add(candidateKey);

    const product = card.product || {};
    const title = `Strunz-Faktenkarte: ${requiredString(product.brand, "product.brand", sourceID)} ${requiredString(product.name, "product.name", sourceID)}`;
    const sourceURL = requiredString(card.source_url, "source_url", sourceID);
    const snapshotHash = requiredString(card.snapshot_sha256, "snapshot_sha256", sourceID);
    if (!/^[a-f0-9]{64}$/.test(snapshotHash)) {
      throw new Error(`Strunz-Faktenkarte ${sourceID}: snapshot_sha256 ist ungueltig.`);
    }
    if (!Array.isArray(card.nutrients) || card.nutrients.length === 0) {
      throw new Error(`Strunz-Faktenkarte ${sourceID}: nutrients fehlt.`);
    }
    for (const nutrient of card.nutrients) {
      requiredString(nutrient?.name, "nutrient.name", sourceID);
      if (!Number.isFinite(Number(nutrient?.amount)) || Number(nutrient.amount) <= 0) {
        throw new Error(`Strunz-Faktenkarte ${sourceID}: nutrient.amount ist ungueltig.`);
      }
      if (!["mg", "ug"].includes(nutrient?.unit)) {
        throw new Error(`Strunz-Faktenkarte ${sourceID}: nutrient.unit ist ungueltig.`);
      }
    }

    const content = normalizedContent({
      ...card,
      product,
      manufacturer_warning_topics: Array.isArray(card.manufacturer_warning_topics)
        ? card.manufacturer_warning_topics
        : [],
    });
    return {
      candidate_key: candidateKey,
      candidate_status: "imported_unreviewed",
      proposed_source_type: "website",
      title,
      publisher: requiredString(card.publisher, "publisher", sourceID),
      publication_date: null,
      source_url: sourceURL,
      external_identifier: sourceID,
      rights_status: "unknown",
      source_locator: `Public product declaration captured ${requiredString(card.retrieved_at, "retrieved_at", sourceID)}; snapshot SHA-256 ${snapshotHash}.`,
      original_excerpt: content,
      confidence: 100,
      ambiguity_notes: "Normalized manufacturer declaration only. It remains unpublished and separates product facts from evidence, safety, dosage approval, and medical use.",
      proposed_data: {
        card_type: "strunz_public_product_fact_card",
        candidate_id: sourceID,
        aliases: [product.name],
        tags: ["Herstellerangabe", "Oeffentliche Produktdeklaration", "Quellenkarte", "Strunz", "Unveroeffentlicht"],
        therapeutic_topics: ["Vitamine und Mineralstoffe"],
        dosage_status: "unverified",
        evidence_level: "unrated",
        safety_notes: "Herstellerangabe; keine Praxisempfehlung, keine Selbstanwendung und keine Patientenfreigabe. Sicherheitspruefung steht aus.",
        source_citations: [{
          label: `Strunz oeffentliche Produktdeklaration vom ${card.retrieved_at}; Snapshot SHA-256 ${snapshotHash}`,
          url: sourceURL,
        }],
        source_file: "external/strunz/public-product-declarations/2026-08-04",
        product_declaration: product,
        nutrients: card.nutrients,
        declared_component_amounts: card.declared_component_amounts || [],
        manufacturer_warning_topics: card.manufacturer_warning_topics || [],
        content,
      },
    };
  });

  return {
    schema_version: 1,
    batch: {
      source_kind: "json",
      source_label: "Strunz oeffentliche Produktdeklarationen 2026-08-04: Faktenkarten",
      source_hash: sourceHash,
      parser_name: parserName,
      parser_version: parserVersion,
      model_name: "",
      prompt_hash: null,
      batch_status: "created",
      candidate_count: sourceCandidates.length,
      error_count: 0,
      data_classification: "general_knowledge",
      metadata: {
        card_type: "strunz_public_product_fact_card",
        source_cards: sourceCandidates.length,
        disease_or_symptom_cards: 0,
        import_scope: "public-product-facts-2026-08-04",
        publication: "unpublished_internal_staging",
      },
    },
    source_candidates: sourceCandidates,
  };
}

function argumentValue(argumentsList, name) {
  const index = argumentsList.indexOf(name);
  return index >= 0 ? argumentsList[index + 1] : undefined;
}

async function main() {
  const inputPath = argumentValue(process.argv, "--input");
  const outputPath = argumentValue(process.argv, "--output");
  if (!inputPath || !outputPath) {
    throw new Error("Verwendung: node scripts/build-strunz-public-fact-import-batch.mjs --input <fakten.json> --output <batch.json>");
  }
  const batch = buildStrunzPublicFactImportBatch(await readFile(inputPath, "utf8"));
  await writeFile(outputPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ candidates: batch.batch.candidate_count, source_hash: batch.batch.source_hash }));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
