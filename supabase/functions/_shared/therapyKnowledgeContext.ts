export const INFOTHEK_KNOWLEDGE_FILES = [
  "allergiebehandlung.html",
  "ass-salicylat-histamin.html",
  "candida-diaet.html",
  "dankbarkeit-alltag.html",
  "diabetes-handout.html",
  "ersttermin-naturheilpraxis.html",
  "krankheit-ist-messbar.html",
  "kraeuter-schmerz-entzuendung.html",
  "logi-ernaehrung-mitochondrien.html",
  "mitochondropathie-hws.html",
  "muedigkeit-erschoepfung-burnout.html",
  "parasiten-deutschland.html",
  "patienteninfo-hochohmiges-wasser.html",
  "sibo-duenndarmfehlbesiedlung.html",
  "therapieweg-uebersicht.html",
  "umwelt-alltag-gesundheit.html",
  "vieva-pro-vitalanalyse.html",
  "viren-bakterien-deutschland.html",
  "zapper-diamond-shield.html",
] as const;

export interface InfothekKnowledgeDocument {
  filename: string;
  title: string;
  text: string;
}

export interface SelectedInfothekDocument extends InfothekKnowledgeDocument {
  score: number;
  excerpt: string;
}

export interface StagingKnowledgeCandidate {
  id: string;
  kind: "source" | "entity" | "relation" | "dosage" | "safety";
  status: string;
  label: string;
  text: string;
  sourceLocator?: string;
  confidence?: number;
  proposedData?: unknown;
}

const decodeHtmlEntities = (value: string): string => value
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'");

export const normalizeTherapyKnowledgeSearchText = (value: string): string => value
  .toLocaleLowerCase("de")
  .replace(/ä/g, "ae")
  .replace(/ö/g, "oe")
  .replace(/ü/g, "ue")
  .replace(/ß/g, "ss")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "");

