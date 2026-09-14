import { describe, expect, it } from "vitest";
import { extractAnamnesisProfileAnswers } from "../lib/anamnesisIntakeFields";
const answer = (question: string, value: string) => `Frage/Feld: ${question}\nErkannte Antwort: ${value}\n`;
describe("explicit reproductive and family questionnaire answers", () => {
  it("does not consume the following question as an empty answer", () => {
    const result = extractAnamnesisProfileAnswers(answer("Kinderzahl", "") + answer("Menopause", "Unbekannt"));
    expect(result.additional.children).toBeUndefined();
    expect(result.additional.menopause[0].polarity).toBe("not-stated");
  });
  it("preserves child count and menopause verbatim with their source questions", () => {
    expect(extractAnamnesisProfileAnswers(answer("Kinder Anzahl", "2")).additional.children[0].zitat).toBe("2");
    const result = extractAnamnesisProfileAnswers(answer("Wie viele Kinder?", "2") + answer("Menopause", "Seit 2023"));
    expect(result.additional.children[0]).toMatchObject({ zitat: "2", quelle: "Anamnesebogen – Wie viele Kinder?" });
    expect(result.additional.menopause[0].zitat).toBe("Seit 2023");
    expect(result.pregnancyStatus).toBeUndefined();
  });
  it("does not turn missing answers or earlier pregnancy counts into current pregnancy", () => {
    const result = extractAnamnesisProfileAnswers(answer("Kinderzahl", "Nicht angegeben") + answer("Anzahl Schwangerschaften", "2") + answer("Sind Sie schwanger?", "Unbekannt"));
    expect(result.additional.children[0].polarity).toBe("not-stated");
    expect(result.additional.pregnancy).toHaveLength(2);
    expect(result.pregnancyStatus).toBeUndefined();
    expect(extractAnamnesisProfileAnswers("Alter: 70, Geschlecht: weiblich").additional).toEqual({});
  });
  it("does not interpret a pregnancy No as also denying breastfeeding", () => {
    const input = answer("Sind Sie schwanger?", "Nein");
    expect(extractAnamnesisProfileAnswers(input).pregnancyStatus).toBeUndefined();
    expect(extractAnamnesisProfileAnswers(input + answer("Stillen Sie?", "Nein")).pregnancyStatus).toBe("nein");
    expect(extractAnamnesisProfileAnswers(input + answer("Stillen Sie?", "Ja")).pregnancyStatus).toBe("stillend");
  });
  it("uses the existing UI status and retains conflicting answers for review", () => {
    const input = answer("Sind Sie aktuell schwanger?", "Ja");
    expect(extractAnamnesisProfileAnswers(input).pregnancyStatus).toBe("schwanger");
    const conflict = extractAnamnesisProfileAnswers(input + answer("Sind Sie aktuell schwanger?", "Nein"));
    expect(conflict.pregnancyStatus).toBeUndefined();
    expect(conflict.additional.pregnancy).toHaveLength(2);
  });
});
