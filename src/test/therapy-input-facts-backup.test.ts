// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  THERAPY_INPUT_BACKUP_TABLES,
  validateTherapyInputSubsetPayload,
} from "@/lib/therapyInputBackup";
import { validateTherapyInputSnapshotV3 } from "../../supabase/functions/_shared/therapyInputSnapshotValidation";

type Payload = Parameters<typeof validateTherapyInputSubsetPayload>[0];

const backupAreasSource = readFileSync(
  resolve(process.cwd(), "src/lib/backupAreas.ts"),
  "utf8",
);
const backupExportSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/backup-export/index.ts"),
  "utf8",
);
const backupCenterSource = readFileSync(
  resolve(process.cwd(), "src/components/admin/BackupCenter.tsx"),
  "utf8",
);

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function createValidPayload(): Promise<Payload> {
  const serialized = {
    therapy_input_revisions: '[{"exact":9007199254740993}]',
    therapy_input_sources: "[]",
    therapy_input_facts: '[{"fact_value":{"type":"quantity","value":9007199254740993}}]',
    therapy_input_fact_sources: "[]",
    therapy_retrieval_audit_runs: '[{"audit_result_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]',
  } as const;
  const manifest = Object.fromEntries(await Promise.all(
    THERAPY_INPUT_BACKUP_TABLES.map(async (table) => [table, {
      rows: JSON.parse(serialized[table]).length,
      sha256: await sha256(serialized[table]),
    }]),
  ));
  return {
    therapyInputSnapshotVersion: 3,
    therapyInputSnapshotManifest: manifest,
    therapyInputValidation: {
      invalid_revision_count: 0,
      invalid_fact_count: 0,
      invalid_audit_run_count: 0,
    },
    tables: {
      iaa_submissions: { rows: [], rowCount: 0 },
      ...Object.fromEntries(THERAPY_INPUT_BACKUP_TABLES.map((table) => [table, {
        serializedRows: serialized[table],
        rowCount: JSON.parse(serialized[table]).length,
      }])),
    },
  };
}

function clonePayload(payload: Payload): Payload {
  return JSON.parse(JSON.stringify(payload)) as Payload;
}

async function createValidRawSnapshot(): Promise<Record<string, unknown>> {
  const payload = await createValidPayload();
  return {
    snapshot_version: payload.therapyInputSnapshotVersion,
    tables: Object.fromEntries(THERAPY_INPUT_BACKUP_TABLES.map((table) => [
      table,
      payload.tables?.[table].serializedRows,
    ])),
    manifest: payload.therapyInputSnapshotManifest,
    validation: payload.therapyInputValidation,
  };
}

