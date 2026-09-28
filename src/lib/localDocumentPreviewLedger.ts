const DATABASE_NAME = "therapy-local-document-preview-ledger";
const STORE_NAME = "previews";
const LEASE_MS = 5 * 60 * 1000;

type StoredPreview = {
  key: string;
  version: 1;
  userId: string;
  pseudonymId: string;
  documentKey: string;
  previewedAt?: string;
  previewDocumentDate?: string;
  acceptedAt?: string;
  documentDate?: string;
  claimId?: string;
  claimKind?: "preview" | "handoff";
  leaseUntil?: number;
};

export type DocumentPreviewStatus = {
  previewedAt?: string;
  acceptedAt?: string;
  documentDate?: string;
  busy: boolean;
  interrupted: boolean;
};
export type DocumentPreviewClaim = { status: "claimed" | "previewed" | "busy" | "interrupted" | "date-conflict"; previewedAt?: string; acceptedAt?: string; documentDate?: string };

const previewKey = (userId: string, pseudonymId: string, documentKey: string) => {
  if (!userId.trim() || !/^P-\d{4}-\d{4}$/.test(pseudonymId) || !/^[0-9a-f]{64}$/i.test(documentKey)) {
    throw new Error("Die lokale Dokumentkennung ist nicht vollständig. Es wurde nichts ausgelesen.");
  }
  return JSON.stringify([userId, pseudonymId, documentKey.toLowerCase()]);
};

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("Der lokale Verarbeitungsnachweis ist in diesem Browser nicht verfügbar. Es wurde nichts ausgelesen.");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Der lokale Verarbeitungsnachweis konnte nicht geöffnet werden. Es wurde nichts ausgelesen."));
    request.onblocked = () => reject(new Error("Ein anderer Tab blockiert den lokalen Verarbeitungsnachweis. Es wurde nichts ausgelesen."));
  });
}

function assertStoredPreview(value: unknown, key: string): StoredPreview | undefined {
  if (value === undefined) return undefined;
  const record = value as Partial<StoredPreview> | null;
  if (!record || record.version !== 1 || record.key !== key) {
    throw new Error("Ein unbekannter lokaler Verarbeitungsnachweis wurde nicht verändert. Es wurde nichts ausgelesen.");
  }
  return record as StoredPreview;
}

async function transact<T>(key: string, mode: IDBTransactionMode,
  update: (current: StoredPreview | undefined, store: IDBObjectStore) => T): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      let result: T;
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        try { transaction.abort(); } catch { /* The transaction may already have failed. */ }
        reject(error instanceof Error ? error : new Error("Der lokale Verarbeitungsnachweis konnte nicht gesichert werden."));
      };
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        try { result = update(assertStoredPreview(request.result, key), store); }
        catch (error) { fail(error); }
      };
      request.onerror = () => fail(new Error("Der lokale Verarbeitungsnachweis konnte nicht gelesen werden."));
      transaction.oncomplete = () => { if (!settled) { settled = true; resolve(result); } };
      transaction.onabort = transaction.onerror = () => fail(new Error("Der lokale Verarbeitungsnachweis konnte nicht gesichert werden."));
    });
  } finally {
    database.close();
  }
}

export async function readDocumentPreviewStatus(userId: string, pseudonymId: string, documentKey: string): Promise<DocumentPreviewStatus> {
  const key = previewKey(userId, pseudonymId, documentKey);
  return transact(key, "readonly", current => ({
    previewedAt: current?.previewedAt,
    acceptedAt: current?.acceptedAt,
    documentDate: current?.documentDate,
    busy: Boolean(current?.claimId && (current.claimKind === "handoff" || current.leaseUntil && current.leaseUntil > Date.now())),
    interrupted: Boolean(current?.claimId && current.claimKind !== "handoff" && (!current.leaseUntil || current.leaseUntil <= Date.now())),
  }));
}

export type DocumentDateSaveResult = { status: "saved" | "conflict" | "busy"; documentDate: string };

export async function saveDocumentContentDate(userId: string, pseudonymId: string, documentKey: string,
  documentDate: string, expectedDate: string): Promise<DocumentDateSaveResult> {
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(documentDate) ? new Date(`${documentDate}T00:00:00Z`) : null;
  if (!parsedDate || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== documentDate) {
    throw new Error("Bitte ein gültiges Dokumentdatum eintragen.");
  }
  const key = previewKey(userId, pseudonymId, documentKey);
  return transact(key, "readwrite", (current, store) => {
    const currentDate = current?.documentDate || "";
    if (current?.claimId && currentDate !== documentDate) return { status: "busy", documentDate: currentDate };
    if (currentDate !== expectedDate && currentDate !== documentDate) return { status: "conflict", documentDate: currentDate };
    if (currentDate !== documentDate) {
      const [storedUserId, storedPid, storedDocumentKey] = JSON.parse(key) as [string, string, string];
      store.put({ ...current, key, version: 1, userId: storedUserId, pseudonymId: storedPid,
        documentKey: storedDocumentKey, documentDate } satisfies StoredPreview);
    }
    return { status: "saved", documentDate };
  });
}

