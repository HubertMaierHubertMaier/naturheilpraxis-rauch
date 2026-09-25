export type DocumentLoadEntry = { documentKey: string; documentType: string; loadedAt: string };
export const DOCUMENT_LOAD_EVENT = "document_selection_recorded";

export function contentDateLabel(documentType: string): string {
  if (documentType === "anamnese") return "Anamnesedatum";
  if (["metatron", "vieva", "arzt", "labor"].includes(documentType)) return "Befunddatum";
  return "Dokumentdatum";
}

export function selectionTimestamp(item: { id: string; loadedAt?: string }): number | undefined {
  if (item.loadedAt) {
    const time = Date.parse(item.loadedAt);
    return Number.isFinite(time) ? time : undefined;
  }
  // Legacy selection IDs had a base-36 timestamp followed by index and filename.
  // A UUID or arbitrary ID must never be interpreted as a date.
  if (!/^[a-z0-9]{8,10}-\d+-/.test(item.id)) return undefined;
  const time = Number.parseInt(item.id.split("-", 1)[0], 36);
  return time >= Date.UTC(2020, 0, 1) && time < Date.UTC(2100, 0, 1) ? time : undefined;
}

// Only an opaque, case-scoped identifier leaves the browser; never file contents or names.
export async function documentLoadEntries(
  scope: string, files: readonly { arrayBuffer: () => Promise<ArrayBuffer>; documentType: string }[], loadedAt: string,
): Promise<DocumentLoadEntry[]> {
  if (!scope || !Number.isFinite(Date.parse(loadedAt))) throw new Error("Ungültiger Ladezeitpunkt oder Fall.");
  return Promise.all(files.map(async file => {
    const content = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const contentHash = Array.from(new Uint8Array(content), n => n.toString(16).padStart(2, "0")).join("");
    const bytes = new TextEncoder().encode(JSON.stringify([scope, contentHash]));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const documentKey = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
    return { documentKey, documentType: file.documentType, loadedAt };
  }));
}
