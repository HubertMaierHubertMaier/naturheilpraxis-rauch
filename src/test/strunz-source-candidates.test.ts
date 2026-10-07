import { describe, it, expect } from "vitest";
import { STRUNZ_SOURCES, sourcesByProduct } from "@/lib/strunzSourceCandidates";
import { STRUNZ_AREA } from "@/lib/strunzAreaCandidates";

describe("Strunz 53 source candidates", () => {
  const c = STRUNZ_SOURCES.kandidaten;
  it("has 53 unique real IDs with revision", () => {
    expect(c.length).toBe(53);
    expect(new Set(c.map((x) => x.candidate_id)).size).toBe(53);
    c.forEach((x) => expect(x.core_source_revision_id).toMatch(/^[0-9a-f-]{36}$/));
  });
  it("maps only to the 9 existing cards, 3 each, never by nutrient alone", () => {
    const cards = new Set(STRUNZ_AREA.kandidaten.map((k) => k.product_key));
    const m = sourcesByProduct(c);
    expect(m.size).toBe(9);
    m.forEach((xs, k) => { expect(cards.has(k)).toBe(true); expect(xs.length).toBe(3); });
    c.filter((x) => x.typ === "einzelstoff_referenz").forEach((x) => expect(x.product_key).toBeNull());
  });
  it("records pagination check and variant split", () => {
    const a = STRUNZ_AREA as any;
    expect(a.pagination_pruefung.seiten.length).toBe(21);
    expect(a.ungemappt_aufteilung.eindeutig + a.ungemappt_aufteilung.varianten).toBe(149);
  });
});
