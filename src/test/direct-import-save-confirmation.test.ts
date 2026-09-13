// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { persistVerifiedPatientInput } from "@/lib/verifiedPatientInput";
import { normalizePatientPseudonym } from "../../supabase/functions/_shared/patientPseudonym";

const pid = "P-2099-0401";
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup() {
  const source = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf("const handoffDirectBefundFiles = async () => {");
  const end = source.indexOf("  const loadArchivedBefundDocument", start);
  expect(start).toBeGreaterThan(-1); expect(end).toBeGreaterThan(start);
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const data: Record<string, unknown> = { _pseudonym_id: pid, pseudonymId: pid, laborKomplett: "synthetic prior input" };
  const save = deferred<string>(); const read = deferred<any>();
  let previews = [{ id: "synthetic-document", status: "ready", sourcePseudonymId: pid, documentType: "labor",
    privacyReviewed: true, previewText: "synthetic reviewed laboratory input", documentDate: "2099-01-01", removedIdentifierCategories: [], pages: 1, chars: 35 }];
  const setter = (field: string) => (value: unknown) => { data[field] = typeof value === "function" ? value(data[field] || "") : value; };
  const env = {
    pseudonymId: pid, normalizePseudonymId: normalizePatientPseudonym, isPatientScopedStorageReady: () => true,
    anamnesisImportPendingRef: { current: false }, patientContextLoadingRef: { current: false }, patientContextLoadError: null,
    isAnalyzingDocs: false, isStreaming: false, isLoadingDiagnosen: false, isLoadingMannayanOrders: false,
    pendingDirectBefundFiles: previews, patientScopeGenerationRef: { current: 0 }, pseudonymIdRef: { current: pid },
    autoSaveRunIdRef: { current: 0 }, autoSaveTimerRef: { current: null }, autoSaveSessionIdRef: { current: null }, lastAutoSavedPayloadRef: { current: "" },
    window: { clearTimeout: vi.fn(), setTimeout: vi.fn() }, flushSync: (fn: () => void) => fn(), setIsImportingAnamnesis: vi.fn(),
    directIdentifierCategories: () => [], residualIdentifierCategories: () => [],
    mergeExtractedBlockIntoField: (prior: string, text: string) => `${prior}\n${text}`,
    setLaborKomplett: setter("laborKomplett"), setMetatronHeel: setter("metatronHeel"), setVievaPlus: setter("vievaPlus"),
    setAnamnese: setter("anamnese"), setArztbericht: setter("arztbericht"), setSonstigeUntersuchungen: setter("sonstigeUntersuchungen"),
    setLaborDatum: setter("laborDatum"), setMetatronDatum: setter("metatronDatum"), setVievaPlusDatum: setter("vievaPlusDatum"),
    setAnamneseDatum: setter("anamneseDatum"), setArztberichtDatum: setter("arztberichtDatum"),
    directBefundTargetLabel: (value: string) => value, extractExplicitAnamneseInputs: vi.fn(), applyExtractedToInputs: vi.fn(),
    latestBuildInputDataRef: { current: (extra: Record<string, unknown>) => ({ ...data, ...extra }) },
    assertPayloadMatchesPseudonym: vi.fn(), patientDraftSaveQueue: { run: (_pid: string, fn: () => unknown) => fn() },
    persistVerifiedPatientInput, upsertAutoSaveDraft: vi.fn(() => save.promise),
    supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => read.promise }) }) }) },
    setAutoSaveStatus: vi.fn(), logTherapyEvent: vi.fn(async () => undefined),
    setPendingDirectBefundFiles: (fn: (items: typeof previews) => typeof previews) => { previews = fn(previews); },
    toast: vi.fn(), setHistoryRefresh: vi.fn(), nextBefundActionRef: { current: null },
  };
  const run = new Function(...Object.keys(env), `${js}; return handoffDirectBefundFiles;`)(...Object.values(env));
  return { env, run, save, read, previews: () => previews, stored: () => ({ id: "synthetic-row", pseudonym_id: pid,
    eingabe_daten: { ...data, autoSavedDraft: true, finalized: false } as Record<string, unknown> }) };
}

describe("direct import confirmation follows the database receipt", () => {
  it("keeps the preview until saving AND complete readback finish", async () => {
    const t = setup(); const done = t.run();
    expect(t.env.upsertAutoSaveDraft).toHaveBeenCalledWith(pid, expect.objectContaining({ laborDatum: "2099-01-01" }));
    expect(t.previews()[0].status).toBe("ready");
    t.save.resolve("synthetic-row"); await Promise.resolve();
    expect(t.previews()[0].status).toBe("ready");
    t.read.resolve({ data: t.stored(), error: null }); await done;
    expect(t.previews()[0].status).toBe("done");
    expect(t.env.anamnesisImportPendingRef.current).toBe(false);
  });
  it("retains the preview and releases the input lock after a rejected save", async () => {
    const t = setup(); const done = t.run(); t.save.reject(new Error("synthetic save failure")); await done;
    expect(t.previews()[0].status).toBe("ready");
    expect(t.env.logTherapyEvent).not.toHaveBeenCalled();
    expect(t.env.anamnesisImportPendingRef.current).toBe(false);
    expect(t.env.setIsImportingAnamnesis).toHaveBeenLastCalledWith(false);
  });
  it("rejects a partial readback without clearing the preview", async () => {
    const t = setup(); const done = t.run(); t.save.resolve("synthetic-row");
    const row = t.stored(); row.eingabe_daten.laborKomplett = "truncated";
    t.read.resolve({ data: row, error: null }); await done;
    expect(t.previews()[0].status).toBe("ready");
    expect(t.env.setAutoSaveStatus).toHaveBeenLastCalledWith("error");
  });
  it("does not confirm an old preview in a different patient scope", async () => {
    const t = setup(); const done = t.run(); t.env.patientScopeGenerationRef.current++;
    t.save.resolve("synthetic-row"); t.read.resolve({ data: t.stored(), error: null }); await done;
    expect(t.previews()[0].status).toBe("ready");
    expect(t.env.logTherapyEvent).not.toHaveBeenCalled();
  });
});
