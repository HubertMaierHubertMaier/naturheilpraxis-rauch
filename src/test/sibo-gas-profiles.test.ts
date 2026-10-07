import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { byProfile, GAS_CANDIDATES, GAS_SOURCES, uniqueCount, statusCounts } from "@/lib/siboGasProfiles";

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
});
