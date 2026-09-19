import { describe, expect, it } from "vitest";
import { analysisRetryChunkLimit, isAnalysisOutputFailure } from "@/lib/analysisRetryPolicy";
import { splitPageAwareClinicalText } from "../../supabase/functions/_shared/clinicalSourceEvidence";

describe("output-heavy clinical section recovery", () => {
  it("splits a short 1501-character source that would previously never qualify for splitting", () => {
    expect(analysisRetryChunkLimit(1501)).toBe(750);
  });
  it("reduces a prior retry size without bouncing back to a larger size", () => {
    expect(analysisRetryChunkLimit(1501, 750)).toBe(512);
    expect(analysisRetryChunkLimit(1501, 512)).toBe(512);
    expect(analysisRetryChunkLimit(6000)).toBe(2000);
    expect(analysisRetryChunkLimit(400)).toBeNull();
  });
  it("keeps the page marker and every original source line during the smaller split", () => {
    const lines = Array.from({ length: 40 }, (_, i) => `Synthetischer Eintrag ${String(i).padStart(2, "0")}: keine Einnahme, Index 0,125.`);
    const source = "--- Seite 17 ---\n" + lines.join("\n");
    const chunks = splitPageAwareClinicalText("Synthetischer Befund", source, analysisRetryChunkLimit(source.length)!);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.text).toContain("--- Seite 17 ---");
    for (const line of lines) expect(chunks.some(chunk => chunk.text.includes(line))).toBe(true);
  });
  it("distinguishes output-contract failures from authentication and network failures", () => {
    expect(isAnalysisOutputFailure("AI Gateway timeout nach 55s (Ausgabelimit gemeldet)")).toBe(true);
    expect(isAnalysisOutputFailure("Teilanalyse hat fehlende Pflichtlisten")).toBe(true);
    expect(isAnalysisOutputFailure("Nicht autorisiert")).toBe(false);
    expect(isAnalysisOutputFailure("Failed to fetch")).toBe(false);
  });
});
