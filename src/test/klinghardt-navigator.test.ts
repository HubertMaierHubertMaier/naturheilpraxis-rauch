import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { toCard, filterCards, axesOf, overlapMatrix, independentEpisodes, reconcile, CHAPTERS, CHAPTER_EXPECTED, COMPENDIUM, episodeGroup, type RawCard } from "@/lib/klinghardtNavigator";

const file = JSON.parse(readFileSync("docs/klinghardt-talks-001-025-import-batch.json", "utf8"));
const raw: RawCard[] = file.source_candidates.map((c: any, i: number) => ({ id: `r${i}`, revision_no: 1, title: c.title, key: c.candidate_key, locator: c.source_locator, tags: c.proposed_data.tags, topics: c.proposed_data.therapeutic_topics, content: c.proposed_data.content ?? c.original_excerpt }));
const cards = raw.map(toCard);

describe("Klinghardt-Navigator (Importdatei)", () => {
  it("62 Karten, Kapitelzahlen wie im Kompendium", () => {
    expect(cards).toHaveLength(62);
    for (const ch of CHAPTERS) expect(filterCards(cards, { chapter: ch }).length).toBe(CHAPTER_EXPECTED[ch]);
  });
  it("Hashbelege der Importdatei = Kompendium", () => {
    const s = JSON.stringify(file).toLowerCase();
    expect(s).toContain(COMPENDIUM.pdfSha256); expect(s).toContain(COMPENDIUM.docxSha256);
  });
  it("jede Karte hat Folge, Zeitmarke/E-ID und getrennte Abschnitte", () => {
    for (const c of cards) { expect(c.episodes.length).toBeGreaterThan(0); expect(c.eIds.length).toBeGreaterThan(0); expect(c.claim).not.toBe(""); expect(c.claim).not.toContain("## "); }
  });
  it("Suchachsen kombinierbar (UND)", () => {
    const v = filterCards(cards, { axes: ["viren"] }); const vb = filterCards(cards, { axes: ["viren", "bakterien"] });
    expect(vb.length).toBeLessThanOrEqual(v.length); expect(vb.every((c) => axesOf(c).includes("bakterien"))).toBe(true);
    expect(overlapMatrix(cards).viren.viren).toBe(v.length);
  });
  it("Sprachpaare zählen als eine unabhängige Folge", () => {
    expect(episodeGroup("011")).toBe("010/011");
    const two = [toCard({ ...raw[0], tags: ["Folge 018"], locator: "Folge 018 1:00 E018-001" }), toCard({ ...raw[0], tags: ["Folge 019"], locator: "Folge 019 1:00 E019-001" })];
    expect(independentEpisodes(two)).toBe(1);
  });
  it("Abgleich meldet fehlende/zusätzliche Karten exakt", () => {
    expect(reconcile(["a", "b", "b"], ["b", "c"])).toEqual({ onlyInDb: ["a"], onlyInFile: ["c"], both: 1, duplicatesInDb: 1 });
  });
});
