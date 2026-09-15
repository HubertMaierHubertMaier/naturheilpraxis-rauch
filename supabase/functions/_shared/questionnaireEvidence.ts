const normalized = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();
const questionnaireMarker = /Anamnesebogen|Lokale Anamnese-Auswertung|Frage\/Feld:|elektronisches Formularfeld|keine sichere Frage-Antwort-Zuordnung|Unbestätigte Formular|IAA_FORMULAR:|IAA_ERFASSUNG:|IAA\s+\d+(?:\.\d+)+\s*:/i;
const unreviewedLine = /Manuell pruefen\s*\(|keine sichere Frage-Antwort-Zuordnung|Formularhinweis\s*\(|Unbestätigte Formular/i;
const ambiguousSelection = /\[[^\]\r\n]{0,6}\]|[□☐☑☒]|\b(?:[oO0]{3,}[oOgGdDnN]*|[aA]{3,})\b|\?\s*(?:N(?:\]|!)?|EN!)(?:\s|$)/;
const printedLabel = /^(?:Frage\/Feld:|Bereich im Anamnesebogen:|---|===|OCR-Warnung:|Pruefstatus:)/i;
const declaredRatings = (text: string) => [...text.matchAll(/\b(?:Bewertung|Rating)\s*:?\s*(\d+)\b(?!\s*(?:\/|von)\s*(?:10|100)\b)|\b(?:St[aä]rke|Skala)\s*:?\s*(\d+)\s*\/\s*6\b/gi)].map(match => Number(match[1] || match[2]));
const invalidSixPointRating = (text: string) => [...text.matchAll(/\b(?:Bewertung|Rating|St[aä]rke|Skala)\s*:?\s*(\d+)\s*\/\s*6\b/gi)].some(match => Number(match[1]) < 1 || Number(match[1]) > 6);
const declaredQuestion = (text: string) => text.match(/\bIAA\s+(\d+(?:\.\d+)+)\b/i)?.[1];

/** Literal template text is not evidence that a patient selected an option. */
export const isQuestionnaireSource = (text: string) => questionnaireMarker.test(text);

export function createQuestionnaireEvidenceValidator(sourceText: string): (quotation: string, claimText?: string) => boolean {
  if (!isQuestionnaireSource(sourceText)) return () => false;
  const texts = sourceText.split(/\r?\n/).map(normalized).filter(Boolean);
  const nativeLines = new Map<number, { id: string; rating: number }>();
  let nativeStart = -1;
  let nativeBinding = { id: "", rating: 0 };
  for (let index = 0; index < texts.length; index++) {
    if (texts[index].startsWith("[IAA_FORMULAR:")) {
      const match = texts[index].match(/^\[IAA_FORMULAR:(\d+(?:\.\d+)*);SEITE:\d+;MARKIERT:([1-6])\]$/);
      nativeStart = match ? index : -1;
      if (match) nativeBinding = { id: match[1], rating: Number(match[2]) };
    }
    if (texts[index] === "[/IAA_FORMULAR]") {
      if (nativeStart >= 0) for (let line = nativeStart; line <= index; line++) nativeLines.set(line, nativeBinding);
      nativeStart = -1;
    }
  }
  let position = 0;
  const lines = texts.map((text, index) => {
    const start = position; position += text.length + 1;
    // Only a complete, single-valued native IAA block confers a confirmed mark.
    // Raw OCR marks (including X-shaped noise) retain their manual-review status.
    const native = nativeLines.get(index);
    const ratings = declaredRatings(text); const question = declaredQuestion(text);
    const conflict = !!native && (ratings.some(rating => rating !== native.rating) || (!!question && question !== native.id));
    const selectionText = native && !conflict && ratings.length > 0 ? text.replace(/\[(?:x|✓|☑|☒)\]|[☑☒]/gi, "") : text;
    return { text, start, end: position - 1, unconfirmed: conflict || invalidSixPointRating(text) || unreviewedLine.test(text) || ambiguousSelection.test(selectionText), label: printedLabel.test(text), ratings: [...ratings, ...(native && text.startsWith("[IAA_FORMULAR:") ? [native.rating] : [])], question: question || native?.id };
  });
  const fullText = lines.map(line => line.text).join(" ");
  const cache = new Map<string, boolean>();
  return (quotation, claimText = "") => {
    const quote = normalized(quotation);
    if (!quote) return true;
    const cacheKey = JSON.stringify([quote, claimText]);
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;
    const claimRatings = declaredRatings(claimText); const claimQuestion = declaredQuestion(claimText);
    let found = false;
    for (let offset = fullText.indexOf(quote); offset >= 0; offset = fullText.indexOf(quote, offset + 1)) {
      let low = 0; let high = lines.length;
      while (low < high) { const mid = (low + high) >>> 1; if (lines[mid].end <= offset) low = mid + 1; else high = mid; }
      const first = low;
      let unconfirmed = first >= lines.length || (lines[first].label && !quote.includes("Erkannte Antwort:"));
      const ratings = new Set<number>(); const questions = new Set<string>();
      for (let index = first; !unconfirmed && index < lines.length && lines[index].start < offset + quote.length; index++) {
        unconfirmed ||= lines[index].unconfirmed;
        lines[index].ratings.forEach(rating => ratings.add(rating));
        if (lines[index].question) questions.add(lines[index].question!);
      }
      unconfirmed ||= claimRatings.some(rating => !ratings.has(rating)) || (!!claimQuestion && !questions.has(claimQuestion));
      if (unconfirmed) { cache.set(cacheKey, true); return true; }
      found = true;
    }
    cache.set(cacheKey, !found); return !found;
  };
}

export function isUnconfirmedQuestionnaireEvidence(sourceText: string, quotation: string): boolean {
  return createQuestionnaireEvidenceValidator(sourceText)(quotation);
}

export function hasUnconfirmedFormStatements(partials: readonly Record<string, any>[]): boolean {
  return partials.some(partial => Array.isArray(partial.openQuestions)
    && partial.openQuestions.some((item: any) => item?.sourceAssertionStatus === "unconfirmed_form"));
}

export function assertQuestionnaireValidationContract(partial: Record<string, any>, sourceText: string): void {
  if (isQuestionnaireSource(sourceText) && partial.source_coverage_v1?.answerValidationVersion !== 1) {
    throw new Error("Die serverseitige Formular-Antwort-Prüfung ist noch nicht bereitgestellt. Bitte den Analyse-Dienst aktualisieren.");
  }
}
