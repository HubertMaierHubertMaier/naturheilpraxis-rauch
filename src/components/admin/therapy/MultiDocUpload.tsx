import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileUp, X, CheckCircle2, FileText, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logTherapyEvent } from "./therapyEventLog";
import { deidentifyClinicalText, directIdentifierCategories } from "../../../../supabase/functions/_shared/clinicalDeidentification";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

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
  removedIdentifierCategories?: string[];
};

type ToastFn = (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

const MIN_TEXT_PER_PAGE = 40;
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
): Promise<ClinicalDocumentExtractionResult> {
  if (file.type.startsWith("image/")) {
    throw new Error("Datenschutz-Stopp: Bilder werden nicht an eine externe OCR gesendet. Bitte eine lokal geschwärzte, textlesbare PDF verwenden.");
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Im Datenschutzmodus sind nur textlesbare PDFs erlaubt.");
  }

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const parts: string[] = [];
  const pagesWithInsufficientImageText: number[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const operators = await page.getOperatorList();
    const containsRasterImage = operators.fnArray.some((operatorId) => rasterImageOperatorIds.has(operatorId));
    const content = await page.getTextContent();
    const pageText = content.items.map((item: unknown) => (
      item && typeof item === "object" && "str" in item ? String((item as { str: unknown }).str) : ""
    )).join(" ").trim();
    if (containsRasterImage && pageText.length < MIN_TEXT_PER_PAGE) pagesWithInsufficientImageText.push(pageNumber);
    parts.push(pageText);
  }

  if (pagesWithInsufficientImageText.length || parts.every((pageText) => pageText.length < MIN_TEXT_PER_PAGE)) {
    notify?.({
      title: "Datenschutz-Stopp: Scan erkannt",
      description: "Der Scan wurde nicht an eine externe OCR gesendet. Bitte eine lokal geschwärzte, textlesbare PDF verwenden.",
      variant: "destructive",
    });
    throw new Error("Diese PDF enthält keinen sicher lokal auslesbaren Text; externe Bild-OCR ist deaktiviert.");
  }

  const joined = parts.map((text, index) => `--- Seite ${index + 1} ---\n${text}`).join("\n\n");
  const removedIdentifierCategories = directIdentifierCategories(joined);
  const safeBody = deidentifyClinicalText(joined);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(safeBody));
  const documentId = Array.from(new Uint8Array(digest)).slice(0, 6).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const text = `=== 📄 Dokument-${documentId} (${doc.numPages} S.) ===\n${safeBody}`;
  const residualIdentifiers = directIdentifierCategories(text);
  if (residualIdentifiers.length) {
    throw new Error(`Datenschutz-Sicherheitsstopp: ${residualIdentifiers.join(", ")} konnte nicht zuverlässig entfernt werden.`);
  }
  return { text, pages: doc.numPages, chars: text.length, removedIdentifierCategories };
}

export function MultiDocUpload({ onExtracted, pseudonymId, ocrMode = "doctor", label = "PDF hochladen" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pseudonymIdRef = useRef(pseudonymId);
  const extractionRunRef = useRef(0);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  pseudonymIdRef.current = pseudonymId;

  useEffect(() => {
    extractionRunRef.current += 1;
    setFiles([]);
    setLoading(false);
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
    setLoading(true);
    let combined = "";
    const updated = [...files];

    for (let index = 0; index < updated.length; index += 1) {
      if (updated[index].status === "done") continue;
      updated[index] = { ...updated[index], status: "processing", error: undefined };
      setFiles([...updated]);
      try {
        const extracted = await extractClinicalDocumentText(updated[index].file, ocrMode, scopedToast);
        if (!scopeIsCurrent()) return;
        const piiHits = (extracted.removedIdentifierCategories || []).map((kind) => ({ kind }));
        combined = [combined, extracted.text].filter(Boolean).join("\n\n");
        updated[index] = {
          ...updated[index],
          status: "done",
          chars: extracted.chars,
          pages: extracted.pages,
          piiHits,
        };
      } catch (error) {
        if (!scopeIsCurrent()) return;
        updated[index] = {
          ...updated[index],
          status: "error",
          error: (error as Error).message || "Fehler",
        };
      }
      setFiles([...updated]);
    }
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
        failed_count: failed.length,
      });
    } else if (failed.length) {
      toast({ title: "Keine Daten extrahiert", description: failed[0].error, variant: "destructive" });
    }
    if (scopeIsCurrent()) setLoading(false);
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
              {pending.status === "processing" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              {pending.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              {pending.status === "error" && <span className="max-w-[320px] truncate text-rose-700 text-[10px]" title={pending.error}>Fehler: {pending.error}</span>}
              {!loading && pending.status !== "processing" && (
                <button type="button" onClick={() => removeAt(index)} className="text-muted-foreground hover:text-rose-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            Datenschutzmodus: Nur textlesbare PDFs werden lokal ausgelesen. Direkte Identifikatoren werden vor Analyse und Speicherung entfernt. Originaldateien werden nicht archiviert; Bilder und Scan-PDFs werden nicht an externe OCR-Dienste gesendet.
          </p>
        </div>
      )}
    </div>
  );
}
