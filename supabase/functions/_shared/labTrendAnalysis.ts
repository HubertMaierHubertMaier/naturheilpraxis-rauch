export type LabValueRecord = Record<string, unknown>;

export type LabHighlight = {
  item: LabValueRecord;
  direction: string;
  significance: string;
  derivedFromContext: boolean;
  ruleId?: string;
};

type DiseaseLabRule = {
  id: string;
  context: RegExp;
  parameters: RegExp;
  action: string;
};

export const DISEASE_LAB_RULES: DiseaseLabRule[] = [
  {
    id: "kidney-function",
    context: /niereninsuffizienz|chronische\s+nieren(?:erkrankung|krankheit)|nephropathie|\bckd\b/i,
    parameters: /^(?:egfr|kreatinin|cystatin c|kalium|harnstoff|albuminurie|albumin kreatinin quotient)$/i,
    action: "Im dokumentierten Nierenkontext Verlauf und Wiederholungsmessung, Hydratation sowie potenziell nierengängige oder nephrotoxische Medikamente ärztlich prüfen; je nach Ausmaß nephrologisch abklären.",
  },
  {
    id: "liver-function",
    context: /leberzirrhose|leberinsuffizienz|hepatitis|fettleber|steatohepatitis|cholestase/i,
    parameters: /^(?:alt|gpt|ast|got|ggt|gamma gt|bilirubin|albumin|inr|quick|alkalische phosphatase|ap)$/i,
    action: "Im dokumentierten Leberkontext Befund und Verlauf ärztlich bestätigen, Arznei- und Alkoholeinflüsse prüfen und je nach Muster hepatologisch abklären.",
  },
  {
    id: "diabetes-control",
    context: /diabetes mellitus|typ\s*[12]\s*diabetes|diabetische/i,
    parameters: /^(?:glukose|glucose|nuchternblutzucker|blutzucker|hba1c|ketone|beta hydroxybutyrat)$/i,
    action: "Im dokumentierten Diabeteskontext Messung, Verlauf und aktuelle Therapie ärztlich abgleichen; bei deutlicher Abweichung oder Beschwerden zeitnah diabetologisch kontrollieren.",
  },
  {
    id: "thyroid-function",
    context: /hypothyreose|hyperthyreose|hashimoto|morbus basedow|schilddrusen(?:erkrankung|unterfunktion|uberfunktion)/i,
    parameters: /^(?:tsh|ft3|freies t3|ft4|freies t4|tpo ak|trak|thyreoglobulin)$/i,
    action: "Im dokumentierten Schilddrüsenkontext Messzeitpunkt, Einnahmeabstand und Therapiedosis ärztlich prüfen und den Verlauf gegebenenfalls endokrinologisch abklären.",
  },
  {
    id: "anticoagulation",
    context: /antikoagulation|phenprocoumon|marcumar|warfarin|apixaban|rivaroxaban|edoxaban|dabigatran/i,
    parameters: /^(?:inr|quick|thrombozyten|hamoglobin|hb|kreatinin|egfr)$/i,
    action: "Bei dokumentierter Gerinnungshemmung Blutungszeichen, Einnahme, Nierenfunktion und relevante Begleitmedikation ärztlich prüfen; Kontrollweg und Dringlichkeit richten sich nach Ausmaß und Beschwerden.",
  },
  {
    id: "anemia-workup",
    context: /anamie|eisenmangel|vitamin b12 mangel|folsauremangel/i,
    parameters: /^(?:hamoglobin|hb|hamatokrit|mcv|mch|ferritin|transferrin|transferrinsattigung|vitamin b12|holotranscobalamin|folsaure|retikulozyten)$/i,
    action: "Im dokumentierten Anämie- oder Mangelkontext Verlauf und Ursachen ärztlich klären; je nach Konstellation Blutverlust, Eisenstatus, Vitaminversorgung, Nierenfunktion und Entzündung differenzieren.",
  },
  {
    id: "oncology-blood-count",
    context: /(?:laufende|aktive)\s+(?:chemotherapie|immuntherapie|onkologische\s+therapie)|(?:chemotherapie|zytostatik|immuntherapie|onkologische\s+therapie)[^.;\n]{0,35}(?:laufend|aktiv|fortgef[uü]hrt|therapietag|zyklus)|(?:docetaxel|cabazitaxel|abemaciclib|palbociclib|ribociclib|capecitabin|methotrexat|enzalutamid|apalutamid|darolutamid|abirateron)[^{}]{0,80}(?:laufend|aktiv|fortgef[uü]hrt)/i,
    parameters: /^(?:leukozyten|neutrophile|absolute neutrophile|thrombozyten|hamoglobin|hb|kreatinin|egfr|alt|gpt|ast|got|bilirubin)$/i,
    action: "Im dokumentierten onkologischen Kontext Therapietag, Verlauf und mögliche Nebenwirkungen zeitnah mit dem behandelnden Fachteam abgleichen; keine Therapieänderung allein aus diesem Einzelwert ableiten.",
  },
];

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
  return /(^|\s)[ip]?psa($|\s)/.test(parameter)
    || /prostata\s*spezifisches?\s*antigen/.test(parameter)
    || /prostataspezifisches?\s*antigen/.test(parameter);
};

