export type WikiSnapshotShape = {
  tables: Record<string, unknown[]>;
  manifest: Record<string, { rows: number; sha256: string }>;
  validation: Record<string, unknown>;
};

export function validateWikiSnapshotShape(
  snapshot: WikiSnapshotShape | null,
  expectedTableNames: readonly string[],
  zeroValidationKeys: readonly string[],
): asserts snapshot is WikiSnapshotShape {
  if (!snapshot?.tables || !snapshot.manifest || !snapshot.validation) {
    throw new Error("Wiki-Snapshot ist unvollstaendig");
  }

  const expectedTables = [...expectedTableNames].sort();
  const snapshotTables = Object.keys(snapshot.tables).sort();
  const manifestTables = Object.keys(snapshot.manifest).sort();
  if (JSON.stringify(snapshotTables) !== JSON.stringify(expectedTables)) {
    throw new Error("Wiki-Snapshot enthaelt unerwartete oder fehlende Tabellen");
  }
  if (JSON.stringify(manifestTables) !== JSON.stringify(expectedTables)) {
    throw new Error("Wiki-Snapshot-Manifest enthaelt unerwartete oder fehlende Tabellen");
  }

  for (const table of expectedTables) {
    const rows = snapshot.tables[table];
    const manifest = snapshot.manifest[table];
    if (!Array.isArray(rows)) throw new Error(`Wiki-Snapshot fehlt Tabelle ${table}`);
    if (!manifest || manifest.rows !== rows.length || !/^[0-9a-f]{64}$/.test(manifest.sha256)) {
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
