/** A history excerpt is useful for a list, but is never a recoverable full form. */
export function assertUntruncatedPatientInput(input: Record<string, unknown>): void {
  if (input._inputCompleteness === "history_excerpt_not_for_recovery"
      || (Array.isArray(input._inputTruncatedFields) && input._inputTruncatedFields.length > 0)) {
    throw new Error("Diese Verlaufsansicht enthält nur gekürzte Auszüge. Bitte die vollständige Sitzung öffnen; bestehende Eingaben wurden nicht ersetzt.");
  }
}
