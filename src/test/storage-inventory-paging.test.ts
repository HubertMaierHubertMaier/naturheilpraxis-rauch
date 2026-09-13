// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { listCompleteStoragePrefix } from "../../supabase/functions/_shared/storageInventoryPaging";

describe("complete original archive listing", () => {
  it("continues beyond the first storage page", async () => {
    const rows = [{ name: "a.pdf" }, { name: "b.pdf" }, { name: "c.pdf" }];
    const list = vi.fn(async (_prefix: string, options: { offset: number; limit: number }) => ({ data: rows.slice(options.offset, options.offset + options.limit), error: null }));
    expect(await listCompleteStoragePrefix({ list }, "synthetic-prefix", 2)).toEqual(rows);
    expect(list.mock.calls.map(call => call[1].offset)).toEqual([0, 2]);
  });
  it("does not disguise a later page failure as a complete empty or partial archive", async () => {
    const list = vi.fn().mockResolvedValueOnce({ data: [{ name: "a" }, { name: "b" }], error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("synthetic failed page") });
    await expect(listCompleteStoragePrefix({ list }, "synthetic-prefix", 2)).rejects.toThrow(/vollständig/);
  });
  it("stops if a storage service repeats the same full page forever", async () => {
    const list = vi.fn(async () => ({ data: [{ name: "a" }, { name: "b" }], error: null }));
    await expect(listCompleteStoragePrefix({ list }, "synthetic-prefix", 2)).rejects.toThrow(/Fortschritt/);
    expect(list).toHaveBeenCalledTimes(2);
  });
});
