// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { documentLoadKey } from "@/lib/documentLoadHistory";
import { directBefundGroupId, groupDirectBefundFiles } from "@/lib/directBefundGroups";
import {
  assertDocumentHandoffClaim, claimDocumentHandoff, claimDocumentPreview, completeDocumentPreview, markDocumentPreviewAccepted,
  readDocumentPreviewStatus, releaseDocumentPreviewClaim, saveDocumentContentDate,
} from "@/lib/localDocumentPreviewLedger";

type Handler = ((event: Event) => void) | null;
class FakeRequest<T> {
  result!: T;
  onsuccess: Handler = null;
  onerror: Handler = null;
  onupgradeneeded: Handler = null;
  onblocked: Handler = null;
}
class FakeDatabase {
  records = new Map<string, unknown>();
  private queue = Promise.resolve();
  objectStoreNames = { contains: () => true };
  transaction() {
    const gate = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>(resolve => { release = resolve; });
    return new FakeTransaction(this, gate, release) as unknown as IDBTransaction;
  }
  close() {}
}
class FakeTransaction {
  oncomplete: Handler = null;
  onabort: Handler = null;
  onerror: Handler = null;
  private finished = false;
  constructor(readonly database: FakeDatabase, readonly gate: Promise<void>, readonly release: () => void) {}
  objectStore() { return new FakeStore(this); }
  finish() {
    if (this.finished) return;
    this.finished = true;
    this.oncomplete?.(new Event("complete"));
    this.release();
  }
  abort() {
    if (this.finished) return;
    this.finished = true;
    this.onabort?.(new Event("abort"));
    this.release();
  }
}
class FakeStore {
  constructor(readonly tx: FakeTransaction) {}
  get(key: string) {
    const request = new FakeRequest<unknown>();
    void this.tx.gate.then(() => setTimeout(() => {
      request.result = this.tx.database.records.get(key);
      request.onsuccess?.(new Event("success"));
      setTimeout(() => this.tx.finish(), 0);
    }, 0));
    return request as unknown as IDBRequest;
  }
  put(value: { key: string }) { this.tx.database.records.set(value.key, value); }
}
class FakeIndexedDb {
  database = new FakeDatabase();
  open() {
    const request = new FakeRequest<IDBDatabase>();
    setTimeout(() => {
      request.result = this.database as unknown as IDBDatabase;
      request.onsuccess?.(new Event("success"));
    }, 0);
    return request as unknown as IDBOpenDBRequest;
  }
}

const pid = "P-2099-0001";
const owner = "synthetic-user";
const bytes = (value: string) => ({ arrayBuffer: async () => new TextEncoder().encode(value).buffer });

