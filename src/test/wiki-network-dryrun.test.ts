import { describe, it, expect } from "vitest";
import { buildDryRun, matchKey, looksLikePerson } from "@/lib/wikiNetworkDryRun";
import { buildWikiModel } from "@/lib/wikiTaxonomy";

const model = () => buildWikiModel({
  entities: [
    { id: "p1", entity_type_code: "product_variant", current_revision_id: "r1" },
    { id: "p2", entity_type_code: "product_variant", current_revision_id: "r2" },
    { id: "m1", entity_type_code: "manufacturer", current_revision_id: "r3" },
  ],
  entityRevisions: [
    { id: "r1", entity_id: "p1", display_name: "Alpha Kapseln", review_status: "draft", manufacturer: "Testfirma Alpha GmbH & Co. KG" },
    { id: "r2", entity_id: "p2", display_name: "Alpha Pulver", review_status: "draft", manufacturer: "Testfirma Alpha GmbH & Co. KG" },
    { id: "r3", entity_id: "m1", display_name: "Beta-Apotheke", review_status: "draft" },
  ],
  coreLinks: [], relations: [], articles: [], articleRevisions: [],
  sources: [{ id: "s1", current_revision_id: "sr1" }, { id: "s2", current_revision_id: "sr2" }],
  sourceRevisions: [
    { id: "sr1", source_id: "s1", revision_no: 1, title: "Q1", publisher: "Testfirma Alpha", authors: ["Dr. Test Person"], review_status: "draft" },
    { id: "sr2", source_id: "s2", revision_no: 1, title: "Q2", publisher: "Interne Quellen- und Sicherheitsrecherche", authors: [], review_status: "draft" },
  ],
});

describe("Vernetzung Probelauf", () => {
  it("leitet Akteure nur aus Datenfeldern ab, ein Akteur für mehrere Produkte", () => {
    const d = buildDryRun(model());
    const alpha = d.actors.filter((a) => a.display_name === "Testfirma Alpha GmbH & Co. KG");
    expect(alpha).toHaveLength(1);
    expect(d.relations.filter((r) => r.relation_type_code === "manufactured_by")).toHaveLength(2);
    expect(d.relations.every((r) => r.review_status === "candidate")).toBe(true);
  });
  it("interne Herkunftsangaben sind keine Akteure", () => {
    expect(buildDryRun(model()).actors.some((a) => /Interne/.test(a.display_name))).toBe(false);
  });
  it("Firmenzusatz nur im Abgleich → Merge-Hinweis, kein Auto-Merge", () => {
    const d = buildDryRun(model());
    expect(matchKey("Testfirma Alpha GmbH & Co. KG")).toBe(matchKey("Testfirma Alpha"));
    expect(d.merge_hints.length).toBe(1);
    expect(d.actors.filter((a) => a.normalized_match_key === "testfirma alpha")).toHaveLength(2);
  });
  it("Person ≠ Organisation", () => {
    expect(looksLikePerson("Dr. Test Person")).toBe(true);
    expect(looksLikePerson("Testfirma Alpha")).toBe(false);
    expect(buildDryRun(model()).actors.find((a) => a.display_name === "Dr. Test Person")?.proposed_entity_type_code).toBe("person");
  });
});
