import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MultiDocUpload } from "@/components/admin/therapy/MultiDocUpload";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  userId: "synthetic-user",
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: mocks.userId } }) }));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, OPS: {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const pid = "P-2099-0101";
const keyFor = (userId: string) => `therapy.pendingPrivacyReview.v2:${JSON.stringify([userId, pid, "Anamnese"])}`;
const savedReview = (userId: string) => ({
  text: "Neutrale synthetische Testangabe ohne Identifikatoren.",
  sourcePseudonymId: pid,
  sourceUserId: userId,
  documentCount: 1,
  totalPages: 1,
  totalChars: 52,
  localOcrPages: 0,
  localOcrFailedPages: 0,
  failedCount: 0,
  identifierCategories: [],
  anamneseMappedAnswers: 0,
  anamneseManualReviewItems: 0,
  anamneseLowConfidencePages: [],
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.userId = "synthetic-user";
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  sessionStorage.clear();
});

const renderUpload = async (onExtracted = vi.fn(async () => undefined)) => {
  await act(async () => root.render(<MultiDocUpload pseudonymId={pid} documentType="Anamnese" onExtracted={onExtracted} />));
  return onExtracted;
};

describe("confirmed source import", () => {
  it("keeps a restored preview until replacement originals have actually been chosen", async () => {
    sessionStorage.setItem(keyFor(mocks.userId), JSON.stringify(savedReview(mocks.userId)));
    const onExtracted = await renderUpload();
    const choose = Array.from(host.querySelectorAll("button")).find(button => button.textContent?.includes("Originale erneut auswählen"));
    expect(choose?.disabled).toBe(false);
    await act(async () => choose?.click());
    expect(host.textContent).toContain("Ausgelesener Text – vor der Übernahme prüfen");
    expect(onExtracted).not.toHaveBeenCalled();

    const input = host.querySelector<HTMLInputElement>("input[data-original-replacement]");
    expect(input).not.toBeNull();
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["synthetic replacement"], "synthetic.pdf", { type: "application/pdf" })] });
    await act(async () => input?.dispatchEvent(new Event("change", { bubbles: true })));
    expect(host.textContent).not.toContain("Ausgelesener Text – vor der Übernahme prüfen");
    expect(host.textContent).toContain("synthetic.pdf");
    expect(onExtracted).not.toHaveBeenCalled();
  });

  it("does not restore approval or allow transfer without re-reading the originals", async () => {
    sessionStorage.setItem(keyFor(mocks.userId), JSON.stringify(savedReview(mocks.userId)));
    const onExtracted = await renderUpload();
    const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const transfer = Array.from(host.querySelectorAll("button")).find(button => button.textContent?.includes("Bereinigten Text übernehmen"));
    expect(checkbox?.disabled).toBe(true);
    expect(checkbox?.checked).toBe(false);
    expect(transfer?.disabled).toBe(true);
    expect(onExtracted).not.toHaveBeenCalled();
  });

  it("ignores a review saved under the former unbound key", async () => {
    sessionStorage.setItem(`therapy.pendingPrivacyReview.v1:${pid}:Anamnese`, JSON.stringify(savedReview(mocks.userId)));
    await renderUpload();
    expect(host.textContent).not.toContain("Ausgelesener Text – vor der Übernahme prüfen");
  });

  it("does not reveal another user's stored preview", async () => {
    sessionStorage.setItem(keyFor("other-user"), JSON.stringify(savedReview("other-user")));
    await renderUpload();
    expect(host.textContent).not.toContain("Ausgelesener Text – vor der Übernahme prüfen");
  });
});
