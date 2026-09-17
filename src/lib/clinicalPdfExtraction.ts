import { escapeIAAFormMarkers } from "./iaaAssessment";

export const MIN_TEXT_PER_PAGE = 40;
export const MAX_OCR_PAGE_PIXELS = 10_000_000;
export const TARGET_OCR_RENDER_SCALE = 2.5;
export const MAX_OCR_WORKER_INITIALIZATION_ATTEMPTS = 2;
export const PDF_RENDER_TIMEOUT_MS = 30_000;

export type ExtractedPdfPage = {
  pageNumber: number;
  textLayer: string;
  formText?: string;
  ocrText?: string;
  ocrConfidence?: number;
  includeOcrAlongsideTextLayer?: boolean;
};

export type PdfJsTextItemLike = {
  str?: unknown;
  hasEOL?: unknown;
  transform?: unknown;
};

type PositionedPdfTextItem = {
  text: string;
  x: number;
  y: number;
};

export type DocumentExtractionDecision = {
  status: "accept" | "accept-with-warning" | "reject";
  failedOcrPages: number[];
};

export type PdfPageCoverage = {
  pageNumber: number;
  status: "text-present" | "ocr-failed" | "no-text" | "low-confidence";
  textCharacters: number;
};

/** Text presence does not prove that every clinical statement was recognized correctly. */
export function inspectPdfPageCoverage(pages: ExtractedPdfPage[], failedOcrPages: number[] = []): PdfPageCoverage[] {
  const failed = new Set(failedOcrPages);
  return [...pages].sort((a, b) => a.pageNumber - b.pageNumber).map(page => {
    const textCharacters = countMeaningfulTextCharacters(selectPreferredPageText(page));
    return {
      pageNumber: page.pageNumber,
      textCharacters,
      status: failed.has(page.pageNumber) ? "ocr-failed"
        : textCharacters === 0 ? "no-text"
        : typeof page.ocrConfidence === "number" && page.ocrConfidence < 80 ? "low-confidence"
        : "text-present",
    };
  });
}

export function assertCompleteAnamnesisPageCapture(pages: ExtractedPdfPage[], expectedPages: number, failedOcrPages: number[] = []): void {
  const coverage = inspectPdfPageCoverage(pages, failedOcrPages);
  const seen = new Set(coverage.map(page => page.pageNumber));
  if (!Number.isInteger(expectedPages) || expectedPages < 1 || seen.size !== coverage.length || coverage.some(page => !Number.isInteger(page.pageNumber) || page.pageNumber < 1 || page.pageNumber > expectedPages)) {
    throw new Error("Anamnese-Seitenprüfung: Die Seitenzuordnung ist unvollständig oder widersprüchlich. Das Original bleibt unverändert; bitte erneut auslesen.");
  }
  const missing = Array.from({ length: expectedPages }, (_, index) => index + 1).filter(page => !seen.has(page));
  const unresolved = [...new Set([...missing, ...coverage.filter(page => page.status === "ocr-failed" || page.status === "no-text").map(page => page.pageNumber)])].sort((a, b) => a - b);
  if (unresolved.length) {
    throw new Error(`Anamnese-Seitenprüfung: Seite(n) ${unresolved.join(", ")} von ${expectedPages} sind nicht vollständig erfasst. Das Original bleibt unverändert; bitte diese Seiten auf Lesbarkeit oder Leerseiten prüfen und fehlende Angaben vor einer vollständigen Auswertung manuell erfassen.`);
  }
}

export type ClinicalPdfFailure = {
  kind: "password" | "text" | "privacy" | "format" | "technical";
  label: string;
  message: string;
};