describe("protected therapy snapshot v3 backup", () => {
  it("accepts the exact five-table lossless payload without reserializing large integers", async () => {
    const payload = await createValidPayload();
    await expect(validateTherapyInputSubsetPayload(payload)).resolves.toBeUndefined();
    expect(payload.tables?.therapy_input_revisions.serializedRows)
      .toContain("9007199254740993");

    const zip = new JSZip();
    for (const table of THERAPY_INPUT_BACKUP_TABLES) {
      zip.file(`db/${table}.json`, payload.tables?.[table].serializedRows ?? "");
    }
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const restoredZip = await JSZip.loadAsync(bytes);
    for (const table of THERAPY_INPUT_BACKUP_TABLES) {
      expect(await restoredZip.file(`db/${table}.json`)?.async("string"))
        .toBe(payload.tables?.[table].serializedRows);
    }
  });

  it("runs the edge snapshot validator against versions, boundaries, counters, and bytes", async () => {
    const valid = await createValidRawSnapshot();
    await expect(validateTherapyInputSnapshotV3(valid, THERAPY_INPUT_BACKUP_TABLES))
      .resolves.toBeUndefined();

    const historical = structuredClone(valid);
    historical.snapshot_version = 1;
    await expect(validateTherapyInputSnapshotV3(historical, THERAPY_INPUT_BACKUP_TABLES))
      .rejects.toThrow(/Snapshot-Version/);

    const invalidCounter = structuredClone(valid);
    (invalidCounter.validation as Record<string, unknown>).invalid_fact_count = 1;
    await expect(validateTherapyInputSnapshotV3(invalidCounter, THERAPY_INPUT_BACKUP_TABLES))
      .rejects.toThrow(/Integritaetspruefung/);

    const missingTable = structuredClone(valid);
    delete (missingTable.tables as Record<string, unknown>).therapy_input_facts;
    await expect(validateTherapyInputSnapshotV3(missingTable, THERAPY_INPUT_BACKUP_TABLES))
      .rejects.toThrow(/Tabellengrenze/);

    const tampered = structuredClone(valid);
    (tampered.tables as Record<string, unknown>).therapy_input_facts = "[] ";
    await expect(validateTherapyInputSnapshotV3(tampered, THERAPY_INPUT_BACKUP_TABLES))
      .rejects.toThrow(/Manifestfehler/);
  });

  it("rejects absent, historical, string, and future snapshot versions", async () => {
    for (const version of [undefined, null, 1, 2, "3", 4]) {
      const payload = await createValidPayload();
      payload.therapyInputSnapshotVersion = version as number | null | undefined;
      await expect(validateTherapyInputSubsetPayload(payload))
        .rejects.toThrow(/Snapshot-Version/);
    }
  });

  it("requires the exact three zero validation counters", async () => {
    for (const validation of [
      null,
      { invalid_revision_count: 1, invalid_fact_count: 0 },
      { invalid_revision_count: 0, invalid_fact_count: 1 },
      { invalid_revision_count: 0, invalid_fact_count: 0 },
      { invalid_revision_count: 0, invalid_fact_count: 0, invalid_audit_run_count: 1 },
      {
        invalid_revision_count: 0,
        invalid_fact_count: 0,
        invalid_audit_run_count: 0,
        unexpected: 0,
      },
    ]) {
      const payload = await createValidPayload();
      payload.therapyInputValidation = validation as Payload["therapyInputValidation"];
      await expect(validateTherapyInputSubsetPayload(payload))
        .rejects.toThrow(/Integritaetspruefung/);
    }
  });

  it("rejects missing, extra, and unknown therapy table boundaries", async () => {
    const missing = await createValidPayload();
    delete missing.therapyInputSnapshotManifest?.therapy_input_facts;
    await expect(validateTherapyInputSubsetPayload(missing))
      .rejects.toThrow(/Snapshot-Manifest/);

    const extraManifest = await createValidPayload();
    Object.assign(extraManifest.therapyInputSnapshotManifest ?? {}, {
      therapy_input_unexpected: { rows: 0, sha256: "0".repeat(64) },
    });
    await expect(validateTherapyInputSubsetPayload(extraManifest))
      .rejects.toThrow(/Snapshot-Manifest/);

    const extraTable = await createValidPayload();
    extraTable.tables = {
      ...extraTable.tables,
      therapy_input_unexpected: { serializedRows: "[]", rowCount: 0 },
    };
    await expect(validateTherapyInputSubsetPayload(extraTable))
      .rejects.toThrow(/unbekannte Therapie-Eingabetabelle/);
  });

  it("rejects invalid JSON, non-array roots, negative or mismatched counts, and byte tampering", async () => {
    const cases: Payload[] = [];

    const malformed = await createValidPayload();
    malformed.tables!.therapy_input_facts.serializedRows = "[";
    cases.push(malformed);

    const objectRoot = await createValidPayload();
    objectRoot.tables!.therapy_input_facts.serializedRows = "{}";
    cases.push(objectRoot);

    const negative = await createValidPayload();
    negative.tables!.therapy_input_facts.rowCount = -1;
    cases.push(negative);

    const mismatched = await createValidPayload();
    mismatched.tables!.therapy_input_facts.rowCount = 2;
    mismatched.therapyInputSnapshotManifest!.therapy_input_facts!.rows = 2;
    cases.push(mismatched);

    const tampered = clonePayload(await createValidPayload());
    tampered.tables!.therapy_input_facts.serializedRows += " ";
    cases.push(tampered);

    for (const payload of cases) {
      await expect(validateTherapyInputSubsetPayload(payload))
        .rejects.toThrow(/ungueltiger verlustfreier Export/);
    }
  });

  it("wires all five tables and only snapshot v3 through every current backup surface", () => {
    const frontendArea = backupAreasSource.match(
      /id: "iaa-icd10"[\s\S]*?buckets:/,
    )?.[0] ?? "";
    const fallbackTables = backupExportSource.match(
      /const FALLBACK_TABLES =[\s\S]*?\]\)\]\.sort\(\);/,
    )?.[0] ?? "";
    const edgeArea = backupExportSource.match(
      /"iaa-icd10":[\s\S]*?\},/,
    )?.[0] ?? "";
    const snapshotBoundary = backupExportSource.match(
      /const THERAPY_INPUT_SNAPSHOT_TABLES =[\s\S]*?\] as const;/,
    )?.[0] ?? "";
    const wikiSnapshot = backupExportSource.match(
      /const WIKI_SNAPSHOT_TABLES =[\s\S]*?\] as const;/,
    )?.[0] ?? "";

    for (const table of THERAPY_INPUT_BACKUP_TABLES) {
      expect(frontendArea).toContain(`"${table}"`);
      expect(fallbackTables).toContain(`"${table}"`);
      expect(edgeArea).toContain(`"${table}"`);
      expect(snapshotBoundary).toContain(`"${table}"`);
      expect(wikiSnapshot).not.toContain(`"${table}"`);
    }
    expect(backupExportSource).toContain('client.rpc("therapy_input_export_snapshot_v3")');
    expect(backupExportSource).not.toContain('client.rpc("therapy_input_export_snapshot_v2")');
    expect(backupExportSource).toContain("validateTherapyInputSnapshotV3(");
    expect(backupExportSource).toContain("therapyInputSnapshotVersion");
    expect(backupExportSource).toContain("therapy_input_snapshot_version.json");
    expect(backupCenterSource).toContain("therapy_input_snapshot_version.json");
    expect(backupCenterSource).toContain("therapy_input_export_snapshot_v3()");
    expect(backupCenterSource).toContain("invalid_fact_count = 0");
    expect(backupCenterSource).toContain("invalid_audit_run_count = 0");
    expect(backupCenterSource).toContain("kein tabellenweiser Autocommit-Restore");
    expect(backupCenterSource).toContain(
      "`therapy_input_facts` und `therapy_retrieval_audit_runs` bleiben unangetastet",
    );
    expect(backupExportSource).toContain(
      "`therapy_input_facts` und `therapy_retrieval_audit_runs` bleiben unangetastet",
    );
    expect(backupCenterSource).toContain("zip.file(`db/${name}.json`, t.serializedRows)");
    expect(backupCenterSource).toContain("Die Wiki-Tabellen duerfen jedoch weder durch Lovable");
    expect(backupCenterSource).toContain("ausschließlich als verlustfreie JSON-Dateien");

    const dbMode = backupExportSource.slice(backupExportSource.indexOf("const tableNamesForDb"));
    const therapySnapshotIndex = dbMode.indexOf(
      "therapyInputSnapshot = await fetchTherapyInputSnapshot(adminClient)",
    );
    const wikiSnapshotIndex = dbMode.indexOf(
      "wikiSnapshot = await fetchWikiSnapshot(adminClient)",
    );
    expect(therapySnapshotIndex).toBeGreaterThanOrEqual(0);
    expect(wikiSnapshotIndex).toBeGreaterThan(therapySnapshotIndex);
  });
});
