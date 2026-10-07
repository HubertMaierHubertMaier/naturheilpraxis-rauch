import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { progressProjection } from "@/lib/infothekDecisions";
import { composeWorkingVersion, findChangeTarget } from "@/lib/infothekComparison";
import { COMPARISON_CONFIGS } from "@/lib/infothekComparisonConfigs";
import type { ComparisonChange } from "@/lib/infothekComparisonChanges";
const C = [{ id: 1, note: "a", why: "", reason: [] }, { id: 2, note: "b", why: "", reason: [] }, { id: 3, supersedes: 1, note: "alt", why: "", reason: [] }, { id: 4, note: "c", why: "", reason: [] }] as ComparisonChange[];
const D = (a: number[], k: number[] = []) => ({ accepted: new Set(a), kept: new Set(k), savedAt: null }) as never;
describe("Fortschritts-Projektion", () => {
  it("angenommene Alternative ersetzt Vorgänger, zählt nicht doppelt", () => {
    const p = progressProjection(C, D([1, 3]));
    expect(p.accepted).toEqual([3]); expect(p.replaced).toEqual([1]); expect(p.open).toEqual([2, 4]);
  });
  it("Alternative rückgängig → Vorgänger wieder übernommen", () => {
    const p = progressProjection(C, D([1]));
    expect(p.accepted).toEqual([1]); expect(p.replaced).toEqual([]); expect(p.optionalOpen).toEqual([3]);
  });
  it("kept getrennt, unbekannte gespeicherte IDs gemeldet, nichts verändert", () => {
    const d = D([2, 99], [4]); const p = progressProjection(C, d);
    expect(p.kept).toEqual([4]); expect(p.unknownStored).toEqual([99]); expect([...(d as any).accepted]).toEqual([2, 99]);
  });
  it("Kompositionsfehler zählt nicht als angewandt", () => {
    const p = progressProjection(C, D([2, 4]), [4]);
    expect(p.applied).toEqual([2]); expect(p.appliedFailed).toEqual([4]);
  });
  it("Artikelwechsel: Projektion je Artikel unabhängig", () => {
    const [a, b] = ["allergiebehandlung", "kieferostitis"].map((s) => COMPARISON_CONFIGS.find((x) => x.slug === s)!);
    expect(progressProjection(a.changes, D([3, 6, 7, 8])).accepted).toEqual([3, 6, 7, 8]);
    expect(progressProjection(b.changes, D([3, 6, 7, 8])).total).toBe(b.changes.length);
  });
  it("reale Sprungziele inkl. Hinweis-Kästchen; headOnly ohne Textziel", () => {
    const a = COMPARISON_CONFIGS.find((x) => x.slug === "allergiebehandlung")!;
    const p = new DOMParser();
    const o = p.parseFromString(readFileSync("website-content/infothek/allergiebehandlung.html", "utf8"), "text/html");
    const d = p.parseFromString(a.draftHtml, "text/html");
    for (const c of a.changes) {
      if (c.headOnly) { expect(findChangeTarget(o, c, "orig")).toBeUndefined(); continue; }
      expect(findChangeTarget(o, c, "orig"), `orig Ä${c.id}`).toBeTruthy();
      expect(findChangeTarget(d, c, "draft"), `draft Ä${c.id}`).toBeTruthy();
    }
    expect(findChangeTarget(o, a.changes.find((c) => c.id === 4)!, "orig")!.classList.contains("note-box")).toBe(true);
    expect(composeWorkingVersion(o.documentElement.outerHTML, a.draftHtml, a.changes, new Set([3, 6, 7, 8])).failed).toEqual([]);
  });
});
