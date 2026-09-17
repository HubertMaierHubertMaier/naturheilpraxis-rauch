import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileUp, X, CheckCircle2, FileText, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logTherapyEvent } from "./therapyEventLog";
import {
  collectLocalPrivacyFindings,
  deidentifyClinicalText,
  directIdentifierCategories,
  quarantineResidualDirectIdentifierLines,
  removeResidualDirectIdentifierLines,
  type LocalPrivacyFinding,
} from "../../../../supabase/functions/_shared/clinicalDeidentification";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  assertCompleteAnamnesisPageCapture,
  assessDocumentExtraction,
  assembleExtractedPdfPages,
  calculateOcrRenderScale,
  classifyClinicalPdfFailure,
  MAX_OCR_WORKER_INITIALIZATION_ATTEMPTS,
  reconstructPdfTextLines,
  shouldRunLocalOcr,
  terminateAndResetWorkerSession,
  waitForPdfRender,
  type ExtractedPdfPage,
} from "@/lib/clinicalPdfExtraction";
import { addAnalysisDocumentMetadata, createNeutralDocumentId } from "@/lib/patientInputPersistence";
import {
  ANAMNESE_OCR_LOW_CONFIDENCE_THRESHOLD,
  buildAnamneseQuestionReview,
  type AnamneseOcrPageConfidence,
} from "@/lib/anamneseOcrMapping";
import { RedactedTextPreview } from "./RedactedTextPreview";
import { iaaCaptureStatusText, iaaFormValuesText } from "@/lib/iaaAssessment";
import { anamnesisProfileFormValuesText } from "@/lib/anamnesisProfileForm";
import { supabase } from "@/integrations/supabase/client";
import { archiveCopyAfterPreviewTextEdit, archivePatientOriginal, assertCompletePdfArchiveCopies, verifyArchivedPatientOriginal, type ArchiveOriginals, type OriginalArchiveKind, type OriginalArchiveReceipt } from "@/lib/patientOriginalArchive";
import { normalizePatientPseudonym } from "../../../../supabase/functions/_shared/patientPseudonym";
import { extractClinicalOfficeText } from "@/lib/clinicalOfficeExtraction";
import { CLINICAL_DOCUMENT_ACCEPT } from "@/lib/clinicalDocumentFormats";
import { createLocalBrowserOcrWorker, type LocalOcrResultData } from "@/lib/localBrowserOcr";
import { rememberPdfOcrRead } from "@/lib/pdfReadOcrCache";
import { discardPreparedAnonymizedPdfArchive, prepareAnonymizedPdfArchive, rememberValidatedPdfPassword, openPdfArchiveCopy, setPdfArchiveCopyReviewed } from "@/lib/anonymizedPdfArchive";
import { applyManualPdfTextRedactions } from "@/lib/manualPdfTextRedaction";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Props {
  onExtracted: (text: string, sourcePseudonymId: string, archiveOriginals: ArchiveOriginals) => void | Promise<void>;
  archiveKind?: OriginalArchiveKind;
  accept?: string;
  extractText?: typeof extractClinicalDocumentText;
  pseudonymId?: string;
  ocrMode?: "doctor" | "lab";
  label?: string;
  documentDate?: string;
  documentType?: string;
  requireDocumentDate?: boolean;
  pdfPassword?: string;
  onPdfPasswordChange?: (value: string) => void;
}

type PendingFile = {
  file: File;
  archiveCopy?: File;
  status: "queued" | "processing" | "done" | "error";
  pages?: number;
  chars?: number;
  ocrPages?: number;
  ocrFailedPages?: number[];
  ocrPageConfidences?: AnamneseOcrPageConfidence[];
  anamneseMappedAnswers?: number;
  anamneseManualReviewItems?: number;
  progress?: string;
  error?: string;
  errorKind?: string;
  piiHits?: PiiHit[];
  localPrivacyFindings?: LocalPrivacyFinding[];
  extractedReviewBody?: string;
};

type PendingPrivacyReview = {
  text: string;
  documentDate?: string;
  archivedOriginals?: OriginalArchiveReceipt[];
  sourcePseudonymId: string;
  documentCount: number;
  totalPages: number;
  totalChars: number;
  localOcrPages: number;
  localOcrFailedPages: number;
  failedCount: number;
  identifierCategories: string[];
  anamneseMappedAnswers: number;
  anamneseManualReviewItems: number;
  anamneseLowConfidencePages: number[];
  localPrivacyFindings?: LocalPrivacyFinding[];
};

const isPdfFile = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const pendingPrivacyReviewKey = (pseudonymId: string, documentType: string) =>
  `therapy.pendingPrivacyReview.v1:${pseudonymId}:${documentType}`;

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
  ocrPageConfidences?: AnamneseOcrPageConfidence[];
  removedIdentifierCategories?: string[];
  localPrivacyFindings?: LocalPrivacyFinding[];
};

