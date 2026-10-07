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
    expect(html).toContain("Frequenz-Denkmodelle knüpfen gedanklich");
    expect(html.match(/Konsequenz: Einsteins/g)?.length).toBe(1);
  });
});
