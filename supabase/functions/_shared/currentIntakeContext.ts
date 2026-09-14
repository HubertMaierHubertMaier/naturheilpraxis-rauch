export const CURRENT_NATURAL_INTAKE_FIELDS = [
  ["naturheilMittelHomoeopathie", "Aktuell eingenommene homöopathische Mittel"],
  ["naturheilMittelPflanzenheilkunde", "Aktuell eingenommene pflanzenheilkundliche Mittel"],
  ["naturheilMittelVitamine", "Aktuell eingenommene Vitamine"],
  ["naturheilMittelMineralstoffe", "Aktuell eingenommene Mineralstoffe"],
  ["naturheilMittelSpurenelemente", "Aktuell eingenommene Spurenelemente"],
] as const;

export function formatCurrentNaturalIntake(input: Record<string, unknown>): string {
  return CURRENT_NATURAL_INTAKE_FIELDS.flatMap(([field, label]) => {
    const value = input[field];
    return typeof value === "string" && value.trim() ? [`${label}:\n${value.trim()}`] : [];
  }).join("\n\n");
}
