import { normalizePatientPseudonym } from "../../supabase/functions/_shared/patientPseudonym";
import { assertReviewedPdfArchiveCopy } from "./pdfArchiveCopyRegistry";

export type OriginalArchiveKind = "anamnese" | "labor" | "arzt" | "metatron" | "vieva" | "sonstige" | "dokument";
export type OriginalArchiveReceipt = { pseudonymId: string; archivePath: string; sha256: string; bytes: number; reused: boolean };
export type ArchiveOriginals = () => Promise<OriginalArchiveReceipt[]>;

export function originalArchiveInputPatch(input: Record<string, unknown>, receipts: OriginalArchiveReceipt[], field: string) {
  if (!receipts.length) return {};
  const previous = input.originalArchiveReceiptsV1;
  if (previous !== undefined && !Array.isArray(previous)) throw new Error("Die vorhandenen Archivkopie-Verweise müssen geprüft werden; sie wurden nicht überschrieben.");
  const links = [...(Array.isArray(previous) ? previous : [])];
  for (const receipt of receipts) {
    if (normalizePatientPseudonym(input._pseudonym_id) !== receipt.pseudonymId) throw new Error("Archivkopie-Verweis und Fall stimmen nicht überein.");
    const parts = receipt.archivePath.split("/");
    const filename = parts[2]?.match(/^(anamnese|labor|arzt|metatron|vieva|sonstige|dokument)-([0-9a-f]{64})\.([a-z0-9]+)$/);
    if (parts.length !== 3 || parts[0] !== receipt.pseudonymId || !filename || filename[2] !== receipt.sha256) {
      throw new Error("Der Archivkopie-Verweis hat kein bestätigtes neutrales Archivformat.");
    }
    // Do not put filenames/paths through clinical text deidentification. These neutral components
    // reconstruct the exact archive key without weakening the existing filename privacy rule.
    const link = { pseudonymId: receipt.pseudonymId, documentKind: filename[1], documentDate: parts[1],
      sha256: receipt.sha256, extension: filename[3], bytes: receipt.bytes, inputField: field };
    if (!links.some(previousLink => previousLink?.pseudonymId === link.pseudonymId && previousLink?.sha256 === link.sha256
      && previousLink?.documentKind === link.documentKind && previousLink?.documentDate === link.documentDate
      && previousLink?.extension === link.extension && previousLink?.inputField === field)) {
      links.push(link);
    }
  }
  return { originalArchiveReceiptsV1: links };
}
export type OriginalArchiveClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
  storage: { from: (bucket: string) => {
    upload: (path: string, body: Blob, options: { upsert: false; contentType: string }) => PromiseLike<{ error: any }>;
    download: (path: string) => PromiseLike<{ data: Blob | null; error: any }>;
  } };
};
const extensions = new Set(["pdf", "docx", "xlsx", "txt", "md", "html", "htm", "csv", "json"]);
export type LocalImportArchiveCandidate = { file: Blob & { name: string; type?: string }; archiveCopy?: Blob };
export const isPdfLocalImport = (file: Blob & { name: string; type?: string }) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

/** A changed text preview cannot attest to an unchanged rendered PDF page. */
export function archiveCopyAfterPreviewTextEdit<T extends Blob>(file: Blob & { name: string; type?: string }, archiveCopy?: T): T | undefined {
  return isPdfLocalImport(file) ? undefined : archiveCopy;
}

/** Office texts stay local; every imported PDF needs its own locally prepared copy. */
export function assertCompletePdfArchiveCopies(items: readonly LocalImportArchiveCandidate[]) {
  if (items.some(item => isPdfLocalImport(item.file) && !item.archiveCopy)) {
    throw new Error("Archivübertragung gesperrt: Für mindestens ein PDF fehlt eine passende geprüfte anonymisierte Archivkopie. Der bereinigte Text wird nicht übernommen; lokale Originale bleiben lokal.");
  }
}

