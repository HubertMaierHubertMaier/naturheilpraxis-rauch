import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileUp, X, CheckCircle2, FileText, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logTherapyEvent } from "./therapyEventLog";
import { deidentifyClinicalText, directIdentifierCategories } from "../../../../supabase/functions/_shared/clinicalDeidentification";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  assessDocumentExtraction,
  assembleExtractedPdfPages,
  calculateOcrRenderScale,
  MAX_OCR_WORKER_INITIALIZATION_ATTEMPTS,
  shouldRunLocalOcr,
  terminateAndResetWorkerSession,
  waitForPdfRender,
  type ExtractedPdfPage,
} from "@/lib/clinicalPdfExtraction";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Props {
  onExtracted: (text: string, sourcePseudonymId: string) => void;
  pseudonymId?: string;
  ocrMode?: "doctor" | "lab";
  label?: string;
}

type PendingFile = {
  file: File;
  status: "queued" | "processing" | "done" | "error";
  pages?: number;
  chars?: number;
  ocrPages?: number;
  ocrFailedPages?: number[];
  progress?: string;
  error?: string;
  piiHits?: PiiHit[];
};

export type PiiHit = { kind: string };

export function scanForPatientPII(input: string): PiiHit[] {
  return directIdentifierCategories(input).map((kind) => ({ kind }));
}

export type ClinicalDocumentExtractionResult = {
  text: string;
  pages?: number;
  chars: number;
  ocrPages?: number;
  ocrFailedPages?: number[];
  removedIdentifierCategories?: string[];
};

type ToastFn = (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};
type OcrExtractionSession = {
  worker?: OcrWorker;
  handleProgress?: (progress: { status: string; progress: number }) => void;
  initializationAttempts?: number;
  signal?: AbortSignal;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("PDF-Verarbeitung wurde abgebrochen.", "AbortError");
}

const pdfOperatorIds = pdfjs.OPS as unknown as Record<string, number>;
const rasterImageOperatorIds = new Set([
  pdfOperatorIds.paintImageXObject,
  pdfOperatorIds.paintInlineImageXObject,
  pdfOperatorIds.paintImageMaskXObject,
  pdfOperatorIds.paintJpegXObject,
].filter((value): value is number => Number.isFinite(value)));

