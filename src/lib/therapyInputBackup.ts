export const THERAPY_INPUT_BACKUP_TABLES = [
  "therapy_input_revisions",
  "therapy_input_sources",
  "therapy_input_facts",
  "therapy_input_fact_sources",
  "therapy_retrieval_audit_runs",
] as const;

export type TherapyInputBackupTable = (typeof THERAPY_INPUT_BACKUP_TABLES)[number];

export type TherapyInputSnapshotManifestV3 = Record<
  TherapyInputBackupTable,
  { rows: number; sha256: string }
>;

export type TherapyInputSnapshotValidationV3 = {
  invalid_revision_count: number;
  invalid_fact_count: number;
  invalid_audit_run_count: number;
};

type TherapyInputTableExport = {
  rows?: unknown[];
  serializedRows?: string;
  rowCount?: number;
  error?: string;
};

export type TherapyInputSubsetPayload = {
  tables?: Record<string, TherapyInputTableExport>;
  therapyInputSnapshotVersion?: number | null;
  therapyInputSnapshotManifest?: Partial<TherapyInputSnapshotManifestV3> | null;
  therapyInputValidation?: Partial<TherapyInputSnapshotValidationV3> | null;
};

async function sha256TextHex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateTherapyInputSubsetPayload(
  payload: TherapyInputSubsetPayload,
): Promise<void> {
  if (payload.therapyInputSnapshotVersion !== 3) {
    throw new Error("Therapie-Eingabe-Backup: unerwartete Snapshot-Version");
  }

  const validation = payload.therapyInputValidation;
  if (JSON.stringify(Object.keys(validation ?? {}).sort()) !== JSON.stringify([
    "invalid_audit_run_count",
    "invalid_fact_count",
    "invalid_revision_count",
  ])
    || validation?.invalid_revision_count !== 0
    || validation?.invalid_fact_count !== 0
    || validation?.invalid_audit_run_count !== 0) {
    throw new Error("Therapie-Eingabe-Backup: Integritaetspruefung fehlt oder ist fehlgeschlagen");
  }

  const manifest = payload.therapyInputSnapshotManifest;
  const manifestTables = Object.keys(manifest ?? {}).sort();
  const expectedTables = [...THERAPY_INPUT_BACKUP_TABLES].sort();
  if (JSON.stringify(manifestTables) !== JSON.stringify(expectedTables)) {
    throw new Error("Therapie-Eingabe-Backup: unvollstaendiges Snapshot-Manifest");
  }

  const unexpectedTherapyTables = Object.keys(payload.tables ?? {})
    .filter((table) => (
      table.startsWith("therapy_input_")
      || table.startsWith("therapy_retrieval_audit_")
    )
      && !THERAPY_INPUT_BACKUP_TABLES.includes(table as TherapyInputBackupTable));
  if (unexpectedTherapyTables.length > 0) {
    throw new Error("Therapie-Eingabe-Backup: unbekannte Therapie-Eingabetabelle");
  }

  for (const table of THERAPY_INPUT_BACKUP_TABLES) {
    const tableExport = payload.tables?.[table];
    const tableManifest = manifest?.[table];
    let parsedRows: unknown;
    try {
      // Parsing is only for shape/count validation. The original string is archived verbatim.
      parsedRows = typeof tableExport?.serializedRows === "string"
        ? JSON.parse(tableExport.serializedRows)
        : undefined;
    } catch {
      parsedRows = undefined;
    }
    if (tableExport?.error
      || typeof tableExport?.serializedRows !== "string"
      || !Array.isArray(parsedRows)
      || !Number.isSafeInteger(tableExport.rowCount)
      || (tableExport.rowCount ?? -1) < 0
      || !Number.isSafeInteger(tableManifest?.rows)
      || (tableManifest?.rows ?? -1) < 0
      || tableExport.rowCount !== tableManifest?.rows
      || parsedRows.length !== tableExport.rowCount
      || !/^[0-9a-f]{64}$/.test(tableManifest?.sha256 ?? "")
      || await sha256TextHex(tableExport.serializedRows) !== tableManifest?.sha256) {
      throw new Error(`Therapie-Eingabe-Backup: ungueltiger verlustfreier Export fuer ${table}`);
    }
  }
}
