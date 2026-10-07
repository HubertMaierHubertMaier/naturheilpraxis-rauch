import { describe, it, expect } from "vitest";
import { fundstelle } from "@/lib/infothekFundstelle";
const p = { sectionOf: new Map([[5, 3]]), sectionCount: 12 };
describe("Fundstelle", () => {
  it("Abschnitt X von Y", () => expect(fundstelle({ id: 5 }, p, "allergiebehandlung.html")).toBe("allergiebehandlung.html · Abschnitt 3 von 12"));
  it("Seitentitel/Meta außerhalb des Artikeltexts", () => {
    expect(fundstelle({ id: 1, headOnly: { kind: "title" } }, p, "a.html")).toContain("Seitentitel: Seiteneinstellungen / Google-Suchvorschau – außerhalb des Artikeltexts");
    expect(fundstelle({ id: 2, headOnly: { kind: "meta" } }, p, "a.html")).toContain("Meta-Beschreibung");
  });
  it("keine erfundene Zahl", () => { const r = fundstelle({ id: 9 }, p, "a.html"); expect(r).toBe("a.html · Abschnitt nicht ermittelbar"); expect(r).not.toMatch(/Seite \d/); });
});
