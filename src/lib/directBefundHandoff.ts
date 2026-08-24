import { addAnalysisDocumentMetadata } from "@/lib/patientInputPersistence";

export const DIRECT_BEFUND_TARGETS = [
  { value: "labor", label: "Labor" },
  { value: "metatron", label: "Metatron" },
  { value: "vieva", label: "Vieva Pro" },
  { value: "arzt-anamnese", label: "Arztbericht / Anamnese" },
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
  if (/\b(?:arzt|arztbrief|arztbericht|entlassbrief|entlassungsbericht|anamnesebogen|anamnese)\b/.test(text)) return "arzt-anamnese";
  return "";
};

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
