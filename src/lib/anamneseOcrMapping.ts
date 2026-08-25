import { formSections } from "@/lib/anamneseFormData";

export const ANAMNESE_OCR_LOW_CONFIDENCE_THRESHOLD = 80;

export type AnamneseOcrPageConfidence = {
  pageNumber: number;
  confidence: number;
};

export type AnamneseQuestionReview = {
  text: string;
  mappedAnswerCount: number;
  manualReviewCount: number;
  lowConfidencePages: number[];
};

const normalizeForComparison = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/^[ivxlcdm]+\.?\s*/i, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const sectionTitles = formSections
  .filter((section) => section.id !== "intro")
  .map((section) => ({
    title: section.titleDe,
    normalized: normalizeForComparison(section.titleDe),
  }));

const sectionAliases = [
  "II. Familiengeschichte",
  "XII. Unfälle & Operationen",
  "XIV. Allergien & Unverträglichkeiten",
  "XVIII. Umweltbelastungen",
  "XXII. Behandlungspräferenzen",
  "XXIV. IAA – Individuelle Austestung und Analyse",
].map((title) => ({ title, normalized: normalizeForComparison(title) }));

const ignoredFormLines = new Set([
  "anamnesebogen",
  "medical history form",
  "keine angaben",
  "no information provided",
]);

const findSectionTitle = (line: string): string | undefined => {
  const normalized = normalizeForComparison(line);
  if (!normalized) return undefined;
  return [...sectionTitles, ...sectionAliases].find((section) => normalized === section.normalized)?.title;
};

const pageMarkerPattern = /^---\s*Seite\s+(\d+)\s*---$/i;
const documentMarkerPattern = /^===\s*.+\s*===$/;

export function buildAnamneseQuestionReview(
  input: string,
  pageConfidences: readonly AnamneseOcrPageConfidence[] = [],
): AnamneseQuestionReview {
  const confidenceByPage = new Map(pageConfidences.map((entry) => [entry.pageNumber, entry.confidence]));
  const lowConfidencePages = pageConfidences
    .filter((entry) => entry.confidence < ANAMNESE_OCR_LOW_CONFIDENCE_THRESHOLD)
    .map((entry) => entry.pageNumber)
    .sort((left, right) => left - right);
  const body: string[] = [];
  let mappedAnswerCount = 0;
  let manualReviewCount = 0;
  let currentPage = 0;
  let currentSection = "Nicht eindeutig erkannt";

  for (const rawLine of input.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.replace(/[\t\f\v ]+/g, " ").trim();
    if (!line) continue;

    const pageMatch = line.match(pageMarkerPattern);
    if (pageMatch) {
      currentPage = Number(pageMatch[1]);
      currentSection = "Nicht eindeutig erkannt";
      const confidence = confidenceByPage.get(currentPage);
      const quality = confidence === undefined
        ? "digitale Textebene oder keine OCR-Qualitaetsangabe"
        : `lokale OCR-Sicherheit ${Math.round(confidence)} %${confidence < ANAMNESE_OCR_LOW_CONFIDENCE_THRESHOLD ? " - besonders sorgfaeltig pruefen" : ""}`;
      body.push("", `--- Seite ${currentPage} | ${quality} ---`);
      continue;
    }

    if (documentMarkerPattern.test(line)) {
      body.push(line);
      continue;
    }

    const sectionTitle = findSectionTitle(line);
    if (sectionTitle) {
      currentSection = sectionTitle;
      body.push("", `Bereich im Anamnesebogen: ${sectionTitle}`);
      continue;
    }

    const normalized = normalizeForComparison(line);
    if (ignoredFormLines.has(normalized) || /^seite\s+\d+\s+(?:von|\/|of)\s+\d+$/i.test(line)) continue;

    const pair = line.match(/^(.{2,120}?):\s*(.+)$/);
    if (pair && /\p{L}/u.test(pair[1]) && pair[2].trim() && pair[2].trim() !== "-") {
      mappedAnswerCount += 1;
      body.push(
        `Frage/Feld: ${pair[1].trim()}`,
        `Erkannte Antwort: ${pair[2].trim()}`,
        `Zuordnung: ${currentSection}, Seite ${currentPage || "nicht erkannt"}`,
        "Pruefstatus: manuell bestaetigen",
      );
      continue;
    }

    manualReviewCount += 1;
    body.push(`Manuell pruefen (keine sichere Frage-Antwort-Zuordnung, ${currentSection}, Seite ${currentPage || "nicht erkannt"}): ${line}`);
  }

  const header = [
    "=== Lokale Anamnese-Auswertung zur manuellen Pruefung ===",
    "Handschrift und Markierungen werden nur lokal gelesen. Unleserliche Inhalte werden nicht geraten.",
    `Automatisch als Frage und Antwort erkannte Zeilen: ${mappedAnswerCount}`,
    `Nicht sicher zugeordnete Zeilen: ${manualReviewCount}`,
    lowConfidencePages.length
      ? `OCR-Warnung: Seite(n) ${lowConfidencePages.join(", ")} liegen unter ${ANAMNESE_OCR_LOW_CONFIDENCE_THRESHOLD} % und muessen besonders sorgfaeltig geprueft werden.`
      : "OCR-Warnung: keine Seite mit gemeldeter niedriger OCR-Sicherheit.",
    "Vor der Uebernahme jede Antwort, Markierung und Schwaerzung in der sichtbaren Vorschau kontrollieren.",
  ];

  return {
    text: [...header, ...body].join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    mappedAnswerCount,
    manualReviewCount,
    lowConfidencePages,
  };
}
