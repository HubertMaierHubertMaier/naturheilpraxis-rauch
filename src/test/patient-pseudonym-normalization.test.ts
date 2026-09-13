import { describe, expect, it } from "vitest";
import { normalizePatientPseudonym } from "../../supabase/functions/_shared/patientPseudonym";
import { readPatientInputDraft } from "@/lib/patientDraftRecovery";

describe("patient identifier and legacy draft recovery", () => {
  it("canonicalizes standard identifiers without changing custom case-sensitive identifiers", () => {
    expect(normalizePatientPseudonym(" p-2099-0101 ")).toBe("P-2099-0101");
    expect(normalizePatientPseudonym(" Custom-A ")).toBe("Custom-A");
    expect(normalizePatientPseudonym("p-2099-01")).toBe("p-2099-01");
    expect(normalizePatientPseudonym({})).toBe("");
  });
  it("recovers the newer case-bound legacy spelling without deleting any stored copy", () => {
    const values = new Map([
      ["therapy.inputs.draft.patientSafe.v4.P-2099-0101", JSON.stringify({ _pseudonym_id: "P-2099-0101", anamnese: "Früherer synthetischer Text", savedAt: "2026-09-12T00:00:00Z" })],
      ["therapy.inputs.draft.patientSafe.v4.p-2099-0101", JSON.stringify({ _pseudonym_id: "p-2099-0101", anamnese: "Neuer synthetischer Text", savedAt: "2026-09-13T00:00:00Z" })],
    ]);
    const recovered = readPatientInputDraft({ getItem: key => values.get(key) || null }, "P-2099-0101", data => Boolean(data.anamnese));
    expect(recovered.data?.anamnese).toBe("Neuer synthetischer Text");
    expect(values.size).toBe(2);
  });
  it("does not restore an unbound or contradictory recovery record", () => {
    for (const data of [{ anamnese: "synthetic" }, { _pseudonym_id: "P-2099-0101", pseudonymId: "P-2099-0102", anamnese: "synthetic" }]) {
      expect(readPatientInputDraft({ getItem: () => JSON.stringify(data) }, "P-2099-0101", () => true).data).toBeNull();
    }
  });
});