export function infothekHtmlToKnowledgeDocument(filename: string, html: string): InfothekKnowledgeDocument {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeHtmlEntities((titleMatch?.[1] || filename.replace(/\.html$/i, "").replace(/-/g, " ")).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  const text = decodeHtmlEntities(html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|main|aside|h[1-6]|li|tr|table|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { filename, title, text };
}

function countOccurrences(value: string, token: string): number {
  let count = 0;
  let offset = 0;
  while (count < 8) {
    const index = value.indexOf(token, offset);
    if (index < 0) break;
    count += 1;
    offset = index + token.length;
  }
  return count;
}

function relevantExcerpt(text: string, tokens: string[], maximum: number): string {
  const searchable = normalizeTherapyKnowledgeSearchText(text);
  const positions = tokens.flatMap((token) => {
    const normalizedToken = normalizeTherapyKnowledgeSearchText(token);
    const first = searchable.indexOf(normalizedToken);
    if (first < 0) return [];
    const second = searchable.indexOf(normalizedToken, first + normalizedToken.length);
    return second >= 0 ? [first, second] : [first];
  }).sort((left, right) => left - right);

  if (positions.length === 0) return text.slice(0, maximum).trim();
  const windows: string[] = [];
  let used = 0;
  for (const position of positions) {
    const start = Math.max(0, position - 450);
    const end = Math.min(text.length, position + 850);
    const part = text.slice(start, end).trim();
    if (!part || windows.some((window) => window.includes(part.slice(0, 120)))) continue;
    const remaining = maximum - used;
    if (remaining <= 0) break;
    windows.push(part.slice(0, remaining));
    used += Math.min(part.length, remaining) + 7;
  }
  return windows.join("\n[...]\n").slice(0, maximum).trim();
}

export function selectRelevantInfothekDocuments(
  documents: InfothekKnowledgeDocument[],
  queryTokens: string[],
  maximumDocuments = 4,
  maximumTotalCharacters = 12_000,
): SelectedInfothekDocument[] {
  const tokens = [...new Set(queryTokens.map(normalizeTherapyKnowledgeSearchText).filter((token) => token.length >= 4))];
  if (tokens.length === 0) return [];
  const scored = documents.map((document) => {
    const title = normalizeTherapyKnowledgeSearchText(document.title);
    const text = normalizeTherapyKnowledgeSearchText(document.text);
    const score = tokens.reduce((total, token) => total + (title.includes(token) ? 20 : 0) + countOccurrences(text, token), 0);
    return { document, score };
  }).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score || left.document.title.localeCompare(right.document.title, "de"));

  const selected: SelectedInfothekDocument[] = [];
  let used = 0;
  for (const { document, score } of scored) {
    if (selected.length >= maximumDocuments || used >= maximumTotalCharacters) break;
    const excerpt = relevantExcerpt(document.text, tokens, Math.min(3500, maximumTotalCharacters - used));
    if (!excerpt) continue;
    selected.push({ ...document, score, excerpt });
    used += excerpt.length;
  }
  return selected;
}

export function buildInfothekKnowledgeContext(documents: SelectedInfothekDocument[]): string {
  if (documents.length === 0) return "";
  return `ERGÄNZENDER INFOTHEK-KONTEXT (Praxis-HTML, keine alleinige Evidenz- oder Dosierungsquelle):\n${documents
    .map((document) => `\n[INFOTHEK:${document.filename}] ${document.title}\n[INFOTHEK-AUSZUG: Kontextauszug aus der Praxis-HTML; die vollstaendige Datei bleibt intern erhalten.]\n${document.excerpt}`)
    .join("\n")}`;
}

function stagingCandidateText(candidate: StagingKnowledgeCandidate): string {
  return [candidate.label, candidate.text, candidate.sourceLocator, stagingCandidateProposedData(candidate)].filter(Boolean).join("\n");
}

function stagingCandidateProposedData(candidate: StagingKnowledgeCandidate): string {
  try {
    return candidate.proposedData ? JSON.stringify(candidate.proposedData) : "";
  } catch {
    return "";
  }
}

const STAGING_CONTEXT_HEADER = "INTERNE IMPORT-PRÜFKANDIDATEN (vollständig intern erhalten, aber ungeprüft; nie alleinige Grundlage für Kernmittel, Dosierung oder Freigabe):";

function stagingCandidateBlock(candidate: StagingKnowledgeCandidate): string {
  const proposed = stagingCandidateProposedData(candidate);
  return `[UNREVIEWED_STAGING:${candidate.kind}:${candidate.id}] ${candidate.label}\nPruefstatus: ${candidate.status}${typeof candidate.confidence === "number" ? ` | Vertrauen: ${candidate.confidence}%` : ""}${candidate.sourceLocator ? `\nFundstelle: ${candidate.sourceLocator}` : ""}\n${candidate.text}${proposed ? `\nStrukturierte Originaldaten: ${proposed}` : ""}`;
}

export function selectRelevantStagingCandidates(
  candidates: StagingKnowledgeCandidate[],
  queryTokens: string[],
  maximumCandidates = 12,
  maximumTotalCharacters = 10_000,
): StagingKnowledgeCandidate[] {
  const tokens = [...new Set(queryTokens.map(normalizeTherapyKnowledgeSearchText).filter((token) => token.length >= 4))];
  if (tokens.length === 0) return [];
  const scored = candidates.map((candidate) => {
    const label = normalizeTherapyKnowledgeSearchText(candidate.label);
    const text = normalizeTherapyKnowledgeSearchText(stagingCandidateText(candidate));
    const score = tokens.reduce((total, token) => total + (label.includes(token) ? 20 : 0) + countOccurrences(text, token), 0);
    return { candidate, score };
  }).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score || left.candidate.label.localeCompare(right.candidate.label, "de"));

  const selected: StagingKnowledgeCandidate[] = [];
  let used = STAGING_CONTEXT_HEADER.length + 2;
  for (const { candidate } of scored) {
    if (selected.length >= maximumCandidates || used >= maximumTotalCharacters) break;
    const size = (selected.length > 0 ? 2 : 0) + stagingCandidateBlock(candidate).length;
    if (used + size > maximumTotalCharacters) continue;
    selected.push(candidate);
    used += size;
  }
  return selected;
}

export function buildStagingKnowledgeContext(candidates: StagingKnowledgeCandidate[], maximumTotalCharacters = 10_000): string {
  if (candidates.length === 0) return "";
  const blocks: string[] = [];
  let used = STAGING_CONTEXT_HEADER.length + 2;
  for (const candidate of candidates) {
    const block = stagingCandidateBlock(candidate);
    const additional = (blocks.length > 0 ? 2 : 0) + block.length;
    if (used + additional > maximumTotalCharacters) continue;
    blocks.push(block);
    used += additional;
  }
  return blocks.length > 0 ? `${STAGING_CONTEXT_HEADER}\n\n${blocks.join("\n\n")}` : "";
}
