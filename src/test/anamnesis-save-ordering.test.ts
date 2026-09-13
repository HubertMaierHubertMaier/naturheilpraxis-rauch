// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { createPatientSaveQueue } from "@/lib/patientSaveQueue";
import { appendReviewedAnamnesis, persistVerifiedAnamnesis } from "@/lib/anamnesisRecovery";
import { writeConfirmedPatientDraftCopies } from "@/lib/patientDraftRevision";
import { originalArchiveInputPatch } from "@/lib/patientOriginalArchive";

const source = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8").replace(/\r\n/g, "\n");
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

// Execute the production callbacks with controlled network delays. Do not copy their logic.
function callback(marker: string, endMarker: string, environment: Record<string, unknown>) {
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf(endMarker, start);
  expect(end).toBeGreaterThan(start);
  const expression = source.slice(start + marker.length, end) + "\n}";
  const js = ts.transpileModule(`const callback = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(environment), `${js}; return callback;`)(...Object.values(environment));
}

function startAutosave(environment: Record<string, unknown>) {
  const marker = "useEffect(() => {\n    const pid = normalizePseudonymId(pseudonymId);\n    const runId";
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const effectSource = source.slice(start);
  const end = effectSource.indexOf("\n  }, [pseudonymId, hasMeaningfulInput");
  expect(end).toBeGreaterThan(-1);
  const js = ts.transpileModule(`const effect = ${effectSource.slice("useEffect(".length, end)}\n};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function(...Object.keys(environment), `${js}; return effect;`)(...Object.values(environment))();
}

function fixture() {
  const pid = "P-2099-0101";
  let stored: Record<string, unknown> = { anamnese: "Synthetischer Ausgangstext", anamneseDatum: "2026-09-13" };
  const writes: string[] = [];
  const timers: Array<() => Promise<void>> = [];
  const env = {
    pseudonymId: pid, pseudonymIdRef: { current: pid }, patientDataOwnerRef: { current: pid },
    patientScopeGenerationRef: { current: 0 }, patientContextLoadingRef: { current: false }, patientContextLoadError: null,
    autoSaveRunIdRef: { current: 0 }, autoSaveTimerRef: { current: 0 }, autoSaveSuppressedRef: { current: false },
    anamnesisImportPendingRef: { current: false }, isImportingAnamnesis: false, isPatientContextLoading: false,
    autoSaveSessionIdRef: { current: null }, lastAutoSavedPayloadRef: { current: "" }, hasMeaningfulInput: true,
    anamnese: String(stored.anamnese), patientDraftSaveQueue: createPatientSaveQueue(),
    normalizePseudonymId: (value: string) => value, isPatientScopedStorageReady: () => true,
    residualIdentifierCategories: () => [], assertPayloadMatchesPseudonym: vi.fn(), PATIENT_DATA_MISMATCH_ERROR: "owner mismatch",
    appendReviewedAnamnesis, persistVerifiedAnamnesis, anamnesisVersionHash: async () => "synthetic-hash",
    writeConfirmedPatientDraftCopies, draftWriterId: "synthetic-window",
    draftRevisionTrackerRef: { current: { capture: vi.fn(), revision: () => "00000000-0000-4000-8000-000000000001" } },
    originalArchiveInputPatch, applyDraftPayload: vi.fn(),
    buildInputData: (extra: Record<string, unknown>) => ({ ...stored, _pseudonym_id: pid, pseudonymId: pid, ...extra }),
    setIsImportingAnamnesis: vi.fn(), setAnamnese: vi.fn(), setAutoSaveStatus: vi.fn(), setHistoryRefresh: vi.fn(), logTherapyEvent: vi.fn(),
    sessionStorage: { setItem: vi.fn() }, localStorage: { getItem: vi.fn(() => null), setItem: vi.fn() }, toast: vi.fn(),
    window: { setTimeout: (fn: () => Promise<void>) => { timers.push(fn); return timers.length; }, clearTimeout: vi.fn() },
    upsertAutoSaveDraft: vi.fn(async (_pid: string, input: Record<string, unknown>) => { stored = input; writes.push(String(input.anamnese)); return "draft-id"; }),
    supabase: {
      auth: { getUser: vi.fn(async () => ({ data: { user: {} } })) },
      from: (table: string) => {
        const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === "therapy_sessions" ? { pseudonym_id: pid, eingabe_daten: stored, updated_at: "2026-09-13T08:00:00Z" } : { id: "version-id" }, error: null }) };
        return query;
      },
    },
  };
  return {
    env, writes, timers, stored: () => stored,
    importText: callback("onExtracted={", "\n                    }}", env),
  };
}

