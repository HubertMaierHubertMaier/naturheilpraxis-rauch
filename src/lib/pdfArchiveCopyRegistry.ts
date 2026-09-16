const preparedCopies = new WeakSet<Blob>();
const reviewedCopies = new WeakSet<Blob>();

// Internal in-memory capability: only the local PDF builder registers a new copy.
// It cannot be restored by trusting a filename, JSON flag, or an old archive receipt.
export function registerPreparedPdfArchiveCopy(file: Blob) { preparedCopies.add(file); }
export function isPreparedPdfArchiveCopy(file: Blob) { return preparedCopies.has(file); }
export function setPdfArchiveCopyReviewed(file: Blob, reviewed: boolean) {
  if (!preparedCopies.has(file)) throw new Error("Nur eine lokal erzeugte anonymisierte PDF-Kopie kann bestätigt werden.");
  if (reviewed) reviewedCopies.add(file); else reviewedCopies.delete(file);
}
export function assertReviewedPdfArchiveCopy(file: Blob) {
  if (!preparedCopies.has(file) || !reviewedCopies.has(file)) throw new Error("Archivübertragung gesperrt: Die anonymisierte PDF-Kopie wurde noch nicht geprüft. Das Original bleibt lokal.");
}
