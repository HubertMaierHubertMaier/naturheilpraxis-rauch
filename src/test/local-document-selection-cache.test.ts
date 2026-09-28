import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import {
  isCurrentLocalSelectionOperation,
  LocalDocumentSelectionConflictError,
  localSelectionPreviewKey,
  loadLocalDocumentSelections,
  removeLocalDocumentSelections,
  saveLocalDocumentSelections,
  type LocalDocumentSelection,
  type LocalDocumentSelectionBaseline,
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

const intakeSource = readFileSync(resolve(process.cwd(), "src/components/admin/TherapyRecommendation.tsx"), "utf8").replace(/\r\n/g, "\n");
const fingerprintStart = intakeSource.indexOf("const selectionCacheItem =");
const fingerprintEnd = intakeSource.indexOf("const isPdfClinicalDocument =", fingerprintStart);
if (fingerprintStart < 0 || fingerprintEnd <= fingerprintStart) throw new Error("Selection change detection not found");
const fingerprintJs = ts.transpileModule(intakeSource.slice(fingerprintStart, fingerprintEnd), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const { selectionCacheItem, selectionCacheFingerprint, changedSelectionCacheItems, saveableSelectionCacheItems, updateMatchingSelectionCacheItems } = new Function(`${fingerprintJs}; return { selectionCacheItem, selectionCacheFingerprint, changedSelectionCacheItems, saveableSelectionCacheItems, updateMatchingSelectionCacheItems };`)() as {
  selectionCacheItem: (item: LocalDocumentSelection) => LocalDocumentSelectionBaseline;
  selectionCacheFingerprint: (items: LocalDocumentSelection[]) => string;
  changedSelectionCacheItems: (items: LocalDocumentSelection[], previous: string) => LocalDocumentSelection[];
  saveableSelectionCacheItems: <T extends LocalDocumentSelection & { localCacheConflict?: boolean }>(items: T[], previous: string) => T[];
  updateMatchingSelectionCacheItems: <T extends LocalDocumentSelection>(current: T[], changed: T[], update: (item: T) => T) => T[];
};

describe("local document selection cache", () => {
  let indexedDb: FakeIndexedDb;
  beforeEach(() => { indexedDb = new FakeIndexedDb(); vi.stubGlobal("indexedDB", indexedDb); });
  afterEach(() => vi.unstubAllGlobals());

  it("restores the original load timestamp and event ID without creating a new event", async () => {
    const original = { ...selection("history"), loadedAt: "2026-09-24T15:08:00Z", loadEventId: "fixed-event", loadHistoryStatus: "pending" as const };
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [original]);
    const first = await loadLocalDocumentSelections("user-a", "P-2099-0001");
    const again = await loadLocalDocumentSelections("user-a", "P-2099-0001");
    expect(first.selections[0]).toMatchObject({ loadedAt: original.loadedAt, loadEventId: original.loadEventId, documentDate: original.documentDate, loadHistoryStatus: "pending" });
    expect(again.selections[0].draftSavedAt).toBe(first.selections[0].draftSavedAt);
    expect(again.selections[0].loadEventId).toBe(original.loadEventId);
  });

  it("restores two already previewed documents with their original bytes and load IDs", async () => {
    const selected = [
      { ...selection("anamnese", "ready"), documentType: "anamnese", documentDate: "2099-09-17", loadedAt: "2099-09-28T10:00:00Z", loadEventId: "synthetic-load-a", loadHistoryStatus: "saved" as const },
      { ...selection("hospital", "ready"), documentType: "metatron", documentDate: "2099-09-17", loadedAt: "2099-09-28T10:01:00Z", loadEventId: "synthetic-load-b", loadHistoryStatus: "saved" as const },
    ];
    await saveLocalDocumentSelections("user-a", "P-2099-0001", selected);
    const recovered = (await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections;
    expect(recovered).toHaveLength(2);
    for (let index = 0; index < selected.length; index++) {
      expect(recovered[index]).toMatchObject({
        documentType: selected[index].documentType, documentDate: "2099-09-17",
        loadedAt: selected[index].loadedAt, loadEventId: selected[index].loadEventId,
        loadHistoryStatus: "saved", status: "error", errorKind: "Wiederaufnahme",
      });
      await expect(readText(recovered[index].file)).resolves.toBe(`bytes-${selected[index].id}`);
    }
  });

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

  it("retains other selections in the same case when saving only one changed row", async () => {
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [selection("anamnese"), selection("hospital")]);
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [{ ...selection("anamnese"), documentDate: "2099-09-17" }]);
    const restored = (await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections;
    expect(restored).toHaveLength(2);
    expect(restored.find(item => item.id === "anamnese")?.documentDate).toBe("2099-09-17");
    expect(restored.find(item => item.id === "hospital")?.documentDate).toBe("2099-01-01");
  });

  it("keeps both document dates when another tab appends a selection from an older view", async () => {
    const oldView = [
      { ...selection("anamnese"), documentType: "anamnese", documentDate: "", loadedAt: "2030-09-28T10:00:00Z", loadEventId: "event-anamnese" },
      { ...selection("hospital"), documentType: "metatron", documentDate: "", loadedAt: "2030-09-28T10:01:00Z", loadEventId: "event-hospital" },
    ];
    await saveLocalDocumentSelections("user-a", "P-2099-0001", oldView);
    const oldFingerprint = selectionCacheFingerprint(oldView);
    const datedView = oldView.map(item => ({ ...item, documentDate: "2030-09-17" }));
    await saveLocalDocumentSelections("user-a", "P-2099-0001", changedSelectionCacheItems(datedView, oldFingerprint), new Map(oldView.map(item => [item.id, selectionCacheItem(item)])));

    const staleViewWithNewFile = [...oldView, { ...selection("another-hospital"), documentType: "metatron", documentDate: "", loadedAt: "2030-09-28T10:02:00Z", loadEventId: "event-new" }];
    const changed = changedSelectionCacheItems(staleViewWithNewFile, oldFingerprint);
    expect(changed.map(item => item.id)).toEqual(["another-hospital"]);
    await saveLocalDocumentSelections("user-a", "P-2099-0001", changed, new Map(oldView.map(item => [item.id, selectionCacheItem(item)])));

    const reopened = (await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections;
    expect(reopened).toHaveLength(3);
    expect(reopened.find(item => item.id === "anamnese")).toMatchObject({ documentDate: "2030-09-17", loadedAt: oldView[0].loadedAt, loadEventId: oldView[0].loadEventId });
    expect(reopened.find(item => item.id === "hospital")).toMatchObject({ documentDate: "2030-09-17", loadedAt: oldView[1].loadedAt, loadEventId: oldView[1].loadEventId });
    expect(reopened.find(item => item.id === "another-hospital")?.documentDate).toBe("");
  });

  it("rejects a stale type change on the same file instead of replacing another tab's date", async () => {
    const initial = { ...selection("same-file"), documentType: "", documentDate: "" };
    const baseline = new Map([[initial.id, selectionCacheItem(initial)]]);
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [initial]);
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [{ ...initial, documentDate: "2030-09-17" }], baseline);
    await expect(saveLocalDocumentSelections("user-a", "P-2099-0001", [{ ...initial, documentType: "metatron" }], baseline)).rejects.toBeInstanceOf(LocalDocumentSelectionConflictError);
    expect((await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections[0]).toMatchObject({ documentType: "", documentDate: "2030-09-17" });
  });

  it("reports a conflict instead of overwriting a date changed in another tab", async () => {
    const initial = { ...selection("same-file"), documentType: "anamnese", documentDate: "" };
    const baseline = new Map([[initial.id, selectionCacheItem(initial)]]);
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [initial]);
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [{ ...initial, documentDate: "2030-09-17" }], baseline);
    await expect(saveLocalDocumentSelections("user-a", "P-2099-0001", [{ ...initial, documentDate: "2030-09-18" }], baseline)).rejects.toThrow(/anderen Tab/);
    expect((await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections[0].documentDate).toBe("2030-09-17");
  });

  it("keeps a conflicted date blocked when the stale tab changes a different field afterward", async () => {
    const initial = { ...selection("same-file"), documentType: "anamnese", documentDate: "" };
    const baseline = new Map([[initial.id, selectionCacheItem(initial)]]);
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [initial]);
    await saveLocalDocumentSelections("user-a", "P-2099-0001", [{ ...initial, documentDate: "2030-09-17" }], baseline);
    const staleDate = { ...initial, documentDate: "2030-09-18" };
    await expect(saveLocalDocumentSelections("user-a", "P-2099-0001", [staleDate], baseline)).rejects.toBeInstanceOf(LocalDocumentSelectionConflictError);
    const staleFingerprint = selectionCacheFingerprint([staleDate]);
    const staleTypeChange = { ...staleDate, documentType: "metatron", localCacheConflict: true, localCacheStatus: "error" };
    expect(saveableSelectionCacheItems([staleTypeChange], staleFingerprint)).toEqual([]);
    expect(staleTypeChange.localCacheStatus).toBe("error");
    expect((await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections[0]).toMatchObject({ documentType: "anamnese", documentDate: "2030-09-17" });
  });

  it("acknowledges two overlapping saves per row without leaving the first date pending", async () => {
    const anamnese = { ...selection("anamnese"), documentType: "anamnese", documentDate: "2030-09-17", localCacheStatus: "saving" };
    const hospital = { ...selection("hospital"), documentType: "metatron", documentDate: "2030-09-17", localCacheStatus: "saving" };
    let current = [anamnese, hospital];
    const acknowledge = (changed: typeof current) => {
      current = updateMatchingSelectionCacheItems(current, changed, item => ({ ...item, localCacheStatus: "saved" }));
    };
    const firstSave = saveLocalDocumentSelections("user-a", "P-2099-0001", [anamnese]).then(() => acknowledge([anamnese]));
    const secondSave = saveLocalDocumentSelections("user-a", "P-2099-0001", [hospital]).then(() => acknowledge([hospital]));
    await Promise.all([firstSave, secondSave]);
    expect(current.map(item => item.localCacheStatus)).toEqual(["saved", "saved"]);
    expect((await loadLocalDocumentSelections("user-a", "P-2099-0001")).selections.map(item => item.documentDate)).toEqual(["2030-09-17", "2030-09-17"]);

    const newerAnamnese = { ...current[0], documentDate: "2030-09-18", localCacheStatus: "saving" };
    expect(updateMatchingSelectionCacheItems([newerAnamnese], [anamnese], item => ({ ...item, localCacheStatus: "saved" }))[0].localCacheStatus).toBe("saving");
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
