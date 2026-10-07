import { describe, expect, it } from "vitest";
import { KRANKHEIT_IST_MESSBAR_CHANGES as C, CHANGE_TOPICS } from "@/lib/infothekComparisonChanges";
import { buildProgressReport, isOptionalAlternative, parseDecisions, serializeDecisions, undecided } from "@/lib/infothekDecisions";
import { nextOpenChange } from "@/lib/infothekComparison";
const ids = C.map((c) => c.id);
describe("Entscheidungen (isolierter Testzustand)", () => {
  it("altes Format ohne kept bleibt lesbar", () => {
    const d = parseDecisions(JSON.stringify({ accepted: [1, 17], savedAt: "x" }), ids);
    expect([...d.accepted]).toEqual([1, 17]); expect(d.kept.size).toBe(0);
  });
  it("Original beibehalten zählt nicht als übernommen, ist aber entschieden", () => {
    const d = parseDecisions(serializeDecisions({ accepted: new Set([1]), kept: new Set([2]) }), ids);
    expect(d.accepted.size).toBe(1);
    expect(undecided(C, d).some((c) => c.id === 2)).toBe(false);
    expect(nextOpenChange(ids, new Set([...d.accepted, ...d.kept]), 1)).toBe(3);
  });
  it("Ä33 ist optionale Alternative, wenn Ä17 übernommen", () => {
    const d = parseDecisions(JSON.stringify({ accepted: [17] }), ids);
    expect(isOptionalAlternative(C.find((c) => c.id === 33)!, d)).toBe(true);
  });
  it("Bericht nennt Speicherort, Stand und Zusätzlich zu prüfen", () => {
    const d = parseDecisions(JSON.stringify({ accepted: [1], kept: [2] }), ids);
    const r = buildProgressReport({ changes: C, topics: CHANGE_TOPICS, d, storageKey: "k:test", sectionOf: new Map() });
    expect(r).toContain("`k:test`"); expect(r).toContain("Original beibehalten"); expect(r).toContain("Zusätzlich zu prüfen");
    expect(r).toContain(`1 übernommen, 1 Original beibehalten, ${C.length - 2} noch zu entscheiden`);
  });
});
