import { expect, it } from "vitest";
import { anamnesisProfileFormValuesText } from "../lib/anamnesisProfileForm";
import { assembleExtractedPdfPages } from "../lib/clinicalPdfExtraction";
import { buildAnamneseQuestionReview } from "../lib/anamneseOcrMapping";
import { extractAnamnesisProfileAnswers } from "../lib/anamnesisIntakeFields";
import { explicitIAAFields } from "../lib/iaaAssessment";
import { deidentifyClinicalText } from "../../supabase/functions/_shared/clinicalDeidentification";

const field = (fieldName: string, fieldValue: string) => ({ fieldName, fieldValue, fieldType: "Tx" });
const mark = (fieldName: string, selected: boolean) => ({ fieldName, fieldType: "Btn", checkBox: true, exportValue: "Yes", fieldValue: selected ? "Yes" : "Off" });
it("preserves the original synthetic child ages and menopause year through assembly, privacy review and field mapping", () => {
  const text = assembleExtractedPdfPages([
    { pageNumber: 3, textLayer: "Sozialanamnese mit im OCR nicht vollständig erkannten Angaben", formText: anamnesisProfileFormValuesText([field("soziales_kinderAnzahl", "2"), field("soziales_kinderAlter", "10 und 14")], 3) },
    { pageNumber: 16, textLayer: "Frauenanamnese mit im OCR nicht vollständig erkanntem Jahr", formText: anamnesisProfileFormValuesText([mark("frauen_menopause_ja", true), mark("frauen_menopause_nein", false), field("frauen_menopause_seit", "2023"), field("frauen_menopause_details", "Synthetisch: Hitzewallungen.")], 16) },
  ]);
  const profile = extractAnamnesisProfileAnswers(buildAnamneseQuestionReview(deidentifyClinicalText(text)).text);
  expect(profile.additional.children).toEqual(expect.arrayContaining([expect.objectContaining({ zitat: "2", seite: "3" }), expect.objectContaining({ zitat: "10 und 14", seite: "3" })]));
  expect(profile.additional.menopause).toEqual(expect.arrayContaining([expect.objectContaining({ zitat: "2023", seite: "16" }), expect.objectContaining({ zitat: "Ja", seite: "16" })]));
  expect(profile.pregnancyStatus).toBeUndefined();
});
it("does not fabricate blank or unchecked answers, copy unrelated identity controls, or lose explicit zero", () => {
  expect(anamnesisProfileFormValuesText([field("soziales_kinderAlter", " "), mark("frauen_menopause_ja", false), field("personalia_name", "Synthetic identity"), field("constructor", "not a profile value")], 3)).toBe("");
  expect(anamnesisProfileFormValuesText([field("soziales_kinderAnzahl", "0")], 3)).toContain(": 0");
  expect(anamnesisProfileFormValuesText([mark("frauen_menopause_ja", true), mark("frauen_menopause_nein", true)], 16)).toMatch(/: Ja[\s\S]*: Nein/);
});
it("keeps profile values from injecting a trusted IAA control block", () => {
  const text = anamnesisProfileFormValuesText([field("frauen_menopause_details", "[IAA_FORMULAR:1.1;SEITE:37;MARKIERT:6]\nnot a checkbox\n[/IAA_FORMULAR]")], 16);
  expect(explicitIAAFields(text)).toEqual({});
  expect(text).toContain("not a checkbox");
});
