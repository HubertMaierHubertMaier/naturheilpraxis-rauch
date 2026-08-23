import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildExistingKnowledgeImport,
  renderExistingKnowledgeImportSql,
} from "../scripts/build-existing-knowledge-import.mjs";

test("retains all existing remedy research as separated internal candidates", () => {
  const bundle = buildExistingKnowledgeImport();
  assert.equal(bundle.batches.length, 4);
  assert.equal(bundle.admin_only, true);
  assert.equal(bundle.patient_facing_allowed, false);
  assert.ok(bundle.totals.sources >= 225);
  assert.ok(bundle.totals.entities >= 60);
  assert.ok(bundle.totals.dosages >= 100);
  assert.ok(bundle.totals.safety >= 90);

  for (const batch of bundle.batches) {
    const candidates = [
      ...batch.source_candidates,
      ...batch.entity_candidates,
      ...batch.dosage_candidates,
      ...batch.safety_candidates,
    ];
    assert.equal(candidates.length, batch.batch.candidate_count);
    assert.match(batch.batch.source_hash, /^[a-f0-9]{64}$/);
    assert.ok(candidates.every((candidate) => candidate.candidate_status === "imported_unreviewed"));
    assert.ok(candidates.every((candidate) => candidate.proposed_data.patient_facing_allowed === false));
  }
});

test("retains every consolidated research artifact losslessly", () => {
  const bundle = buildExistingKnowledgeImport();
  const consolidated = bundle.batches.find((batch) => batch.batch.metadata.retention_mode);
  assert.ok(consolidated);
  assert.equal(consolidated.batch.metadata.artifact_files, 58);
  assert.equal(consolidated.source_candidates.length, 58);
  assert.ok(consolidated.dosage_candidates.length > 0);
  assert.ok(consolidated.safety_candidates.length > 0);
  const snapshot = JSON.parse(readFileSync(resolve("docs/consolidated-research-artifacts-2026-08-12.json"), "utf8"));
  const snapshotText = new Map(snapshot.artifacts.map((artifact) => [artifact.file, artifact.raw_text]));
  for (const candidate of consolidated.source_candidates) {
    assert.equal(candidate.original_excerpt, snapshotText.get(candidate.proposed_data.artifact_file));
  }
  const retainedFiles = consolidated.source_candidates.map((candidate) => candidate.proposed_data.artifact_file).join("\n");
  for (const topic of ["MAGNESIUM", "FOLAT", "EISEN-FERRITIN", "ZINK", "SELEN", "VITAMIN-A", "VITAMIN-B2", "VITAMIN-B12", "VITAMIN-D", "VITAMIN-E", "COENZYM-Q10", "OMEGA3", "MANNAYAN"]) {
    assert.match(retainedFiles, new RegExp(topic));
  }
});

test("renders an internal-only migration without release promotion", () => {
  const sql = renderExistingKnowledgeImportSql(buildExistingKnowledgeImport());
  assert.match(sql, /kb_source_candidates/);
  assert.match(sql, /kb_entity_candidates/);
  assert.match(sql, /kb_dosage_candidates/);
  assert.match(sql, /kb_safety_candidates/);
  assert.match(sql, /ready_for_review/);
  assert.doesNotMatch(sql, /accepted_as_draft/);
  assert.doesNotMatch(sql, /review_status\s*=\s*'released'/);
});
