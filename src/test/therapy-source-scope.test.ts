// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { assertStageSourcesPresent, buildTherapySourceScope, parseTherapySourceScope, sameTherapySourceScope, sourceLimitedTherapyInput, stageIncludesSource, verifiedSourceLimitedTherapyInput } from "../../supabase/functions/_shared/therapySourceScope";
const hash = "a".repeat(64);
describe("therapy source stages", () => {
  it("recognizes both split-document keys and single fields without adding unrelated sources", () => {
    expect(stageIncludesSource("anamnese", "anamnese:doc:abcdef012345")).toBe(true);
    expect(stageIncludesSource("anamnese", "anamnese::legacy")).toBe(true);
    expect(stageIncludesSource("anamnese", "metatronHeel")).toBe(false);
    expect(stageIncludesSource("all", "patientenkontext")).toBe(false);
    expect(stageIncludesSource("all", "analysisProfile")).toBe(false);
  });
  it("treats laboratory fields as alternatives but requires each requested source family", () => {
    expect(() => assertStageSourcesPresent("anamnese-metatron-labor", ["anamnese", "metatronHeel", "laborErhoeht"])).not.toThrow();
    expect(() => assertStageSourcesPresent("anamnese-metatron-labor", ["anamnese", "laborErhoeht"])).toThrow();
    expect(() => assertStageSourcesPresent("anamnese", ["anamnese", "laborKomplett"])).toThrow();
  });
  it("rejects missing, duplicated and malformed evidence and detects changed content", () => {
    const scope = buildTherapySourceScope("anamnese", [{ sourceId: "anamnese", contentSha256: hash }]);
    expect(parseTherapySourceScope(scope)).toEqual(scope);
    expect(parseTherapySourceScope({ ...scope, sources: [...scope.sources, ...scope.sources] })).toBeNull();
    expect(parseTherapySourceScope({ ...scope, sources: [{ sourceId: "anamnese", contentSha256: "missing" }] })).toBeNull();
    expect(sameTherapySourceScope(scope, buildTherapySourceScope("anamnese", [{ sourceId: "anamnese", contentSha256: "b".repeat(64) }]))).toBe(false);
  });
  it("leaves the original complete safety input intact while excluding unrelated diagnostic sources", () => {
    const input = { anamnese: "Synthetic history", laborKomplett: "Synthetic lab", metatronHeel: "Synthetic NLS", symptome: "Previously extracted", medikamente: "Synthetic medication", schwanger: "schwanger", befundAuswertung: "Bound report" };
    const scoped = sourceLimitedTherapyInput(input, "anamnese");
    expect(scoped).toMatchObject({ anamnese: input.anamnese, medikamente: input.medikamente, schwanger: "schwanger", befundAuswertung: "Bound report" });
    expect(scoped.laborKomplett).toBeUndefined(); expect(scoped.metatronHeel).toBeUndefined(); expect(scoped.symptome).toBeUndefined();
    expect(input.laborKomplett).toBe("Synthetic lab"); expect(input.symptome).toBe("Previously extracted");
  });
  it("recomputes source evidence on the server and never uses a different raw-field copy", async () => {
    const contentSha256 = createHash("sha256").update("Approved synthetic history").digest("hex");
    const scope = buildTherapySourceScope("anamnese", [{ sourceId: "anamnese:doc:abcdef012345", contentSha256 }]);
    const input = { anamnese: "Unverified different raw text", therapySourceDocuments: [{ sourceId: "anamnese:doc:abcdef012345", text: " Approved synthetic history \r\n" }] };
    const scoped = await verifiedSourceLimitedTherapyInput(input, scope);
    expect(scoped.anamnese).toBe(input.therapySourceDocuments[0].text);
    expect(scoped.anamnese).not.toContain("Unverified");
    expect(input.anamnese).toBe("Unverified different raw text");
    await expect(verifiedSourceLimitedTherapyInput({ ...input, therapySourceDocuments: [{ sourceId: "anamnese:doc:abcdef012345", text: "Changed after the report" }] }, scope)).rejects.toThrow(/nicht.*überein/);
    await expect(verifiedSourceLimitedTherapyInput({ anamnese: "Approved synthetic history" }, scope)).rejects.toThrow(/fehlen/);
  });
});
