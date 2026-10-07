import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { composeWorkingVersion } from "@/lib/infothekComparison";
import { COMPARISON_CONFIGS } from "@/lib/infothekComparisonConfigs";
describe("Alle Vorschläge sind in beiden HTMLs auffindbar", () => {
  for (const slug of ["allergiebehandlung", "kieferostitis"]) {
    it(slug, () => {
      const c = COMPARISON_CONFIGS.find((x) => x.slug === slug)!;
      const orig = c.base.kind === "baseDraft" ? c.base.html : readFileSync(`website-content/infothek/${slug}.html`, "utf8");
      const r = composeWorkingVersion(orig, c.draftHtml, c.changes, new Set(c.changes.map((x) => x.id)));
      expect(r.failed).toEqual([]);
      expect(r.html).not.toMatch(/abgestimmt auf Ihre (bisherige ärztliche|laufende) Behandlung/);
    });
  }
});
