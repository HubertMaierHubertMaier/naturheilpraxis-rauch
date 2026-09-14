// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { persistVerifiedPatientInput } from "@/lib/verifiedPatientInput";
import { normalizePatientPseudonym } from "../../supabase/functions/_shared/patientPseudonym";
import { originalArchiveInputPatch } from "@/lib/patientOriginalArchive";
import { writeConfirmedPatientDraftCopies } from "@/lib/patientDraftRevision";
import { buildAnamnesisIntake, extractAnamnesisProfileAnswers, formatIntakeFact, mergeAnamnesisIntakes, mergeIntakeText, partitionIntakeDiagnoses } from "@/lib/anamnesisIntakeFields";
import { explicitIAAFields, mergeIAAFields } from "@/lib/iaaAssessment";

const pid = "P-2099-0401";
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(documentType = "labor", previewText = "synthetic reviewed laboratory input") {
  const source = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf("const handoffDirectBefundFiles = async () => {");
  const end = source.indexOf("  const loadArchivedBefundDocument", start);
  expect(start).toBeGreaterThan(-1); expect(end).toBeGreaterThan(start);
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const data: Record<string, unknown> = { _pseudonym_id: pid, pseudonymId: pid, laborKomplett: "synthetic prior input", manualDiagnosen: [] };
  const save = deferred<string>(); const read = deferred<any>();
  let submitted: Record<string, unknown> | undefined;
  let previews = [{ id: "synthetic-document", status: "ready", sourcePseudonymId: pid, documentType,
    privacyReviewed: true, file: { size: 42 }, previewText, documentDate: "2099-01-01", removedIdentifierCategories: [], pages: 1, chars: 35 }];
  const setter = (field: string) => (value: unknown) => { data[field] = typeof value === "function" ? value(data[field] || "") : value; };
  const extractStart = source.indexOf("const extractExplicitAnamneseInputs =");
  const extractEnd = source.indexOf("const ANALYSIS_CHUNK_MAX_CHARS", extractStart);
  const extractJs = ts.transpileModule(source.slice(extractStart, extractEnd), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const extract = new Function("buildAnamnesisIntake", "extractAnamnesisProfileAnswers", "explicitIAAFields", `${extractJs}; return extractExplicitAnamneseInputs;`)(buildAnamnesisIntake, extractAnamnesisProfileAnswers, explicitIAAFields);
  const env = {
    pseudonymId: pid, normalizePseudonymId: normalizePatientPseudonym, isPatientScopedStorageReady: () => true,
    anamnesisImportPendingRef: { current: false }, patientContextLoadingRef: { current: false }, patientContextLoadError: null,
    isAnalyzingDocs: false, isStreaming: false, isLoadingDiagnosen: false, isLoadingMannayanOrders: false,
    pendingDirectBefundFiles: previews, patientScopeGenerationRef: { current: 0 }, pseudonymIdRef: { current: pid }, patientDataOwnerRef: { current: pid },
    asText: (value: unknown) => String(value || ""),
    autoSaveRunIdRef: { current: 0 }, autoSaveTimerRef: { current: null }, autoSaveSessionIdRef: { current: null }, lastAutoSavedPayloadRef: { current: "" },
    window: { clearTimeout: vi.fn(), setTimeout: vi.fn() }, flushSync: (fn: () => void) => fn(), setIsImportingAnamnesis: vi.fn(),
    directIdentifierCategories: () => [], residualIdentifierCategories: () => [],
    mergeExtractedBlockIntoField: (prior: string, text: string) => `${prior}\n${text}`,
    setLaborKomplett: setter("laborKomplett"), setMetatronHeel: setter("metatronHeel"), setVievaPlus: setter("vievaPlus"),
    setAnamnese: setter("anamnese"), setArztbericht: setter("arztbericht"), setSonstigeUntersuchungen: setter("sonstigeUntersuchungen"),
    setLaborDatum: setter("laborDatum"), setMetatronDatum: setter("metatronDatum"), setVievaPlusDatum: setter("vievaPlusDatum"),
    setAnamneseDatum: setter("anamneseDatum"), setArztberichtDatum: setter("arztberichtDatum"),
    directBefundTargetLabel: (value: string) => value, extractExplicitAnamneseInputs: vi.fn(extract), applyExtractedToInputs: vi.fn(),
    buildAnamnesisIntake, partitionIntakeDiagnoses, mergeAnamnesisIntakes, mergeIntakeText, formatIntakeFact, mergeIAAFields,
    setSchwanger: setter("schwanger"), setAnamnesisIntakeV1: setter("anamnesisIntakeV1"), setAnamneseZusatz: setter("anamneseZusatz"),
    setErkrankung: setter("erkrankung"), setManualDiagnosen: setter("manualDiagnosen"), setSymptome: setter("symptome"), setMedikamente: setter("medikamente"),
    setNaturheilMittelHomoeopathie: setter("naturheilMittelHomoeopathie"), setNaturheilMittelPflanzenheilkunde: setter("naturheilMittelPflanzenheilkunde"),
    setNaturheilMittelVitamine: setter("naturheilMittelVitamine"), setNaturheilMittelMineralstoffe: setter("naturheilMittelMineralstoffe"), setNaturheilMittelSpurenelemente: setter("naturheilMittelSpurenelemente"),
    latestBuildInputDataRef: { current: (extra: Record<string, unknown>) => ({ ...data, ...extra }) },
    assertPayloadMatchesPseudonym: vi.fn(), patientDraftSaveQueue: { run: (_pid: string, fn: () => unknown) => fn() },
    persistVerifiedPatientInput, upsertAutoSaveDraft: vi.fn((_pid: string, payload: Record<string, unknown>) => { submitted = payload; return save.promise; }),
    draftRevisionTrackerRef: { current: { capture: vi.fn(), load: vi.fn(), revision: () => "00000000-0000-4000-8000-000000000001" } },
    setDraftSaveIssue: vi.fn(),
    archivePatientOriginal: vi.fn(async () => ({ pseudonymId: pid, archivePath: `${pid}/2099-01-01/labor-${"a".repeat(64)}.pdf`, sha256: "a".repeat(64), bytes: 42, reused: false })),
    verifyArchivedPatientOriginal: vi.fn(), originalArchiveInputPatch, applyDraftPayload: vi.fn(), writeConfirmedPatientDraftCopies,
    sessionStorage: { setItem: vi.fn() }, localStorage: { getItem: () => null, setItem: vi.fn() }, draftWriterId: "synthetic-window",
    supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => read.promise }) }) }) },
    setAutoSaveStatus: vi.fn(), logTherapyEvent: vi.fn(async () => undefined),
    setPendingDirectBefundFiles: (fn: (items: typeof previews) => typeof previews) => { previews = fn(previews); },
    toast: vi.fn(), setHistoryRefresh: vi.fn(), nextBefundActionRef: { current: null },
  };
  const applyStart = source.indexOf("function applyExtractedToInputs(");
  const applyEnd = source.indexOf("async function applyAndPersistExtractedInputs(", applyStart);
  const applyJs = ts.transpileModule(source.slice(applyStart, applyEnd), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  env.applyExtractedToInputs.mockImplementation(new Function(...Object.keys(env), `${applyJs}; return applyExtractedToInputs;`)(...Object.values(env)));
  const run = new Function(...Object.keys(env), `${js}; return handoffDirectBefundFiles;`)(...Object.values(env));
  const fieldStart = source.indexOf("const persistImportedDocumentText = async (");
  expect(fieldStart).toBeGreaterThan(-1);
  const fieldJs = ts.transpileModule(source.slice(fieldStart, start), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const importField = new Function(...Object.keys(env), `${fieldJs}; return persistImportedDocumentText;`)(...Object.values(env));
  return { env, run, importField, save, read, previews: () => previews, stored: () => ({ id: "synthetic-row", pseudonym_id: pid,
    eingabe_daten: { ...(submitted || data), autoSavedDraft: true, finalized: false } as Record<string, unknown> }) };
}

describe("direct import confirmation follows the database receipt", () => {
  it("saves IAA-only form values and notes through the real parent handoff", async () => {
    const t = setup("anamnese", "[IAA_FORMULAR:1.1;SEITE:37;MARKIERT:6]\nSynthetisch: besser durch Bewegung\n[/IAA_FORMULAR]");
    const done = t.run();
    await vi.waitFor(() => expect(t.env.upsertAutoSaveDraft).toHaveBeenCalled());
    expect(t.env.upsertAutoSaveDraft).toHaveBeenCalledWith(pid, expect.objectContaining({ anamneseZusatz: expect.objectContaining({ "iaa.1.1": "6", "iaaNote.1.1": "Synthetisch: besser durch Bewegung" }) }));
    t.save.resolve("synthetic-row"); t.read.resolve({ data: t.stored(), error: null }); await done;
    expect(t.previews()[0].status).toBe("done");
  });
  it("saves reproductive-only answers through the real batch extraction and field handoff", async () => {
    const t = setup("anamnese", "Frage/Feld: Sind Sie aktuell schwanger?\nErkannte Antwort: Ja\nFrage/Feld: Kinderzahl\nErkannte Antwort: 2");
    const done = t.run();
    await vi.waitFor(() => expect(t.env.upsertAutoSaveDraft).toHaveBeenCalled());
    expect(t.env.upsertAutoSaveDraft).toHaveBeenCalledWith(pid, expect.objectContaining({ schwanger: "schwanger", anamneseZusatz: expect.objectContaining({ children: expect.stringContaining("2"), pregnancy: expect.stringContaining("Ja") }) }));
    t.save.resolve("synthetic-row"); t.read.resolve({ data: t.stored(), error: null }); await done;
    expect(t.previews()[0].status).toBe("done");
  });
  it("keeps explicitly reported illness and diagnosis answers in their respective fields", async () => {
    const t = setup("anamnese", "Frage/Feld: Vorerkrankung\nErkannte Antwort: Synthetische Erkrankung A\nFrage/Feld: Diagnose\nErkannte Antwort: Synthetische Diagnose B");
    const done = t.run();
    await vi.waitFor(() => expect(t.env.upsertAutoSaveDraft).toHaveBeenCalled());
    const data = t.stored().eingabe_daten;
    expect(data.erkrankung).toContain("Erkrankung A"); expect(data.erkrankung).not.toContain("Diagnose B");
    expect((data.anamneseZusatz as Record<string, string>).diagnoses).toContain("Diagnose B");
    expect(data.manualDiagnosen).toEqual([expect.objectContaining({ diagnose: expect.stringContaining("Diagnose B") })]);
    t.save.resolve("synthetic-row"); t.read.resolve({ data: t.stored(), error: null }); await done;
    expect(t.previews()[0].status).toBe("done");
  });
  it("rolls back provisional field changes if original archiving fails", async () => {
    const t = setup(); t.env.archivePatientOriginal.mockRejectedValueOnce(new Error("synthetic failed archive"));
    await t.run();
    expect(t.env.upsertAutoSaveDraft).not.toHaveBeenCalled();
    expect(t.env.applyDraftPayload).toHaveBeenLastCalledWith(expect.objectContaining({ laborKomplett: "synthetic prior input" }), pid);
    expect(t.previews()[0].status).toBe("ready");
  });
  it("does not save a field import until its originals have been archived", async () => {
    const t = setup(); const archive = deferred<unknown[]>();
    const done = t.importField("synthetic new field text", pid, "laborKomplett", () => archive.promise);
    expect(t.env.upsertAutoSaveDraft).not.toHaveBeenCalled();
    archive.resolve([]);
    await vi.waitFor(() => expect(t.env.upsertAutoSaveDraft).toHaveBeenCalled());
    expect(t.env.upsertAutoSaveDraft).toHaveBeenCalledWith(pid, expect.objectContaining({ laborKomplett: "synthetic prior input\n\nsynthetic new field text" }));
    t.save.resolve("synthetic-row"); t.read.resolve({ data: t.stored(), error: null }); await done;
    expect(t.env.applyDraftPayload).toHaveBeenCalledWith(expect.objectContaining({ laborKomplett: "synthetic prior input\n\nsynthetic new field text" }), pid);
  });
  it("keeps existing fields untouched when original archiving fails", async () => {
    const t = setup();
    await expect(t.importField("synthetic new text", pid, "laborKomplett", async () => { throw new Error("synthetic archive unavailable"); })).rejects.toThrow(/archive unavailable/);
    expect(t.env.upsertAutoSaveDraft).not.toHaveBeenCalled();
    expect(t.env.applyDraftPayload).not.toHaveBeenCalled();
    expect(t.env.anamnesisImportPendingRef.current).toBe(false);
  });
  it("keeps the preview until saving AND complete readback finish", async () => {
    const t = setup(); const done = t.run();
    await vi.waitFor(() => expect(t.env.upsertAutoSaveDraft).toHaveBeenCalled());
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
    expect(t.env.applyDraftPayload).toHaveBeenLastCalledWith(expect.objectContaining({ laborKomplett: "synthetic prior input" }), pid);
    expect(t.env.draftRevisionTrackerRef.current.load).toHaveBeenCalledWith(pid, undefined);
  });
  it("does not confirm an old preview in a different patient scope", async () => {
    const t = setup(); const done = t.run();
    await vi.waitFor(() => expect(t.env.upsertAutoSaveDraft).toHaveBeenCalled());
    t.env.patientScopeGenerationRef.current++;
    t.save.resolve("synthetic-row"); t.read.resolve({ data: t.stored(), error: null }); await done;
    expect(t.previews()[0].status).toBe("ready");
    expect(t.env.logTherapyEvent).not.toHaveBeenCalled();
  });
});
