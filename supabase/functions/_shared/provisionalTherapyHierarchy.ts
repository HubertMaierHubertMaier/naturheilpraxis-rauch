export type ProvisionalHierarchyLane =
  | "klinghardt"
  | "diamond_pathogen"
  | "nutramedix"
  | "vitaplace"
  | "heel"
  | "nutrition"
  | "vitamins"
  | "minerals"
  | "amino_acids";

export type ProvisionalHierarchyStatus =
  | "SAFETY_HOLD"
  | "REVIEW_ONLY"
  | "ELIGIBLE_FOR_CLINICAL_REVIEW";

export interface ProvisionalHierarchyEntry {
  id: string;
  title: string;
  category: string;
  tags?: string[];
  content?: string;
  entry_kind?: string;
  review_status?: string;
  evidence_level?: string;
  dosage_status?: string;
  source_citations?: Array<{ url?: string; label?: string }>;
  therapeutic_topics?: string[];
  contraindications?: string[];
  interaction_tags?: string[];
  safety_notes?: string;
  patient_facing_allowed?: boolean;
  commercial_claims_reviewed?: boolean;
}

export interface ProvisionalHierarchyCandidate<T extends ProvisionalHierarchyEntry = ProvisionalHierarchyEntry> {
  entry: T;
  rank: number;
  lane: ProvisionalHierarchyLane;
  laneLabel: string;
  status: ProvisionalHierarchyStatus;
  relevance: number;
  matches: string[];
  reasons: string[];
  sources: Array<{ url?: string; label?: string }>;
}

export interface ProvisionalHierarchyOptions {
  pregnancyStatus?: string;
  safetyContext?: string;
  age?: number;
  maxTotal?: number;
}

type LaneRule = {
  lane: ProvisionalHierarchyLane;
  label: string;
  limit: number;
};

const LANE_RULES: LaneRule[] = [
  { lane: "klinghardt", label: "Klinghardt", limit: 2 },
  { lane: "diamond_pathogen", label: "Diamond Shield: exakter Pathogen-Treffer", limit: 3 },
  { lane: "nutramedix", label: "NutraMedix", limit: 2 },
  { lane: "vitaplace", label: "VitaPlace", limit: 2 },
  { lane: "heel", label: "Heel/Homotoxikologie", limit: 3 },
  { lane: "nutrition", label: "Ernaehrung", limit: 2 },
  { lane: "vitamins", label: "Vitamine", limit: 2 },
  { lane: "minerals", label: "Mineralstoffe und Spurenelemente", limit: 2 },
  { lane: "amino_acids", label: "Aminosaeuren und Fettsaeuren", limit: 2 },
];

const STOPWORDS = new Set([
  "allgemein", "anwendung", "arztbericht", "behandlung", "befund", "befunde", "belastung",
  "belastungen", "diagnose", "dosierung", "empfehlung", "erkrankung", "erkrankungen", "evidenz",
  "hinweis", "hinweise", "intern", "labor", "medizin", "medizinisch", "mittel", "patient", "patienten",
  "quelle", "quellen", "sicherheit", "symptom", "symptome", "therapie", "therapeutisch", "untersuchung",
  "untersuchungen", "wirkung", "wurde", "werden", "sowie", "oder", "auch", "eine", "einer", "eines",
  "einem", "einen", "nicht", "keine", "keiner", "keines", "dieser", "diese", "dieses", "durch", "fuer",
  "unter", "ueber", "zwischen", "patientenkontext", "pruefen", "pruefung",
]);