export async function extractClinicalDocumentText(
  file: File,
  _mode: "doctor" | "lab" = "doctor",
  notify?: ToastFn,
  onProgress?: (status: string) => void,
  sharedOcrSession?: OcrExtractionSession,
): Promise<ClinicalDocumentExtractionResult> {
  if (file.type.startsWith("image/")) {
    throw new Error("Datenschutz-Stopp: Bilder werden nicht an eine externe OCR gesendet. Bitte den sicheren PDF-Import verwenden.");
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Im Datenschutzmodus sind in diesem Import nur PDFs erlaubt.");
  }

  const ocrSession = sharedOcrSession || {};
  const ownsOcrSession = !sharedOcrSession;
  const signal = ocrSession.signal;
  throwIfAborted(signal);
  const fileData = await file.arrayBuffer();
  throwIfAborted(signal);
  const loadingTask = pdfjs.getDocument({ data: fileData });
  let destroyLoadingTaskPromise: Promise<void> | undefined;
  const destroyLoadingTask = () => {
    destroyLoadingTaskPromise ||= loadingTask.destroy();
    return destroyLoadingTaskPromise;
  };
  const abortLoadingTask = () => { void destroyLoadingTask(); };
  signal?.addEventListener("abort", abortLoadingTask, { once: true });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (error) {
    await destroyLoadingTask();
    throw error;
  }
  const totalPages = doc.numPages;
  const pages: ExtractedPdfPage[] = [];
  let ocrPageCount = 0;
  const failedOcrPages: number[] = [];
  let currentOcrPage = 0;
  ocrSession.handleProgress = (progress) => {
    if (progress.status === "loading language traineddata") {
      onProgress?.("Lokale OCR: deutsche und englische Sprachdaten werden geladen...");
    } else if (progress.status === "recognizing text") {
      onProgress?.(`Lokale OCR: Seite ${currentOcrPage} von ${totalPages} (${Math.round(progress.progress * 100)} %)`);
    }
  };

  try {
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      throwIfAborted(signal);
      const page = await doc.getPage(pageNumber);
      try {
        const operators = await page.getOperatorList();
        const containsRasterImage = operators.fnArray.some((operatorId) => rasterImageOperatorIds.has(operatorId));
        const content = await page.getTextContent();
        const pageText = content.items.map((item: unknown) => (
          item && typeof item === "object" && "str" in item ? String((item as { str: unknown }).str) : ""
        )).join(" ").trim();
        const extractedPage: ExtractedPdfPage = { pageNumber, textLayer: pageText };

        if (shouldRunLocalOcr({ containsRasterImage, textLayer: pageText })) {
          let canvas: HTMLCanvasElement | undefined;
          try {
            throwIfAborted(signal);
            if (!ocrSession.worker) {
              const attempts = ocrSession.initializationAttempts || 0;
              if (attempts >= MAX_OCR_WORKER_INITIALIZATION_ATTEMPTS) {
                throw new Error("Lokale OCR konnte in diesem Lauf nicht erneut gestartet werden.");
              }
              ocrSession.initializationAttempts = attempts + 1;
              onProgress?.("Lokale OCR wird vorbereitet; deutsche und englische Sprachdaten werden beim ersten Mal aus der Anwendung geladen.");
              notify?.({
                title: "Lokale Browser-OCR gestartet",
                description: "Nur OCR-Programm- und Sprachdaten werden aus dieser Anwendung geladen. PDF- und Bilddaten bleiben im Browser und gehen an keinen OCR-Cloud-Dienst.",
              });
              const { createLocalBrowserOcrWorker } = await import("@/lib/localBrowserOcr");
              ocrSession.worker = await createLocalBrowserOcrWorker(
                (progress) => ocrSession.handleProgress?.(progress),
                signal,
              );
            }

            currentOcrPage = pageNumber;
            onProgress?.(`Lokale OCR: Seite ${pageNumber} von ${totalPages} wird lokal erkannt...`);
            const viewportAtScaleOne = page.getViewport({ scale: 1 });
            const scale = calculateOcrRenderScale(viewportAtScaleOne.width, viewportAtScaleOne.height);
            const viewport = page.getViewport({ scale });
            canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.floor(viewport.width));
            canvas.height = Math.max(1, Math.floor(viewport.height));
            const canvasContext = canvas.getContext("2d", { alpha: false });
            if (!canvasContext) throw new Error("Lokale OCR konnte keine sichere Canvas-Arbeitsfläche anlegen.");
            const renderTask = page.render({ canvas, canvasContext, viewport, background: "rgb(255,255,255)" });
            await waitForPdfRender(renderTask, signal);
            throwIfAborted(signal);
            extractedPage.ocrText = (await ocrSession.worker.recognize(canvas)).data.text;
            ocrPageCount += 1;
          } catch (error) {
            throwIfAborted(signal);
            failedOcrPages.push(pageNumber);
            await terminateAndResetWorkerSession(ocrSession);
          } finally {
            if (canvas) {
              canvas.width = 1;
              canvas.height = 1;
            }
          }
        }

        pages.push(extractedPage);
      } finally {
        page.cleanup();
      }
    }
  } finally {
    ocrSession.handleProgress = undefined;
    try {
      if (ownsOcrSession) await terminateAndResetWorkerSession(ocrSession);
    } finally {
      signal?.removeEventListener("abort", abortLoadingTask);
      await destroyLoadingTask();
    }
  }

  const decision = assessDocumentExtraction(pages, failedOcrPages);
  if (decision.status === "reject") {
    notify?.({
      title: "Kein auswertbarer Dokumenttext",
      description: failedOcrPages.length
        ? "Textebene und lokale Browser-OCR haben im gesamten Dokument praktisch keinen Text erkannt; einzelne OCR-Seiten sind fehlgeschlagen."
        : "Textebene und lokale Browser-OCR haben im gesamten Dokument praktisch keinen Text erkannt.",
      variant: "destructive",
    });
    throw new Error("Diese PDF enthält auch nach lokaler Browser-OCR praktisch keinen auswertbaren Text.");
  }
  if (decision.status === "accept-with-warning") {
    notify?.({
      title: "PDF mit OCR-Hinweis übernommen",
      description: `Lokale OCR war auf Seite(n) ${decision.failedOcrPages.join(", ")} nicht möglich. Vorhandener Dokumenttext wurde weiterverarbeitet.`,
    });
  }

  const joined = assembleExtractedPdfPages(pages);
  const removedIdentifierCategories = directIdentifierCategories(joined);
  const safeBody = deidentifyClinicalText(joined);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(safeBody));
  const documentId = Array.from(new Uint8Array(digest)).slice(0, 6).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const text = `=== 📄 Dokument-${documentId} (${totalPages} S.) ===\n${safeBody}`;
  const residualIdentifiers = directIdentifierCategories(text);
  if (residualIdentifiers.length) {
    throw new Error(`Datenschutz-Sicherheitsstopp: ${residualIdentifiers.join(", ")} konnte nicht zuverlässig entfernt werden.`);
  }
  return {
    text,
    pages: totalPages,
    chars: text.length,
    ocrPages: ocrPageCount,
    ocrFailedPages: decision.failedOcrPages,
    removedIdentifierCategories,
  };
}

