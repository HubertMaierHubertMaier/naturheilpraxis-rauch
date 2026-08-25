import { describe, expect, it } from "vitest";
import { buildAnamneseQuestionReview } from "@/lib/anamneseOcrMapping";
import {
  deidentifyClinicalText,
  directIdentifierCategories,
  removeResidualDirectIdentifierLines,
} from "../../supabase/functions/_shared/clinicalDeidentification";

describe("local anamnesis question review", () => {
  it("maps explicit question-answer lines to the recognized form section", () => {
    const review = buildAnamneseQuestionReview([
      "=== Dokument-123456abcdef (2 S.) ===",
      "--- Seite 6 ---",
      "VI. Magen & Darm",
      "Appetit: normal",
      "Durst: vermehrt",
    ].join("\n"), [{ pageNumber: 6, confidence: 92 }]);

    expect(review.mappedAnswerCount).toBe(2);
    expect(review.manualReviewCount).toBe(0);
    expect(review.lowConfidencePages).toEqual([]);
    expect(review.text).toContain("Bereich im Anamnesebogen: VI. Magen & Darm");
    expect(review.text).toContain("Frage/Feld: Appetit");
    expect(review.text).toContain("Erkannte Antwort: normal");
  });

  it("does not guess standalone handwriting and keeps it visible for manual review", () => {
    const review = buildAnamneseQuestionReview([
      "--- Seite 3 ---",
      "III. Kopf & Sinne",
      "synthetische unleserliche Handschrift",
    ].join("\n"), [{ pageNumber: 3, confidence: 41 }]);

    expect(review.mappedAnswerCount).toBe(0);
    expect(review.manualReviewCount).toBe(1);
    expect(review.lowConfidencePages).toEqual([3]);
    expect(review.text).toContain("Manuell pruefen");
    expect(review.text).toContain("synthetische unleserliche Handschrift");
    expect(review.text).toContain("Seite(n) 3 liegen unter 80 %");
  });

  it("keeps every non-boilerplate clinical line in either mapped or manual output", () => {
    const review = buildAnamneseQuestionReview([
      "Anamnesebogen",
      "--- Seite 15 ---",
      "XV. Medikamente",
      "Medikament: Synthetikum 5 mg",
      "Markierung neben Dosierung unklar",
    ].join("\n"));

    expect(review.text).toContain("Medikament");
    expect(review.text).toContain("Synthetikum 5 mg");
    expect(review.text).toContain("Markierung neben Dosierung unklar");
    expect(review.text).not.toContain("Manuell pruefen (keine sichere Frage-Antwort-Zuordnung, Nicht eindeutig erkannt, Seite nicht erkannt): Anamnesebogen");
  });

  it("does not restore synthetic contact data removed before question mapping", () => {
    const locallyCleaned = removeResidualDirectIdentifierLines(deidentifyClinicalText([
      "--- Seite 1 ---",
      "I. Patientendaten",
      "E-Mail: testperson@example.invalid",
      "Telefon privat: +49 111 22223333",
      "--- Seite 21 ---",
      "XXI. Beschwerden",
      "Hauptbeschwerde: rein synthetische Erschoepfung",
    ].join("\n")));
    const review = buildAnamneseQuestionReview(locallyCleaned);

    expect(directIdentifierCategories(review.text)).toEqual([]);
    expect(review.text).not.toContain("testperson@example.invalid");
    expect(review.text).not.toContain("+49 111 22223333");
    expect(review.text).toContain("rein synthetische Erschoepfung");
  });
});
