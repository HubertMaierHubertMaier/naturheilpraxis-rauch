import assert from "node:assert/strict";
import test from "node:test";

import { buildKlinghardtImportBatch } from "../scripts/build-klinghardt-import-batch.mjs";

test("builds unpublished Klinghardt source candidates with complete provenance", () => {
  const sourceText = JSON.stringify([{
    candidate_id: "klinghardt-talks-001-025-example",
    title: "Klinghardt-Quellenkarte: Beispiel",
    aliases: ["Beispiel"],
    content: "Sprecher, Mittel, Videodosis, Evidenz und Sicherheit bleiben getrennt.",
    rights_status: "unknown",
    source_locator: "Folge 001 00:10-00:20 E001-001",
    source_citations: [{ label: "Praxisnavigator SHA-256 test" }],
    tags: ["Klinghardt-Talks"],
    therapeutic_topics: ["Ausleitung"],
    dosage_status: "unverified",
    evidence_level: "unrated",
    safety_notes: "Keine Praxisfreigabe.",
    source_file: "external/klinghardt-talks/001-025/praxisnavigator",
  }]);

  const batch = buildKlinghardtImportBatch(sourceText);

  assert.equal(batch.batch.source_kind, "json");
  assert.match(batch.batch.source_hash, /^[0-9a-f]{64}$/);
  assert.equal(batch.batch.batch_status, "created");
  assert.equal(batch.batch.candidate_count, 1);
  assert.equal(batch.source_candidates.length, 1);
  assert.deepEqual(batch.source_candidates[0], {
    candidate_key: "source:klinghardt-talks-001-025-example",
    candidate_status: "imported_unreviewed",
    proposed_source_type: "reference_work",
    title: "Klinghardt-Quellenkarte: Beispiel",
    publisher: "Klinghardt Talks 001-025",
    publication_date: null,
    source_url: "",
    external_identifier: "klinghardt-talks-001-025-example",
    rights_status: "unknown",
    source_locator: "Folge 001 00:10-00:20 E001-001",
    original_excerpt: "Sprecher, Mittel, Videodosis, Evidenz und Sicherheit bleiben getrennt.",
    confidence: 100,
    ambiguity_notes: "Die Karte ist quellengeprueft; ihre Sprecherempfehlung, Videodosis, Evidenz- und Sicherheitsabschnitte bleiben getrennt und unveroeffentlicht.",
    proposed_data: {
      card_type: "klinghardt_talks_source_card",
      candidate_id: "klinghardt-talks-001-025-example",
      aliases: ["Beispiel"],
      tags: ["Klinghardt-Talks"],
      therapeutic_topics: ["Ausleitung"],
      dosage_status: "unverified",
      evidence_level: "unrated",
      safety_notes: "Keine Praxisfreigabe.",
      source_citations: [{ label: "Praxisnavigator SHA-256 test" }],
      source_file: "external/klinghardt-talks/001-025/praxisnavigator",
      content: "Sprecher, Mittel, Videodosis, Evidenz und Sicherheit bleiben getrennt.",
    },
  });
});

test("rejects incomplete Klinghardt source cards", () => {
  assert.throws(
    () => buildKlinghardtImportBatch(JSON.stringify([{ candidate_id: "missing-fields" }])),
    /title fehlt/,
  );
});
