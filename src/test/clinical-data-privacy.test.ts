import { describe, expect, it } from "vitest";
import { clinicalDataIdentifierCategories } from "../../supabase/functions/_shared/clinicalDataPrivacy";
import { deidentifyClinicalData, directIdentifierCategories } from "../../supabase/functions/_shared/clinicalDeidentification";

describe("privacy checks keep clinical data structure and line boundaries", () => {
  const measurements = "Metatron\nAal 0,350\nHering 0,245\nLachs 0,128";
  it("reproduces the JSON-only address false positive and checks the original field instead", () => {
    expect(directIdentifierCategories(measurements)).toEqual([]);
    expect(directIdentifierCategories(JSON.stringify({ metatronHeel: measurements }))).toContain("Anschrift");
    expect(clinicalDataIdentifierCategories({ metatronHeel: measurements })).toEqual([]);
    expect(clinicalDataIdentifierCategories(JSON.stringify({ metatronHeel: measurements }))).toEqual([]);
  });
  it("preserves nested arrays and encoded report values without rewriting them", () => {
    const input = { reports: [{ text: measurements }], metadata: JSON.stringify({ text: measurements }) };
    const before = JSON.stringify(input);
    expect(clinicalDataIdentifierCategories(input)).toEqual([]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each(["Teststraße 12", "PLZ: 10115 Berlin", "Telefon: +49 30 12345678", "E-Mail: test@example.invalid"])("still rejects actual identifying text: %s", text => {
    expect(clinicalDataIdentifierCategories({ reports: [{ text }] }).length).toBeGreaterThan(0);
    expect(clinicalDataIdentifierCategories(JSON.stringify({ reports: [{ text }] })).length).toBeGreaterThan(0);
  });
  it("detects an unlabelled personal header inside an encoded clinical field", () => {
    const input = JSON.stringify({ report: "Erika Beispiel 01.01.1970 (56)\nTestbefund" });
    expect(clinicalDataIdentifierCategories(input)).toEqual(expect.arrayContaining(["Name", "Geburtsdatum"]));
  });
  it.each([
    [{ patientName: "Erika Beispiel" }, "Name"],
    [{ birth_date: "01.01.1970" }, "Geburtsdatum"],
    [{ address: "Testgasse" }, "Anschrift"],
    [{ phone: "12345678" }, "Kontaktdaten"],
  ])("checks explicit identity keys even without a label in the value", (input, category) => {
    expect(clinicalDataIdentifierCategories(input)).toContain(category);
    expect(clinicalDataIdentifierCategories(deidentifyClinicalData(input))).toEqual([]);
  });
  it("checks provider-name context without mistaking remedy names for patient names", () => {
    expect(clinicalDataIdentifierCategories({ doctor: { name: "Erika Beispiel" } })).toContain("Name");
    expect(clinicalDataIdentifierCategories({ manualMittel: [{ name: "Magnesium", dosis: "200 mg" }] })).toEqual([]);
  });
  it("does not discard invalid JSON or text after an otherwise valid JSON object", () => {
    expect(clinicalDataIdentifierCategories('{"report":"ok"}\nTelefon: +49 30 12345678')).toContain("Kontaktdaten");
  });
  it("does not treat a redaction-marker prefix as protection for following personal content", () => {
    expect(clinicalDataIdentifierCategories({ patientName: "[Name entfernt] Erika Beispiel" })).toContain("Name");
  });
  it("fails closed for cycles", () => {
    const input: Record<string, unknown> = {};
    input.self = input;
    expect(clinicalDataIdentifierCategories(input)).toContain("Nicht prüfbare Datenstruktur");
  });
});
