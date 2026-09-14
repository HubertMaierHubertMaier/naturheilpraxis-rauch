import { describe, expect, it } from "vitest";
import { assertCompleteAnamnesisPageCapture, inspectPdfPageCoverage, classifyClinicalPdfFailure } from "../lib/clinicalPdfExtraction";

describe("complete anamnesis page capture", () => {
  it("does not hide a failed scan page behind a long readable page", () => {
    const pages = [{ pageNumber: 1, textLayer: "Antwort ".repeat(500) }, { pageNumber: 2, textLayer: "" }];
    const before = JSON.stringify(pages);
    expect(() => assertCompleteAnamnesisPageCapture(pages, 2, [2])).toThrow(/Seite\(n\) 2 von 2/);
    expect(JSON.stringify(pages)).toBe(before);
  });
  it("detects missing, duplicated and empty pages independently of total text volume", () => {
    expect(() => assertCompleteAnamnesisPageCapture([{ pageNumber: 1, textLayer: "Antwort" }], 2)).toThrow(/Seite\(n\) 2/);
    expect(() => assertCompleteAnamnesisPageCapture([{ pageNumber: 1, textLayer: "A" }, { pageNumber: 1, textLayer: "B" }], 2)).toThrow(/Seitenzuordnung/);
    expect(() => assertCompleteAnamnesisPageCapture([{ pageNumber: 1, textLayer: "   " }], 1)).toThrow(/Leerseiten/);
  });
  it("preserves a short real answer and distinguishes low OCR confidence from absence", () => {
    const pages = [{ pageNumber: 1, textLayer: "nein" }, { pageNumber: 2, textLayer: "", ocrText: "5 mg morgens", ocrConfidence: 60 }];
    expect(() => assertCompleteAnamnesisPageCapture(pages, 2)).not.toThrow();
    expect(inspectPdfPageCoverage(pages).map(page => page.status)).toEqual(["text-present", "low-confidence"]);
  });
  it("keeps the concrete page review message visible", () => {
    let error: unknown;
    try { assertCompleteAnamnesisPageCapture([{ pageNumber: 1, textLayer: "" }], 1, [1]); } catch (value) { error = value; }
    expect(classifyClinicalPdfFailure(error)).toMatchObject({ kind: "text", label: "Seitenprüfung offen", message: expect.stringContaining("Seite(n) 1") });
  });
});
