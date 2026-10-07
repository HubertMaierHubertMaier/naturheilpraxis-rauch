import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { ENTITY_MATCHES, PRAXIS_KEIME, byProfile, GAS_CANDIDATES, GAS_SOURCES, uniqueCount, statusCounts } from "@/lib/siboGasProfiles";

describe("SIBO Gasprofile", () => {
  it("drei Profile mit Einträgen", () => { for (const p of ["h2", "ch4", "h2s"] as const) expect(byProfile(p).length).toBeGreaterThan(0); });
  it("eindeutige IDs, keine Duplikate", () => expect(uniqueCount(GAS_CANDIDATES)).toBe(GAS_CANDIDATES.length));
  it("jede Quelle existiert; Praxiszuordnung nur mit Praxisquelle", () => {
    for (const c of GAS_CANDIDATES) {
      expect(GAS_SOURCES.some((s) => s.id === c.sourceId)).toBe(true);
      expect(c.status === "praxiszuordnung").toBe(c.sourceId === "S-PRAXIS-PDF");
    }
  });
  it("nichts prüfbestätigt", () => expect(statusCounts().pruefbestaetigt).toBe(0));
  it("keine Dosen", () => expect(JSON.stringify([GAS_CANDIDATES, GAS_SOURCES])).not.toMatch(/\d\s?(mg|µg|g\/Tag|IE|ml)\b/i));
  it("Leerfall und Admin-Route", () => {
    const comp = readFileSync("src/components/wiki/SiboGasProfiles.tsx", "utf8");
    expect(comp).toContain("gas-missing");
    expect(comp).not.toContain("content_markdown");
    expect(readFileSync("src/pages/WikiOrdnung.tsx", "utf8")).toContain("SiboGasProfiles");
  });
  it("22 Kandidaten: 17 Praxis + 5 Quellen", () => { expect(GAS_CANDIDATES.length).toBe(22); expect(statusCounts().praxiszuordnung).toBe(17); expect(statusCounts().kandidat).toBe(5); });
  it("Keimlisten getrennt, Archaeen nur Methan, Candida separat", () => {
    expect(PRAXIS_KEIME.ch4[0].gruppe).toMatch(/Archaeen/);
    expect(JSON.stringify([PRAXIS_KEIME.h2, PRAXIS_KEIME.h2s])).not.toMatch(/Methano/);
    expect(PRAXIS_KEIME.h2.find((g) => g.keime.includes("Candida"))!.gruppe).toMatch(/Pilz/);
  });
  it("Revisionsfehler sichtbar, Quellen aus Revision mit Fallback", () => {
    const c = readFileSync("src/components/wiki/SiboGasProfiles.tsx", "utf8");
    expect(c).toContain("gas-rev-error"); expect(c).toContain("artikel-fallback"); expect(c).not.toContain("Migration nicht angewendet");
  });
  it("nur eindeutige Entity-Treffer verlinkt", () => { for (const e of ENTITY_MATCHES) expect(!!e.entityId).toBe(e.ergebnis === "eindeutig"); });
  it("ACG mit Volltextlink", () => expect(GAS_SOURCES.find((s) => s.id === "S-ACG")!.url).toMatch(/^https:/));
});