describe("local original document ledger", () => {
  beforeEach(() => vi.stubGlobal("indexedDB", new FakeIndexedDb()));
  afterEach(() => vi.unstubAllGlobals());

  it("uses original bytes and case scope, independent of the selection timestamp or filename", async () => {
    const scope = JSON.stringify([owner, pid]);
    const first = await documentLoadKey(scope, bytes("synthetic-content-A"));
    expect(await documentLoadKey(scope, bytes("synthetic-content-A"))).toBe(first);
    expect(await documentLoadKey(scope, bytes("synthetic-content-B"))).not.toBe(first);
    expect(await documentLoadKey(JSON.stringify([owner, "P-2099-0002"]), bytes("synthetic-content-A"))).not.toBe(first);
  });

  it("claims the same original atomically and permits retries only after release or deliberate repeat", async () => {
    const key = await documentLoadKey(JSON.stringify([owner, pid]), bytes("synthetic-document"));
    await saveDocumentContentDate(owner, pid, key, "2099-01-01", "");
    const [first, second] = await Promise.all([
      claimDocumentPreview(owner, pid, key, "claim-1", "2099-01-01"),
      claimDocumentPreview(owner, pid, key, "claim-2", "2099-01-01"),
    ]);
    expect([first.status, second.status].sort()).toEqual(["busy", "claimed"]);
    const winner = first.status === "claimed" ? "claim-1" : "claim-2";
    await completeDocumentPreview(owner, pid, key, winner);
    expect((await claimDocumentPreview(owner, pid, key, "automatic", "2099-01-01")).status).toBe("previewed");
    expect((await claimDocumentPreview(owner, pid, key, "intentional", "2099-01-01", true)).status).toBe("claimed");
    await releaseDocumentPreviewClaim(owner, pid, key, "intentional");
    expect((await readDocumentPreviewStatus(owner, pid, key)).previewedAt).toBeTruthy();
    await claimDocumentHandoff(owner, pid, key, "2099-01-01", "handoff");
    expect((await saveDocumentContentDate(owner, pid, key, "2099-01-02", "2099-01-01")).status).toBe("busy");
    expect((await claimDocumentPreview(owner, pid, key, "forced", "2099-01-01", true)).status).toBe("busy");
    await assertDocumentHandoffClaim(owner, pid, key, "2099-01-01", "handoff");
    await markDocumentPreviewAccepted(owner, pid, key, "2099-01-01", "handoff");
    expect((await readDocumentPreviewStatus(owner, pid, key)).acceptedAt).toBeTruthy();
  });

  it("reuses a confirmed document date after reselection and protects concurrent edits", async () => {
    const key = await documentLoadKey(JSON.stringify([owner, pid]), bytes("dated-synthetic-document"));
    expect(await saveDocumentContentDate(owner, pid, key, "2099-09-17", "")).toEqual({ status: "saved", documentDate: "2099-09-17" });
    expect((await readDocumentPreviewStatus(owner, pid, key)).documentDate).toBe("2099-09-17");
    expect(await saveDocumentContentDate(owner, pid, key, "2099-09-18", "")).toEqual({ status: "conflict", documentDate: "2099-09-17" });
    expect(await saveDocumentContentDate(owner, pid, key, "2099-09-18", "2099-09-17")).toEqual({ status: "saved", documentDate: "2099-09-18" });
    expect((await readDocumentPreviewStatus(owner, pid, key)).documentDate).toBe("2099-09-18");
    expect((await readDocumentPreviewStatus("other-user", pid, key)).documentDate).toBeUndefined();
    expect((await claimDocumentPreview(owner, pid, key, "stale-date", "2099-09-17")).status).toBe("date-conflict");
  });

  it("does not automatically restart an expired claim", async () => {
    const indexedDb = new FakeIndexedDb();
    vi.stubGlobal("indexedDB", indexedDb);
    const key = await documentLoadKey(JSON.stringify([owner, pid]), bytes("interrupted-synthetic-document"));
    await saveDocumentContentDate(owner, pid, key, "2099-03-01", "");
    expect((await claimDocumentPreview(owner, pid, key, "old", "2099-03-01")).status).toBe("claimed");
    const stored = [...indexedDb.database.records.values()][0] as { leaseUntil: number };
    stored.leaseUntil = Date.now() - 1;
    expect((await claimDocumentPreview(owner, pid, key, "automatic", "2099-03-01")).status).toBe("interrupted");
    expect((await claimDocumentPreview(owner, pid, key, "confirmed", "2099-03-01", true)).status).toBe("claimed");
    await releaseDocumentPreviewClaim(owner, pid, key, "confirmed");
  });

  it("requires a fresh preview after the confirmed date changes", async () => {
    const key = await documentLoadKey(JSON.stringify([owner, pid]), bytes("date-change-after-preview"));
    await saveDocumentContentDate(owner, pid, key, "2099-04-01", "");
    expect((await claimDocumentPreview(owner, pid, key, "preview", "2099-04-01")).status).toBe("claimed");
    await completeDocumentPreview(owner, pid, key, "preview");
    await saveDocumentContentDate(owner, pid, key, "2099-04-02", "2099-04-01");
    await expect(claimDocumentHandoff(owner, pid, key, "2099-04-01", "handoff")).rejects.toThrow("Dokumentdatum");
    await expect(claimDocumentHandoff(owner, pid, key, "2099-04-02", "handoff")).rejects.toThrow("Dokumentdatum");
  });
});

describe("document groups", () => {
  it("keeps the explicit laboratory types apart and leaves unknown files unassigned", () => {
    expect(directBefundGroupId("labor")).toBe("patienten");
    expect(directBefundGroupId("biodiagnostik")).toBe("biodiagnostik");
    expect(directBefundGroupId("")).toBe("unassigned");
    const groups = groupDirectBefundFiles([
      { documentType: "anamnese" as const }, { documentType: "labor" as const },
      { documentType: "biodiagnostik" as const }, { documentType: "" as const },
    ]);
    expect(groups.map(group => [group.id, group.items.length])).toEqual([
      ["anamnese", 1], ["patienten", 1], ["biodiagnostik", 1], ["unassigned", 1],
    ]);
  });
});