type ToastFn = (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
type OcrWorker = {
  recognize: (image: HTMLCanvasElement, options?: { includeLayout?: boolean }) => Promise<{ data: LocalOcrResultData }>;
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
  mode: "doctor" | "lab" | "anamnese" = "doctor",
  notify?: ToastFn,
  onProgress?: (status: string) => void,
  sharedOcrSession?: OcrExtractionSession,
  identitySalt = "",
  pdfPassword = "",
  onPasswordCaptured?: (password: string) => void,
): Promise<ClinicalDocumentExtractionResult> {
  if (file.type.startsWith("image/")) {
    throw new Error("Datenschutz-Stopp: Bilder werden nicht an eine externe OCR gesendet. Bitte den sicheren PDF-Import verwenden.");
  }
  if (/\.(docx|xlsx)$/i.test(file.name)) {
    throwIfAborted(sharedOcrSession?.signal);
    onProgress?.("Word-/Excel-Inhalte werden lokal gelesen und datenschutzbereinigt...");
    const office = await extractClinicalOfficeText(file);
    throwIfAborted(sharedOcrSession?.signal);
    const raw = [office.text, ...office.warnings.map(warning => `Lokaler Prüfhinweis: ${warning}`), mode === "anamnese" ? iaaCaptureStatusText(false, false) : ""].filter(Boolean).join("\n\n");
    const removedIdentifierCategories = directIdentifierCategories(raw);
    const localPrivacyFindings = collectLocalPrivacyFindings(raw);
    const safeBody = quarantineResidualDirectIdentifierLines(removeResidualDirectIdentifierLines(deidentifyClinicalText(raw)));
    if (!safeBody.trim() || directIdentifierCategories(safeBody).length) throw new Error("Datenschutzprüfung der Office-Datei erforderlich; noch keine Übernahme.");
    const documentId = await createNeutralDocumentId(safeBody, identitySalt);
    const text = `=== KLINISCHES DOKUMENT ${documentId} ===\nDokumentformat: ${office.format === "docx" ? "Word; Absatzangaben" : "Excel; Blatt- und Zellangaben"}\n${safeBody}`;
    return { text, chars: text.length, pages: 0, ocrPages: 0, ocrFailedPages: [], ocrPageConfidences: [], removedIdentifierCategories, localPrivacyFindings };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Bitte PDF, Word (.docx) oder Excel (.xlsx) auswählen. Die Dateien werden lokal geprüft.");
  }

  const ocrSession = sharedOcrSession || {};
  const ownsOcrSession = !sharedOcrSession;
  const signal = ocrSession.signal;
  throwIfAborted(signal);
  const fileData = await file.arrayBuffer();
  throwIfAborted(signal);
  const normalizedPassword = pdfPassword.trim();
  let passwordCancelled = false;
  let currentPassword = normalizedPassword;
  const loadingTask = pdfjs.getDocument({
    data: fileData,
    ...(normalizedPassword ? { password: normalizedPassword } : {}),
  });
  loadingTask.onPassword = (updatePassword: (password: string) => void, reason: number) => {
    const reasonText = reason === 2
      ? "Das eingegebene Passwort war falsch."
      : "Diese PDF ist passwortgeschützt.";
    const entered = window.prompt(`${reasonText}\nBitte das Vieva-Pro-PDF-Passwort eingeben:`, currentPassword);
    if (entered === null) {
      passwordCancelled = true;
      void loadingTask.destroy();
      return;
    }
    currentPassword = entered;
    updatePassword(entered);
  };
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
    rememberValidatedPdfPassword(file,currentPassword);
    if (currentPassword) onPasswordCaptured?.(currentPassword);
  } catch (error) {
    await destroyLoadingTask();
    if (passwordCancelled) throw new Error("PDF-Passwortabfrage abgebrochen.");
    throw error;
  }
  const totalPages = doc.numPages;
  const pages: ExtractedPdfPage[] = [];
  let ocrPageCount = 0;
  const failedOcrPages: number[] = [];
  let firstOcrFailureStage: "initialization" | "rendering" | "recognition" | undefined;
  const ocrPageConfidences: AnamneseOcrPageConfidence[] = [];
  let currentOcrPage = 0;
  let nativeIAAFieldsFound = false;
  let imageOnlyPageFound = false;
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
        const pageText = reconstructPdfTextLines(content.items);
        const formAnnotations = mode === "anamnese" ? await page.getAnnotations() : [];
        nativeIAAFieldsFound ||= formAnnotations.some(item => item.checkBox === true && /^iaa_.+?_\d+(?:_\d+)*_lvl[1-6]$/.test(String(item.fieldName || "")));
        imageOnlyPageFound ||= shouldRunLocalOcr({ containsRasterImage, textLayer: pageText });
        const extractedPage: ExtractedPdfPage = {
          pageNumber,
          textLayer: pageText,
          formText: mode === "anamnese" ? [iaaFormValuesText(formAnnotations, pageNumber), anamnesisProfileFormValuesText(formAnnotations, pageNumber)].filter(Boolean).join("\n\n") : undefined,
          includeOcrAlongsideTextLayer: mode === "anamnese",
        };

        if (shouldRunLocalOcr({ containsRasterImage, textLayer: pageText, force: mode === "anamnese" })) {
          let canvas: HTMLCanvasElement | undefined;
          let ocrStage: "initialization" | "rendering" | "recognition" = ocrSession.worker ? "rendering" : "initialization";
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
              // Loaded with the intake module: a failed lazy import must not remain cached for this page.
              ocrSession.worker = await createLocalBrowserOcrWorker(
                (progress) => ocrSession.handleProgress?.(progress),
                signal,
              );
            }

            ocrStage = "rendering";
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
            await waitForPdfRender(renderTask, signal, undefined, (hidden) => {
              onProgress?.(hidden
                ? `Lokale OCR pausiert: Bitte dieses Browserfenster sichtbar öffnen. Seite ${pageNumber} von ${totalPages} bleibt erhalten.`
                : `Lokale OCR: Seite ${pageNumber} von ${totalPages} wird lokal erkannt...`);
            });
            throwIfAborted(signal);
            ocrStage = "recognition";
            const recognition = (await ocrSession.worker.recognize(canvas,{includeLayout:true})).data;
            rememberPdfOcrRead(file,pageNumber,canvas.width,canvas.height,recognition);
            extractedPage.ocrText = recognition.text;
            if (Number.isFinite(recognition.confidence)) {
              extractedPage.ocrConfidence = Number(recognition.confidence);
              ocrPageConfidences.push({ pageNumber, confidence: Number(recognition.confidence) });
            }
            ocrPageCount += 1;
          } catch (error) {
            throwIfAborted(signal);
            firstOcrFailureStage ||= ocrStage;
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

  if (mode === "anamnese" && firstOcrFailureStage === "initialization") {
    throw new Error("Die lokale Texterkennung konnte nicht gestartet werden. Bitte die Bereitstellung der OCR-Programm- und Sprachdateien prüfen. Dies ist kein Nachweis einer unlesbaren Originaldatei; es wurde noch nichts vollständig übernommen.");
  }
  if (mode === "anamnese") assertCompleteAnamnesisPageCapture(pages, totalPages, failedOcrPages);
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

  const joined = [assembleExtractedPdfPages(pages), mode === "anamnese" ? iaaCaptureStatusText(nativeIAAFieldsFound, imageOnlyPageFound) : ""].filter(Boolean).join("\n\n");
  const removedIdentifierCategories = directIdentifierCategories(joined);
  const localPrivacyFindings = collectLocalPrivacyFindings(joined);
  const safeBody = quarantineResidualDirectIdentifierLines(
    removeResidualDirectIdentifierLines(deidentifyClinicalText(joined)),
  );
  const documentId = await createNeutralDocumentId(safeBody, identitySalt);
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
    ocrPageConfidences,
    removedIdentifierCategories,
    localPrivacyFindings,
  };
}