export const isTotalTestosteroneParameter = (value: unknown) => {
  const parameter = normalizeLabParameter(value);
  if (/frei(?:es|er)?|free|bioverfugbar|bioavailable|quotient|index|shbg/.test(parameter)) return false;
  return /(^|\s)testosteron($|\s)/.test(parameter)
    || /(^|\s)testosterone($|\s)/.test(parameter);
};

export const labParameterKey = (value: unknown) => {
  if (isPsaParameter(value)) return "psa";
  if (isTotalTestosteroneParameter(value)) return "testosterone";
  return normalizeLabParameter(value);
};

export const parseLabNumber = (value: unknown): number | null => {
  const normalized = String(value ?? "").replace(/,/g, ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBoundedNumber = (value: unknown) => {
  const rawValue = String(value ?? "").trim();
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

export const normalizeLabUnit = (value: unknown) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/μ/g, "µ")
  .replace(/\s+/g, "");

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

  return parseBoundedNumber(rawValue);
};

const parameterPattern = /\b(?:[ip]?PSA(?:\s*(?:gesamt|total))?|prostataspezifisches?\s+Antigen|Prostata[-\s]?spezifisches?\s+Antigen|Gesamt[-\s]?Testosteron|Testosteron(?:\s*(?:gesamt|total))?|Total\s+Testosterone)\b/giu;
const measurementPattern = /([<>≤≥]?\s*\d+(?:[.,]\d+)?)\s*(ng\s*\/\s*m[lL]|ng\s*\/\s*d[lL]|nmol\s*\/\s*[lL]|[µμu]g\s*\/\s*[lL])/giu;
const valueAfterParameterPattern = /^\s*(?:(?:[-:–—]|gesamt|total|ultrasensitiv|ultrasensitive|ergebnis|wert|result|value|\([^)]{0,40}\))\s*)*([<>≤≥]?\s*\d+(?:[.,]\d+)?)/iu;
const valueSeriesAfterParameterPattern = /^\s*(?:(?:[-:–—]|gesamt|total|ultrasensitiv|ultrasensitive|ergebnis|wert|result|value|\([^)]{0,40}\))\s*)*((?:[<>≤≥]?\s*\d+(?:[.,]\d+)?\s+){1,5})([<>≤≥]?\s*\d+(?:[.,]\d+)?)\s*(ng\s*\/\s*m[lL]|ng\s*\/\s*d[lL]|nmol\s*\/\s*[lL]|[µμu]g\s*\/\s*[lL])/iu;
const datePattern = /\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}[./-]\d{4})\b/g;

const nearbyDatesBefore = (text: string, position: number) => Array.from(
  text.slice(Math.max(0, position - 500), position).matchAll(datePattern),
).map((match) => match[0]);

const nearbyDate = (text: string, position: number) => {
  const beforeMatches = nearbyDatesBefore(text, position);
  if (beforeMatches.length) return beforeMatches[beforeMatches.length - 1];
  return text.slice(position, position + 300).match(datePattern)?.[0] || "";
};

