import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { recordDocumentLoad } from "../lib/documentLoadHistoryStore";

const db = vi.hoisted(() => ({ rows: new Map<string, any>(), user: "user-a", fail: false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: db.user } }, error: null }) },
  from: () => {
    const filters: Record<string, string> = {};
    const chain = {
      insert: async (row: any) => {
        if (db.fail) return { error: { code: "offline" } };
        if (db.rows.has(row.id)) return { error: { code: "23505" } };
        db.rows.set(row.id, row);
        return { error: null };
      },
      select: () => chain,
      eq: (key: string, value: string) => { filters[key] = value; return chain; },
      single: async () => {
        const row = [...db.rows.values()].find(row => Object.entries(filters).every(([k, v]) => row[k] === v));
        return { data: row || null, error: row ? null : { code: "missing" } };
      },
    };
    return chain;
  },
} }));

const file = { arrayBuffer: async () => new TextEncoder().encode("synthetic only").buffer } as File;
const timestamp = "2026-09-25T08:00:00Z";
describe("persistent document load events", () => {
  beforeEach(() => { vi.stubGlobal("crypto", webcrypto); db.rows.clear(); db.user = "user-a"; db.fail = false; });
  afterEach(() => vi.unstubAllGlobals());
  it("appends five actual selections and never overwrites their timestamps", async () => {
    for (let day = 1; day <= 5; day++) await recordDocumentLoad("user-a", "case-a", crypto.randomUUID(), file, "labor", `2026-09-0${day}T08:00:00Z`);
    expect(db.rows.size).toBe(5);
    expect(new Set([...db.rows.values()].map(row => row.befund_meta.loads[0].loadedAt)).size).toBe(5);
  });
  it("replaying the same saved draft is idempotent", async () => {
    const id = crypto.randomUUID();
    const first = await recordDocumentLoad("user-a", "case-a", id, file, "labor", timestamp);
    const restored = await recordDocumentLoad("user-a", "case-a", id, file, "labor", timestamp);
    expect(restored).toEqual(first);
    expect(db.rows.size).toBe(1);
  });
  it("does not acknowledge a colliding event belonging to another case", async () => {
    const id = crypto.randomUUID();
    await recordDocumentLoad("user-a", "case-a", id, file, "labor", timestamp);
    await expect(recordDocumentLoad("user-a", "case-b", id, file, "labor", timestamp)).rejects.toThrow(/nicht bestätigt/);
    expect(db.rows.size).toBe(1);
  });
  it("surfaces failure and allows a retry with the original timestamp", async () => {
    const id = crypto.randomUUID();
    db.fail = true;
    await expect(recordDocumentLoad("user-a", "case-a", id, file, "labor", timestamp)).rejects.toThrow();
    expect(db.rows.size).toBe(0);
    db.fail = false;
    await recordDocumentLoad("user-a", "case-a", id, file, "labor", timestamp);
    expect(db.rows.get(id).befund_meta.loads[0].loadedAt).toBe(timestamp);
  });
  it("refuses saving after the authenticated user changed", async () => {
    db.user = "user-b";
    await expect(recordDocumentLoad("user-a", "case-a", crypto.randomUUID(), file, "labor", timestamp)).rejects.toThrow(/Anmeldung/);
    expect(db.rows.size).toBe(0);
  });
});
