import { describe, expect, it } from "vitest";
import {
  type WikiSnapshotShape,
  validateWikiSnapshotShape,
} from "../../supabase/functions/_shared/wikiSnapshotValidation";

const expectedTables = ["kb_alpha", "kb_beta"] as const;
const validationKeys = ["invalid_alpha", "invalid_beta"] as const;

function validSnapshot(): WikiSnapshotShape {
  return {
    tables: {
      kb_alpha: [{ id: 1 }],
      kb_beta: [],
    },
    manifest: {
      kb_alpha: { rows: 1, sha256: "a".repeat(64) },
      kb_beta: { rows: 0, sha256: "b".repeat(64) },
    },
    validation: {
      invalid_alpha: 0,
      invalid_beta: 0,
    },
  };
}

describe("Wiki snapshot validation", () => {
  it("accepts an exact snapshot contract", () => {
    expect(() => validateWikiSnapshotShape(
      validSnapshot(),
      expectedTables,
      validationKeys,
    )).not.toThrow();
  });

  it.each([
    ["missing table", (snapshot: WikiSnapshotShape) => delete snapshot.tables.kb_beta],
    ["extra table", (snapshot: WikiSnapshotShape) => { snapshot.tables.kb_extra = []; }],
    ["missing manifest", (snapshot: WikiSnapshotShape) => delete snapshot.manifest.kb_beta],
    ["extra manifest", (snapshot: WikiSnapshotShape) => {
      snapshot.manifest.kb_extra = { rows: 0, sha256: "c".repeat(64) };
    }],
  ])("rejects an exact-key violation: %s", (_label, mutate) => {
    const snapshot = validSnapshot();
    mutate(snapshot);
    expect(() => validateWikiSnapshotShape(snapshot, expectedTables, validationKeys))
      .toThrow(/unerwartete oder fehlende Tabellen/);
  });

  it("rejects row-count and hash mismatches", () => {
    const wrongRows = validSnapshot();
    wrongRows.manifest.kb_alpha.rows = 2;
    expect(() => validateWikiSnapshotShape(wrongRows, expectedTables, validationKeys))
      .toThrow(/Manifest ist fuer kb_alpha ungueltig/);

    const wrongHash = validSnapshot();
    wrongHash.manifest.kb_beta.sha256 = "not-a-hash";
    expect(() => validateWikiSnapshotShape(wrongHash, expectedTables, validationKeys))
      .toThrow(/Manifest ist fuer kb_beta ungueltig/);
  });

  it("rejects nonzero, missing, and nonnumeric validation counters", () => {
    for (const value of [1, undefined, "0", Number.NaN]) {
      const snapshot = validSnapshot();
      snapshot.validation.invalid_beta = value;
      expect(() => validateWikiSnapshotShape(snapshot, expectedTables, validationKeys))
        .toThrow(/inkonsistent: invalid_beta/);
    }
  });
});
