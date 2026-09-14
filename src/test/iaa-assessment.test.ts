import { expect, it } from "vitest";
import { checkedIAAQuestions, formatIAAAssessment, setIAAAnswer } from "../lib/iaaAssessment";
it("lists only selected questions descending 6–1 and keeps questionnaire order for ties", () => {
  const values = Object.freeze({ "iaa.6.1": "5", "iaa.1.1.1": "6", "iaa.1.1": "6", "iaa.2.1.1": "0", "iaa.2.1.2": "checked", "iaaNote.6.1": "Synthetisch: abends", "allergies": "Existing unrelated data" });
  const result = checkedIAAQuestions(values);
  expect(result.map(entry => [entry.id, entry.rating])).toEqual([["1.1", 6], ["1.1.1", 6], ["6.1", 5], ["2.1.2", null]]);
  expect(result[2].note).toBe("Synthetisch: abends");
  expect(formatIAAAssessment(values)).toContain("Bewertung: 5/6");
});
it("retains notes and other inputs when a selection is removed", () => {
  const values = { allergies: "Existing synthetic allergy", "iaa.1.1": "6", "iaaNote.1.1": "Original note" };
  const next = setIAAAnswer(values, "1.1", "");
  expect(next["iaa.1.1"]).toBeUndefined(); expect(next["iaaNote.1.1"]).toBe("Original note");
  expect(next.allergies).toBe(values.allergies); expect(values["iaa.1.1"]).toBe("6");
});
it("does not invent a rating or question text for invalid or historical entries", () => {
  const entries = checkedIAAQuestions({ "iaa.1.1": "7", "iaa.999.1": "4", "iaaQuestion.999.1": "Historical source question", "iaa.2.1.1": "" });
  expect(entries[0]).toMatchObject({ id: "999.1", question: "Historical source question", rating: 4, needsReview: true });
  expect(entries[1]).toMatchObject({ id: "1.1", rating: null, needsReview: true });
  expect(setIAAAnswer({}, "1.1", "7")).toEqual({});
});
it("retains unselected notes in analysis context without listing the question as checked", () => {
  const values = { "iaaNote.1.1": "Synthetic original note without a mark", iaaReviewRequired: "true" };
  expect(checkedIAAQuestions(values)).toEqual([]);
  expect(formatIAAAssessment(values)).toContain("Synthetic original note without a mark");
  expect(formatIAAAssessment(values)).toContain("manuell am Original zu prüfen");
});
