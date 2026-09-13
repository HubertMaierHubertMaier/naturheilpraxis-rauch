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
