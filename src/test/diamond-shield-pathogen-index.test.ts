import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePathogenProducts } from "@/components/admin/PathogenIndex";

describe("Diamond Shield pathogen mappings", () => {
  it("parses several row-level remedies for the same pathogen", () => {
    const content = `## 🦠 Pathogen-Mittel-Zuordnung
| Pathogen | Gruppe | Mittel | Zuordnung / Quelle | Anwendung |
|---|---|---|---|---|
| Borrelia spp. | Bakterien | BO2 ChipCard | direkte Programmzuordnung | laut Programm |
| Borrelia spp. | Bakterien | Samento | therapieunterstützend | 1× tägl. 8 Tropfen |

## Einordnung
Herstellerangabe.`;

    expect(parsePathogenProducts(content)).toEqual([
      {
        pathogen: "Borrelia spp.",
        gruppe: "Bakterien",
        productName: "BO2 ChipCard",
        wirksamkeit: "direkte Programmzuordnung",
        dosierung: "laut Programm",
      },
      {
        pathogen: "Borrelia spp.",
        gruppe: "Bakterien",
        productName: "Samento",
        wirksamkeit: "therapieunterstützend",
        dosierung: "1× tägl. 8 Tropfen",
      },
    ]);
  });

  it("keeps the legacy Wirkspektrum table format working", () => {
    const content = `## 🦠 Wirkspektrum
| Pathogen | Wirksamkeit |
|---|---|
| Candida albicans | ⭐⭐ Herstellerangabe |

## 💊 Dosierung
Standard: laut Produkteintrag`;

    expect(parsePathogenProducts(content, "SAMENTO")).toEqual([
      {
        pathogen: "Candida albicans",
        productName: "SAMENTO",
        wirksamkeit: "⭐⭐ Herstellerangabe",
        dosierung: "",
      },
    ]);
  });

  it("seeds the four website headings and compact AI-readable entries", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260726170000_seed_diamond_shield_wiki.sql"),
      "utf8",
    );

    expect(migration).toContain("Chipcards nach HP Alan Baklayan");
    expect(migration).toContain("NEU: Harmonisieren der Funktionen");
    expect(migration).toContain("Chipcards nach den 5 Elementen");
    expect(migration).toContain("Chipcards nach Dr. Hulda Clark");
    expect(migration).toContain("Diamond Shield – Begleitprotokoll bei Cancer");
    expect(migration).toContain("| Borrelia spp. | Bakterien | Samento |");
    expect(migration).toContain("| Epstein-Barr-Virus (EBV) | Viren | Takuna |");
    expect(migration).toContain("| Candida spp. | Pilze | Cumanda |");
    expect(migration).toContain("| Staphylococcus spp. / MRSA | Bakterien | Banderol |");

    const contentBlocks = Array.from(migration.matchAll(/\$DS\$([\s\S]*?)\$DS\$/g), (match) => match[1]);
    expect(contentBlocks.length).toBeGreaterThanOrEqual(10);
    expect(contentBlocks.every((content) => content.length <= 3000)).toBe(true);
  });
});