const PATHOGEN_GROUPS: Array<{ label: string; stems: string[] }> = [
  { label: "Borrelien", stems: ["borreli"] },
  { label: "Bartonellen", stems: ["bartonell"] },
  { label: "Babesien", stems: ["babesi"] },
  { label: "Ehrlichien", stems: ["ehrlichi"] },
  { label: "Anaplasmen", stems: ["anaplasm"] },
  { label: "Rickettsien", stems: ["rickettsi"] },
  { label: "Candida", stems: ["candida", "albicans"] },
  { label: "Aspergillus", stems: ["asperg"] },
  { label: "Clostridien", stems: ["clostrid"] },
  { label: "Streptokokken", stems: ["streptoc", "streptok"] },
  { label: "Staphylokokken", stems: ["staphyloc", "staphylok"] },
  { label: "Helicobacter pylori", stems: ["helicobacter", "pylori"] },
  { label: "Klebsiellen", stems: ["klebsiell"] },
  { label: "Salmonellen", stems: ["salmonell"] },
  { label: "Yersinien", stems: ["yersini"] },
  { label: "Campylobacter", stems: ["campylobacter"] },
  { label: "Escherichia coli", stems: ["escherichia", "e coli"] },
  { label: "Enterokokken", stems: ["enterococ", "enterokok"] },
  { label: "Proteus", stems: ["proteus"] },
  { label: "Citrobacter", stems: ["citrobacter"] },
  { label: "Morganella", stems: ["morganella"] },
  { label: "Pseudomonas", stems: ["pseudomon"] },
  { label: "Nocardia", stems: ["nocardia"] },
  { label: "Fusobakterien", stems: ["fusobacter"] },
  { label: "Treponemen", stems: ["treponem"] },
  { label: "Actinomyces", stems: ["actinomy"] },
  { label: "Mykoplasmen", stems: ["mycoplasm", "mykoplasm"] },
  { label: "Chlamydien", stems: ["chlamydi"] },
  { label: "Ureaplasmen", stems: ["ureaplasm"] },
  { label: "Epstein-Barr-Virus", stems: ["epstein barr", "ebv"] },
  { label: "Cytomegalievirus", stems: ["cytomegal", "cmv"] },
  { label: "Herpes simplex", stems: ["herpes simplex", "hsv"] },
  { label: "Varizella-Zoster-Virus", stems: ["varizella zoster", "varicella zoster", "vzv", "zoster"] },
  { label: "HPV", stems: ["papillomavirus", "hpv"] },
  { label: "HIV", stems: ["hiv"] },
  { label: "Hepatitis-A-Virus", stems: ["hepatitis a", "hav"] },
  { label: "Hepatitis-B-Virus", stems: ["hepatitis b", "hbv"] },
  { label: "Hepatitis-C-Virus", stems: ["hepatitis c", "hcv"] },
  { label: "Influenza", stems: ["influenza"] },
  { label: "SARS-CoV-2", stems: ["sars cov", "covid", "corona"] },
  { label: "Coxsackievirus", stems: ["coxsackie"] },
  { label: "Adenovirus", stems: ["adenovirus"] },
  { label: "Parvovirus", stems: ["parvovirus"] },
  { label: "Giardien", stems: ["giardi"] },
  { label: "Cryptosporidien", stems: ["cryptospor"] },
  { label: "Blastocystis", stems: ["blastocyst"] },
  { label: "Entamoeba", stems: ["entamoeb"] },
  { label: "Dientamoeba", stems: ["dientamoeb"] },
  { label: "Trichomonaden", stems: ["trichomon"] },
  { label: "Askariden", stems: ["ascar", "askar"] },
  { label: "Strongyloides", stems: ["strongyloid"] },
  { label: "Toxoplasma", stems: ["toxoplasm"] },
  { label: "Leishmanien", stems: ["leishmani"] },
  { label: "Schistosomen", stems: ["schistosom"] },
  { label: "Echinokokken", stems: ["echinococ", "echinokok"] },
  { label: "Fasciola", stems: ["fasciol", "leberegel"] },
  { label: "Oxyuren", stems: ["oxyur", "madenwurm"] },
  { label: "Bandwuermer", stems: ["bandwurm", "taenia"] },
  { label: "Mucor", stems: ["mucor"] },
  { label: "Alternaria", stems: ["alternaria"] },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return Array.from(new Set(
    normalize(value)
      .split(/\s+/)
      .filter((token) => (token.length >= 4 || ["ebv", "cmv", "hiv", "hpv", "hsv", "vzv"].includes(token)) && !STOPWORDS.has(token)),
  ));
}

function entrySummary(entry: ProvisionalHierarchyEntry, includeContent = true): string {
  return [
    entry.title,
    entry.category,
    ...(entry.tags || []),
    ...(entry.therapeutic_topics || []),
    includeContent ? entry.content || "" : "",
  ].join(" ");
}

