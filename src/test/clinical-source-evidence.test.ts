// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PARTIAL_ANALYSIS_ARRAY_KEYS, PARTIAL_ANAMNESIS_ARRAY_KEYS, assertCompletePartialCollections, attachClinicalSourceEvidence, splitPageAwareClinicalText, combineClinicalPartials, clinicalEvidenceText } from "../../supabase/functions/_shared/clinicalSourceEvidence";
import { buildAnamnesisIntake, formatIntakeFact, mergeIntakeText } from "../lib/anamnesisIntakeFields";
import { assertQuestionnaireValidationContract, requiresVerifiedFormReport } from "../../supabase/functions/_shared/questionnaireEvidence";

const empty = (): Record<string, any> => ({ ...Object.fromEntries(PARTIAL_ANALYSIS_ARRAY_KEYS.map(key => [key, []])), anamnese: Object.fromEntries(PARTIAL_ANAMNESIS_ARRAY_KEYS.map(key => [key, []])) });
describe("clinical source evidence", () => {
  it("requires the new server-side answer validation before accepting questionnaire partials", () => {
    expect(() => assertQuestionnaireValidationContract({}, "Anamnesebogen")).toThrow(/noch nicht bereitgestellt/);
    expect(() => assertQuestionnaireValidationContract({ source_coverage_v1: { answerValidationVersion: 1 } }, "Anamnesebogen")).not.toThrow();
    expect(() => assertQuestionnaireValidationContract({}, "Freier Arztbericht mit dokumentiertem Befund")).not.toThrow();
  });
  it("retains the answer-validation contract across retry-part merges only when every part is validated", () => {
    const checked = attachClinicalSourceEvidence(empty(), "Anamnesebogen", "Quelle", "1/1");
    expect(() => assertQuestionnaireValidationContract(combineClinicalPartials([checked, checked]), "Anamnesebogen")).not.toThrow();
    expect(() => assertQuestionnaireValidationContract(combineClinicalPartials([checked, empty()]), "Anamnesebogen")).toThrow(/noch nicht bereitgestellt/);
  });
  it("keeps questionnaire final rendering deterministic even when the model emitted only open questions", () => {
    const partial = empty(); partial.openQuestions = [{ text: "Unklare Formularauswahl", beleg: { zitat: "[_] Auswahl" } }];
    const checked = attachClinicalSourceEvidence(partial, "Anamnesebogen\n[_] Auswahl", "Quelle", "1/1");
    expect(checked.openQuestions[0].sourceAssertionStatus).toBe("unconfirmed_form");
    expect(checked.openQuestions[0].unconfirmedSourceStatement.text).toBe("Unklare Formularauswahl");
    expect(requiresVerifiedFormReport([checked])).toBe(true);
    expect(requiresVerifiedFormReport([attachClinicalSourceEvidence(empty(), "Anamnesebogen", "Quelle", "1/1")])).toBe(true);
    expect(requiresVerifiedFormReport([combineClinicalPartials([checked])])).toBe(true);
    expect(requiresVerifiedFormReport([attachClinicalSourceEvidence(empty(), "Arztbericht", "Quelle", "1/1")])).toBe(false);
  });
  it("distinguishes an explicit empty category from a silently missing category", () => {
    const complete = empty(); expect(() => assertCompletePartialCollections(complete)).not.toThrow();
    delete complete.medicationsTherapies;
    expect(() => assertCompletePartialCollections(complete)).toThrow(/fehlende Pflichtlisten/);
  });
  it("matches quotations against actual source pages and preserves unverified statements for review", () => {
    const partial = empty();
    partial.diagnoses = [
      { diagnose: "Dokumentierte Erkrankung", status: "gesichert", beleg: { zitat: "Bekannte Erkrankung dokumentiert", seite: 1 } },
      { diagnose: "Unbelegte Behauptung", status: "gesichert", beleg: { zitat: "Steht nicht im Text" } },
    ];
    const before = JSON.stringify(partial);
    const result = attachClinicalSourceEvidence(partial, "=== Dokument-abcdef123456 ===\n--- Seite 1 ---\nAnamnese\n--- Seite 2 ---\nBekannte Erkrankung dokumentiert", "Dokument A", "1/1");
    expect(result.diagnoses[0].beleg.seite).toBe("2");
    expect(result.diagnoses[0].beleg.pruefstatus).toBe("quellenzitat_bestaetigt");
    expect(result.diagnoses[1].beleg.pruefstatus).toBe("quellenzitat_nicht_bestaetigt");
    expect(result.source_coverage_v1.unverifiedQuotes).toBe(1);
    expect(buildAnamnesisIntake([result]).hypotheses[0].diagnose).toBe("Unbelegte Behauptung");
    expect(JSON.stringify(partial)).toBe(before);
  });
  it("retains page context and complete boundary phrases when splitting a long scan", () => {
    const phrase = "MAGNESIUM 200 mg abends seit zwei Wochen";
    const text = `=== Dokument-abcdef123456 ===\nErstellt am: 2026-09-14\n--- Seite 1 ---\n${"Angabe ".repeat(110)}${phrase} ${"weitere Angabe ".repeat(150)}\n--- Seite 2 ---\nKeine Übelkeit`;
    const chunks = splitPageAwareClinicalText("Dokument A", text, 512);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every(chunk => chunk.text.length <= 512)).toBe(true);
    expect(chunks.some(chunk => chunk.text.includes(phrase))).toBe(true);
    expect(chunks.every(chunk => /--- Seite [12] ---/.test(chunk.text))).toBe(true);
    expect(chunks.some(chunk => chunk.text.includes("Keine Übelkeit"))).toBe(true);
  });
  it("does not promote a plainly negative quotation to a positive symptom", () => {
    const partial = empty();
    partial.anamnese.currentProblems = [{ text: "Übelkeit", polarity: "affirmed", beleg: { zitat: "Keine Übelkeit" } }];
    const result = buildAnamnesisIntake([attachClinicalSourceEvidence(partial, "--- Seite 1 ---\nKeine Übelkeit", "Dokument A", "1/1")]);
    expect(result.symptoms).toHaveLength(0);
    expect(result.negativeOrUncertainFindings[0].polarity).toBe("negated");
  });
  it("merges overlapping copies once while retaining every source part", () => {
    const first = empty(); const second = empty();
    const medication = { name: "TEST-ALPHA", kategorie: "konventionell", dosis: "5 mg", status: "laufend", beleg: { sourceId: "doc-a", quelle: "Dokument A – Teil 1", seite: "2", teil: "1/2", zitat: "TEST-ALPHA 5 mg" } };
    first.medicationsTherapies = [medication];
    second.medicationsTherapies = [{ ...medication, beleg: { ...medication.beleg, quelle: "Dokument A – Teil 2", teil: "2/2" } }];
    const combined = combineClinicalPartials([first, second]);
    expect(combined.medicationsTherapies).toHaveLength(1);
    expect(combined.medicationsTherapies[0].belege).toHaveLength(2);
    expect(clinicalEvidenceText(combined.medicationsTherapies[0])).toContain("Teil 1/2");
    expect(clinicalEvidenceText(combined.medicationsTherapies[0])).toContain("Teil 2/2");
    const old = buildAnamnesisIntake([first]); const next = buildAnamnesisIntake([first, second]);
    expect(next.medications).toHaveLength(1);
    const text = mergeIntakeText(formatIntakeFact(old.medications[0]), next.medications.map(formatIntakeFact));
    expect(text.split("\n").filter(line => line.startsWith("TEST-ALPHA ·"))).toHaveLength(1);
    expect(text).toContain("Teil 2/2");
  });
  it("cannot acquire verified status through an untrusted additional citation list", () => {
    const partial = empty();
    partial.medicationsTherapies = [{ name: "TEST-ALPHA", kategorie: "konventionell", status: "laufend", belege: [{ quelle: "erfunden", zitat: "erfunden", pruefstatus: "quellenzitat_bestaetigt" }] }];
    const checked = attachClinicalSourceEvidence(partial, "--- Seite 1 ---\nKein passender Nachweis", "Dokument A", "1/1");
    expect(buildAnamnesisIntake([checked]).medications).toHaveLength(0);
    expect(checked.medicationsTherapies[0].ungepruefteZusatzbelege).toHaveLength(1);
  });
  it("uses the checked quotation and page rather than conflicting unverified outer metadata", () => {
    const partial = empty();
    partial.anamnese.currentProblems = [{ text: "Kopfschmerzen", quelle: "falsch", seite: 99, zitat: "falsch", beleg: { zitat: "Kopfschmerzen" } }];
    const intake = buildAnamnesisIntake([attachClinicalSourceEvidence(partial, "--- Seite 2 ---\nKopfschmerzen", "Dokument A", "1/1")]);
    expect(intake.symptoms[0]).toMatchObject({ quelle: "Dokument A", seite: "2", zitat: "Kopfschmerzen", sourceQuoteVerified: true });
  });
  it("retains generated OCR quality page headers through splitting and citation attribution", () => {
    const marker = "--- Seite 24 | lokale OCR-Sicherheit 92 % ---";
    const chunks = splitPageAwareClinicalText("Anamnese", `${marker}\n${"Text ".repeat(200)}\nEindeutiger Wert`, 512);
    expect(chunks.every(chunk => chunk.text.startsWith(marker))).toBe(true);
    expect(chunks.every(chunk => chunk.text.length <= 512)).toBe(true);
    const partial = empty(); partial.findings = [{ text: "Wert", beleg: { zitat: "Eindeutiger Wert" } }];
    const checked = attachClinicalSourceEvidence(partial, `${marker}\nEindeutiger Wert`, "Anamnese", "1/1");
    expect(checked.findings[0].beleg.seite).toBe("24");
  });
  it("keeps unreviewed template labels as open source statements, not patient diagnoses", () => {
    const partial = empty();
    partial.diagnoses = [{ diagnose: "Nicht ausgefüllte Beispielerkrankung", status: "gesichert", beleg: { zitat: "Nicht ausgefüllte Beispielerkrankung" } }];
    const original = JSON.stringify(partial);
    const checked = attachClinicalSourceEvidence(partial, "--- Seite 16 | lokale OCR-Sicherheit 90 % ---\nManuell pruefen (keine sichere Frage-Antwort-Zuordnung, Seite 16): Nicht ausgefüllte Beispielerkrankung", "Anamnese", "1/1");
    expect(checked.diagnoses).toHaveLength(0);
    expect(checked.openQuestions).toHaveLength(1);
    expect(checked.openQuestions[0].unconfirmedSourceStatement.diagnose).toBe("Nicht ausgefüllte Beispielerkrankung");
    expect(checked.openQuestions[0].beleg).toMatchObject({ seite: "16", quoteMatched: true, pruefstatus: "formularstelle_unbestaetigt" });
    expect(buildAnamnesisIntake([checked]).diagnoses).toHaveLength(0);
    expect(buildAnamnesisIntake([checked]).hypotheses).toHaveLength(0);
    expect(JSON.stringify(partial)).toBe(original);
  });
  it("does not infer IAA ratings or negatives from empty or ambiguous OCR selection glyphs", () => {
    for (const quote of ["8.3.4 Fettige Haut? oooooo", "10.3 Muskelschmerzen? OooOogooo", "14.1 Ziehende Nervenschmerzen? aaa", "5.11 Nierenprobleme? N", "Appetit [] wenig [_] mittel [] viel"]) {
      const partial = empty(); partial.anamnese.reviewOfSystems = [{ befund: "Erfundene Auswahl 6/6", beleg: { zitat: quote } }];
      const checked = attachClinicalSourceEvidence(partial, `=== Lokale Anamnese-Auswertung zur manuellen Pruefung ===\n${quote}`, "Anamnese", "1/1");
      expect(checked.anamnese.reviewOfSystems).toHaveLength(0);
      expect(checked.openQuestions[0].unconfirmedSourceStatement.befund).toBe("Erfundene Auswahl 6/6");
    }
  });
  it("keeps explicit native answers eligible while rejecting an isolated printed field label", () => {
    const source = "--- Seite 36 | digitale Textebene ---\nEinleitung ohne Antworten\nFrage/Feld: Kinderzahl (elektronisches Formularfeld)\nErkannte Antwort: 2";
    const partial = empty();
    partial.anamnese.socialStatus = [{ text: "2 Kinder", beleg: { zitat: "Frage/Feld: Kinderzahl (elektronisches Formularfeld) Erkannte Antwort: 2" } }];
    partial.findings = [{ text: "Nur die Feldbezeichnung", beleg: { zitat: "Kinderzahl" } }];
    const checked = attachClinicalSourceEvidence(partial, source, "Anamnese", "1/1");
    expect(checked.anamnese.socialStatus[0].beleg.pruefstatus).toBe("quellenzitat_bestaetigt");
    expect(checked.findings).toHaveLength(0);
    expect(checked.openQuestions).toHaveLength(1);
  });
  it("does not trust a quote that omits the ambiguous checkbox glyphs from its source line", () => {
    const partial = empty(); partial.anamnese.habits = [{ text: "Mischkost", beleg: { zitat: "Mischkost" } }];
    const checked = attachClinicalSourceEvidence(partial, "Frage/Feld: Ernährung\nErkannte Antwort: [_] Mischkost [] Vegan", "Anamnese", "1/1");
    expect(checked.anamnese.habits).toHaveLength(0);
    expect(checked.openQuestions[0].beleg.zitat).toBe("Mischkost");
  });
  it("preserves explicitly documented native IAA rating one instead of treating it as a default", () => {
    const quote = "IAA 1.1: Verstopfung? Bewertung: 1/6";
    const partial = empty(); partial.anamnese.currentProblems = [{ text: "Verstopfung, Bewertung 1/6", beleg: { zitat: quote } }];
    const checked = attachClinicalSourceEvidence(partial, `[IAA_FORMULAR:1.1;SEITE:37;MARKIERT:1]\n${quote}\n[/IAA_FORMULAR]`, "Anamnese", "1/1");
    expect(checked.anamnese.currentProblems).toHaveLength(0);
    expect(checked.findings).toEqual(expect.arrayContaining([expect.objectContaining({
      sourceKind: "canonical_iaa_answer", iaaQuestionId: "1.1", iaaQuestion: "Verstopfung?", iaaRating: 1,
    })]));
    expect(checked.openQuestions[0].unconfirmedSourceStatement).toMatchObject({ text: "Verstopfung, Bewertung 1/6" });
  });
  it("retains a medication candidate and dose for review without asserting current intake", () => {
    const partial = empty();
    partial.medicationsTherapies = [{ name: "TEST-ALPHA", dosis: "5 mg", kategorie: "konventionell", status: "laufend", beleg: { zitat: "TEST-ALPHA 5 mg" } }];
    const checked = attachClinicalSourceEvidence(partial, "Manuell pruefen (keine sichere Frage-Antwort-Zuordnung): TEST-ALPHA 5 mg", "Anamnese", "1/1");
    const intake = buildAnamnesisIntake([checked]);
    expect(intake.medications).toHaveLength(0);
    expect(intake.uncertainMedications[0]).toMatchObject({ name: "TEST-ALPHA", dosis: "5 mg", polarity: "uncertain", sourceQuoteVerified: false });
  });
  it("accepts explicit marks only in a complete single-valued native IAA block", () => {
    const partial = empty(); partial.anamnese.currentProblems = [{ text: "Bewertung 6/6", beleg: { zitat: "[X] Bewertung: 6/6" } }];
    const native = "[IAA_FORMULAR:1.1;SEITE:37;MARKIERT:6]\n[X] Bewertung: 6/6\n[/IAA_FORMULAR]";
    expect(attachClinicalSourceEvidence(partial, native, "Anamnese", "1/1").anamnese.currentProblems).toHaveLength(1);
    expect(attachClinicalSourceEvidence(partial, "Anamnesebogen\n[X] Bewertung: 6/6", "Anamnese", "1/1").anamnese.currentProblems).toHaveLength(0);
    expect(attachClinicalSourceEvidence(partial, native.replace("MARKIERT:6", "MARKIERT:1,6"), "Anamnese", "1/1").anamnese.currentProblems).toHaveLength(0);
    expect(attachClinicalSourceEvidence(partial, native.replace("[/IAA_FORMULAR]", ""), "Anamnese", "1/1").anamnese.currentProblems).toHaveLength(0);
  });
  it("does not choose a clean duplicate when the same quotation also denotes an ambiguous option", () => {
    const partial = empty(); partial.anamnese.habits = [{ text: "Mischkost", beleg: { zitat: "Mischkost" } }];
    const source = "Anamnesebogen\nDokumentierte Ernährung: Mischkost\nFrage/Feld: Ernährung\nErkannte Antwort: [_] Mischkost [] Vegan";
    expect(attachClinicalSourceEvidence(partial, source, "Anamnese", "1/1").anamnese.habits).toHaveLength(0);
  });
  it("does not trust a rating or question that contradicts the native selected value", () => {
    const partial = empty(); partial.anamnese.currentProblems = [{ text: "Bewertung: 1/6", beleg: { zitat: "Bewertung: 1/6" } }];
    const source = "[IAA_FORMULAR:1.1;SEITE:37;MARKIERT:6]\nBewertung: 1/6\n[/IAA_FORMULAR]";
    expect(attachClinicalSourceEvidence(partial, source, "Anamnese", "1/1").anamnese.currentProblems).toHaveLength(0);
    const selected = source.replace("Bewertung: 1/6", "[X] Bewertung: 6/6");
    partial.anamnese.currentProblems[0].beleg.zitat = "[X] Bewertung: 6/6";
    expect(attachClinicalSourceEvidence(partial, selected, "Anamnese", "1/1").anamnese.currentProblems).toHaveLength(0);
    partial.anamnese.currentProblems[0].text = "IAA 2.2: Bewertung: 6/6";
    expect(attachClinicalSourceEvidence(partial, selected, "Anamnese", "1/1").anamnese.currentProblems).toHaveLength(0);
    partial.anamnese.currentProblems[0].text = "Bewertung: 10/6";
    expect(attachClinicalSourceEvidence(partial, selected, "Anamnese", "1/1").anamnese.currentProblems).toHaveLength(0);
    partial.anamnese.currentProblems[0].beleg.zitat = "Bewertung: 0/6";
    expect(attachClinicalSourceEvidence(partial, "Anamnesebogen\nBewertung: 0/6", "Anamnese", "1/1").anamnese.currentProblems).toHaveLength(0);
  });
  it("does not use an unrated native note as the citation for a numeric rating", () => {
    const source = "[IAA_FORMULAR:1.1;SEITE:37;MARKIERT:6]\nBesser durch Bewegung\n[/IAA_FORMULAR]";
    const partial = empty(); partial.anamnese.currentProblems = [{ text: "Bewertung: 6/6", beleg: { zitat: "Besser durch Bewegung" } }];
    expect(attachClinicalSourceEvidence(partial, source, "Anamnese", "1/1").anamnese.currentProblems).toHaveLength(0);
    partial.anamnese.currentProblems[0].text = "Besser durch Bewegung";
    expect(attachClinicalSourceEvidence(partial, source, "Anamnese", "1/1").anamnese.currentProblems).toHaveLength(1);
    partial.anamnese.currentProblems[0].text = "IAA 1.1: Bewertung: 6/6";
    partial.anamnese.currentProblems[0].beleg.zitat = "[IAA_FORMULAR:1.1;SEITE:37;MARKIERT:6]";
    const checked = attachClinicalSourceEvidence(partial, source, "Anamnese", "1/1");
    expect(checked.anamnese.currentProblems).toHaveLength(0);
    expect(checked.findings).toEqual(expect.arrayContaining([expect.objectContaining({
      sourceKind: "canonical_iaa_answer", iaaQuestionId: "1.1", iaaQuestion: "Verstopfung?", iaaRating: 6,
      iaaNote: "Besser durch Bewegung",
    })]));
  });
});
