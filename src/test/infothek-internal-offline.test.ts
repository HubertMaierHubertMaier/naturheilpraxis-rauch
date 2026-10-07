import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { composeWorkingVersion } from "@/lib/infothekComparison";
import { editorialWithRegistry } from "@/lib/infothekEditorialStatus";
import { COMPARISON_CONFIGS } from "@/lib/infothekComparisonConfigs";

const INTERNAL = ["fit-gesund-herbst-winter-7-minuten", "fit-gesund-herbst-winter-infothek"];
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const SRC = walk("src").filter((f) => /\.(ts|tsx|js|jsx)$/.test(f) && !/[\\/]test[\\/]/.test(f));
const offline = JSON.parse(readFileSync("docs/infothek-offline/herbst-winter-vergleich.json", "utf8"));

describe("Interne Herbst/Winter-HTMLs nicht im Browser-Code", () => {
  it("keine Imports der internen Dateien im Client-Quellcode", () => {
    for (const f of SRC) for (const slug of INTERNAL) expect({ f, hit: readFileSync(f, "utf8").includes(slug + ".html?raw") || readFileSync(f, "utf8").includes(slug + ".entwurf.html") }).toEqual({ f, hit: false });
  });
  it("keine charakteristischen internen Passagen im Client-Quellcode", () => {
    const marks = ["Notfall – sofort 112", "wählen Sie sofort den Notruf 112", "Wichtig ist mir eine ehrliche Einordnung", "Nackensteife, ungewöhnlicher Ausschlag oder starke Lichtscheu"];
    for (const f of SRC) { const t = readFileSync(f, "utf8"); for (const m of marks) expect({ f, m, hit: t.includes(m) }).toEqual({ f, m, hit: false }); }
  });
  it("nicht als online bedienbarer Vergleich gezählt, Status ehrlich offline", () => {
    for (const s of INTERNAL) expect(COMPARISON_CONFIGS.some((c) => c.slug === s)).toBe(false);
    const e = editorialWithRegistry(COMPARISON_CONFIGS);
    for (const s of INTERNAL) { const x = e.find((y) => y.file === `${s}.html`)!; expect(x.comparePath).toBeUndefined(); expect([x.visibility, x.reviewStatus, x.indexable]).toEqual(["internal", "pending", false]); expect(x.openTopics[0]).toMatch(/Offline-Vorbereitung/); }
  });
  it("Edge-Gate get-infothek-html prüft weiterhin Auth/Admin", () => {
    const t = readFileSync("supabase/functions/get-infothek-html/index.ts", "utf8");
    expect(t).toMatch(/getUser|auth/i); expect(t).toMatch(/admin/i);
  });
});

describe("Offline-Vorbereitung: Inhalte und Vorschläge vollständig erhalten", () => {
  const norm = (h: string) => (new DOMParser().parseFromString(h, "text/html").body.textContent ?? "").replace(/\s+/g, "");
  for (const s of INTERNAL) it(s, () => {
    const o = readFileSync(`website-content/infothek/${s}.html`, "utf8");
    const d = readFileSync(`website-content/infothek/drafts/${s}.entwurf.html`, "utf8");
    const ch = offline[s]; expect(ch.length).toBeGreaterThan(0);
    expect(norm(composeWorkingVersion(o, d, ch, new Set()).html)).toBe(norm(o));
    const ids: number[] = ch.map((x: any) => x.id);
    for (let m = 1; m < 1 << ids.length; m++) { const r = composeWorkingVersion(o, d, ch, new Set(ids.filter((_, i) => m & (1 << i)))); expect(r.failed).toEqual([]); expect(r.conflicts).toEqual([]); }
    expect(norm(composeWorkingVersion(o, d, ch, new Set(ids)).html)).toBe(norm(d));
    expect(d).toMatch(/noindex, nofollow/);
  });
});
