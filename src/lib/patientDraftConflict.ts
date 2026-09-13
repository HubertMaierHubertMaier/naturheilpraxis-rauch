import { equalPatientInputValue } from "./verifiedPatientInput";

const bookkeeping = new Set(["_pseudonym_id", "pseudonymId", "autoSavedDraft", "finalized", "lastAutoSaveAt",
  "savedAt", "sessionDraftVersion", "useProModel", "useMapReduce", "belastungen", "document_inventory"]);

export function draftConflictFields(local: Record<string, unknown>, remote: Record<string, unknown>) {
  // Unknown server fields are retained, never offered as an implicit deletion by an older client.
  return Object.keys(local).filter(key => !bookkeeping.has(key) && !key.startsWith("_draft")
    && !equalPatientInputValue(local[key], remote[key]));
}

export function mergeReviewedDraft(local: Record<string, unknown>, remote: Record<string, unknown>, choices: Record<string, "local" | "remote">) {
  const entries = new Map(Object.entries({ ...remote, ...local }));
  for (const key of draftConflictFields(local, remote)) {
    const choice = choices[key];
    if (choice !== "local" && choice !== "remote") throw new Error("Bitte für jedes unterschiedliche Feld eine Fassung auswählen.");
    if (choice === "remote") {
      // Missing text/list values must also clear their corresponding controlled form fields.
      const empty = Array.isArray(local[key]) ? [] : typeof local[key] === "string" ? "" : typeof local[key] === "boolean" ? false : null;
      entries.set(key, remote[key] ?? empty);
    }
  }
  return Object.fromEntries(entries);
}
