import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { COMPARISON_CONFIGS, configFor } from "@/lib/infothekComparisonConfigs";

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
describe("Vergleichs-Konfigurationen", () => {
  it("Frequenztherapie bleibt Standard mit unveränderten Vorschlägen", () => {
    expect(configFor(undefined).slug).toBe("krankheit-ist-messbar");
    expect(configFor("krankheit-ist-messbar").changes.length).toBeGreaterThanOrEqual(36);
  });
  it("Kieferostitis: links Basisentwurf, nicht als ausgeliefert bezeichnet", () => {
    const k = configFor("kieferostitis");
    expect(k.base.kind).toBe("baseDraft"); expect(k.leftLabel).toMatch(/Basisentwurf/); expect(k.leftLabel).not.toMatch(/ausgeliefert/);
  });
  for (const c of COMPARISON_CONFIGS.filter((x) => x.slug !== "krankheit-ist-messbar")) {
    it(`${c.slug}: jede Änderung links und rechts auffindbar`, () => {
      const left = c.base.kind === "baseDraft" ? c.base.html : readFileSync(`website-content/infothek${c.base.route}`, "utf8");
      for (const ch of c.changes) {
        if (ch.headOnly) { expect(left).toContain(ch.headOnly.before); expect(c.draftHtml).toContain(ch.headOnly.after); continue; }
        expect(text(left)).toContain(ch.orig); expect(text(c.draftHtml)).toContain(ch.draft);
      }
      expect(new Set(c.changes.map((x) => x.id)).size).toBe(c.changes.length);
    });
  }
  it("Kieferostitis-Entwurf: noindex, Warnzeichen, keine Dosierung, keine Selbstbehandlung", () => {
    const d = configFor("kieferostitis").draftHtml;
    expect(d).toContain('content="noindex, nofollow"'); expect(d).toMatch(/112/); expect(d).not.toMatch(/\d+\s?mg\b/);
    expect(d).toContain("jcda.ca/o6"); expect(d).toContain("PMC3769776"); expect(d).toContain("ciae104.pdf"); expect(d).toContain("odontogene-infektionen-1");
    expect(text(d)).toMatch(/kein Erreger/);
  });
});
