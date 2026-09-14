import { iaaCategories } from "./iaaQuestions";

export const iaaQuestionCatalog = iaaCategories.flatMap(category => category.questions.map(question => ({ ...question, category: category.titleDe, categoryId: category.id })));
const questionById = new Map(iaaQuestionCatalog.map((question, index) => [question.id, { ...question, index }]));
export type CheckedIAAQuestion = {
  id: string; question: string; category: string; rating: number | null;
  note: string; source: string; reviewNote: string; needsReview: boolean; order: number;
};

/** IAA answers live in the already versioned additional-anamnesis record. No empty answer becomes zero/No. */
export function checkedIAAQuestions(values: Record<string, string>): CheckedIAAQuestion[] {
  const result: CheckedIAAQuestion[] = [];
  for (const [key, stored] of Object.entries(values)) {
    if (!key.startsWith("iaa.")) continue;
    const id = key.slice(4); const raw = stored.trim();
    if (!/^\d+(?:\.\d+)*$/.test(id) || !raw || raw === "0" || raw === "false") continue;
    if (raw !== "checked" && !/^\d+(?:[.,]\d+)?$/.test(raw)) continue;
    const numeric = Number(raw.replace(",", "."));
    const rating = Number.isInteger(numeric) && numeric >= 1 && numeric <= 6 ? numeric : null;
    const known = questionById.get(id);
    result.push({ id, question: known?.textDe || values[`iaaQuestion.${id}`] || "Fragenwortlaut anhand des Originalbogens prüfen",
      category: known?.category || "Frage aus einer anderen IAA-Fassung", rating,
      note: values[`iaaNote.${id}`] || "", source: values[`iaaSource.${id}`] || "Quelle noch nicht dokumentiert",
      reviewNote: values[`iaaReview.${id}`] || (rating === null && raw !== "checked" ? `Ungültige Bewertung aus der Quelle: ${raw}` : ""),
      needsReview: rating === null || !known || !!values[`iaaReview.${id}`], order: known?.index ?? iaaQuestionCatalog.length + result.length });
  }
  return result.sort((left, right) => (right.rating ?? -1) - (left.rating ?? -1) || left.order - right.order);
}

export function setIAAAnswer(values: Record<string, string>, id: string, choice: string): Record<string, string> {
  if (!questionById.has(id) || !["", "checked", "1", "2", "3", "4", "5", "6"].includes(choice)) return values;
  const next = { ...values };
  if (choice) { next[`iaa.${id}`] = choice; next[`iaaSource.${id}`] = "Manuell aus dem IAA-Fragebogen erfasst / geprüft"; }
  else delete next[`iaa.${id}`];
  if (/^[1-6]$/.test(choice)) delete next[`iaaReview.${id}`];
  return next;
}

export function formatIAAAssessment(values: Record<string, string>): string {
  const entries = checkedIAAQuestions(values);
  const unselectedNotes = Object.entries(values).filter(([key, value]) => /^iaaNote\.\d+(?:\.\d+)*$/.test(key) && value.trim() && !entries.some(entry => key === `iaaNote.${entry.id}`));
  const manualReview = values.iaaReviewRequired === "true";
  const reviewConfirmed = values.iaaReviewConfirmedAt;
  if (!entries.length && !unselectedNotes.length && !manualReview && !reviewConfirmed) return "";
  return ["IAA – Individuelle Austestung und Analyse für Trikombin",
    manualReview ? "IAA-Markierungen aus mindestens einer Quelle sind noch manuell am Original zu prüfen; keine fehlenden Bewertungen ergänzen." : "",
    !manualReview && reviewConfirmed ? `IAA-Prüfung am Original manuell bestätigt: ${reviewConfirmed}` : "",
    entries.length ? "Angekreuzte Fragen, Bewertung absteigend 6–1:" : "Keine strukturiert angekreuzten Fragen erfasst.",
    ...entries.map(entry => `IAA ${entry.id}: ${entry.question}\nBewertung: ${entry.rating === null ? "offen – prüfen" : `${entry.rating}/6`}${entry.note ? `\nBemerkung / Auslöser: ${entry.note}` : ""}\nQuelle: ${entry.source}${entry.needsReview ? `\n${entry.reviewNote || "Zuordnung / Bewertung prüfen."}` : ""}`),
    ...unselectedNotes.map(([key, value]) => `Originalbemerkung zu IAA ${key.slice(8)} (${questionById.get(key.slice(8))?.textDe || values[`iaaQuestion.${key.slice(8)}`] || "Fragentext ungeklärt"}) – nicht als angekreuzte Frage oder Bewertung übernommen:\n${value}`),
  ].filter(Boolean).join("\n\n");
}

