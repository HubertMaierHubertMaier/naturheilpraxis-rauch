import { describe, expect, it } from "vitest";
import { currentCardsOnly, type KCard } from "@/lib/klinghardtNavigator";
const c = (revisionId: string, title: string) => ({ revisionId, title } as unknown as KCard);
const raw = [c("r2", "B aktuell"), c("r1", "A historisch")];
describe("Klinghardt: nur aktuelle Revisionen", () => {
  it("Navigator vor Modell: wartet, zählt historische nicht als aktuell", () => {
    expect(currentCardsOnly(raw, null)).toBe("loading");
    expect(currentCardsOnly(raw, new Set(["r2"]))).toEqual([raw[0]]);
  });
  it("Modell vor Navigator: wartet auf Karten, dann gefiltert", () => {
    expect(currentCardsOnly(null, new Set(["r2"]))).toBeNull();
    expect(currentCardsOnly("loading", new Set(["r2"]))).toBe("loading");
    const r = currentCardsOnly(raw, new Set(["r2"])) as KCard[];
    expect(r.map((x) => x.revisionId)).toEqual(["r2"]);
  });
  it("leere aktuelle Menge filtert alles weg statt ungefiltert", () => {
    expect(currentCardsOnly(raw, new Set())).toEqual([]);
  });
});
