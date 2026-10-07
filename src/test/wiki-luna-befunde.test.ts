import { describe, expect, it } from "vitest";
import { actorsOfEntity, buildWikiModel, productsWithSubstance, rejectedContains, splitRevisionHits } from "@/lib/wikiTaxonomy";

// Synthetic data only.
const base = () => ({
  entities: [
    { id: "P1", entity_type_code: "product", current_revision_id: "PR1" },
    { id: "P2", entity_type_code: "product", current_revision_id: "PR2" },
    { id: "N1", entity_type_code: "nutrient", current_revision_id: "NR1" },
    { id: "M1", entity_type_code: "manufacturer", current_revision_id: "MR1" },
  ],
  entityRevisions: [
    { id: "PR1", entity_id: "P1", display_name: "Feldprodukt", review_status: "draft", manufacturer: "Testfirma Alpha GmbH" },
    { id: "PR2", entity_id: "P2", display_name: "Relationsprodukt", review_status: "draft" },
    { id: "NR1", entity_id: "N1", display_name: "Zink", review_status: "draft" },
    { id: "MR1", entity_id: "M1", display_name: "Testfirma Beta", review_status: "draft" },
  ],
  coreLinks: [
    ...[["cP1", "P1"], ["cP2", "P2"], ["cN1", "N1"], ["cM1", "M1"]].map(([c, e]) => ({ candidate_kind: "entity", candidate_id: c, core_record_kind: "entity", core_entity_id: e, core_source_revision_id: null })),
    { candidate_kind: "source", candidate_id: "scOld", core_record_kind: "source", core_entity_id: null, core_source_revision_id: "SR1" },
  ],
  relations: [
    { id: "R1", subject_candidate_id: "cP2", object_candidate_id: "cM1", proposed_relation_type_code: "manufactured_by", candidate_status: "imported_unreviewed", source_candidate_id: "scOld", source_locator: "S. 2" },
    { id: "R2", subject_candidate_id: "cP1", object_candidate_id: "cN1", proposed_relation_type_code: "contains", candidate_status: "rejected", source_candidate_id: null, source_locator: null },
    { id: "R3", subject_candidate_id: "cP2", object_candidate_id: "cN1", proposed_relation_type_code: "contains", candidate_status: "needs_clarification", source_candidate_id: null, source_locator: null },
  ],
  articles: [{ id: "A1", current_revision_id: "AR2", article_kind: "reference" }, { id: "A2", current_revision_id: "AR3", article_kind: "reference" }],
  articleRevisions: [
    { id: "AR1", article_id: "A1", revision_no: 1, title: "Alt", category_path: "X", review_status: "superseded" },
    { id: "AR2", article_id: "A1", revision_no: 2, title: "Neu", category_path: "X", review_status: "draft" },
    { id: "AR3", article_id: "A2", revision_no: 1, title: "Anderer", category_path: "X", review_status: "draft" },
  ],
  sources: [{ id: "S1", current_revision_id: "SR2" }],
  sourceRevisions: [
    { id: "SR1", source_id: "S1", revision_no: 1, title: "Quelle Fassung 1", publisher: null, authors: [], review_status: "superseded" },
    { id: "SR2", source_id: "S1", revision_no: 2, title: "Quelle Fassung 2", publisher: null, authors: [], review_status: "draft" },
  ],
});

describe("Luna-Befunde 711b3449", () => {
  const m = buildWikiModel(base() as never);
  it("(1) Treffer nur in alter Revision bleibt sichtbar, aber als historisch", () => {
    // Wort steht nur in AR1 (alt), nicht in AR2 (aktuell); A2 aktuell getroffen.
    const r = splitRevisionHits([{ id: "AR1", article_id: "A1" }, { id: "AR3", article_id: "A2" }], m.articles);
    expect(r.current).toEqual(["A2"]);
    expect(r.historical).toEqual(["A1"]);
    expect([...r.historicalRevisionIds.get("A1")!]).toEqual(["AR1"]);
    // alt + aktuell getroffen → nur aktuell, nicht doppelt historisch
    const r2 = splitRevisionHits([{ id: "AR1", article_id: "A1" }, { id: "AR2", article_id: "A1" }], m.articles);
    expect(r2).toMatchObject({ current: ["A1"], historical: [] });
  });
  it("(2) Beleg auf SR1 bleibt SR1, obwohl SR2 aktuell ist", () => {
    const rel = m.relations.find((r) => r.id === "R1")!;
    expect(rel.sourceRevisionId).toBe("SR1");
    expect(m.sources.has("SR1")).toBe(false);
    expect(m.allSourceRevisions.get("SR1")).toMatchObject({ title: "Quelle Fassung 1", revision_no: 1 });
    expect(m.sources.get("SR2")!.revision_no).toBe(2);
  });
  it("(3) Herstellerfeld ≠ Importrelation", () => {
    expect(actorsOfEntity(m, "P1").map((x) => [x.actor.name, x.kinds])).toEqual([["Testfirma Alpha GmbH", ["field"]]]);
    expect(actorsOfEntity(m, "P2").map((x) => [x.actor.name, x.kinds])).toEqual([["Testfirma Beta", ["import"]]]);
  });
  it("(4) abgelehntes contains ist keine gültige Zuordnung, bleibt mit Status sichtbar", () => {
    const valid = productsWithSubstance(m, "N1");
    expect(valid.map((x) => [x.product.id, x.kind, x.status])).toEqual([["P2", "import", "needs_clarification"]]);
    expect(rejectedContains(m, "N1")).toEqual([{ product: m.entities.get("P1"), status: "rejected", relationId: "R2" }]);
  });
});
