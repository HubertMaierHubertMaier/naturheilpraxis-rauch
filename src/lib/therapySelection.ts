import type { ParsedTherapy } from "@/lib/therapyParser";
import {
  assessRemedySafety,
  recognizeMedicationGroups,
  type TherapySafetyContext,
  type TherapySafetyWarning,
} from "../../supabase/functions/_shared/therapySafety";

export type WikiProductSafetyLink = {
  productName: string;
  relationType: string;
  reviewStatus: string;
  safetyNotes?: string;
};

export type WikiSafetyEntry = {
  id?: string;
  title: string;
  entryKind?: string;
  reviewStatus?: string;
  evidenceLevel?: string;
  dosageStatus?: string;
  contraindications?: string[];
  interactionTags?: string[];
  safetyNotes?: string;
  patientFacingAllowed?: boolean;
  commercialClaimsReviewed?: boolean;
  productLinks?: WikiProductSafetyLink[];
};

export const MAX_AUTO_SELECTED_ESSENTIAL = 3;
export const MAX_AUTO_SELECTED_RECOMMENDED = 3;

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\([^)]*\)/g, " ")
  .replace(/[^a-z0-9ß]+/g, " ")
  .trim();

const sameRemedy = (left: unknown, right: unknown) => {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 8 && (a.startsWith(`${b} `) || b.startsWith(`${a} `));
};

const sourceIdsFrom = (sourceText: unknown) => Array.from(
  String(sourceText ?? "").matchAll(/\[WIKI_ID:([0-9a-f-]{36})\]/gi),
  (match) => match[1].toLowerCase(),
);

const matchingWikiEntries = (remedyName: unknown, entries: WikiSafetyEntry[], sourceText: unknown = "", allowNameFallback = true) => {
  const sourceIds = sourceIdsFrom(sourceText);
  if (sourceIds.length) return entries.filter((entry) => Boolean(entry.id && sourceIds.includes(entry.id.toLowerCase())));
  if (!allowNameFallback) return [];
  return entries.filter((entry) => (
    sameRemedy(remedyName, entry.title)
    || (entry.productLinks || []).some((link) => link.reviewStatus === "reviewed" && link.relationType === "exact_product" && sameRemedy(remedyName, link.productName))
  ));
};

const remedyBelongsToEntry = (remedyName: unknown, entry: WikiSafetyEntry) => (
  sameRemedy(remedyName, entry.title)
  || (entry.productLinks || []).some((link) => link.reviewStatus === "reviewed" && link.relationType === "exact_product" && sameRemedy(remedyName, link.productName))
);

const contextMatchesTag = (tag: string, context: TherapySafetyContext) => {
  const normalizedTag = normalize(tag);
  const clinical = normalize(`${String(context.conditions ?? "")} ${String(context.symptoms ?? "")} ${String(context.medications ?? "")}`);
  if (/schwanger|still/.test(normalizedTag)) {
    const pregnancy = normalize(context.pregnancy);
    return Boolean(pregnancy && !/^(?:nein|no|nicht|keine|unbekannt)$/.test(pregnancy));
  }
  if (/hyperton|bluthochdruck/.test(normalizedTag)) return /hyperton|bluthochdruck/.test(clinical);
  const medicationGroups = recognizeMedicationGroups(context.medications).map((group) => normalize(`${group.id} ${group.label}`)).join(" ");
  const meaningfulTerms = normalizedTag.split(" ").filter((term) => term.length >= 4);
  return meaningfulTerms.some((term) => clinical.includes(term) || medicationGroups.includes(term));
};

const wikiWarning = (
  id: string,
  severity: TherapySafetyWarning["severity"],
  title: string,
  message: string,
  action: string,
): TherapySafetyWarning => ({ id, severity, title, message, action, source: "Strukturierte interne Wiki-Sicherheitsdaten" });

