import { normalizePatientPseudonym, patientPseudonymAliases } from "../../supabase/functions/_shared/patientPseudonym";

export function readPatientInputDraft(
  storage: Pick<Storage, "getItem">,
  pseudonymId: string,
  isRestorable: (data: Record<string, unknown>) => boolean,
): { data: Record<string, unknown> | null; timestamp: number; key: string | null } {
  const pid = normalizePatientPseudonym(pseudonymId);
  let best: { data: Record<string, unknown> | null; timestamp: number; key: string | null } = { data: null, timestamp: 0, key: null };
  if (!pid) return best;
  for (const alias of patientPseudonymAliases(pseudonymId)) {
    const key = `therapy.inputs.draft.patientSafe.v4.${alias}`;
    try {
      const raw = storage.getItem(key); if (!raw) continue;
      const data = JSON.parse(raw) as Record<string, unknown>;
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      const owners = [data._pseudonym_id, data.pseudonymId].filter(value => value !== undefined && value !== null);
      if (!owners.length || owners.some(owner => normalizePatientPseudonym(owner) !== pid) || !isRestorable(data)) continue;
      const parsedTime = typeof data.savedAt === "string" ? Date.parse(data.savedAt) : 0;
      const timestamp = Number.isFinite(parsedTime) ? parsedTime : 0;
      if (!best.data || timestamp > best.timestamp) best = { data, timestamp, key };
    } catch { /* a malformed legacy candidate must not hide another valid copy */ }
  }
  // Reading never deletes either historical spelling of the recovery key.
  return best;
}

export function readWindowPatientInputDraft(
  windowStorage: Pick<Storage, "getItem">,
  sharedStorage: Pick<Storage, "getItem">,
  pseudonymId: string,
  isRestorable: (data: Record<string, unknown>) => boolean,
) {
  const own = readPatientInputDraft(windowStorage, pseudonymId, isRestorable);
  return own.data ? own : readPatientInputDraft(sharedStorage, pseudonymId, isRestorable);
}
