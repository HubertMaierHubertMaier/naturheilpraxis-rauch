import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
const j = JSON.parse(readFileSync("docs/wiki/buhner-mittel-pathogen-abgleich.json", "utf8"));
describe("Buhner Mittel↔Pathogen (offline)", () => {
  it("keine Duplikate, Zählung konsistent", () => { const k = new Set(j.paare.map((p: any) => `${p.pathogen}|${p.mittel}`)); expect(k.size).toBe(j.paare.length); expect(j.zaehlung.paare).toBe(j.paare.length); });
  it("Link nur bei exakt beiden; sonst Kandidat", () => { for (const p of j.paare) expect(p.status === "exakt beide").toBe(p.mittel_match.status === "exakt" && p.pathogen_match.status === "exakt"); });
  it("mehrdeutig nie verlinkt", () => { for (const p of j.paare) for (const m of [p.mittel_match, p.pathogen_match]) if (m.status !== "exakt") expect(m.entity_id).toBeUndefined(); });
  it("Belegart Buchzuordnung, Quelle offen markiert", () => { expect(j.quellen).toMatch(/offen/); for (const p of j.paare) expect(p.belegart).toMatch(/keine klinisch/); });
  it("nicht im Client importiert", () => { const w = (d: string): string[] => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? w(join(d, n)) : [join(d, n)]); for (const f of w("src").filter((f) => !/[\\/]test[\\/]/.test(f))) expect(readFileSync(f, "utf8").includes("buhner-mittel-pathogen-abgleich")).toBe(false); });
});
