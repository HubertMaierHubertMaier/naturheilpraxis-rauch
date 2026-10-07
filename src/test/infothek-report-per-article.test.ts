import { describe, expect, it } from "vitest";
import { buildProgressReport, EXTRA_CHECKS } from "@/lib/infothekDecisions";
import { COMPARISON_CONFIGS } from "@/lib/infothekComparisonConfigs";
const d = { accepted: new Set<number>(), kept: new Set<number>(), savedAt: null } as never;
describe("Fortschrittsbericht artikelbezogen", () => {
  it("Allergie/Kieferostitis ohne Frequenztherapie-Titel und -Restnotizen", () => {
    for (const slug of ["allergiebehandlung", "kieferostitis"]) {
      const c = COMPARISON_CONFIGS.find((x) => x.slug === slug)!;
      const r = buildProgressReport({ changes: c.changes, topics: c.topics, d, storageKey: "k", title: c.reportTitle, extraChecks: c.extraChecks });
      expect(r).not.toContain("Krankheit ist messbar");
      expect(r).not.toContain("Muheim");
      expect(r).toContain(`# Fortschrittsbericht – ${c.reportTitle}`);
    }
  });
  it("Frequenztherapie behält ihre Restnotizen", () => {
    const c = COMPARISON_CONFIGS.find((x) => x.slug === "krankheit-ist-messbar")!;
    expect(c.extraChecks).toBe(EXTRA_CHECKS);
  });
});