export const assessRemedyWithWikiSafety = (
  remedyName: unknown,
  context: TherapySafetyContext,
  wikiEntries: WikiSafetyEntry[] = [],
  sourceText: unknown = "",
  requireSourceId = false,
) => {
  const result = [...assessRemedySafety(remedyName, context)];
  const add = (warning: TherapySafetyWarning) => {
    if (!result.some((existing) => existing.id === warning.id)) result.push(warning);
  };
  const sourceIds = sourceIdsFrom(sourceText);
  const matches = matchingWikiEntries(remedyName, wikiEntries, sourceText, !requireSourceId);
  let verifiedMatches = matches;
  if (requireSourceId && sourceIds.length !== 1) {
    add(wikiWarning("wiki-source-id-missing", "avoid", "Wiki-Quelle fehlt oder ist mehrdeutig", "Der KI-Kandidat enthaelt keine genau eindeutige Wiki-ID.", "Nicht auswaehlen; Kandidat mit genau einer belegten Wiki-Quelle neu erzeugen."));
  } else if (requireSourceId && matches.length !== 1) {
    add(wikiWarning("wiki-source-unresolved", "avoid", "Wiki-Quelle nicht auflösbar", `Wiki-ID ${sourceIds[0] || "fehlt"} passt zu keinem eindeutigen Eintrag.`, "Nicht auswaehlen; Wiki-Verknuepfung korrigieren."));
  } else if (requireSourceId && !remedyBelongsToEntry(remedyName, matches[0])) {
    add(wikiWarning("wiki-source-remedy-mismatch", "avoid", "Mittel passt nicht zur angegebenen Wiki-Quelle", `${String(remedyName)} ist weder der Wiki-Titel noch ein verknuepftes Produkt von ${matches[0].title}.`, "Nicht auswaehlen; korrekte Wiki-ID oder Produktzuordnung verwenden."));
    verifiedMatches = [];
  }
  verifiedMatches.forEach((entry) => {
    const hasReviewedExactProduct = (entry.productLinks || []).some((link) => (
      link.reviewStatus === "reviewed"
      && link.relationType === "exact_product"
      && sameRemedy(remedyName, link.productName)
    ));
    if (!/^(?:remedy|product)$/i.test(entry.entryKind || "") && !hasReviewedExactProduct) {
      add(wikiWarning("wiki-entry-kind-ineligible", "avoid", "Wiki-Eintrag ist kein Mittel/Produkt", `${entry.title} hat die Eintragsart ${entry.entryKind || "unbekannt"}.`, "Nicht automatisch auswaehlen; nur gepruefte Mittel-/Produkteintraege oder exakt verknuepfte Produkte verwenden."));
    }
    if (entry.reviewStatus === "restricted") {
      add(wikiWarning("wiki-restricted", "avoid", "Wiki-Eintrag ist gesperrt", `${entry.title} ist intern als nicht verwendbar markiert.`, "Nicht auswaehlen, bis der Eintrag fachlich neu freigegeben wurde."));
    } else if (entry.reviewStatus !== "reviewed") {
      add(wikiWarning("wiki-unreviewed", "review", "Wiki-Eintrag noch nicht fachlich geprüft", `${entry.title} hat den Status ${entry.reviewStatus || "unreviewed"}.`, "Quelle, Evidenz, Dosierung und Produktsicherheit vor Auswahl prüfen."));
    }
    if (!entry.evidenceLevel || /^(?:unrated|unknown|unverified|insufficient)$/i.test(entry.evidenceLevel)) {
      add(wikiWarning("wiki-evidence-unrated", "review", "Evidenzstatus nicht ausreichend bewertet", `${entry.title} hat den Evidenzstatus ${entry.evidenceLevel || "unrated"}.`, "Nicht automatisch als Kernkandidat auswählen; Quellenlage und Übertragbarkeit auf den Patientenkontext fachlich prüfen."));
    }
    if (entry.dosageStatus && !["verified", "not_applicable"].includes(entry.dosageStatus)) {
      add(wikiWarning("wiki-dosage-unverified", "review", "Dosierung im Wiki nicht geprüft", `Dosierungsstatus: ${entry.dosageStatus}.`, "Dosierung nicht ungeprüft übernehmen; konkrete Produktinformation verwenden."));
    }
    const contraindications = (entry.contraindications || []).filter((tag) => contextMatchesTag(tag, context));
    if (contraindications.length) {
      add(wikiWarning("wiki-contraindication", "avoid", "Wiki-Kontraindikation trifft auf Patientenkontext zu", contraindications.join(", "), "Mittel nicht auswählen, bis die Kontraindikation fachlich ausgeräumt ist."));
    }
    const interactions = (entry.interactionTags || []).filter((tag) => contextMatchesTag(tag, context));
    const unresolvedInteractions = (entry.interactionTags || []).filter((tag) => !contextMatchesTag(tag, context));
    if (interactions.length) {
      add(wikiWarning("wiki-interaction", "review", "Wiki-Interaktionshinweis trifft zu", interactions.join(", "), "Konkrete Kombination anhand Wirkstoff- und Produktinformation prüfen."));
    }
    if (unresolvedInteractions.length) {
      add(wikiWarning("wiki-interaction-unresolved", "review", "Wiki-Interaktionen manuell abgleichen", unresolvedInteractions.join(", "), "Diese freien Interaktions-Tags konnten nicht sicher auf die Medikation abgebildet werden."));
    }
    const unresolvedContraindications = (entry.contraindications || []).filter((tag) => !contextMatchesTag(tag, context));
    if (unresolvedContraindications.length) {
      add(wikiWarning("wiki-contraindication-unresolved", "review", "Wiki-Kontraindikationen manuell abgleichen", unresolvedContraindications.join(", "), "Diese freien Kontraindikationsangaben konnten nicht automatisch bestätigt oder ausgeschlossen werden."));
    }
  });
  return result;
};