export function MultiDocUpload({ onExtracted, pseudonymId, ocrMode = "doctor", label = "PDF hochladen" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pseudonymIdRef = useRef(pseudonymId);
  const extractionRunRef = useRef(0);
  const activeExtractionRef = useRef<{ controller: AbortController; ocrSession: OcrExtractionSession }>();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  pseudonymIdRef.current = pseudonymId;

  useEffect(() => {
    extractionRunRef.current += 1;
    const activeExtraction = activeExtractionRef.current;
    activeExtractionRef.current = undefined;
    activeExtraction?.controller.abort();
    if (activeExtraction) void terminateAndResetWorkerSession(activeExtraction.ocrSession);
    setFiles([]);
    setLoading(false);
    return () => {
      extractionRunRef.current += 1;
      const activeOnCleanup = activeExtractionRef.current;
      activeExtractionRef.current = undefined;
      activeOnCleanup?.controller.abort();
      if (activeOnCleanup) void terminateAndResetWorkerSession(activeOnCleanup.ocrSession);
    };
  }, [pseudonymId]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setFiles((previous) => [
      ...previous,
      ...Array.from(list).map((file) => ({ file, status: "queued" as const })),
    ]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (index: number) => setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));

  const runExtraction = async () => {
    if (!files.length) return;
    const runId = ++extractionRunRef.current;
    const sourcePseudonymId = (pseudonymId || "").trim();
    const scopeIsCurrent = () => runId === extractionRunRef.current
      && (pseudonymIdRef.current || "").trim() === sourcePseudonymId;
    const scopedToast: ToastFn = (message) => {
      if (scopeIsCurrent()) toast(message);
    };
    const previousExtraction = activeExtractionRef.current;
    previousExtraction?.controller.abort();
    if (previousExtraction) await terminateAndResetWorkerSession(previousExtraction.ocrSession);
    if (!scopeIsCurrent()) return;

    const controller = new AbortController();
    const ocrSession: OcrExtractionSession = { signal: controller.signal, initializationAttempts: 0 };
    activeExtractionRef.current = { controller, ocrSession };
    setLoading(true);
    let combined = "";
    const updated = [...files];

    try {
      for (let index = 0; index < updated.length; index += 1) {
        throwIfAborted(controller.signal);
        if (updated[index].status === "done") continue;
        updated[index] = { ...updated[index], status: "processing", progress: "PDF-Textebene wird lokal geprüft...", error: undefined };
        setFiles([...updated]);
        try {
          const extracted = await extractClinicalDocumentText(updated[index].file, ocrMode, scopedToast, (progress) => {
            if (!scopeIsCurrent()) return;
            updated[index] = { ...updated[index], progress };
            setFiles([...updated]);
          }, ocrSession);
          if (!scopeIsCurrent()) return;
          const piiHits = (extracted.removedIdentifierCategories || []).map((kind) => ({ kind }));
          combined = [combined, extracted.text].filter(Boolean).join("\n\n");
          updated[index] = {
            ...updated[index],
            status: "done",
            chars: extracted.chars,
            pages: extracted.pages,
            ocrPages: extracted.ocrPages,
            ocrFailedPages: extracted.ocrFailedPages,
            progress: undefined,
            piiHits,
          };
        } catch (error) {
          if (!scopeIsCurrent()) return;
          updated[index] = {
            ...updated[index],
            status: "error",
            progress: undefined,
            error: (error as Error).message || "Fehler",
          };
        }
        setFiles([...updated]);
      }
      await terminateAndResetWorkerSession(ocrSession);
      if (!scopeIsCurrent()) return;

      const successDocs = updated.filter((item) => item.status === "done");
      const failed = updated.filter((item) => item.status === "error");
      const withPii = successDocs.filter((item) => item.piiHits?.length);

      if (withPii.length) {
        const categories = Array.from(new Set(withPii.flatMap((item) => (item.piiHits || []).map((hit) => hit.kind))));
        toast({
          title: "Identifikatoren lokal entfernt",
          description: `${categories.join(", ")} wurden vor Analyse und Speicherung entfernt.`,
        });
        await logTherapyEvent(sourcePseudonymId, "pii_warning", {
          document_count: withPii.length,
          identifier_categories: categories,
          note: "Identifikatoren lokal entfernt; keine Klartext-Treffer oder Dateinamen gespeichert.",
        });
      }
      if (!scopeIsCurrent()) return;

      if (combined.trim()) {
        onExtracted(combined.trim(), sourcePseudonymId);
        if (!scopeIsCurrent()) return;
        toast({ title: "Inhalte datenschutzbereinigt übernommen", description: `${successDocs.length} Datei(en) verarbeitet; Originale nicht archiviert.` });
        await logTherapyEvent(sourcePseudonymId, "documents_uploaded", {
          document_count: successDocs.length,
          total_pages: successDocs.reduce((sum, item) => sum + Number(item.pages || 0), 0),
          total_chars: successDocs.reduce((sum, item) => sum + Number(item.chars || 0), 0),
          original_archived: false,
          privacy_mode: "local-deidentification",
          local_ocr_pages: successDocs.reduce((sum, item) => sum + Number(item.ocrPages || 0), 0),
          local_ocr_failed_pages: successDocs.reduce((sum, item) => sum + Number(item.ocrFailedPages?.length || 0), 0),
          failed_count: failed.length,
        });
      } else if (failed.length) {
        toast({ title: "Keine Daten extrahiert", description: failed[0].error, variant: "destructive" });
      }
    } finally {
      controller.abort();
      await terminateAndResetWorkerSession(ocrSession);
      if (activeExtractionRef.current?.ocrSession === ocrSession) activeExtractionRef.current = undefined;
      if (scopeIsCurrent()) setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(event) => addFiles(event.target.files)}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading} className="gap-1.5">
          <FileUp className="h-3.5 w-3.5" />
          {label}
        </Button>
        {files.length > 0 && (
          <Button type="button" size="sm" onClick={runExtraction} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {loading ? "Verarbeite..." : `${files.length} Datei(en) sicher auslesen`}
          </Button>
        )}
      </div>

      {files.length > 0 && (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 space-y-1">
          {files.map((pending, index) => (
            <div key={`${pending.file.name}-${index}`} className="flex items-center gap-2 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="truncate flex-1" title={pending.file.name}>{pending.file.name}</span>
              <span className="text-muted-foreground whitespace-nowrap">
                {(pending.file.size / 1024).toFixed(0)} KB{pending.pages ? ` · ${pending.pages} S.` : ""}
              </span>
              {!!pending.piiHits?.length && (
                <span className="flex items-center gap-1 text-amber-700 text-[10px] whitespace-nowrap" title={pending.piiHits.map((hit) => hit.kind).join("\n")}>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  bereinigt
                </span>
              )}
              {pending.status === "processing" && (
                <span className="flex max-w-[360px] items-center gap-1 truncate text-primary text-[10px] whitespace-nowrap" title={pending.progress}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {pending.progress || "Lokale Verarbeitung..."}
                </span>
              )}
              {pending.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              {pending.status === "done" && !!pending.ocrPages && <span className="text-muted-foreground text-[10px]">{pending.ocrPages} OCR-S.</span>}
              {pending.status === "done" && !!pending.ocrFailedPages?.length && (
                <span className="text-amber-700 text-[10px]" title={`OCR nicht möglich auf Seite(n) ${pending.ocrFailedPages.join(", ")}`}>
                  OCR-Hinweis
                </span>
              )}
              {pending.status === "error" && <span className="max-w-[320px] truncate text-rose-700 text-[10px]" title={pending.error}>Fehler: {pending.error}</span>}
              {!loading && pending.status !== "processing" && (
                <button type="button" onClick={() => removeAt(index)} className="text-muted-foreground hover:text-rose-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            Datenschutzmodus: PDF-Textebenen werden bevorzugt. Nur textarme Rasterseiten werden per OCR lokal im Browser erkannt. Beim ersten OCR-Lauf lädt der Browser OCR-Programm- und Sprachdaten (Deutsch/Englisch) aus dieser Anwendung; nur diese Programmdaten werden geladen. PDF-, Canvas- und Bilddaten bleiben im Browser und gehen an keinen OCR-Cloud-Dienst. Direkte Identifikatoren werden vor Analyse und Speicherung entfernt; Originaldateien werden nicht archiviert.
          </p>
        </div>
      )}
    </div>
  );
}