const sha256 = async (value: ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", value)))
  .map(byte => byte.toString(16).padStart(2, "0")).join("");

/** Upload only a reviewed anonymized PDF copy, never overwrite, and verify the exact copy. */
export async function archivePatientOriginal(
  client: OriginalArchiveClient,
  pseudonymId: string,
  file: Blob & { name: string },
  kind: OriginalArchiveKind,
  documentDate = "",
): Promise<OriginalArchiveReceipt> {
  const pid = normalizePatientPseudonym(pseudonymId);
  const extension = file.name.split(".").at(-1)?.toLowerCase() || "";
  if (extension !== "pdf") throw new Error("Archivübertragung gesperrt: Originale bleiben lokal. Eine geprüfte anonymisierte PDF-Kopie ist erforderlich.");
  assertReviewedPdfArchiveCopy(file);
  if (!pid || pid.length < 6 || pid.length > 100 || /[/\\\x00-\x1f\x7f]/.test(pid)
    || (/^P-/i.test(pid) && !/^P-\d{4}-\d{4}$/.test(pid))) throw new Error("Die Archivkopie ist keinem gültigen Fall zugeordnet.");
  if (!extensions.has(extension) || file.size < 1 || file.size > 50 * 1024 * 1024) {
    throw new Error("Die Archivkopie ist leer, größer als 50 MB oder hat ein nicht unterstütztes Dateiformat. Das lokale Original wurde nicht verändert.");
  }
  if (documentDate && !/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) throw new Error("Bitte das Dokumentdatum prüfen.");
  const digest = await sha256(await file.arrayBuffer());
  const expectedPath = `${pid}/${documentDate || "undatiert"}/${kind}-${digest}.${extension}`;
  const { data: plan, error: prepareError } = await client.rpc("prepare_therapy_document_archive", {
    _pseudonym_id: pid, _sha256: digest, _size_bytes: file.size,
    _document_type: kind, _extension: extension, _document_date: documentDate || null,
  });
  if (prepareError) throw new Error("Das private Archiv der anonymisierten PDF-Kopie konnte nicht bestätigt werden. Die Vorschau bleibt erhalten.");
  if (!plan || plan.bucket !== "therapy-documents" || plan.path !== expectedPath || plan.pseudonym_id !== pid
    || plan.sha256 !== digest || Number(plan.bytes) !== file.size || typeof plan.exists !== "boolean") {
    throw new Error("Die Archivzuordnung wurde nicht eindeutig bestätigt. Es wurde keine Archivkopie hochgeladen.");
  }
  const storage = client.storage.from("therapy-documents");
  let uploadError: unknown = null;
  if (!plan.exists) {
    try {
      const result = await storage.upload(expectedPath, file, { upsert: false,
        contentType: extension === "pdf" ? "application/pdf" : "application/octet-stream" });
      uploadError = result.error;
    } catch (error) { uploadError = error; }
  }
  // An interrupted upload response can still have committed the file. Verify rather than overwrite.
  const { data: original, error: readError } = await storage.download(expectedPath);
  if (readError || !original || original.size !== file.size || await sha256(await original.arrayBuffer()) !== digest) {
    throw new Error("Die anonymisierte Archivkopie konnte nicht vollständig und unverändert aus dem privaten Archiv zurückgelesen werden. Die Vorschau bleibt erhalten.");
  }
  return { pseudonymId: pid, archivePath: expectedPath, sha256: digest, bytes: file.size, reused: plan.exists || Boolean(uploadError) };
}

export async function verifyArchivedPatientOriginal(client: OriginalArchiveClient, pseudonymId: string, receipt: OriginalArchiveReceipt, providedOriginal?: Blob): Promise<OriginalArchiveReceipt> {
  const pid = normalizePatientPseudonym(pseudonymId);
  const parts = typeof receipt?.archivePath === "string" ? receipt.archivePath.split("/") : [];
  const name = parts[2]?.match(/^(anamnese|labor|arzt|metatron|vieva|sonstige|dokument)-([0-9a-f]{64})\.([a-z0-9]+)$/);
  if (normalizePatientPseudonym(receipt?.pseudonymId) !== pid || parts.length !== 3 || parts[0] !== pid
    || !/^(undatiert|\d{4}-\d{2}-\d{2})$/.test(parts[1]) || !name || name[2] !== receipt.sha256 || !extensions.has(name[3])
    || !Number.isInteger(receipt.bytes) || receipt.bytes < 1 || receipt.bytes > 52428800) {
    throw new Error("Der gespeicherte Archivkopie-Nachweis passt nicht zum aktuellen Fall.");
  }
  const { data: plan, error } = await client.rpc("prepare_therapy_document_archive", {
    _pseudonym_id: pid, _sha256: receipt.sha256, _size_bytes: receipt.bytes,
    _document_type: name[1], _extension: name[3], _document_date: parts[1] === "undatiert" ? null : parts[1],
  });
  if (error || !plan || plan.bucket !== "therapy-documents" || plan.path !== receipt.archivePath
    || plan.pseudonym_id !== pid || plan.sha256 !== receipt.sha256 || Number(plan.bytes) !== receipt.bytes) {
    throw new Error("Das private Originalarchiv konnte nicht bestätigt werden.");
  }
  const { data: original, error: readError } = providedOriginal
    ? { data: providedOriginal, error: null }
    : await client.storage.from("therapy-documents").download(receipt.archivePath);
  if (readError || !original || original.size !== receipt.bytes || await sha256(await original.arrayBuffer()) !== receipt.sha256) {
    throw new Error("Die bereits archivierte anonymisierte Kopie konnte nicht unverändert bestätigt werden. Bitte das lokale Original erneut auswählen.");
  }
  return { pseudonymId: pid, archivePath: receipt.archivePath, sha256: receipt.sha256, bytes: receipt.bytes, reused: true };
}
