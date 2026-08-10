export type ExtractedDiagnosis = { icd10?: string; diagnose: string; quelle?: string; status?: string };
export type ExtractedSymptom = { text: string; quelle?: string; zitat?: string };
export type ExtractedMedication = {
  name: string;
  dosis?: string;
  vonWem?: string;
  datum?: string;
  indikation?: string;
  wirkmechanismus?: string;
  nebenwirkungen?: string;
  grundVerordnung?: string;
  status?: string;
  quelle?: string;
  zitat?: string;
};

const appendUniqueFacts = <T>(
  existing: string,
  facts: T[],
  identity: (fact: T) => string,
  format: (fact: T) => string,
): string => {
  const normalizedExisting = existing.toLocaleLowerCase("de-DE");
  const seen = new Set<string>();
  const additions: string[] = [];
  for (const fact of facts) {
    const key = identity(fact).trim().toLocaleLowerCase("de-DE");
    if (!key || seen.has(key) || normalizedExisting.includes(key)) continue;
    seen.add(key);
    additions.push(format(fact));
  }
  if (!additions.length) return existing;
  return existing.trim() ? `${existing.trim()}\n${additions.join("\n")}` : additions.join("\n");
};

export const shouldApplyCloudDraft = (localSavedAt: number, cloudUpdatedAt: unknown): boolean => {
  if (!localSavedAt) return true;
  const cloudTime = typeof cloudUpdatedAt === "string" ? Date.parse(cloudUpdatedAt) : Number.NaN;
  return Number.isFinite(cloudTime) && cloudTime >= localSavedAt;
};

export const missingPatientProfileFields = (
  selectedBase: Record<string, unknown>,
  patientSnapshot: Record<string, unknown>,
): Record<string, unknown> => Object.fromEntries(
  ["alter", "geschlecht", "groesseCm", "gewichtKg", "schwanger"]
    .filter((key) => !String(selectedBase[key] || "").trim() && String(patientSnapshot[key] || "").trim())
    .map((key) => [key, patientSnapshot[key]]),
);

export const addAnalysisDocumentMetadata = (text: string, documentDate: string, documentType: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) throw new Error("Ungültiges Erstellungsdatum der Analyse.");
  const metadata = [`Dokumenttyp: ${documentType}`, `Erstellt am: ${documentDate}`];
  const normalized = text.trim();
  if (!normalized) return metadata.join("\n");

  const isDocumentMarker = (line: string) => /^===\s*(?:(?:📄|📷)\s*[^=\n]+?|KLINISCHES\s+DOKUMENT\s+[a-f0-9]{12}(?:\s*\(\d+\s*S\.\))?)\s*===\s*$/i.test(line.trim());
  const lines = normalized.split(/\r?\n/);
  const hasDocumentMarker = lines.some(isDocumentMarker);
  if (!hasDocumentMarker) return `${metadata.join("\n")}\n${normalized}`;

  const output: string[] = [];
  lines.forEach((line, index) => {
    output.push(line);
    if (!isDocumentMarker(line)) return;

    // Alte gespeicherte PDF-Blöcke können den Marker, aber noch keine Metadaten enthalten.
    // Nur den Kopf des jeweiligen Blocks prüfen, damit medizinischer Freitext nicht zählt.
    const header = lines.slice(index + 1, index + 5).filter((entry) => entry.trim()).map((entry) => entry.trim());
    if (!header.some((entry) => /^Dokumenttyp\s*:/i.test(entry))) output.push(metadata[0]);
    if (!header.some((entry) => /^Erstellt am\s*:/i.test(entry))) output.push(metadata[1]);
  });
  return output.join("\n").trim();
};

export const createNeutralDocumentId = async (text: string, identitySalt = ""): Promise<string> => {
  const input = new TextEncoder().encode(`${text}\n${identitySalt}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest)).slice(0, 6).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const mergeExtractedDiagnoses = (existing: string, diagnoses: ExtractedDiagnosis[]): string => appendUniqueFacts(
  existing,
  diagnoses,
  (diagnosis) => diagnosis.diagnose,
  (diagnosis) => `• ${diagnosis.icd10?.trim() ? `${diagnosis.icd10.trim()}: ` : ""}${diagnosis.diagnose.trim()}`,
);

export const mergeExtractedSymptoms = (existing: string, symptoms: ExtractedSymptom[]): string => appendUniqueFacts(
  existing,
  symptoms,
  (symptom) => symptom.text,
  (symptom) => {
    const meta = [symptom.quelle?.trim(), symptom.zitat?.trim() ? `„${symptom.zitat.trim()}"` : ""].filter(Boolean);
    return `• ${symptom.text.trim()}${meta.length ? ` (Dokument: ${meta.join(" · ")})` : ""}`;
  },
);

export const mergeExtractedMedications = (existing: string, medications: ExtractedMedication[]): string => appendUniqueFacts(
  existing,
  medications,
  (medication) => medication.name,
  (medication) => {
    const head = `${medication.name.trim()}${medication.dosis?.trim() ? ` ${medication.dosis.trim()}` : ""}`;
    const meta = [
      `verordnet von: ${medication.vonWem?.trim() || "unbekannt"}`,
      `Datum: ${medication.datum?.trim() || "unbekannt"}`,
      medication.indikation?.trim() ? `Indikation: ${medication.indikation.trim()}` : "",
      medication.grundVerordnung?.trim() ? `Grund: ${medication.grundVerordnung.trim()}` : "",
      medication.wirkmechanismus?.trim() ? `Wirkung: ${medication.wirkmechanismus.trim()}` : "",
      medication.nebenwirkungen?.trim() ? `NW: ${medication.nebenwirkungen.trim()}` : "",
      medication.status?.trim() ? `Status: ${medication.status.trim()}` : "",
      medication.quelle?.trim() ? `Dokument: ${medication.quelle.trim()}` : "",
      medication.zitat?.trim() ? `„${medication.zitat.trim()}"` : "",
    ].filter(Boolean);
    return `• ${head} - ${meta.join(" · ")}`;
  },
);
