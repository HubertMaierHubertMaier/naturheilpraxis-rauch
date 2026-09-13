import { normalizePatientPseudonym } from "../../supabase/functions/_shared/patientPseudonym";

export type RecoveryInput = Record<string, unknown>;

const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const owners = (input: RecoveryInput) => [input._pseudonym_id, input.pseudonymId]
  .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
  .map(normalizePatientPseudonym);

export function mergeAnamnesisRecovery(current: RecoveryInput, incoming: RecoveryInput, pseudonymId: string) {
  const pid = normalizePatientPseudonym(pseudonymId);
  if (!pid || [...owners(current), ...owners(incoming)].some((owner) => owner !== pid)) {
    throw new Error("Gespeicherte Anamnese gehört nicht zum gewählten Pseudonym.");
  }
  const input = { ...incoming };
  const preserve = owners(current).length > 0 && hasText(current.anamnese) && !hasText(incoming.anamnese);
  if (preserve) {
    input.anamnese = current.anamnese;
    if (typeof current.anamneseDatum === "string") input.anamneseDatum = current.anamneseDatum;
    else delete input.anamneseDatum;
  }
  return { input, preservedAnamnesis: preserve };
}

export function appendReviewedAnamnesis(existing: string, reviewedText: string): string {
  if (!reviewedText.trim()) throw new Error("Die geprüfte Anamnese enthält keinen Text.");
  if (existing.includes(reviewedText)) return existing;
  return existing.trim() ? `${existing.trim()}\n\n${reviewedText}` : reviewedText;
}

export async function anamnesisVersionHash(payload: RecoveryInput): Promise<string> {
  const encoded = `[${JSON.stringify(payload.anamnese)}, ${JSON.stringify(payload.anamneseDatum ?? null)}]`;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(encoded));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function persistVerifiedAnamnesis(
  pseudonymId: string,
  payload: RecoveryInput,
  save: (pid: string, data: RecoveryInput) => Promise<string | null>,
  readBack: (id: string) => Promise<{ pseudonym_id: string; eingabe_daten: RecoveryInput; updated_at?: string; versionVerified: boolean } | null>,
) {
  const pid = normalizePatientPseudonym(pseudonymId);
  if (!pid || !owners(payload).length || owners(payload).some((owner) => owner !== pid) || !hasText(payload.anamnese)) {
    throw new Error("Anamnese und Pseudonym müssen vor dem Speichern eindeutig feststehen.");
  }
  const id = await save(pid, payload);
  if (!id) throw new Error("Die Datenbank hat die Anamnese-Speicherung nicht bestätigt.");
  const stored = await readBack(id);
  if (!stored || normalizePatientPseudonym(stored.pseudonym_id) !== pid || stored.eingabe_daten?.anamnese !== payload.anamnese
    || owners(stored.eingabe_daten).some((owner) => owner !== pid)
    || (typeof payload.anamneseDatum === "string" && stored.eingabe_daten.anamneseDatum !== payload.anamneseDatum)
    || stored.versionVerified !== true) {
    throw new Error("Die Anamnese konnte nicht vollständig zurückgelesen werden. Die Importvorschau bleibt erhalten.");
  }
  return { id, stored };
}