function classifyLane(entry: ProvisionalHierarchyEntry): ProvisionalHierarchyLane | null {
  const titleAndCategory = normalize(`${entry.title} ${entry.category} ${(entry.tags || []).join(" ")}`);

  if (titleAndCategory.includes("klinghardt")) return "klinghardt";
  const isChipCard = titleAndCategory.includes("chipcard") || titleAndCategory.includes("chip card");
  if (isChipCard && titleAndCategory.includes("diamond shield") && entry.entry_kind === "equipment") return "diamond_pathogen";
  if (titleAndCategory.includes("nutramedix")) return "nutramedix";
  if (titleAndCategory.includes("vitaplace")) return "vitaplace";
  if (titleAndCategory.includes("homotox") || titleAndCategory.includes("heel")) return "heel";
  if (/ernahrung|nutrition|diat|logi|lebensmittel/.test(titleAndCategory)) return "nutrition";
  if (/vitamin|ascorb|calcifer|cobalamin|folsaure/.test(titleAndCategory)) return "vitamins";
  if (/mineralstoff|spurenelement|magnesium|zink|selen|eisen|jod|kalium|calcium|kupfer|mangan|chrom/.test(titleAndCategory)) return "minerals";
  if (/aminosaur|fettsaure|omega|carnitin|taurin|lysin|cystein|glutamin|glycin|tryptophan|arginin|phenylalanin/.test(titleAndCategory)) return "amino_acids";
  return null;
}

function hasAffirmativeMention(normalizedText: string, rawStem: string, excludeHistorical: boolean): boolean {
  const stem = normalize(rawStem);
  let offset = 0;
  while (offset < normalizedText.length) {
    const index = normalizedText.indexOf(stem, offset);
    if (index === -1) return false;
    offset = index + stem.length;

    const precedingCharacter = normalizedText[index - 1] || " ";
    const followingCharacter = normalizedText[index + stem.length] || " ";
    if (stem.length <= 3 && (/[a-z0-9]/.test(precedingCharacter) || /[a-z0-9]/.test(followingCharacter))) continue;

    const before = normalizedText.slice(Math.max(0, index - 120), index);
    const after = normalizedText.slice(index + stem.length, index + stem.length + 120);
    const negatedBefore = /(?:kein|keine|keinen|ohne|negativ|ausgeschlossen|nicht)\s+(?:[a-z0-9]+\s+){0,10}$/.test(before);
    const negatedAfter = /^.{0,50}\b(?:ausgeschlossen|negativ|nicht nachweisbar|nicht nachgewiesen|konnte nicht nachgewiesen|nicht bestatigt|kein nachweis|kein erregernachweis|ohne nachweis|ohne befund)\b/.test(after);
    if (negatedBefore || negatedAfter) continue;

    if (excludeHistorical) {
      const historicalBefore = /(?:fruher|historisch|anamnestisch|zustand nach|status post|z n|ausgeheilt|abgeheilt|kindheit|vor\s+[a-z0-9]+\s+(?:jahr|jahren|monat|monaten))\s+(?:[a-z0-9]+\s+){0,8}$/.test(before);
      const historicalAfter = /^.{0,50}\b(?:fruher|historisch|anamnestisch|ausgeheilt|abgeheilt|kindheit|vollstandig behandelt|erfolgreich behandelt|vor\s+[a-z0-9]+\s+(?:jahr|jahren|monat|monaten))\b/.test(after);
      if (historicalBefore || historicalAfter) continue;
    }
    return true;
  }
  return false;
}

function findPathogenMatches(entry: ProvisionalHierarchyEntry, normalizedQuery: string, includeContent: boolean): string[] {
  const cardMetadata = normalize([
    entrySummary(entry, false),
    includeContent ? contentWithoutSafetySections(entry.content || "") : "",
  ].join(" "));
  return PATHOGEN_GROUPS
    .filter((group) =>
      group.stems.some((stem) => hasAffirmativeMention(normalizedQuery, stem, true)) &&
      group.stems.some((stem) => hasAffirmativeMention(cardMetadata, stem, false))
    )
    .map((group) => group.label);
}

