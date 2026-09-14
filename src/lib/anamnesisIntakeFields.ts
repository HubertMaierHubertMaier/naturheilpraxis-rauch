import { deduplicateClinicalFacts } from "../../supabase/functions/_shared/clinicalSourceEvidence";

export type IntakePolarity = "affirmed" | "negated" | "uncertain" | "not-stated";
export type IntakeFact = {
  text: string; quelle: string; datum: string; seite: string; zitat: string;
  status: string; polarity: IntakePolarity; beleg: Record<string, unknown>;
  sourceQuoteVerified?: boolean;
  belege?: Record<string, unknown>[];
};
export type IntakeDiagnosis = IntakeFact & { diagnose: string; icd10: string };
export type IntakeMedication = IntakeFact & {
  name: string; kategorie: string; dosis: string; haeufigkeit: string; dauer: string;
  einnahme: string; wirkstoff: string; vonWem: string; indikation: string;
  wirkmechanismus: string; nebenwirkungen: string; grundVerordnung: string;
  categoryInferred?: boolean;
};
export type AnamnesisIntake = {
  diagnoses: IntakeDiagnosis[]; hypotheses: IntakeDiagnosis[]; symptoms: IntakeFact[];
  medications: IntakeMedication[]; historicalMedications: IntakeMedication[];
  uncertainMedications: IntakeMedication[]; negativeOrUncertainFindings: IntakeFact[];
  additional: Record<string, IntakeFact[]>; noConventionalMedication: boolean;
};

