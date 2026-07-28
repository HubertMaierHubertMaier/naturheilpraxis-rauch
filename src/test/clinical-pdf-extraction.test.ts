import { describe, expect, it } from "vitest";
import {
  MAX_OCR_PAGE_PIXELS,
  MIN_TEXT_PER_PAGE,
  assessDocumentExtraction,
  assembleExtractedPdfPages,
  calculateOcrRenderScale,
  hasPracticalDocumentText,
  selectPreferredPageText,
  shouldRunLocalOcr,
  terminateAndResetWorkerSession,
  waitForPdfRender,
} from "@/lib/clinicalPdfExtraction";

describe("clinical PDF extraction decisions", () => {
  it("runs OCR only for raster pages with an insufficient text layer", () => {
    const sufficientText = "A".repeat(MIN_TEXT_PER_PAGE);

    expect(shouldRunLocalOcr({ containsRasterImage: true, textLayer: "Logo" })).toBe(true);
    expect(shouldRunLocalOcr({ containsRasterImage: false, textLayer: "" })).toBe(false);
    expect(shouldRunLocalOcr({ containsRasterImage: true, textLayer: sufficientText })).toBe(false);
  });

  it("prefers a sufficient existing text layer over OCR output", () => {
    const textLayer = "Vorhandene OCR-Textebene mit ausreichend vielen Laborwerten und Einheiten";

    expect(selectPreferredPageText({ pageNumber: 1, textLayer, ocrText: "Abweichende Nacherkennung" })).toBe(textLayer);
  });

  it("combines normal and locally recognized pages in page-number order", () => {
    const pageOne = "Laborbericht mit Referenzbereichen und ausreichend vorhandenem Text";
    const pageTwoOcr = "Hämoglobin 14,2 g/dl Leukozyten 6,1 G/l CRP kleiner 0,5 mg/l";
    const assembled = assembleExtractedPdfPages([
      { pageNumber: 3, textLayer: "Rückseite" },
      { pageNumber: 1, textLayer: pageOne },
      { pageNumber: 2, textLayer: "Logo", ocrText: pageTwoOcr },
    ]);

    expect(assembled.indexOf("--- Seite 1 ---")).toBeLessThan(assembled.indexOf("--- Seite 2 ---"));
    expect(assembled.indexOf("--- Seite 2 ---")).toBeLessThan(assembled.indexOf("--- Seite 3 ---"));
    expect(assembled).toContain(pageOne);
    expect(assembled).toContain(pageTwoOcr);
  });

  it("does not let an empty cover or back page block an otherwise readable PDF", () => {
    expect(hasPracticalDocumentText([
      { pageNumber: 1, textLayer: "" },
      { pageNumber: 2, textLayer: "Ausführlicher Laborbefund mit Messwerten, Einheiten und Referenzbereichen" },
      { pageNumber: 3, textLayer: "" },
    ])).toBe(true);
    expect(hasPracticalDocumentText([
      { pageNumber: 1, textLayer: "Logo", ocrText: "Logo" },
      { pageNumber: 2, textLayer: "" },
    ])).toBe(false);
  });

  it("accepts short clinical values but rejects short logo-only text", () => {
    expect(hasPracticalDocumentText([{ pageNumber: 1, textLayer: "CRP 5 mg/l" }])).toBe(true);
    expect(hasPracticalDocumentText([{ pageNumber: 1, textLayer: "TSH 2,1 mIU/l" }])).toBe(true);
    expect(hasPracticalDocumentText([{ pageNumber: 1, textLayer: "fT4 15 pmol/l" }])).toBe(true);
    expect(hasPracticalDocumentText([{ pageNumber: 1, textLayer: "Kreatinin 80 µmol/l" }])).toBe(true);
    expect(hasPracticalDocumentText([{ pageNumber: 1, textLayer: "Metformin 1-0-1" }])).toBe(true);
    expect(hasPracticalDocumentText([{ pageNumber: 1, textLayer: "Praxislogo 2026" }])).toBe(false);
    expect(hasPracticalDocumentText([{ pageNumber: 1, textLayer: "" }])).toBe(false);
  });

  it("keeps readable pages when another page has an OCR failure", () => {
    expect(assessDocumentExtraction([
      { pageNumber: 1, textLayer: "Ausführlicher Laborbefund mit Messwerten, Einheiten und Referenzbereichen" },
      { pageNumber: 2, textLayer: "" },
    ], [2])).toEqual({ status: "accept-with-warning", failedOcrPages: [2] });
  });

  it("rejects an all-empty document after OCR failures", () => {
    expect(assessDocumentExtraction([
      { pageNumber: 1, textLayer: "" },
      { pageNumber: 2, textLayer: "Logo" },
    ], [1, 2])).toEqual({ status: "reject", failedOcrPages: [1, 2] });
  });

  it("terminates and clears worker sessions even when termination rejects", async () => {
    const successfulTerminate = vi.fn().mockResolvedValue(undefined);
    const successfulSession = { worker: { terminate: successfulTerminate } };
    await expect(terminateAndResetWorkerSession(successfulSession)).resolves.toBe(true);
    expect(successfulTerminate).toHaveBeenCalledOnce();
    expect(successfulSession.worker).toBeUndefined();

    const failedSession: { worker?: { terminate: () => Promise<unknown> } } = {
      worker: { terminate: vi.fn().mockRejectedValue(new Error("terminate failed")) },
    };
    await expect(terminateAndResetWorkerSession(failedSession)).resolves.toBe(false);
    expect(failedSession.worker).toBeUndefined();
  });

  it("cancels a PDF render task when the local render timeout expires", async () => {
    const cancel = vi.fn();
    const neverFinishes = new Promise<never>(() => undefined);

    await expect(waitForPdfRender({ promise: neverFinishes, cancel }, undefined, 5))
      .rejects.toThrow("Zeitüberschreitung beim lokalen Rendern der PDF-Seite");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("caps rendered OCR pages by pixel count without imposing a page-count limit", () => {
    const width = 4_000;
    const height = 3_000;
    const scale = calculateOcrRenderScale(width, height);

    expect(width * scale * height * scale).toBeLessThanOrEqual(MAX_OCR_PAGE_PIXELS + 1);
    expect(calculateOcrRenderScale(595, 842)).toBe(2.5);
  });
});
