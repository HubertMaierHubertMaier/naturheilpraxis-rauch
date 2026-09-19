/** Output size can exceed the model budget even for short source pages. */
export function analysisRetryChunkLimit(sourceLength: number, previousLimit?: number): number | null {
  if (!Number.isInteger(sourceLength) || sourceLength <= 512) return null;
  const available = previousLimit && previousLimit >= 512 ? Math.min(sourceLength, previousLimit) : sourceLength;
  return Math.min(2000, Math.max(512, Math.floor(available / 2)));
}

export function isAnalysisOutputFailure(message: string): boolean {
  return /Ausgabelimit|abgeschnitten|fehlende Pflichtlisten|fehlende Kategorien|ungültige\/unkomplette Teilanalyse/i.test(message);
}