export const extractSensitiveLabValuesFromText = (
  text: string,
  sourceLabel: string,
  part = "",
): LabValueRecord[] => {
  const parameterMatches = Array.from(text.matchAll(parameterPattern));
  const extracted: LabValueRecord[] = [];

  parameterMatches.forEach((parameterMatch, index) => {
    const start = (parameterMatch.index ?? 0) + parameterMatch[0].length;
    const nextStart = parameterMatches[index + 1]?.index ?? text.length;
    const window = text.slice(start, Math.min(nextStart, start + 220));
    const candidates = Array.from(window.matchAll(measurementPattern)).filter((candidate) => {
      const prefix = window.slice(Math.max(0, (candidate.index ?? 0) - 50), candidate.index ?? 0);
      const lastValueLabel = Math.max(prefix.toLowerCase().lastIndexOf("wert"), prefix.toLowerCase().lastIndexOf("ergebnis"));
      const lastReferenceLabel = Math.max(
        prefix.toLowerCase().lastIndexOf("referenz"),
        prefix.toLowerCase().lastIndexOf("normbereich"),
        prefix.toLowerCase().lastIndexOf("nachweisgrenze"),
        prefix.toLowerCase().lastIndexOf("messgrenze"),
      );
      const fullPrefix = window.slice(0, candidate.index ?? 0);
      return (candidate.index ?? 0) <= 120
        && !/[!?]|\.(?:\s|$)/u.test(fullPrefix)
        && (lastReferenceLabel < 0 || lastValueLabel > lastReferenceLabel);
    });
    const parameter = isPsaParameter(parameterMatch[0]) ? "PSA (gesamt)" : "Testosteron (gesamt)";
    const datesBefore = nearbyDatesBefore(text, parameterMatch.index ?? 0);
    const series = window.match(valueSeriesAfterParameterPattern);
    const seriesValues = series
      ? Array.from(`${series[1]}${series[2]}`.matchAll(/[<>≤≥]?\s*\d+(?:[.,]\d+)?/gu)).map((match) => match[0].replace(/\s+/g, " ").trim())
      : [];
    const possibleMultiMeasurements = seriesValues.length > 1
      ? seriesValues.map((value) => ({ value, unit: series![3] }))
      : candidates.length > 1
        ? candidates.map((candidate) => ({ value: candidate[1].replace(/\s+/g, " ").trim(), unit: candidate[2] }))
        : [];
    const multiMeasurements = possibleMultiMeasurements.every((measurement) => {
      if (!/^[<>≤≥]/u.test(measurement.value)) return true;
      const boundedValue = parseLabNumber(measurement.value);
      return boundedValue !== null && boundedValue <= 1;
    })
      ? possibleMultiMeasurements
      : [];

    const canPairDatedSeries = datesBefore.length >= multiMeasurements.length;
    const isUndatedPsaDetectionSeries = isPsaParameter(parameterMatch[0])
      && datesBefore.length === 0
      && multiMeasurements.some((measurement) => /^[<>≤≥]/u.test(measurement.value))
      && multiMeasurements.some((measurement) => !/^[<>≤≥]/u.test(measurement.value));
    if ((isPsaParameter(parameterMatch[0]) || isTotalTestosteroneParameter(parameterMatch[0]))
      && multiMeasurements.length > 1
      && (canPairDatedSeries || isUndatedPsaDetectionSeries)) {
      const dates = canPairDatedSeries
        ? datesBefore.slice(-multiMeasurements.length)
        : multiMeasurements.map(() => nearbyDate(text, parameterMatch.index ?? 0));
      const quoteStart = Math.max(0, (parameterMatch.index ?? 0) - 120);
      const quote = text.slice(quoteStart, Math.min(text.length, start + 220)).replace(/\s+/g, " ").trim().slice(0, 220);
      multiMeasurements.forEach((measurement, measurementIndex) => extracted.push({
        datum: dates[measurementIndex],
        parameter,
        wert: measurement.value,
        einheit: normalizeLabUnit(measurement.unit),
        referenz: "",
        bewertung: "unklar",
        quelle: sourceLabel,
        beleg: { quelle: sourceLabel, teil: part, zitat: quote },
      }));
      return;
    }

    let measurement: RegExpMatchArray | undefined = candidates[0];
    const valueAfterParameter = window.match(valueAfterParameterPattern);
    const nearbyUnit = window.slice(0, 180).match(/ng\s*\/\s*m[lL]|ng\s*\/\s*d[lL]|nmol\s*\/\s*[lL]|[µμu]g\s*\/\s*[lL]/iu);
    const directValueDiffers = valueAfterParameter && measurement
      ? parseLabNumber(valueAfterParameter[1]) !== parseLabNumber(measurement[1])
      : false;
    if ((!measurement || /^[<>≤≥]/u.test(measurement[1].trim()) || directValueDiffers) && valueAfterParameter && nearbyUnit) {
      measurement = Object.assign([valueAfterParameter[0], valueAfterParameter[1], nearbyUnit[0]], {
          index: valueAfterParameter.index ?? 0,
          input: window,
          groups: undefined,
      }) as RegExpMatchArray;
    }
    if (!measurement) return;

    const value = measurement[1].replace(/\s+/g, " ").trim();
    const unit = normalizeLabUnit(measurement[2]);
    const absoluteMeasurementStart = start + (measurement.index ?? 0);
    const quoteStart = Math.max(0, (parameterMatch.index ?? 0) - 80);
    const quoteEnd = Math.min(text.length, absoluteMeasurementStart + measurement[0].length + 80);
    const quote = text.slice(quoteStart, quoteEnd).replace(/\s+/g, " ").trim().slice(0, 220);

    extracted.push({
      datum: nearbyDate(text, parameterMatch.index ?? 0),
      parameter,
      wert: value,
      einheit: unit,
      referenz: "",
      bewertung: "unklar",
      quelle: sourceLabel,
      beleg: { quelle: sourceLabel, teil: part, zitat: quote },
    });
  });

  const unique = new Map<string, LabValueRecord>();
  for (const item of extracted) {
    const key = [labParameterKey(item.parameter), item.datum, item.wert, normalizeLabUnit(item.einheit)].join("|");
    unique.set(key, item);
  }
  return Array.from(unique.values());
};

