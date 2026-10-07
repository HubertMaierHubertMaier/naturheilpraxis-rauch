import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { articleSections } from "@/lib/infothekFundstelle";
import { findChangeTarget } from "@/lib/infothekComparison";
import { COMPARISON_CONFIGS } from "@/lib/infothekComparisonConfigs";
const P = new DOMParser();
describe("articleSections", () => {
  it("Reveal: nur Folien", () => {
    const d = P.parseFromString('<div class="reveal"><div class="slides"><section>a<section>x</section></section><section>b</section></div></div>', "text/html");
    expect(articleSections(d).length).toBe(2);
  });
  it("normales HTML: oberste section-Elemente, keine verschachtelten, keine erfundenen", () => {
    const d = P.parseFromString("<main><section>a<section>a1</section></section><section>b</section></main><footer>f</footer>", "text/html");
    expect(articleSections(d).map((s) => s.firstChild?.textContent)).toEqual(["a", "b"]);
    expect(articleSections(P.parseFromString("<p>ohne</p>", "text/html")).length).toBe(0);
  });
});
describe("Jeder Textvorschlag liegt in einem echten Abschnitt (Original und Entwurf)", () => {
  for (const c of COMPARISON_CONFIGS) it(c.slug, () => {
    const o = P.parseFromString(c.base.kind === "baseDraft" ? c.base.html : readFileSync(`website-content/infothek/${c.slug}.html`, "utf8"), "text/html");
    const d = P.parseFromString(c.draftHtml, "text/html");
    const so = articleSections(o), sd = articleSections(d);
    expect(so.length).toBe(sd.length);
    for (const ch of c.changes) {
      if (ch.headOnly || !ch.orig) continue;
      const to = findChangeTarget(o, ch, "orig"), td = findChangeTarget(d, ch, "draft");
      const io = so.findIndex((s) => to && s.contains(to)), id = sd.findIndex((s) => td && s.contains(td));
      expect({ id: ch.id, io: io >= 0, same: io === id }).toEqual({ id: ch.id, io: true, same: true });
    }
  });
});