type IAAWidget = { fieldName?: unknown; fieldType?: unknown; fieldValue?: unknown; checkBox?: boolean; exportValue?: unknown };
export function escapeIAAFormMarkers(text: string): string {
  return text.replace(/\[(?=\/?IAA_(?:FORMULAR|ERFASSUNG)(?:[:\]]))/g, "［");
}
export function iaaCaptureStatusText(nativeFieldsFound: boolean, imageOnlyPageFound: boolean): string {
  return nativeFieldsFound && !imageOnlyPageFound ? "[IAA_ERFASSUNG:NATIVE_FELDER]" : "[IAA_ERFASSUNG:MANUELL_PRUEFEN]";
}
/** Read exact original form controls, never a printed numeric scale. Output passes through the existing text-redaction preview. */
export function iaaFormValuesText(widgets: IAAWidget[], pageNumber: number): string {
  const entries = new Map<string, { ratings: Set<number>; note: string }>();
  for (const widget of widgets) {
    if (typeof widget.fieldName !== "string") continue;
    const match = /^iaa_.+?_(\d+(?:_\d+)*)_(?:lvl([1-6])|(bem))$/.exec(widget.fieldName);
    if (!match) continue;
    const id = match[1].replace(/_/g, ".");
    const entry = entries.get(id) || { ratings: new Set<number>(), note: "" };
    if (match[2] && widget.fieldType === "Btn" && widget.checkBox === true
      && typeof widget.exportValue === "string" && widget.exportValue !== "Off" && widget.fieldValue === widget.exportValue) entry.ratings.add(Number(match[2]));
    if (match[3] && widget.fieldType === "Tx" && typeof widget.fieldValue === "string") entry.note = escapeIAAFormMarkers(widget.fieldValue.trim());
    entries.set(id, entry);
  }
  return [...entries].filter(([, entry]) => entry.ratings.size || entry.note).map(([id, entry]) =>
    `[IAA_FORMULAR:${id};SEITE:${pageNumber};MARKIERT:${[...entry.ratings].sort().join(",")}]\n${entry.note}\n[/IAA_FORMULAR]`).join("\n\n");
}

export function explicitIAAFields(text: string): Record<string, string> {
  let values: Record<string, string> = {};
  if (text.includes("[IAA_ERFASSUNG:MANUELL_PRUEFEN]")) values.iaaReviewRequired = "true";
  else if (text.includes("[IAA_ERFASSUNG:NATIVE_FELDER]")) values.iaaReviewRequired = "false";
  for (const match of text.matchAll(/\[IAA_FORMULAR:(\d+(?:\.\d+)*);SEITE:(\d+);MARKIERT:([1-6](?:,[1-6])*)?\]\n([\s\S]*?)\n\[\/IAA_FORMULAR\]/g)) {
    const id = match[1]; const ratings = [...new Set((match[3] || "").split(",").filter(Boolean))]; const note = match[4].trim();
    const incoming: Record<string, string> = { [`iaaSource.${id}`]: `Elektronische IAA-Formularfelder, Seite ${match[2]}` };
    if (ratings.length) incoming[`iaa.${id}`] = ratings.length === 1 ? ratings[0] : "checked";
    if (note) incoming[`iaaNote.${id}`] = note;
    if (ratings.length > 1) incoming[`iaaReview.${id}`] = `Mehrere Bewertungen angekreuzt: ${ratings.join(", ")}. Bitte am Original klären.`;
    values = mergeIAAFields(values, incoming);
  }
  return values;
}

export function mergeIAAFields(existing: Record<string, string>, incoming: Record<string, string>): Record<string, string> {
  const result = { ...existing };
  if (incoming.iaaReviewRequired === "true") result.iaaReviewRequired = "true";
  else if (incoming.iaaReviewRequired === "false" && result.iaaReviewRequired !== "true") result.iaaReviewRequired = "false";
  for (const [key, value] of Object.entries(incoming)) {
    if (!/^(?:iaa|iaaNote|iaaSource|iaaReview|iaaQuestion)\.\d+(?:\.\d+)*$/.test(key) || !value.trim()) continue;
    const previous = result[key];
    if (!previous || previous === value) { result[key] = value; continue; }
    if (key.startsWith("iaa.")) {
      result[key] = "checked";
      result[`iaaReview.${key.slice(4)}`] = [result[`iaaReview.${key.slice(4)}`], `Abweichende Angaben: ${previous} / ${value}. Bitte am Original klären.`].filter(Boolean).join("\n");
    } else if (!previous.split("\n").includes(value)) result[key] = `${previous}\n${value}`;
  }
  return result;
}
