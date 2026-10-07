import { describe, it, expect } from "vitest";
import orig from "../../website-content/infothek/krankheit-ist-messbar.html?raw";
import draft from "../../website-content/infothek/drafts/krankheit-ist-messbar.entwurf.html?raw";
import { KRANKHEIT_IST_MESSBAR_CHANGES as C } from "@/lib/infothekComparisonChanges";
import { composeWorkingVersion } from "@/lib/infothekComparison";
describe("Ä11 Umfang", () => {
  it("ersetzt ganzen Satz ohne Resttext", () => {
    const { html, failed } = composeWorkingVersion(orig, draft, C, new Set([1, 11]));
    expect(failed).toEqual([]);
    expect(html).not.toContain("völlig ineinander");
    expect(html).not.toMatch(/<p>umwandelbar<\/p>/);
    expect(html).toContain("wie eng Energie und Materie zusammenhängen");
    expect(html.match(/Konsequenz: Einsteins/g)?.length).toBe(1);
  });
});
describe("Ä33 ersetzt Ä17 nur wenn übernommen", () => {
  it("Ä17 allein bleibt", () => {
    const { html } = composeWorkingVersion(orig, draft, C, new Set([17, 18]));
    expect(html).toContain("regulierend auf dieses Feld einzuwirken");
    expect(html).not.toContain("gedanklichen Rahmen");
  });
  it("Ä17 + Ä33: nur Ä33-Text", () => {
    const { html, failed } = composeWorkingVersion(orig, draft, C, new Set([1, 6, 7, 9, 10, 12, 17, 18, 33]));
    expect(failed).toEqual([]);
    expect(html).toContain("gedanklichen Rahmen");
    expect(html).not.toContain("regulierend auf dieses Feld einzuwirken");
    expect(html).not.toContain("Deshalb heilt");
  });
});
