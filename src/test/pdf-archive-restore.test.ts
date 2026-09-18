import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ document: {} as any, destroy: vi.fn(), render: vi.fn(), ocr: vi.fn() }));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {}, AnnotationMode: { DISABLE: 0 },
  getDocument: () => ({ promise: Promise.resolve(mocks.document), destroy: mocks.destroy }),
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "test-worker.js" }));
vi.mock("@/lib/localBrowserOcr", () => ({ canvasToPngBytes: async () => new Uint8Array([1, 2, 3]), createLocalBrowserOcrWorker: mocks.ocr }));
vi.mock("jspdf", () => ({ jsPDF: class {
  pages = 1;
  setProperties() {}
  addPage() { this.pages++; }
  addImage() {}
  getNumberOfPages() { return this.pages; }
  output() { return new Blob(["rebuilt pixels"], { type: "application/pdf" }); }
} }));

import { restoreAnonymizedPdfArchive } from "@/lib/anonymizedPdfArchive";
import { assertReviewedPdfArchiveCopy, isPreparedPdfArchiveCopy } from "@/lib/pdfArchiveCopyRegistry";

const source = () => {
  const file = new File(["source"], "copy.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(6) });
  return file;
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  mocks.render.mockReturnValue({ promise: Promise.resolve(), cancel: vi.fn() });
  mocks.document = {
    numPages: 2,
    getMetadata: async () => ({ info: { Title: "Anonymisierte Befundkopie", Creator: "Lokale PDF-Anonymisierung" } }),
    getAttachments: async () => null,
    getJSActions: async () => null,
    getPage: async () => ({
      getTextContent: async () => ({ items: [] }), getAnnotations: async () => [],
      getViewport: () => ({ width: 1200, height: 1600 }), render: mocks.render, cleanup: vi.fn(),
    }),
  };
});

describe("rebuild a saved anonymous PDF copy without repeating OCR", () => {
  it("rebuilds every page and requires a fresh explicit review instead of restoring approval", async () => {
    const original = source();
    const copy = await restoreAnonymizedPdfArchive(original, 2);
    expect(copy).not.toBe(original);
    expect(mocks.render).toHaveBeenCalledTimes(2);
    expect(mocks.ocr).not.toHaveBeenCalled();
    expect(isPreparedPdfArchiveCopy(copy)).toBe(true);
    expect(isPreparedPdfArchiveCopy(original)).toBe(false);
    expect(() => assertReviewedPdfArchiveCopy(copy)).toThrow(/noch nicht geprüft/);
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it("rejects a different page count", async () => {
    await expect(restoreAnonymizedPdfArchive(source(), 3)).rejects.toThrow(/keine passende/);
  });
  it("rejects a PDF that was not generated in the anonymous-copy format", async () => {
    mocks.document.getMetadata = async () => ({ info: { Title: "Original" } });
    await expect(restoreAnonymizedPdfArchive(source(), 2)).rejects.toThrow(/keine passende/);
  });
  it.each(["getAttachments", "getJSActions"])("rejects embedded content: %s", async method => {
    mocks.document[method] = async () => ({ entry: "blocked" });
    await expect(restoreAnonymizedPdfArchive(source(), 2)).rejects.toThrow(/keine passende/);
  });
  it.each(["getTextContent", "getAnnotations"])("rejects recoverable text or annotations: %s", async method => {
    const previous = mocks.document.getPage;
    mocks.document.getPage = async () => ({ ...await previous(), [method]: async () => method === "getTextContent" ? { items: [{}] } : [{}] });
    await expect(restoreAnonymizedPdfArchive(source(), 2)).rejects.toThrow(/Text- oder Anmerkungsebenen/);
  });
  it("stops after a case or user change", async () => {
    await expect(restoreAnonymizedPdfArchive(source(), 2, undefined, () => false)).rejects.toThrow(/Fall wurde gewechselt/);
    expect(mocks.render).not.toHaveBeenCalled();
  });
});
