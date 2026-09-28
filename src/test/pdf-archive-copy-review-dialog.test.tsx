import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfArchiveCopyReviewDialog } from "@/components/admin/therapy/PdfArchiveCopyReviewDialog";

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  renderPage: vi.fn(),
}));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: mocks.getDocument,
}));

describe("local PDF copy review", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
    mocks.renderPage.mockImplementation(() => ({ promise: Promise.resolve(), cancel: vi.fn() }));
    mocks.getDocument.mockImplementation(() => ({
      promise: Promise.resolve({
        numPages: 2,
        getPage: async () => ({ getViewport: () => ({ width: 600, height: 900 }), render: mocks.renderPage }),
      }),
      destroy: vi.fn(),
    }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("keeps completion locked until every rendered page has been scrolled to its end", async () => {
    const file = new File(["test"], "anonymisierte-befundkopie.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(4) });
    const onAllPagesViewed = vi.fn();
    render(<PdfArchiveCopyReviewDialog file={file} onClose={vi.fn()} onAllPagesViewed={onAllPagesViewed} />);
    const scroller = document.querySelector("[data-pdf-copy-scroller]") as HTMLDivElement;
    Object.defineProperty(scroller, "clientHeight", { value: 300, configurable: true });
    Object.defineProperty(scroller, "scrollHeight", { value: 900, configurable: true });

    await screen.findByText(/Seite 1 von 2/);
    await screen.findByText(/Diese Seite bis zum Ende ansehen/);
    const next = screen.getByRole("button", { name: "Nächste Seite" });
    expect(next).toBeDisabled();
    scroller.scrollTop = 600;
    fireEvent.scroll(scroller);
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);

    await screen.findByText(/Seite 2 von 2/);
    await screen.findByText(/Diese Seite bis zum Ende ansehen/);
    const complete = screen.getByRole("button", { name: "Alle Seiten angesehen" });
    expect(complete).toBeDisabled();
    expect(onAllPagesViewed).not.toHaveBeenCalled();
    scroller.scrollTop = 600;
    fireEvent.scroll(scroller);
    await waitFor(() => expect(complete).toBeEnabled());
    fireEvent.click(complete);
    expect(onAllPagesViewed).toHaveBeenCalledOnce();
  });
});
