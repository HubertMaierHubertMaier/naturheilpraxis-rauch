// @vitest-environment node
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { emptyEntry } from "@/components/admin/therapy/PathogenInput";
import { normalizePatientPseudonym } from "../../supabase/functions/_shared/patientPseudonym";

const source = readFileSync("src/components/admin/TherapyRecommendation.tsx", "utf8").replace(/\r\n/g, "\n");
const ast = ts.createSourceFile("TherapyRecommendation.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helpers = ["countStringChars", "countDiagnoseEntries", "countLoadedClinicalChars", "hasRestorableClinicalData"].map(name => {
  const statement = ast.statements.find(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === name));
  if (!statement) throw new Error(`Missing recovery helper ${name}`);
  return statement.getText(ast);
}).join("\n");
const start = source.indexOf("  useEffect(() => {\n    if (!draftLoadedRef.current) return;");
const end = source.indexOf("  }, [pseudonymId, buildInputData", start);
if (start < 0 || end <= start) throw new Error("Recovery mirror was not found");
const js = ts.transpileModule(`${helpers}\nconst mirror = ${source.slice(start + "  useEffect(".length, end)}\n};`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function setup(payload: Record<string, unknown>) {
  const windowValues = new Map([["recovery", "previous confirmed recovery"]]);
  const sharedValues = new Map(windowValues);
  const storage = (values: Map<string, string>) => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  const env = {
    draftLoadedRef: { current: true }, patientContextLoadingRef: { current: false },
    pseudonymId: "P-2099-0801", normalizePseudonymId: normalizePatientPseudonym,
    sessionStorage: storage(windowValues), localStorage: storage(sharedValues), DRAFT_KEY: "unscoped",
    buildInputData: () => payload, useProModel: false, residualIdentifierCategories: () => [],
    normalizeTherapyInput: (input: unknown) => input, isPatientScopedStorageReady: () => true,
    inputDraftKey: "recovery", draftRevisionTrackerRef: { current: { revision: () => "11111111-1111-4111-8111-111111111111" } },
    draftWriterId: "synthetic-writer",
  };
  const functions = new Function(...Object.keys(env), `${js}\nreturn { hasRestorableClinicalData, mirror };`)(...Object.values(env));
  return { ...functions, windowValues, sharedValues };
}

describe("empty form placeholders cannot replace patient recovery", () => {
  it("does not treat a default row with only its generated ID as clinical input", () => {
    const payload = { pathogens: [emptyEntry()], schwanger: "nein" };
    expect(setup(payload).hasRestorableClinicalData(payload)).toBe(false);
  });
  it("keeps both existing recovery copies when the newly mounted form is still empty", () => {
    const test = setup({ pathogens: [emptyEntry()], schwanger: "nein" });
    test.mirror();
    expect(test.windowValues.get("recovery")).toBe("previous confirmed recovery");
    expect(test.sharedValues.get("recovery")).toBe("previous confirmed recovery");
    expect(test.windowValues.has("unscoped")).toBe(false);
  });
  it.each(["name", "organe", "index"])("retains a genuinely entered %s value", field => {
    const payload = { pathogens: [{ ...emptyEntry(), [field]: "synthetic entered value" }] };
    expect(setup(payload).hasRestorableClinicalData(payload)).toBe(true);
  });
  it("retains nonempty legacy string entries", () => {
    const payload = { pathogens: ["synthetic historical entry"] };
    expect(setup(payload).hasRestorableClinicalData(payload)).toBe(true);
  });
  it("still mirrors the complete actual anamnesis text to both recovery copies", () => {
    const payload = { anamnese: "Synthetic line one\nSynthetic line two", pathogens: [emptyEntry()] };
    const test = setup(payload); test.mirror();
    expect(JSON.parse(test.windowValues.get("recovery")!).anamnese).toBe(payload.anamnese);
    expect(JSON.parse(test.sharedValues.get("recovery")!).anamnese).toBe(payload.anamnese);
  });
});
