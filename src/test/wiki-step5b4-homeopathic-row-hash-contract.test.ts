// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  hashHomeopathicAssignmentPayload,
  hashHomeopathicGradeDefinitionPayload,
  hashHomeopathicRepertoryRemedyPayload,
  hashHomeopathicRepertoryRevisionPayload,
  hashHomeopathicRubricRevisionPayload,
  type HomeopathicAssignmentPayload,
  type HomeopathicGradeDefinitionPayload,
  type HomeopathicRepertoryRemedyPayload,
  type HomeopathicRepertoryRevisionPayload,
  type HomeopathicRubricRevisionPayload,
} from "@/lib/homeopathicImportRowHashes";

const hash = (value: string) => value.repeat(64);
const repertoryEntityId = "10000000-0000-4000-8000-000000000001";
const repertoryRevisionId = "11000000-0000-4000-8000-000000000001";
const sourceId = "20000000-0000-4000-8000-000000000001";
const sourceRevisionId = "21000000-0000-4000-8000-000000000001";
const rubricId = "30000000-0000-4000-8000-000000000001";
const rubricRevisionId = "31000000-0000-4000-8000-000000000001";
const gradeDefinitionId = "40000000-0000-4000-8000-000000000001";
const repertoryRemedyId = "50000000-0000-4000-8000-000000000001";
const remedyEntityId = "51000000-0000-4000-8000-000000000001";
const remedyRevisionId = "52000000-0000-4000-8000-000000000001";
const assignmentId = "60000000-0000-4000-8000-000000000001";

const repertoryPayload: HomeopathicRepertoryRevisionPayload = {
  repertory_schema_version: 1,
  entity: {
    entity_id: repertoryEntityId,
    entity_revision_id: repertoryRevisionId,
    entity_type_code: "homeopathic_repertory",
    canonical_key: "homeopathic-repertory:synthetic-row-hash",
  },
  revision: {
    revision_no: 1,
    display_name: "Synthetic row-hash repertory",
    summary: "Synthetic fixture.",
    description_markdown: "Non-medical fixture.",
    origin_type: "human",
    metadata_hash: hash("a"),
  },
  source: {
    source_id: sourceId,
    source_revision_id: sourceRevisionId,
    canonical_key: "source:synthetic-row-hash",
    revision_no: 1,
    source_type: "database",
    title: "Synthetic row-hash source",
    authors: ["Synthetic Author"],
    publisher: null,
    edition: null,
    published_on: null,
    url: null,
    doi: null,
    pmid: null,
    isbn: null,
    retrieved_on: null,
    file_sha256: null,
    rights_status: "licensed",
    archive_location: null,
    content_hash: hash("b"),
    metadata_hash: hash("c"),
  },
  source_binding: {
    source_id: sourceId,
    source_revision_id: sourceRevisionId,
    source_repertory_code: "SYN-ROW-HASH-1",
    source_language_code: "de",
    source_locator: "catalog:synthetic-row-hash:edition-1",
  },
};

async function buildFixture() {
  const repertory = await hashHomeopathicRepertoryRevisionPayload(repertoryPayload);
  const repertoryLink = {
    payload: repertory.payload,
    content_hash: repertory.contentHash,
  };
  const rubricPayload: HomeopathicRubricRevisionPayload = {
    rubric_schema_version: 1,
    repertory_entity_id: repertoryEntityId,
    repertory_revision_id: repertoryRevisionId,
    repertory: repertoryLink,
    rubric_id: rubricId,
    native_rubric_code: "ROOT",
    parent_rubric_id: null,
    parent_native_rubric_code: null,
    parent_rubric_content_hash: null,
    rubric_text: "Synthetic root",
    rubric_domain: "general",
    sibling_order: 1,
    source_locator: "rubric:root",
  };
  const rubric = await hashHomeopathicRubricRevisionPayload(rubricPayload);
  const gradePayload: HomeopathicGradeDefinitionPayload = {
    grade_schema_version: 1,
    repertory_entity_id: repertoryEntityId,
    repertory_revision_id: repertoryRevisionId,
    repertory: repertoryLink,
    grade_definition_id: gradeDefinitionId,
    source_grade_code: "G-A",
    source_grade_label: "Synthetic grade A",
    grade_order: 1,
    source_locator: "grade:a",
  };
  const grade = await hashHomeopathicGradeDefinitionPayload(gradePayload);
  const remedyPayload: HomeopathicRepertoryRemedyPayload = {
    remedy_schema_version: 1,
    repertory_entity_id: repertoryEntityId,
    repertory_revision_id: repertoryRevisionId,
    repertory: repertoryLink,
    repertory_remedy_id: repertoryRemedyId,
    source_remedy_code: "R-A",
    source_remedy_name: "Synthetic remedy A",
    source_remedy_aliases: ["Synthetic alias A"],
    source_locator: "remedy:r-a",
    remedy_entity_revision: {
      entity_id: remedyEntityId,
      entity_revision_id: remedyRevisionId,
      entity_type_code: "homeopathic_remedy",
      canonical_key: "homeopathic-remedy:synthetic-row-hash",
      revision_no: 1,
      display_name: "Synthetic remedy A",
      summary: "",
      description_markdown: "",
      origin_type: "human",
      content_hash: hash("d"),
      metadata_hash: hash("e"),
    },
  };
  const remedy = await hashHomeopathicRepertoryRemedyPayload(remedyPayload);
  const assignmentPayload: HomeopathicAssignmentPayload = {
    assignment_schema_version: 1,
    repertory_entity_id: repertoryEntityId,
    repertory_revision_id: repertoryRevisionId,
    repertory: repertoryLink,
    assignment_id: assignmentId,
    rubric: { payload: rubric.payload, content_hash: rubric.contentHash },
    remedy: { payload: remedy.payload, content_hash: remedy.contentHash },
    grade: { payload: grade.payload, content_hash: grade.contentHash },
    source_locator: "assignment:root:r-a",
  };
  const assignment = await hashHomeopathicAssignmentPayload(assignmentPayload);
  return { repertory, rubric, grade, remedy, assignment };
}

