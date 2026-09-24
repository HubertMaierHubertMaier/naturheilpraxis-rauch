export const LOCAL_DOCUMENT_SELECTION_CACHE_VERSION = 1;
export const LOCAL_DOCUMENT_SELECTION_CACHE_MAX_BYTES = 100 * 1024 * 1024;
export const LOCAL_DOCUMENT_SELECTION_CACHE_MAX_ENTRIES = 30;
export const LOCAL_DOCUMENT_SELECTION_CACHE_MAX_FILE_BYTES = 50 * 1024 * 1024;

const DATABASE_NAME = "therapy-local-document-selections";
const DATABASE_VERSION = 1;
const STORE_NAME = "selections";
const scopeKey = (userId: string, pseudonymId: string) => JSON.stringify([userId, pseudonymId]);
const recordKey = (userId: string, pseudonymId: string, id: string) => JSON.stringify([userId, pseudonymId, id]);
export function localSelectionPreviewKey(userId: string, pseudonymId: string): string {
  assertScope(userId, pseudonymId);
  return `therapy.pendingSafePreviews.v2:${scopeKey(userId, pseudonymId)}`;
}

export type CachedDocumentSelectionStatus = "queued" | "processing" | "error" | "ready";
export type LocalDocumentSelection = {
  id: string;
  file: File;
  documentType: string;
  documentTypeInferred?: boolean;
  documentDate: string;
  status: CachedDocumentSelectionStatus;
  error?: string;
  errorKind?: string;
};
export type RestoredLocalDocumentSelection = Omit<LocalDocumentSelection, "status"> & {
  status: "queued" | "error";
  savedAt: string;
  recoveryNotice?: string;
};

type StoredSelection = {
  key: string;
  scope: string;
  schemaVersion: number;
  userId: string;
  pseudonymId: string;
  id: string;
  name: string;
  type: string;
  lastModified: number;
  bytes: Blob;
  size: number;
  documentType: string;
  documentTypeInferred?: boolean;
  documentDate: string;
  status: CachedDocumentSelectionStatus;
  error?: string;
  errorKind?: string;
  savedAt: string;
};

export type LocalSelectionOperationScope = { userId: string; pseudonymId: string; generation: number };
export const isCurrentLocalSelectionOperation = (expected: LocalSelectionOperationScope, current: LocalSelectionOperationScope) => (
  expected.userId === current.userId && expected.pseudonymId === current.pseudonymId && expected.generation === current.generation
);

export class LocalDocumentSelectionCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalDocumentSelectionCacheError";
  }
}

function assertScope(userId: string, pseudonymId: string) {
  if (!userId.trim() || !pseudonymId.trim()) throw new LocalDocumentSelectionCacheError("Lokale Dateiwiederaufnahme benötigt einen angemeldeten Benutzer und einen gültigen Patientenfall.");
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new LocalDocumentSelectionCacheError("IndexedDB ist in diesem Browser nicht verfügbar. Die Auswahl bleibt nur im aktuellen Tab.");
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION); }
    catch { reject(new LocalDocumentSelectionCacheError("Lokale Dateiwiederaufnahme konnte nicht geöffnet werden. Die Auswahl bleibt im aktuellen Tab.")); return; }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("scope", "scope", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new LocalDocumentSelectionCacheError("Lokale Dateiwiederaufnahme konnte nicht geöffnet werden. Die Auswahl bleibt im aktuellen Tab."));
    request.onblocked = () => reject(new LocalDocumentSelectionCacheError("Lokale Dateiwiederaufnahme ist durch einen anderen offenen Tab blockiert. Die Auswahl bleibt im aktuellen Tab."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new LocalDocumentSelectionCacheError("Lokale Dateiwiederaufnahme konnte nicht abgeschlossen werden."));
  });
}

const scopeOperations = new Map<string, Promise<void>>();