function isSafetyLabel(line: string): boolean {
  const normalized = line
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/^\s*[-+*]\s+/, "")
    .replace(/[*_`]/g, "")
    .replace(/^[^A-Za-zÄÖÜäöüß]+/, "")
    .trim();
  return /^(?:kontraindikation(?:en)?|wechselwirkung(?:en)?|sicherheit(?:shinweis|shinweise)?|warnhinweis(?:e)?)\b/i.test(normalized)
    || /^(?:hinweise?|warnungen?).{0,40}\b(?:kontraindikation(?:en)?|wechselwirkung(?:en)?|sicherheit)\b/i.test(normalized);
}

export function hasUnstructuredSafetyContent(content: string): boolean {
  return content.split("\n").some(isSafetyLabel);
}

function contentWithoutSafetySections(content: string): string {
  const retained: string[] = [];
  let skipSection = false;
  for (const line of content.split("\n")) {
    if (/^#{1,6}\s+/.test(line)) {
      skipSection = isSafetyLabel(line);
      if (skipSection) continue;
    }
    if (isSafetyLabel(line)) {
      skipSection = true;
      continue;
    }
    if (skipSection) continue;
    retained.push(line);
  }
  return retained.join("\n");
}

function calculateRelevance(entry: ProvisionalHierarchyEntry, queryTokens: string[]): { score: number; matches: string[] } {
  if (!queryTokens.length) return { score: 0, matches: [] };

  const titleTokens = new Set(tokens(entry.title));
  const metadataTokens = new Set(tokens(`${entry.category} ${(entry.tags || []).join(" ")} ${(entry.therapeutic_topics || []).join(" ")}`));
  const contentTokens = new Set(tokens(contentWithoutSafetySections(entry.content || "")));
  const matches: string[] = [];
  let score = 0;

  for (const token of queryTokens) {
    if (titleTokens.has(token)) {
      score += 20;
      matches.push(token);
    } else if (metadataTokens.has(token)) {
      score += 10;
      matches.push(token);
    } else if (contentTokens.has(token)) {
      score += 2;
      matches.push(token);
    }
  }

  return { score, matches: Array.from(new Set(matches)).slice(0, 6) };
}

function hasPositivePregnancyStatus(value: string): boolean {
  const normalized = normalize(value);
  if (!normalized) return false;
  if (/nicht ausgeschlossen|moglich|unklar/.test(normalized)) return true;
  if (/keine schwangerschaft|nicht schwanger|schwangerschaft ausgeschlossen/.test(normalized)) return false;
  return !/^(nein|keine|nicht angegeben|ausgeschlossen|unbekannt)(\b|$)/.test(normalized);
}

function diamondSafetyHolds(options: ProvisionalHierarchyOptions): string[] {
  const holds: string[] = [];
  const context = normalize(options.safetyContext || "");
  if (hasPositivePregnancyStatus(options.pregnancyStatus || "")) holds.push("Schwangerschaft/Stillzeit");
  if (["herzschrittmacher", "pacemaker", "implantierter defibrillator", "defibrillator icd"].some((term) => hasAffirmativeMention(context, term, false))) {
    holds.push("Herzschrittmacher/implantierter Defibrillator");
  }
  if (["epilep", "krampfanfall"].some((term) => hasAffirmativeMention(context, term, false))) holds.push("Epilepsie/Krampfanfall");
  if (["schwere arrhythm", "ventrikulare tachy", "kammerflimmer"].some((term) => hasAffirmativeMention(context, term, false))) {
    holds.push("schwere Herzrhythmusstoerung");
  }
  return holds;
}

function validSources(entry: ProvisionalHierarchyEntry): Array<{ url?: string; label?: string }> {
  if (!Array.isArray(entry.source_citations)) return [];
  return entry.source_citations.flatMap((source) => {
    if (!source || typeof source !== "object") return [];
    const url = typeof source.url === "string" ? source.url.trim() : "";
    const label = typeof source.label === "string" ? source.label.trim() : "";
    return url || label ? [{ ...(url ? { url } : {}), ...(label ? { label } : {}) }] : [];
  });
}

function structuredSafetyMatches(entry: ProvisionalHierarchyEntry, normalizedSafetyContext: string): string[] {
  if (!normalizedSafetyContext) return [];
  const matches: string[] = [];
  const structuredTerms = [...(entry.contraindications || []), ...(entry.interaction_tags || [])];

  for (const term of structuredTerms) {
    const meaningfulTokens = tokens(term).filter((token) => token.length >= 4);
    if (meaningfulTokens.some((token) => hasAffirmativeMention(normalizedSafetyContext, token, false))) {
      matches.push(term);
    }
  }

  const normalizedSafetyNotes = normalize(entry.safety_notes || "");
  const knownSafetyTerms = [
    "schwanger", "stillzeit", "herzschrittmacher", "pacemaker", "defibrillator", "epilep",
    "krampfanfall", "arrhythm", "antikoagul", "blutverdunner", "immunsuppress", "niereninsuff",
    "leberinsuff", "allerg", "anaphyl",
  ];
  for (const term of knownSafetyTerms) {
    if (normalizedSafetyNotes.includes(term) && hasAffirmativeMention(normalizedSafetyContext, term, false)) {
      matches.push(`Sicherheitshinweis: ${term}`);
    }
  }

  return Array.from(new Set(matches));
}

function candidateStatus(
  entry: ProvisionalHierarchyEntry,
  lane: ProvisionalHierarchyLane,
  diamondHolds: string[],
  safetyMatches: string[],
): { status: ProvisionalHierarchyStatus; reasons: string[]; sources: Array<{ url?: string; label?: string }> } {
  const sources = validSources(entry);
  if (safetyMatches.length || (lane === "diamond_pathogen" && diamondHolds.length)) {
    return {
      status: "SAFETY_HOLD",
      reasons: [
        ...(safetyMatches.length ? [`Strukturierter Sicherheitsabgleich: ${safetyMatches.join(", ")}`] : []),
        ...(lane === "diamond_pathogen" && diamondHolds.length ? [`Diamond-Shield-Sicherheitsstopp: ${diamondHolds.join(", ")}`] : []),
      ],
      sources,
    };
  }

  const reasons: string[] = [];
  if (entry.review_status !== "reviewed") reasons.push(`Pruefstatus ${entry.review_status || "unreviewed"}`);
  if (!entry.evidence_level || entry.evidence_level === "unrated") reasons.push("Evidenz nicht bewertet");
  if (!sources.length) reasons.push("keine gueltige strukturierte Quelle");
  if (["product", "equipment"].includes(entry.entry_kind || "") && entry.commercial_claims_reviewed !== true) {
    reasons.push("Produktaussagen nicht geprueft");
  }
  if (!["verified", "not_applicable"].includes(entry.dosage_status || "")) reasons.push("Dosierung nicht verifiziert");
  if (entry.safety_notes?.trim()) reasons.push(`Sicherheitshinweis vorhanden: ${entry.safety_notes.trim().slice(0, 240)}`);
  if (hasUnstructuredSafetyContent(entry.content || "")) {
    reasons.push("Unstrukturierte Sicherheitsangaben im Inhalt manuell abgleichen");
  }

  return reasons.length
    ? { status: "REVIEW_ONLY", reasons, sources }
    : { status: "ELIGIBLE_FOR_CLINICAL_REVIEW", reasons: ["Metadaten geprueft; individuelle Sicherheitspruefung bleibt erforderlich"], sources };
}

export function buildProvisionalTherapyHierarchy<T extends ProvisionalHierarchyEntry>(
  entries: T[],
  clinicalQueryText: string,
  options: ProvisionalHierarchyOptions = {},
): ProvisionalHierarchyCandidate<T>[] {
  const diamondHolds = diamondSafetyHolds(options);
  const normalizedQuery = normalize(clinicalQueryText);
  const queryTokens = tokens(clinicalQueryText);
  const normalizedSafetyContext = normalize([
    options.safetyContext || "",
    hasPositivePregnancyStatus(options.pregnancyStatus || "") ? "schwanger schwangerschaft stillen stillzeit" : "",
    typeof options.age === "number" && Number.isFinite(options.age) && options.age < 18
      ? `kind kinder jugendlich alter ${options.age} jahre`
      : "",
  ].join(" "));
  const buckets = new Map<ProvisionalHierarchyLane, ProvisionalHierarchyCandidate<T>[]>();

  for (const entry of entries) {
    const lane = classifyLane(entry);
    if (!lane || entry.review_status === "restricted") continue;

    const relevance = calculateRelevance(entry, queryTokens);
    const pathogenMatches = findPathogenMatches(entry, normalizedQuery, lane !== "diamond_pathogen");
    const rule = LANE_RULES.find((candidate) => candidate.lane === lane)!;
    const status = candidateStatus(entry, lane, diamondHolds, structuredSafetyMatches(entry, normalizedSafetyContext));
    if (status.status !== "SAFETY_HOLD") {
      if (lane === "diamond_pathogen" && pathogenMatches.length === 0) continue;
      if (lane !== "diamond_pathogen" && relevance.score === 0 && pathogenMatches.length === 0) continue;
    }
    const candidate: ProvisionalHierarchyCandidate<T> = {
      entry,
      rank: 0,
      lane,
      laneLabel: rule.label,
      status: status.status,
      relevance: relevance.score + pathogenMatches.length * 100,
      matches: pathogenMatches.length ? pathogenMatches : relevance.matches,
      reasons: [
        ...(pathogenMatches.length ? [`Expliziter Pathogen-Treffer: ${pathogenMatches.join(", ")}`] : []),
        ...status.reasons,
      ],
      sources: status.sources,
    };
    const laneCandidates = buckets.get(lane) || [];
    laneCandidates.push(candidate);
    buckets.set(lane, laneCandidates);
  }

  for (const candidates of buckets.values()) {
    candidates.sort((left, right) =>
      right.relevance - left.relevance || left.entry.title.localeCompare(right.entry.title, "de")
    );
  }

  const safetyHolds = Array.from(buckets.values())
    .flat()
    .filter((candidate) => candidate.status === "SAFETY_HOLD")
    .sort((left, right) => {
      const laneDifference = LANE_RULES.findIndex((rule) => rule.lane === left.lane) - LANE_RULES.findIndex((rule) => rule.lane === right.lane);
      return laneDifference || right.relevance - left.relevance || left.entry.title.localeCompare(right.entry.title, "de");
    });
  const activeBuckets = new Map<ProvisionalHierarchyLane, ProvisionalHierarchyCandidate<T>[]>(
    Array.from(buckets.entries()).map(([lane, candidates]) => [
      lane,
      candidates.filter((candidate) => candidate.status !== "SAFETY_HOLD"),
    ] as const),
  );

  const selected: ProvisionalHierarchyCandidate<T>[] = [];
  const maxTotal = Math.max(1, options.maxTotal ?? 14);
  let depth = 0;
  let foundAtDepth = true;
  while (selected.length < maxTotal && foundAtDepth) {
    foundAtDepth = false;
    for (const rule of LANE_RULES) {
      const candidate = activeBuckets.get(rule.lane)?.[depth];
      if (!candidate || depth >= rule.limit) continue;
      selected.push(candidate);
      foundAtDepth = true;
      if (selected.length >= maxTotal) break;
    }
    depth += 1;
  }

  selected.sort((left, right) => {
    const laneDifference = LANE_RULES.findIndex((rule) => rule.lane === left.lane) - LANE_RULES.findIndex((rule) => rule.lane === right.lane);
    return laneDifference || right.relevance - left.relevance || left.entry.title.localeCompare(right.entry.title, "de");
  });
  return [
    ...selected.map((candidate, index) => ({ ...candidate, rank: index + 1 })),
    ...safetyHolds.map((candidate, index) => ({ ...candidate, rank: index + 1 })),
  ];
}

export function selectProvisionalHierarchyContext<T extends ProvisionalHierarchyEntry>(
  candidates: ProvisionalHierarchyCandidate<T>[],
  maxEntries = 8,
): ProvisionalHierarchyCandidate<T>[] {
  const selected: ProvisionalHierarchyCandidate<T>[] = [];
  for (const rule of LANE_RULES) {
    const first = candidates.find((candidate) => candidate.lane === rule.lane);
    if (first) selected.push(first);
    if (selected.length >= maxEntries) return selected;
  }
  const extraLaneOrder: ProvisionalHierarchyLane[] = [
    "diamond_pathogen",
    "klinghardt",
    "nutramedix",
    "vitaplace",
    "heel",
    "nutrition",
    "vitamins",
    "minerals",
    "amino_acids",
  ];
  for (const lane of extraLaneOrder) {
    for (const candidate of candidates.filter((item) => item.lane === lane)) {
      if (selected.includes(candidate)) continue;
      selected.push(candidate);
      if (selected.length >= maxEntries) return selected;
    }
  }
  return selected;
}

export function formatProvisionalTherapyHierarchy(
  candidates: ProvisionalHierarchyCandidate[],
): string {
  if (!candidates.length) return "Keine ausreichend passenden Kandidaten fuer die vorlaeufige Praxis-Hierarchie gefunden.";
  const bounded = (value: string, max: number) => value.length > max ? `${value.slice(0, max - 3)}...` : value;
  return candidates.map((candidate) => {
    const sources = candidate.sources.length
      ? candidate.sources.slice(0, 3).map((source) => bounded([source.label, source.url].filter(Boolean).join(" - "), 300)).join("; ")
      : "keine gueltige strukturierte Quelle";
    return [
      `${candidate.rank}. [${candidate.laneLabel}] ${bounded(candidate.entry.title, 180)}`,
      `Status: ${candidate.status}; Relevanz: ${candidate.relevance}; Treffer: ${bounded(candidate.matches.join(", ") || "kein spezifischer Begriff", 240)}`,
      `Wiki-ID: ${candidate.entry.id}; Review: ${candidate.entry.review_status || "unreviewed"}; Evidenz: ${candidate.entry.evidence_level || "unrated"}; Dosierung: ${candidate.entry.dosage_status || "unverified"}`,
      `Quellen: ${sources}`,
      `Hinweise: ${bounded(candidate.reasons.join("; "), 500)}`,
    ].join(" | ");
  }).join("\n");
}
