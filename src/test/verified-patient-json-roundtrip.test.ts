import { expect, it, vi } from "vitest";
import { extractAnamnesisProfileAnswers } from "@/lib/anamnesisIntakeFields";
import { equalPatientInputValue, persistVerifiedPatientInput } from "@/lib/verifiedPatientInput";

const pid = "P-2099-0101";

it("accepts the actual native-profile payload after the normal JSON transport roundtrip", async () => {
  const profile = extractAnamnesisProfileAnswers("Frage/Feld: Kinderzahl\nErkannte Antwort: 2");
  expect(profile.additional.children[0]).toHaveProperty("sourceQuoteVerified", undefined);
  const payload = { _pseudonym_id: pid, pseudonymId: pid, anamnese: "Synthetischer vollständiger Text", anamnesisIntakeV1: profile };
  const stored = { id: "synthetic-draft", pseudonym_id: pid, eingabe_daten: JSON.parse(JSON.stringify(payload)) };
  await expect(persistVerifiedPatientInput(pid, payload, vi.fn().mockResolvedValue(stored.id), vi.fn().mockResolvedValue(stored))).resolves.toMatchObject({ id: stored.id });
});

it("still rejects a changed nested clinical value after JSON transport", async () => {
  const payload = { _pseudonym_id: pid, pseudonymId: pid, additional: { count: 2, optional: undefined } };
  const stored = { id: "synthetic-draft", pseudonym_id: pid, eingabe_daten: { ...payload, additional: { count: 1 } } };
  await expect(persistVerifiedPatientInput(pid, payload, vi.fn().mockResolvedValue(stored.id), vi.fn().mockResolvedValue(stored))).rejects.toThrow(/unverändert/);
});

it("keeps missing, null, false, zero and array order distinct according to JSON semantics", () => {
  expect(equalPatientInputValue({ optional: undefined, value: 0 }, { value: 0 })).toBe(true);
  expect(equalPatientInputValue({ value: null }, {})).toBe(false);
  expect(equalPatientInputValue({ value: false }, { value: 0 })).toBe(false);
  expect(equalPatientInputValue([1, 2], [2, 1])).toBe(false);
  expect(equalPatientInputValue({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
});
