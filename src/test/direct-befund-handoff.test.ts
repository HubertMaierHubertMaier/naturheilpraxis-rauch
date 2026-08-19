import { describe, expect, it } from "vitest";
import {
  DIRECT_BEFUND_TARGETS,
  directBefundTargetLabel,
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

  it("blocks handoff without a date or a non-empty privacy-safe preview", () => {
    expect(() => prepareDirectBefundHandoffText("Test", "labor", "")).toThrow("Dokumentdatum");
    expect(() => prepareDirectBefundHandoffText("   ", "labor", "2026-08-15")).toThrow("Vorschau ist leer");
  });
});
