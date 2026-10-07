import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";
import { articleSections } from "@/lib/infothekFundstelle";
import { COMPARISON_CONFIGS } from "@/lib/infothekComparisonConfigs";

const B = "website-content/infothek/";
const text = (h: string) => new JSDOM(h).window.document.body.textContent!.replace(/\s+/g, " ");

describe("letzte drei HTMLs", () => {
  it("Vieva: 12 Folien als Abschnitte, gleich in Original und Entwurf", () => {
    for (const f of [B + "vieva-pro-vitalanalyse.html", B + "drafts/vieva-pro-vitalanalyse.entwurf.html"])
      expect(articleSections(new JSDOM(readFileSync(f, "utf8")).window.document).length).toBe(12);
  });
  it("Vieva/Zapper online registriert; jeder Vorschlag orig im Original, draft im Entwurf", () => {
    for (const slug of ["vieva-pro-vitalanalyse", "zapper-diamond-shield"]) {
      const c = COMPARISON_CONFIGS.find((x) => x.slug === slug)!;
      const o = text(readFileSync(B + slug + ".html", "utf8")), d = text(c.draftHtml);
      for (const ch of c.changes) { expect(o).toContain(ch.orig); expect(d).toContain(ch.draft); expect(d).not.toContain(ch.orig === "Knochendichte" ? "\u0000" : ch.orig); }
    }
  });
  it("Wasser nur offline, alle Vorschläge im Entwurf angewandt", () => {
    expect(COMPARISON_CONFIGS.some((c) => c.slug.includes("hochohmig"))).toBe(false);
    const j = JSON.parse(readFileSync("docs/infothek-offline/hochohmiges-wasser-vergleich.json", "utf8"));
    const o = readFileSync(j.original, "utf8"), d = readFileSync(j.entwurf, "utf8");
    for (const v of j.vorschlaege) { expect(o).toContain(v.orig); expect(d).toContain(v.draft); expect(d).not.toContain(v.orig); expect(v.status).toBe("offen"); }
    const walk = (p: string): string[] => readdirSync(p).flatMap((n) => statSync(join(p, n)).isDirectory() ? walk(join(p, n)) : [join(p, n)]);
    for (const f of walk("src").filter((f) => !/[\\/]test[\\/]/.test(f))) expect({ f, hit: readFileSync(f, "utf8").includes("hochohmiges-wasser.entwurf") }).toEqual({ f, hit: false });
  });
  it("Gesamtzahl: 19 online", () => expect(COMPARISON_CONFIGS.length).toBe(19));
});
