import { describe, expect, it, vi } from "vitest";
import { mergeAnamnesisRecovery, appendReviewedAnamnesis, persistVerifiedAnamnesis } from "@/lib/anamnesisRecovery";

const pid = "P-2099-0101";
const current = { _pseudonym_id: pid, pseudonymId: pid, anamnese: "Unveränderter Quellentext – Ü", anamneseDatum: "2026-09-13" };

describe("anamnesis input recovery", () => {
  it("preserves a bound local anamnesis and its date against a partial cloud draft", () => {
    const result = mergeAnamnesisRecovery(current, { _pseudonym_id: pid, anamnese: "", anamneseDatum: "2025-01-01", laborKomplett: "Neue Laborquelle" }, pid);
    expect(result.preservedAnamnesis).toBe(true);
    expect(result.input.anamnese).toBe(current.anamnese);
    expect(result.input.anamneseDatum).toBe(current.anamneseDatum);
    expect(result.input.laborKomplett).toBe("Neue Laborquelle");
  });
  it("accepts a nonempty incoming source without inventing a merge", () => {
    const result = mergeAnamnesisRecovery(current, { _pseudonym_id: pid, anamnese: "Neue bestätigte Quelle", anamneseDatum: "2026-09-14" }, pid);
    expect(result.input.anamnese).toBe("Neue bestätigte Quelle");
    expect(result.preservedAnamnesis).toBe(false);
  });
  it("never transfers text from another or unbound patient", () => {
    expect(() => mergeAnamnesisRecovery({ ...current, _pseudonym_id: "P-2099-0102" }, {}, pid)).toThrow(/Pseudonym/);
    expect(() => mergeAnamnesisRecovery(current, { pseudonymId: "P-2099-0102" }, pid)).toThrow(/Pseudonym/);
    expect(mergeAnamnesisRecovery({ anamnese: "Ungebundener Text" }, {}, pid).input.anamnese).toBeUndefined();
  });
  it("does not duplicate the same reviewed block after a retry", () => {
    expect(appendReviewedAnamnesis("", "Quelle")).toBe("Quelle");
    expect(appendReviewedAnamnesis("Quelle", "Quelle")).toBe("Quelle");
    expect(appendReviewedAnamnesis("Quelle", "Weitere Quelle")).toBe("Quelle\n\nWeitere Quelle");
    expect(() => appendReviewedAnamnesis("Quelle", "  ")).toThrow();
  });
  it("waits for save and verifies both the record and the history receipt", async () => {
    let finish!: (id: string) => void;
    const read = vi.fn(async () => ({ pseudonym_id: pid, eingabe_daten: current, versionVerified: true }));
    const promise = persistVerifiedAnamnesis(pid, current, () => new Promise((resolve) => { finish = resolve; }), read);
    expect(read).not.toHaveBeenCalled();
    finish("saved-id");
    await expect(promise).resolves.toMatchObject({ id: "saved-id" });
    expect(read).toHaveBeenCalledWith("saved-id");
  });
  it("rejects missing, truncated, wrong-patient and unversioned readbacks", async () => {
    const cases = [null,
      { pseudonym_id: pid, eingabe_daten: { ...current, anamnese: "gekürzt" }, versionVerified: true },
      { pseudonym_id: "P-2099-0102", eingabe_daten: current, versionVerified: true },
      { pseudonym_id: pid, eingabe_daten: current, versionVerified: false },
    ];
    for (const value of cases) await expect(persistVerifiedAnamnesis(pid, current, async () => "id", async () => value)).rejects.toThrow(/zurückgelesen/);
    await expect(persistVerifiedAnamnesis(pid, current, async () => null, async () => null)).rejects.toThrow(/nicht bestätigt/);
  });
});
