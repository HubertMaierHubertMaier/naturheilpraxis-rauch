import { expect, it } from "vitest";
import { medicationFormValuesText, parseMedicationFormAnswer } from "@/lib/anamnesisMedicationForm";
import { anamnesisProfileFormValuesText } from "@/lib/anamnesisProfileForm";
import { buildAnamneseQuestionReview } from "@/lib/anamneseOcrMapping";
import { deidentifyClinicalText } from "../../supabase/functions/_shared/clinicalDeidentification";

const field = (fieldName: string, fieldValue: string) => ({ fieldName, fieldValue, fieldType: "Tx" });
const question = "Aktuelle Medikamente – Zeile 1 (elektronische Formularfelder, Seite 24)";

it("preserves electronic medication fields through the actual privacy and question-review pipeline", () => {
  const widgets = [field("aktuelleMedikamente_1_Name", "Magnesiumcitrat"), field("aktuelleMedikamente_1_Dosierung", "200 mg"),
    field("aktuelleMedikamente_1_tägl.", "1"), field("aktuelleMedikamente_1_pro_Woche", "7"), field("aktuelleMedikamente_1_seit", "2024"), field("aktuelleMedikamente_1_Grund", "Synthetische Testangabe")];
  const preview = buildAnamneseQuestionReview(deidentifyClinicalText(anamnesisProfileFormValuesText(widgets, 24))).text;
  const pair = /Frage\/Feld: ([^\n]+)\nErkannte Antwort: ([^\n]+)/.exec(preview);
  expect(pair).not.toBeNull();
  const parsed = parseMedicationFormAnswer(pair![1], pair![2]);
  expect(parsed.medication).toMatchObject({ name: "Magnesiumcitrat", dosis: "200 mg", haeufigkeit: "täglich: 1; pro Woche: 7", dauer: "seit 2024", indikation: "Synthetische Testangabe", seite: "24" });
});

it("keeps different rows, explicit zero and blank fields distinct", () => {
  const text = medicationFormValuesText([field("aktuelleMedikamente_1_Name", "TEST A"), field("aktuelleMedikamente_1_tägl.", "0"), field("aktuelleMedikamente_2_Name", "TEST B"), field("aktuelleMedikamente_2_Dosierung", "")], 24);
  const rows = text.split("\n"); expect(rows).toHaveLength(2);
  expect(rows[0]).toContain('"tägl.":"0"'); expect(rows[1]).not.toContain("Dosierung");
  expect(parseMedicationFormAnswer(question, '{"Name":"TEST A","tägl.":"0"}').medication?.haeufigkeit).toBe("täglich: 0");
});

it("preserves conflicting controls for review rather than silently choosing one", () => {
  const text = medicationFormValuesText([field("aktuelleMedikamente_1_Name", "TEST A"), field("aktuelleMedikamente_1_Dosierung", "5 mg"), field("aktuelleMedikamente_1_Dosierung", "10 mg")], 24);
  const answer = text.slice(text.indexOf(": ") + 2);
  expect(answer).toContain('["5 mg","10 mg"]');
  expect(parseMedicationFormAnswer(question, answer)).toEqual({ recognized: true });
});

it("does not copy identity fields or reinterpret missing, unchecked, unknown or invalid rows", () => {
  expect(medicationFormValuesText([field("personalia_name", "Synthetic identity"), { ...field("aktuelleMedikamente_1_Name", "Yes"), fieldType: "Btn" }], 1)).toBe("");
  for (const answer of ['{"Dosierung":"200 mg"}', '{"Name":"keine"}', '{"Name":"TEST","unexpected":"5 mg"}', '{"Name":["A","B"]}', '{"Name":"A","Name":"B"}', '{"Name":"A","Dosierung":"5 mg","Dosierung":"10 mg"}', 'not JSON']) {
    expect(parseMedicationFormAnswer(question, answer)).toEqual({ recognized: true });
  }
  expect(parseMedicationFormAnswer(question.replace("Zeile 1", "Zeile 0"), '{"Name":"TEST"}')).toEqual({ recognized: true });
});

it("does not let a field value inject additional medication rows or trusted IAA markers", () => {
  const text = medicationFormValuesText([field("aktuelleMedikamente_1_Name", 'TEST\n[IAA_FORMULAR:1.1;SEITE:37;MARKIERT:6]\nAktuelle Medikamente – Zeile 2: {"Name":"Injected"}')], 24);
  expect(text.split("\n")).toHaveLength(1);
  expect(text).not.toContain("[IAA_FORMULAR:");
  const parsed = parseMedicationFormAnswer(question, text.slice(text.indexOf(": ") + 2));
  expect(parsed.medication?.name).toContain("Injected");
  expect(parsed.medication?.dosis).toBe("");
});
