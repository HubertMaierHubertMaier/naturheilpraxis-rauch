import { normalizePatientPseudonym } from "../../supabase/functions/_shared/patientPseudonym";
import { equalPatientInputValue } from "./verifiedPatientInput";

export type DraftRevision = string | null | undefined;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isDraftRevision = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** undefined means unknown, null means a confirmed absence, never interchange them. */
export function selectLoadedDraftRevision(options: {
  hasCloudRow: boolean;
  cloudRevision: unknown;
  usedLocal: boolean;
  localInput?: Record<string, unknown> | null;
}): DraftRevision {
  if (options.usedLocal && options.localInput) {
    const local = options.localInput._draftBaseRevision;
    if (local === null) return null;
    if (isDraftRevision(local)) return local;
    // A pre-upgrade local draft has no proof that it was based on today's cloud row.
    return options.hasCloudRow ? undefined : null;
  }
  return options.hasCloudRow
    ? (isDraftRevision(options.cloudRevision) ? options.cloudRevision : undefined)
    : null;
}

export class PatientDraftRevisionError extends Error {
  readonly code = "PATIENT_DRAFT_BASE_UNKNOWN";
  constructor() {
    super("Der gespeicherte Ausgangsstand dieser Eingaben ist nicht eindeutig. Bitte die Fassungen prüfen; es wurde nichts überschrieben.");
  }
}

export type DraftBase = Readonly<{ revision: DraftRevision }>;
export class PatientDraftRevisionTracker {
  private bases = new Map<string, DraftBase>();

  load(pid: string, revision: DraftRevision): void {
    this.bases.set(normalizePatientPseudonym(pid), Object.freeze({ revision }));
  }

  revision(pid: string): DraftRevision {
    return this.bases.get(normalizePatientPseudonym(pid))?.revision;
  }

  capture(pid: string): DraftBase {
    const base = this.bases.get(normalizePatientPseudonym(pid));
    if (!base || base.revision === undefined) throw new PatientDraftRevisionError();
    return base;
  }

  acknowledge(pid: string, base: DraftBase, revision: unknown): boolean {
    if (!isDraftRevision(revision)) throw new Error("Die Datenbank hat keinen gültigen Speicherstand bestätigt.");
    const key = normalizePatientPseudonym(pid);
    // A delayed response must not grant an older context permission to overwrite a reloaded one.
    if (this.bases.get(key) !== base) return false;
    this.load(key, revision);
    return true;
  }
}

/** Only advance recovery data written by this window, never another window's draft. */
export function stampOwnedDraftRevision(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  pid: string,
  writerId: string,
  revision: string,
  savedPayload: Record<string, unknown>,
): boolean {
  if (!isDraftRevision(revision)) return false;
  try {
    const text = storage.getItem(key);
    if (!text) return false;
    const draft = JSON.parse(text);
    if (!draft || draft._draftWriterId !== writerId
      || normalizePatientPseudonym(draft._pseudonym_id) !== normalizePatientPseudonym(pid)
      || normalizePatientPseudonym(draft.pseudonymId) !== normalizePatientPseudonym(pid)) return false;
    const controlFields = new Set(["autoSavedDraft", "finalized", "lastAutoSaveAt"]);
    if (Object.keys(savedPayload).some(field => !controlFields.has(field) && !equalPatientInputValue(draft[field], savedPayload[field]))) return false;
    storage.setItem(key, JSON.stringify({ ...draft, _draftBaseRevision: revision }));
    return true;
  } catch { return false; }
}
