/** Run independent document parts concurrently while committing evidence in source order. */
export async function runOrderedAnalysisBatches<T>(
  start: number,
  total: number,
  width: number,
  analyze: (index: number) => Promise<T>,
  commit: (index: number, result: T) => Promise<void>,
  fail: (index: number, reason: unknown) => Promise<void>,
): Promise<void> {
  if (!Number.isInteger(start) || !Number.isInteger(total) || !Number.isInteger(width)
    || start < 0 || total < start || width < 1 || width > 3) {
    throw new Error("Ungültige Aufteilung der Befund-Teilanalysen.");
  }
  for (let first = start; first < total; first += width) {
    const indices = Array.from({ length: Math.min(width, total - first) }, (_, offset) => first + offset);
    // Attach both handlers immediately. A later part can finish or fail first,
    // while the earliest completed prefix is committed without waiting for it.
    const outcomes = indices.map(index => analyze(index).then(
      value => ({ status: "fulfilled" as const, value }),
      reason => ({ status: "rejected" as const, reason }),
    ));
    for (let offset = 0; offset < indices.length; offset += 1) {
      const outcome = await outcomes[offset];
      if (outcome.status === "rejected") {
        await fail(indices[offset], outcome.reason);
        throw outcome.reason;
      }
      await commit(indices[offset], outcome.value);
    }
  }
}
