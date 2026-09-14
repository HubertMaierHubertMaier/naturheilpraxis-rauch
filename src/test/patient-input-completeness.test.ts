import { expect, it } from "vitest";
import { assertUntruncatedPatientInput } from "../lib/patientInputCompleteness";

it("does not allow a history excerpt to replace a full patient input", () => {
  expect(() => assertUntruncatedPatientInput({ anamnese: "Auszug", _inputTruncatedFields: ["anamnese"] })).toThrow(/gekürzte Auszüge/);
  expect(() => assertUntruncatedPatientInput({ _inputCompleteness: "history_excerpt_not_for_recovery" })).toThrow();
  expect(() => assertUntruncatedPatientInput({ anamnese: "Vollständiger Inhalt", _inputTruncatedFields: [] })).not.toThrow();
});