const dateRank = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return Number.NEGATIVE_INFINITY;

  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    return Date.UTC(year, Number(match[2]) - 1, Number(match[1]));
  }

  match = raw.match(/^(\d{1,2})[./-](\d{4})$/);
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

export type AndrogenDeprivationPhase = "none" | "active" | "paused_or_ended" | "unknown";

export const getAndrogenDeprivationPhase = (context: unknown): AndrogenDeprivationPhase => {
  const cancerPattern = /prostata(?:karzinom|-?ca)|prostate\s+cancer|(?:^|\W)c61(?:\W|$)/i;
  const specificAdtPattern = /androgen(?:deprivation|-?entzug)|lhrh|gnrh|(?:^|\W)adt(?:\W|$)|leuprorelin|leuprolid|triptorelin|goserelin|degarelix|relugolix|bicalutamid|enzalutamid|apalutamid|darolutamid|abirateron/i;
  const genericHormonePattern = /hormontherapie/i;
  const treatmentPattern = /androgen(?:deprivation|-?entzug)|hormontherapie|lhrh|gnrh|(?:^|\W)adt(?:\W|$)|leuprorelin|leuprolid|triptorelin|goserelin|degarelix|relugolix|bicalutamid|enzalutamid|apalutamid|darolutamid|abirateron/i;
  const contextText = normalizeContextText(context);
  if (!hasPositiveContextMatch(contextText, cancerPattern)) return "none";

  const entries: Array<{ text: string; rank: number }> = [];
  const collect = (value: unknown) => {
    if (typeof value === "string") {
      const text = normalizeContextText(value);
      const statusContinuation = /^(?:(?:danach|wieder|aktuell|derzeit|nun|weiterhin|jetzt|seitdem)\s+)*(?:abgeschlossen|abgesetzt|beendet|pausiert|unterbrochen|laufend|aktiv|fortgef[uü]hrt|weitergef[uü]hrt|begonnen|durchgef[uü]hrt|erfolgt)(?:\s+(?:seit|am|zum)\s+[\d./-]+)?$/i;
      let currentTreatmentClause = "";
      const flush = () => {
        if (currentTreatmentClause) entries.push({ text: currentTreatmentClause, rank: Number.NEGATIVE_INFINITY });
        currentTreatmentClause = "";
      };
      text.split(/[;,\n.!?]+|\b(?:und|sowie|aber|jedoch)\b/).map((segment) => segment.trim()).filter(Boolean).forEach((segment) => {
        const linkedGenericHormone = genericHormonePattern.test(segment) && cancerPattern.test(segment);
        if (specificAdtPattern.test(segment) || linkedGenericHormone) {
          flush();
          currentTreatmentClause = segment;
        } else if (currentTreatmentClause && statusContinuation.test(segment)) {
          currentTreatmentClause = `${currentTreatmentClause} ${segment}`;
        } else {
          flush();
        }
      });
      flush();
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (!value || typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    const therapyName = normalizeContextText(object.name ?? object.wirkstoff ?? object.therapie ?? object.bezeichnung ?? "");
    const explicitStatus = normalizeContextText(object.status ?? object.therapiestatus ?? "");
    const indication = normalizeContextText(object.indikation ?? object.diagnose ?? object.grundVerordnung ?? "");
    const therapyContext = `${therapyName} ${explicitStatus} ${indication}`.trim();
    const linkedGenericHormone = genericHormonePattern.test(therapyName) && cancerPattern.test(therapyContext);
    if (specificAdtPattern.test(therapyName) || linkedGenericHormone) {
      entries.push({
        text: therapyContext,
        rank: dateRank(object.datum ?? object.date ?? object.beginn ?? object.ende),
      });
    } else {
      Object.values(object).filter((entry) => typeof entry === "string").forEach(collect);
    }
    Object.values(object).filter((entry) => typeof entry !== "string").forEach(collect);
  };
  collect(context);

  type PhaseObservation = { phase: Exclude<AndrogenDeprivationPhase, "none">; rank: number };
  const phases: PhaseObservation[] = entries.flatMap<PhaseObservation>((entry): PhaseObservation[] => {
    if (!hasPositiveContextMatch(entry.text, treatmentPattern)) return [];
    if (/(?:abgebrochen|abgesetzt)\s+vor\s+beginn|nicht\s+(?:durchgef[uü]hrt|begonnen|erfolgt)/i.test(entry.text)) return [];
    const endedMatches = Array.from(entry.text.matchAll(/abgeschlossen|abgesetzt|beendet|pausiert|unterbrochen|therapiepause|therapiefrei|status\s+post/gi));
    const activeMatches = Array.from(entry.text.matchAll(/laufend|fortgef[uü]hrt|aktiv|aktuell|seit\s+\d|weitergef[uü]hrt/gi));
    const lastEnded = endedMatches.at(-1)?.index ?? -1;
    const lastActive = activeMatches.at(-1)?.index ?? -1;
    if (lastEnded >= 0 || lastActive >= 0) {
      return [{ phase: lastActive > lastEnded ? "active" as const : "paused_or_ended" as const, rank: entry.rank }];
    }
    if (/durchgef[uü]hrt|erfolgt|begonnen|z\.?\s*n\.?/i.test(entry.text)) return [{ phase: "unknown" as const, rank: entry.rank }];
    if (/nur\s+geplant|\b(?:geplant|erwogen|besprochen|empfohlen|option)\b/i.test(entry.text)) return [];
    return [];
  });
  if (!phases.length) return "none";
  const dated = phases.filter((entry) => Number.isFinite(entry.rank)).sort((a, b) => b.rank - a.rank);
  if (dated.length && (dated.length === 1 || dated[0].rank > dated[1].rank)) return dated[0].phase;
  const unique = new Set(phases.map((entry) => entry.phase));
  return unique.size === 1 ? phases[0].phase : "unknown";
};

const withoutFamilyHistory = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutFamilyHistory);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !/family\s*history|familienanamnese/i.test(key))
    .map(([key, entry]) => [key, withoutFamilyHistory(entry)]));
};

