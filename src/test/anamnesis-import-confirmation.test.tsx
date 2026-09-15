import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MultiDocUpload } from "@/components/admin/therapy/MultiDocUpload";

const mocks = vi.hoisted(() => ({ toast: vi.fn(), event: vi.fn().mockResolvedValue(undefined), verify: vi.fn(async (_client: unknown, _pid: string, receipt: unknown) => receipt) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/components/admin/therapy/therapyEventLog", () => ({ logTherapyEvent: mocks.event }));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, OPS: {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/patientOriginalArchive", () => ({ archivePatientOriginal: vi.fn(), verifyArchivedPatientOriginal: mocks.verify }));
const pid = "P-2099-0101";
const key = `therapy.pendingPrivacyReview.v1:${pid}:Anamnese`;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); sessionStorage.clear();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  sessionStorage.setItem(key, JSON.stringify({ text: "Neutrale Testangabe ohne Identifikatoren.", sourcePseudonymId: pid, documentCount: 1, totalPages: 1, totalChars: 40, localOcrPages: 0, localOcrFailedPages: 0, failedCount: 0, identifierCategories: [], anamneseMappedAnswers: 0, anamneseManualReviewItems: 0, anamneseLowConfidencePages: [],
    archivedOriginals: [{ pseudonymId: pid, archivePath: `${pid}/undatiert/anamnese-${"a".repeat(64)}.pdf`, sha256: "a".repeat(64), bytes: 42, reused: true }] }));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); });

async function submit(onExtracted: () => Promise<void>) {
  await act(async () => root.render(<MultiDocUpload pseudonymId={pid} documentType="Anamnese" onExtracted={onExtracted} />));
  const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  expect(checkbox).not.toBeNull();
  await act(async () => checkbox.click());
  const button = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes("Bereinigten Text übernehmen"))!;
  await act(async () => button.click());
  return button;
}

describe("confirmed source import", () => {
  it("keeps a restored preview until replacement originals have actually been chosen", async () => {
    const onExtracted = vi.fn(async () => undefined);
    await act(async () => root.render(<MultiDocUpload pseudonymId={pid} documentType="Anamnese" onExtracted={onExtracted} />));
    const choose = Array.from(host.querySelectorAll("button")).find(button => button.textContent?.includes("Originale erneut auswählen"))!;
    expect(choose.disabled).toBe(false);
    await act(async () => choose.click());
    expect(host.textContent).toContain("Ausgelesener Text – vor der Übernahme prüfen");
    const input = host.querySelector<HTMLInputElement>("input[data-original-replacement]")!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["synthetic replacement"], "synthetic.pdf", { type: "application/pdf" })] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).not.toContain("Ausgelesener Text – vor der Übernahme prüfen");
    expect(host.textContent).toContain("synthetic.pdf");
    expect(onExtracted).not.toHaveBeenCalled();
  });
  it("keeps the preview if the original archive cannot be verified", async () => {
    mocks.verify.mockRejectedValueOnce(new Error("synthetic original unavailable"));
    await submit(async () => undefined);
    expect(host.textContent).toContain("Ausgelesener Text – vor der Übernahme prüfen");
    expect(sessionStorage.getItem(key)).not.toBeNull();
    expect(mocks.event).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Übernahme nicht bestätigt" }));
  });
  it("keeps the preview during saving and after a failed database save", async () => {
    let reject!: (error: Error) => void;
    const button = await submit(() => new Promise((_, no) => { reject = no; }));
    expect(button.disabled).toBe(true);
    expect(sessionStorage.getItem(key)).not.toBeNull();
    expect(mocks.event).not.toHaveBeenCalled();
    await act(async () => { reject(new Error("Speicherung abgebrochen")); });
    expect(host.textContent).toContain("Ausgelesener Text – vor der Übernahme prüfen");
    expect(sessionStorage.getItem(key)).not.toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Übernahme nicht bestätigt" }));
    expect(mocks.event).not.toHaveBeenCalled();
  });
  it("clears the pending preview only after persistence has been confirmed", async () => {
    let finish!: () => void;
    await submit(() => new Promise((yes) => { finish = yes; }));
    expect(host.textContent).toContain("Ausgelesener Text – vor der Übernahme prüfen");
    await act(async () => { finish(); });
    expect(host.textContent).not.toContain("Ausgelesener Text – vor der Übernahme prüfen");
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(mocks.event).toHaveBeenCalledWith(pid, "documents_uploaded", expect.objectContaining({ original_archived: true }));
  });
});
