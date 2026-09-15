import { createQuestionnaireEvidenceValidator } from "./questionnaireEvidence.ts";

export const PARTIAL_ANALYSIS_ARRAY_KEYS = ["documents", "diagnoses", "medicationsTherapies", "labValues", "findings", "terms", "redFlags", "systemsPatterns", "openQuestions", "missingReports"];
export const PARTIAL_ANAMNESIS_ARRAY_KEYS = ["currentProblems", "pastHistory", "allergies", "presentMedication", "habits", "reviewOfSystems", "recentExaminations", "vaccinationStatus", "familyHistory", "socialStatus", "physicalExamination", "additionalInvestigations"];
const object = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
const normalize = (value: unknown) => typeof value === "string" ? value.normalize("NFKC").replace(/\s+/g, " ").trim() : "";
const stableSourceLabel = (value: unknown) => normalize(value).replace(/\s+[–-]\s+(?:Seite\s+\d+|Teil\s+[\d.]+).*$/i, "");

const stableValue = (value: unknown): unknown => Array.isArray(value) ? value.map(stableValue)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]))
  : typeof value === "string" ? normalize(value) : value;

/** Merge repeated overlap facts, preserving every citation and clinically different value. */
export function deduplicateClinicalFacts<T>(items: T[]): T[] {
  const result = new Map<string, T>();
  const citations = (item: Record<string, any>): Record<string, any>[] => {
    const values = [object(item.beleg), ...(Array.isArray(item.belege) ? item.belege.map(object) : [])].filter(value => Object.keys(value).length);
    return [...new Map(values.map(value => [JSON.stringify(stableValue(value)), value])).values()];
  };
  for (const raw of items) {
    const item = object(raw);
    const clinical = { ...item };
    for (const key of ["beleg", "belege", "quelle", "teil", "seite", "zitat", "sourceId", "sourceQuoteVerified"]) delete clinical[key];
    const b = object(item.beleg);
    const scope = [b.sourceId || stableSourceLabel(b.quelle || item.quelle), b.seite || item.seite || "", normalize(b.zitat || item.zitat)];
    const key = JSON.stringify(stableValue(Object.keys(item).length ? [clinical, scope] : raw));
    const previous = result.get(key);
    if (previous === undefined) { result.set(key, structuredClone(raw)); continue; }
    const previousObject = object(previous);
    const refs = citations({ belege: [...citations(previousObject), ...citations(item)] });
    if (!refs.length) continue;
    const primary = refs.find(ref => ref.pruefstatus === "quellenzitat_bestaetigt") || refs[0];
    result.set(key, { ...previousObject, beleg: primary, belege: refs } as T);
  }
  return [...result.values()];
}

export function combineClinicalPartials(partials: Record<string, any>[]): Record<string, any> {
  const result: Record<string, any> = Object.fromEntries(PARTIAL_ANALYSIS_ARRAY_KEYS.map(key => [key, []]));
  result.anamnese = Object.fromEntries(PARTIAL_ANAMNESIS_ARRAY_KEYS.map(key => [key, []]));
  for (const partial of partials) {
    for (const key of PARTIAL_ANALYSIS_ARRAY_KEYS) if (Array.isArray(partial[key])) result[key].push(...partial[key]);
    for (const key of PARTIAL_ANAMNESIS_ARRAY_KEYS) if (Array.isArray(partial.anamnese?.[key])) result.anamnese[key].push(...partial.anamnese[key]);
  }
  for (const key of PARTIAL_ANALYSIS_ARRAY_KEYS) result[key] = deduplicateClinicalFacts(result[key]);
  for (const key of PARTIAL_ANAMNESIS_ARRAY_KEYS) result.anamnese[key] = deduplicateClinicalFacts(result.anamnese[key]);
  result.source_coverage_v1 = {
    parts: partials.map(partial => partial.source_coverage_v1).filter(Boolean),
    answerValidationVersion: partials.length > 0 && partials.every(partial => partial.source_coverage_v1?.answerValidationVersion === 1) ? 1 : 0,
  };
  return result;
}

