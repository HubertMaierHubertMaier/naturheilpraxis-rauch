import { PARTIAL_ANALYSIS_ARRAY_KEYS, PARTIAL_ANAMNESIS_ARRAY_KEYS } from "./clinicalSourceEvidence.ts";

const strings = (...keys: string[]) => Object.fromEntries(keys.map(key => [key, { type: "string" }]));
const evidence = {
  type: "object",
  properties: strings("quelle", "teil", "seite", "zitat"),
  required: ["quelle", "teil", "zitat"],
};
const fact = (keys: string[]) => ({
  type: "object", properties: { ...strings(...keys), beleg: evidence },
});
const textFact = fact(["text", "datum", "polarity"]);
const array = (items: unknown) => ({ type: "array", items });

/** Provider schema and application validation use the same mandatory collection keys. */
export const CLINICAL_PARTIAL_RESPONSE_SCHEMA = {
  type: "object",
  required: [...PARTIAL_ANALYSIS_ARRAY_KEYS, "anamnese"],
  properties: {
    documents: array(fact(["datum", "quelle", "untersuchung", "hauptbefund", "auffaellig"])),
    diagnoses: array(fact(["icd10", "diagnose", "quelle", "datum", "status", "polarity"])),
    medicationsTherapies: array(fact(["name", "sourceRole", "kategorie", "wirkstoff", "dosis", "deviceIndex", "haeufigkeit", "einnahme", "dauer", "vonWem", "datum", "indikation", "wirkmechanismus", "nebenwirkungen", "grundVerordnung", "status", "polarity"])),
    labValues: array(fact(["datum", "parameter", "wert", "einheit", "measurementMethod", "referenz", "bewertung", "bedeutung", "moeglicheSymptome", "quelle"])),
    findings: array(fact(["text", "findingType", "datum", "polarity"])),
    terms: array({ type: "object", properties: strings("term", "plain"), required: ["term", "plain"] }),
    redFlags: array(textFact),
    systemsPatterns: array(textFact),
    openQuestions: array({ type: "string" }),
    missingReports: array({ type: "string" }),
    anamnese: {
      type: "object", required: PARTIAL_ANAMNESIS_ARRAY_KEYS,
      properties: Object.fromEntries(PARTIAL_ANAMNESIS_ARRAY_KEYS.map(key => [key,
        array(key === "reviewOfSystems" ? fact(["system", "befund", "datum", "polarity"]) : textFact),
      ])),
    },
  },
};

export const clinicalPartialResponseFormat = () => ({
  type: "json_schema",
  json_schema: { name: "clinical_partial_analysis", schema: CLINICAL_PARTIAL_RESPONSE_SCHEMA },
});

export function missingClinicalPartialCollections(value: unknown): string[] {
  const root = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const anamnesis = root.anamnese && typeof root.anamnese === "object" && !Array.isArray(root.anamnese)
    ? root.anamnese as Record<string, unknown> : {};
  return [
    ...PARTIAL_ANALYSIS_ARRAY_KEYS.filter(key => !Array.isArray(root[key])),
    ...PARTIAL_ANAMNESIS_ARRAY_KEYS.filter(key => !Array.isArray(anamnesis[key])).map(key => `anamnese.${key}`),
  ];
}
