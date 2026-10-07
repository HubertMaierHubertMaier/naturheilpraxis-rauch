import { describe, expect, it } from "vitest";
import { assembleEvidence, loadArticleEvidence } from "@/lib/wikiAssertionSources";

// Synthetic knowledge examples only – no patient data.
const tables: Record<string, Record<string, unknown>[]> = {
  kb_import_core_links: [
    { candidate_kind: "entity", candidate_id: "eA", core_record_kind: "article", core_article_id: "artA", core_assertion_id: null },
    { candidate_kind: "entity", candidate_id: "eB", core_record_kind: "article", core_article_id: "artB", core_assertion_id: null },
    { candidate_kind: "dosage", candidate_id: "dA", core_record_kind: "assertion", core_article_id: null, core_assertion_id: "asA" },
    { candidate_kind: "safety", candidate_id: "sB", core_record_kind: "assertion", core_article_id: null, core_assertion_id: "asB" },
    { candidate_kind: "safety", candidate_id: "sA2", core_record_kind: "assertion", core_article_id: null, core_assertion_id: "asA2" },
  ],
  kb_dosage_candidates: [{ id: "dA", subject_candidate_id: "eA" }],
  kb_safety_candidates: [{ id: "sB", subject_candidate_id: "eB" }, { id: "sA2", subject_candidate_id: "eA" }],
  kb_relation_candidates: [],
  kb_assertions: [
    { id: "asA", version_no: 1, assertion_kind: "dosage", claim_text: "Beispielkraut: Teeaufguss", review_status: "draft" },
    { id: "asA2", version_no: 2, assertion_kind: "safety", claim_text: "Beispielkraut: Vorsicht bei X", review_status: "draft" },
    { id: "asB", version_no: 1, assertion_kind: "safety", claim_text: "Testmineral: Hinweis", review_status: "draft" },
  ],
  kb_assertion_sources: [
    { assertion_id: "asA", source_revision_id: "srcR1", source_role: "mentions", locator: "S. 3", original_quote: null, is_primary: true },
    { assertion_id: "asB", source_revision_id: "srcR2", source_role: "mentions", locator: null, original_quote: null, is_primary: false },
  ],
  kb_source_revisions: [
    { id: "srcR1", revision_no: 1, title: "Lehrbuch A", source_type: "book", publisher: null, review_status: "draft", rights_status: null },
    { id: "srcR2", revision_no: 1, title: "Lehrbuch B", source_type: "book", publisher: null, review_status: "draft", rights_status: null },
  ],
};

function fakeDb(broken?: string) {
  return {
    from(t: string) {
      let rows = [...(tables[t] ?? [])];
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => { rows = rows.filter((r) => r[c] === v); return q; },
        in: (c: string, v: unknown[]) => { rows = rows.filter((r) => v.includes(r[c])); return q; },
        then: (ok: (r: unknown) => void) => ok(t === broken ? { data: null, error: { message: `relation "public.${t}" does not exist` } } : { data: rows, error: null }),
      };
      return q;
    },
  };
}

describe("Quellenbelege je Aussage", () => {
  it("ordnet Belege nur über echte Verknüpfungen zu – kein Querzuordnen", async () => {
    const r = await loadArticleEvidence(fakeDb(), "artA");
    expect(r.state).toBe("ok");
    if (r.state !== "ok") return;
    expect(r.items.map((i) => i.assertion.id).sort()).toEqual(["asA", "asA2"]);
    const a = r.items.find((i) => i.assertion.id === "asA")!;
    expect(a.sources.map((s) => s.revision?.title)).toEqual(["Lehrbuch A"]);
    // Assertion without source stays visibly sourceless.
    expect(r.items.find((i) => i.assertion.id === "asA2")!.sources).toEqual([]);
    expect(JSON.stringify(r)).not.toContain("Lehrbuch B");
  });
  it("Artikel ohne Importverknüpfung meldet ehrlich 'keine Belege'", async () => {
    expect(await loadArticleEvidence(fakeDb(), "altArtikel")).toEqual({ state: "none", reason: "no-core-link" });
  });
  it("fehlende Tabelle → 'noch nicht verfügbar', anderer Fehler bleibt sichtbar", async () => {
    expect((await loadArticleEvidence(fakeDb("kb_assertion_sources"), "artA")).state).toBe("unavailable");
  });
  it("Revision fehlt → Quelle bleibt ohne erfundenen Ersatz", () => {
    const out = assembleEvidence(["x"], [{ id: "x", version_no: 1, assertion_kind: "k", claim_text: "c", review_status: "draft" }],
      [{ assertion_id: "x", source_revision_id: "gone", source_role: "mentions", locator: null, original_quote: null, is_primary: false }], []);
    expect(out[0].sources[0].revision).toBeUndefined();
  });
});