export const patientOutputRestrictionsForRemedy = (remedyName: unknown, wikiEntries: WikiSafetyEntry[] = [], sourceText: unknown = "", requireSourceId = false) => {
  const restrictions: string[] = [];
  const sourceIds = sourceIdsFrom(sourceText);
  const matches = matchingWikiEntries(remedyName, wikiEntries, sourceText, !requireSourceId);
  const verifiedMatches = requireSourceId && (sourceIds.length !== 1 || matches.length !== 1 || !remedyBelongsToEntry(remedyName, matches[0])) ? [] : matches;
  if (requireSourceId && verifiedMatches.length !== 1) restrictions.push(`${String(remedyName)}: keine eindeutige passende Wiki-Quelle`);
  verifiedMatches.forEach((entry) => {
    if (entry.patientFacingAllowed !== true) restrictions.push(`${entry.title}: nicht für Patientenausgabe freigegeben`);
    if (entry.commercialClaimsReviewed !== true) restrictions.push(`${entry.title}: Werbe-/Produktaussagen nicht geprüft`);
  });
  return Array.from(new Set(restrictions));
};

export const buildRemedySafetyMap = (
  parsed: ParsedTherapy,
  context: TherapySafetyContext,
  wikiEntries: WikiSafetyEntry[] = [],
) => {
  const result = new Map<string, TherapySafetyWarning[]>();
  parsed.categories.forEach((group, categoryIndex) => {
    group.remedies.forEach((remedy, remedyIndex) => {
      const warnings = assessRemedyWithWikiSafety(remedy.name, context, wikiEntries, remedy.reason, true);
      if (warnings.length) result.set(`${categoryIndex}|${remedyIndex}`, warnings);
    });
  });
  return result;
};

export const buildInitialRemedySelection = (
  parsed: ParsedTherapy,
  context: TherapySafetyContext,
  wikiEntries: WikiSafetyEntry[] = [],
) => {
  const warnings = buildRemedySafetyMap(parsed, context, wikiEntries);
  const essential: string[] = [];
  const recommended: string[] = [];
  parsed.categories.forEach((group, categoryIndex) => {
    group.remedies.forEach((remedy, remedyIndex) => {
      const key = `${categoryIndex}|${remedyIndex}`;
      if (warnings.has(key)) return;
      if (remedy.priority === "essential") essential.push(key);
      if (remedy.priority === "recommended") recommended.push(key);
    });
  });
  return new Set([
    ...essential.slice(0, MAX_AUTO_SELECTED_ESSENTIAL),
    ...recommended.slice(0, MAX_AUTO_SELECTED_RECOMMENDED),
  ]);
};

export const assessSelectedCombinationSafety = (
  parsed: ParsedTherapy,
  selectedKeys: Set<string>,
  wikiEntries: WikiSafetyEntry[] = [],
  manualRemedyNames: string[] = [],
  existingRemedyNames: string[] = [],
) => {
  const selected = parsed.categories.flatMap((group, categoryIndex) => group.remedies
    .map((remedy, remedyIndex) => ({ name: remedy.name, reason: remedy.reason, key: `${categoryIndex}|${remedyIndex}` }))
    .filter((remedy) => selectedKeys.has(remedy.key)));
  const manual = manualRemedyNames.filter(Boolean).map((name) => ({ name, reason: "", key: `manual:${name}` }));
  const existing = existingRemedyNames.filter(Boolean).map((name) => ({ name, reason: "", key: `existing:${name}` }));
  const allSelected = [...selected, ...manual, ...existing];
  const warnings: Array<TherapySafetyWarning & { key: string; remedyName: string }> = [];

  wikiEntries.forEach((entry) => {
    const entryCandidates = allSelected.filter((candidate) => sameRemedy(candidate.name, entry.title));
    (entry.productLinks || [])
      .filter((link) => link.reviewStatus === "reviewed" && link.relationType === "do_not_combine")
      .forEach((link) => {
        const productCandidates = allSelected.filter((candidate) => sameRemedy(candidate.name, link.productName));
        entryCandidates.forEach((entryCandidate) => productCandidates.forEach((productCandidate) => {
          if (entryCandidate.key === productCandidate.key) return;
          warnings.push({
            ...wikiWarning("wiki-product-do-not-combine", "avoid", "Geprüfte Nicht-kombinieren-Zuordnung", link.safetyNotes || `${entry.title} und ${link.productName} sind als nicht zu kombinieren verknuepft.`, "Eines der beiden Mittel aus dem Plan entfernen."),
            key: "combination",
            remedyName: `${entryCandidate.name} + ${productCandidate.name}`,
          });
        }));
      });
  });
  return warnings.filter((warning, index) => warnings.findIndex((item) => item.remedyName === warning.remedyName && item.id === warning.id) === index);
};
