import { describe, expect, it } from "vitest";
import { buildProgressReport, progressProjection } from "@/lib/infothekDecisions";
import type { ComparisonChange } from "@/lib/infothekComparisonChanges";
const C = [{ id: 1, note: "a", why: "", reason: [] }, { id: 2, note: "b", why: "", reason: [] }, { id: 3, supersedes: 1, note: "alt", why: "", reason: [] }, { id: 4, note: "c", why: "", reason: [] }] as ComparisonChange[];
const d = { accepted: new Set([1, 3, 4]), kept: new Set([2]), savedAt: null } as never;

describe("Bericht und Anzeige aus derselben Projektion", () => {
  it("Alternative angenommen + kept + Kompositionsfehler", () => {
    const p = progressProjection(C, d, [4]);
    expect(p.accepted).toEqual([3, 4]); expect(p.kept).toEqual([2]); expect(p.replaced).toEqual([1]);
    expect(p.applied).toEqual([3]); expect(p.appliedFailed).toEqual([4]);
    const md = buildProgressReport({ changes: C, topics: {}, d, storageKey: "k", failed: [4] });
    expect(md).toContain(`${p.accepted.length} übernommen (davon ${p.applied.length} angewandt, nicht anwendbar: Ä4), ${p.kept.length} Original beibehalten, ${p.replaced.length} ersetzt, ${p.open.length} noch zu entscheiden (von 4)`);
    expect(md).toContain("Vorschlag 1 – a: **ersetzt durch Vorschlag 3**");
    expect(md).toContain("Vorschlag 4 – c: **übernommen, aber nicht anwendbar**");
    expect((d as any).accepted.has(1)).toBe(true); // stored decision untouched
  });
});
