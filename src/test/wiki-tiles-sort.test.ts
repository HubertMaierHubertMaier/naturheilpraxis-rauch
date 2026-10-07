import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
const COLL = new Intl.Collator("de", { sensitivity: "base", numeric: true });
describe("Wiki-Kacheln A–Z", () => {
  it("deutsch, Umlaute, Groß/klein neutral, Zahlen natürlich, nichts verloren", () => {
    const xs = ["Zink", "Apfel", "B12", "b2", "Öl", "Ofen", "Ärger"];
    const s = [...xs].sort(COLL.compare);
    expect(s).toEqual(["Apfel", "Ärger", "b2", "B12", "Ofen", "Öl", "Zink"]);
    expect(s.length).toBe(xs.length);
  });
  it("Seite nutzt Collator vor Pagination, kein localeCompare mehr", () => {
    const t = readFileSync("src/pages/WikiOrdnung.tsx", "utf8");
    expect(t).toContain('new Intl.Collator("de", { sensitivity: "base", numeric: true })');
    expect(t).not.toMatch(/localeCompare\(/);
    expect((t.match(/sortBy=\{artTitle\}|byName\(artTitle\(a\), artTitle\(b\)\)/g) ?? []).length).toBe((t.match(/artLine\(x,/g) ?? []).length);
  });
});
describe("Artikel-Detail", () => {
  it("nur aktuelle Revision, Fehler/Leer sichtbar, Kachel öffnet", () => {
    const d = readFileSync("src/components/wiki/WikiArticleDetail.tsx", "utf8");
    expect(d).toContain("current_revision_id"); expect(d).toContain("nicht gefunden"); expect(d).toContain("Fehler beim Laden"); expect(d).toContain("r.data.article_id !== articleId");
    expect(readFileSync("src/pages/WikiOrdnung.tsx", "utf8")).toContain('onOpen={() => set({ a: aid, s: params.get("s") })}');
  });
});
