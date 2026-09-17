import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isCurrentLocalSelectionOperation,
  localSelectionPreviewKey,
  loadLocalDocumentSelections,
  removeLocalDocumentSelections,
  saveLocalDocumentSelections,
  type LocalDocumentSelection,
} from "@/lib/localDocumentSelectionCache";

type Handler = ((event: Event) => void) | null;
it("separates safe preview text by both owner and case without delimiter collisions", () => {
  expect(localSelectionPreviewKey("user-a", "case-a")).not.toBe(localSelectionPreviewKey("user-b", "case-a"));
  expect(localSelectionPreviewKey("user-a", "case-a")).not.toBe(localSelectionPreviewKey("user-a", "case-b"));
  expect(localSelectionPreviewKey("a:b", "c")).not.toBe(localSelectionPreviewKey("a", "b:c"));
  expect(() => localSelectionPreviewKey("", "case-a")).toThrow();
});
class FakeRequest<T> {
  result!: T;
  error: DOMException | null = null;
  onsuccess: Handler = null;
  onerror: Handler = null;
  succeed(value: T) { setTimeout(() => { this.result = value; this.onsuccess?.(new Event("success")); }, 0); }
}
class FakeTransaction {
  oncomplete: Handler = null;
  onabort: Handler = null;
  onerror: Handler = null;
  failed = false;
  constructor(readonly database: FakeDatabase) { setTimeout(() => { if (!this.failed) this.oncomplete?.(new Event("complete")); }, 10); }
  objectStore() { return new FakeStore(this.database, this); }
  fail() { this.failed = true; setTimeout(() => { this.onerror?.(new Event("error")); this.onabort?.(new Event("abort")); }, 0); }
}
class FakeStore {
  constructor(readonly database: FakeDatabase, readonly transaction: FakeTransaction) {}
  getAll() { const request = new FakeRequest<unknown[]>(); request.succeed([...this.database.records.values()]); return request as unknown as IDBRequest<unknown[]>; }
  put(value: any) { if (this.database.failWrites) this.transaction.fail(); else this.database.records.set(value.key, value); }
  delete(key: string) { this.database.records.delete(key); }
  index() { return { getAll: (scope: string) => { const request = new FakeRequest<unknown[]>(); request.succeed([...this.database.records.values()].filter((item: any) => item.scope === scope)); return request as unknown as IDBRequest<unknown[]>; } } as IDBIndex; }
}
class FakeDatabase {
  records = new Map<string, any>();
  failWrites = false;
  objectStoreNames = { contains: () => true } as unknown as DOMStringList;
  transaction() { return new FakeTransaction(this) as unknown as IDBTransaction; }
  close() {}
}
class FakeIndexedDb {
  readonly database = new FakeDatabase();
  open() {
    const request = new FakeRequest<IDBDatabase>() as unknown as IDBOpenDBRequest & { onsuccess: Handler; onupgradeneeded: Handler; onblocked: Handler; result: IDBDatabase };
    setTimeout(() => { request.result = this.database as unknown as IDBDatabase; request.onsuccess?.(new Event("success")); }, 0);
    return request;
  }
}

const readText = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(blob);
});

const selection = (id: string, status: LocalDocumentSelection["status"] = "queued"): LocalDocumentSelection => ({
  id,
  file: new File([`bytes-${id}`], `${id}.pdf`, { type: "application/pdf", lastModified: 123 }),
  documentType: "labor",
  documentDate: "2099-01-01",
  status,
});

