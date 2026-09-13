// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { File } from "node:buffer";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { normalizePatientPseudonym } from "../../supabase/functions/_shared/patientPseudonym";

const pid = "P-2099-0801";
function setup() {
  const source = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8");
  const start = source.indexOf("const loadArchivedBefundDocument = async");
  const end = source.indexOf("const deleteArchivedBefundDocument", start);
  expect(start).toBeGreaterThan(-1); expect(end).toBeGreaterThan(start);
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const blob = new Blob(["synthetic original"], { type: "application/pdf" });
  const download = vi.fn(async () => ({ data: blob, error: null }));
  let pending: any[] = [];
  const env = {
    pseudonymId: pid, normalizePseudonymId: normalizePatientPseudonym, pseudonymIdRef: { current: pid },
    patientScopeGenerationRef: { current: 0 }, isPatientScopedStorageReady: () => true,
    setLoadingArchiveDocumentPath: vi.fn(), supabase: { storage: { from: () => ({ download }) } },
    verifyArchivedPatientOriginal: vi.fn(async (_client: unknown, _pid: string, receipt: unknown) => receipt),
    setPendingDirectBefundFiles: (fn: (items: any[]) => any[]) => { pending = fn(pending); },
    setSonstigeUntersuchungen: vi.fn(), extractClinicalDocumentText: vi.fn(), logTherapyEvent: vi.fn(),
    File, crypto: { randomUUID: () => "synthetic-queued-original" }, toast: vi.fn(), setHistoryRefresh: vi.fn(),
    URL: { createObjectURL: vi.fn(() => "blob:synthetic"), revokeObjectURL: vi.fn() },
    document: { createElement: vi.fn(() => ({ href: "", download: "", click: vi.fn() })) }, window: { setTimeout: vi.fn() },
  };
  const load = new Function(...Object.keys(env), `${js}; return loadArchivedBefundDocument;`)(...Object.values(env));
  return { env, load, download, blob, pending: () => pending };
}

describe("archive originals require a new reviewed import", () => {
  it("keeps a legacy original available but stages it instead of writing clinical fields", async () => {
    const t = setup();
    await t.load({ name: "synthetic-legacy.pdf", archivePath: `${pid}/2099-01-01/legacy-original.pdf` });
    expect(t.pending()).toHaveLength(1);
    expect(t.pending()[0]).toMatchObject({ sourcePseudonymId: pid, status: "queued", privacyReviewed: false, documentDate: "" });
    expect(await t.pending()[0].file.text()).toBe(await t.blob.text());
    expect(t.env.setSonstigeUntersuchungen).not.toHaveBeenCalled();
    expect(t.env.extractClinicalDocumentText).not.toHaveBeenCalled();
    expect(t.env.logTherapyEvent).not.toHaveBeenCalled();
  });
  it("does not stage a canonical original when its receipt check fails", async () => {
    const t = setup(); t.env.verifyArchivedPatientOriginal.mockRejectedValueOnce(new Error("synthetic integrity failure"));
    await t.load({ name: "synthetic", archivePath: `${pid}/2099-01-01/labor-${"a".repeat(64)}.pdf` });
    expect(t.pending()).toHaveLength(0);
    expect(t.env.setSonstigeUntersuchungen).not.toHaveBeenCalled();
  });
  it("never downloads an archive path belonging to another case", async () => {
    const t = setup(); await t.load({ archivePath: "P-2099-0802/2099-01-01/other.pdf" });
    expect(t.download).not.toHaveBeenCalled(); expect(t.pending()).toHaveLength(0);
  });
});
