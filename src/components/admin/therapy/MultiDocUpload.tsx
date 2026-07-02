import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileUp, X, CheckCircle2, FileText, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logTherapyEvent } from "./therapyEventLog";
import * as pdfjs from "pdfjs-dist";
// @ts-ignore - vite handles ?url
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Props {
  /** Aufruf mit komplett extrahiertem Text (kann mehrere MB sein) */
  onExtracted: (text: string) => void;
  /** Pseudonym für die sichere Originaldatei-Ablage */
  pseudonymId?: string;
  /** mode an extract-lab-image weitergeben: "doctor" (Arztbrief-Struktur) oder "lab" */
  ocrMode?: "doctor" | "lab";
  /** Label-Override */
  label?: string;
}

type PendingFile = {
  file: File;
  status: "queued" | "processing" | "done" | "error";
  pages?: number;
  chars?: number;
  archivePath?: string;
  error?: string;
  piiHits?: PiiHit[];
};

export type PiiHit = { kind: string; sample: string };


export type ClinicalDocumentExtractionResult = {
  text: string;
  pages?: number;
  chars: number;
};

type ToastFn = (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

const MIN_TEXT_PER_PAGE = 80; // weniger ⇒ wahrscheinlich gescannt, OCR-Fallback
const STORAGE_BUCKET = "therapy-documents";

const normalizePid = (value?: string) => (value || "").trim();
const safePathPart = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 120) || "datei";

// Eine PDF-Seite auf eine handliche Größe rendern (für OCR-Fallback)
async function renderPageToDataUrl(page: pdfjs.PDFPageProxy, maxDim = 1600): Promise<string> {
  const viewport0 = page.getViewport({ scale: 1 });
  const scale = Math.min(maxDim / Math.max(viewport0.width, viewport0.height), 2);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
  return canvas.toDataURL("image/jpeg", 0.78);
}

