import { addAnalysisDocumentMetadata } from "@/lib/patientInputPersistence";

export const DIRECT_BEFUND_TARGETS = [
  { value: "labor", label: "Labor" },
  { value: "metatron", label: "Metatron" },
  { value: "vieva", label: "Vieva Pro" },
  { value: "arzt-anamnese", label: "Arztbericht / Anamnese" },
  { value: "sonstige", label: "Allgemeine Unterlagen" },
] as const;

export type DirectBefundTarget = (typeof DIRECT_BEFUND_TARGETS)[number]["value"];

export const directBefundTargetLabel = (target: DirectBefundTarget): string => {
  const option = DIRECT_BEFUND_TARGETS.find((candidate) => candidate.value === target);
  if (!option) throw new Error("Bitte eine gültige Dokumentart auswählen.");
  return option.label;
};

export const prepareDirectBefundHandoffText = (
  text: string,
  target: DirectBefundTarget,
  documentDate: string,
): string => {
  if (!text.trim()) throw new Error("Die datenschutzbereinigte Vorschau ist leer.");
  if (!documentDate.trim()) throw new Error("Bitte für jede Datei das Dokumentdatum eintragen.");
  return addAnalysisDocumentMetadata(text, documentDate.trim(), directBefundTargetLabel(target));
};
