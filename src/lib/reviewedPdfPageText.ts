import { ManualPdfTextBindingError } from "./manualPdfTextRedaction";

type PageSpan = { page: number; start: number; end: number; body: string };

function pageSpans(text: string, requireEveryPage: boolean): PageSpan[] {
  const matches = [...text.matchAll(/^--- Seite (\d+) ---[ \t]*$/gm)];
  const spans = matches.map((match, index) => ({
    page: Number(match[1]),
    start: match.index!,
    end: matches[index + 1]?.index ?? text.length,
    body: text.slice(match.index! + match[0].length, matches[index + 1]?.index ?? text.length),
  }));
  if (!spans.length || spans.some((span, index) => !Number.isInteger(span.page) || span.page < 1
    || (requireEveryPage ? span.page !== index + 1 : index > 0 && span.page <= spans[index - 1].page))) {
    throw new ManualPdfTextBindingError("MANUAL_TEXT_PAGE", 1, "Die Seiten der anonymisierten Bildkopie sind nicht eindeutig zugeordnet.");
  }
  return spans;
}

/** Uses only re-read pixels from the reviewed archive copy on manually masked pages. */
export function replaceReviewedPdfPageText(originalText: string, reviewedCopyText: string, maskedPages: readonly number[]): string {
  if (!maskedPages.length) return originalText;
  const hadIaaCaptureStatus = /\[IAA_ERFASSUNG:(?:NATIVE_FELDER|MANUELL_PRUEFEN)\]/.test(originalText);
  const original = pageSpans(originalText, true);
  const copy = pageSpans(reviewedCopyText, false);
  const selected = new Set(maskedPages);
  if (selected.size !== maskedPages.length || [...selected].some(page => !Number.isInteger(page) || page < 1 || page > original.length)) {
    throw new ManualPdfTextBindingError("MANUAL_TEXT_PAGE", maskedPages[0], "Manuell geschwärzte Seiten passen nicht zur anonymisierten Bildkopie.");
  }
  const reviewedByPage = new Map(copy.map(span => [span.page, span]));
  if ([...selected].some(page => !reviewedByPage.has(page))) {
    throw new ManualPdfTextBindingError("MANUAL_TEXT_PAGE", maskedPages[0], "Eine nachgeschwärzte Seite fehlt im erneut ausgelesenen Text.");
  }
  let result = originalText;
  for (const span of [...original].reverse()) {
    if (!selected.has(span.page)) continue;
    const reviewNotes = [`Nachgeschwärzte Seite ${span.page} aus der Bildkopie erneut erkannt – Angaben und Markierungen auf Vollständigkeit am Original prüfen.`];
    for (const match of span.body.matchAll(/\[IAA_FORMULAR:(\d+(?:\.\d+)*);SEITE:(\d+);MARKIERT:[1-6,]*\]/g)) {
      if (Number(match[2]) === span.page) {
        reviewNotes.push(`IAA-Frage ${match[1]} auf Seite ${span.page} nach Schwärzung erneut am Original erfassen – keine Bewertung automatisch übernommen.`);
      }
    }
    const reviewed = reviewedByPage.get(span.page)!;
    const clinicalBody = reviewed.body.replace(/\[IAA_ERFASSUNG:(?:NATIVE_FELDER|MANUELL_PRUEFEN)\]/g, "").trim();
    if (!clinicalBody || clinicalBody.length < 12) {
      throw new ManualPdfTextBindingError("MANUAL_TEXT_PAGE", span.page, "Die nachgeschwärzte Bildseite konnte nicht ausreichend ausgelesen werden.");
    }
    result = result.slice(0, span.start)
      + reviewedCopyText.slice(reviewed.start, reviewed.end).trimEnd()
      + `\n\n${reviewNotes.join("\n")}\n\n`
      + result.slice(span.end);
  }
  // The raster copy has no native form controls. Any fields from a replaced page
  // need confirmation at the original before their answers can be used.
  result = result.replace(/\[IAA_ERFASSUNG:(?:NATIVE_FELDER|MANUELL_PRUEFEN)\]/g, "").trimEnd();
  if (hadIaaCaptureStatus) result += "\n\n[IAA_ERFASSUNG:MANUELL_PRUEFEN]";
  return result;
}
