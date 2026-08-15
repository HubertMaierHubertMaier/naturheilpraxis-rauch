import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "supabase/functions/backup-export/index.ts"), "utf8");

describe("backup-export bounded paging", () => {
  it("provides admin-protected table and auth page modes", () => {
    const adminCheck = source.indexOf("if (!isAdmin)");
    const tablePage = source.indexOf('mode === "table-page"');
    const authPage = source.indexOf('mode === "auth-page"');
    expect(adminCheck).toBeGreaterThan(-1);
    expect(tablePage).toBeGreaterThan(adminCheck);
    expect(authPage).toBeGreaterThan(adminCheck);
  });

  it("bounds table names and page sizes", () => {
    expect(source).toContain("/^[A-Za-z0-9_]+$/.test(table)");
    expect(source).toContain("TABLE_BLOCKLIST.has(table)");
    expect(source).toContain("limit > 1000");
    expect(source).toContain("perPage > 1000");
  });

  it("uses the discovered live schema without injecting undeployed tables", () => {
    expect(source).toContain('return { tables: [...new Set(filtered)].sort(), source: "openapi" };');
  });

  it("fails the storage listing if any signed URL is missing", () => {
    expect(source).toContain("entries.length !== files.length");
    expect(source).toContain('error: "storage_list_failed"');
  });
});
