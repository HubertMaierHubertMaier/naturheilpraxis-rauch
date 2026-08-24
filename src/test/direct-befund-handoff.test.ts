import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DIRECT_BEFUND_TARGETS,
  directBefundTargetLabel,
  inferDirectBefundTarget,
  prepareDirectBefundHandoffText,
} from "@/lib/directBefundHandoff";

describe("direct Befund handoff", () => {
  it("offers every existing destination field as an explicit document type", () => {
    expect(DIRECT_BEFUND_TARGETS).toEqual([
      { value: "labor", label: "Labor" },
      { value: "metatron", label: "Metatron" },
      { value: "vieva", label: "Vieva Pro" },
      { value: "arzt-anamnese", label: "Arztbericht / Anamnese" },
      { value: "sonstige", label: "Allgemeine Unterlagen" },
    ]);
  });

  it("places the selected type and date inside the neutral document block", () => {
    for (const target of DIRECT_BEFUND_TARGETS) {
      const prepared = prepareDirectBefundHandoffText(
        "=== 📄 Dokument-abcdef123456 (2 S.) ===\nSynthetischer Testwert: 42",
        target.value,
        "2026-08-15",
      );
      expect(prepared).toContain(`Dokumenttyp: ${directBefundTargetLabel(target.value)}`);
      expect(prepared).toContain("Erstellt am: 2026-08-15");
      expect(prepared).toContain("Synthetischer Testwert: 42");
    }
  });

  it("recognizes common batch document types without sending document content away", () => {
    expect(inferDirectBefundTarget("Vieva Pro Vitalanalyse.pdf")).toBe("vieva");
    expect(inferDirectBefundTarget("Metatron NLS Auswertung.pdf")).toBe("metatron");
    expect(inferDirectBefundTarget("Laborbefund Blutbild.pdf")).toBe("labor");
    expect(inferDirectBefundTarget("Arztbrief und Anamnese.pdf")).toBe("arzt-anamnese");
    expect(inferDirectBefundTarget("sorra-synth-labor.pdf")).toBe("labor");
    expect(inferDirectBefundTarget("sorra-synth-arzt.pdf")).toBe("arzt-anamnese");
    expect(inferDirectBefundTarget("Unbekanntes Dokument.pdf")).toBe("");
  });

  it("blocks handoff without a date or a non-empty privacy-safe preview", () => {
    expect(() => prepareDirectBefundHandoffText("Test", "labor", "")).toThrow("Dokumentdatum");
    expect(() => prepareDirectBefundHandoffText("   ", "labor", "2026-08-15")).toThrow("Vorschau ist leer");
  });

  it("runs a second residual identifier scan before the confirmed batch handoff", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8");
    const handoff = source.match(/const handoffDirectBefundFiles = async \(\) => \{([\s\S]*?)const loadArchivedBefundDocument/)?.[1] || "";

    expect(handoff).toContain("ready.flatMap((item) => directIdentifierCategories(item.previewText || \"\"))");
    expect(handoff).toContain("Datenschutz-Sicherheitsstopp");
    expect(handoff.indexOf("directIdentifierCategories")).toBeLessThan(handoff.indexOf("switch (documentType)"));
  });
});
