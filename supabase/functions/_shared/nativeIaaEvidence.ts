import { iaaCategories } from "./iaaQuestions.ts";

const questions = new Map(iaaCategories.flatMap(category => category.questions).map((question, index) => [question.id, { ...question, index }]));
const record = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
const normalized = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();

function canonicalAnswer(item: Record<string, any>): Record<string, any> | null {
  const evidence = record(item.beleg);
  if (evidence.quoteMatched === false || (evidence.pruefstatus && evidence.pruefstatus !== "quellenzitat_bestaetigt")) return null;
  if (evidence.quoteMatched !== true && evidence.pruefstatus !== "quellenzitat_bestaetigt") return null;
  const quote = typeof evidence.zitat === "string" ? evidence.zitat : "";
  const native = [...quote.matchAll(/\[IAA_FORMULAR:(\d+(?:\.\d+)*);SEITE:(\d+);MARKIERT:([1-6])\]/g)];
  let id = ""; let rating = 0; let note = ""; let page = String(evidence.seite || "");
  if (native.length === 1) {
    id = native[0][1]; rating = Number(native[0][3]); page = native[0][2];
    note = quote.slice((native[0].index || 0) + native[0][0].length).split("[/IAA_FORMULAR]")[0].trim();
  } else if (!native.length) {
    const matches = [...quote.matchAll(/IAA\s+(\d+(?:\.\d+)+):\s*([^\n]+?)\s+Bewertung:\s*([1-6])\/6\b/gi)];
    if (matches.length !== 1) return null;
    const question = questions.get(matches[0][1]);
    if (!question || normalized(matches[0][2]) !== normalized(question.textDe)) return null;
    id = question.id; rating = Number(matches[0][3]);
    note = quote.slice((matches[0].index || 0) + matches[0][0].length).replace(/^\s*Bemerkung\s*\/\s*Auslöser:\s*/i, "").trim();
  } else return null;
  const question = questions.get(id);
  if (!question) return null;
  return {
    sourceKind: "canonical_iaa_answer", iaaQuestionId: id, iaaRating: rating,
    iaaQuestion: question.textDe, iaaNote: note,
    text: `IAA ${id}: ${question.textDe} Bewertung: ${rating}/6${note ? ` · Bemerkung aus der Quelle: ${note}` : ""}`,
    beleg: { ...evidence, seite: page, pruefstatus: "quellenzitat_bestaetigt", quoteMatched: true },
    ...(Array.isArray(item.belege) ? { belege: item.belege } : {}),
  };
}

export function nativeIaaSourceFacts(sourceText: string, sourceLabel: string, sourceId: string, part: string): Record<string, any>[] {
  return [...sourceText.matchAll(/\[IAA_FORMULAR:(\d+(?:\.\d+)*);SEITE:(\d+);MARKIERT:([1-6])\]\n[\s\S]*?\n\[\/IAA_FORMULAR\]/g)]
    .filter(match => (match[0].match(/\[IAA_FORMULAR:/g) || []).length === 1)
    .map(match => canonicalAnswer({ beleg: { quelle: sourceLabel, sourceId, teil: part, seite: match[2], zitat: match[0], pruefstatus: "quellenzitat_bestaetigt", quoteMatched: true } }))
    .filter((item): item is Record<string, any> => item !== null);
}

/** Bind cited IAA values to the canonical question, never to an invented model label. */
export function normalizeNativeIaaClaims(value: Record<string, any>): Record<string, any> {
  const source = structuredClone(value);
  const canonical: Record<string, any>[] = [];
  const reviews: Record<string, any>[] = [];
  const inspect = (raw: unknown, collection: string) => {
    const item = record(raw); const answer = canonicalAnswer(item);
    if (!answer) return raw;
    canonical.push(answer);
    const sameCanonical = Object.keys(item).every(key => Object.prototype.hasOwnProperty.call(answer, key))
      && Object.keys(answer).filter(key => key !== "beleg").every(key => item[key] === answer[key]);
    if (!sameCanonical) {
      reviews.push({ text: `IAA ${answer.iaaQuestionId}: Modellformulierung durch den ursprünglichen Fragenwortlaut ersetzt; keine zusätzlichen Beschwerden daraus ableiten.`,
        sourceAssertionStatus: "unconfirmed_form", originalCollection: collection,
        beleg: answer.beleg, unconfirmedSourceStatement: item });
    }
    return null;
  };
  for (const key of ["documents", "diagnoses", "medicationsTherapies", "labValues", "findings", "redFlags", "systemsPatterns"]) {
    if (Array.isArray(source[key])) source[key] = source[key].map((item: unknown) => inspect(item, key)).filter(Boolean);
  }
  const anamnesis = record(source.anamnese);
  for (const key of Object.keys(anamnesis)) if (Array.isArray(anamnesis[key])) anamnesis[key] = anamnesis[key].map((item: unknown) => inspect(item, key)).filter(Boolean);
  source.anamnese = anamnesis;
  const unique = new Map<string, Record<string, any>>();
  for (const item of canonical) {
    const key = JSON.stringify([item.iaaQuestionId, item.iaaRating, item.iaaNote, item.beleg.sourceId, item.beleg.seite]);
    if (!unique.has(key)) unique.set(key, item);
  }
  source.findings = [...(source.findings || []), ...unique.values()];
  source.openQuestions = [...(source.openQuestions || []), ...reviews];
  return source;
}

export function renderCanonicalIaaSection(items: readonly unknown[], escape: (value: unknown) => string, evidenceText: (value: unknown) => string): string {
  const entries = items.map(record).filter(item => item.sourceKind === "canonical_iaa_answer")
    .map(canonicalAnswer).filter((item): item is Record<string, any> => item !== null);
  if (!entries.length) return "";
  const sorted = [...entries].sort((a, b) => b.iaaRating - a.iaaRating || questions.get(a.iaaQuestionId)!.index - questions.get(b.iaaQuestionId)!.index);
  const rows = sorted.map(item => `<tr><td>${escape(item.iaaQuestionId)}</td><td>${escape(questions.get(item.iaaQuestionId)!.textDe)}</td><td>${escape(item.iaaRating)}/6</td><td>${escape(item.iaaNote || "")}</td><td>${escape(evidenceText(item))}</td></tr>`).join("");
  return `<h2>3a. IAA – erfasste Fragen und Bewertungen</h2><p>Fragenwortlaut aus dem verbindlichen Katalog; Bewertung aus der belegten Erfassung. Absteigend 6 bis 1. Keine Umdeutung in andere Beschwerden oder Diagnosen.</p><table><thead><tr><th>Frage</th><th>Wortlaut</th><th>Bewertung</th><th>Originalbemerkung</th><th>Quelle</th></tr></thead><tbody>${rows}</tbody></table>`;
}
