export type AnalysisSourceGroup = "kontext" | "befund" | "dokument" | "recherche";

export type SourceManifestEntry = {
  sourceId: string;
  label: string;
  group: AnalysisSourceGroup;
  contentSha256: string;
  chars: number;
  lines: number;
};

export type SourceHistoryReport = {
  createdAt: string;
  entries: SourceManifestEntry[];
  strict: boolean;
  legacy: boolean;
};

export type AnalysisSourceStatus = "new" | "changed" | "unchanged" | "legacy_changed";

export type SourceComparison = SourceManifestEntry & {
  status: AnalysisSourceStatus;
  lastAnalyzedAt: string | null;
};

export type SourceSelectionState = {
  selectedSourceIds: string[];
  manualSelections: Record<string, boolean>;
};

type ReportRow = {
  created_at?: unknown;
  befund_meta?: unknown;
  eingabe_daten?: unknown;
};

type ManifestInput = {
  sourceId: string;
  group: AnalysisSourceGroup;
  text: string;
};

const GROUPS = new Set<AnalysisSourceGroup>(["kontext", "befund", "dokument", "recherche"]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

export const canonicalizeAnalysisSourceText = (value: string): string => value
  .normalize("NFC")
  .replace(/\r\n?/g, "\n")
  .split("\n")
  .map((line) => line.trimEnd())
  .join("\n")
  .trim();

export const sha256CanonicalAnalysisSourceText = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(canonicalizeAnalysisSourceText(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const normalizeAnalysisSourceId = (key: string): string => {
  const normalized = String(key || "").trim();
  const documentMatch = normalized.match(/^(.+?):doc:(\d+)(?::(.*))?$/);
  if (!documentMatch) return normalized;
  const stableDocumentId = documentMatch[3]?.match(/(?:^|-)dokument-([a-f0-9]{12})(?:-|$)/i)?.[1]?.toLowerCase();
  return stableDocumentId
    ? `${documentMatch[1]}:doc:${stableDocumentId}`
    : `${documentMatch[1]}:doc:${documentMatch[2]}`;
};

export const neutralAnalysisSourceLabel = (sourceId: string, group: AnalysisSourceGroup): string => {
  const fixedLabels: Record<string, string> = {
    patientenkontext: "Aktueller Patientenkontext",
    mannayan: "Mannayan-Bestellungen",
    laborKomplett: "Labor komplett",
    laborErhoeht: "Labor - erhöhte Werte",
    laborErniedrigt: "Labor - erniedrigte Werte",
    stuhlbefund: "Stuhlbefund",
    arztbericht: "Arztbericht",
    metatronHeel: "Metatron Hospital / NLS",
    sonstigeUntersuchungen: "Sonstige Untersuchung",
    vievaPlus: "Vieva Plus",
    perplexityAnalyse: "Externe Recherche",
  };
  if (fixedLabels[sourceId]) return fixedLabels[sourceId];

  const documentMatch = sourceId.match(/^([^:]+):doc:([a-f0-9]{12}|\d+)$/i);
  if (documentMatch) {
    const groupLabel = fixedLabels[documentMatch[1]] || "Dokument";
    return `${groupLabel} - Dokument ${documentMatch[2]}`;
  }
  const introMatch = sourceId.match(/^([^:]+):intro$/);
  if (introMatch) return `${fixedLabels[introMatch[1]] || "Befund"} - Kopftext`;
  return group === "kontext" ? "Patientenkontext" : group === "recherche" ? "Externe Recherche" : group === "dokument" ? "Dokument" : "Befund";
};

export const buildSourceManifest = async (sources: ManifestInput[]): Promise<SourceManifestEntry[]> => {
  const normalizedSourceIds = sources.map((source) => normalizeAnalysisSourceId(source.sourceId));
  if (new Set(normalizedSourceIds).size !== normalizedSourceIds.length) {
    throw new Error("Doppelte Quellen-ID erkannt. Bitte das betroffene Dokument entfernen und erneut einfügen.");
  }
  return Promise.all(sources.map(async (source, index) => {
    const canonicalText = canonicalizeAnalysisSourceText(source.text);
    const sourceId = normalizedSourceIds[index];
    return {
      sourceId,
      label: neutralAnalysisSourceLabel(sourceId, source.group),
      group: source.group,
      contentSha256: await sha256CanonicalAnalysisSourceText(canonicalText),
      chars: canonicalText.length,
      lines: canonicalText ? canonicalText.split("\n").filter((line) => line.trim()).length : 0,
    };
  }));
};

const inferLegacySourceId = (source: Record<string, unknown>, label: string): string => {
  const explicitSourceId = String(source.sourceId || "").trim();
  if (explicitSourceId) return normalizeAnalysisSourceId(explicitSourceId);
  const legacyKey = String(source.key || "").trim();

  const normalizedLabel = label.toLocaleLowerCase("de-DE");
  if (normalizedLabel.startsWith("aktueller patientenkontext")) return "patientenkontext";
  if (normalizedLabel.startsWith("mannayan-bestellungen")) return "mannayan";
  if (normalizedLabel.startsWith("labor komplett")) return "laborKomplett";
  if (normalizedLabel.startsWith("labor – erhöhte") || normalizedLabel.startsWith("labor - erhöhte")) return "laborErhoeht";
  if (normalizedLabel.startsWith("labor – erniedrigte") || normalizedLabel.startsWith("labor - erniedrigte")) return "laborErniedrigt";
  if (normalizedLabel.startsWith("stuhlbefund")) return "stuhlbefund";
  if (normalizedLabel.startsWith("arztbericht")) return "arztbericht";
  if (normalizedLabel.startsWith("metatron")) return "metatronHeel";
  if (normalizedLabel.startsWith("sonstige")) return "sonstigeUntersuchungen";
  if (normalizedLabel.startsWith("externe recherche") || normalizedLabel.startsWith("perplexity")) return "perplexityAnalyse";
  return legacyKey && !/^Dokument\s+\d+$/i.test(legacyKey) ? normalizeAnalysisSourceId(legacyKey) : `legacy:${label}`;
};

const parseEntry = (value: unknown, legacy: boolean): SourceManifestEntry | null => {
  const source = typeof value === "string" ? { label: value } : asRecord(value);
  const label = String(source.label || source.name || source.key || "").trim();
  if (!label) return null;
  const sourceId = legacy
    ? inferLegacySourceId(source, label)
    : normalizeAnalysisSourceId(String(source.sourceId || ""));
  if (!sourceId) return null;
  const rawGroup = String(source.group || "befund") as AnalysisSourceGroup;
  return {
    sourceId,
    label,
    group: GROUPS.has(rawGroup) ? rawGroup : "befund",
    contentSha256: typeof source.contentSha256 === "string" ? source.contentSha256 : "",
    chars: Number.isFinite(Number(source.chars)) ? Math.max(0, Number(source.chars)) : 0,
    lines: Number.isFinite(Number(source.lines)) ? Math.max(0, Number(source.lines)) : 0,
  };
};

const firstNonEmptyParsedEntries = (legacy: boolean, ...values: unknown[]): SourceManifestEntry[] => {
  for (const value of values) {
    if (!Array.isArray(value) || value.length === 0) continue;
    const entries = value.map((entry) => parseEntry(entry, legacy)).filter((entry): entry is SourceManifestEntry => !!entry);
    if (entries.length > 0) return entries;
  }
  return [];
};

export const parseSourceHistoryReport = (row: ReportRow): SourceHistoryReport => {
  const meta = asRecord(row.befund_meta);
  const input = asRecord(row.eingabe_daten);
  const manifestEntries = firstNonEmptyParsedEntries(false, meta.source_manifest_v1, input.source_manifest_v1, input.sourceManifestV1);
  const hasManifest = manifestEntries.length > 0;
  if (hasManifest) {
    const strict = meta.strict_complete === true && manifestEntries.every((entry) => SHA256_PATTERN.test(entry.contentSha256));
    return {
      createdAt: String(row.created_at || ""),
      entries: manifestEntries,
      strict,
      legacy: !strict,
    };
  }

  const legacyEntries = firstNonEmptyParsedEntries(
    true,
    meta.source_summary,
    meta.sources_fallback,
    input.sourceSummary,
    input.sources_fallback,
    input.sources,
  );
  return {
    createdAt: String(row.created_at || ""),
    entries: legacyEntries,
    strict: false,
    legacy: true,
  };
};

export const compareSourcesWithHistory = (
  currentEntries: SourceManifestEntry[],
  reports: SourceHistoryReport[],
): SourceComparison[] => {
  const newestFirst = [...reports].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  return currentEntries.map((entry) => {
    const report = newestFirst.find((candidate) => candidate.entries.some((historic) => historic.sourceId === entry.sourceId));
    if (!report) return { ...entry, status: "new", lastAnalyzedAt: null };
    const historic = report.entries.find((candidate) => candidate.sourceId === entry.sourceId)!;
    if (!report.strict || !SHA256_PATTERN.test(historic.contentSha256)) {
      return { ...entry, status: "legacy_changed", lastAnalyzedAt: report.createdAt || null };
    }
    return {
      ...entry,
      status: historic.contentSha256 === entry.contentSha256 ? "unchanged" : "changed",
      lastAnalyzedAt: report.createdAt || null,
    };
  });
};

const shouldSelectByDefault = (status: AnalysisSourceStatus) => status !== "unchanged";

export const reconcileSourceSelection = (
  current: SourceSelectionState,
  comparisons: SourceComparison[],
): SourceSelectionState => {
  const available = new Set(comparisons.map((comparison) => comparison.sourceId));
  const selected = new Set(current.selectedSourceIds.filter((sourceId) => available.has(sourceId)));
  const manualSelections: Record<string, boolean> = {};

  for (const comparison of comparisons) {
    if (Object.prototype.hasOwnProperty.call(current.manualSelections, comparison.sourceId)) {
      const manuallySelected = current.manualSelections[comparison.sourceId];
      manualSelections[comparison.sourceId] = manuallySelected;
      if (manuallySelected) selected.add(comparison.sourceId);
      else selected.delete(comparison.sourceId);
      continue;
    }
    if (shouldSelectByDefault(comparison.status)) selected.add(comparison.sourceId);
    else selected.delete(comparison.sourceId);
  }

  return { selectedSourceIds: Array.from(selected), manualSelections };
};

export const setManualSourceSelection = (
  current: SourceSelectionState,
  comparisons: SourceComparison[],
  selectedSourceIds: string[],
  affectedSourceIds: string[] = comparisons.map((comparison) => comparison.sourceId),
): SourceSelectionState => {
  const selected = new Set(selectedSourceIds);
  const manualSelections = { ...current.manualSelections };
  const affected = new Set(affectedSourceIds);
  for (const comparison of comparisons) {
    if (affected.has(comparison.sourceId)) manualSelections[comparison.sourceId] = selected.has(comparison.sourceId);
  }
  return {
    selectedSourceIds: comparisons.filter((comparison) => selected.has(comparison.sourceId)).map((comparison) => comparison.sourceId),
    manualSelections,
  };
};

export const completeSuccessfulSourceAnalysis = (
  current: SourceSelectionState,
  completedSourceIds: string[],
): SourceSelectionState => {
  const completed = new Set(completedSourceIds);
  return {
    selectedSourceIds: current.selectedSourceIds.filter((sourceId) => !completed.has(sourceId)),
    manualSelections: Object.fromEntries(
      Object.entries(current.manualSelections).filter(([sourceId]) => !completed.has(sourceId)),
    ),
  };
};
