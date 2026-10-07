import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
const COLL = new Intl.Collator("de", { sensitivity: "base", numeric: true });
describe("Wiki-Kacheln A–Z", () => {
  it("deutsch, Umlaute, Groß/klein neutral, Zahlen natürlich, nichts verloren", () => {
    const xs = ["Zink", "äpfel", "Apfel", "B12", "B2", "Öl", "ober"];
    const s = [...xs].sort(COLL.compare);
    expect(s).toEqual(["Apfel", "äpfel", "B2", "B12", "ober", "Öl", "Zink"]);
    expect(s.length).toBe(xs.length);
  });
  it("Seite nutzt Collator vor Pagination, kein localeCompare mehr", () => {
    const t = readFileSync("src/pages/WikiOrdnung.tsx", "utf8");
    expect(t).toContain('new Intl.Collator("de", { sensitivity: "base", numeric: true })');
    expect(t).not.toMatch(/localeCompare\(/);
    expect((t.match(/sortBy=\{artTitle\}/g) ?? []).length).toBe((t.match(/artLine\(x,/g) ?? []).length);
  });
});