export function classifyClinicalPdfFailure(error: unknown): ClinicalPdfFailure {
  const candidate = error as { name?: unknown; message?: unknown } | null;
  const name = String(candidate?.name || "");
  const message = String(candidate?.message || "");
  if (message.startsWith("Anamnese-Seitenprüfung:")) {
    return { kind: "text", label: "Seitenprüfung offen", message };
  }
  if (name === "PasswordException" || /password|passwort|kennwort/i.test(message)) {
    return { kind: "password", label: "Passwort", message: "Passwort fehlt, wurde abgebrochen oder ist falsch." };
  }
  if (/PDF-Schwärzung|PDF-Schwärzungen|PDF-Schwärzungsüberlappung|Schwärzungsbereich|Befundtext würde unleserlich|PDF-Stelle benötigt eine eindeutige Schwärzung/iu.test(message)) {
    return {
      kind: "privacy",
      label: "PDF-Schwärzung prüfen",
      message: "Die anonymisierte PDF-Kopie konnte nicht sicher erstellt werden: Eine Schwärzung ist uneindeutig oder würde benachbarten Inhalt verändern. Die Datei wurde nicht ins Fallarchiv übernommen; das Original bleibt unverändert.",
    };
  }
  if (/praktisch keinen auswertbaren text|kein auswertbarer dokumenttext|ocr|texterkennung/i.test(message)) {
    return { kind: "text", label: "OCR/Text", message: "Die PDF enthält auch nach lokaler OCR keinen ausreichend lesbaren Text." };
  }
  if (/nur pdf|application\/pdf|dateiformat/i.test(message)) {
    return { kind: "format", label: "Dateiformat", message: "Nur PDF-Dateien sind in diesem geschützten Import zugelassen." };
  }
  if (/datenschutz|identifikator|pseudonym/i.test(message)) {
    const categories = /Datenschutz-Sicherheitsstopp:\s*(.+?)\s+konnte/iu.exec(message)?.[1];
    return {
      kind: "privacy",
      label: "Datenschutz",
      message: categories
        ? `Erkannte Kategorie: ${categories}. Die betroffene Restzeile konnte nicht sicher entfernt werden; die Datei wurde nicht übernommen.`
        : "Direkte Identifikatoren konnten nicht zuverlässig entfernt werden; die Datei wurde nicht übernommen.",
    };
  }
  return { kind: "technical", label: "Technischer Fehler", message: "Die PDF konnte lokal nicht verarbeitet werden. Bitte Datei und Browser prüfen." };
}

export type TerminableWorkerSession = {
  worker?: { terminate: () => Promise<unknown> };
};

export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t\f\v ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function reconstructPdfTextLines(items: readonly unknown[], yTolerance = 2.5): string {
  const positioned: PositionedPdfTextItem[] = [];
  const unpositionedLines: string[] = [];
  let unpositionedLine: string[] = [];
  const flushUnpositionedLine = () => {
    if (unpositionedLine.length) unpositionedLines.push(unpositionedLine.join(" "));
    unpositionedLine = [];
  };

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object" || !("str" in rawItem)) continue;
    const item = rawItem as PdfJsTextItemLike;
    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = typeof transform[4] === "number" && Number.isFinite(transform[4])
      ? transform[4]
      : undefined;
    const y = typeof transform[5] === "number" && Number.isFinite(transform[5])
      ? transform[5]
      : undefined;
    const text = String(item.str ?? "").replace(/\s+/g, " ").trim();

    if (text && x !== undefined && y !== undefined) {
      positioned.push({ text, x, y });
    } else if (text) {
      unpositionedLine.push(text);
    }
    if (item.hasEOL === true && (x === undefined || y === undefined)) flushUnpositionedLine();
  }
  flushUnpositionedLine();

  const clusters: Array<{ y: number; items: PositionedPdfTextItem[] }> = [];
  for (const item of positioned.sort((left, right) => right.y - left.y || left.x - right.x)) {
    const cluster = clusters.find((candidate) => Math.abs(candidate.y - item.y) <= yTolerance);
    if (cluster) {
      cluster.items.push(item);
      cluster.y = cluster.items.reduce((sum, entry) => sum + entry.y, 0) / cluster.items.length;
    } else {
      clusters.push({ y: item.y, items: [item] });
    }
  }

  const positionedLines = clusters
    .sort((left, right) => right.y - left.y)
    .map((cluster) => cluster.items.sort((left, right) => left.x - right.x).map((item) => item.text).join(" "));
  return normalizeExtractedText([...positionedLines, ...unpositionedLines].join("\n"));
}

export function countMeaningfulTextCharacters(text: string): number {
  return normalizeExtractedText(text).replace(/\s/g, "").length;
}

export function shouldRunLocalOcr({ containsRasterImage, textLayer, force = false }: {
  containsRasterImage: boolean;
  textLayer: string;
  force?: boolean;
}): boolean {
  return force || (containsRasterImage && countMeaningfulTextCharacters(textLayer) < MIN_TEXT_PER_PAGE);
}

export function selectPreferredPageText(page: ExtractedPdfPage): string {
  const textLayer = normalizeExtractedText(escapeIAAFormMarkers(page.textLayer));
  const ocrText = normalizeExtractedText(escapeIAAFormMarkers(page.ocrText || ""));
  if (page.includeOcrAlongsideTextLayer && ocrText) {
    return normalizeExtractedText([textLayer, ocrText, page.formText].filter(Boolean).join("\n"));
  }
  if (countMeaningfulTextCharacters(textLayer) >= MIN_TEXT_PER_PAGE) return normalizeExtractedText([textLayer, page.formText].filter(Boolean).join("\n"));

  const preferred = countMeaningfulTextCharacters(ocrText) > countMeaningfulTextCharacters(textLayer)
    ? ocrText
    : textLayer;
  return normalizeExtractedText([preferred, page.formText].filter(Boolean).join("\n"));
}