const normalizeContextText = (value: unknown) => String(
  typeof value === "string" ? value : JSON.stringify(value ?? ""),
).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const hasPositiveContextMatch = (text: string, pattern: RegExp) => {
  const matcher = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  for (const match of text.matchAll(matcher)) {
    const start = match.index ?? 0;
    const before = text.slice(Math.max(0, start - 55), start);
    const after = text.slice(start + match[0].length, start + match[0].length + 55);
    if (/(?:kein(?:e|en|er|es)?|ohne|ausschluss\s+von|verdacht\s+nicht\s+bestatigt)\s+[^.;\n]{0,35}$/i.test(before)) continue;
    if (/^[^.;\n]{0,35}(?:ausgeschlossen|verneint|nicht\s+bestatigt|nur\s+verdacht)/i.test(after)) continue;
    return true;
  }
  return false;
};

const hasActiveOncologyTherapy = (value: unknown): boolean => {
  const therapyPattern = /chemotherapie|zytostatik|immuntherapie|onkologische\s+therapie/i;
  const medicationPattern = /docetaxel|cabazitaxel|abemaciclib|palbociclib|ribociclib|capecitabin|methotrexat|enzalutamid|apalutamid|darolutamid|abirateron/i;
  const activePattern = /laufend|aktiv|fortgef[uü]hrt|therapietag|zyklus/i;
  if (typeof value === "string") {
    const text = normalizeContextText(value);
    return (therapyPattern.test(text) || medicationPattern.test(text)) && activePattern.test(text);
  }
  if (Array.isArray(value)) return value.some(hasActiveOncologyTherapy);
  if (!value || typeof value !== "object") return false;
  const object = value as Record<string, unknown>;
  const name = normalizeContextText(object.name ?? object.wirkstoff ?? object.therapie ?? "");
  const status = normalizeContextText(object.status ?? object.therapiestatus ?? "");
  if ((therapyPattern.test(name) || medicationPattern.test(name)) && activePattern.test(status)) return true;
  return Object.values(object).filter((entry) => typeof entry !== "string").some(hasActiveOncologyTherapy);
};

