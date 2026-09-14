// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { normalizePatientPseudonym, STANDARD_PATIENT_PSEUDONYM } from "../../supabase/functions/_shared/patientPseudonym";
const source = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8").replace(/\r\n/g, "\n");

function setup() {
  const marker = "const handlePseudonymChange = useCallback(";
  const start = source.indexOf(marker); const end = source.indexOf("\n  }, [pseudonymId, hasMeaningfulInput", start);
  expect(start).toBeGreaterThan(-1); expect(end).toBeGreaterThan(start);
  const js = ts.transpileModule(`const handler = ${source.slice(start + marker.length, end)}\n};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const env = {
    normalizePseudonymId: normalizePatientPseudonym, STANDARD_PSEUDONYM_PATTERN: STANDARD_PATIENT_PSEUDONYM,
    patientDataOwnerRef: { current: "P-2099-0101" }, pseudonymId: "P-2099-0101", pseudonymIdRef: { current: "P-2099-0101" },
    patientScopeGenerationRef: { current: 0 }, archiveDeleteRunIdRef: { current: 0 }, autoSaveSuppressedRef: { current: false },
    abortRef: { current: null }, docAbortRef: { current: null }, clearPatientScopedState: vi.fn(),
    hasMeaningfulInput: true, result: "", docAnalysisHtml: "", manualDiagnosen: [], manualMittel: [], toast: vi.fn(),
    sessionStorage: { removeItem: vi.fn() }, localStorage: { removeItem: vi.fn() }, DRAFT_KEY: "legacy-draft",
    setPseudonymFormatWarning: vi.fn(), setPseudonymId: vi.fn(),
  };
  return { env, change: new Function(...Object.keys(env), `${js}; return handler;`)(...Object.values(env)) };
}

describe("patient selector preserves identity and recovery data", () => {
  it("does not turn an overlong identifier into another existing patient", () => {
    const { env, change } = setup(); change("P-2099-01012");
    expect(env.setPseudonymId).toHaveBeenCalledWith("P-2099-01012");
    expect(env.pseudonymIdRef.current).not.toBe("P-2099-0101");
    expect(env.setPseudonymFormatWarning).toHaveBeenCalledWith(expect.stringContaining("nicht gekürzt"));
  });
  it("keeps case-specific recovery data when the selector is cleared", () => {
    const { env, change } = setup(); change("");
    expect(env.localStorage.removeItem).not.toHaveBeenCalled();
    expect(env.setPseudonymId).toHaveBeenCalledWith("");
  });
  it("does not clear the current patient for a spelling-only case change", () => {
    const { env, change } = setup(); change("p-2099-0101");
    expect(env.clearPatientScopedState).not.toHaveBeenCalled();
    expect(env.setPseudonymId).toHaveBeenCalledWith("P-2099-0101");
  });
});

describe("patient selection restoration on remount", () => {
  function mount(saved: string) {
    const start = source.indexOf("  useEffect(() => {\n    if (draftLoadedRef.current) return;");
    const end = source.indexOf("  useEffect(() => {\n    if (!draftLoadedRef.current) return;", start);
    const readyStart = source.indexOf("const isPatientScopedStorageReady =");
    const readyEnd = source.indexOf("const getEmbeddedPseudonymId", readyStart);
    expect(start).toBeGreaterThan(-1); expect(end).toBeGreaterThan(start);
    const js = ts.transpileModule(source.slice(readyStart, readyEnd) + source.slice(start, end),
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const values = new Map([["selected", saved], ["recovery", "synthetic recovery retained"]]);
    const state = { pid: "", restored: false };
    const refs = { draftLoadedRef: { current: false }, pseudonymIdRef: { current: "" }, patientDataOwnerRef: { current: "" } };
    const render = () => {
      const effects: Array<() => void> = [];
      const env = { ...refs, pseudonymId: state.pid, sessionPseudonymRestored: state.restored,
        normalizePseudonymId: normalizePatientPseudonym, STANDARD_PSEUDONYM_PATTERN: STANDARD_PATIENT_PSEUDONYM,
        PID_KEY: "selected", DRAFT_KEY: "unscoped",
        sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) },
        setPseudonymId: (pid: string) => { state.pid = pid; }, setSessionPseudonymRestored: (value: boolean) => { state.restored = value; },
        useEffect: (effect: () => void) => effects.push(effect),
      };
      new Function(...Object.keys(env), js)(...Object.values(env));
      return effects;
    };
    const effects = render(); effects.forEach(effect => effect());
    const afterInitialEffects = values.get("selected");
    // Strict-mode effect replay must not erase the stored selection either.
    effects.forEach(effect => effect()); render().forEach(effect => effect());
    return { state, values, afterInitialEffects };
  }
  it.each(["P-2099-0101", "SYNTH-UI-74ced0ea-17bf-4540-92b8-cfd1e914d8ea"])("restores %s without the initial empty mirror deleting it", saved => {
    const result = mount(saved);
    expect(result.state.pid).toBe(saved); expect(result.afterInitialEffects).toBe(saved);
    expect(result.values.get("selected")).toBe(saved); expect(result.values.get("recovery")).toBe("synthetic recovery retained");
  });
  it("does not restore an incomplete standard identifier", () => {
    const result = mount("P-2099-01");
    expect(result.state.pid).toBe(""); expect(result.values.has("selected")).toBe(false);
    expect(result.values.get("recovery")).toBe("synthetic recovery retained");
  });
});
