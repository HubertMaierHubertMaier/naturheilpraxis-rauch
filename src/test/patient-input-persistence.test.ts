import { describe, expect, it } from "vitest";
import {
  addAnalysisDocumentMetadata,
  createNeutralDocumentId,
  mergeExtractedDiagnoses,
  mergeExtractedMedications,
  mergeExtractedSymptoms,
  mergeLegacyPathogenContext,
  missingPatientProfileFields,
  shouldApplyCloudDraft,
} from "@/lib/patientInputPersistence";

describe("patient input persistence", () => {
  it("does not let an older or undated cloud draft replace a newer local draft", () => {
    const localTime = Date.parse("2026-07-28T12:00:00Z");
    expect(shouldApplyCloudDraft(localTime, "2026-07-28T11:59:59Z")).toBe(false);
    expect(shouldApplyCloudDraft(localTime, undefined)).toBe(false);
    expect(shouldApplyCloudDraft(localTime, "2026-07-28T12:00:00Z")).toBe(true);
    expect(shouldApplyCloudDraft(0, undefined)).toBe(true);
  });

  it("fills only missing profile fields from an older patient snapshot", () => {
    expect(missingPatientProfileFields(
      { alter: "", geschlecht: "maennlich", symptome: "aktuell" },
      { alter: "54", geschlecht: "weiblich", symptome: "veraltet", schwanger: "nein" },
    )).toEqual({ alter: "54", schwanger: "nein" });
  });

  it("merges extracted symptoms, diagnoses and medications without duplicates", () => {
    expect(mergeExtractedDiagnoses("Hashimoto", [
      { diagnose: "Hashimoto", icd10: "E06.3" },
      { diagnose: "Hypertonie", icd10: "I10" },
    ])).toBe("Hashimoto\n• I10: Hypertonie");

    expect(mergeExtractedSymptoms("Müdigkeit", [
      { text: "Müdigkeit" },
      { text: "Schwindel", quelle: "Dokument 1" },
    ])).toContain("• Schwindel (Dokument: Dokument 1)");

    const medication = mergeExtractedMedications("Metformin 500 mg", [
      { name: "Metformin", dosis: "500 mg" },
      { name: "Ramipril", dosis: "5 mg", vonWem: "Hausarzt" },
    ]);
    expect(medication).not.toContain("Metformin 500 mg\n• Metformin");
    expect(medication).toContain("• Ramipril 5 mg - verordnet von: Hausarzt");
  });

  it("keeps the analysis date inside the individual neutral document block", () => {
    const dated = addAnalysisDocumentMetadata(
      "=== 📄 Dokument-abcdef123456 (2 S.) ===\nVitamin D: 22",
      "2026-07-28",
      "Vieva Plus",
    );
    expect(dated).toContain("=== 📄 Dokument-abcdef123456 (2 S.) ===\nDokumenttyp: Vieva Plus\nErstellt am: 2026-07-28\nVitamin D: 22");
    expect(() => addAnalysisDocumentMetadata("Text", "28.07.2026", "Vieva Plus")).toThrow("Ungültiges Erstellungsdatum");
  });

  it("gives text-identical analyses different stable IDs for different dates", async () => {
    const first = await createNeutralDocumentId("identischer Befund", "Vieva Plus|2026-01-01");
    const second = await createNeutralDocumentId("identischer Befund", "Vieva Plus|2026-07-01");
    expect(first).toHaveLength(12);
    expect(second).toHaveLength(12);
    expect(first).not.toBe(second);
    expect(await createNeutralDocumentId("identischer Befund", "Vieva Plus|2026-01-01")).toBe(first);
  });

  it("moves legacy pathogen context into the visible Metatron field without duplication", () => {
    const migrated = mergeLegacyPathogenContext("Aktueller Metatron-Befund", "Borrelia | ZNS | 0.35");
    expect(migrated).toBe("Aktueller Metatron-Befund\n\n=== Legacy Pathogen-/NLS-Eingabe ===\nBorrelia | ZNS | 0.35");
    expect(mergeLegacyPathogenContext(migrated, "Borrelia | ZNS | 0.35")).toBe(migrated);
    expect(mergeLegacyPathogenContext("Aktueller Metatron-Befund", "")).toBe("Aktueller Metatron-Befund");
  });
});
