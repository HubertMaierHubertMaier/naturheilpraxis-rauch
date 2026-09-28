import { describe, expect, it } from "vitest";
import { manualPdfTextRedactionPages, rememberManualPdfTextRedactions } from "@/lib/manualPdfTextRedaction";
import { replaceReviewedPdfPageText } from "@/lib/reviewedPdfPageText";

const original = [
  "=== Dokument A ===",
  "--- Seite 1 ---",
  "Hausarzt: Erika Beispiel",
  "Symptom: Gelenkschmerzen",
  "",
  "--- Seite 2 ---",
  "IAA Frage 1: markiert 5",
  "Symptom: Müdigkeit",
  "",
  "[IAA_ERFASSUNG:NATIVE_FELDER]",
].join("\n");
const maskedCopy = [
  "=== Dokument B ===",
  "--- Seite 1 ---",
  "Hausarzt: geschwärzt",
  "Symptom: Gelenkschmerzen",
  "",
  "--- Seite 2 ---",
  "IAA Frage 1: markiert 5",
  "Symptom: Müdigkeit",
].join("\n");

describe("text from reviewed PDF image pages", () => {
  it("replaces only the manually masked page and keeps other clinical answers", () => {
    const result = replaceReviewedPdfPageText(original, maskedCopy, [1]);
    expect(result).not.toContain("Erika Beispiel");
    expect(result).toContain("Hausarzt: geschwärzt");
    expect(result).toContain("Symptom: Gelenkschmerzen");
    expect(result).toContain("IAA Frage 1: markiert 5");
    expect(result).toContain("Symptom: Müdigkeit");
    expect(result).toContain("Nachgeschwärzte Seite 1 aus der Bildkopie erneut erkannt");
    expect(result).toContain("[IAA_ERFASSUNG:MANUELL_PRUEFEN]");
    expect(result).not.toContain("[IAA_ERFASSUNG:NATIVE_FELDER]");
  });

  it("rejects a missing page, duplicate marker, or unreadable replacement", () => {
    expect(() => replaceReviewedPdfPageText(original, maskedCopy.replace("--- Seite 2 ---", "--- Seite 1 ---"), [1]))
      .toThrow(/eindeutig zugeordnet/);
    expect(() => replaceReviewedPdfPageText(original, maskedCopy, [3])).toThrow(/passen nicht/);
    const blank = maskedCopy.replace("Hausarzt: geschwärzt\nSymptom: Gelenkschmerzen", " ");
    expect(() => replaceReviewedPdfPageText(original, blank, [1])).toThrow(/nicht ausreichend/);
  });

  it("keeps the IAA review marker when the final page is replaced", () => {
    const lastPage = maskedCopy.replace("IAA Frage 1: markiert 5", "IAA Frage 1: Markierung am Original prüfen");
    const result = replaceReviewedPdfPageText(original, lastPage, [2]);
    expect(result).toContain("Hausarzt: Erika Beispiel");
    expect(result).toContain("IAA Frage 1: Markierung am Original prüfen");
    expect(result).toContain("[IAA_ERFASSUNG:MANUELL_PRUEFEN]");
    expect(result).not.toContain("[IAA_ERFASSUNG:NATIVE_FELDER]");
  });

  it("names IAA fields lost from a masked page without copying their ratings or notes", () => {
    const withNativeIaa = original.replace("Symptom: Gelenkschmerzen", "Symptom: Gelenkschmerzen\n[IAA_FORMULAR:1.2;SEITE:1;MARKIERT:6]\nPrivater Freitext\n[/IAA_FORMULAR]");
    const result = replaceReviewedPdfPageText(withNativeIaa, maskedCopy, [1]);
    expect(result).toContain("IAA-Frage 1.2 auf Seite 1 nach Schwärzung erneut am Original erfassen");
    expect(result).not.toContain("MARKIERT:6");
    expect(result).not.toContain("Privater Freitext");
  });

  it("accepts a reviewed pixel mask without requiring an OCR word match, but checks the case", () => {
    const file = new Blob(["synthetic"], { type: "application/pdf" });
    rememberManualPdfTextRedactions(file, 1, [{ x: 1, y: 1, width: 20, height: 10 }], 100, 100, [], "patient-a");
    expect(manualPdfTextRedactionPages(file, "patient-a")).toEqual([1]);
    expect(() => manualPdfTextRedactionPages(file, "patient-b")).toThrow(/aktuellen Patientenfall/);
  });
});
