import { describe, expect, it } from "vitest";
import {
  type WikiSnapshotShape,
  validateWikiSnapshotShape,
} from "../../supabase/functions/_shared/wikiSnapshotValidation";
import {
  validateWikiSubsetPayload,
  WIKI_ZERO_VALIDATION_KEYS,
  type WikiSubsetPayload,
} from "@/lib/wikiBackup";

const expectedTables = ["kb_alpha", "kb_beta"] as const;
const validationKeys = ["invalid_alpha", "invalid_beta"] as const;

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validSnapshot(): Promise<WikiSnapshotShape> {
  const serializedTables = {
    kb_alpha: JSON.stringify([{ id: 1 }]),
    kb_beta: JSON.stringify([]),
  };
  return {
    tables: {
      kb_alpha: [{ id: 1 }],
      kb_beta: [],
    },
    serializedTables,
    manifest: {
      kb_alpha: { rows: 1, sha256: await sha256Hex(serializedTables.kb_alpha) },
      kb_beta: { rows: 0, sha256: await sha256Hex(serializedTables.kb_beta) },
    },
    validation: {
      invalid_alpha: 0,
      invalid_beta: 0,
    },
  };
}

describe("Wiki snapshot validation", () => {
  it("accepts an exact snapshot contract", async () => {
    await expect(validateWikiSnapshotShape(
      await validSnapshot(),
      expectedTables,
      validationKeys,
    )).resolves.toBeUndefined();
  });

  it.each([
    ["missing table", (snapshot: WikiSnapshotShape) => delete snapshot.tables.kb_beta],
    ["extra table", (snapshot: WikiSnapshotShape) => { snapshot.tables.kb_extra = []; }],
    ["missing serialization", (snapshot: WikiSnapshotShape) => {
      delete snapshot.serializedTables.kb_beta;
    }],
    ["extra serialization", (snapshot: WikiSnapshotShape) => {
      snapshot.serializedTables.kb_extra = "[]";
    }],
    ["missing manifest", (snapshot: WikiSnapshotShape) => delete snapshot.manifest.kb_beta],
    ["extra manifest", (snapshot: WikiSnapshotShape) => {
      snapshot.manifest.kb_extra = { rows: 0, sha256: "c".repeat(64) };
    }],
  ])("rejects an exact-key violation: %s", async (_label, mutate) => {
    const snapshot = await validSnapshot();
    mutate(snapshot);
    await expect(validateWikiSnapshotShape(snapshot, expectedTables, validationKeys))
      .rejects.toThrow(/unerwartete oder fehlende Tabellen/);
  });

  it("rejects row-count and hash mismatches", async () => {
    const wrongRows = await validSnapshot();
    wrongRows.manifest.kb_alpha.rows = 2;
    await expect(validateWikiSnapshotShape(wrongRows, expectedTables, validationKeys))
      .rejects.toThrow(/Manifest ist fuer kb_alpha ungueltig/);

    const wrongHash = await validSnapshot();
    wrongHash.manifest.kb_beta.sha256 = "a".repeat(64);
    await expect(validateWikiSnapshotShape(wrongHash, expectedTables, validationKeys))
      .rejects.toThrow(/Manifest ist fuer kb_beta ungueltig/);
  });

  it("rejects nonzero, missing, and nonnumeric validation counters", async () => {
    for (const value of [1, undefined, "0", Number.NaN]) {
      const snapshot = await validSnapshot();
      snapshot.validation.invalid_beta = value;
      await expect(validateWikiSnapshotShape(snapshot, expectedTables, validationKeys))
        .rejects.toThrow(/inkonsistent: invalid_beta/);
    }
  });
});

async function validSubsetPayload(): Promise<WikiSubsetPayload> {
  const alphaRows = JSON.stringify([{ id: 1 }]);
  const betaRows = JSON.stringify([]);
  return {
    area: "wiki",
    tables: {
      kb_alpha: { serializedRows: alphaRows, rowCount: 1 },
      kb_beta: { serializedRows: betaRows, rowCount: 0 },
    },
    storage: {},
    wikiSnapshotManifest: {
      kb_alpha: { rows: 1, sha256: await sha256Hex(alphaRows) },
      kb_beta: { rows: 0, sha256: await sha256Hex(betaRows) },
    },
    legacyBridgeValidation: Object.fromEntries(
      WIKI_ZERO_VALIDATION_KEYS.map((key) => [key, 0]),
    ),
  };
}

describe("Wiki subset browser validation", () => {
  it("accepts exact serialized rows, manifests, row counts, and zero counters", async () => {
    await expect(validateWikiSubsetPayload(await validSubsetPayload(), expectedTables))
      .resolves.toBeUndefined();
  });

  it.each([
    ["wrong area", (payload: WikiSubsetPayload) => { payload.area = "iaa-icd10"; }],
    ["missing table", (payload: WikiSubsetPayload) => { delete payload.tables.kb_beta; }],
    ["extra table", (payload: WikiSubsetPayload) => {
      payload.tables.kb_extra = { serializedRows: "[]", rowCount: 0 };
    }],
    ["missing manifest", (payload: WikiSubsetPayload) => {
      delete payload.wikiSnapshotManifest?.kb_beta;
    }],
    ["wrong row count", (payload: WikiSubsetPayload) => {
      payload.tables.kb_alpha.rowCount = 2;
    }],
    ["parsed wiki rows", (payload: WikiSubsetPayload) => {
      payload.tables.kb_alpha.rows = [{ id: 1 }];
    }],
    ["table error", (payload: WikiSubsetPayload) => {
      payload.tables.kb_alpha.error = "synthetic failure";
    }],
    ["unexpected storage", (payload: WikiSubsetPayload) => {
      payload.storage.foreign = [{
        path: "unexpected.bin",
        size: 1,
        signedUrl: "https://example.invalid/unexpected.bin",
      }];
    }],
    ["non-object storage", (payload: WikiSubsetPayload) => {
      (payload as unknown as { storage: unknown }).storage = true;
    }],
  ])("rejects malformed HTTP-200 payloads: %s", async (_label, mutate) => {
    const payload = await validSubsetPayload();
    mutate(payload);
    await expect(validateWikiSubsetPayload(payload, expectedTables)).rejects.toThrow();
  });

  it("rejects changed rows even when row count and hash format still match", async () => {
    const payload = await validSubsetPayload();
    payload.tables.kb_alpha.serializedRows = JSON.stringify([{ id: 2 }]);
    await expect(validateWikiSubsetPayload(payload, expectedTables))
      .rejects.toThrow(/Manifest ist fuer kb_alpha ungueltig/);
  });

  it.each([1, undefined, "0", Number.NaN])(
    "rejects invalid_knowledge_releases=%s",
    async (value) => {
      const payload = await validSubsetPayload();
      if (value === undefined) {
        delete payload.legacyBridgeValidation?.invalid_knowledge_releases;
      } else {
        payload.legacyBridgeValidation!.invalid_knowledge_releases = value;
      }
      await expect(validateWikiSubsetPayload(payload, expectedTables))
        .rejects.toThrow(/invalid_knowledge_releases/);
    },
  );

  it.each([1, undefined, "0", Number.NaN])(
    "rejects invalid_search_documents=%s",
    async (value) => {
      const payload = await validSubsetPayload();
      if (value === undefined) {
        delete payload.legacyBridgeValidation?.invalid_search_documents;
      } else {
        payload.legacyBridgeValidation!.invalid_search_documents = value;
      }
      await expect(validateWikiSubsetPayload(payload, expectedTables))
        .rejects.toThrow(/invalid_search_documents/);
    },
  );
});
