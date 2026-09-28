import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Renders the local image-only archive copy inside the intake preview. */
export function PdfArchiveCopyReviewDialog({ file, onClose, onAllPagesViewed }: {
  file: File | null;
  onClose: () => void;
  onAllPagesViewed: () => void;
}) {
  const [loaded, setLoaded] = useState<{ file: File; document: pdfjs.PDFDocumentProxy } | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [renderedPage, setRenderedPage] = useState(0);
  const [viewedPage, setViewedPage] = useState(0);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const document = loaded?.file === file ? loaded.document : null;

  useEffect(() => {
    setLoaded(null);
    setPageNumber(1);
    setRenderedPage(0);
    setViewedPage(0);
    setError("");
    if (canvasRef.current) { canvasRef.current.width = 0; canvasRef.current.height = 0; }
    if (!file) return;
    let cancelled = false;
    let task: pdfjs.PDFDocumentLoadingTask | undefined;
    void (async () => {
      const data = await file.arrayBuffer();
      if (cancelled) return;
      task = pdfjs.getDocument({ data: new Uint8Array(data) });
      const loaded = await task.promise;
      if (cancelled) return;
      if (!loaded.numPages) throw new Error("Die PDF-Kopie enthält keine Seiten.");
      setLoaded({ file, document: loaded });
    })().catch(() => { if (!cancelled) setError("Die PDF-Kopie konnte lokal nicht angezeigt werden. Keine Freigabe möglich."); });
    return () => { cancelled = true; void task?.destroy(); };
  }, [file]);

  useEffect(() => {
    if (!file || !document) return;
    let cancelled = false;
    let task: pdfjs.RenderTask | undefined;
    setRenderedPage(0);
    setViewedPage(0);
    setError("");
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    void (async () => {
      const page = await document.getPage(pageNumber);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) throw new Error("PDF-Anzeige nicht verfügbar.");
      const viewport = page.getViewport({ scale: 1.5 });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      task = page.render({ canvas, canvasContext: context, viewport });
      await task.promise;
      if (!cancelled) setRenderedPage(pageNumber);
    })().catch(() => { if (!cancelled) setError("Eine PDF-Seite konnte lokal nicht angezeigt werden. Keine Freigabe möglich."); });
    return () => { cancelled = true; task?.cancel(); };
  }, [document, file, pageNumber]);

  const inspectScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (renderedPage === pageNumber && scroller && scroller.clientHeight > 0 && scroller.scrollHeight > 0
      && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 12) setViewedPage(pageNumber);
  }, [renderedPage, pageNumber]);
  useEffect(() => {
    if (renderedPage !== pageNumber) return;
    const frame = requestAnimationFrame(inspectScroll);
    return () => cancelAnimationFrame(frame);
  }, [renderedPage, pageNumber, inspectScroll]);

  const canContinue = renderedPage === pageNumber && viewedPage === pageNumber && !error;
  return <Dialog open={!!file} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent style={{ maxWidth: "95vw", width: 950, height: "95vh", maxHeight: 1000, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", background: "white", color: "#172b3a" }}>
      <header className="shrink-0">
        <DialogTitle>Anonymisierte PDF-Kopie prüfen</DialogTitle>
        <DialogDescription>Seite {pageNumber} von {document?.numPages ?? "…"}. Jede Seite bis zum Ende ansehen. Die Kopie bleibt lokal; hier wird nichts übertragen.</DialogDescription>
      </header>
      <div ref={scrollerRef} onScroll={inspectScroll} data-pdf-copy-scroller className="min-h-0 flex-1 overflow-auto rounded border border-slate-300 bg-white">
        <canvas ref={canvasRef} data-pdf-copy-page aria-label={`Anonymisierte PDF-Kopie, Seite ${pageNumber}`} className="block h-auto w-full" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!error && document && viewedPage !== pageNumber && <p role="status" className="text-xs">Diese Seite bis zum Ende ansehen, bevor Sie weiterblättern.</p>}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setPageNumber(current => current - 1)} disabled={!document || pageNumber <= 1}>Vorherige Seite</Button>
        {document && pageNumber < document.numPages
          ? <Button type="button" onClick={() => setPageNumber(current => current + 1)} disabled={!canContinue}>Nächste Seite</Button>
          : <Button type="button" onClick={onAllPagesViewed} disabled={!document || !canContinue}>Alle Seiten angesehen</Button>}
        <Button type="button" variant="ghost" onClick={onClose}>Schließen</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