export async function claimDocumentPreview(userId: string, pseudonymId: string, documentKey: string,
  claimId: string, expectedDocumentDate: string, deliberateRepeat = false): Promise<DocumentPreviewClaim> {
  const key = previewKey(userId, pseudonymId, documentKey);
  if (!claimId) throw new Error("Der Ausleseversuch hat keine Kennung.");
  return transact(key, "readwrite", (current, store) => {
    if (current?.documentDate !== expectedDocumentDate) {
      return { status: "date-conflict", documentDate: current?.documentDate };
    }
    if (current?.claimId && current.claimKind === "handoff") {
      return { status: "busy", previewedAt: current.previewedAt, acceptedAt: current.acceptedAt };
    }
    if (current?.claimId && current.leaseUntil && current.leaseUntil > Date.now()) {
      return { status: "busy", previewedAt: current.previewedAt, acceptedAt: current.acceptedAt };
    }
    if (current?.claimId && !deliberateRepeat) {
      return { status: "interrupted", previewedAt: current.previewedAt, acceptedAt: current.acceptedAt };
    }
    if (current?.previewedAt && !deliberateRepeat) {
      return { status: "previewed", previewedAt: current.previewedAt, acceptedAt: current.acceptedAt };
    }
    const [storedUserId, storedPid, storedDocumentKey] = JSON.parse(key) as [string, string, string];
    store.put({ ...current, key, version: 1, userId: storedUserId, pseudonymId: storedPid,
      documentKey: storedDocumentKey, claimId, claimKind: "preview", leaseUntil: Date.now() + LEASE_MS } satisfies StoredPreview);
    return { status: "claimed", previewedAt: current?.previewedAt, acceptedAt: current?.acceptedAt };
  });
}

export async function renewDocumentPreviewClaim(userId: string, pseudonymId: string, documentKey: string, claimId: string): Promise<boolean> {
  const key = previewKey(userId, pseudonymId, documentKey);
  return transact(key, "readwrite", (current, store) => {
    if (current?.claimId !== claimId || current.claimKind !== "preview") return false;
    store.put({ ...current, leaseUntil: Date.now() + LEASE_MS });
    return true;
  });
}

export async function completeDocumentPreview(userId: string, pseudonymId: string, documentKey: string, claimId: string): Promise<void> {
  const key = previewKey(userId, pseudonymId, documentKey);
  await transact(key, "readwrite", (current, store) => {
    if (current?.claimId !== claimId || current.claimKind !== "preview" || !current.leaseUntil || current.leaseUntil <= Date.now()) {
      throw new Error("Der lokale Ausleseanspruch ist abgelaufen. Die Vorschau wurde nicht als gesichert bestätigt.");
    }
    store.put({ ...current, previewedAt: new Date().toISOString(), previewDocumentDate: current.documentDate,
      claimId: undefined, claimKind: undefined, leaseUntil: undefined });
  });
}

export async function releaseDocumentPreviewClaim(userId: string, pseudonymId: string, documentKey: string, claimId: string): Promise<void> {
  const key = previewKey(userId, pseudonymId, documentKey);
  await transact(key, "readwrite", (current, store) => {
    if (current?.claimId === claimId) store.put({ ...current, claimId: undefined, claimKind: undefined, leaseUntil: undefined });
  });
}

export async function claimDocumentHandoff(userId: string, pseudonymId: string, documentKey: string,
  expectedDocumentDate: string, claimId: string): Promise<void> {
  const key = previewKey(userId, pseudonymId, documentKey);
  await transact(key, "readwrite", (current, store) => {
    if (!current?.previewedAt || current.documentDate !== expectedDocumentDate || current.previewDocumentDate !== expectedDocumentDate) {
      throw new Error("Das bestätigte Dokumentdatum hat sich seit der Vorschau geändert. Bitte die Originaldatei erneut prüfen.");
    }
    if (current.claimId) throw new Error("Diese Originaldatei ist für eine Verarbeitung oder Übernahme gesperrt. Bitte den Speicherstand im anderen Tab prüfen.");
    store.put({ ...current, claimId, claimKind: "handoff", leaseUntil: undefined });
  });
}

export async function assertDocumentHandoffClaim(userId: string, pseudonymId: string, documentKey: string,
  expectedDocumentDate: string, claimId: string): Promise<void> {
  const key = previewKey(userId, pseudonymId, documentKey);
  await transact(key, "readonly", current => {
    if (current?.claimId !== claimId || current.claimKind !== "handoff" || current.documentDate !== expectedDocumentDate
      || current.previewDocumentDate !== expectedDocumentDate) {
      throw new Error("Der lokale Übernahmeanspruch oder das Dokumentdatum hat sich geändert. Es wurde nichts neu gespeichert.");
    }
  });
}

export async function markDocumentPreviewAccepted(userId: string, pseudonymId: string, documentKey: string,
  expectedDocumentDate?: string, claimId?: string): Promise<void> {
  const key = previewKey(userId, pseudonymId, documentKey);
  await transact(key, "readwrite", (current, store) => {
    if (!current?.previewedAt) throw new Error("Eine übernommene Vorschau hat keinen lokalen Auslesenachweis.");
    if (claimId && (current.claimId !== claimId || current.claimKind !== "handoff"
      || current.documentDate !== expectedDocumentDate || current.previewDocumentDate !== expectedDocumentDate)) {
      throw new Error("Der lokale Verarbeitungsnachweis wurde vor Abschluss der Übernahme verändert.");
    }
    store.put({ ...current, acceptedAt: new Date().toISOString(), claimId: claimId ? undefined : current.claimId,
      claimKind: claimId ? undefined : current.claimKind,
      leaseUntil: claimId ? undefined : current.leaseUntil });
  });
}
