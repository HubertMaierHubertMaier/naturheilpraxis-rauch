import { normalizePatientPseudonym } from "../../supabase/functions/_shared/patientPseudonym";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export const equalPatientInputValue = (left: unknown, right: unknown) => stableJson(left) === stableJson(right);

export async function persistVerifiedPatientInput(
  pseudonymId: string,
  payload: Record<string, unknown>,
  save: (pid: string, data: Record<string, unknown>) => Promise<string | null>,
  readBack: (id: string) => Promise<{ id: string; pseudonym_id: string; eingabe_daten: Record<string, unknown> } | null>,
) {
  const pid = normalizePatientPseudonym(pseudonymId);
  if (!pid || normalizePatientPseudonym(payload._pseudonym_id) !== pid || normalizePatientPseudonym(payload.pseudonymId) !== pid) {
    throw new Error("Die Eingaben sind nicht eindeutig an den gewählten Fall gebunden.");
  }
  const id = await save(pid, payload);
  if (!id) throw new Error("Die Datenbank hat die Speicherung nicht bestätigt. Die Vorschau bleibt erhalten.");
  const stored = await readBack(id);
  if (!stored || stored.id !== id || normalizePatientPseudonym(stored.pseudonym_id) !== pid
    || !stored.eingabe_daten || Object.keys(payload).some(key => stableJson(payload[key]) !== stableJson(stored.eingabe_daten[key]))) {
    throw new Error("Die Eingaben konnten nicht vollständig und unverändert zurückgelesen werden. Die Vorschau bleibt erhalten.");
  }
  return { id, stored };
}
