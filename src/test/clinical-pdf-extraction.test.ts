import { describe, expect, it } from "vitest";
import {
  MAX_OCR_PAGE_PIXELS,
  MIN_TEXT_PER_PAGE,
  assessDocumentExtraction,
  assembleExtractedPdfPages,
  calculateOcrRenderScale,
  classifyClinicalPdfFailure,
  hasPracticalDocumentText,
  reconstructPdfTextLines,
  selectPreferredPageText,
  shouldRunLocalOcr,
  terminateAndResetWorkerSession,
  waitForPdfRender,
} from "@/lib/clinicalPdfExtraction";
import { collectLocalPrivacyFindings, deidentifyClinicalText, directIdentifierCategories, quarantineResidualDirectIdentifierLines, removeResidualDirectIdentifierLines } from "../../supabase/functions/_shared/clinicalDeidentification";

describe("clinical PDF extraction decisions", () => {
  it("reconstructs PDF.js text items from EOL markers and y changes without splitting table rows", () => {
    const items = [
      { str: "Name:", transform: [1, 0, 0, 1, 20, 700] },
      { str: "Erika Beispiel", hasEOL: true, transform: [1, 0, 0, 1, 90, 700] },
      { str: "CRP", transform: [1, 0, 0, 1, 20, 680] },
      { str: "4,2", transform: [1, 0, 0, 1, 180, 680] },
      { str: "mg/l", transform: [1, 0, 0, 1, 240, 680] },
      { str: "Ferritin", transform: [1, 0, 0, 1, 20, 660] },
      { str: "52", transform: [1, 0, 0, 1, 180, 660] },
      { str: "ng/ml", transform: [1, 0, 0, 1, 240, 660] },
    ];

    expect(reconstructPdfTextLines(items)).toBe([
      "Name: Erika Beispiel",
      "CRP 4,2 mg/l",
      "Ferritin 52 ng/ml",
    ].join("\n"));
  });

  it("clusters visual rows and x-sorts cells when PDF.js streams table columns out of order", () => {
    const columnStreamItems = [
      { str: "CRP", hasEOL: true, transform: [1, 0, 0, 1, 20, 680] },
      { str: "Ferritin", hasEOL: true, transform: [1, 0, 0, 1, 20, 660] },
      { str: "4,2", transform: [1, 0, 0, 1, 180, 680] },
      { str: "52", transform: [1, 0, 0, 1, 180, 660] },
      { str: "mg/l", transform: [1, 0, 0, 1, 240, 680] },
      { str: "ng/ml", transform: [1, 0, 0, 1, 240, 660] },
    ];

    expect(reconstructPdfTextLines(columnStreamItems)).toBe("CRP 4,2 mg/l\nFerritin 52 ng/ml");
  });

  it("runs OCR only for raster pages with an insufficient text layer unless an anamnesis form requires it", () => {
    const sufficientText = "A".repeat(MIN_TEXT_PER_PAGE);

    expect(shouldRunLocalOcr({ containsRasterImage: true, textLayer: "Logo" })).toBe(true);
    expect(shouldRunLocalOcr({ containsRasterImage: false, textLayer: "" })).toBe(false);
    expect(shouldRunLocalOcr({ containsRasterImage: true, textLayer: sufficientText })).toBe(false);
    expect(shouldRunLocalOcr({ containsRasterImage: false, textLayer: sufficientText, force: true })).toBe(true);
  });

  it("prefers a sufficient existing text layer over OCR output", () => {
    const textLayer = "Vorhandene OCR-Textebene mit ausreichend vielen Laborwerten und Einheiten";

    expect(selectPreferredPageText({ pageNumber: 1, textLayer, ocrText: "Abweichende Nacherkennung" })).toBe(textLayer);
  });

  it("keeps local OCR answers alongside the printed anamnesis form", () => {
    expect(selectPreferredPageText({
      pageNumber: 1,
      textLayer: "Frage: Bestehen Beschwerden?",
      ocrText: "Ja, seit drei Wochen.",
      includeOcrAlongsideTextLayer: true,
    })).toBe("Frage: Bestehen Beschwerden?\nJa, seit drei Wochen.");
  });

  it("keeps image text on a dense mixed page and removes duplicate OCR lines", () => {
    const native = "Metatron-Auswertung mit längerem sichtbarem Grundtext und Messwert 4,2 mg/l";
    expect(shouldRunLocalOcr({ containsRasterImage: true, textLayer: native, force: true })).toBe(true);
    const combined = selectPreferredPageText({ pageNumber: 1, textLayer: native,
      ocrText: `${native}\nName: Erika Beispiel\nZusatzbefund 7,1 mmol/l`, includeOcrAlongsideTextLayer: true });
    expect(combined.split(native)).toHaveLength(2);
    expect(combined).toContain("Zusatzbefund 7,1 mmol/l");
    const safe = deidentifyClinicalText(combined);
    expect(safe).not.toContain("Erika Beispiel");
    expect(safe).toContain("7,1 mmol/l");
    expect(directIdentifierCategories(safe)).toEqual([]);
  });

  it("keeps OCR lines when inequalities or decimal values disagree with the native layer", () => {
    const combined = selectPreferredPageText({
      pageNumber: 1,
      textLayer: "CRP <5 mg/l\nHb 13,0 g/dl",
      ocrText: "CRP >5 mg/l\nHb 130 g/dl\nCRP <5 mg/l",
      includeOcrAlongsideTextLayer: true,
    });
    expect(combined.split("\n")).toEqual([
      "CRP <5 mg/l", "Hb 13,0 g/dl", "CRP >5 mg/l", "Hb 130 g/dl",
    ]);
  });

  it("keeps split identity fields out of the text passed to the report", () => {
    const source = "--- Seite 1 ---\nName:\nErika Beispiel\nLDL 130 mg/dl";
    expect(collectLocalPrivacyFindings(source)).toEqual([expect.objectContaining({ pageNumber: 1, lineNumber: 1, categories: expect.arrayContaining(["Name"]) })]);
    const safe = quarantineResidualDirectIdentifierLines(removeResidualDirectIdentifierLines(deidentifyClinicalText(source)));
    expect(safe).not.toContain("Erika Beispiel");
    expect(safe).toContain("LDL 130 mg/dl");
    expect(directIdentifierCategories(safe)).toEqual([]);
  });

  it("keeps later finding line numbers after a two-line identity field", () => {
    const findings = collectLocalPrivacyFindings("--- Seite 1 ---\nName:\nErika Beispiel\nLDL 130 mg/dl\nName: Max Muster");
    expect(findings.map(finding => finding.lineNumber)).toEqual([1, 4]);
  });

  it("assembles 200 synthetic text, image and mixed pages before privacy filtering", () => {
    const pages = Array.from({ length: 200 }, (_, index) => ({
      pageNumber: index + 1,
      textLayer: index % 3 === 0 ? "Metatron-Grundtext mit Messwert 4,2 mg/l" : "",
      ocrText: index % 3 === 0 ? "Zusatzbefund 7,1 mmol/l" : "Laborwert 5,3 mmol/l",
      includeOcrAlongsideTextLayer: true,
    }));
    const safe = deidentifyClinicalText(assembleExtractedPdfPages(pages));
    expect((safe.match(/--- Seite \d+ ---/g) || [])).toHaveLength(200);
    expect(safe.indexOf("--- Seite 1 ---")).toBeLessThan(safe.indexOf("--- Seite 200 ---"));
    expect(safe).toContain("Zusatzbefund 7,1 mmol/l");
    expect(safe).toContain("Laborwert 5,3 mmol/l");
    expect(directIdentifierCategories(safe)).toEqual([]);
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

  it("preserves the remaining render budget while the browser is hidden", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const cancel = vi.fn();
    const progress = vi.fn();
    const remove = vi.spyOn(document, "removeEventListener");
    try {
      const pending = waitForPdfRender({ promise: new Promise(() => undefined), cancel }, undefined, 100, progress);
      const rejected = expect(pending).rejects.toThrow(/Zeitüberschreitung/);
      await vi.advanceTimersByTimeAsync(40);
      visibility.mockReturnValue("hidden"); document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(60_000);
      expect(cancel).not.toHaveBeenCalled();
      visibility.mockReturnValue("visible"); document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(59);
      expect(cancel).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await rejected;
      expect(cancel).toHaveBeenCalledOnce();
      expect(progress.mock.calls.map(call => call[0])).toEqual([false, true, false]);
      expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    } finally { visibility.mockRestore(); remove.mockRestore(); vi.useRealTimers(); }
  });

  it("can cancel a hidden render without waiting for the tab to become visible", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const controller = new AbortController();
    const cancel = vi.fn();
    try {
      const pending = waitForPdfRender({ promise: new Promise(() => undefined), cancel }, controller.signal);
      controller.abort();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(cancel).toHaveBeenCalledOnce();
    } finally { visibility.mockRestore(); }
  });

  it("accepts a render that finishes while hidden and removes its visibility listener", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const progress = vi.fn(); const cancel = vi.fn();
    try {
      await expect(waitForPdfRender({ promise: Promise.resolve(), cancel }, undefined, 10, progress)).resolves.toBeUndefined();
      document.dispatchEvent(new Event("visibilitychange"));
      expect(progress).toHaveBeenCalledOnce();
      expect(cancel).not.toHaveBeenCalled();
    } finally { visibility.mockRestore(); }
  });

  it("separates password, OCR, privacy, format and technical PDF failures", () => {
    expect(classifyClinicalPdfFailure({ name: "PasswordException" }).kind).toBe("password");
    expect(classifyClinicalPdfFailure(new Error("praktisch keinen auswertbaren Text nach OCR")).kind).toBe("text");
    expect(classifyClinicalPdfFailure(new Error("Datenschutz-Sicherheitsstopp: Identifikator")).kind).toBe("privacy");
    expect(classifyClinicalPdfFailure(new Error("Im Datenschutzmodus sind nur PDFs erlaubt.")).kind).toBe("format");
    expect(classifyClinicalPdfFailure(new Error("unerwartet")).kind).toBe("technical");
  });

  it("shows only the safe identifier category when a privacy failure remains", () => {
    const failure = classifyClinicalPdfFailure(new Error(
      "Datenschutz-Sicherheitsstopp: Name, Anschrift konnte nicht zuverlässig entfernt werden.",
    ));

    expect(failure.kind).toBe("privacy");
    expect(failure.message).toContain("Erkannte Kategorie: Name, Anschrift");
    expect(failure.message).not.toContain("Erika");
  });

  it("identifies unsafe archive redaction as a privacy stop without exposing source text", () => {
    for (const message of [
      "Eine PDF-Schwärzung würde benachbarten Befundtext überdecken. Lokale Prüfung erforderlich.",
      "Widersprüchliche überlappende PDF-Schwärzungen: lokale Prüfung erforderlich, keine Übertragung.",
      "Mehrdeutige PDF-Schwärzungsüberlappung; keine Übertragung.",
      "Verbleibender Befundtext würde unleserlich: Archivkopie benötigt Prüfung.",
      "PDF-Stelle benötigt eine eindeutige Schwärzung. Keine Archivübertragung.",
    ]) {
      const result = classifyClinicalPdfFailure(new Error(`${message} Vertraulicher Beispieltext`));
      expect(result.kind).toBe("privacy");
      expect(result.label).toBe("PDF-Schwärzung prüfen");
      expect(result.message).toContain("nicht ins Fallarchiv übernommen");
      expect(result.message).not.toContain("Vertraulicher Beispieltext");
    }
  });
});
