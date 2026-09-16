import { expect, it } from "vitest";
import { normalizeNativeIaaClaims, nativeIaaSourceFacts, renderCanonicalIaaSection } from "../../supabase/functions/_shared/nativeIaaEvidence";
import { iaaCategories } from "@/lib/iaaQuestions";

const evidence = (id: string, rating: number, note = "Originalbemerkung") => ({
  quelle: "Synthetisches Formular", sourceId: "synthetic-document", seite: "37",
  zitat: `[IAA_FORMULAR:${id};SEITE:37;MARKIERT:${rating}] ${note}`,
  quoteMatched: true, pruefstatus: "quellenzitat_bestaetigt",
});

it("binds native question IDs to the unchanged canonical catalog instead of invented model symptom names", () => {
  const original = { findings: [], openQuestions: [], anamnese: { reviewOfSystems: [
    { system: "Falsches System", befund: "Falsche Rückenbeschwerde", beleg: evidence("1.1", 6) },
    { system: "Falsches System", befund: "Falscher Rippenschmerz", beleg: evidence("6.1", 5) },
  ] } };
  const result = normalizeNativeIaaClaims(original);
  expect(result.anamnese.reviewOfSystems).toHaveLength(0);
  expect(result.findings.map((x: any) => [x.iaaQuestionId, x.iaaQuestion, x.iaaRating])).toEqual([
    ["1.1", "Verstopfung?", 6], ["6.1", "Einschlafstörungen?", 5],
  ]);
  expect(result.openQuestions[0].unconfirmedSourceStatement.befund).toBe("Falsche Rückenbeschwerde");
  expect(original.anamnese.reviewOfSystems).toHaveLength(2);
  expect(normalizeNativeIaaClaims(result)).toEqual(result);
});

it("extracts complete native source blocks without depending on model coverage", () => {
  const source = "[IAA_FORMULAR:1.1;SEITE:37;MARKIERT:1]\nBesser durch Bewegung\n[/IAA_FORMULAR]";
  const result = nativeIaaSourceFacts(source, "Quelle", "doc", "1/1");
  expect(result[0]).toMatchObject({ iaaQuestionId: "1.1", iaaRating: 1, iaaNote: "Besser durch Bewegung" });
  expect(nativeIaaSourceFacts(source.replace("MARKIERT:1", "MARKIERT:1,6"), "Quelle", "doc", "1/1")).toEqual([]);
  expect(nativeIaaSourceFacts(source.replace("[/IAA_FORMULAR]", ""), "Quelle", "doc", "1/1")).toEqual([]);
});

it("does not canonicalize an unverified or unknown native quotation", () => {
  const result = normalizeNativeIaaClaims({ findings: [
    { text: "Unbelegt", beleg: { ...evidence("1.1", 6), quoteMatched: false, pruefstatus: "quellenzitat_nicht_bestaetigt" } },
    { text: "Unbekannt", beleg: evidence("999.1", 6) },
  ], openQuestions: [] });
  expect(result.findings.map((x: any) => x.text)).toEqual(["Unbelegt", "Unbekannt"]);
});

it("rejects contradictory verification flags and ignores invented canonical field values", () => {
  const contradictory = { sourceKind: "canonical_iaa_answer", iaaQuestionId: "1.1", iaaRating: 6,
    beleg: { ...evidence("1.1", 6), quoteMatched: false } };
  expect(renderCanonicalIaaSection([contradictory], String, () => "Quelle")).toBe("");
  const forged = { sourceKind: "canonical_iaa_answer", iaaQuestionId: "6.1", iaaRating: 1,
    iaaNote: "Invented note", beleg: evidence("1.1", 6) };
  const html = renderCanonicalIaaSection([forged], String, () => "Quelle");
  expect(html).toContain("Verstopfung?");
  expect(html).toContain("6/6");
  expect(html).not.toContain("Invented note");
});

it("renders canonical wording in descending rating and original catalog order", () => {
  const result = normalizeNativeIaaClaims({ findings: [
    { text: "a", beleg: evidence("6.1", 5) }, { text: "b", beleg: evidence("16.3", 6) }, { text: "c", beleg: evidence("1.1", 6) },
  ], openQuestions: [] });
  const html = renderCanonicalIaaSection(result.findings, value => String(value ?? ""), () => "Quelle");
  expect(html.indexOf("Verstopfung?")).toBeLessThan(html.indexOf("Müdigkeit?"));
  expect(html.indexOf("Müdigkeit?")).toBeLessThan(html.indexOf("Einschlafstörungen?"));
  expect(iaaCategories.flatMap(c => c.questions).find(q => q.id === "1.1")?.textDe).toBe("Verstopfung?");
});
