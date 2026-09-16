import type { Fact } from "./core";

export const FACT_KIND_LABEL: Record<Fact["kind"], string> = {
  symptom: "Symptom",
  modality: "Modalität",
  disease: "Erkrankung",
  iaa: "IAA",
};

export const ASSERTION_LABEL: Record<Fact["assertion"], string> = {
  affirmed: "bestätigt",
  negated: "verneint",
  uncertain: "unsicher",
  "not-stated": "nicht angegeben",
};

/** Rein visuelle Unterscheidung; sie verändert keine Bewertung in der Engine. */
export const ASSERTION_STYLE: Record<Fact["assertion"], string> = {
  affirmed: "border-primary/40 bg-primary/10 text-primary",
  negated: "border-destructive/40 bg-destructive/10 text-destructive",
  uncertain: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "not-stated": "border-border bg-muted text-muted-foreground",
};

export const STATUS_LABEL: Record<"needs_sources" | "needs_mapping" | "comparison_ready", string> = {
  needs_sources: "Keine Repertoriumsdaten geladen",
  needs_mapping: "Rubrikzuordnung offen",
  comparison_ready: "Quellenvergleich vorhanden",
};

/** Zeigt Grade immer in der Originalskala der Quelle, ohne Umrechnung in Prozent. */
export function formatOriginalGrade(grade: number | undefined, maxGrade?: number): string {
  if (grade === undefined) return "Originalgrad nicht angegeben";
  return maxGrade && maxGrade > 0 ? `Originalgrad ${grade} (Skala 0–${maxGrade})` : `Originalgrad ${grade}`;
}
