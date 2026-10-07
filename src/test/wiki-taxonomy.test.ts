import { describe, expect, it } from "vitest";
import { buildWikiModel, matchesAll, neighbours, paginate, foldersOf } from "@/lib/wikiTaxonomy";
import { classifyWikiError, fetchAllPages, wikiErrorText } from "@/lib/wikiFetchAll";

// Synthetic knowledge examples only.
const input = () => ({
  entities: [
    { id: "E1", entity_type_code: "product", current_revision_id: "ER1" },
    { id: "E2", entity_type_code: "pathogen", current_revision_id: "ER2" },
    { id: "E3", entity_type_code: "symptom", current_revision_id: "ER3" },
    { id: "E4", entity_type_code: "disease", current_revision_id: "ER4" },
    { id: "E5", entity_type_code: "manufacturer", current_revision_id: "ER5" },
    { id: "E6", entity_type_code: "plant", current_revision_id: "ERX" },
  ],
  entityRevisions: [
    { id: "ER1", entity_id: "E1", display_name: "Testtropfen", review_status: "draft" },
    { id: "ER2", entity_id: "E2", display_name: "Borrelia testensis", review_status: "draft" },
    { id: "ER3", entity_id: "E3", display_name: "Müdigkeit", review_status: "draft" },
    { id: "ER4", entity_id: "E4", display_name: "Testose", review_status: "draft" },
    { id: "ER5", entity_id: "E5", display_name: "NutraMedix", review_status: "draft" },
  ],
  coreLinks: [
    ...["1", "2", "3", "4", "5"].map((n) => ({ candidate_kind: "entity", candidate_id: `c${n}`, core_record_kind: "entity", core_entity_id: `E${n}`, core_source_revision_id: null })),
    { candidate_kind: "source", candidate_id: "sc1", core_record_kind: "source", core_entity_id: null, core_source_revision_id: "SR1" },
  ],
  relations: [
    { id: "R1", subject_candidate_id: "c1", object_candidate_id: "c2", proposed_relation_type_code: "targets_pathogen", candidate_status: "imported_unreviewed", source_candidate_id: "sc1", source_locator: "S. 4" },
    { id: "R2", subject_candidate_id: "c1", object_candidate_id: "c5", proposed_relation_type_code: "manufactured_by", candidate_status: "imported_unreviewed", source_candidate_id: null, source_locator: null },
    { id: "R3", subject_candidate_id: "c1", object_candidate_id: "c3", proposed_relation_type_code: "indicated_for", candidate_status: "imported_unreviewed", source_candidate_id: null, source_locator: null },
  ],
  articles: [
    { id: "A1", current_revision_id: "AR1b", article_kind: "reference" },
    { id: "A2", current_revision_id: "AR2", article_kind: "reference" },
    { id: "A3", current_revision_id: "AR3", article_kind: "reference" },
    { id: "A4", current_revision_id: "AR9", article_kind: "reference" },
  ],
  articleRevisions: [
    { id: "AR1a", article_id: "A1", revision_no: 1, title: "Alt", category_path: "X", review_status: "draft" },
    { id: "AR1b", article_id: "A1", revision_no: 2, title: "Testtropfen bei Heel-Fragen", category_path: "Naturheilpraxis Peter Rauch > Nutra Medix", review_status: "draft" },
    { id: "AR2", article_id: "A2", revision_no: 1, title: "Wheelchair Hinweis", category_path: "Naturheilpraxis Peter Rauch > Pascoe", review_status: "draft" },
    { id: "AR3", article_id: "A3", revision_no: 1, title: "Allgemeines", category_path: "Ernährung", review_status: "draft" },
  ],
  sources: [{ id: "S1", current_revision_id: "SR1" }],
  sourceRevisions: [{ id: "SR1", source_id: "S1", revision_no: 1, title: "Klinghardt Talk 1", publisher: "Klinghardt Talks 001-025", authors: ["Dr. Dietrich Klinghardt"], review_status: "draft" }],
});