export function hasPracticalDocumentText(pages: ExtractedPdfPage[]): boolean {
  const text = pages.map(selectPreferredPageText).join("\n");
  if (countMeaningfulTextCharacters(text) >= MIN_TEXT_PER_PAGE) return true;
  if (!/\p{L}{2}/u.test(text)) return false;

  const valueWithUnit = /(?:^|\s|[<>=])\d+(?:[.,]\d+)?\s*(?:%|mg(?:\/[a-z]+)?|µg(?:\/[a-z]+)?|ug(?:\/[a-z]+)?|ng(?:\/[a-z]+)?|g\/[a-z]+|(?:m|p|µ|u)?mol\/[a-z]+|m?iu\/[a-z]+|u\/[a-z]+|iu|i\.?e\.?|g|kg|ml|l|cm|mmhg|tropfen|tabletten?|tbl\.?|kapseln?)(?=\s|$|[,;])/i;
  const dosageSchedule = /\b\d+(?:[.,]\d+)?\s*-\s*\d+(?:[.,]\d+)?\s*-\s*\d+(?:[.,]\d+)?\b/;
  return valueWithUnit.test(text) || dosageSchedule.test(text);
}

export function assessDocumentExtraction(
  pages: ExtractedPdfPage[],
  failedOcrPages: number[] = [],
): DocumentExtractionDecision {
  const uniqueFailedPages = Array.from(new Set(failedOcrPages)).sort((left, right) => left - right);
  if (!hasPracticalDocumentText(pages)) return { status: "reject", failedOcrPages: uniqueFailedPages };
  return {
    status: uniqueFailedPages.length ? "accept-with-warning" : "accept",
    failedOcrPages: uniqueFailedPages,
  };
}

export async function terminateAndResetWorkerSession(session: TerminableWorkerSession): Promise<boolean> {
  const worker = session.worker;
  session.worker = undefined;
  if (!worker) return true;
  try {
    await worker.terminate();
    return true;
  } catch {
    return false;
  }
}

export async function waitForPdfRender(
  renderTask: { promise: Promise<unknown>; cancel: () => void },
  signal?: AbortSignal,
  timeoutMs = PDF_RENDER_TIMEOUT_MS,
  onVisibilityChange?: (hidden: boolean) => void,
): Promise<void> {
  if (signal?.aborted) {
    renderTask.cancel();
    throw new DOMException("PDF-Rendering wurde abgebrochen.", "AbortError");
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let remainingMs = timeoutMs;
    let runningSince: number | undefined;
    const visibilityDocument = typeof document === "undefined" ? undefined : document;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      visibilityDocument?.removeEventListener("visibilitychange", updateVisibility);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => {
      renderTask.cancel();
      finish(() => reject(new DOMException("PDF-Rendering wurde abgebrochen.", "AbortError")));
    };
    // PDF.js display rendering pauses requestAnimationFrame in hidden tabs.
    // Preserve the remaining visible-time budget across tab switches.
    const updateVisibility = () => {
      if (settled) return;
      if (runningSince !== undefined) remainingMs -= performance.now() - runningSince;
      runningSince = undefined;
      clearTimeout(timeout);
      const hidden = visibilityDocument?.visibilityState === "hidden";
      onVisibilityChange?.(hidden);
      if (hidden) return;
      runningSince = performance.now();
      timeout = setTimeout(() => {
        if (visibilityDocument?.visibilityState === "hidden") { updateVisibility(); return; }
        renderTask.cancel();
        finish(() => reject(new Error("Zeitüberschreitung beim lokalen Rendern der PDF-Seite.")));
      }, Math.max(0, remainingMs));
    };
    visibilityDocument?.addEventListener("visibilitychange", updateVisibility);
    signal?.addEventListener("abort", onAbort, { once: true });
    updateVisibility();
    renderTask.promise.then(
      () => finish(resolve),
      (error) => finish(() => reject(error)),
    );
  });
}

export function assembleExtractedPdfPages(pages: ExtractedPdfPage[]): string {
  return [...pages]
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map((page) => `--- Seite ${page.pageNumber} ---\n${selectPreferredPageText(page)}`)
    .join("\n\n");
}

export function calculateOcrRenderScale(
  widthAtScaleOne: number,
  heightAtScaleOne: number,
  targetScale = TARGET_OCR_RENDER_SCALE,
  maxPixels = MAX_OCR_PAGE_PIXELS,
): number {
  const basePixels = Math.max(1, widthAtScaleOne * heightAtScaleOne);
  return Math.min(targetScale, Math.sqrt(maxPixels / basePixels));
}