function enqueueScopeOperation<T>(userId: string, pseudonymId: string, operation: () => Promise<T>): Promise<T> {
  const scope = scopeKey(userId, pseudonymId);
  const previous = scopeOperations.get(scope) || Promise.resolve();
  const result = previous.catch(() => undefined).then(operation);
  const settled = result.then(() => undefined, () => undefined);
  scopeOperations.set(scope, settled);
  void settled.finally(() => {
    if (scopeOperations.get(scope) === settled) scopeOperations.delete(scope);
  });
  return result;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(new LocalDocumentSelectionCacheError("Lokale Dateiwiederaufnahme konnte nicht abgeschlossen werden. Möglicherweise ist der lokale Speicher voll."));
  });
}

function toStoredSelection(userId: string, pseudonymId: string, selection: LocalDocumentSelection): StoredSelection {
  if (selection.file.size < 1) throw new LocalDocumentSelectionCacheError("Die lokale Originaldatei ist leer und kann nicht wiederaufgenommen werden.");
  if (selection.file.size > LOCAL_DOCUMENT_SELECTION_CACHE_MAX_FILE_BYTES) throw new LocalDocumentSelectionCacheError("Eine ausgewählte Datei überschreitet das lokale Wiederaufnahme-Limit von 50 MB. Die Auswahl bleibt im aktuellen Tab.");
  return {
    key: recordKey(userId, pseudonymId, selection.id),
    scope: scopeKey(userId, pseudonymId),
    schemaVersion: LOCAL_DOCUMENT_SELECTION_CACHE_VERSION,
    userId,
    pseudonymId,
    id: selection.id,
    name: selection.file.name,
    type: selection.file.type,
    lastModified: selection.file.lastModified,
    bytes: selection.file,
    size: selection.file.size,
    documentType: selection.documentType,
    documentTypeInferred: selection.documentTypeInferred,
    documentDate: selection.documentDate,
    status: selection.status,
    error: selection.error,
    errorKind: selection.errorKind,
    savedAt: new Date().toISOString(),
  };
}

function recordIsCurrent(record: unknown, userId: string, pseudonymId: string): record is StoredSelection {
  const item = record as Partial<StoredSelection> | null;
  return !!item && item.schemaVersion === LOCAL_DOCUMENT_SELECTION_CACHE_VERSION && item.userId === userId
    && item.pseudonymId === pseudonymId && typeof item.id === "string" && item.bytes instanceof Blob
    && typeof item.name === "string" && typeof item.type === "string" && typeof item.documentDate === "string"
    && typeof item.documentType === "string" && typeof item.size === "number" && item.size === item.bytes.size;
}

export function restoreLocalDocumentSelections(records: readonly StoredSelection[]): RestoredLocalDocumentSelection[] {
  return records.map(record => {
    const interrupted = record.status === "processing";
    const needsReRead = interrupted || record.status === "ready";
    return {
      id: record.id,
      file: new File([record.bytes], record.name, { type: record.type, lastModified: record.lastModified }),
      documentType: record.documentType,
      documentTypeInferred: record.documentTypeInferred,
      documentDate: record.documentDate,
      savedAt: record.savedAt,
      status: needsReRead ? "error" : record.status === "error" ? "error" : "queued",
      error: interrupted ? "Einlesen wurde durch Neuladen oder Schließen unterbrochen. Bitte erneut versuchen." : record.status === "ready" ? "Die lokale Auswahl wurde wiederhergestellt. Bitte erneut auslesen und prüfen." : record.error,
      errorKind: interrupted || record.status === "ready" ? "Wiederaufnahme" : record.errorKind,
      recoveryNotice: interrupted || record.status === "ready" ? "Lokale Originaldatei wiederhergestellt; keine Freigabe oder Archivkopie übernommen." : undefined,
    };
  });
}

