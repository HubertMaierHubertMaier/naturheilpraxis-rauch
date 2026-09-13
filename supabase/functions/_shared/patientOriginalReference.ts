import { normalizePatientPseudonym } from "./patientPseudonym.ts";

/** Resolve only our neutral, case-bound original-file reference format. */
export function patientOriginalArchivePath(value: unknown, pseudonymId: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const link = value as Record<string, unknown>;
  const pid = normalizePatientPseudonym(pseudonymId);
  if (!pid || /[/\\\x00-\x1f\x7f]/.test(pid) || normalizePatientPseudonym(link.pseudonymId) !== pid
    || typeof link.documentKind !== "string" || !/^(anamnese|labor|arzt|metatron|vieva|sonstige|dokument)$/.test(link.documentKind)
    || typeof link.documentDate !== "string" || !/^(undatiert|\d{4}-\d{2}-\d{2})$/.test(link.documentDate)
    || typeof link.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(link.sha256)
    || typeof link.extension !== "string" || !/^(pdf|docx|txt|md|html|htm|csv|json)$/.test(link.extension)) return null;
  return `${pid}/${link.documentDate}/${link.documentKind}-${link.sha256}.${link.extension}`;
}
