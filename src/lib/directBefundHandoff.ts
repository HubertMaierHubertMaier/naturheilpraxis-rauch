import { addAnalysisDocumentMetadata } from "@/lib/patientInputPersistence";
import { buildAnamneseQuestionReview, type AnamneseOcrPageConfidence } from "@/lib/anamneseOcrMapping";

export const DIRECT_BEFUND_TARGETS = [
  { value: "labor", label: "Labor" },
  { value: "biodiagnostik", label: "Biodiagnostik Laboranalyse" },
  { value: "metatron", label: "Metatron" },
  { value: "vieva", label: "Vieva Pro" },
  { value: "anamnese", label: "Anamnese / Anamnesebogen" },
  { value: "arzt", label: "Arztbericht / Arztbrief" },
  { value: "sonstige", label: "Allgemeine Unterlagen" },
] as const;

export type DirectBefundTarget = (typeof DIRECT_BEFUND_TARGETS)[number]["value"];

export const inferDirectBefundTarget = (...values: string[]): DirectBefundTarget | "" => {
  const text = values.join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%/]+/g, " ");

  if (/\b(?:vieva|pro vital|pro vitalanalyse|vitalanalyse|vital analyse)\b/.test(text)) return "vieva";
  if (/\b(?:metatron|metapathia|oberon|nls analyse|nls auswertung|nonlinear system)\b/.test(text)) return "metatron";
  if (/\b(?:labor|laborbefund|laborbericht|blutbild|referenzbereich|normbereich|klinische chemie|hamatologie)\b/.test(text)
    || /\b(?:mg\/dl|mmol\/l|ng\/ml|miu\/l)\b/.test(text)) return "labor";
  const isAnamnese = /\b(?:anamnesebogen|anamnese|patientenfragebogen)\b/.test(text);
  const isArztbericht = /\b(?:arzt|arztbrief|arztbericht|entlassbrief|entlassungsbericht)\b/.test(text);
  if (isAnamnese && !isArztbericht) return "anamnese";
  if (isArztbericht && !isAnamnese) return "arzt";
  return "";
};

// "Hospital" is the practice's Metatron document label when it appears as a filename token.
// Keep this fallback out of text inference, where hospital can describe a clinical stay.
export const inferDirectBefundTargetFromFilename = (fileName: string): DirectBefundTarget | "" =>
  (/\bbiodiagnostik\b/i.test(fileName) ? "biodiagnostik" : inferDirectBefundTarget(fileName))
    || (/\bhospital\b/i.test(fileName) ? "metatron" : "");

export const selectDirectBefundQueue = <T extends { id: string; status: string; excludedFromHandoff?: boolean }>(items: readonly T[], targetId?: string): T[] =>
  items.filter(item => !item.excludedFromHandoff && (item.status === "queued" || item.status === "error") && (!targetId || item.id === targetId));

export const hasBlockingDirectBefundSelections = (items: readonly { status: string; excludedFromHandoff?: boolean }[]): boolean =>
  items.some(item => item.status === "processing" || !item.excludedFromHandoff && (item.status === "queued" || item.status === "error"));

export function directBefundPreviewBlockReason(item: {
  sourcePseudonymId: string; loadEventId?: string; loadHistoryStatus?: string; localCacheStatus?: string;
  localCacheConflict?: boolean; contentDateStatus?: string; documentDate: string; restoredDraft?: boolean;
}, pseudonymId: string): string | undefined {
  if (item.sourcePseudonymId !== pseudonymId) return "Diese Datei gehört zu einem anderen Patientenfall.";
  if (item.restoredDraft) return "Wiederhergestellten Entwurf zuerst bewusst fortsetzen.";
  if (item.loadEventId && item.loadHistoryStatus !== "saved") return "Ladeverlauf für diese Auswahl zuerst bestätigen lassen.";
  if (!item.documentDate.trim()) return "Dokumentdatum für diese Datei eintragen.";
  if (item.localCacheConflict || item.localCacheStatus !== "saved") return "Dokumentart und Datum für diese Datei zuerst lokal sichern lassen.";
  if (item.contentDateStatus !== "saved") return "Dokumentdatum für diese Originaldatei zuerst bestätigen lassen.";
  return undefined;
}

export const directBefundTargetLabel = (target: DirectBefundTarget): string => {
  const option = DIRECT_BEFUND_TARGETS.find((candidate) => candidate.value === target);
  if (!option) throw new Error("Bitte eine gültige Dokumentart auswählen.");
  return option.label;
};

export const prepareDirectBefundHandoffText = (
  text: string,
  target: DirectBefundTarget,
  documentDate: string,
  ocrPageConfidences: readonly AnamneseOcrPageConfidence[] = [],
): string => {
  if (!text.trim()) throw new Error("Die datenschutzbereinigte Vorschau ist leer.");
  if (!documentDate.trim()) throw new Error("Bitte für jede Datei das Dokumentdatum eintragen.");
  const reviewText = target === "anamnese"
    ? buildAnamneseQuestionReview(text, ocrPageConfidences).text
    : text;
  return addAnalysisDocumentMetadata(reviewText, documentDate.trim(), directBefundTargetLabel(target));
};
