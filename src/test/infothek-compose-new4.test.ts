import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { composeWorkingVersion, findChangeTarget } from "@/lib/infothekComparison";
import { COMPARISON_CONFIGS } from "@/lib/infothekComparisonConfigs";

const SLUGS = ["candida-diaet", "sibo-duenndarmfehlbesiedlung", "muedigkeit-erschoepfung-burnout", "kraeuter-schmerz-entzuendung", "ass-salicylat-histamin", "diabetes-handout", "ersttermin-naturheilpraxis", "therapieweg-uebersicht"];
const cfg = (s: string) => COMPARISON_CONFIGS.find((x) => x.slug === s)!;
const orig = (s: string) => readFileSync(`website-content/infothek/${s}.html`, "utf8");

describe("Snippets sind Klartext (textContent), keine HTML-Entities", () => {
  for (const c of COMPARISON_CONFIGS) it(c.slug, () => {
    c.changes.forEach((ch) => { expect(ch.orig ?? "").not.toMatch(/&[a-z#0-9]+;/i); expect(ch.draft ?? "").not.toMatch(/&[a-z#0-9]+;/i); });
  });
});

describe("Therapieweg Ä3: Einzelübernahme und Sprungziele", () => {
  it("beide Marker gefunden, Übernahme ohne Fehler", () => {
    const c = cfg("therapieweg-uebersicht"); const ch = c.changes.find((x) => x.id === 3)!;
    const p = new DOMParser();
    expect(findChangeTarget(p.parseFromString(orig(c.slug), "text/html"), ch, "orig")).toBeTruthy();
    expect(findChangeTarget(p.parseFromString(c.draftHtml, "text/html"), ch, "draft")).toBeTruthy();
    const r = composeWorkingVersion(orig(c.slug), c.draftHtml, c.changes, new Set([3]));
    expect(r.failed).toEqual([]);
    expect(r.html).toContain("Analyse: Trikombin");
  });
});

describe("Vier neue Vergleiche: Einzel, Paare, alle; bei ≤8 alle Kombinationen", () => {
  for (const slug of SLUGS) it(slug, () => {
    const c = cfg(slug); const o = orig(slug); const ids = c.changes.map((x) => x.id);
    const sets: number[][] = [];
    if (ids.length <= 8) for (let m = 1; m < 1 << ids.length; m++) sets.push(ids.filter((_, i) => m & (1 << i)));
    else { ids.forEach((a, i) => { sets.push([a]); ids.slice(i + 1).forEach((b) => sets.push([a, b])); }); sets.push(ids); }
    for (const s of sets) expect({ s, f: composeWorkingVersion(o, c.draftHtml, c.changes, new Set(s)).failed }).toEqual({ s, f: [] });
  }, 120000);
});
