import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const parserName = "build-klinghardt-import-batch";
const parserVersion = "1.0.0";

function requiredString(value, field, candidateId) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Klinghardt-Kandidat ${candidateId}: ${field} fehlt.`);
  }
  return value.trim();
}

export function buildKlinghardtImportBatch(sourceText) {
  const sourceHash = createHash("sha256").update(sourceText).digest("hex");
  const candidates = JSON.parse(sourceText);
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Die Klinghardt-Quellenkarten müssen als nicht leeres JSON-Array vorliegen.");
  }

  const seenKeys = new Set();
  const sourceCandidates = candidates.map((candidate) => {
    const candidateId = requiredString(candidate.candidate_id, "candidate_id", "unbekannt");
    const candidateKey = `source:${candidateId}`;
    if (seenKeys.has(candidateKey)) {
      throw new Error(`Doppelter Klinghardt-Kandidat: ${candidateId}`);
    }
    seenKeys.add(candidateKey);

    const title = requiredString(candidate.title, "title", candidateId);
    const sourceLocator = requiredString(candidate.source_locator, "source_locator", candidateId);
    const content = requiredString(candidate.content, "content", candidateId);
    const sourceCitations = Array.isArray(candidate.source_citations)
      ? candidate.source_citations
      : [];
    if (sourceCitations.length === 0) {
      throw new Error(`Klinghardt-Kandidat ${candidateId}: source_citations fehlt.`);
    }

    return {
      candidate_key: candidateKey,
      candidate_status: "imported_unreviewed",
      proposed_source_type: "reference_work",
      title,
      publisher: "Klinghardt Talks 001-025",
      publication_date: null,
      source_url: "",
      external_identifier: candidateId,
      rights_status: candidate.rights_status || "unknown",
      source_locator: sourceLocator,
      original_excerpt: content,
      confidence: 100,
      ambiguity_notes: "Die Karte ist quellengeprueft; ihre Sprecherempfehlung, Videodosis, Evidenz- und Sicherheitsabschnitte bleiben getrennt und unveroeffentlicht.",
      proposed_data: {
        card_type: "klinghardt_talks_source_card",
        candidate_id: candidateId,
        aliases: candidate.aliases || [],
        tags: candidate.tags || [],
        therapeutic_topics: candidate.therapeutic_topics || [],
        dosage_status: candidate.dosage_status || "unverified",
        evidence_level: candidate.evidence_level || "unrated",
        safety_notes: candidate.safety_notes || "",
        source_citations: sourceCitations,
        source_file: candidate.source_file || "",
        content,
      },
    };
  });

  return {
    schema_version: 1,
    batch: {
      source_kind: "json",
      source_label: "Klinghardt Talks 001-025 Praxisnavigator: geprüfte Quellenkarten",
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
        card_type: "klinghardt_talks_source_card",
        source_cards: sourceCandidates.length,
        import_scope: "001-025",
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
    throw new Error("Verwendung: node scripts/build-klinghardt-import-batch.mjs --input <karten.json> --output <batch.json>");
  }
  const batch = buildKlinghardtImportBatch(await readFile(inputPath, "utf8"));
  await writeFile(outputPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ candidates: batch.batch.candidate_count, source_hash: batch.batch.source_hash }));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
