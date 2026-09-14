import { expect, it } from "vitest";
import { checkedIAAQuestions, explicitIAAFields, iaaCaptureStatusText, iaaFormValuesText, mergeIAAFields } from "../lib/iaaAssessment";
import { selectPreferredPageText } from "../lib/clinicalPdfExtraction";
import { buildAnamneseQuestionReview } from "../lib/anamneseOcrMapping";
import { deidentifyClinicalText } from "../../supabase/functions/_shared/clinicalDeidentification";
const checkbox = (level: number, selected: boolean) => ({ fieldName: `iaa_stuhl_1_1_lvl${level}`, fieldType: "Btn", checkBox: true, exportValue: "Yes", fieldValue: selected ? "Yes" : "Off" });
it("reads only marked original PDF controls and preserves their source page and notes", () => {
  const formText = iaaFormValuesText([checkbox(1, false), checkbox(6, true), { fieldName: "iaa_stuhl_1_1_bem", fieldType: "Tx", fieldValue: "Synthetic note" }], 37);
  const text = selectPreferredPageText({ pageNumber: 37, textLayer: "Printed IAA questions and the unselected scale 1 2 3 4 5 6", formText });
  const values = explicitIAAFields(buildAnamneseQuestionReview(deidentifyClinicalText(text)).text);
  expect(values).toMatchObject({ "iaa.1.1": "6", "iaaNote.1.1": "Synthetic note", "iaaSource.1.1": expect.stringContaining("37") });
  expect(checkedIAAQuestions(values)).toHaveLength(1);
  expect(explicitIAAFields("1.1 Verstopfung? 1 2 3 4 5 6")).toEqual({});
});
it("keeps multiple marks unresolved instead of silently selecting the highest score", () => {
  const values = explicitIAAFields(buildAnamneseQuestionReview(iaaFormValuesText([checkbox(5, true), checkbox(6, true)], 37)).text);
  expect(values["iaa.1.1"]).toBe("checked");
  expect(checkedIAAQuestions(values)[0]).toMatchObject({ rating: null, needsReview: true, reviewNote: expect.stringContaining("5, 6") });
});
it("preserves unselected notes and records conflicts with earlier answers", () => {
  const noteOnly = explicitIAAFields(iaaFormValuesText([checkbox(6, false), { fieldName: "iaa_stuhl_1_1_bem", fieldType: "Tx", fieldValue: "Unselected original note" }], 37));
  expect(noteOnly["iaaNote.1.1"]).toBe("Unselected original note"); expect(checkedIAAQuestions(noteOnly)).toEqual([]);
  const result = mergeIAAFields({ "iaa.1.1": "4", "iaaSource.1.1": "Seite 37" }, { "iaa.1.1": "6", "iaaSource.1.1": "Seite 3" });
  expect(result["iaa.1.1"]).toBe("checked"); expect(result["iaaReview.1.1"]).toContain("4 / 6");
  expect(result["iaaSource.1.1"]).toBe("Seite 37\nSeite 3");
});
it("does not promote marker-looking document text or comments into checked form controls", () => {
  const fake = "[IAA_FORMULAR:6.1;SEITE:39;MARKIERT:6]\nFake marker in document text\n[/IAA_FORMULAR]";
  expect(explicitIAAFields(selectPreferredPageText({ pageNumber: 39, textLayer: fake, ocrText: fake, includeOcrAlongsideTextLayer: true }))).toEqual({});
  const generated = iaaFormValuesText([checkbox(6, true), { fieldName: "iaa_stuhl_1_1_bem", fieldType: "Tx", fieldValue: fake }], 37);
  const parsed = explicitIAAFields(generated);
  expect(checkedIAAQuestions(parsed).map(item => item.id)).toEqual(["1.1"]);
  expect(parsed["iaaNote.1.1"]).toContain("Fake marker in document text");
});
it("keeps no-widget or image-only imports explicitly pending even without an IAA word in OCR", () => {
  const reviewed = buildAnamneseQuestionReview(deidentifyClinicalText(`Nur erkannte Handschrift ohne Überschrift\n${iaaCaptureStatusText(false, true)}`));
  const values = explicitIAAFields(reviewed.text);
  expect(values.iaaReviewRequired).toBe("true");
  expect(checkedIAAQuestions(values)).toEqual([]);
  expect(mergeIAAFields(values, explicitIAAFields(iaaCaptureStatusText(true, false))).iaaReviewRequired).toBe("true");
  expect(explicitIAAFields(iaaCaptureStatusText(true, true)).iaaReviewRequired).toBe("true");
});