describe("Wiki-Ordnung", () => {
  const m = buildWikiModel(input());
  it("wählt die aktuelle Revision und zählt fehlende ehrlich", () => {
    expect(m.articles.get("A1")!.title).toContain("Testtropfen");
    expect(m.articles.size).toBe(3);
    expect(m.missingRevisions).toEqual({ articles: 1, entities: 1, sources: 0 });
  });
  it("Firmen/Personen: Rollen aus Datenfeldern, Peter-Namen zusammengeführt", () => {
    const n = m.actors.get("nutramedix")!;
    expect([...n.roles].sort()).toEqual(["Hersteller", "Ordner", "Von Peter benannt"]);
    expect(n.folderArticleIds.has("A1")).toBe(true);
    expect(n.entityIds.has("E1")).toBe(true);
    const k = m.actors.get("klinghardt")!;
    expect(k.roles.has("Autor") && k.roles.has("Herausgeber")).toBe(true);
    expect(m.actors.get("pascoe")!.roles.has("Ordner")).toBe(true);
  });
  it("Heel nur als Wort-Treffer, kein 'Wheelchair'; Texttreffer getrennt", () => {
    const h = m.actors.get("heel")!;
    expect([...h.textArticleIds]).toEqual(["A1"]);
    expect(h.folderArticleIds.size).toBe(0);
  });
  it("Beziehungen bidirektional, Gruppen nicht vermischt", () => {
    expect(neighbours(m, "E2").map((x) => x.other!.id)).toEqual(["E1"]);
    const out = neighbours(m, "E1").map((x) => x.other!.group).sort();
    expect(out).toEqual(["other", "pathogens", "symptoms"]);
    expect(m.entities.get("E4")!.group).toBe("diseases");
    expect(m.relations.find((r) => r.id === "R1")!.sourceRevisionId).toBe("SR1");
    expect(m.relations.find((r) => r.id === "R3")!.sourceRevisionId).toBeUndefined();
  });
  it("Unzugeordnetes bleibt sichtbar, Mehrfachzuordnung ohne Duplikate", () => {
    expect(m.unassignedArticleIds).toEqual(["A3"]);
    expect(m.unassignedEntityIds).toEqual(["E4"]);
    expect(new Set([...m.articles.keys()]).size).toBe(m.articles.size);
  });
  it("Mehrwortsuche, Pagination, Ordner", () => {
    expect(matchesAll("Borrelia testensis", "test borr")).toBe(true);
    expect(matchesAll("Müdigkeit", "mudigkeit")).toBe(true);
    expect(matchesAll("Borrelia", "borrelia x")).toBe(false);
    const p = paginate(Array.from({ length: 101 }, (_, i) => i), 3, 50);
    expect(p).toMatchObject({ page: 3, pages: 3, total: 101, items: [100] });
    expect(foldersOf("Naturheilpraxis Peter Rauch > Interne Quellen > Klinghardt Talks 001-025")).toEqual(["Klinghardt Talks 001-025"]);
  });
});

describe("vollständiges Laden und Fehler", () => {
  it("lädt über 1000 Zeilen ohne Abschneiden/Duplikate", async () => {
    const rows = Array.from({ length: 2149 }, (_, i) => ({ id: i }));
    const r = await fetchAllPages(async (f, t) => ({ data: rows.slice(f, t + 1), error: null }));
    expect(r.data!.length).toBe(2149);
    expect(new Set(r.data!.map((x) => (x as { id: number }).id)).size).toBe(2149);
  });
  it("Fehler auf einer späteren Seite wird gemeldet, nicht als Teilbestand", async () => {
    const r = await fetchAllPages(async (f) => (f >= 1000 ? { data: null, error: { message: "x" } } : { data: Array(1000).fill(0), error: null }));
    expect(r.data).toBeNull();
  });
  it("fehlende Tabelle ≠ Berechtigung; keine Rohdetails", () => {
    expect(classifyWikiError('relation "public.kb_x" does not exist')).toBe("missing");
    expect(classifyWikiError("permission denied for table kb_assertions")).toBe("forbidden");
    expect(wikiErrorText("permission denied for table kb_assertions")).not.toContain("kb_assertions");
  });
});