export function clinicalEvidenceText(value: unknown): string {
  const item = object(value);
  const refs = Array.isArray(item.belege) && item.belege.length ? item.belege : [item.beleg];
  return refs.map((raw: unknown) => {
    const b = object(raw);
    return [b.quelle, b.teil ? `Teil ${b.teil}` : "", b.seite ? `Seite ${b.seite}` : "", b.zitat ? `„${b.zitat}“` : "", b.pruefstatus === "formularstelle_unbestaetigt" ? "Unbestätigte Formular-/OCR-Stelle – keine gesicherte Patientenangabe" : b.pruefstatus === "quellenzitat_nicht_bestaetigt" ? "Zitat nicht automatisch bestätigt – prüfen" : ""].filter(Boolean).join(" · ");
  }).filter(Boolean).join(" | ");
}

export function hasCompletePartialCollections(value: unknown): boolean {
  const source = object(value); const anamnesis = object(source.anamnese);
  return PARTIAL_ANALYSIS_ARRAY_KEYS.every(key => Array.isArray(source[key])) && PARTIAL_ANAMNESIS_ARRAY_KEYS.every(key => Array.isArray(anamnesis[key]));
}

export function assertCompletePartialCollections(value: unknown): void {
  if (!hasCompletePartialCollections(value)) throw new Error("Teilanalysen-JSON hat fehlende Pflichtlisten. Fehlende Kategorien werden nicht als geprüfte Leerlisten ausgegeben.");
}

type SourcePage = { page: number; text: string };
const pageMarkers = (text: string) => [...text.matchAll(/---[ \t]*Seite[ \t]+(\d+)(?:[ \t]*\|[^\r\n]*?)?[ \t]*---/gi)];
function sourcePages(text: string): SourcePage[] {
  const markers = pageMarkers(text);
  return markers.map((match, index) => ({ page: Number(match[1]), text: text.slice((match.index || 0) + match[0].length, markers[index + 1]?.index ?? text.length) }));
}

/** The quotation is verified against the supplied source, not against model-generated prose. */
export function attachClinicalSourceEvidence(value: Record<string, any>, sourceText: string, sourceLabel: string, part: string): Record<string, any> {
  const source = structuredClone(value);
  const pages = sourcePages(sourceText);
  const fullText = normalize(sourceText);
  const isUnconfirmedQuestionnaireEvidence = createQuestionnaireEvidenceValidator(sourceText);
  const sourceId = sourceText.match(/(?:Dokument-|KLINISCHES\s+DOKUMENT\s+)([a-f0-9]{12})/i)?.[1] || stableSourceLabel(sourceLabel);
  let verified = 0; let unverified = 0;
  const unconfirmed: Record<string, any>[] = [];
  const pageCounts = new Map(pages.map(page => [page.page, 0]));
  const annotate = (raw: unknown, group: string) => {
    const item = typeof raw === "string" ? { [group === "diagnoses" ? "diagnose" : group === "medicationsTherapies" ? "name" : "text"]: raw } : { ...object(raw) };
    // The model cannot confer verified provenance through an unvalidated extra list.
    if (Array.isArray(item.belege)) item.ungepruefteZusatzbelege = item.belege;
    delete item.belege;
    const beleg = { ...object(item.beleg) };
    const quote = normalize(beleg.zitat || item.zitat);
    const matches = quote.length > 0 && fullText.includes(quote);
    const unconfirmedForm = isUnconfirmedQuestionnaireEvidence(quote, [item.text, item.befund, item.diagnose, item.name].filter(value => typeof value === "string").join(" "));
    const matchingPages = matches ? [...new Set(pages.filter(page => normalize(page.text).includes(quote)).map(page => page.page))] : [];
    if (matches) verified++; else unverified++;
    for (const page of matchingPages) pageCounts.set(page, (pageCounts.get(page) || 0) + 1);
    const declaredPage = Number(beleg.seite || item.seite);
    const matchedPage = matchingPages.includes(declaredPage) ? String(declaredPage) : matchingPages.join(", ");
    item.beleg = {
      ...beleg, quelle: sourceLabel, sourceId, teil: part,
      seite: matchedPage || "", zitat: typeof beleg.zitat === "string" ? beleg.zitat : typeof item.zitat === "string" ? item.zitat : "",
      pruefstatus: unconfirmedForm ? "formularstelle_unbestaetigt" : matches ? "quellenzitat_bestaetigt" : "quellenzitat_nicht_bestaetigt",
      quoteMatched: matches,
    };
    if (unconfirmedForm) {
      unconfirmed.push({
        text: `Unbestätigte Formular-/OCR-Zuordnung – am Original prüfen: ${String(item.text || item.befund || item.diagnose || item.name || "Angabe ohne eindeutige Antwort")}`,
        sourceAssertionStatus: "unconfirmed_form", polarity: "not-stated", beleg: item.beleg,
        originalCollection: group, unconfirmedSourceStatement: item,
      });
      return null;
    }
    return item;
  };
  for (const key of ["documents", "diagnoses", "medicationsTherapies", "labValues", "findings", "redFlags", "systemsPatterns"]) source[key] = (source[key] || []).map((item: unknown) => annotate(item, key)).filter(Boolean);
  source.anamnese = Object.fromEntries(PARTIAL_ANAMNESIS_ARRAY_KEYS.map(key => [key, (source.anamnese?.[key] || []).map((item: unknown) => annotate(item, key)).filter(Boolean)]));
  source.openQuestions = [...(source.openQuestions || []), ...unconfirmed];
  source.source_coverage_v1 = {
    sourceId, sourceLabel, part, verifiedQuotes: verified, unverifiedQuotes: unverified, unconfirmedFormStatements: unconfirmed.length, answerValidationVersion: 1,
    pages: [...pageCounts].map(([page, matchedFacts]) => ({ page, matchedFacts, status: matchedFacts ? "quoted_facts_present" : "no_verified_fact_quote" })),
    scope: "Quotation matching and page attribution only; not proof that every clinical statement was interpreted correctly.",
  };
  return source;
}

