import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { composeWorkingVersion } from "@/lib/infothekComparison";
import { COMPARISON_CONFIGS } from "@/lib/infothekComparisonConfigs";

const origOf = (c: (typeof COMPARISON_CONFIGS)[number]) => c.base.kind === "baseDraft" ? c.base.html : readFileSync(`website-content/infothek/${c.slug}.html`, "utf8");
const cell = (html: string) => new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";

describe("SIBO Ä6/Ä4 unabhängig", () => {
  const c = COMPARISON_CONFIGS.find((x) => x.slug === "sibo-duenndarmfehlbesiedlung")!; const o = origOf(c);
  const run = (ids: number[]) => composeWorkingVersion(o, c.draftHtml, c.changes, new Set(ids));
  it("nur 6: neue Überschrift, Original-Ä4 bleibt", () => {
    const r = run([6]); const t = cell(r.html);
    expect(r.failed).toEqual([]); expect(t).toContain("Methan-Profil (IMO)"); expect(t).not.toContain("Methan-SIBO");
    expect(t).toContain("heute oft als IMO bezeichnet"); expect(t).not.toContain("intestinale Methanogen-Ueberwucherung");
  });
  it("nur 4: neue Unterzeile, Original-Überschrift bleibt", () => {
    const t = cell(run([4]).html);
    expect(t).toContain("Methan-SIBO"); expect(t).toContain("intestinale Methanogen-Ueberwucherung"); expect(t).not.toContain("heute oft als IMO bezeichnet");
  });
  it("4+6: beides neu", () => {
    const t = cell(run([4, 6]).html);
    expect(t).toContain("Methan-Profil (IMO)"); expect(t).toContain("intestinale Methanogen-Ueberwucherung");
  });
});

describe("Keine stille Mitübernahme: Einzelübernahme ohne Konflikt in allen Vergleichen", () => {
  for (const c of COMPARISON_CONFIGS) it(c.slug, () => {
    const o = origOf(c);
    for (const ch of c.changes) {
      const r = composeWorkingVersion(o, c.draftHtml, c.changes, new Set([ch.id]));
      expect({ id: ch.id, k: r.conflicts }).toEqual({ id: ch.id, k: [] });
    }
  }, 120000);
});

describe("Supersedes KIM getrennt geschützt", () => {
  const c = COMPARISON_CONFIGS.find((x) => x.slug === "krankheit-ist-messbar")!; const o = origOf(c);
  for (const [neu, alt] of [[33, 17], [35, 8], [36, 5]]) it(`${neu}→${alt}`, () => {
    expect(c.changes.find((x) => x.id === neu)?.supersedes).toBe(alt);
    const a = composeWorkingVersion(o, c.draftHtml, c.changes, new Set([alt]));
    expect(a.failed).toEqual([]); expect(a.conflicts).toEqual([]);
    const b = composeWorkingVersion(o, c.draftHtml, c.changes, new Set([alt, neu]));
    expect(b.failed).toEqual([]); expect(b.conflicts).toEqual([]);
  });
});
