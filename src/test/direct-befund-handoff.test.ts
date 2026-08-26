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
      { value: "anamnese", label: "Anamnese / Anamnesebogen" },
      { value: "arzt", label: "Arztbericht / Arztbrief" },
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
      expect(prepared).toContain("Synthetischer Testwert");
      expect(prepared).toContain("42");
    }
  });

  it("recognizes common batch document types without sending document content away", () => {
    expect(inferDirectBefundTarget("Vieva Pro Vitalanalyse.pdf")).toBe("vieva");
    expect(inferDirectBefundTarget("Metatron NLS Auswertung.pdf")).toBe("metatron");
    expect(inferDirectBefundTarget("Laborbefund Blutbild.pdf")).toBe("labor");
    expect(inferDirectBefundTarget("Anamnesebogen.pdf")).toBe("anamnese");
    expect(inferDirectBefundTarget("Arztbrief.pdf")).toBe("arzt");
    expect(inferDirectBefundTarget("Arztbrief und Anamnese.pdf")).toBe("");
    expect(inferDirectBefundTarget("sorra-synth-labor.pdf")).toBe("labor");
    expect(inferDirectBefundTarget("sorra-synth-arzt.pdf")).toBe("arzt");
    expect(inferDirectBefundTarget("Unbekanntes Dokument.pdf")).toBe("");
  });

  it("blocks handoff without a date or a non-empty privacy-safe preview", () => {
    expect(() => prepareDirectBefundHandoffText("Test", "labor", "")).toThrow("Dokumentdatum");
    expect(() => prepareDirectBefundHandoffText("   ", "labor", "2026-08-15")).toThrow("Vorschau ist leer");
  });

  it("structures only anamnesis text by recognized questions and preserves uncertain lines", () => {
    const input = [
      "=== Dokument-abcdef123456 (1 S.) ===",
      "--- Seite 21 ---",
      "XXI. Beschwerden",
      "Hauptbeschwerde: synthetische Erschoepfung",
      "unleserliche handschriftliche Testzeile",
    ].join("\n");
    const prepared = prepareDirectBefundHandoffText(input, "anamnese", "2026-08-25", [
      { pageNumber: 21, confidence: 63 },
    ]);

    expect(prepared).toContain("Lokale Anamnese-Auswertung zur manuellen Pruefung");
    expect(prepared).toContain("Frage/Feld: Hauptbeschwerde");
    expect(prepared).toContain("Erkannte Antwort: synthetische Erschoepfung");
    expect(prepared).toContain("Manuell pruefen");
    expect(prepared).toContain("unleserliche handschriftliche Testzeile");
    expect(prepared).toContain("Seite(n) 21 liegen unter 80 %");

    const laboratory = prepareDirectBefundHandoffText("CRP: 4,2 mg/l", "labor", "2026-08-25");
    expect(laboratory).not.toContain("Lokale Anamnese-Auswertung");
  });

  it("runs a second residual identifier scan before the confirmed batch handoff", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8");
    const handoff = source.match(/const handoffDirectBefundFiles = async \(\) => \{([\s\S]*?)const loadArchivedBefundDocument/)?.[1] || "";

    expect(handoff).toContain("ready.flatMap((item) => directIdentifierCategories(item.previewText || \"\"))");
    expect(handoff).toContain("Datenschutz-Sicherheitsstopp");
    expect(handoff.indexOf("directIdentifierCategories")).toBeLessThan(handoff.indexOf("switch (documentType)"));
  });
});
