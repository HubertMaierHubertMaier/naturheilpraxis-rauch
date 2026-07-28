import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const count = (value: string, pattern: string) => value.split(pattern).length - 1;

describe("therapy workflow UI structure", () => {
  it("renders each primary workflow action only once", () => {
    const source = readSource("src/components/admin/TherapyRecommendation.tsx");

    expect(count(source, "onClick={handleAnalyzeDocuments}")).toBe(1);
    expect(count(source, "onClick={() => handleSubmit()}")).toBe(1);
    expect(count(source, "onClick={handleReAnalyzeAll}")).toBe(1);
    expect(count(source, "Ausgewählte Befunde auswerten ({analysisSourceTotals.selected})")).toBe(1);
    expect(count(source, "Therapie-Empfehlung generieren")).toBe(1);
    expect(source).not.toContain("Start-Aktionen");
    expect(source).not.toContain("fixed bottom-4");
    expect(source).not.toContain("Weitere Befunde nachladen");
    expect(source.indexOf("Nächster Schritt: Therapie aus dem vollständigen Befund ableiten"))
      .toBeGreaterThan(source.indexOf("Befund-Auswertung {isAnalyzingDocs"));
    expect(source).toContain('TabsTrigger value="vieva-plus"');
    expect(source).toContain('TabsTrigger value="metatron"');
    expect(count(source, "requireDocumentDate")).toBe(2);
    expect(source).toContain("applyExtractedToInputs({ forPseudonymId: analysisPid");
    expect(source).toContain("if (docAbortRef.current)");
    expect(source).toContain("if (abortRef.current)");
    expect(source).toContain("disabled={isStreaming || therapyStartBlockedByBefund}");
    expect(source).toContain("hasEffectivelySelectedBefundSources");
    expect(source).toContain("sameBefundSourceRevision(recentlyCompleted.sourceRevision, analysisSources)");
  });
});
