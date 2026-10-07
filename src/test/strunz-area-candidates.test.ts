import { describe, expect, it } from "vitest";
import { groupByProduct, STRUNZ_AREA } from "@/lib/strunzAreaCandidates";
describe("Strunz-Anwendungsbereich-Kandidaten", () => {
  it("nur exakte URL-Treffer auf die 9 Karten, keine Wirkcodes", () => {
    expect(STRUNZ_AREA.kandidaten.length).toBe(69);
    expect(groupByProduct(STRUNZ_AREA.kandidaten).length).toBe(9);
    for (const c of STRUNZ_AREA.kandidaten) {
      expect(c.code).toBe("listed_in_application_area");
      expect(c.status).toBe("kandidat_ungeprueft");
      expect(c.article_id && c.revision_id && c.entity_id && c.product_source_revision_id).toBeTruthy();
    }
    expect(Object.keys(STRUNZ_AREA.seiten).length).toBe(21);
  });
});
