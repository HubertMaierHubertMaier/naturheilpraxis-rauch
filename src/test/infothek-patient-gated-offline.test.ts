import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { COMPARISON_CONFIGS, OFFLINE_COMPARISONS } from "@/lib/infothekComparisonConfigs";

const GATED = ["allergiebehandlung", "candida-diaet", "sibo-duenndarmfehlbesiedlung", "kraeuter-schmerz-entzuendung", "dankbarkeit-alltag", "patienteninfo-hochohmiges-wasser"];
const walk = (p: string): string[] => readdirSync(p).flatMap((n) => statSync(join(p, n)).isDirectory() ? walk(join(p, n)) : [join(p, n)]);
const SRC = walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && !/[\\/]test[\\/]/.test(f));

describe("patientengeschützte Vergleiche offline", () => {
  it("kein Online-Config, nur neutrale Metadaten", () => {
    for (const s of GATED) { expect(COMPARISON_CONFIGS.some((c) => c.slug === s)).toBe(false); expect(OFFLINE_COMPARISONS.some((o) => o.slug === s)).toBe(true); }
  });
  it("keine Rohentwurfs-Imports im Client", () => {
    for (const f of SRC) for (const s of GATED) expect({ f, hit: readFileSync(f, "utf8").includes(`${s}.entwurf.html`) }).toEqual({ f, hit: false });
  });
  it("Offline-Bestand vollständig, Allergie 12 Vorschläge", () => {
    const j = JSON.parse(readFileSync("docs/infothek-offline/patient-gated-vergleiche.json", "utf8"));
    const n = Object.fromEntries(j.vergleiche.map((c: { slug: string; changes: unknown[] }) => [c.slug, c.changes.length]));
    expect(n).toEqual({ allergiebehandlung: 12, "candida-diaet": 16, "sibo-duenndarmfehlbesiedlung": 8, "kraeuter-schmerz-entzuendung": 6, "dankbarkeit-alltag": 1 });
    for (const c of j.vergleiche) { readFileSync(c.original); readFileSync(c.entwurf); }
  });
  it("Snippets der Offline-Vergleiche nicht im Client", () => {
    const j = JSON.parse(readFileSync("docs/infothek-offline/patient-gated-vergleiche.json", "utf8"));
    const why = j.vergleiche.flatMap((c: { changes: { why: string }[] }) => c.changes.map((x) => x.why)).filter((w: string) => w.length > 40);
    const all = SRC.map((f) => readFileSync(f, "utf8")).join("\n");
    for (const w of why) expect(all.includes(w)).toBe(false);
  });
  it("Zählung 14 online + 8 offline", () => { expect(COMPARISON_CONFIGS.length).toBe(14); expect(OFFLINE_COMPARISONS.length).toBe(8); });
});