describe("confirmed import and real autosave callback ordering", () => {
  it("waits for an already-writing nonempty autosave before committing and confirming the import", async () => {
    const f = fixture();
    const gate = deferred<void>();
    const writer = f.env.upsertAutoSaveDraft.getMockImplementation()!;
    f.env.upsertAutoSaveDraft.mockImplementationOnce(async (...args) => { await gate.promise; return writer(...args); });
    startAutosave(f.env);
    const pendingSave = f.timers[0](); await tick();
    const imported = f.importText("Geprüfte synthetische PDF-Quelle", f.env.pseudonymId); await tick();
    expect(f.env.setAnamnese).not.toHaveBeenCalled();
    expect(f.env.anamnesisImportPendingRef.current).toBe(true);
    gate.resolve(); await pendingSave; await imported;
    expect(f.writes).toHaveLength(2);
    expect(f.stored().anamnese).toContain("Geprüfte synthetische PDF-Quelle");
    expect(f.env.setAnamnese).toHaveBeenCalledWith(f.stored().anamnese);
    const restored = JSON.parse(f.env.sessionStorage.setItem.mock.calls[0][1]);
    expect(restored.anamnese).toBe(f.stored().anamnese);
    expect(restored._draftBaseRevision).toBe("00000000-0000-4000-8000-000000000001");
    expect(f.env.anamnesisImportPendingRef.current).toBe(false);
  });

  it("discards an old autosave whose authentication finishes after import confirmation", async () => {
    const f = fixture();
    const auth = deferred<{ data: { user: object } }>();
    f.env.supabase.auth.getUser.mockImplementationOnce(() => auth.promise);
    startAutosave(f.env);
    const pendingSave = f.timers[0](); await tick();
    await f.importText("Geprüfte synthetische PDF-Quelle", f.env.pseudonymId);
    const confirmed = f.stored().anamnese;
    auth.resolve({ data: { user: {} } }); await pendingSave;
    expect(f.writes).toHaveLength(1);
    expect(f.stored().anamnese).toBe(confirmed);
    expect(confirmed).toContain("Geprüfte synthetische PDF-Quelle");
  });

  it("keeps verification inside the queue and continues after a failed write", async () => {
    const queue = createPatientSaveQueue();
    const gate = deferred<void>();
    const events: string[] = [];
    const first = queue.run("P-2099-0101", async () => { events.push("write"); await gate.promise; events.push("readback"); throw new Error("readback failed"); });
    const rejected = expect(first).rejects.toThrow("readback failed");
    const second = queue.run("P-2099-0101", async () => { events.push("next write"); });
    await tick(); expect(events).toEqual(["write"]);
    gate.resolve(); await rejected; await second;
    expect(events).toEqual(["write", "readback", "next write"]);
  });

  it("invalidates auth-delayed callbacks when the old form unmounts", async () => {
    const f = fixture(); const auth = deferred<{ data: { user: object } }>();
    f.env.supabase.auth.getUser.mockImplementationOnce(() => auth.promise);
    startAutosave(f.env);
    const pendingSave = f.timers[0](); await tick();
    const cleanup = callback("// Invalidate pending callbacks when this form unmounts; the shared write queue survives.\n  useEffect(() => ", "\n  }, []);", f.env);
    cleanup();
    auth.resolve({ data: { user: {} } }); await pendingSave;
    expect(f.writes).toHaveLength(0);
    expect(f.env.patientScopeGenerationRef.current).toBe(1);
  });

  it("cancels a queued import after a case switch without writing into either case", async () => {
    const f = fixture(); const gate = deferred<void>();
    const prior = f.env.patientDraftSaveQueue.run(f.env.pseudonymId, () => gate.promise);
    const imported = f.importText("Geprüfte synthetische PDF-Quelle", f.env.pseudonymId);
    const rejected = expect(imported).rejects.toThrow(/gewechselt/);
    f.env.pseudonymIdRef.current = "P-2099-0102"; f.env.patientScopeGenerationRef.current += 1;
    gate.resolve(); await prior; await rejected;
    expect(f.writes).toHaveLength(0);
    expect(f.env.setAnamnese).not.toHaveBeenCalled();
    expect(f.env.anamnesisImportPendingRef.current).toBe(false);
  });
});
