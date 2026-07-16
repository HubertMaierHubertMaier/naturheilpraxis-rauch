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
  });
});
