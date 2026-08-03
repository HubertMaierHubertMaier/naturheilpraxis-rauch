// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildHomeopathicImportBundleContract,
  type HomeopathicImportBundleInput,
} from "@/lib/homeopathicImportBundle";

const hash = (value: string) => value.repeat(64);

const baseInput: HomeopathicImportBundleInput = {
  contract_version: 1,
  contract_scope: "HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY",
  data_classification: "general_knowledge",
  repertory: {
    repertory_entity_id: "10000000-0000-4000-8000-000000000001",
    repertory_revision_id: "11000000-0000-4000-8000-000000000001",
    repertory_content_hash: hash("1"),
    source_id: "20000000-0000-4000-8000-000000000001",
    source_revision_id: "21000000-0000-4000-8000-000000000001",
    source_content_hash: hash("2"),
    source_rights_status: "licensed",
    source_repertory_code: "SYN-PARSER-1",
    source_language_code: "de",
    source_locator: "catalog:synthetic-parser:edition-1",
  },
  rubrics: [
    {
      rubric_id: "30000000-0000-4000-8000-000000000002",
      rubric_revision_id: "31000000-0000-4000-8000-000000000002",
      rubric_content_hash: hash("4"),
    },
    {
      rubric_id: "30000000-0000-4000-8000-000000000001",
      rubric_revision_id: "31000000-0000-4000-8000-000000000001",
      rubric_content_hash: hash("3"),
    },
  ],
  grade_definitions: [{
    grade_definition_id: "40000000-0000-4000-8000-000000000001",
    grade_content_hash: hash("5"),
  }],
  remedies: [
    {
      repertory_remedy_id: "50000000-0000-4000-8000-000000000002",
      remedy_entity_id: "51000000-0000-4000-8000-000000000002",
      remedy_revision_id: "52000000-0000-4000-8000-000000000002",
      remedy_content_hash: hash("7"),
    },
    {
      repertory_remedy_id: "50000000-0000-4000-8000-000000000001",
      remedy_entity_id: "51000000-0000-4000-8000-000000000001",
      remedy_revision_id: "52000000-0000-4000-8000-000000000001",
      remedy_content_hash: hash("6"),
    },
  ],
  assignments: [{
    assignment_id: "60000000-0000-4000-8000-000000000001",
    rubric_revision_id: "31000000-0000-4000-8000-000000000002",
    repertory_remedy_id: "50000000-0000-4000-8000-000000000001",
    grade_definition_id: "40000000-0000-4000-8000-000000000001",
    assignment_content_hash: hash("8"),
  }],
};

describe("Wiki Step 5B-3 parser-side homeopathic bundle contract", () => {
  it("canonicalizes component order without mutating parser input", async () => {
    const original = structuredClone(baseInput);
    const canonical = await buildHomeopathicImportBundleContract(baseInput);
    const permuted = await buildHomeopathicImportBundleContract({
      ...baseInput,
      rubrics: [...baseInput.rubrics].reverse(),
      remedies: [...baseInput.remedies].reverse(),
    });

    expect(baseInput).toEqual(original);
    expect(permuted).toEqual(canonical);
    expect(canonical.bundleHash).toMatch(/^[0-9a-f]{64}$/);
    expect(canonical.manifest.component_counts).toEqual({
      rubrics: 2,
      grade_definitions: 1,
      remedies: 2,
      assignments: 1,
    });
  });

  it("binds every component row and repertory metadata field", async () => {
    const baseline = await buildHomeopathicImportBundleContract(baseInput);
    const changedRubric = await buildHomeopathicImportBundleContract({
      ...baseInput,
      rubrics: baseInput.rubrics.map((row, index) => index === 0
        ? { ...row, rubric_content_hash: hash("9") }
        : row),
    });
    const changedSource = await buildHomeopathicImportBundleContract({
      ...baseInput,
      repertory: { ...baseInput.repertory, source_locator: "catalog:changed" },
    });

    expect(changedRubric.manifest.component_hashes.rubrics)
      .not.toBe(baseline.manifest.component_hashes.rubrics);
    expect(changedRubric.bundleHash).not.toBe(baseline.bundleHash);
    expect(changedSource.manifest.component_hashes).toEqual(baseline.manifest.component_hashes);
    expect(changedSource.bundleHash).not.toBe(baseline.bundleHash);
  });

  it("rejects malformed envelopes, duplicates, and dangling assignments", async () => {
    await expect(buildHomeopathicImportBundleContract({
      ...baseInput,
      extra: true,
    })).rejects.toThrow();
    await expect(buildHomeopathicImportBundleContract({
      ...baseInput,
      repertory: {
        ...baseInput.repertory,
        source_content_hash: hash("A"),
      },
    })).rejects.toThrow();
    await expect(buildHomeopathicImportBundleContract({
      ...baseInput,
      repertory: {
        ...baseInput.repertory,
        source_locator: `invalid-${String.fromCharCode(0xd800)}`,
      },
    })).rejects.toThrow();
    await expect(buildHomeopathicImportBundleContract({
      ...baseInput,
      rubrics: [baseInput.rubrics[0], baseInput.rubrics[0]],
    })).rejects.toThrow("HOMEOPATHIC_IMPORT_BUNDLE_DUPLICATE_RUBRIC");
    await expect(buildHomeopathicImportBundleContract({
      ...baseInput,
      assignments: [{
        ...baseInput.assignments[0],
        rubric_revision_id: "31000000-0000-4000-8000-000000000099",
      }],
    })).rejects.toThrow("HOMEOPATHIC_IMPORT_BUNDLE_UNKNOWN_RUBRIC_REVISION");
  });
});