export const extractTherapyTemplateDocument: typeof extractClinicalDocumentText = async (
  file, mode, notify, onProgress, session, identitySalt = "", pdfPassword = "", onPasswordCaptured,
) => {
  const lower = file.name.toLowerCase();
  if (/\.(docx|xlsx)$/.test(lower) || file.type === "application/pdf" || lower.endsWith(".pdf")) {
    return extractClinicalDocumentText(file, mode, notify, onProgress, session, identitySalt, pdfPassword, onPasswordCaptured);
  }
  throwIfAborted(session?.signal);
  onProgress?.("Word-/Text-Dokument wird lokal gelesen...");
  let raw: string;
  if (lower.endsWith(".txt") || lower.endsWith(".md") || file.type === "text/plain") raw = await file.text();
  else throw new Error("Bitte PDF, Word (.docx), Excel (.xlsx) oder Text (.txt/.md) auswählen.");
  throwIfAborted(session?.signal);
  if (!raw.trim()) throw new Error("Das Dokument enthält keinen auslesbaren Text. Das Original wurde nicht verändert.");
  const removedIdentifierCategories = directIdentifierCategories(raw);
  const localPrivacyFindings = collectLocalPrivacyFindings(raw);
  const safeBody = quarantineResidualDirectIdentifierLines(removeResidualDirectIdentifierLines(deidentifyClinicalText(raw)));
  if (!safeBody.trim()) throw new Error("Nach der Datenschutzbereinigung bleibt kein auswertbarer Text. Das Original wurde nicht verändert.");
  const documentId = await createNeutralDocumentId(safeBody, identitySalt);
  throwIfAborted(session?.signal);
  const text = `=== KLINISCHES DOKUMENT ${documentId} ===\n${safeBody}`;
  if (directIdentifierCategories(text).length) throw new Error("Die Datenschutzbereinigung konnte nicht vollständig bestätigt werden.");
  return { text, chars: text.length, removedIdentifierCategories, localPrivacyFindings };
};