const text = (value: unknown): string => typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const normalized = (value: unknown) => text(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const distinct = deduplicateClinicalFacts;

function polarity(item: Record<string, unknown>, value: string): IntakePolarity {
  const explicit = normalized(item.polarity || item.assertionState || item.aussagestatus);
  if (/^(negated|verneint|negiert)$/.test(explicit)) return "negated";
  if (/^(uncertain|unsicher|unklar|verdacht)$/.test(explicit)) return "uncertain";
  if (/^(not-stated|nicht angegeben|unbeantwortet)$/.test(explicit)) return "not-stated";
  const quote = normalized(record(item.beleg).zitat || item.zitat).replace(/[.!]$/, "");
  if (quote.replace(/^(?:keine?|ohne)\s+/, "") === normalized(value) && /^(?:keine?|ohne)\s+/.test(quote)) return "negated";
  if (/^(?:keine?\b|verneint\b|nein\b|ohne\s)/i.test(value)) return "negated";
  if (/\b(?:verdacht|fraglich|unleserlich|nicht best[aä]tigt|nicht gesichert|eventuell|m[oö]glicherweise)\b/i.test(`${value} ${text(item.status)}`)) return "uncertain";
  return "affirmed";
}

function fact(raw: unknown, fallback = ""): IntakeFact {
  const item = record(raw);
  const beleg = { ...record(item.beleg) };
  const evidenceChecked = typeof beleg.pruefstatus === "string";
  const value = typeof raw === "string" ? raw.trim() : text(item.text || item.befund || item.diagnose || item.name || fallback);
  return {
    text: value, quelle: text(evidenceChecked ? beleg.quelle : item.quelle || beleg.quelle), datum: text(item.datum || beleg.datum),
    seite: text(evidenceChecked ? beleg.seite : item.seite || beleg.seite || beleg.page), zitat: text(evidenceChecked ? beleg.zitat : item.zitat || beleg.zitat),
    status: text(item.status), polarity: polarity(item, value), beleg,
    sourceQuoteVerified: beleg.pruefstatus ? beleg.pruefstatus === "quellenzitat_bestaetigt" : undefined,
    ...(Array.isArray(item.belege) ? { belege: item.belege.map(value => ({ ...record(value) })) } : {}),
  };
}

const categories = new Set(["konventionell", "homoeopathie", "pflanzenheilkunde", "vitamine", "mineralstoffe", "spurenelemente", "unklar"]);
function medication(raw: unknown): IntakeMedication {
  const item = record(raw);
  const base = fact(raw);
  const declared = normalized(item.kategorie || item.category).replace("homoopathie", "homoeopathie");
  let kategorie = categories.has(declared) ? declared : "unklar";
  let categoryInferred = false;
  if (!declared) {
    const name = normalized(item.name);
    if (/\bvitamin\s*[a-z0-9]/i.test(name)) kategorie = "vitamine";
    else if (/\b(?:zink|selen|jod|kupfer|chrom|mangan|molybdan)\b/.test(name)) kategorie = "spurenelemente";
    else if (/\b(?:magnesium|calcium|kalzium|kalium|natrium)\b/.test(name)) kategorie = "mineralstoffe";
    categoryInferred = kategorie !== "unklar";
  }
  return {
    ...base, name: text(item.name), kategorie, categoryInferred,
    dosis: text(item.dosis), haeufigkeit: text(item.haeufigkeit || item.frequency),
    dauer: text(item.dauer || item.duration), einnahme: text(item.einnahme), wirkstoff: text(item.wirkstoff),
    vonWem: text(item.vonWem), indikation: text(item.indikation),
    wirkmechanismus: text(item.wirkmechanismus), nebenwirkungen: text(item.nebenwirkungen), grundVerordnung: text(item.grundVerordnung),
  };
}

export function buildAnamnesisIntake(partials: unknown[]): AnamnesisIntake {
  const output: AnamnesisIntake = { diagnoses: [], hypotheses: [], symptoms: [], medications: [], historicalMedications: [], uncertainMedications: [], negativeOrUncertainFindings: [], additional: {}, noConventionalMedication: false };
  for (const partial of partials) {
    const source = record(partial);
    const anamnesis = record(source.anamnese);
    for (const raw of list(source.diagnoses)) {
      const item = record(raw); const base = fact(raw);
      if (!base.text) continue;
      const diagnosis: IntakeDiagnosis = { ...base, diagnose: text(item.diagnose) || base.text, icd10: text(item.icd10) };
      const established = /^(gesichert|anamnestisch dokumentiert|z\.?\s*n\.?)$/.test(normalized(base.status));
      if (base.polarity === "negated" || base.polarity === "not-stated") output.negativeOrUncertainFindings.push(diagnosis);
      else if (established && base.polarity === "affirmed" && base.quelle && base.zitat && base.sourceQuoteVerified !== false) output.diagnoses.push(diagnosis);
      else output.hypotheses.push(diagnosis);
    }
    for (const raw of [...list(anamnesis.currentProblems), ...list(anamnesis.reviewOfSystems)]) {
      const item = fact(raw); if (!item.text) continue;
      if (item.polarity === "affirmed" && item.quelle && item.zitat && item.sourceQuoteVerified !== false) output.symptoms.push(item);
      else output.negativeOrUncertainFindings.push(item);
    }
    for (const key of ["allergies", "pastHistory", "habits", "familyHistory", "socialStatus", "vaccinationStatus", "physicalExamination", "additionalInvestigations", "recentExaminations", "presentMedication"]) {
      const items = list(anamnesis[key]).map(raw => fact(raw)).filter(item => item.text);
      output.additional[key] = [...(output.additional[key] || []), ...items];
    }
    for (const raw of list(anamnesis.presentMedication)) {
      const item = fact(raw);
      if (item.quelle && item.zitat && item.sourceQuoteVerified !== false && /^(?:keine(?:rlei)?\s+(?:(?:aktuellen?|konventionellen?|klassischen?)\s+)?medikamente?|nein\s*[-–:]\s*keine medikamente)/i.test(item.text)) output.noConventionalMedication = true;
    }
    for (const raw of list(source.medicationsTherapies)) {
      const item = medication(raw); if (!item.name) continue;
      const status = normalized(item.status);
      const procedure = /\b(?:operation|physiotherapie|manualtherapie|bestrahlung|rehabilitation)\b/i.test(item.name);
      if (/^(?:abgesetzt|beendet|fruher|pausiert|historisch)\b/.test(status) && !/laufend|aktuell/.test(status)) output.historicalMedications.push(item);
      else if (!procedure && /^(laufend|aktuell)$/.test(status) && item.polarity === "affirmed" && item.kategorie !== "unklar" && item.quelle && item.zitat && item.sourceQuoteVerified !== false) output.medications.push(item);
      else output.uncertainMedications.push(item);
    }
  }
  for (const key of ["diagnoses", "hypotheses", "symptoms", "medications", "historicalMedications", "uncertainMedications", "negativeOrUncertainFindings"] as const) {
    (output[key] as IntakeFact[]) = distinct(output[key] as IntakeFact[]);
  }
  for (const key of Object.keys(output.additional)) output.additional[key] = distinct(output.additional[key]);
  return output;
}

export function formatIntakeFact(item: IntakeFact | IntakeDiagnosis | IntakeMedication): string {
  const medicine = item as Partial<IntakeMedication>;
  const details = [medicine.dosis, medicine.haeufigkeit, medicine.einnahme, medicine.dauer ? `Dauer: ${medicine.dauer}` : ""].filter(Boolean);
  const diagnosis = item as Partial<IntakeDiagnosis>;
  const content = [diagnosis.icd10 ? `${diagnosis.icd10}: ${item.text}` : item.text, ...details].join(" · ");
  const assertion = { affirmed: "bejaht", negated: "verneint", uncertain: "unsicher", "not-stated": "nicht angegeben" }[item.polarity];
  const evidence = [item.quelle, item.seite ? `Seite ${item.seite}` : "", item.datum, item.status ? `Status: ${item.status}` : "", item.polarity !== "affirmed" ? `Aussage: ${assertion}` : "", item.zitat ? `„${item.zitat}“` : "Belegzitat fehlt – prüfen", item.sourceQuoteVerified === false ? "Zitat nicht im Quelltext bestätigt – prüfen" : ""].filter(Boolean).join(" · ");
  const pharmacology = [medicine.wirkmechanismus ? `Wirkung: ${medicine.wirkmechanismus}` : "", medicine.nebenwirkungen ? `Nebenwirkungen: ${medicine.nebenwirkungen}` : ""].filter(Boolean).join(" · ");
  const additionalEvidence = item.belege && item.belege.length > 1 ? `\n  Weitere Belege: ${item.belege.map(ref => [text(ref.quelle), text(ref.teil) ? `Teil ${text(ref.teil)}` : "", text(ref.seite) ? `Seite ${text(ref.seite)}` : "", text(ref.zitat) ? `„${text(ref.zitat)}“` : ""].filter(Boolean).join(" · ")).join(" | ")}` : "";
  return `${content}\n  Quelle der Angabe: ${evidence}${additionalEvidence}${pharmacology ? `\n  Gesonderte pharmakologische Einordnung – Fachquelle prüfen: ${pharmacology}` : ""}`;
}

export function mergeIntakeText(existing: string, incoming: string[]): string {
  let result = existing;
  for (const value of incoming) {
    const item = value.trim();
    if (!item || result.includes(item)) continue;
    const lines = item.split(/\r?\n/);
    if (lines.length > 1 && result.split(/\r?\n/).some(line => line.trim() === lines[0].trim())) {
      const additions = lines.slice(1).filter(line => line.trim() && !result.includes(line.trim()));
      if (additions.length) result += `\n${additions.join("\n")}`;
    } else result += `${result ? "\n\n" : ""}${item}`;
  }
  return result;
}

export function mergeAnamnesisIntakes(previous: unknown, incoming: AnamnesisIntake): AnamnesisIntake {
  const old = record(previous);
  const merged = { ...incoming };
  for (const key of ["diagnoses", "hypotheses", "symptoms", "medications", "historicalMedications", "uncertainMedications", "negativeOrUncertainFindings"] as const) {
    (merged[key] as IntakeFact[]) = distinct([...list(old[key]).filter(item => typeof record(item).text === "string"), ...incoming[key]]) as IntakeFact[];
  }
  const additional = record(old.additional);
  merged.additional = Object.fromEntries([...new Set([...Object.keys(additional), ...Object.keys(incoming.additional)])].map(key => [key, distinct([...list(additional[key]).filter(item => typeof record(item).text === "string"), ...(incoming.additional[key] || [])])])) as Record<string, IntakeFact[]>;
  merged.noConventionalMedication = old.noConventionalMedication === true || incoming.noConventionalMedication;
  return merged;
}
