export type LabValueRecord = Record<string, unknown>;

export type LabHighlight = {
  item: LabValueRecord;
  direction: string;
  significance: string;
  derivedFromContext: boolean;
};

const reportedAbnormal = (value: unknown) => {
  const assessment = String(value ?? "").trim();
  return assessment === "↑" || assessment === "↓" || /kritisch/i.test(assessment);
};

export const normalizeLabParameter = (value: unknown) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export const isPsaParameter = (value: unknown) => {
  const parameter = normalizeLabParameter(value);
  if (/frei(?:es|er)?|free|quotient|ratio|index|f\s*t/.test(parameter)) return false;
  return /(^|\s)psa($|\s)/.test(parameter)
    || /prostata\s*spezifisches?\s*antigen/.test(parameter)
    || /prostataspezifisches?\s*antigen/.test(parameter);
};

const labParameterKey = (value: unknown) => isPsaParameter(value) ? "psa" : normalizeLabParameter(value);

export const parseLabNumber = (value: unknown): number | null => {
  const normalized = String(value ?? "").replace(/,/g, ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePsaMeasurement = (value: unknown, unit: unknown) => {
  const rawValue = String(value ?? "").trim();
  const rawUnit = `${String(unit ?? "")} ${rawValue}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/μ/g, "µ")
    .replace(/\s+/g, "");
  const supportedUnit = /ng\/?ml/.test(rawUnit) || /(?:µ|u)g\/?l/.test(rawUnit);
  if (!supportedUnit) return null;

  const numeric = parseLabNumber(rawValue);
  if (numeric === null) return null;
  const comparator = rawValue.match(/^\s*(<=|>=|<|>|≤|≥)/)?.[1] || "";
  return {
    numeric,
    bound: comparator === "<" || comparator === "<=" || comparator === "≤"
      ? "upper" as const
      : comparator === ">" || comparator === ">=" || comparator === "≥"
        ? "lower" as const
        : "exact" as const,
  };
};

const dateRank = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return Number.NEGATIVE_INFINITY;

  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  match = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    return Date.UTC(year, Number(match[2]) - 1, Number(match[1]));
  }

  match = raw.match(/^(\d{1,2})[.\/-](\d{4})$/);
  if (match) return Date.UTC(Number(match[2]), Number(match[1]) - 1, 1);

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

export const hasPostProstatectomyContext = (context: unknown) => {
  const hasProcedure = (text: string) => /prostatektom/i.test(text);
  const isExcluded = (text: string) => /(?:keine|ohne|nicht|nie)\s+(?:radikale\s+)?prostatektom|prostatektom[^.\n]{0,50}(?:durchgef[uü]hrt\s*:\s*nein|nicht\s+(?:durchgef[uü]hrt|erfolgt)|ausgeschlossen|geplant|erwogen|besprochen|empfohlen|option|bevorstehend)/i.test(text);
  const hasPastStatus = (text: string) => /(?:(?:z\.?\s*n\.?|zustand\s+nach|status\s+post|postoperativ(?:\s+nach)?)\s+(?:radikaler?\s+)?prostatektom|nach\s+(?:durchgef[uü]hrter?\s+)?(?:radikaler?\s+)?prostatektom|(?:durchgef[uü]hrte?|erfolgte?)\s+(?:radikaler?\s+)?prostatektom|prostatektom[^.\n]{0,40}(?:durchgef[uü]hrt|erfolgt))/i.test(text);
  const isExplicitPastStatus = (text: string) => /^\s*(?:z\.?\s*n\.?|zustand\s+nach|status\s+post|postoperativ|durchgef[uü]hrt|erfolgt)\s*\.?\s*$/i.test(text);

  const inspect = (value: unknown): boolean => {
    if (typeof value === "string") return !isExcluded(value) && hasPastStatus(value);
    if (Array.isArray(value)) return value.some(inspect);
    if (!value || typeof value !== "object") return false;

    const values = Object.values(value);
    const immediateStrings = values.filter((entry): entry is string => typeof entry === "string");
    const procedureText = immediateStrings.find((entry) => hasProcedure(entry) && !isExcluded(entry));
    if (procedureText && (hasPastStatus(procedureText) || immediateStrings.some(isExplicitPastStatus))) return true;
    return values.filter((entry) => typeof entry !== "string").some(inspect);
  };

  return inspect(context);
};

export const hasTreatedProstateCancerContext = (context: unknown) => {
  if (hasPostProstatectomyContext(context)) return true;

  const mentionsCancer = (text: string) => /prostata(?:karzinom|-?ca)|prostate\s+cancer|(?:^|\W)c61(?:\W|$)|maligne\s+neubildung[^.\n]{0,40}prostata/i.test(text);
  const cancerExcluded = (text: string) => /(?:kein|keine|ohne|ausschluss\s+von)\s+(?:ein(?:em|en)?\s+)?prostata(?:karzinom|-?ca)|prostata(?:karzinom|-?ca)[^.\n]{0,50}ausgeschlossen/i.test(text);
  const mentionsTreatment = (text: string) => /bestrahlung|strahlentherapie|radiatio|brachytherapie|hifu|kryotherapie|fokal(?:e|er)?\s+therapie|androgen(?:deprivation|-?entzug)|hormontherapie|(?:^|\W)adt(?:\W|$)/i.test(text);
  const treatmentExcluded = (text: string) => /(?:keine|ohne|nie)\s+(?:eine\s+)?(?:bestrahlung|strahlentherapie|radiatio|brachytherapie|hifu|kryotherapie|fokal(?:e|er)?\s+therapie|androgen(?:deprivation|-?entzug)|hormontherapie|adt)|(?:bestrahlung|strahlentherapie|radiatio|brachytherapie|hifu|kryotherapie|fokal(?:e|er)?\s+therapie|androgen(?:deprivation|-?entzug)|hormontherapie|adt)[^.\n]{0,50}(?:durchgef[uü]hrt\s*:\s*nein|nicht\s+(?:durchgef[uü]hrt|begonnen|erfolgt))|(?:abgebrochen|abgesetzt)\s+vor\s+beginn|geplant|erwogen|besprochen|empfohlen|option|bevorstehend/i.test(text);
  const treatmentActiveOrPast = (text: string) => /durchgef[uü]hrt|erfolgt|abgeschlossen|abgesetzt|laufend|fortgef[uü]hrt|seit\s+\d|z\.?\s*n\.?|status\s+post/i.test(text);

  const inspect = (value: unknown): boolean => {
    if (typeof value === "string") {
      return mentionsCancer(value) && !cancerExcluded(value)
        && mentionsTreatment(value) && !treatmentExcluded(value)
        && treatmentActiveOrPast(value);
    }
    if (Array.isArray(value)) return value.some(inspect);
    if (!value || typeof value !== "object") return false;

    const values = Object.values(value);
    const immediateText = values.filter((entry): entry is string => typeof entry === "string").join(" ");
    if (mentionsCancer(immediateText) && !cancerExcluded(immediateText)
      && mentionsTreatment(immediateText) && !treatmentExcluded(immediateText)
      && treatmentActiveOrPast(immediateText)) return true;
    return values.filter((entry) => typeof entry !== "string").some(inspect);
  };

  return inspect(context);
};

export const extractLabQuintessenceSection = (html: string) => {
  const headingPattern = /<h2\b[^>]*>[\s\S]*?<\/h2>/gi;
  for (const match of html.matchAll(headingPattern)) {
    const headingText = match[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!/laborwerte/i.test(headingText) || !/auff[aä]llig|kontextrelevant|erkrankung|therapiebezogen|quintessenz/i.test(headingText)) continue;
    const start = match.index ?? 0;
    const remainder = html.slice(start + match[0].length);
    const endOffset = remainder.search(/<h2\b[^>]*>|<\/body>/i);
    return html.slice(start, endOffset < 0 ? html.length : start + match[0].length + endOffset);
  }
  return "";
};

const newestByParameter = (labValues: LabValueRecord[]) => {
  const newest = new Map<string, { item: LabValueRecord; rank: number; index: number }>();
  labValues.forEach((item, index) => {
    const key = labParameterKey(item.parameter);
    if (!key) return;
    const candidate = { item, rank: dateRank(item.datum), index };
    const previous = newest.get(key);
    if (!previous || candidate.rank > previous.rank || (candidate.rank === previous.rank && index > previous.index)) {
      newest.set(key, candidate);
    }
  });
  return newest;
};

export const buildClinicallyRelevantLabHighlights = (
  labValues: LabValueRecord[],
  clinicalContext: unknown,
): LabHighlight[] => {
  const newestAbnormal = newestByParameter(labValues.filter((item) => reportedAbnormal(item.bewertung)));
  const highlights = new Map<string, LabHighlight>();

  for (const [key, candidate] of newestAbnormal) {
    highlights.set(key, {
      item: candidate.item,
      direction: String(candidate.item.bewertung ?? "auffällig"),
      significance: "Auffälliger Laborwert laut dokumentierter Bewertung; im klinischen Kontext prüfen.",
      derivedFromContext: false,
    });
  }

  const postProstatectomy = hasPostProstatectomyContext(clinicalContext);
  const treatedProstateCancer = postProstatectomy || hasTreatedProstateCancerContext(clinicalContext);
  if (!treatedProstateCancer) return Array.from(highlights.values());

  const psaValues = labValues
    .map((item, index) => ({ item, index, rank: dateRank(item.datum), measurement: parsePsaMeasurement(item.wert, item.einheit) }))
    .filter((entry) => isPsaParameter(entry.item.parameter) && entry.measurement !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index);

  if (!psaValues.length) return Array.from(highlights.values());

  const latest = psaValues[psaValues.length - 1];
  const previous = psaValues.length > 1 ? psaValues[psaValues.length - 2] : undefined;
  const latestMeasurement = latest.measurement!;
  const documentedRise = latestMeasurement.bound === "exact"
    && previous?.measurement !== null
    && previous?.measurement !== undefined
    && previous.measurement.bound !== "lower"
    && latestMeasurement.numeric > previous.measurement.numeric;
  const postProstatectomySignal = postProstatectomy && latestMeasurement.bound !== "upper" && latestMeasurement.numeric >= 0.1;
  const treatmentSpecificRise = documentedRise && (!postProstatectomy || latestMeasurement.numeric >= 0.1);

  if (treatmentSpecificRise || postProstatectomySignal) {
    const key = labParameterKey(latest.item.parameter);
    highlights.set(key, {
      item: latest.item,
      direction: "Verlauf",
      significance: postProstatectomy
        ? "Sensibler PSA-Verlauf bei dokumentiertem Zustand nach Prostatektomie; auch unterhalb des allgemeinen Laborreferenzbereichs zeitnah ärztlich beziehungsweise urologisch kontrollieren und im Verlauf bestätigen. Keine automatische Rezidivdiagnose."
        : "Dokumentierter PSA-Anstieg nach Behandlung eines Prostatakarzinoms; behandlungsspezifisch ärztlich beziehungsweise urologisch bewerten und im Verlauf bestätigen. Keine automatische Rezidivdiagnose.",
      derivedFromContext: true,
    });
  }

  return Array.from(highlights.values());
};
