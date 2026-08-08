import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { buildStrunzPublicFactImportBatch } from "../scripts/build-strunz-public-fact-import-batch.mjs";

const sourceText = readFileSync(
  resolve(process.cwd(), "docs/strunz-public-product-fact-candidates-2026-08-04.json"),
  "utf8",
);

test("builds unpublished Strunz fact cards for the existing import staging contract", () => {
  const batch = buildStrunzPublicFactImportBatch(sourceText);
  assert.equal(batch.batch.source_kind, "json");
  assert.equal(batch.batch.candidate_count, 9);
  assert.equal(batch.batch.metadata.disease_or_symptom_cards, 0);
  assert.match(batch.batch.source_hash, /^[a-f0-9]{64}$/);
  assert.equal(batch.source_candidates.length, 9);

  for (const candidate of batch.source_candidates) {
    assert.equal(candidate.candidate_status, "imported_unreviewed");
    assert.equal(candidate.proposed_source_type, "website");
    assert.equal(candidate.rights_status, "unknown");
    assert.match(candidate.source_url, /^https:\/\/www\.strunz\.com\//);
    assert.match(candidate.original_excerpt, /patient-facing content/);
    assert.equal(candidate.proposed_data.dosage_status, "unverified");
    assert.equal(candidate.proposed_data.evidence_level, "unrated");
    assert.match(candidate.proposed_data.safety_notes, /keine Patientenfreigabe/);
  }
});

test("rejects condition cards and cards without factual nutrient declarations", () => {
  const conditionCards = JSON.parse(sourceText);
  conditionCards.coverage.condition_or_symptom_cards = 1;
  assert.throws(
    () => buildStrunzPublicFactImportBatch(JSON.stringify(conditionCards)),
    /keine Krankheits- oder Symptomkarten/,
  );

  const missingNutrients = JSON.parse(sourceText);
  missingNutrients.source_cards[0].nutrients = [];
  assert.throws(
    () => buildStrunzPublicFactImportBatch(JSON.stringify(missingNutrients)),
    /nutrients fehlt/,
  );
});