describe("Wiki Step 5B-4 parser-side homeopathic row hash contract", () => {
  it("builds all five nested row hashes without mutating normalized payloads", async () => {
    const original = structuredClone(repertoryPayload);
    const fixture = await buildFixture();

    expect(repertoryPayload).toEqual(original);
    expect([
      fixture.repertory.contentHash,
      fixture.rubric.contentHash,
      fixture.grade.contentHash,
      fixture.remedy.contentHash,
      fixture.assignment.contentHash,
    ].every((value) => /^[0-9a-f]{64}$/.test(value))).toBe(true);
    expect(new Set([
      fixture.repertory.contentHash,
      fixture.rubric.contentHash,
      fixture.grade.contentHash,
      fixture.remedy.contentHash,
      fixture.assignment.contentHash,
    ])).toHaveLength(5);
  });

  it("propagates a nested row change into the assignment hash", async () => {
    const fixture = await buildFixture();
    const changedRubric = await hashHomeopathicRubricRevisionPayload({
      ...fixture.rubric.payload,
      rubric_text: "Changed synthetic root",
    });
    const changedAssignment = await hashHomeopathicAssignmentPayload({
      ...fixture.assignment.payload,
      rubric: {
        payload: changedRubric.payload,
        content_hash: changedRubric.contentHash,
      },
    });

    expect(changedRubric.contentHash).not.toBe(fixture.rubric.contentHash);
    expect(changedAssignment.contentHash).not.toBe(fixture.assignment.contentHash);
  });

  it("rejects mismatched nested bindings, hashes, parents, and origins", async () => {
    const fixture = await buildFixture();
    await expect(hashHomeopathicRepertoryRevisionPayload({
      ...repertoryPayload,
      source_binding: {
        ...repertoryPayload.source_binding,
        source_id: "20000000-0000-4000-8000-000000000099",
      },
    })).rejects.toThrow("HOMEOPATHIC_IMPORT_ROW_SOURCE_BINDING_MISMATCH");
    await expect(hashHomeopathicRubricRevisionPayload({
      ...fixture.rubric.payload,
      parent_rubric_id: "30000000-0000-4000-8000-000000000099",
    })).rejects.toThrow("HOMEOPATHIC_IMPORT_ROW_PARENT_BINDING_INCOMPLETE");
    await expect(hashHomeopathicGradeDefinitionPayload({
      ...fixture.grade.payload,
      repertory: {
        ...fixture.grade.payload.repertory,
        content_hash: hash("f"),
      },
    })).rejects.toThrow("HOMEOPATHIC_IMPORT_ROW_REPERTORY_HASH_MISMATCH");
    await expect(hashHomeopathicRepertoryRemedyPayload({
      ...fixture.remedy.payload,
      remedy_entity_revision: {
        ...fixture.remedy.payload.remedy_entity_revision,
        origin_type: "parser",
      },
    })).rejects.toThrow();
    await expect(hashHomeopathicRepertoryRemedyPayload({
      ...fixture.remedy.payload,
      source_remedy_aliases: ["Synthetic alias B", "Synthetic alias A"],
    })).rejects.toThrow("HOMEOPATHIC_IMPORT_ROW_ALIAS_ARRAY_NOT_CANONICAL");
    await expect(hashHomeopathicAssignmentPayload({
      ...fixture.assignment.payload,
      rubric: {
        ...fixture.assignment.payload.rubric,
        content_hash: hash("f"),
      },
    })).rejects.toThrow("HOMEOPATHIC_IMPORT_ROW_RUBRIC_HASH_MISMATCH");
  });
});
