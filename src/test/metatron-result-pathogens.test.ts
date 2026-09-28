import { describe, expect, it } from "vitest";
import { extractMetatronResultPathogens, mergeMetatronResultPathogens } from "@/lib/metatronResultPathogens";

const syntheticReport = [
  "=== Dokument-SYNTHETIC ===",
  "--- Seite 11 ---",
  "MESSERGEBNISSE",
  "BAKTERIEN",
  "Helicobacter pylori 0,087",
  "Allgemeine Beschreibung ohne Gerätewert",
  "--- Seite 12 ---",
  "Borrelia burgdorferi 0,341",
  "PARASITEN",
  "Giardia lamblia 0,299",
  "VIREN",
  "Epstein-Barr-Virus 0,017",
  "PILZE",
  "--- Seite 13 ---",
  "Candida albicans 0,086",
  "Aspergillus niger 0,236",
  "HOMÖOPATHIE",
  "Unrelated synthetic reference 0,123",
  "--- Seite 30 ---",
  "Bakterien können beschrieben werden, ohne dass ein Patientenbefund vorliegt.",
].join("\n");

describe("patient-specific Metatron result rows", () => {
  it("extracts only indexed rows under result categories across page breaks", () => {
    const entries = extractMetatronResultPathogens(syntheticReport);
    expect(entries.map(entry => [entry.name, entry.index, entry.category])).toEqual([
      ["Helicobacter pylori", "0.087", "bacteria"],
      ["Borrelia burgdorferi", "0.341", "bacteria"],
      ["Giardia lamblia", "0.299", "parasites"],
      ["Epstein-Barr-Virus", "0.017", "viruses"],
      ["Candida albicans", "0.086", "yeasts"],
      ["Aspergillus niger", "0.236", "moulds"],
    ]);
    expect(entries[0].source).toBe("Metatron Hospital, Seite 11");
    expect(entries[1].source).toBe("Metatron Hospital, Seite 12");
    expect(entries.every(entry => !entry.name.includes("Unrelated"))).toBe(true);
  });

  it("rejects free text without page-bound result rows", () => {
    expect(extractMetatronResultPathogens("BAKTERIEN\nHelicobacter pylori 0,087")).toEqual([]);
    expect(extractMetatronResultPathogens("--- Seite 1 ---\nBAKTERIEN\nEin Überblick 0,12\nVIREN\nAllgemeine Beschreibung")).toEqual([]);
  });

  it("is idempotent and preserves a manually corrected group", () => {
    const incoming = extractMetatronResultPathogens(syntheticReport);
    const corrected = [{ ...incoming[0], category: "unassigned" as const }];
    const once = mergeMetatronResultPathogens(corrected, incoming);
    const twice = mergeMetatronResultPathogens(once, incoming);
    expect(once).toHaveLength(incoming.length);
    expect(twice).toEqual(once);
    expect(once[0].category).toBe("unassigned");
  });
});
