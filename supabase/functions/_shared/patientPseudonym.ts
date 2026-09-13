export const STANDARD_PATIENT_PSEUDONYM = /^P-\d{4}-\d{4}$/i;

export function normalizePatientPseudonym(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return STANDARD_PATIENT_PSEUDONYM.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}

export function patientPseudonymAliases(value: string): string[] {
  const canonical = normalizePatientPseudonym(value);
  return STANDARD_PATIENT_PSEUDONYM.test(canonical)
    ? [...new Set([canonical, value.trim(), canonical.toLowerCase()])]
    : [canonical];
}
