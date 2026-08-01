export type WikiSnapshotShape = {
  tables: Record<string, unknown[]>;
  serializedTables: Record<string, string>;
  manifest: Record<string, { rows: number; sha256: string }>;
  validation: Record<string, unknown>;
};

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Wiki-Snapshot kann ohne Web Crypto nicht validiert werden");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateWikiSnapshotShape(
  snapshot: WikiSnapshotShape | null,
  expectedTableNames: readonly string[],
  zeroValidationKeys: readonly string[],
): Promise<void> {
  if (!snapshot?.tables || !snapshot.serializedTables || !snapshot.manifest || !snapshot.validation) {
    throw new Error("Wiki-Snapshot ist unvollstaendig");
  }

  const expectedTables = [...expectedTableNames].sort();
  const snapshotTables = Object.keys(snapshot.tables).sort();
  const serializedTables = Object.keys(snapshot.serializedTables).sort();
  const manifestTables = Object.keys(snapshot.manifest).sort();
  if (JSON.stringify(snapshotTables) !== JSON.stringify(expectedTables)) {
    throw new Error("Wiki-Snapshot enthaelt unerwartete oder fehlende Tabellen");
  }
  if (JSON.stringify(serializedTables) !== JSON.stringify(expectedTables)) {
    throw new Error("Wiki-Snapshot-Serialisierung enthaelt unerwartete oder fehlende Tabellen");
  }
  if (JSON.stringify(manifestTables) !== JSON.stringify(expectedTables)) {
    throw new Error("Wiki-Snapshot-Manifest enthaelt unerwartete oder fehlende Tabellen");
  }

  for (const table of expectedTables) {
    const rows = snapshot.tables[table];
    const serializedRows = snapshot.serializedTables[table];
    const manifest = snapshot.manifest[table];
    let parsedRows: unknown;
    try {
      parsedRows = JSON.parse(serializedRows);
    } catch {
      throw new Error(`Wiki-Snapshot-Serialisierung ist fuer ${table} ungueltig`);
    }
    if (
      !Array.isArray(rows)
      || !Array.isArray(parsedRows)
      || JSON.stringify(rows) !== JSON.stringify(parsedRows)
    ) {
      throw new Error(`Wiki-Snapshot fehlt die exakte Serialisierung fuer ${table}`);
    }
    if (
      !manifest
      || manifest.rows !== rows.length
      || !/^[0-9a-f]{64}$/.test(manifest.sha256)
      || manifest.sha256 !== await sha256Hex(serializedRows)
    ) {
      throw new Error(`Wiki-Snapshot-Manifest ist fuer ${table} ungueltig`);
    }
  }

  const validationErrors = zeroValidationKeys.filter((key) => {
    const value = snapshot.validation[key];
    return typeof value !== "number" || !Number.isFinite(value) || value !== 0;
  });
  if (validationErrors.length) {
    throw new Error(`Wiki-Snapshot inkonsistent: ${validationErrors.join(", ")}`);
  }
}
