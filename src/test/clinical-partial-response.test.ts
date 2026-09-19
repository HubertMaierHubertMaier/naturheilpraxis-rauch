// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CLINICAL_PARTIAL_RESPONSE_SCHEMA, clinicalPartialResponseFormat, missingClinicalPartialCollections } from "../../supabase/functions/_shared/clinicalPartialResponse";
import { PARTIAL_ANALYSIS_ARRAY_KEYS, PARTIAL_ANAMNESIS_ARRAY_KEYS, assertCompletePartialCollections } from "../../supabase/functions/_shared/clinicalSourceEvidence";

const complete = () => ({
  ...Object.fromEntries(PARTIAL_ANALYSIS_ARRAY_KEYS.map(key => [key, []])),
  anamnese: Object.fromEntries(PARTIAL_ANAMNESIS_ARRAY_KEYS.map(key => [key, []])),
});

describe("clinical partial response contract", () => {
  it("keeps source extraction separate from later pharmacological explanation and device indices separate from doses", () => {
    const source = readFileSync(new URL("../../supabase/functions/analyze-documents/index.ts", import.meta.url), "utf8");
    const prompt = source.slice(source.indexOf("function buildChunkPrompt("), source.indexOf("function buildFinalPrompt("));
    expect(prompt).toContain("kompakte, quellengetreue Extraktion");
    expect(prompt).toContain("GERÄTEINDEX IST KEINE DOSIS");
    expect(prompt).not.toContain("Für JEDES Medikament zusätzlich");
    expect(prompt).not.toContain('klar als "Pharmakologie" markiert');
    expect(CLINICAL_PARTIAL_RESPONSE_SCHEMA.properties.medicationsTherapies.items).toHaveProperty("properties.deviceIndex");
  });
  it("requires the exact same collections at the provider and application boundary", () => {
    expect(CLINICAL_PARTIAL_RESPONSE_SCHEMA.required).toEqual([...PARTIAL_ANALYSIS_ARRAY_KEYS, "anamnese"]);
    expect(CLINICAL_PARTIAL_RESPONSE_SCHEMA.properties.anamnese.required).toEqual(PARTIAL_ANAMNESIS_ARRAY_KEYS);
    for (const key of PARTIAL_ANALYSIS_ARRAY_KEYS) {
      expect((CLINICAL_PARTIAL_RESPONSE_SCHEMA.properties as Record<string, { type: string }>)[key].type).toBe("array");
    }
    expect(clinicalPartialResponseFormat().json_schema.schema).toBe(CLINICAL_PARTIAL_RESPONSE_SCHEMA);
    expect(clinicalPartialResponseFormat().type).toBe("json_schema");
  });
  it("accepts explicitly supplied empty collections without inventing clinical content", () => {
    const partial = complete();
    expect(missingClinicalPartialCollections(partial)).toEqual([]);
    expect(() => assertCompletePartialCollections(partial)).not.toThrow();
  });
  it("reports missing paths without adding fabricated empty lists", () => {
    const partial: Record<string, any> = complete();
    delete partial.findings;
    delete partial.anamnese.allergies;
    const before = JSON.stringify(partial);
    expect(missingClinicalPartialCollections(partial)).toEqual(["findings", "anamnese.allergies"]);
    expect(JSON.stringify(partial)).toBe(before);
    expect(() => assertCompletePartialCollections(partial)).toThrow(/fehlende Pflichtlisten/);
  });
  it("rejects anamnese as an array even if every top-level list exists", () => {
    const partial = { ...complete(), anamnese: [] };
    expect(missingClinicalPartialCollections(partial)).toHaveLength(PARTIAL_ANAMNESIS_ARRAY_KEYS.length);
    expect(() => assertCompletePartialCollections(partial)).toThrow();
  });
  it("rejects wrong collection types and reports only structural names", () => {
    const partial = { ...complete(), documents: null, diagnoses: {}, terms: "nicht vorhanden" };
    expect(missingClinicalPartialCollections(partial)).toEqual(["documents", "diagnoses", "terms"]);
  });
});