function saveRecordsAtomically(database: IDBDatabase, records: readonly StoredSelection[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      try { transaction.abort(); } catch {}
      reject(error);
    };
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const existingRequest = store.getAll();
    transaction.oncomplete = () => { if (!settled) { settled = true; resolve(); } };
    transaction.onabort = transaction.onerror = () => {
      if (!settled) {
        settled = true;
        reject(new LocalDocumentSelectionCacheError("Lokale Dateiwiederaufnahme konnte nicht abgeschlossen werden. Möglicherweise ist der lokale Speicher voll."));
      }
    };
    existingRequest.onerror = () => fail(new LocalDocumentSelectionCacheError("Lokale Dateiwiederaufnahme konnte nicht geprüft werden."));
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result as unknown[];
      const replacing = new Set(records.map(record => record.key));
      for (const item of existing) {
        if (!item || typeof item !== "object") continue;
        const current = item as { key?: unknown; schemaVersion?: unknown };
        if (replacing.has(String(current.key ?? "")) && current.schemaVersion !== LOCAL_DOCUMENT_SELECTION_CACHE_VERSION) {
          fail(new LocalDocumentSelectionCacheError("Eine lokale Auswahl mit unbekannter Cache-Version wurde nicht überschrieben. Sie bleibt unverändert erhalten."));
          return;
        }
      }
      const retained = existing.filter(item => !(item && typeof item === "object" && replacing.has(String((item as { key?: unknown }).key ?? ""))));
      const retainedBytes = retained.reduce<number>((sum, item) => {
        const size = Number((item as { size?: unknown })?.size);
        return sum + (Number.isFinite(size) && size >= 0 ? size : LOCAL_DOCUMENT_SELECTION_CACHE_MAX_BYTES);
      }, 0);
      const totalBytes = retainedBytes + records.reduce<number>((sum, record) => sum + record.size, 0);
      if (retained.length + records.length > LOCAL_DOCUMENT_SELECTION_CACHE_MAX_ENTRIES || totalBytes > LOCAL_DOCUMENT_SELECTION_CACHE_MAX_BYTES) {
        fail(new LocalDocumentSelectionCacheError("Lokaler Wiederaufnahmespeicher ist voll (maximal 30 Dateien bzw. 100 MB). Die aktuelle Auswahl bleibt im Tab und wurde nicht als gesichert bestätigt."));
        return;
      }
      try { records.forEach(record => store.put(record)); }
      catch { fail(new LocalDocumentSelectionCacheError("Lokale Dateiwiederaufnahme konnte nicht gespeichert werden. Die Auswahl bleibt im aktuellen Tab.")); }
    };
  });
}

export async function saveLocalDocumentSelections(userId: string, pseudonymId: string, selections: readonly LocalDocumentSelection[]): Promise<void> {
  assertScope(userId, pseudonymId);
  if (!selections.length) return;
  const records = selections.map(selection => toStoredSelection(userId, pseudonymId, selection));
  return enqueueScopeOperation(userId, pseudonymId, async () => {
    const database = await openDatabase();
    try { await saveRecordsAtomically(database, records); }
    finally { database.close(); }
  });
}

export async function loadLocalDocumentSelections(userId: string, pseudonymId: string): Promise<{ selections: RestoredLocalDocumentSelection[]; unsupportedCount: number }> {
  assertScope(userId, pseudonymId);
  return enqueueScopeOperation(userId, pseudonymId, async () => {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const index = transaction.objectStore(STORE_NAME).index("scope");
      const records = await requestResult(index.getAll(scopeKey(userId, pseudonymId)));
      await transactionDone(transaction);
      const current = records.filter(record => recordIsCurrent(record, userId, pseudonymId));
      return { selections: restoreLocalDocumentSelections(current), unsupportedCount: records.length - current.length };
    } finally {
      database.close();
    }
  });
}

export async function removeLocalDocumentSelections(userId: string, pseudonymId: string, ids: readonly string[]): Promise<void> {
  assertScope(userId, pseudonymId);
  if (!ids.length) return;
  return enqueueScopeOperation(userId, pseudonymId, async () => {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      ids.forEach(id => store.delete(recordKey(userId, pseudonymId, id)));
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  });
}
