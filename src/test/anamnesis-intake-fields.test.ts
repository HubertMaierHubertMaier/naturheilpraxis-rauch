import { describe, expect, it } from "vitest";
import { buildAnamnesisIntake, formatIntakeFact, mergeAnamnesisIntakes, mergeIntakeText } from "../lib/anamnesisIntakeFields";

const beleg = { quelle: "Synthetisches Dokument A", seite: 2, datum: "2026-09-14", zitat: "Wörtliche künstliche Quellenangabe" };
describe("source-linked intake field projection", () => {
  it("separates documented illness, suspicion and explicit negation", () => {
    const result = buildAnamnesisIntake([{ diagnoses: [
      { diagnose: "Bekannte Erkrankung", status: "anamnestisch dokumentiert", datum: "2021", beleg },
      { diagnose: "Unbestätigte Hypothese", status: "Verdacht", beleg },
      { diagnose: "Verneinte Erkrankung", status: "gesichert", polarity: "negated", beleg },
      { diagnose: "Unbelegter Eintrag", status: "gesichert" },
    ] }]);
    expect(result.diagnoses.map(item => item.diagnose)).toEqual(["Bekannte Erkrankung"]);
    expect(result.diagnoses[0].datum).toBe("2021");
    expect(result.hypotheses).toHaveLength(2);
    expect(result.negativeOrUncertainFindings[0].polarity).toBe("negated");
  });
  it("does not turn negative or uncertain symptoms into affirmative fields", () => {
    const result = buildAnamnesisIntake([{ anamnese: { currentProblems: [
      { text: "Kopfschmerzen abends", beleg }, { text: "Keine Übelkeit", beleg },
      { text: "Kribbeln fraglich", beleg }, { text: "Kein gesicherter Quellenbezug" },
    ], allergies: [{ text: "Keine Allergien angegeben", beleg }] } }]);
    expect(result.symptoms.map(item => item.text)).toEqual(["Kopfschmerzen abends"]);
    expect(result.negativeOrUncertainFindings).toHaveLength(3);
    expect(result.additional.allergies[0].text).toBe("Keine Allergien angegeben");
  });
  it("keeps all five current natural categories and separates stopped, proposed and unknown intake", () => {
    const categories = ["homoeopathie", "pflanzenheilkunde", "vitamine", "mineralstoffe", "spurenelemente"];
    const medicationsTherapies = categories.map(kategorie => ({ name: `Test ${kategorie}`, kategorie, status: "laufend", dosis: "5 mg", haeufigkeit: "zweimal täglich", dauer: "seit zwei Wochen", beleg }));
    const result = buildAnamnesisIntake([{ medicationsTherapies: [...medicationsTherapies,
      { name: "TEST-ALT", kategorie: "konventionell", status: "abgesetzt", beleg },
      { name: "TEST-VORSCHLAG", kategorie: "konventionell", status: "vorgeschlagen", beleg },
      { name: "Vitamin D3", kategorie: "unklar", status: "laufend", beleg },
      { name: "Physiotherapie", kategorie: "konventionell", status: "laufend", beleg },
    ] }]);
    expect(result.medications.map(item => item.kategorie)).toEqual(categories);
    expect(result.historicalMedications).toHaveLength(1);
    expect(result.uncertainMedications).toHaveLength(3);
    expect(formatIntakeFact(result.medications[0])).toContain("zweimal täglich");
    expect(formatIntakeFact(result.medications[0])).toContain("Dauer: seit zwei Wochen");
    expect(formatIntakeFact(result.medications[0])).toContain("Seite 2");
  });
  it("retains changed doses and different evidence while preserving existing text verbatim", () => {
    const input = [{ medicationsTherapies: [
      { name: "TEST-ALPHA", kategorie: "konventionell", status: "laufend", dosis: "5 mg", beleg },
      { name: "TEST-ALPHA", kategorie: "konventionell", status: "laufend", dosis: "10 mg", beleg: { ...beleg, seite: 3 } },
    ] }];
    const before = JSON.stringify(input); const result = buildAnamnesisIntake(input);
    expect(result.medications).toHaveLength(2);
    const existing = "  Manuelle Vorangabe unverändert.  ";
    const merged = mergeIntakeText(existing, result.medications.map(formatIntakeFact));
    expect(merged.startsWith(existing)).toBe(true);
    expect(merged).toContain("5 mg"); expect(merged).toContain("10 mg");
    expect(mergeIntakeText(merged, result.medications.map(formatIntakeFact))).toBe(merged);
    expect(mergeAnamnesisIntakes(result, result).medications).toHaveLength(2);
    expect(JSON.stringify(input)).toBe(before);
  });
});
