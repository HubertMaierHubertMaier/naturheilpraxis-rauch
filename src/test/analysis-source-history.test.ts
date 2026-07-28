import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSourceManifest,
  canonicalizeAnalysisSourceText,
  completeSuccessfulSourceAnalysis,
  compareSourcesWithHistory,
  parseSourceHistoryReport,
  reconcileSourceSelection,
  setManualSourceSelection,
  sha256CanonicalAnalysisSourceText,
  type SourceHistoryReport,
  type SourceManifestEntry,
} from "@/lib/analysisSourceHistory";

const entry = (sourceId: string, contentSha256: string): SourceManifestEntry => ({
  sourceId,
  label: sourceId,
  group: "befund",
  contentSha256,
  chars: 3,
  lines: 1,
});

const report = (createdAt: string, entries: SourceManifestEntry[], strict = true): SourceHistoryReport => ({
  createdAt,
  entries,
  strict,
  legacy: !strict,
});

describe("analysis source history", () => {
  it("canonicalizes deidentified text and hashes it with SHA-256", async () => {
    expect(canonicalizeAnalysisSourceText("  abc  \r\n\r\n")).toBe("abc");
    expect(await sha256CanonicalAnalysisSourceText("  abc  \r\n")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await sha256CanonicalAnalysisSourceText("e\u0301\r\nWert   ")).toBe(await sha256CanonicalAnalysisSourceText("é\nWert"));

    const manifest = await buildSourceManifest([{ sourceId: "laborKomplett:doc:0:dokument-a1b2c3d4e5f6", group: "dokument", text: "abc\r\n" }]);
    expect(manifest[0]).toEqual(expect.objectContaining({ sourceId: "laborKomplett:doc:a1b2c3d4e5f6", label: "Labor komplett - Dokument a1b2c3d4e5f6", chars: 3, lines: 1 }));
  });

  it("reports new, changed, unchanged and conservative legacy states", () => {
    const a = entry("a", "a".repeat(64));
    const b = entry("b", "b".repeat(64));
    const c = entry("c", "c".repeat(64));
    const d = entry("d", "d".repeat(64));
    const comparisons = compareSourcesWithHistory([a, b, c, d], [
      report("2026-07-04T10:00:00Z", [entry("b", "0".repeat(64))]),
      report("2026-07-03T10:00:00Z", [a]),
      report("2026-07-02T10:00:00Z", [{ ...c, contentSha256: "" }], false),
    ]);

    expect(comparisons.map(({ sourceId, status }) => [sourceId, status])).toEqual([
      ["a", "unchanged"],
      ["b", "changed"],
      ["c", "legacy_changed"],
      ["d", "new"],
    ]);
  });

  it("uses the newest report containing the individual source, not the newest report overall", () => {
    const laboratory = entry("laborKomplett", "a".repeat(64));
    const comparison = compareSourcesWithHistory([laboratory], [
      report("2026-07-05T10:00:00Z", [entry("arztbericht", "b".repeat(64))]),
      report("2026-07-04T10:00:00Z", [laboratory]),
    ])[0];
    expect(comparison.status).toBe("unchanged");
    expect(comparison.lastAnalyzedAt).toBe("2026-07-04T10:00:00Z");
  });

  it("takes the first nonempty legacy fallback list", () => {
    const parsed = parseSourceHistoryReport({
      created_at: "2026-07-01T10:00:00Z",
      befund_meta: { source_summary: [], sources_fallback: [{ key: "laborKomplett", label: "Labor komplett", chars: 12, lines: 2 }] },
      eingabe_daten: { sourceSummary: [{ key: "arztbericht", label: "Arztbericht" }] },
    });
    expect(parsed.legacy).toBe(true);
    expect(parsed.entries).toEqual([expect.objectContaining({ sourceId: "laborKomplett", label: "Labor komplett" })]);
  });

  it("prefers manifest v1 but only trusts hashes from strict completed reports", () => {
    const manifestEntry = entry("laborKomplett", "a".repeat(64));
    const parsed = parseSourceHistoryReport({
      created_at: "2026-07-01T10:00:00Z",
      befund_meta: { strict_complete: false, source_manifest_v1: [manifestEntry], source_summary: [{ sourceId: "wrong", label: "Wrong" }] },
    });
    expect(parsed.entries).toEqual([manifestEntry]);
    expect(parsed.strict).toBe(false);
    expect(compareSourcesWithHistory([manifestEntry], [parsed])[0].status).toBe("legacy_changed");
  });

  it("preserves manual choices across edits and consumes them after a successful run", () => {
    const unchanged = { ...entry("old", "a".repeat(64)), status: "unchanged" as const, lastAnalyzedAt: "2026-07-01" };
    const changed = { ...entry("lab", "b".repeat(64)), status: "changed" as const, lastAnalyzedAt: "2026-07-01" };
    let state = reconcileSourceSelection({ selectedSourceIds: [], manualSelections: {} }, [unchanged, changed]);
    expect(state.selectedSourceIds).toEqual(["lab"]);

    state = setManualSourceSelection(state, [unchanged, changed], ["old"], ["old", "lab"]);
    state = reconcileSourceSelection(state, [unchanged, changed]);
    expect(state.selectedSourceIds).toEqual(["old"]);

    const laterChanged = { ...changed, contentSha256: "c".repeat(64), status: "changed" as const };
    state = reconcileSourceSelection(state, [unchanged, laterChanged]);
    expect(state.selectedSourceIds).toEqual(["old"]);

    const newSource = { ...entry("new-pdf", "d".repeat(64)), status: "new" as const, lastAnalyzedAt: null };
    state = reconcileSourceSelection(state, [unchanged, laterChanged, newSource]);
    expect(state.selectedSourceIds).toEqual(["old", "new-pdf"]);

    state = completeSuccessfulSourceAnalysis(state, ["old", "new-pdf"]);
    const completedOld = { ...unchanged, status: "unchanged" as const };
    const completedNew = { ...newSource, status: "unchanged" as const, lastAnalyzedAt: "2026-07-02" };
    state = reconcileSourceSelection(state, [completedOld, laterChanged, completedNew]);
    expect(state.selectedSourceIds).toEqual([]);
  });

  it("keeps modern document identity across reordering and rejects duplicate identities", async () => {
    const first = await buildSourceManifest([
      { sourceId: "vievaPlus:doc:0:dokument-111111111111", group: "dokument", text: "Vitamin D" },
      { sourceId: "vievaPlus:doc:1:dokument-222222222222", group: "dokument", text: "HRV" },
    ]);
    const reordered = await buildSourceManifest([
      { sourceId: "vievaPlus:doc:0:dokument-222222222222", group: "dokument", text: "HRV" },
      { sourceId: "vievaPlus:doc:1:dokument-111111111111", group: "dokument", text: "Vitamin D" },
    ]);
    expect(reordered.map((item) => item.sourceId)).toEqual([first[1].sourceId, first[0].sourceId]);
    await expect(buildSourceManifest([
      { sourceId: "vievaPlus:doc:0:dokument-111111111111", group: "dokument", text: "A" },
      { sourceId: "vievaPlus:doc:1:dokument-111111111111", group: "dokument", text: "B" },
    ])).rejects.toThrow("Doppelte Quellen-ID");
  });

  it("persists only neutral labels without dates or filenames", async () => {
    const manifest = await buildSourceManifest([
      { sourceId: "arztbericht", group: "befund", text: "Befund" },
      { sourceId: "vievaPlus:doc:0:dokument-abcdef123456", group: "dokument", text: "HRV" },
    ]);
    expect(manifest.map((item) => item.label)).toEqual(["Arztbericht", "Vieva Plus - Dokument abcdef123456"]);
    expect(JSON.stringify(manifest)).not.toMatch(/2026-07-28|mustermann|\.pdf/i);
  });

  it("wires source-based manifests into every persistence surface and exposes the required UX", () => {
    const recommendation = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8");
    const history = readFileSync(resolve(process.cwd(), "src/components/admin/therapy/PseudonymHistory.tsx"), "utf8");

    expect(recommendation).toContain('source_manifest_v1: sourceManifest');
    expect(recommendation).toContain('source_manifest_version: 1');
    expect(recommendation).toContain('sourceManifestV1: sourceManifest');
    expect(recommendation).toContain('source_summary: sourceSummary');
    expect(recommendation).toContain('setSourceHistoryReports([])');
    expect(recommendation).toContain('patientScopeGenerationRef.current += 1');
    expect(recommendation).toContain("Standardmäßig sind nur neue oder geänderte Quellen ausgewählt");
    expect(recommendation).toContain("Letzte fertige Auswertung:");
    expect(recommendation).toContain("Quellenstand:");
    expect(recommendation).toContain("GEÄNDERT* (Altbestand)");
    expect(history).toContain("Ausgewertet am");
    expect(history).toContain("In dieser Auswertung enthalten");
    expect(history).toContain("Nachvollziehbar · Manifest v1");
    expect(history).toContain("Status offen · Altbestand");
    expect(history).toContain("Zeichen ·");
    expect(history).toContain("Zeilen");
  });
});
