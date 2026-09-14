// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PARTIAL_ANALYSIS_ARRAY_KEYS, PARTIAL_ANAMNESIS_ARRAY_KEYS, assertCompletePartialCollections, attachClinicalSourceEvidence, splitPageAwareClinicalText, combineClinicalPartials, clinicalEvidenceText } from "../../supabase/functions/_shared/clinicalSourceEvidence";
import { buildAnamnesisIntake, formatIntakeFact, mergeIntakeText } from "../lib/anamnesisIntakeFields";

const empty = (): Record<string, any> => ({ ...Object.fromEntries(PARTIAL_ANALYSIS_ARRAY_KEYS.map(key => [key, []])), anamnese: Object.fromEntries(PARTIAL_ANAMNESIS_ARRAY_KEYS.map(key => [key, []])) });
describe("clinical source evidence", () => {
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
});
