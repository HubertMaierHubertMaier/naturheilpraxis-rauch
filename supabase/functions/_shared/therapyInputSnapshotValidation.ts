type SnapshotManifestEntry = {
  rows?: unknown;
  sha256?: unknown;
};

type TherapyInputSnapshotCandidate = {
  snapshot_version?: unknown;
  tables?: unknown;
  manifest?: unknown;
  validation?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function sha256TextHex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function validateTherapyInputSnapshot(
  value: unknown,
  expectedTables: readonly string[],
  expectedVersion: number,
  validationKeys: readonly string[],
): Promise<void> {
  if (!isRecord(value)) {
    throw new Error("Therapie-Eingabe-Snapshot: ungueltiges Manifest");
  }
  const snapshot = value as TherapyInputSnapshotCandidate;
  if (snapshot.snapshot_version !== expectedVersion) {
    throw new Error("Therapie-Eingabe-Snapshot: unerwartete Snapshot-Version");
  }

  if (!isRecord(snapshot.validation)
    || JSON.stringify(Object.keys(snapshot.validation).sort())
      !== JSON.stringify([...validationKeys].sort())
    || validationKeys.some((key) => snapshot.validation?.[key] !== 0)) {
    throw new Error("Therapie-Eingabe-Snapshot: Integritaetspruefung fehlgeschlagen");
  }

  if (!isRecord(snapshot.tables) || !isRecord(snapshot.manifest)) {
    throw new Error("Therapie-Eingabe-Snapshot: unvollstaendige Tabellengrenze");
  }
  const expectedNames = [...expectedTables].sort();
  if (JSON.stringify(Object.keys(snapshot.tables).sort()) !== JSON.stringify(expectedNames)
    || JSON.stringify(Object.keys(snapshot.manifest).sort()) !== JSON.stringify(expectedNames)) {
    throw new Error("Therapie-Eingabe-Snapshot: unvollstaendige Tabellengrenze");
  }

  for (const table of expectedTables) {
    const serializedRows = snapshot.tables[table];
    const manifest = snapshot.manifest[table] as SnapshotManifestEntry | undefined;
    let parsedRows: unknown;
    try {
      parsedRows = typeof serializedRows === "string"
        ? JSON.parse(serializedRows)
        : undefined;
    } catch {
      parsedRows = undefined;
    }
    if (typeof serializedRows !== "string"
      || !Array.isArray(parsedRows)
      || !Number.isSafeInteger(manifest?.rows)
      || (manifest?.rows as number) < 0
      || parsedRows.length !== manifest?.rows
      || typeof manifest?.sha256 !== "string"
      || !/^[0-9a-f]{64}$/.test(manifest.sha256)
      || await sha256TextHex(serializedRows) !== manifest.sha256) {
      throw new Error(`Therapie-Eingabe-Snapshot: Manifestfehler in ${table}`);
    }
  }
}

export async function validateTherapyInputSnapshotV2(
  value: unknown,
  expectedTables: readonly string[],
): Promise<void> {
  return validateTherapyInputSnapshot(value, expectedTables, 2, [
    "invalid_fact_count",
    "invalid_revision_count",
  ]);
}

export async function validateTherapyInputSnapshotV3(
  value: unknown,
  expectedTables: readonly string[],
): Promise<void> {
  return validateTherapyInputSnapshot(value, expectedTables, 3, [
    "invalid_audit_run_count",
    "invalid_fact_count",
    "invalid_revision_count",
  ]);
}