/** Keep original page headers when a long page must be split across model calls. */
export function splitPageAwareClinicalText(label: string, value: string, maxChars = 6000): Array<{ label: string; text: string }> {
  const text = value.trim(); if (!text) return [];
  if (text.length <= maxChars) return [{ label, text }];
  if (!Number.isInteger(maxChars) || maxChars < 512) throw new Error("Ungültige Größe eines klinischen Teilpakets.");
  const markers = pageMarkers(text);
  const prologue = markers.length ? text.slice(0, markers[0].index).trim() : "";
  const header = prologue.length < Math.floor(maxChars / 3) ? prologue : "";
  const sections = markers.length ? markers.map((match, index) => ({ page: Number(match[1]), marker: match[0], text: text.slice((match.index || 0) + match[0].length, markers[index + 1]?.index ?? text.length).trim() })) : [{ page: 0, marker: "", text }];
  if (prologue && !header) sections.unshift({ page: 0, marker: "", text: prologue });
  const result: Array<{ label: string; text: string }> = [];
  for (const section of sections) {
    const prefix = [section.page ? header : "", section.marker].filter(Boolean).join("\n");
    const budget = maxChars - prefix.length - 2;
    if (budget < 64) throw new Error("Der Quellen-Seitenkopf ist zu lang für die gewählte Teilpaketgröße.");
    if (!section.text) { result.push({ label: `${label} – Seite ${section.page}`, text: prefix }); continue; }
    let position = 0;
    while (position < section.text.length) {
      let end = Math.min(position + budget, section.text.length);
      if (end < section.text.length) {
        const boundary = Math.max(section.text.lastIndexOf("\n", end), section.text.lastIndexOf(" ", end));
        if (boundary > position + budget / 2) end = boundary;
      }
      result.push({ label: `${label}${section.page ? ` – Seite ${section.page}` : ""} – Teil ${result.length + 1}`, text: [prefix, section.text.slice(position, end)].filter(Boolean).join("\n\n") });
      if (end === section.text.length) break;
      // A short overlap preserves dosage/negation context at a split boundary.
      const overlap = Math.min(180, Math.floor(budget / 4));
      const next = Math.max(position + 1, end - overlap);
      const word = section.text.indexOf(" ", next);
      position = word >= next && word < end ? word + 1 : next;
    }
  }
  return result;
}
