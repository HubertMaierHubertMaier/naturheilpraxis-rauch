export const MIN_TEXT_PER_PAGE = 40;
export const MAX_OCR_PAGE_PIXELS = 10_000_000;
export const TARGET_OCR_RENDER_SCALE = 2.5;
export const MAX_OCR_WORKER_INITIALIZATION_ATTEMPTS = 2;
export const PDF_RENDER_TIMEOUT_MS = 30_000;

export type ExtractedPdfPage = {
  pageNumber: number;
  textLayer: string;
  ocrText?: string;
};

export type DocumentExtractionDecision = {
  status: "accept" | "accept-with-warning" | "reject";
  failedOcrPages: number[];
};

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

export function countMeaningfulTextCharacters(text: string): number {
  return normalizeExtractedText(text).replace(/\s/g, "").length;
}

export function shouldRunLocalOcr({ containsRasterImage, textLayer }: {
  containsRasterImage: boolean;
  textLayer: string;
}): boolean {
  return containsRasterImage && countMeaningfulTextCharacters(textLayer) < MIN_TEXT_PER_PAGE;
}

export function selectPreferredPageText(page: ExtractedPdfPage): string {
  const textLayer = normalizeExtractedText(page.textLayer);
  if (countMeaningfulTextCharacters(textLayer) >= MIN_TEXT_PER_PAGE) return textLayer;

  const ocrText = normalizeExtractedText(page.ocrText || "");
  return countMeaningfulTextCharacters(ocrText) > countMeaningfulTextCharacters(textLayer)
    ? ocrText
    : textLayer;
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
): Promise<void> {
  if (signal?.aborted) {
    renderTask.cancel();
    throw new DOMException("PDF-Rendering wurde abgebrochen.", "AbortError");
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => {
      renderTask.cancel();
      finish(() => reject(new DOMException("PDF-Rendering wurde abgebrochen.", "AbortError")));
    };
    const timeout = setTimeout(() => {
      renderTask.cancel();
      finish(() => reject(new Error("Zeitüberschreitung beim lokalen Rendern der PDF-Seite.")));
    }, timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
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
