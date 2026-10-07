import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyContactCorrection, PRACTICE_PHONE_TEL } from "@/lib/practiceContact";
describe("Praxis-Telefon", () => {
  it("korrigiert nur bekannte falsche Nummern", () => {
    const r = applyContactCorrection('<a href="tel:+49821217726700">x</a> 0821 2177 2670 tel:+4982126214620 "+49-821-21772670" 0821 999999');
    expect(r.count).toBe(4);
    expect(r.html).not.toMatch(/2177|26214620/);
    expect(r.html).toContain("0821 999999");
    expect(r.html).toContain(PRACTICE_PHONE_TEL);
  });
  it("Entwürfe enthalten nur die richtige Nummer", () => {
    for (const f of ["allergiebehandlung.entwurf", "kieferostitis.entwurf", "kieferostitis.basis"]) {
      const h = readFileSync(`website-content/infothek/drafts/${f}.html`, "utf8");
      expect(h).not.toMatch(/2177 ?2670|21772670|26214620/);
      expect(h).toContain('href="tel:+498212621462"');
      expect(h).toContain("0821-2621462");
    }
  });
  it("Original Allergie bleibt Ausgangsstand", () => {
    expect(readFileSync("website-content/infothek/allergiebehandlung.html", "utf8")).toContain("tel:+49821217726700");
  });
});

import { PRACTICE_EMAIL_MAILTO } from "@/lib/practiceContact";
describe("Praxis-E-Mail", () => {
  it("alle mailto-Links in Infothek-HTMLs zeigen auf die Praxisadresse", () => {
    const { readdirSync } = require("node:fs");
    const files = ["website-content/infothek", "website-content/infothek/drafts"].flatMap((d: string) => readdirSync(d).filter((f: string) => f.endsWith(".html")).map((f: string) => `${d}/${f}`));
    for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/mailto:([^"'?\s>]+)/g)) expect(`mailto:${m[1]}`).toBe(PRACTICE_EMAIL_MAILTO);
  });
});