export function MultiDocUpload({ onExtracted, pseudonymId, archiveKind = "dokument", accept = CLINICAL_DOCUMENT_ACCEPT, extractText = extractClinicalDocumentText, ocrMode = "doctor", label = "Dokument auswählen", documentDate = "", documentType = "Befund", requireDocumentDate = false, pdfPassword = "", onPdfPasswordChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const pseudonymIdRef = useRef(pseudonymId);
  const extractionRunRef = useRef(0);
  const activeExtractionRef = useRef<{ controller: AbortController; ocrSession: OcrExtractionSession }>();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingReview, setPendingReview] = useState<PendingPrivacyReview>();
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [privacyFindingsRevealed, setPrivacyFindingsRevealed] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const pendingReviewRef = useRef(pendingReview);
  pendingReviewRef.current = pendingReview;
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
    setPendingReview(undefined);
    setPrivacyConfirmed(false);
    setPrivacyFindingsRevealed(false);
    setReviewSubmitting(false);
    const sourcePseudonymId = (pseudonymId || "").trim();
    if (sourcePseudonymId) {
      const key = pendingPrivacyReviewKey(sourcePseudonymId, documentType);
      try {
        const restored = JSON.parse(sessionStorage.getItem(key) || "null") as PendingPrivacyReview | null;
        if (restored?.sourcePseudonymId === sourcePseudonymId
          && restored.text?.trim()
          && directIdentifierCategories(restored.text).length === 0) {
          setPendingReview({ ...restored, localPrivacyFindings: undefined });
        }
      } catch {
        sessionStorage.removeItem(key);
      }
    }
    return () => {
      extractionRunRef.current += 1;
      const activeOnCleanup = activeExtractionRef.current;
      activeExtractionRef.current = undefined;
      activeOnCleanup?.controller.abort();
      if (activeOnCleanup) void terminateAndResetWorkerSession(activeOnCleanup.ocrSession);
    };
  }, [pseudonymId, documentType]);

  useEffect(() => {
    const sourcePseudonymId = (pseudonymId || "").trim();
    if (!sourcePseudonymId) return;
    const key = pendingPrivacyReviewKey(sourcePseudonymId, documentType);
    try {
      if (pendingReview?.text?.trim() && directIdentifierCategories(pendingReview.text).length === 0) {
        const { localPrivacyFindings: _localOnly, ...safeReview } = pendingReview;
        sessionStorage.setItem(key, JSON.stringify(safeReview));
      } else if (!pendingReview) {
        sessionStorage.removeItem(key);
      }
    } catch {}
  }, [documentType, pendingReview, pseudonymId]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const selectedFiles = Array.from(list);
    setPendingReview(undefined);
    setPrivacyConfirmed(false);
    setPrivacyFindingsRevealed(false);
    setFiles((previous) => [
      ...previous,
      ...selectedFiles.map((file) => ({ file, status: "queued" as const })),
    ]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (index: number) => {
    setPendingReview(undefined);
    setPrivacyConfirmed(false);
    setPrivacyFindingsRevealed(false);
    setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const runExtraction = async () => {
    if (!files.length) return;
    const extractionDocumentDate = documentDate.trim();
    let extractionPassword = pdfPassword.trim();
    if (requireDocumentDate && !extractionDocumentDate) {
      toast({ title: "Erstellungsdatum fehlt", description: "Bitte vor dem Auslesen das Datum der Analyse eintragen.", variant: "destructive" });
      return;
    }
    setPendingReview(undefined);
    setPrivacyConfirmed(false);
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
        if (updated[index].status === "done" && updated[index].extractedReviewBody) {
          const cached = extractionDocumentDate
            ? addAnalysisDocumentMetadata(updated[index].extractedReviewBody!, extractionDocumentDate, documentType)
            : updated[index].extractedReviewBody!;
          combined = [combined, cached].filter(Boolean).join("\n\n");
          updated[index] = { ...updated[index], chars: cached.length };
          continue;
        }
        updated[index] = { ...updated[index], status: "processing", progress: "PDF-Textebene wird lokal geprüft...", error: undefined };
        setFiles([...updated]);
        try {
          const extractionMode = documentType === "Anamnese / Anamnesebogen" ? "anamnese" : ocrMode;
          const extracted = await extractText(updated[index].file, extractionMode, scopedToast, (progress) => {
            if (!scopeIsCurrent()) return;
            updated[index] = { ...updated[index], progress };
            setFiles([...updated]);
          }, ocrSession, extractionDocumentDate ? `${documentType}|${extractionDocumentDate}` : "", extractionPassword, (capturedPassword) => {
            extractionPassword = capturedPassword;
            onPdfPasswordChange?.(capturedPassword);
          });
          if (!scopeIsCurrent()) return;
          const piiHits = (extracted.removedIdentifierCategories || []).map((kind) => ({ kind }));
          const archiveCopy = isPdfFile(updated[index].file)
            ? await prepareAnonymizedPdfArchive(updated[index].file, progress => {
              if (!scopeIsCurrent()) return;
              updated[index] = {...updated[index],progress};setFiles([...updated]);
            },scopeIsCurrent,sourcePseudonymId)
            : undefined;
          if (!scopeIsCurrent()) return;
          let sourceText = extracted.text;
          if (isPdfFile(updated[index].file)) {
            try {
              sourceText = applyManualPdfTextRedactions(updated[index].file, extracted.text, sourcePseudonymId);
            } catch (error) {
              discardPreparedAnonymizedPdfArchive(updated[index].file);
              throw error;
            }
          }
          const anamneseReview = documentType === "Anamnese / Anamnesebogen"
            ? buildAnamneseQuestionReview(sourceText, extracted.ocrPageConfidences)
            : undefined;
          const reviewBody = anamneseReview?.text || sourceText;
          const datedText = extractionDocumentDate
            ? addAnalysisDocumentMetadata(reviewBody, extractionDocumentDate, documentType)
            : reviewBody;
          combined = [combined, datedText].filter(Boolean).join("\n\n");
          updated[index] = {
            ...updated[index],
            extractedReviewBody: reviewBody,
            archiveCopy,
            status: "done",
            chars: datedText.length,
            pages: extracted.pages,
            ocrPages: extracted.ocrPages,
            ocrFailedPages: extracted.ocrFailedPages,
            ocrPageConfidences: extracted.ocrPageConfidences,
            anamneseMappedAnswers: anamneseReview?.mappedAnswerCount,
            anamneseManualReviewItems: anamneseReview?.manualReviewCount,
            progress: undefined,
            piiHits,
            localPrivacyFindings: extracted.localPrivacyFindings,
          };
        } catch (error) {
          if (!scopeIsCurrent()) return;
          const failure = classifyClinicalPdfFailure(error);
          updated[index] = {
            ...updated[index],
            status: "error",
            progress: undefined,
            errorKind: failure.label,
            error: failure.message,
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
          description: `${categories.join(", ")} wurden vor der Datenschutzvorschau entfernt.`,
        });
      }
      if (!scopeIsCurrent()) return;

      const reviewText = combined.trim();
      if (reviewText) {
        const residualIdentifiers = directIdentifierCategories(reviewText);
        if (residualIdentifiers.length) {
          toast({
            title: "Datenschutz-Sicherheitsstopp",
            description: `${residualIdentifiers.join(", ")} konnte nicht zuverlässig entfernt werden. Es wird nichts übernommen.`,
            variant: "destructive",
          });
          return;
        }
        setPendingReview({
          text: reviewText,
          documentDate: extractionDocumentDate,
          sourcePseudonymId,
          documentCount: successDocs.length,
          totalPages: successDocs.reduce((sum, item) => sum + Number(item.pages || 0), 0),
          totalChars: reviewText.length,
          localOcrPages: successDocs.reduce((sum, item) => sum + Number(item.ocrPages || 0), 0),
          localOcrFailedPages: successDocs.reduce((sum, item) => sum + Number(item.ocrFailedPages?.length || 0), 0),
          failedCount: failed.length,
          identifierCategories: Array.from(new Set(withPii.flatMap((item) => (item.piiHits || []).map((hit) => hit.kind)))),
          anamneseMappedAnswers: successDocs.reduce((sum, item) => sum + Number(item.anamneseMappedAnswers || 0), 0),
          anamneseManualReviewItems: successDocs.reduce((sum, item) => sum + Number(item.anamneseManualReviewItems || 0), 0),
          anamneseLowConfidencePages: Array.from(new Set(successDocs.flatMap((item) => (item.ocrPageConfidences || [])
            .filter((entry) => entry.confidence < ANAMNESE_OCR_LOW_CONFIDENCE_THRESHOLD)
            .map((entry) => entry.pageNumber)))).sort((left, right) => left - right),
          localPrivacyFindings: successDocs.flatMap((item) => item.localPrivacyFindings || []),
        });
        toast({
          title: "Datenschutzvorschau bereit",
          description: "Bitte den vollständigen bereinigten Text prüfen und erst danach ausdrücklich übernehmen.",
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

  const discardPrivacyReview = () => {
    setPendingReview(undefined);
    setPrivacyConfirmed(false);
    setPrivacyFindingsRevealed(false);
    setFiles([]);
  };

  const confirmPrivacyReview = async () => {
    const review = pendingReview;
    if (!review || !privacyConfirmed || reviewSubmitting) return;
    if (!Number.isInteger(review.documentCount) || review.documentCount < 1) {
      toast({ title: "Lokale Ausgangsdateien fehlen", description: "Bitte die lokalen Originaldateien erneut auswählen und prüfen.", variant: "destructive" });
      return;
    }
    if (files.length !== review.documentCount || files.some(item => item.status !== "done")) {
      toast({ title: "Sammelaufnahme unvollständig", description: "Bitte alle ausgewählten Dateien erfolgreich auslesen oder fehlerhafte Dateien bewusst entfernen und die Vorschau erneut prüfen.", variant: "destructive" });
      return;
    }
    try {
      assertCompletePdfArchiveCopies(files);
    } catch (error) {
      toast({ title: "PDF-Archivkopie fehlt", description: error instanceof Error ? error.message : "Die PDF-Archivkopie muss erneut geprüft werden.", variant: "destructive" });
      return;
    }
    if ((review.documentDate || "") !== documentDate.trim()) {
      toast({ title: "Dokumentdatum geändert", description: "Bitte die Vorschau mit dem gewählten Datum erneut erstellen und prüfen.", variant: "destructive" });
      return;
    }
    if ((pseudonymIdRef.current || "").trim() !== review.sourcePseudonymId) {
      discardPrivacyReview();
      toast({
        title: "Datenschutzvorschau verworfen",
        description: "Die Akte hat sich seit dem Auslesen geändert. Bitte die PDF für die aktuelle Akte erneut auswählen.",
        variant: "destructive",
      });
      return;
    }
    const residualIdentifiers = directIdentifierCategories(review.text);
    if (residualIdentifiers.length) {
      setPrivacyConfirmed(false);
      toast({
        title: "Datenschutz-Sicherheitsstopp",
        description: `${residualIdentifiers.join(", ")} wurde bei der zweiten Restprüfung erkannt. Es wird nichts übernommen.`,
        variant: "destructive",
      });
      return;
    }

    setReviewSubmitting(true);
    const generation = extractionRunRef.current;
    const scopeIsCurrent = () => generation === extractionRunRef.current
      && normalizePatientPseudonym(pseudonymIdRef.current) === normalizePatientPseudonym(review.sourcePseudonymId);
    let archivePromise: Promise<OriginalArchiveReceipt[]> | undefined;
    const ensureOriginalsArchived: ArchiveOriginals = () => archivePromise ||= (async () => {
      if (!scopeIsCurrent()) throw new Error("Der Fall wurde gewechselt. Die Vorschau bleibt erhalten.");
      const receipts: OriginalArchiveReceipt[] = [];
      const completed = files.filter(item => item.status === "done");
      const pdfCopies = completed.filter(item => item.archiveCopy);
      assertCompletePdfArchiveCopies(completed);
      if (completed.length !== review.documentCount || files.length !== review.documentCount) {
        throw new Error("Die Sammelaufnahme ist nicht vollständig. Bitte die ausgewählten Dateien erneut prüfen; der bisherige Vorschautext bleibt erhalten.");
      }
      for (const item of pdfCopies) {
        receipts.push(await archivePatientOriginal(supabase as any, review.sourcePseudonymId, item.archiveCopy!, archiveKind, review.documentDate || ""));
        if (!scopeIsCurrent()) throw new Error("Der Fall wurde inzwischen gewechselt.");
      }
      setPendingReview(current => current?.text === review.text && current.sourcePseudonymId === review.sourcePseudonymId
        ? { ...current, archivedOriginals: receipts } : current);
      return receipts;
    })();
    try {
      await onExtracted(review.text, review.sourcePseudonymId, ensureOriginalsArchived);
      const receipts = await ensureOriginalsArchived();
      if (!scopeIsCurrent() || pendingReviewRef.current?.text !== review.text) throw new Error("Die Vorschau oder der Fall wurde inzwischen geändert. Die aktuelle Vorschau bleibt erhalten.");
      setPendingReview(undefined);
      setPrivacyConfirmed(false);
      setPrivacyFindingsRevealed(false);
      setFiles([]);
      toast({
        title: "Inhalte datenschutzbereinigt übernommen",
        description: `${review.documentCount} Datei(en) verarbeitet; geprüfte anonymisierte PDF-Kopien privat archiviert und zurückgelesen. Word- und Excel-Originale bleiben lokal.`,
      });
      if (review.identifierCategories.length) {
        await logTherapyEvent(review.sourcePseudonymId, "pii_warning", {
          document_count: review.documentCount,
          identifier_categories: review.identifierCategories,
          note: "Identifikatoren lokal entfernt; keine Klartext-Treffer oder Dateinamen gespeichert.",
        });
      }
      await logTherapyEvent(review.sourcePseudonymId, "documents_uploaded", {
        document_count: review.documentCount,
        total_pages: review.totalPages,
        total_chars: review.totalChars,
        original_archived: true,
        documents: receipts.map(receipt => ({ archivePath: receipt.archivePath, name: receipt.archivePath.split("/").at(-1), bytes: receipt.bytes })),
        privacy_mode: "local-deidentification-confirmed",
        local_ocr_pages: review.localOcrPages,
        local_ocr_failed_pages: review.localOcrFailedPages,
        failed_count: review.failedCount,
      });
    } catch (error) {
      toast({
        title: "Übernahme nicht bestätigt",
        description: error instanceof Error ? error.message : "Speicherung fehlgeschlagen. Die Importvorschau bleibt erhalten.",
        variant: "destructive",
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      {extractText === extractTherapyTemplateDocument && <p className="text-xs text-muted-foreground">PDF, Word (.docx), Excel (.xlsx) und Text (.txt/.md) werden lokal gelesen. Absatz-, Blatt- und Zellangaben bleiben erhalten. Besondere Inhalte oder Formatierungen werden zur Originalprüfung gekennzeichnet.</p>}
      {onPdfPasswordChange && (
        <div className="rounded-md border border-amber-300/70 bg-amber-50/60 dark:bg-amber-950/15 dark:border-amber-900/40 p-2.5 space-y-1.5">
          <label className="text-xs font-medium block" htmlFor="protected-pdf-password">Vieva-Pro-PDF-Passwort</label>
          <Input
            id="protected-pdf-password"
            type="password"
            value={pdfPassword}
            onChange={(event) => onPdfPasswordChange(event.target.value)}
            placeholder="Passwort nur für diese PDF eingeben"
            autoComplete="off"
            className="h-8 text-xs bg-background"
          />
          <p className="text-[11px] text-muted-foreground">Wird nur lokal zum Öffnen der PDF an PDF.js übergeben und nicht gespeichert, protokolliert oder an die KI gesendet.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(event) => addFiles(event.target.files)}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading || !!pendingReview} className="gap-1.5">
          <FileUp className="h-3.5 w-3.5" />
          {label}
        </Button>
        {files.length > 0 && (
          <Button type="button" size="sm" onClick={runExtraction} disabled={loading || !!pendingReview} className="gap-1.5">
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
              {pending.status === "error" && <span className="max-w-[320px] truncate text-rose-700 text-[10px]" title={pending.error}>Fehler ({pending.errorKind || "Technik"}): {pending.error}</span>}
              {!loading && pending.status !== "processing" && (
                <button type="button" onClick={() => removeAt(index)} className="text-muted-foreground hover:text-rose-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            Datenschutzmodus: PDF-Textebenen werden bevorzugt. Textarme Rasterseiten und Handschrift werden lokal im Browser erkannt; PDF-, Canvas- und Bilddaten gehen an keinen OCR-Cloud-Dienst. Die OCR-Programm- und Sprachdaten werden aus dieser Anwendung geladen. Nach Ihrer Bestätigung werden nur geprüfte anonymisierte PDF-Kopien privat archiviert; Word- und Excel-Originale bleiben lokal. Der Text für die Analyse wird zuvor bereinigt. Unsichere Handschrift wird sichtbar als „manuell prüfen“ gekennzeichnet.
          </p>
        </div>
      )}

      {pendingReview && (
        <div className="space-y-3 rounded-md border-2 border-amber-500 bg-amber-50/70 p-3 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100">
            <ShieldAlert className="h-4 w-4" />
            Ausgelesener Text – vor der Übernahme prüfen
          </div>
          <p className="text-xs text-muted-foreground">
            Bis zur Bestätigung bleibt dieser Text nur im Arbeitsspeicher des Browsers. Es wird noch nichts in Eingabefelder, Protokolle, Lovable oder eine KI übernommen.
          </p>
          {(pendingReview.anamneseMappedAnswers > 0 || pendingReview.anamneseManualReviewItems > 0) && (
            <div className="rounded-md border border-sky-300 bg-sky-50 p-2 text-xs text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-100">
              <strong>Handschrift-/Fragenprüfung:</strong> {pendingReview.anamneseMappedAnswers} Frage-Antwort-Zeile(n) erkannt; {pendingReview.anamneseManualReviewItems} Zeile(n) ohne sichere Zuordnung manuell prüfen.
              {pendingReview.anamneseLowConfidencePages.length > 0 && ` Niedrige OCR-Sicherheit auf Seite(n) ${pendingReview.anamneseLowConfidencePages.join(", ")}.`}
            </div>
          )}
          {!!pendingReview.localPrivacyFindings?.length && (
            <div className="rounded-md border border-amber-400 bg-amber-100/70 p-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>Lokal als personenbezogen markierte Stellen: {pendingReview.localPrivacyFindings.length}</strong>
              <p className="mt-1">Diese Trefferliste wird nicht gesondert gespeichert oder an Analysedienste versendet. Sie dient hier der Datenschutzprüfung. Das unveränderte Originaldokument bleibt lokal; erst nach Ihrer Bestätigung wird ausschließlich die anonymisierte PDF-Kopie privat archiviert.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-7"
                onClick={() => setPrivacyFindingsRevealed((visible) => !visible)}
              >
                {privacyFindingsRevealed ? "Personenbezogene Volltexte wieder verbergen" : "Personenbezogene Stellen vollständig anzeigen"}
              </Button>
              {privacyFindingsRevealed && (
                <div className="mt-2 space-y-2">
                  {pendingReview.localPrivacyFindings.map((finding, findingIndex) => (
                    <div key={`${finding.pageNumber}-${finding.lineNumber}-${findingIndex}`} className="rounded bg-background p-2">
                      <div className="font-semibold">Seite {finding.pageNumber}, Zeile {finding.lineNumber} · {finding.categories.join(", ")}</div>
                      <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words text-[11px]">{finding.originalText}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <RedactedTextPreview
            text={pendingReview.text}
            className="min-h-[18rem] max-h-[32rem] w-full overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed"
            disabled={reviewSubmitting || loading}
            onChange={text => {
              if (reviewSubmitting || loading || (pseudonymIdRef.current || "").trim() !== pendingReview.sourcePseudonymId) return;
              for(const item of files)if(item.archiveCopy)setPdfArchiveCopyReviewed(item.archiveCopy,false);
              setFiles(current => current.map(item => ({ ...item, archiveCopy: archiveCopyAfterPreviewTextEdit(item.file, item.archiveCopy) })));
              setPendingReview(current => current?.sourcePseudonymId === pendingReview.sourcePseudonymId ? { ...current, text, totalChars: text.length } : current);
              setPrivacyConfirmed(false);
            }}
          />
          <div className="flex flex-wrap gap-2">{files.filter(item=>item.archiveCopy).map((item,index)=><Button key={index} type="button" variant="outline" onClick={()=>openPdfArchiveCopy(item.archiveCopy!)}>Anonymisierte PDF-Kopie {index+1} prüfen</Button>)}</div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={privacyConfirmed}
              onChange={(event) => { for (const item of files) if(item.archiveCopy)setPdfArchiveCopyReviewed(item.archiveCopy,event.target.checked);setPrivacyConfirmed(event.target.checked); }}
              disabled={reviewSubmitting || files.length!==pendingReview.documentCount || files.some(item=>item.status!=="done" || (isPdfFile(item.file) && !item.archiveCopy))}
              className="mt-1"
            />
            <span>Ich habe den bereinigten Text und – soweit ausgewählt – die anonymisierten PDF-Kopien geprüft. Identifizierende Angaben sind auch in den PDF-Seitenbildern entfernt; Befunde und Messwerte bleiben erhalten. Beim Anamnesebogen sind zusätzlich Handschrift, Markierungen und Fragezuordnung geprüft. Nur bestätigte anonymisierte PDF-Kopien werden privat übertragen; alle Originale bleiben lokal.</span>
          </label>
          {files.some(item => isPdfFile(item.file) && !item.archiveCopy) && <p className="text-xs text-destructive">Die Vorschau wurde manuell geändert oder die PDF-Kopie konnte nicht vorbereitet werden. Die vorhandene Kopie passt nicht nachweisbar zum Text und bleibt gesperrt. Bitte die lokalen Originaldateien erneut auswählen und die vollständige Prüfung wiederholen.</p>}
          <div className="flex flex-wrap gap-2">
            <input ref={replacementInputRef} type="file" accept={accept} multiple className="hidden" data-original-replacement
              onChange={(event) => {
                const selected = Array.from(event.target.files || []);
                if (!selected.length) return;
                setFiles(selected.map(file => ({ file, status: "queued" as const })));
                setPendingReview(undefined); setPrivacyConfirmed(false); setPrivacyFindingsRevealed(false);
                event.currentTarget.value = "";
              }} />
            <Button type="button" variant="outline" size="sm" disabled={reviewSubmitting || loading} onClick={() => replacementInputRef.current?.click()}>
              Originale erneut auswählen
            </Button>
            <Button type="button" size="sm" onClick={confirmPrivacyReview} disabled={!privacyConfirmed || reviewSubmitting}>
              {reviewSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Bereinigten Text übernehmen
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={discardPrivacyReview} disabled={reviewSubmitting}>
              Verwerfen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
