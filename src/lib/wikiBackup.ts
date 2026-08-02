import {
  validateWikiSnapshotShape,
  type WikiSnapshotShape,
} from "../../supabase/functions/_shared/wikiSnapshotValidation";

export const WIKI_ZERO_VALIDATION_KEYS = [
  "missing_articles",
  "invalid_current_snapshots",
  "orphaned_active_articles",
  "invalid_source_promotions",
  "invalid_therapeutic_catalog_revisions",
  "invalid_entity_candidate_contracts",
  "invalid_entity_candidate_draft_promotions",
  "invalid_knowledge_releases",
  "invalid_dosage_rules",
  "invalid_safety_rules",
  "invalid_search_documents",
  "invalid_lab_parameter_revisions",
  "invalid_lab_reference_ranges",
  "invalid_lab_finding_definition_revisions",
] as const;

export type WikiSubsetPayload = {
  area: string;
  tables: Record<string, {
    rows?: Record<string, unknown>[];
    serializedRows?: string;
    rowCount: number;
    error?: string;
  }>;
  storage: Record<string, Array<{ path: string; size: number; signedUrl: string }>>;
  wikiSnapshotManifest?: WikiSnapshotShape["manifest"] | null;
  legacyBridgeValidation?: WikiSnapshotShape["validation"] | null;
};

export async function validateWikiSubsetPayload(
  payload: WikiSubsetPayload,
  expectedTableNames: readonly string[],
): Promise<void> {
  if (payload.area !== "wiki") {
    throw new Error("Wiki-Teilbackup hat einen unerwarteten Bereich");
  }
  if (
    !payload.storage
    || typeof payload.storage !== "object"
    || Array.isArray(payload.storage)
    || Object.keys(payload.storage).length !== 0
  ) {
    throw new Error("Wiki-Teilbackup darf keine Storage-Downloads enthalten");
  }

  const tables: Record<string, unknown[]> = {};
  const serializedTables: Record<string, string> = {};
  for (const [name, table] of Object.entries(payload.tables)) {
    if (table.error) throw new Error(`Wiki-Teilbackup enthaelt Tabellenfehler fuer ${name}`);
    let rows: unknown;
    try {
      rows = typeof table.serializedRows === "string"
        ? JSON.parse(table.serializedRows)
        : null;
    } catch {
      throw new Error(`Wiki-Teilbackup ist fuer ${name} nicht parsebar`);
    }
    if (
      table.rows !== undefined
      || typeof table.serializedRows !== "string"
      || !Array.isArray(rows)
      || !Number.isSafeInteger(table.rowCount)
      || table.rowCount !== rows.length
    ) {
      throw new Error(`Wiki-Teilbackup ist fuer ${name} ungueltig`);
    }
    tables[name] = rows;
    serializedTables[name] = table.serializedRows;
  }

  await validateWikiSnapshotShape(
    {
      tables,
      serializedTables,
      manifest: payload.wikiSnapshotManifest ?? {},
      validation: payload.legacyBridgeValidation ?? {},
    },
    expectedTableNames,
    WIKI_ZERO_VALIDATION_KEYS,
  );
}