async function ocrImages(images: string[], mode: "doctor" | "lab"): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Nicht angemeldet");
  // in Batches à 6 Bildern an extract-lab-image
  const out: string[] = [];
  for (let i = 0; i < images.length; i += 6) {
    const batch = images.slice(i, i + 6);
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-lab-image`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ images: batch, mode }),
      },
    );
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "OCR fehlgeschlagen");
    out.push(String(json.text || "").trim());
  }
  return out.filter(Boolean).join("\n\n");
}

export async function extractClinicalDocumentText(file: File, mode: "doctor" | "lab" = "doctor", notify?: ToastFn): Promise<ClinicalDocumentExtractionResult> {
  if (file.type.startsWith("image/")) {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const text = `\n\n=== 📷 ${file.name} ===\n${await ocrImages([dataUrl], mode)}`;
    return { text, chars: text.length };
  }
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const parts: string[] = [];
    let totalChars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const pageText = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ").trim();
      parts.push(pageText);
      totalChars += pageText.length;
    }
    if (totalChars / doc.numPages < MIN_TEXT_PER_PAGE) {
      notify?.({ title: `${file.name}: Scan erkannt`, description: `${doc.numPages} Seite(n) werden per OCR ausgelesen (kann dauern)…` });
      const images: string[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        images.push(await renderPageToDataUrl(page));
      }
      const text = `\n\n=== 📄 ${file.name} (${doc.numPages} S., OCR) ===\n${await ocrImages(images, mode)}`;
      return { text, pages: doc.numPages, chars: text.length };
    }
    const joined = parts.map((t, i) => `--- Seite ${i + 1} ---\n${t}`).join("\n\n");
    const text = `\n\n=== 📄 ${file.name} (${doc.numPages} S.) ===\n${joined}`;
    return { text, pages: doc.numPages, chars: text.length };
  }
  throw new Error("Format nicht unterstützt (nur PDF, JPG, PNG)");
}

export async function archiveClinicalDocumentOriginal(file: File, pseudonymId?: string): Promise<string> {
  const pid = normalizePid(pseudonymId);
  if (!pid) throw new Error("Bitte zuerst eine Pseudonym-ID eintragen, damit die Originaldatei patientensicher archiviert werden kann.");
  const day = new Date().toISOString().slice(0, 10);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${safePathPart(pid)}/${day}/${suffix}-${safePathPart(file.name)}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;
  return path;
}

export function MultiDocUpload({ onExtracted, pseudonymId, ocrMode = "doctor", label = "PDF / Bilder hochladen" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const archiveOriginal = async (file: File): Promise<string> => archiveClinicalDocumentOriginal(file, pseudonymId);

  const addFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    const next: PendingFile[] = Array.from(list).map((f) => ({ file: f, status: "queued" }));
    setFiles((prev) => [...prev, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (i: number) => setFiles((p) => p.filter((_, idx) => idx !== i));

  const extractOne = async (pf: PendingFile): Promise<string> => {
    const extracted = await extractClinicalDocumentText(pf.file, ocrMode, toast);
    pf.pages = extracted.pages;
    return extracted.text;
  };

  const runExtraction = async () => {
    if (!files.length) return;
    setLoading(true);
    let combined = "";
    const updated = [...files];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === "done") continue;
      updated[i] = { ...updated[i], status: "processing" };
      setFiles([...updated]);
      try {
        const archivePath = await archiveOriginal(updated[i].file);
        const text = await extractOne(updated[i]);
        const piiHits = scanForPatientPII(text);
        combined += `${text}\n\n[Originaldatei sicher archiviert: ${STORAGE_BUCKET}/${archivePath}]`;
        updated[i] = { ...updated[i], status: "done", chars: text.length, archivePath, piiHits };
      } catch (e: any) {
        updated[i] = { ...updated[i], status: "error", error: e.message || "Fehler" };
      }
      setFiles([...updated]);
    }
    // PII-Warnungen aggregiert anzeigen (nicht blockierend — Peter entscheidet)
    const withPii = updated.filter((u) => u.status === "done" && u.piiHits && u.piiHits.length);
    if (withPii.length) {
      for (const pf of withPii) {
        const preview = pf.piiHits!.slice(0, 5).map((h) => `• ${h.kind}: „${h.sample}"`).join("\n");
        toast({
          title: `⚠ Mögliche Patientendaten in „${pf.file.name}"`,
          description: `${pf.piiHits!.length} Treffer — bitte prüfen, ob die Datei wirklich anonym ist:\n${preview}`,
          variant: "destructive",
        });
      }
      await logTherapyEvent(pseudonymId, "pii_warning", {
        files: withPii.map((u) => ({ name: u.file.name, hits: u.piiHits })),
        note: "Client-PII-Scanner hat mögliche Klartext-Patientendaten erkannt.",
      });
    }

    const failed = updated.filter((u) => u.status === "error");
    const successDocs = updated.filter((u) => u.status === "done");
    if (combined.trim()) {
      onExtracted(combined.trim());
      toast({ title: "✓ Inhalte übernommen", description: `${successDocs.length} Datei(en) verarbeitet.` });
      // Verlaufs-Event: Dokumente hochgeladen + sicher archiviert
      await logTherapyEvent(pseudonymId, "documents_uploaded", {
        files: successDocs.map((u) => ({ name: u.file.name, pages: u.pages, chars: u.chars, archivePath: u.archivePath })),
        note: failed.length ? `${failed.length} Datei(en) fehlgeschlagen` : undefined,
      });
      await logTherapyEvent(pseudonymId, "documents_saved", {
        files: successDocs.map((u) => ({ name: u.file.name, archivePath: u.archivePath })),
        note: `Originaldateien im sicheren Bucket „${STORAGE_BUCKET}" archiviert.`,
      });
    } else if (failed.length) {
      toast({ title: "Keine Daten extrahiert", description: failed[0].error || "Bitte Datei erneut versuchen oder anderes Format nutzen.", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading} className="gap-1.5">
          <FileUp className="h-3.5 w-3.5" />
          {label}
        </Button>
        {files.length > 0 && (
          <Button type="button" size="sm" onClick={runExtraction} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {loading ? "Verarbeite…" : `${files.length} Datei(en) auslesen & einfügen`}
          </Button>
        )}
      </div>

      {files.length > 0 && (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 space-y-1">
          {files.map((pf, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="truncate flex-1" title={pf.file.name}>{pf.file.name}</span>
              <span className="text-muted-foreground whitespace-nowrap">
                {(pf.file.size / 1024).toFixed(0)} KB
                {pf.pages ? ` · ${pf.pages} S.` : ""}
              </span>
              {pf.archivePath && <span className="text-emerald-700 text-[10px] whitespace-nowrap" title={`${STORAGE_BUCKET}/${pf.archivePath}`}>archiviert</span>}
              {pf.status === "processing" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              {pf.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              {pf.status === "error" && <span className="max-w-[320px] truncate text-rose-700 text-[10px]" title={pf.error}>Fehler: {pf.error || "keine Daten extrahiert"}</span>}
              {!loading && pf.status !== "processing" && (
                <button type="button" onClick={() => removeAt(i)} className="text-muted-foreground hover:text-rose-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            PDFs mit eingebettetem Text werden 1:1 ausgelesen. Gescannte PDFs (kein Text) gehen automatisch durch die OCR (extract-lab-image). Bilder (JPG/PNG) direkt durch die OCR. Patientendaten (Name/Adresse/Geburtsdatum) werden serverseitig entfernt (siehe Anonymisierungs-Filter).
          </p>
        </div>
      )}
    </div>
  );
}
