import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { composeWorkingVersion } from "@/lib/infothekComparison";
import { COMPARISON_CONFIGS } from "@/lib/infothekComparisonConfigs";
const norm = (h: string) => (new DOMParser().parseFromString(h, "text/html").body.textContent ?? "").replace(/\s+/g, "");
const SLUGS = ["candida-diaet", "sibo-duenndarmfehlbesiedlung", "muedigkeit-erschoepfung-burnout", "kraeuter-schmerz-entzuendung", "dankbarkeit-alltag", "umwelt-alltag-gesundheit", "fit-gesund-herbst-winter-7-minuten", "fit-gesund-herbst-winter-infothek"];
describe("Vier Vergleiche: keine Übernahme = Original, alle = vollständiger Entwurf", () => {
  for (const slug of SLUGS) it(slug, () => {
    const c = COMPARISON_CONFIGS.find((x) => x.slug === slug)!;
    const o = readFileSync(`website-content/infothek/${slug}.html`, "utf8");
    expect(norm(composeWorkingVersion(o, c.draftHtml, c.changes, new Set()).html)).toBe(norm(o));
    const all = composeWorkingVersion(o, c.draftHtml, c.changes, new Set(c.changes.map((x) => x.id)));
    expect(all.failed).toEqual([]);
    const a = norm(all.html), d = norm(c.draftHtml);
    if (a !== d) { let i = 0; while (a[i] === d[i]) i++; throw new Error(`Abweichung bei ${i}:\nALLE: ${a.slice(i - 60, i + 200)}\nENTW: ${d.slice(i - 60, i + 200)}`); }
  });
});
