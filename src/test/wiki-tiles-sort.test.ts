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
    expect((t.match(/sortBy=\{artTitle\}/g) ?? []).length).toBe((t.match(/artLine\(x,/g) ?? []).length);
  });
});