const diseaseRuleFor = (item: LabValueRecord, clinicalContext: unknown) => {
  const contextText = normalizeContextText(clinicalContext);
  const parameter = labParameterKey(item.parameter);
  return DISEASE_LAB_RULES.find((rule) => (
    (rule.id === "oncology-blood-count" ? hasActiveOncologyTherapy(clinicalContext) : hasPositiveContextMatch(contextText, rule.context))
    && rule.parameters.test(parameter)
  ));
};

export const hasAndrogenDeprivationContext = (context: unknown) => getAndrogenDeprivationPhase(context) !== "none";

const testosteroneInNgDl = (value: unknown, unit: unknown) => {
  const measurement = parseBoundedNumber(value);
  if (!measurement) return null;
  const normalizedUnit = normalizeLabUnit(unit);
  const factor = /^(?:ng\/dl|ngdl)$/.test(normalizedUnit)
    ? 1
    : /^(?:ng\/ml|ngml|µg\/l|µgl|ug\/l|ugl)$/.test(normalizedUnit)
      ? 100
      : /^(?:nmol\/l|nmoll)$/.test(normalizedUnit)
        ? 28.842
        : null;
  return factor === null ? null : { ...measurement, numeric: measurement.numeric * factor };
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
  const patientClinicalContext = withoutFamilyHistory(clinicalContext);
  const newestValues = newestByParameter(labValues);
  const highlights = new Map<string, LabHighlight>();

  for (const [key, candidate] of newestValues) {
    const diseaseRule = diseaseRuleFor(candidate.item, patientClinicalContext);
    const abnormal = reportedAbnormal(candidate.item.bewertung);
    if (!abnormal && !diseaseRule) continue;
    highlights.set(key, {
      item: candidate.item,
      direction: abnormal ? String(candidate.item.bewertung ?? "auffällig") : "Verlauf",
      significance: diseaseRule
        ? `${abnormal ? "Auffälliger Laborwert laut dokumentierter Bewertung." : "Aktuell nicht als pathologisch bewerteter, im dokumentierten Erkrankungs- oder Therapiekontext jedoch verlaufsrelevanter Laborwert."} ${diseaseRule.action}`
        : "Auffälliger Laborwert laut dokumentierter Bewertung; Datum, Einheit, Referenzbereich und Verlauf prüfen und die Abweichung je nach Ausmaß ärztlich bestätigen. Keine Diagnose oder Therapieänderung allein aus diesem Einzelwert ableiten.",
      derivedFromContext: !!diseaseRule,
      ruleId: diseaseRule?.id,
    });
  }

  const postProstatectomy = hasPostProstatectomyContext(patientClinicalContext);
  const treatedProstateCancer = postProstatectomy || hasTreatedProstateCancerContext(patientClinicalContext);
  if (!treatedProstateCancer) return Array.from(highlights.values());

  const psaValues = labValues
    .map((item, index) => ({ item, index, rank: dateRank(item.datum), measurement: parsePsaMeasurement(item.wert, item.einheit) }))
    .filter((entry) => isPsaParameter(entry.item.parameter) && entry.measurement !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index);

  if (psaValues.length) {
    const latest = psaValues[psaValues.length - 1];
    const previous = psaValues.length > 1 ? psaValues[psaValues.length - 2] : undefined;
    const latestMeasurement = latest.measurement!;
    const documentedRise = latestMeasurement.bound === "exact"
      && previous?.measurement !== null
      && previous?.measurement !== undefined
      && Number.isFinite(latest.rank)
      && Number.isFinite(previous.rank)
      && latest.rank > previous.rank
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
  }

  const androgenDeprivationPhase = getAndrogenDeprivationPhase(patientClinicalContext);
  if (androgenDeprivationPhase !== "none") {
    const testosteroneValues = labValues
      .map((item, index) => ({
        item,
        index,
        rank: dateRank(item.datum),
        measurement: testosteroneInNgDl(item.wert, item.einheit),
      }))
      .filter((entry) => isTotalTestosteroneParameter(entry.item.parameter) && entry.measurement !== null)
      .sort((a, b) => a.rank - b.rank || a.index - b.index);

    const latestTestosterone = testosteroneValues[testosteroneValues.length - 1];
    const previousTestosterone = latestTestosterone
      ? testosteroneValues.slice(0, -1).reverse().find((entry) => (
        entry.measurement !== null
        && Math.abs(entry.measurement.numeric - latestTestosterone.measurement!.numeric) > 0.0001
      ))
      : undefined;
    const comparableRise = latestTestosterone?.measurement?.bound === "exact"
      && previousTestosterone?.measurement !== null
      && previousTestosterone?.measurement !== undefined
      && Number.isFinite(latestTestosterone.rank)
      && Number.isFinite(previousTestosterone.rank)
      && latestTestosterone.rank > previousTestosterone.rank
      && previousTestosterone.measurement.bound !== "lower"
      && latestTestosterone.measurement.numeric > previousTestosterone.measurement.numeric;

    if (comparableRise) {
      highlights.set("testosterone", {
        item: latestTestosterone.item,
        direction: "Verlauf",
        significance: androgenDeprivationPhase === "paused_or_ended"
          ? "Dokumentierter Testosteron-Anstieg nach pausierter oder beendeter Androgenentzugs-/Hormontherapie des Prostatakarzinoms; zusammen mit PSA, Messzeitpunkten und Behandlungsstatus ärztlich beziehungsweise urologisch bewerten. Keine automatische Aussage über Erkrankungsaktivität."
          : androgenDeprivationPhase === "active"
            ? "Dokumentierter Testosteron-Anstieg bei als laufend erfasster Androgenentzugs-/Hormontherapie des Prostatakarzinoms; Messzeitpunkte, Therapiephase und Verlauf zusammen mit PSA zeitnah ärztlich beziehungsweise urologisch prüfen. Keine automatische Aussage über Erkrankungsaktivität."
            : "Dokumentierter Testosteron-Anstieg bei zugeordneter Androgenentzugs-/Hormontherapie des Prostatakarzinoms; Therapiephase und Messzeitpunkte sind nicht eindeutig und müssen zusammen mit PSA ärztlich beziehungsweise urologisch geklärt werden. Keine automatische Aussage über Erkrankungsaktivität.",
        derivedFromContext: true,
      });
    }
  }

  return Array.from(highlights.values());
};