describe("local document selection cache", () => {
  let indexedDb: FakeIndexedDb;
  beforeEach(() => { indexedDb = new FakeIndexedDb(); vi.stubGlobal("indexedDB", indexedDb); });
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips original bytes and changes interrupted processing into an explicit retry", async () => {
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [selection("one", "processing")]);
    const loaded = await loadLocalDocumentSelections("user-a", "P-2099-0001");
    expect(loaded.unsupportedCount).toBe(0);
    expect(loaded.selections).toHaveLength(1);
    expect(loaded.selections[0]).toMatchObject({ status: "error", errorKind: "Wiederaufnahme" });
    await expect(readText(loaded.selections[0].file)).resolves.toBe("bytes-one");
  });

  it("isolates the same item id by authenticated user and patient case", async () => {
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [selection("same")]);
    await saveLocalDocumentSelections("user-a", "P-2099-0002", [selection("same")]);
    await saveLocalDocumentSelections("user-b", "P-2099-0001", [selection("same")]);
    expect((await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections).toHaveLength(1);
    expect((await loadLocalDocumentSelections("user-a", "P-2099-0002")).selections).toHaveLength(1);
    expect((await loadLocalDocumentSelections("user-b", "P-2099-0001")).selections).toHaveLength(1);
  });

  it("does not partially save a selection batch beyond the bounded capacity", async () => {
    await expect(saveLocalDocumentSelections("user-a", "P-2099-0001", Array.from({ length: 31 }, (_, index) => selection(`quota-${index}`)))).rejects.toThrow(/maximal 30 Dateien/);
    expect((await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections).toEqual([]);
  });

  it("keeps prior bytes when IndexedDB fails and only removes after an explicit request", async () => {
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [selection("remove")]);
    indexedDb.database.failWrites = true;
    await expect(saveLocalDocumentSelections("user-a", "P-2099-0001", [selection("failed")])).rejects.toThrow(/Lokale Dateiwiederaufnahme/);
    indexedDb.database.failWrites = false;
    expect((await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections.map(item => item.id)).toEqual(["remove"]);
    await removeLocalDocumentSelections("user-a", "P-2099-0001", ["remove"]);
    expect((await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections).toEqual([]);
  });

  it("preserves an unknown schema record with the same key instead of overwriting it", async () => {
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [selection("schema")]);
    const record = [...indexedDb.database.records.values()][0];
    record.schemaVersion = 99;
    await expect(saveLocalDocumentSelections("user-a", "P-2099-0001", [selection("schema")])).rejects.toThrow(/unbekannter Cache-Version/);
    expect(indexedDb.database.records.get(record.key).schemaVersion).toBe(99);
  });

  it("serializes concurrent budget checks and does not let save resurrect a removed selection", async () => {
    const first = Array.from({ length: 16 }, (_, index) => selection(`parallel-a-${index}`));
    const second = Array.from({ length: 16 }, (_, index) => selection(`parallel-b-${index}`));
    const firstSave = saveLocalDocumentSelections("user-a", "P-2099-0001", first);
    const secondSave = saveLocalDocumentSelections("user-a", "P-2099-0001", second);
    await expect(firstSave).resolves.toBeUndefined();
    await expect(secondSave).rejects.toThrow(/maximal 30 Dateien/);
    expect((await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections).toHaveLength(16);

    const saving = saveLocalDocumentSelections("user-a", "P-2099-0002", [selection("late-save")]);
    const removing = removeLocalDocumentSelections("user-a", "P-2099-0002", ["late-save"]);
    await Promise.all([saving, removing]);
    expect((await loadLocalDocumentSelections("user-a", "P-2099-0002")).selections).toEqual([]);
  });

  it("keeps a token refresh current but rejects a late restore for another user, case, or generation", () => {
    const expected = { userId: "user-a", pseudonymId: "P-2099-0001", generation: 4 };
    expect(isCurrentLocalSelectionOperation(expected, { ...expected })).toBe(true);
    expect(isCurrentLocalSelectionOperation(expected, { ...expected, userId: "user-b" })).toBe(false);
    expect(isCurrentLocalSelectionOperation(expected, { ...expected, pseudonymId: "P-2099-0002" })).toBe(false);
    expect(isCurrentLocalSelectionOperation(expected, { ...expected, generation: 5 })).toBe(false);
  });
});
